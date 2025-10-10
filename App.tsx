import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Tab, SlicingParams, ProjectionParams, AlignmentParams, PrintMode, PresentationConnection, SlicingStatus, SlicingStats } from './types';
import type { BluetoothRemoteGATTCharacteristic } from './types';
import SliderInput from './components/SliderInput';
import STLViewer from './components/STLViewer';
import SlicePreview from './components/SlicePreview';
import { io, Socket } from 'socket.io-client';

// --- ICONS (No changes) ---
const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
);
const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm11.707 6.293a1 1 0 01-1.414 0L14 8.414V14a2 2 0 01-2 2H8a2 2 0 01-2-2V8.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 010 1.414z" />
    </svg>
);
const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


// --- SlicingTab COMPONENT ---
const SlicingTab: React.FC<{
    slicingParams: SlicingParams;
    setSlicingParams: React.Dispatch<React.SetStateAction<SlicingParams>>;
    handleSlice: () => void;
    slicingStatus: SlicingStatus;
    slicingProgress: number;
    slicingStats: SlicingStats;
    slicingStatusMessage: string; // <-- NEW PROP
    fileName: string | null;
    setFileName: (name: string | null) => void;
    setStlFile: (file: File | null) => void;
}> = ({ slicingParams, setSlicingParams, handleSlice, slicingStatus, slicingProgress, slicingStats, slicingStatusMessage, fileName, setFileName, setStlFile }) => {
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            setStlFile(file);
        } else {
            setFileName(null);
            setStlFile(null);
        }
    };

    const isSlicing = slicingStatus === 'slicing';

    return (
        <div className="space-y-6 flex flex-col items-center p-6">
            <label className="w-full max-w-sm cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                <UploadIcon />
                <span>Upload STL File</span>
                <input type="file" className="hidden" accept=".stl" onChange={handleFileChange} />
            </label>
            <p className="text-sm text-neutral-500 h-5">{fileName || "No File Selected"}</p>
            
            <div className="w-full max-w-sm space-y-4">
                <SliderInput label="Voxel Size" min={0.1} max={5} step={0.1} value={slicingParams.voxelSize} onChange={val => setSlicingParams(p => ({ ...p, voxelSize: val }))} />
                <SliderInput label="Number of Projections" min={90} max={720} step={90} value={slicingParams.numProjections} onChange={val => setSlicingParams(p => ({ ...p, numProjections: val }))} />
                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Initial Rotation</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['X', 'Y', 'Z'].map(axis => (
                            <div key={axis}>
                                <label htmlFor={`rot-${axis}`} className="block text-xs text-neutral-400">{axis}</label>
                                <input type="number" id={`rot-${axis}`} value={slicingParams[`rot${axis}` as 'rotX' | 'rotY' | 'rotZ']} onChange={e => setSlicingParams(p => ({ ...p, [`rot${axis}`]: parseInt(e.target.value) || 0 }))} className="w-full bg-neutral-800 text-neutral-100 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={handleSlice} disabled={!fileName || isSlicing} className="w-full max-w-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition flex items-center justify-center">
                {isSlicing && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                {isSlicing ? 'Slicing...' : 'Slice'}
            </button>

            <div className="w-full max-w-sm h-12 mt-2">
                {isSlicing && (
                    <div className="w-full">
                        <div className="w-full bg-neutral-700 rounded-full h-2.5">
                            <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${slicingProgress}%`, transition: 'width 0.2s ease-in-out' }}></div>
                        </div>
                        {/* --- MODIFIED to show specific feedback --- */}
                        <p className="text-center text-sm text-neutral-400 mt-1 truncate" title={slicingStatusMessage}>
                            {Math.round(slicingProgress)}% - {slicingStatusMessage}
                        </p>
                    </div>
                )}
                {slicingStatus === 'complete' && slicingStats.time !== null && (
                    <div className="text-center text-green-500">
                        <p className="font-semibold">Slicing complete!</p>
                        <p className="text-sm text-neutral-400">{slicingStats.count} projections generated in {slicingStats.time.toFixed(1)}s.</p>
                    </div>
                )}
                {slicingStatus === 'failed' && (
                    <div className="text-center text-red-500">
                        <p className="font-semibold">Slicing Failed</p>
                        <p className="text-sm text-neutral-400">{slicingStatusMessage || "Check the console for details."}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- ProjectingTab and AdvancedTab (No changes) ---

const ProjectingTab: React.FC<{
    projectionParams: ProjectionParams;
    setProjectionParams: React.Dispatch<React.SetStateAction<ProjectionParams>>;
    handlePrint: () => void;
    stopPrint: () => void;
    handlePair: () => void;
    isPrinting: boolean;
    isConnected: boolean;
    isAdmin: boolean;
    setIsAdmin: (isAdmin: boolean) => void;
    printMode: PrintMode;
    setPrintMode: (mode: PrintMode) => void;
    timePerFrame: number;
    setTimePerFrame: (t: number) => void;
    hopsPerTrigger: number;
    setHopsPerTrigger: (h: number) => void;
    hopDelay: number;
    setHopDelay: (d: number) => void;

}> = ({ 
    projectionParams, setProjectionParams, handlePrint, stopPrint, handlePair, isPrinting, isConnected, isAdmin, setIsAdmin,
    printMode, setPrintMode, timePerFrame, setTimePerFrame, hopsPerTrigger, setHopsPerTrigger, hopDelay, setHopDelay
}) => {
    return (
        <div className="space-y-6 flex flex-col items-center p-6">
            <button onClick={handlePair} className={`w-full max-w-sm font-bold py-2 px-4 rounded-md transition ${isConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
                {isConnected ? 'Device Paired' : 'Pair Device'}
            </button>

            <div className="w-full max-w-sm space-y-4">
                {/* Print Mode Selector */}
                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Printing Mode</label>
                    <div className="flex bg-neutral-800 rounded-md p-1">
                        {(['velocity', 'time-per-frame', 'hops'] as PrintMode[]).map(mode => (
                            <button 
                                key={mode}
                                onClick={() => setPrintMode(mode)}
                                className={`w-1/3 py-1 text-sm rounded capitalize transition ${printMode === mode ? 'bg-purple-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'}`}
                            >
                                {mode.replace('-', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mode-specific Controls */}
                {printMode === 'velocity' && (
                    <SliderInput label="Rotation Speed" min={1} max={100} value={projectionParams.rotationSpeed} onChange={val => setProjectionParams(p => ({ ...p, rotationSpeed: val }))} unit="°/s" />
                )}
                {printMode === 'time-per-frame' && (
                    <SliderInput label="Time per Frame" min={16} max={1000} value={timePerFrame} onChange={setTimePerFrame} unit="ms" />
                )}
                {printMode === 'hops' && (
                    <>
                        <SliderInput label="Rotation Speed" min={1} max={100} value={projectionParams.rotationSpeed} onChange={val => setProjectionParams(p => ({ ...p, rotationSpeed: val }))} unit="°/s" />
                        <SliderInput label="Hops per Trigger" min={1} max={100} value={hopsPerTrigger} onChange={setHopsPerTrigger} />
                        <SliderInput label="Hop Delay" min={0} max={10} step={0.1} value={hopDelay} onChange={setHopDelay} unit="s" />
                    </>
                )}

                <SliderInput label="Total Rotation" min={90} max={360} value={projectionParams.totalRotation} onChange={val => setProjectionParams(p => ({ ...p, totalRotation: val }))} unit="°" />
                
                <div className="flex justify-between items-center text-sm text-neutral-300">
                    <label htmlFor="admin-mode">Admin Mode</label>
                    <input id="admin-mode" type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="form-checkbox h-4 w-4 text-purple-600 bg-neutral-700 border-neutral-600 rounded focus:ring-purple-500" />
                </div>
                
                {isAdmin && (
                    <>
                        <SliderInput label="Vertical Steps" min={0} max={1000} value={projectionParams.verticalSteps} onChange={val => setProjectionParams(p => ({ ...p, verticalSteps: val }))} />
                        <SliderInput label="Vertical Delay" min={100} max={10000} step={100} value={projectionParams.verticalDelay} onChange={val => setProjectionParams(p => ({ ...p, verticalDelay: val }))} unit="µs" />
                        <div className="flex justify-between items-center">
                            <label className="font-medium text-neutral-300">Vertical Direction</label>
                            <button onClick={() => setProjectionParams(p => ({ ...p, verticalDirection: p.verticalDirection === 1 ? 0 : 1 }))} className="px-4 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 transition">
                                {projectionParams.verticalDirection === 1 ? 'Up' : 'Down'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <button onClick={isPrinting ? stopPrint : handlePrint} disabled={!isConnected} className={`w-full max-w-sm font-bold py-2 px-4 rounded-md transition flex items-center justify-center ${isPrinting ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'} disabled:bg-neutral-500/50 disabled:cursor-not-allowed text-white`}>
                {isPrinting ? <StopIcon/> : <PrintIcon />}
                {isPrinting ? 'Stop' : 'Print'}
            </button>
        </div>
    );
};

const AdvancedTab: React.FC<{
    alignmentParams: AlignmentParams;
    setAlignmentParams: React.Dispatch<React.SetStateAction<AlignmentParams>>;
    openProjectionWindow: () => void;
    projectionWindowStatus: string;
}> = ({ alignmentParams, setAlignmentParams, openProjectionWindow, projectionWindowStatus }) => {
    const buttonText = (() => {
        switch (projectionWindowStatus) {
            case 'Connected': return 'Disconnect Screen';
            case 'Connecting...': return 'Connecting...';
            case 'Disconnected':
            case 'Terminated':
            default:
                if (projectionWindowStatus.startsWith('Error')) return 'Connection Error';
                return 'Use Second Monitor';
        }
    })();
    const isButtonDisabled = projectionWindowStatus === 'Connecting...';

    return (
        <div className="space-y-6 flex flex-col items-center p-6">
            <button onClick={openProjectionWindow} disabled={isButtonDisabled} className="w-full max-w-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold py-2 px-4 rounded-md transition disabled:bg-neutral-700/50 disabled:cursor-wait">
                {buttonText}
            </button>
            <p className="text-sm text-neutral-500 h-5">{projectionWindowStatus === 'Connected' ? 'Projection active' : projectionWindowStatus}</p>
            <div className="w-full max-w-sm space-y-4 pt-4">
                <SliderInput label="Image Scale" min={50} max={200} value={alignmentParams.scale} onChange={val => setAlignmentParams(p => ({ ...p, scale: val }))} unit="%" />
                <SliderInput label="Translate X" min={-100} max={100} value={alignmentParams.translateX} onChange={val => setAlignmentParams(p => ({ ...p, translateX: val }))} unit="px" />
                <SliderInput label="Translate Y" min={-100} max={100} value={alignmentParams.translateY} onChange={val => setAlignmentParams(p => ({ ...p, translateY: val }))} unit="px" />
                <SliderInput label="Contrast" min={50} max={250} value={alignmentParams.contrast} onChange={val => setAlignmentParams(p => ({ ...p, contrast: val }))} unit="%" />
            </div>
        </div>
    );
};

// --- ProjectionView (No changes) ---

const ProjectionView: React.FC = () => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [transform, setTransform] = useState('scale(1) translateX(0px) translateY(0px)');
    const [filter, setFilter] = useState('contrast(100%)');

    useEffect(() => {
        const setupConnection = (connection: PresentationConnection) => {
            connection.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'UPDATE_IMAGE') {
                        setImageUrl(data.imageUrl);
                    } else if (data.type === 'UPDATE_ALIGNMENT') {
                        const { scale, translateX, translateY, contrast } = data.params;
                        setTransform(`scale(${scale / 100}) translateX(${translateX}px) translateY(${translateY}px)`);
                        setFilter(`contrast(${contrast}%)`);
                    }
                } catch (e) {
                    console.error("Failed to parse message in projection window:", e);
                }
            };

            connection.onclose = () => {
                setImageUrl(null); // Clear image or show disconnected message
            };
        };

        if (navigator.presentation?.receiver) {
            navigator.presentation.receiver.connectionList.then(list => {
                list.connections.forEach(setupConnection);
                list.onconnectionavailable = (event: any) => { // PresentationConnectionAvailableEvent
                    setupConnection(event.connection);
                };
            });
        }
    }, []);


    return (
        <div className="bg-black w-screen h-screen flex items-center justify-center overflow-hidden">
            {imageUrl ? (
                <img src={imageUrl} alt="Projection" className="max-w-full max-h-full" style={{ transform, filter }} />
            ) : (
                <div className="text-white text-2xl">Waiting for connection...</div>
            )}
        </div>
    );
};


// --- MAIN APP COMPONENT ---

// BLE constants
const SERVICE_UUID = "1e8d1feb-8ee1-49c7-88f2-d2e8d5fc210d";
const WRITE_CHAR_UUID = "383beeb8-0543-4f0d-b71c-3de982151224";
const NOTIFY_CHAR_UUID = "5e4e1b96-5291-419a-af1b-d8034e2e1492";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Slicing);
  
  // State
  const [slicingParams, setSlicingParams] = useState<SlicingParams>({ voxelSize: 1, numProjections: 360, rotX: 0, rotY: 0, rotZ: 0 });
  const [projectionParams, setProjectionParams] = useState<ProjectionParams>({ totalRotation: 360, rotationSpeed: 30, pauseAfterRotation: 0, verticalSteps: 0, verticalDelay: 1000, verticalDirection: 1 });
  const [alignmentParams, setAlignmentParams] = useState<AlignmentParams>({ scale: 100, translateX: 0, translateY: 0, contrast: 100 });
  
  // File state
  const [fileName, setFileName] = useState<string | null>(null);
  const [stlFile, setStlFile] = useState<File | null>(null);
  const [projectionImages, setProjectionImages] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Slicing State
  const [slicingStatus, setSlicingStatus] = useState<SlicingStatus>('idle');
  const [slicingProgress, setSlicingProgress] = useState(0);
  const [slicingStats, setSlicingStats] = useState<SlicingStats>({ time: null, count: null });
  const [slicingStatusMessage, setSlicingStatusMessage] = useState(''); // <-- NEW
  const sliceStartTimeRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Printing State
  const [isPrinting, setIsPrinting] = useState(false);
  const [isWaitingForHopTrigger, setIsWaitingForHopTrigger] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('velocity');
  const [timePerFrame, setTimePerFrame] = useState(100); // ms
  const [hopsPerTrigger, setHopsPerTrigger] = useState(10);
  const [hopDelay, setHopDelay] = useState(0.5); // seconds

  // BLE State
  const [isConnected, setIsConnected] = useState(false);
  const [writeCharacteristic, setWriteCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  // Window Management State
  const presentationConnectionRef = useRef<PresentationConnection | null>(null);
  const [projectionWindowStatus, setProjectionWindowStatus] = useState('Disconnected');
  
  const printProcessRef = useRef<{ currentFrame: number; intervalId: number | null }>({ currentFrame: 0, intervalId: null });

  // useEffect for cleaning up EventSource connection
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Slicing Logic with Detailed Progress
  const handleSlice = useCallback(async () => {
    if (!stlFile) {
        alert("Please upload an STL file first.");
        return;
    }
    
    // 1. Reset state for a new slicing job
    setSlicingStatus('slicing');
    setSlicingProgress(0);
    setSlicingStatusMessage('Preparing to slice...');
    setSlicingStats({ time: null, count: null });
    setProjectionImages([]);
    sliceStartTimeRef.current = performance.now();

    // Close any existing connection from a previous job
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
    }

    const formData = new FormData();
    formData.append('stl_file', stlFile);
    formData.append('pitch', slicingParams.voxelSize.toString());
    formData.append('num_angles', slicingParams.numProjections.toString());
    formData.append('rot_x', slicingParams.rotX.toString());
    formData.append('rot_y', slicingParams.rotY.toString());
    formData.append('rot_z', slicingParams.rotZ.toString());
    
    try {
        // 2. Start the job and get a job ID
        const startResponse = await fetch('http://127.0.0.1:5000/api/slice/start', {
            method: 'POST',
            body: formData,
        });

        if (!startResponse.ok) {
            const errorText = await startResponse.text();
            throw new Error(`Failed to start slicing job: ${errorText}`);
        }

        const { job_id } = await startResponse.json();
        if (!job_id) throw new Error("Did not receive a job_id from the server.");

        // 3. Connect to the progress stream using EventSource
        setSlicingStatusMessage('Connecting to progress stream...');
        const eventSource = new EventSource(`http://127.0.0.1:5000/api/slice/progress/${job_id}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            setSlicingProgress(data.progress || 0);
            setSlicingStatusMessage(data.status || ''); // <-- Update status message from backend

            if (data.status === 'complete') {
                const endTime = performance.now();
                const duration = (endTime - (sliceStartTimeRef.current || endTime)) / 1000;
                
                const imagesWithPrefix = data.images.map((base64: string) => `data:image/png;base64,${base64}`);
                setProjectionImages(imagesWithPrefix);
                
                setSlicingStatus('complete');
                setSlicingStats({ time: duration, count: imagesWithPrefix.length });

                eventSource.close();
                eventSourceRef.current = null;
            } else if (data.status === 'failed') {
                console.error("Slicing failed on backend:", data.error);
                setSlicingStatus('failed');
                setSlicingStatusMessage(data.error || 'An unknown error occurred.');
                eventSource.close();
                eventSourceRef.current = null;
            }
        };

        eventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            setSlicingStatus('failed');
            setSlicingStatusMessage('Connection to server lost.');
            eventSource.close();
            eventSourceRef.current = null;
        };

    } catch (error) {
        console.error("Slicing failed:", error);
        setSlicingStatus('failed');
        setSlicingStatusMessage((error as Error).message);
    }
  }, [stlFile, slicingParams]);


  // --- Printing and other logic (no changes) ---
  const stopPrint = useCallback(() => {
    if (printProcessRef.current.intervalId) {
        clearInterval(printProcessRef.current.intervalId);
        printProcessRef.current.intervalId = null;
    }
    setIsPrinting(false);
    setIsWaitingForHopTrigger(false);
    if (writeCharacteristic) {
        const stopCommand = new Float32Array(6).fill(0);
        writeCharacteristic.writeValue(stopCommand.buffer).catch(err => console.error("Error sending stop command:", err));
    }
  }, [writeCharacteristic]);

  const handleESP32Notification = useCallback(() => {
    if (printMode === 'hops' && isPrinting && isWaitingForHopTrigger) {
        setIsWaitingForHopTrigger(false);
    }
  }, [printMode, isPrinting, isWaitingForHopTrigger]);

  const handlePair = useCallback(async () => {
    try {
      if (!navigator.bluetooth) throw new Error("Web Bluetooth API is not available in this browser.");
      const device = await navigator.bluetooth.requestDevice({
          filters: [{ name: "phoneVam" }],
          optionalServices: [SERVICE_UUID],
      });
      if (!device.gatt) throw new Error("GATT server not found on device.");

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setWriteCharacteristic(null);
        stopPrint();
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const writeChar = await service.getCharacteristic(WRITE_CHAR_UUID);
      const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID);
      
      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', handleESP32Notification);
      
      setWriteCharacteristic(writeChar);
      setIsConnected(true);
    } catch (error) {
      console.error("BLE Connection Error:", error);
      alert((error as Error).message);
    }
  }, [handleESP32Notification, stopPrint]);

  const openProjectionWindow = useCallback(() => {
    if (presentationConnectionRef.current?.state === 'connected') {
        presentationConnectionRef.current.terminate();
        return;
    }

    const request = new PresentationRequest([`/#/projection`]);
    setProjectionWindowStatus('Connecting...');

    const setupConnection = (connection: PresentationConnection) => {
        presentationConnectionRef.current = connection;
        setProjectionWindowStatus('Connected');
        
        const closeHandler = () => {
            setProjectionWindowStatus('Disconnected');
            if (presentationConnectionRef.current === connection) {
                presentationConnectionRef.current = null;
            }
            stopPrint();
        };
        connection.onclose = closeHandler;
        connection.onterminate = closeHandler;
    };
    
    request.onconnectionavailable = (event: any) => {
        setupConnection(event.connection);
    };

    request.start().catch(error => {
        if (error.name !== 'NotAllowedError') {
             setProjectionWindowStatus(`Error: ${error.message}`);
             console.error('Presentation API start failed:', error);
        } else {
             setProjectionWindowStatus('Disconnected');
        }
    });
  }, [stopPrint]);
  
  useEffect(() => {
    if (presentationConnectionRef.current?.state === 'connected') {
        presentationConnectionRef.current.send(JSON.stringify({ type: 'UPDATE_ALIGNMENT', params: alignmentParams }));
    }
  }, [alignmentParams]);

  const sendNextHopCommand = useCallback(async () => { /* ... no changes ... */ }, []);
  useEffect(() => { /* ... no changes ... */ }, []);
  const handlePrint = useCallback(async () => { /* ... no changes ... */ }, []);

  // --- Rendering Logic ---
  
  const TabButton: React.FC<{ tab: Tab }> = ({ tab }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-6 py-3 text-lg font-semibold transition border-b-4 
        ${activeTab === tab 
          ? 'text-neutral-100 border-purple-500' 
          : 'text-neutral-400 border-transparent hover:text-neutral-200 hover:border-neutral-700'}`}
    >
      {tab}
    </button>
  );

  const renderTabContent = () => {
    switch(activeTab) {
      case Tab.Slicing:
        return <SlicingTab 
            slicingParams={slicingParams} setSlicingParams={setSlicingParams} handleSlice={handleSlice}
            slicingStatus={slicingStatus} slicingProgress={slicingProgress} slicingStats={slicingStats}
            slicingStatusMessage={slicingStatusMessage} // <-- Pass new prop
            fileName={fileName} setFileName={setFileName} setStlFile={setStlFile}
        />;
      case Tab.Projecting:
        return <ProjectingTab 
            projectionParams={projectionParams} setProjectionParams={setProjectionParams} handlePrint={handlePrint}
            stopPrint={stopPrint} handlePair={handlePair} isPrinting={isPrinting} isConnected={isConnected} isAdmin={isAdmin} setIsAdmin={setIsAdmin}
            printMode={printMode} setPrintMode={setPrintMode} timePerFrame={timePerFrame} setTimePerFrame={setTimePerFrame}
            hopsPerTrigger={hopsPerTrigger} setHopsPerTrigger={setHopsPerTrigger} hopDelay={hopDelay} setHopDelay={setHopDelay}
        />;
      case Tab.Advanced:
        return <AdvancedTab 
            alignmentParams={alignmentParams} setAlignmentParams={setAlignmentParams}
            openProjectionWindow={openProjectionWindow} projectionWindowStatus={projectionWindowStatus}
        />;
      default: return null;
    }
  }

  const renderPreviewContent = () => {
    if (activeTab === Tab.Slicing) {
        if (!stlFile) {
            return (
                <div className="text-center text-neutral-500 p-8">
                    <h3 className="text-xl font-semibold mb-2">3D Preview</h3>
                    <p>Upload an STL file using the button on the left to see an interactive preview.</p>
                </div>
            )
        }
        return <STLViewer key={stlFile.name} file={stlFile} rotation={{ x: slicingParams.rotX, y: slicingParams.rotY, z: slicingParams.rotZ }} />;
    }
    
    if (projectionImages.length > 0) {
        return <SlicePreview 
            images={projectionImages} alignmentParams={alignmentParams} projectionParams={projectionParams} setAlignmentParams={setAlignmentParams} 
        />
    }

    return (
        <div className="text-center text-neutral-500 p-8">
            <h3 className="text-xl font-semibold mb-2">Slice Preview</h3>
            <p>Slice a model on the 'Slicing' tab to generate and view the projection preview here.</p>
        </div>
    );
  };

  return (
    <HashRouter>
        <Routes>
            <Route path="/projection" element={<ProjectionView />} />
            <Route path="/" element={
                 <div className="h-screen bg-gradient-to-br from-neutral-900 to-black text-white flex flex-col sm:flex-row items-stretch overflow-hidden">
                    <div className="w-full sm:w-1/2 md:w-5/12 lg:w-4/12 bg-neutral-900 shadow-2xl flex flex-col">
                        <header className="text-center py-6 border-b border-neutral-800 flex-shrink-0">
                            <h1 className="text-3xl font-bold tracking-wider">VAM Controller</h1>
                        </header>
                        <nav className="flex justify-center bg-neutral-900 border-b border-neutral-800 flex-shrink-0">
                            <TabButton tab={Tab.Slicing} />
                            <TabButton tab={Tab.Projecting} />
                            <TabButton tab={Tab.Advanced} />
                        </nav>
                        <main className="flex-grow overflow-y-auto">
                            {renderTabContent()}
                        </main>
                    </div>
                    <div className="w-full sm:w-1/2 md:w-7/12 lg:w-8/12 flex items-center justify-center relative">
                        {renderPreviewContent()}
                    </div>
                </div>
            } />
        </Routes>
    </HashRouter>
  );
}

export default App;
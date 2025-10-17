import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Tab, SlicingParams, ProjectionParams, AlignmentParams, PrintMode, PresentationConnection, SlicingStatus, SlicingStats, SlicingProgressDetails } from './types';
import type { BluetoothRemoteGATTCharacteristic } from './types';
import SliderInput from './components/SliderInput';
import STLViewer from './components/STLViewer';
import SlicePreview from './components/SlicePreview';
import { io, Socket } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';


// --- ICONS  ---
const UploadIcon = () => (
    <svg xmlns="http://www.w.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
);

const PrintIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M5 4a2 2 0 012-2h6a2 2 0 012 2v1H5V4zM5 8h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2zm2 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
);
const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.118v3.764a1 1 0 001.555.832l3.197-1.882a1 1 0 000-1.664l-3.197-1.882z" clipRule="evenodd" />
    </svg>
);

const CalibrationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
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
    slicingStatusMessage: string;
    slicingProgressDetails: SlicingProgressDetails | null;
    fileName: string | null;
    setFileName: (name: string | null) => void;
    setStlFile: (file: File | null) => void;
    handleExportJob: () => void;
    handleImportJob: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ slicingParams, setSlicingParams, handleSlice, slicingStatus, slicingProgress, slicingStats, slicingStatusMessage, slicingProgressDetails, fileName, setFileName, setStlFile, handleExportJob, handleImportJob }) => {

    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const processFile = (file: File) => {
        if (file && file.name.toLowerCase().endsWith('.stl')) {
            setFileName(file.name);
            setStlFile(file);
        } else {
            toast.error("Please select a valid .stl file.");
            setFileName(null);
            setStlFile(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
             if (fileInputRef.current) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInputRef.current.files = dataTransfer.files;
            }
        }
    };


    const isSlicing = slicingStatus === 'slicing';

    return (
        <div className="space-y-6 flex flex-col items-center p-6">
            <label
                htmlFor="stl-upload"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`w-full max-w-sm cursor-pointer border-2 border-dashed  text-neutral-200 font-bold py-4 px-4 rounded-md inline-flex flex-col items-center justify-center transition-all duration-300
                ${isDragging ? 'border-red-400 bg-neutral-800/50' : 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700 hover:border-neutral-600'}`}>
                <UploadIcon />
                <span className="mt-2 text-center">{isDragging ? 'Drop STL file here' : 'Click or Drag & Drop STL File'}</span>
                <input ref={fileInputRef} id="stl-upload" type="file" className="hidden" accept=".stl" onChange={handleFileChange} />
            </label>
            <p className="text-sm text-neutral-500 h-5">{fileName || "No File Selected"}</p>

            <div className="w-full max-w-sm grid grid-cols-2 gap-4">
                 <button onClick={() => importInputRef.current?.click()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 text-sm rounded-md transition">
                    Import Job
                </button>
                <input type="file" ref={importInputRef} className="hidden" accept=".zip" onChange={handleImportJob} />

                <button onClick={handleExportJob} disabled={slicingStatus !== 'complete'} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-neutral-500/50 disabled:cursor-not-allowed text-white font-bold py-1 px-3 text-sm rounded-md transition">
                    Export Job
                </button>
            </div>

            <div className="w-full max-w-sm space-y-4">
                <SliderInput label="Voxel Size" min={0.05} max={2.0} step={0.1} value={slicingParams.voxelSize} onChange={val => setSlicingParams(p => ({ ...p, voxelSize: val }))} />
                <SliderInput label="Number of Projections" min={30} max={360} step={30} value={slicingParams.numProjections} onChange={val => setSlicingParams(p => ({ ...p, numProjections: val }))} />
                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Initial Rotation</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['X', 'Y', 'Z'].map(axis => (
                            <div key={axis}>
                                <label htmlFor={`rot-${axis}`} className="block text-xs text-neutral-400">{axis}</label>
                                <input type="number" id={`rot-${axis}`} value={slicingParams[`rot${axis}` as 'rotX' | 'rotY' | 'rotZ']} onChange={e => setSlicingParams(p => ({ ...p, [`rot${axis}`]: parseInt(e.target.value) || 0 }))} className="w-full bg-neutral-800 text-neutral-100 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-400" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={handleSlice} disabled={!fileName || isSlicing} className="w-full max-w-sm bg-red-400 hover:bg-red-600 disabled:bg-red-400/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition flex items-center justify-center">
                {isSlicing && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                {isSlicing ? 'Slicing...' : 'Slice'}
            </button>

            <div className="w-full max-w-sm h-12 mt-2">
                {isSlicing && slicingProgressDetails && (
                    <div className="w-full">
                        <div className="w-full bg-neutral-700 rounded-full h-2.5">
                            <div className="bg-red-400 h-2.5 rounded-full" style={{ width: `${slicingProgress}%`, transition: 'width 0.2s ease-in-out' }}></div>
                        </div>
                         <div className="flex justify-between items-center text-sm text-neutral-400 mt-1">
                            <span className="truncate capitalize" title={slicingProgressDetails.status}>
                                {Math.round(slicingProgress)}% - {slicingProgressDetails.stage.toLowerCase()}
                            </span>
                            <div className="flex-shrink-0">
                                {slicingProgressDetails.details?.current_step && slicingProgressDetails.details?.total_steps && (
                                    <span className="font-mono text-xs">{slicingProgressDetails.details.current_step} / {slicingProgressDetails.details.total_steps}</span>
                                )}
                                {slicingProgressDetails.details?.eta && (
                                    <span className="ml-2 font-mono text-xs">{slicingProgressDetails.details.eta}</span>
                                )}
                            </div>
                        </div>
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

// --- ProjectingTab COMPONENT ---
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
    handleTestPrint: () => void;
    isTestPrinting: boolean;
    hasSlices: boolean;
    isProjectionWindowConnected: boolean;
    isSimulationMode: boolean;
    setIsSimulationMode: (isSim: boolean) => void;
}> = ({
    projectionParams, setProjectionParams, handlePrint, stopPrint, handlePair, isPrinting, isConnected, isAdmin, setIsAdmin,
    printMode, setPrintMode, timePerFrame, setTimePerFrame, hopsPerTrigger, setHopsPerTrigger, hopDelay, setHopDelay,
    handleTestPrint, isTestPrinting, hasSlices, isProjectionWindowConnected, isSimulationMode, setIsSimulationMode
}) => {
    return (
        <div className="space-y-6 flex flex-col items-center p-6">
            <button
                onClick={handlePair}
                disabled={isSimulationMode}
                className={`w-full max-w-sm font-bold py-2 px-4 rounded-md transition ${isConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-800 hover:bg-neutral-700'} disabled:bg-neutral-700/50 disabled:cursor-not-allowed`}
            >
                {isConnected ? 'Device Paired' : 'Pair Device'}
            </button>

            <button
                onClick={handleTestPrint}
                disabled={!isProjectionWindowConnected || !hasSlices || isPrinting}
                className={`w-full max-w-sm font-bold py-2 px-4 rounded-md transition flex items-center justify-center
                    ${isTestPrinting ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}
                    disabled:bg-neutral-500/50 disabled:cursor-not-allowed text-white`}
            >
                {isTestPrinting ? <StopIcon /> : <PlayIcon />}
                {isTestPrinting ? 'Stopping Simulation...' : 'Simulate Print'}
            </button>


            <div className="w-full max-w-sm space-y-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Printing Mode</label>
                    <div className="flex bg-neutral-800 rounded-md p-1">
                        {(['velocity', 'time-per-frame', 'hops'] as PrintMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setPrintMode(mode)}
                                className={`w-1/3 py-1 text-sm rounded capitalize transition ${printMode === mode ? 'bg-red-400 text-white' : 'hover:bg-neutral-700 text-neutral-300'}`}
                            >
                                {mode.replace('-', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

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
                    <label htmlFor="sim-mode">Simulation Mode</label>
                    <input id="sim-mode" type="checkbox" checked={isSimulationMode} onChange={(e) => setIsSimulationMode(e.target.checked)} className="form-checkbox h-4 w-4 text-red-400 bg-neutral-700 border-neutral-600 rounded focus:ring-red-400" />
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-300">
                    <label htmlFor="admin-mode">Admin Mode</label>
                    <input id="admin-mode" type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="form-checkbox h-4 w-4 text-red-400 bg-neutral-700 border-neutral-600 rounded focus:ring-red-400" />
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

            <button onClick={isPrinting ? stopPrint : handlePrint} disabled={(!isConnected && !isSimulationMode) || isTestPrinting || !hasSlices} className={`w-full max-w-sm font-bold py-2 px-4 rounded-md transition flex items-center justify-center gap-x-2  ${isPrinting ? 'bg-red-600 hover:bg-red-700' : 'bg-red-400 hover:bg-red-600'} disabled:bg-neutral-500/50 disabled:cursor-not-allowed text-white`}>
                {isPrinting ? <StopIcon/> : <PrintIcon />}
                {isPrinting ? 'Stop' : 'Print'}
            </button>
        </div>
    );
};

// --- AdvancedTab COMPONENT ---
const AdvancedTab: React.FC<{
    alignmentParams: AlignmentParams;
    setAlignmentParams: React.Dispatch<React.SetStateAction<AlignmentParams>>;
    openProjectionWindow: () => void;
    projectionWindowStatus: string;
    handleCalibration: () => void;
    isCalibrating: boolean;
    handleSaveOffset: () => void;
    handleResetOffset: () => void;
}> = ({ alignmentParams, setAlignmentParams, openProjectionWindow, projectionWindowStatus, handleCalibration, isCalibrating, handleSaveOffset, handleResetOffset }) => {
    const isProjectionWindowConnected = projectionWindowStatus === 'Connected';
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
            <button
                onClick={handleCalibration}
                disabled={!isProjectionWindowConnected}
                className={`w-full max-w-sm font-bold py-2 px-4 rounded-md transition flex items-center justify-center
                    ${isCalibrating ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'}
                    disabled:bg-neutral-500/50 disabled:cursor-not-allowed text-white`}
            >
                <CalibrationIcon />
                {isCalibrating ? 'Stop Calibration' : 'Calibrate'}
            </button>

            {isCalibrating && (
                <div className="w-full max-w-sm grid grid-cols-2 gap-4 mt-4">
                    <button
                        onClick={handleSaveOffset}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition"
                    >
                        Save Offset
                    </button>
                    <button
                        onClick={handleResetOffset}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md transition"
                    >
                        Reset Offset
                    </button>
                </div>
            )}

            <div className="w-full max-w-sm space-y-4 pt-4">
                <SliderInput label="Image Scale" min={50} max={200} value={alignmentParams.scale} onChange={val => setAlignmentParams(p => ({ ...p, scale: val }))} unit="%" />
                <SliderInput label="Translate X" min={-100} max={100} value={alignmentParams.translateX} onChange={val => setAlignmentParams(p => ({ ...p, translateX: val }))} unit="px" />
                <SliderInput label="Translate Y" min={-100} max={100} value={alignmentParams.translateY} onChange={val => setAlignmentParams(p => ({ ...p, translateY: val }))} unit="px" />
                <SliderInput label="Contrast" min={10} max={250} value={alignmentParams.contrast} onChange={val => setAlignmentParams(p => ({ ...p, contrast: val }))} unit="%" />
            </div>
        </div>
    );
};


// --- ProjectionView  ---
const ProjectionView: React.FC = () => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [transform, setTransform] = useState('scale(1) translateX(0px) translateY(0px)');
    const [filter, setFilter] = useState('contrast(100%)');
    const [showCalibration, setShowCalibration] = useState(false);

    useEffect(() => {
        const setupConnection = (connection: PresentationConnection) => {
            connection.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'UPDATE_IMAGE') {
                        setShowCalibration(false);
                        setImageUrl(data.imageUrl);
                    } else if (data.type === 'CLEAR_IMAGE') {
                        setShowCalibration(false);
                        setImageUrl(null);
                    } else if (data.type === 'TOGGLE_CALIBRATION') {
                        setShowCalibration(data.show);
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
                setImageUrl(null);
                setShowCalibration(false);
            };
        };

        if (navigator.presentation?.receiver) {
            navigator.presentation.receiver.connectionList.then(list => {
                list.connections.forEach(setupConnection);
                list.onconnectionavailable = (event: any) => {
                    setupConnection(event.connection);
                };
            });
        }
    }, []);


    return (
        <div className="bg-black w-screen h-screen flex items-center justify-center overflow-hidden relative">
            {showCalibration && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ transform }}>
                    <div className="relative" style={{ width: '80vmin', height: '80vmin' }}>
                        <div className="absolute top-0 left-1/2 bg-white w-1 h-full -translate-x-1/2"></div>
                        <div className="absolute top-0 left-0 bg-white h-1 w-full"></div>
                    </div>
                </div>
            )}
            {!showCalibration && imageUrl ? (
                <img src={imageUrl} alt="Projection" style={{ height: '100vh', transform, filter }} />
            ) : !showCalibration && (
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
  const [slicingParams, setSlicingParams] = useState<SlicingParams>({ voxelSize: 1, numProjections: 120, rotX: 0, rotY: 0, rotZ: 0 });
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
  const [slicingStatusMessage, setSlicingStatusMessage] = useState('');
  const [slicingProgressDetails, setSlicingProgressDetails] = useState<SlicingProgressDetails | null>(null);
  const sliceStartTimeRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Printing State
  const [isPrinting, setIsPrinting] = useState(false);
  const [isWaitingForHopTrigger, setIsWaitingForHopTrigger] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('velocity');
  const [timePerFrame, setTimePerFrame] = useState(100); // ms
  const [hopsPerTrigger, setHopsPerTrigger] = useState(10);
  const [hopDelay, setHopDelay] = useState(0.5); // seconds
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);

  // BLE State
  const [isConnected, setIsConnected] = useState(false);
  const [writeCharacteristic, setWriteCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  // Window Management State
  const presentationConnectionRef = useRef<PresentationConnection | null>(null);
  const [projectionWindowStatus, setProjectionWindowStatus] = useState('Disconnected');

  const printProcessRef = useRef<{ currentFrame: number; intervalId: number | null; timeoutId?: number | null }>({ currentFrame: 0, intervalId: null, timeoutId: null });
  const testPrintIntervalRef = useRef<number | null>(null);


  const CALIBRATION_OFFSET_KEY = 'vam-calibration-offset';


  useEffect(() => {
    try {
        const savedOffsetJSON = localStorage.getItem(CALIBRATION_OFFSET_KEY);
        if (savedOffsetJSON) {
            const savedOffset = JSON.parse(savedOffsetJSON);
            if (typeof savedOffset.x === 'number' && typeof savedOffset.y === 'number') {
                setAlignmentParams(prevParams => ({
                    ...prevParams,
                    translateX: savedOffset.x,
                    translateY: savedOffset.y,
                }));
                console.log('Loaded calibration offset:', savedOffset);
            }
        }
    } catch (error) {
        console.error("Failed to load or parse calibration offset from localStorage:", error);
    }
  }, []);

  // Keyboard controls for calibration
  useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCalibrating) return;

            e.preventDefault();

            const step = e.shiftKey ? 10 : (e.ctrlKey || e.metaKey ? 0.1 : 1);

            setAlignmentParams(prev => {
                switch (e.key) {
                    case 'ArrowUp':
                        return { ...prev, translateY: prev.translateY - step };
                    case 'ArrowDown':
                        return { ...prev, translateY: prev.translateY + step };
                    case 'ArrowLeft':
                        return { ...prev, translateX: prev.translateX - step };
                    case 'ArrowRight':
                        return { ...prev, translateX: prev.translateX + step };
                    default:
                        return prev;
                }
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCalibrating]);


  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (testPrintIntervalRef.current) {
        clearInterval(testPrintIntervalRef.current);
      }
    };
  }, []);

  const handleSlice = useCallback(async () => {
    if (!stlFile) {
        toast.error("Please upload an STL file first.");
        return;
    }

    setSlicingStatus('slicing');
    setSlicingProgress(0);
    setSlicingStatusMessage('');
    setSlicingProgressDetails({ stage: 'IDLE', status: 'Initializing...' });
    setSlicingStats({ time: null, count: null });
    setProjectionImages([]);
    sliceStartTimeRef.current = performance.now();

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

        setSlicingProgressDetails({ stage: 'CONNECTING', status: 'Connecting to progress stream...' });
        const eventSource = new EventSource(`http://127.0.0.1:5000/api/slice/progress/${job_id}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            setSlicingProgress(data.progress || 0);
            setSlicingProgressDetails(data);


            if (data.status === 'complete') {
                const endTime = performance.now();
                const duration = (endTime - (sliceStartTimeRef.current || endTime)) / 1000;

                const imagesWithPrefix = data.images.map((base64: string) => `data:image/png;base64,${base64}`);
                setProjectionImages(imagesWithPrefix);

                setSlicingStatus('complete');
                setSlicingStats({ time: duration, count: imagesWithPrefix.length });
                setSlicingProgressDetails(null);
                toast.success("Slicing completed successfully!");

                eventSource.close();
                eventSourceRef.current = null;
            } else if (data.status === 'failed') {
                console.error("Slicing failed on backend:", data.error);
                setSlicingStatus('failed');
                setSlicingStatusMessage(data.error || 'An unknown error occurred.');
                setSlicingProgressDetails(null);
                toast.error(`Slicing failed: ${data.error || 'Unknown reason'}`);
                eventSource.close();
                eventSourceRef.current = null;
            }
        };

        eventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            setSlicingStatus('failed');
            setSlicingStatusMessage('Connection to server lost.');
            setSlicingProgressDetails(null);
            toast.error("Connection to slicing server lost.");
            eventSource.close();
            eventSourceRef.current = null;
        };

    } catch (error) {
        console.error("Slicing failed:", error);
        setSlicingStatus('failed');
        const errorMessage = (error as Error).message;
        setSlicingStatusMessage(errorMessage);
        setSlicingProgressDetails(null);
        toast.error(`Slicing failed: ${errorMessage}`);
    }
  }, [stlFile, slicingParams]);


  const stopTestPrint = useCallback(() => {
    if (testPrintIntervalRef.current) {
        clearInterval(testPrintIntervalRef.current);
        testPrintIntervalRef.current = null;
    }
    if (presentationConnectionRef.current?.state === 'connected') {
        presentationConnectionRef.current.send(JSON.stringify({ type: 'CLEAR_IMAGE' }));
    }
    setIsTestPrinting(false);
  }, []);

  const handleTestPrint = useCallback(() => {
    if (isTestPrinting) {
      stopTestPrint();
      return;
    }

    if (projectionImages.length === 0) {
      toast.error("Please slice a model first to generate images.");
      return;
    }
    if (presentationConnectionRef.current?.state !== 'connected') {
      toast.error("Please connect to the second monitor from the 'Advanced' tab first.");
      return;
    }
    if (isCalibrating) {
        setIsCalibrating(false);
    }

    setIsTestPrinting(true);
    let currentFrame = 0;
    const frameDuration = printMode === 'time-per-frame' ? timePerFrame : 33;

    testPrintIntervalRef.current = window.setInterval(() => {
      if (presentationConnectionRef.current?.state === 'connected') {
        const imageUrl = projectionImages[currentFrame];
        presentationConnectionRef.current.send(JSON.stringify({ type: 'UPDATE_IMAGE', imageUrl }));
        currentFrame = (currentFrame + 1) % projectionImages.length;
      } else {
        stopTestPrint();
      }
    }, frameDuration);
  }, [isTestPrinting, projectionImages, timePerFrame, printMode, stopTestPrint, isCalibrating]);


  const handleCalibration = useCallback(() => {
    if (presentationConnectionRef.current?.state !== 'connected') {
        toast.error("Please connect to the second monitor first.");
        return;
    }
    if (isTestPrinting) {
        stopTestPrint();
    }

    const newCalibrationState = !isCalibrating;
    setIsCalibrating(newCalibrationState);
    presentationConnectionRef.current.send(JSON.stringify({ type: 'TOGGLE_CALIBRATION', show: newCalibrationState }));

  }, [isCalibrating, isTestPrinting, stopTestPrint]);


  const handleSaveOffset = useCallback(() => {
    try {
        const offset = {
            x: alignmentParams.translateX,
            y: alignmentParams.translateY,
        };
        localStorage.setItem(CALIBRATION_OFFSET_KEY, JSON.stringify(offset));
        toast.success(`Offset saved: X=${offset.x}, Y=${offset.y}`);
    } catch (error) {
        console.error("Failed to save calibration offset to localStorage:", error);
        toast.error("Could not save the offset.");
    }
  }, [alignmentParams.translateX, alignmentParams.translateY]);

  const handleResetOffset = useCallback(() => {
    try {
        localStorage.removeItem(CALIBRATION_OFFSET_KEY);
        setAlignmentParams(prevParams => ({
            ...prevParams,
            translateX: 0,
            translateY: 0,
        }));
        toast.success("Offset has been reset.");
    } catch (error) {
        console.error("Failed to remove calibration offset from localStorage:", error);
        toast.error("Could not reset the offset.");
    }
  }, []);

 const stopPrint = useCallback(() => {
        if (printProcessRef.current.intervalId) {
            clearInterval(printProcessRef.current.intervalId);
            printProcessRef.current.intervalId = null;
        }
        if (printProcessRef.current.timeoutId) {
            clearTimeout(printProcessRef.current.timeoutId);
            printProcessRef.current.timeoutId = null;
        }
        setIsPrinting(false);
        setIsWaitingForHopTrigger(false);
        if (writeCharacteristic && !isSimulationMode) {
            const stopCommand = new Float32Array(6).fill(0);
            writeCharacteristic.writeValue(stopCommand.buffer).catch(err => {
                console.error("Error sending stop command:", err);
                toast.error("Failed to send stop command.");
            });
        }
        if (presentationConnectionRef.current) {
            presentationConnectionRef.current.send(JSON.stringify({ type: 'CLEAR_IMAGE' }));
        }
    }, [writeCharacteristic, isSimulationMode]);


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
        toast("Bluetooth device disconnected.", { icon: 'ℹ️' });
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
      toast.success("Bluetooth device connected!");
    } catch (error) {
      console.error("BLE Connection Error:", error);
      toast.error((error as Error).message);
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
        toast.success("Projection window connected.");

        const closeHandler = () => {
            setProjectionWindowStatus('Disconnected');
            if (presentationConnectionRef.current === connection) {
                presentationConnectionRef.current = null;
            }
            stopPrint();
            stopTestPrint();
            setIsCalibrating(false);
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
             toast.error("Failed to open projection window.");
        } else {
             setProjectionWindowStatus('Disconnected');
        }
    });
  }, [stopPrint, stopTestPrint]);

  useEffect(() => {
    if (presentationConnectionRef.current?.state === 'connected') {
        presentationConnectionRef.current.send(JSON.stringify({ type: 'UPDATE_ALIGNMENT', params: alignmentParams }));
    }
  }, [alignmentParams]);

  const sendNextHopCommand = useCallback(async () => { /* ... no changes ... */ }, []);
  useEffect(() => { /* ... no changes ... */ }, []);

  const handlePrint = useCallback(async () => {
    if (isPrinting) {
        stopPrint();
        return;
    }

    if (isSimulationMode) {
         if (presentationConnectionRef.current?.state !== 'connected') {
            toast.error("Connect to second monitor for simulation.");
            return;
        }
        setIsPrinting(true);
        printProcessRef.current.currentFrame = 0;
        const totalFrames = projectionImages.length;

        const runSimulationStep = () => {
             if (printProcessRef.current.currentFrame >= totalFrames) {
                stopPrint();
                return;
            }

            const imageUrl = projectionImages[printProcessRef.current.currentFrame];
            presentationConnectionRef.current?.send(JSON.stringify({ type: 'UPDATE_IMAGE', imageUrl }));
            printProcessRef.current.currentFrame++;

            let delay = 100; // default
            if (printMode === 'time-per-frame') {
                delay = timePerFrame;
            } else if (printMode === 'velocity') {
                 const degreesPerFrame = projectionParams.totalRotation / totalFrames;
                 delay = (degreesPerFrame / projectionParams.rotationSpeed) * 1000;
            }
             // For 'hops' mode, we simulate based on rotationSpeed as there's no trigger
            else if (printMode === 'hops') {
                 const degreesPerFrame = projectionParams.totalRotation / totalFrames;
                 delay = (degreesPerFrame / projectionParams.rotationSpeed) * 1000;
            }

            printProcessRef.current.timeoutId = window.setTimeout(runSimulationStep, delay);
        };
        runSimulationStep();
        return;
    }

    // --- Regular BLE Print Logic ---
    if (!writeCharacteristic) {
        toast.error("BLE device is not connected.");
        return;
    }

    setIsPrinting(true);

    const degreesPerStep = 0.1125;
    const tomographicDelayMs = projectionParams.rotationSpeed > 0
        ? (degreesPerStep / projectionParams.rotationSpeed) * 1000
        : 0;
    const pauseInSeconds = (projectionParams.pauseAfterRotation || 0) / 1000;

    const command = new Float32Array(6);
    command[0] = projectionParams.totalRotation;
    command[1] = tomographicDelayMs;
    command[2] = pauseInSeconds;
    command[3] = projectionParams.verticalSteps;
    command[4] = projectionParams.verticalDelay;
    command[5] = projectionParams.verticalDirection;

    try {
        await writeCharacteristic.writeValue(command.buffer);
        console.log("Print command sent successfully.");
    } catch (error) {
        console.error("Error sending print command:", error);
        toast.error(`Failed to send command: ${(error as Error).message}`);
        setIsPrinting(false);
    }
}, [writeCharacteristic, isPrinting, stopPrint, projectionParams, isSimulationMode, projectionImages, printMode, timePerFrame]);

const handleExportJob = useCallback(async () => {
        if (slicingStatus !== 'complete' || projectionImages.length === 0) {
            toast.error("Please slice a model successfully before exporting.");
            return;
        }

        const toastId = toast.loading("Generating job file...");

        try {
            const zip = new JSZip();

            // 1. Add settings
            const settings = {
                slicingParams,
                projectionParams,
                alignmentParams,
            };
            zip.file("settings.json", JSON.stringify(settings, null, 2));

            // 2. Add images
            const projectionsFolder = zip.folder("projections");
            if (!projectionsFolder) throw new Error("Could not create zip folder.");

            for (let i = 0; i < projectionImages.length; i++) {
                const base64Data = projectionImages[i].split(',')[1];
                const fileName = `slice_${String(i).padStart(4, '0')}.png`;
                projectionsFolder.file(fileName, base64Data, { base64: true });
            }

            // 3. Generate and download
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipFileName = (fileName || 'model').replace(/\.stl$/i, '') + '.zip';
            saveAs(zipBlob, zipFileName);

            toast.success("Job exported successfully!", { id: toastId });
        } catch (error) {
            console.error("Failed to export job:", error);
            toast.error("Failed to export job.", { id: toastId });
        }
    }, [slicingStatus, projectionImages, slicingParams, projectionParams, alignmentParams, fileName]);

    const handleImportJob = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const toastId = toast.loading("Importing job...");

        try {
            const zip = await JSZip.loadAsync(file);

            // 1. Load settings
            const settingsFile = zip.file("settings.json");
            if (!settingsFile) throw new Error("settings.json not found in zip file.");
            const settingsContent = await settingsFile.async("string");
            const settings = JSON.parse(settingsContent);

            setSlicingParams(settings.slicingParams);
            setProjectionParams(settings.projectionParams);
            setAlignmentParams(settings.alignmentParams);

            // 2. Load images
            const projectionsFolder = zip.folder("projections");
            if (!projectionsFolder) throw new Error("projections folder not found.");

            const imagePromises: Promise<{ name: string; data: string }>[] = [];
            projectionsFolder.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.png')) {
                    const promise = zipEntry.async("base64").then(data => ({
                        name: relativePath,
                        data: `data:image/png;base64,${data}`
                    }));
                    imagePromises.push(promise);
                }
            });

            const loadedImages = await Promise.all(imagePromises);
            // Sort images by name to ensure correct order
            loadedImages.sort((a, b) => a.name.localeCompare(b.name));
            setProjectionImages(loadedImages.map(img => img.data));


            // 3. Update UI
            setFileName(file.name.replace(/\.zip$/i, '.stl'));
            setStlFile(null); // We don't have the original STL, so clear it
            setSlicingStatus('complete');
            setSlicingStats({ count: loadedImages.length, time: 0 }); // Indicate loaded state
            setActiveTab(Tab.Projecting);

            toast.success("Job imported successfully!", { id: toastId });

        } catch (error) {
            console.error("Failed to import job:", error);
            toast.error(`Import failed: ${(error as Error).message}`, { id: toastId });
        } finally {
            // Reset file input so the same file can be loaded again
            event.target.value = '';
        }
    }, []);



  const TabButton: React.FC<{ tab: Tab }> = ({ tab }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-6 py-3 text-lg font-semibold transition border-b-4
        ${activeTab === tab
          ? 'text-neutral-100 border-red-400'
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
            slicingStatusMessage={slicingStatusMessage}
            slicingProgressDetails={slicingProgressDetails}
            fileName={fileName} setFileName={setFileName} setStlFile={setStlFile}
            handleExportJob={handleExportJob}
            handleImportJob={handleImportJob}
        />;
      case Tab.Projecting:
        return <ProjectingTab
            projectionParams={projectionParams} setProjectionParams={setProjectionParams} handlePrint={handlePrint}
            stopPrint={stopPrint} handlePair={handlePair} isPrinting={isPrinting} isConnected={isConnected} isAdmin={isAdmin} setIsAdmin={setIsAdmin}
            printMode={printMode} setPrintMode={setPrintMode} timePerFrame={timePerFrame} setTimePerFrame={setTimePerFrame}
            hopsPerTrigger={hopsPerTrigger} setHopsPerTrigger={setHopsPerTrigger} hopDelay={hopDelay} setHopDelay={setHopDelay}
            handleTestPrint={handleTestPrint}
            isTestPrinting={isTestPrinting}
            hasSlices={projectionImages.length > 0}
            isProjectionWindowConnected={projectionWindowStatus === 'Connected'}
            isSimulationMode={isSimulationMode}
            setIsSimulationMode={setIsSimulationMode}
        />;
      case Tab.Advanced:
        return <AdvancedTab
            alignmentParams={alignmentParams}
            setAlignmentParams={setAlignmentParams}
            openProjectionWindow={openProjectionWindow}
            projectionWindowStatus={projectionWindowStatus}
            handleCalibration={handleCalibration}
            isCalibrating={isCalibrating}
            handleSaveOffset={handleSaveOffset}
            handleResetOffset={handleResetOffset}
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
                    <Toaster
                        position="bottom-center"
                        toastOptions={{
                            style: {
                                background: '#333',
                                color: '#fff',
                            },
                        }}
                    />
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
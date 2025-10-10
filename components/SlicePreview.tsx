
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectionParams, AlignmentParams } from '../types';

// --- ICONS ---
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const PrevIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const NextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;

interface SlicePreviewProps {
    images: string[];
    projectionParams: ProjectionParams;
    alignmentParams: AlignmentParams;
    setAlignmentParams: React.Dispatch<React.SetStateAction<AlignmentParams>>;
}

const SlicePreview: React.FC<SlicePreviewProps> = ({ images, projectionParams, alignmentParams, setAlignmentParams }) => {
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const initialTranslate = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (images.length === 0 || !isPlaying) return;
        const totalRotationTimeMs = (360 / projectionParams.rotationSpeed) * 1000;
        const frameIntervalMs = Math.max(16, totalRotationTimeMs / images.length);
        const intervalId = setInterval(() => {
            setPreviewIndex(prev => (prev + 1) % images.length);
        }, frameIntervalMs);
        return () => clearInterval(intervalId);
    }, [images, projectionParams.rotationSpeed, isPlaying]);
    
    const handlePrev = useCallback(() => {
        setIsPlaying(false);
        setPreviewIndex(prev => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    const handleNext = useCallback(() => {
        setIsPlaying(false);
        setPreviewIndex(prev => (prev + 1) % images.length);
    }, [images.length]);

    const handleDragStart = (clientX: number, clientY: number) => {
        setIsDragging(true);
        dragStartPos.current = { x: clientX, y: clientY };
        initialTranslate.current = { x: alignmentParams.translateX, y: alignmentParams.translateY };
        if (imgRef.current) {
            imgRef.current.style.cursor = 'grabbing';
        }
    };
    
    const handleDragMove = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        const dx = clientX - dragStartPos.current.x;
        const dy = clientY - dragStartPos.current.y;
        
        const scaleFactor = alignmentParams.scale / 100;

        setAlignmentParams(prev => ({
            ...prev,
            translateX: initialTranslate.current.x + dx / scaleFactor,
            translateY: initialTranslate.current.y + dy / scaleFactor,
        }));
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        if (imgRef.current) {
            imgRef.current.style.cursor = 'grab';
        }
    };

    // Mouse events
    const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX, e.clientY);
    const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onMouseUp = () => handleDragEnd();
    const onMouseLeave = () => handleDragEnd();

    // Touch events
    const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchEnd = () => handleDragEnd();

    if (images.length === 0) return null;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <h3 className="text-xl font-semibold mb-4 text-neutral-300">Live Preview</h3>
            <div 
                className="w-full h-full bg-black rounded-md shadow-inner overflow-hidden flex items-center justify-center"
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <img
                    ref={imgRef}
                    src={images[previewIndex]}
                    alt={`Slice ${previewIndex + 1}`}
                    className="w-full h-full object-contain transition-all duration-100"
                    style={{
                        transform: `scale(${alignmentParams.scale / 100}) translateX(${alignmentParams.translateX}px) translateY(${alignmentParams.translateY}px)`,
                        filter: `brightness(${alignmentParams.contrast}%)`,
                        cursor: 'grab',
                    }}
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                    onDragStart={(e) => e.preventDefault()} // Prevent native image dragging
                />
            </div>
            <div className="w-full max-w-md flex items-center justify-start mt-4">
                <div className="flex items-center space-x-2">
                    <button onClick={handlePrev} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition" aria-label="Previous Slice"><PrevIcon /></button>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition" aria-label={isPlaying ? 'Pause Animation' : 'Play Animation'}>
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button onClick={handleNext} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition" aria-label="Next Slice"><NextIcon /></button>
                    <p className="text-center text-sm text-neutral-400 w-20" aria-live="polite">{previewIndex + 1} / {images.length}</p>
                </div>
            </div>
        </div>
    );
};

export default SlicePreview;

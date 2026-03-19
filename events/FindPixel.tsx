import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

export const FindPixel: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const canvas1Ref = useRef<HTMLCanvasElement>(null);
    const canvas2Ref = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<'playing' | 'found' | 'wrong'>('playing');
    
    const startTimeRef = useRef<number>(performance.now());
    const isDoneRef = useRef(false);
    
    const eventState = useRef({
        correctCanvasIndex: 0,
        pixelX: 0,
        pixelY: 0,
    });
    
    const finishEvent = useCallback((time: number) => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: time });
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isDoneRef.current) {
                setStatus('wrong');
                finishEvent(99999); // Timeout failure metric
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    useEffect(() => {
        const rng = new SeededRNG(`pixel-${settings.seed}-${tile.tileIndex}`);
        const { difficulty } = tile;
        
        const size = 64 + (difficulty - 1) * 32; // 64, 96, 128
        
        const canvas1 = canvas1Ref.current;
        const ctx1 = canvas1?.getContext('2d');
        const canvas2 = canvas2Ref.current;
        const ctx2 = canvas2?.getContext('2d');

        if (!canvas1 || !ctx1 || !canvas2 || !ctx2) return;
        
        // Disable image smoothing to see sharp pixels
        ctx1.imageSmoothingEnabled = false;
        ctx2.imageSmoothingEnabled = false;

        canvas1.width = size;
        canvas1.height = size;
        canvas2.width = size;
        canvas2.height = size;

        const generatePattern = (ctx: CanvasRenderingContext2D) => {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, size, size);
            for (let i = 0; i < 50; i++) {
                const x = rng.nextInt(0, size);
                const y = rng.nextInt(0, size);
                const w = rng.nextInt(5, Math.floor(size / 4));
                const h = rng.nextInt(5, Math.floor(size / 4));
                const r = rng.nextInt(50, 200);
                const g = rng.nextInt(50, 200);
                const b = rng.nextInt(50, 200);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, y, w, h);
            }
        };

        generatePattern(ctx1);
        ctx2.drawImage(canvas1, 0, 0);

        const pixelX = rng.nextInt(0, size);
        const pixelY = rng.nextInt(0, size);
        
        const originalPixelData = ctx1.getImageData(pixelX, pixelY, 1, 1).data;
        
        let newR, newG, newB;
        if (difficulty === 1) {
            newR = 255 - originalPixelData[0]; // Invert color for high contrast
            newG = 255 - originalPixelData[1];
            newB = 255 - originalPixelData[2];
        } else if (difficulty === 2) {
            newR = Math.min(255, originalPixelData[0] + 40);
            newG = Math.min(255, originalPixelData[1] + 40);
            newB = Math.min(255, originalPixelData[2] + 40);
        } else {
            newR = (originalPixelData[0] + 15) % 256; // Subtle change
            newG = originalPixelData[1];
            newB = originalPixelData[2];
        }

        const correctCanvasIndex = rng.nextInt(0, 2);
        const targetCtx = correctCanvasIndex === 0 ? ctx1 : ctx2;
        
        targetCtx.fillStyle = `rgb(${newR},${newG},${newB})`;
        targetCtx.fillRect(pixelX, pixelY, 1, 1);
        
        eventState.current = { correctCanvasIndex, pixelX, pixelY };
    }, [settings.seed, tile.difficulty, tile.tileIndex]);

    const handleClick = (canvasIndex: number, e: React.MouseEvent<HTMLCanvasElement>) => {
        if (status !== 'playing') return;

        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        const { correctCanvasIndex, pixelX, pixelY } = eventState.current;
        
        const drawFeedback = (ctx: CanvasRenderingContext2D, px: number, py: number, isCorrect: boolean) => {
            ctx.beginPath();
            ctx.arc(px + 0.5, py + 0.5, 8, 0, 2 * Math.PI);
            ctx.lineWidth = 2;
            ctx.strokeStyle = isCorrect ? '#4dffaf' : '#d64f8a';
            ctx.stroke();
        };

        if (canvasIndex === correctCanvasIndex && Math.abs(x - pixelX) <= 2 && Math.abs(y - pixelY) <= 2) {
            setStatus('found');
            const timeTaken = performance.now() - startTimeRef.current;
            drawFeedback(canvas.getContext('2d')!, pixelX, pixelY, true);
            finishEvent(timeTaken);
        } else {
            setStatus('wrong');
            const clickedCtx = canvas.getContext('2d');
            if(clickedCtx) drawFeedback(clickedCtx, x, y, false);
            
            const correctCanvas = (correctCanvasIndex === 0 ? canvas1Ref.current : canvas2Ref.current)!;
            const correctCtx = correctCanvas.getContext('2d');
            if(correctCtx) drawFeedback(correctCtx, pixelX, pixelY, true);

            finishEvent(99999);
        }
    };

    const getStatusMessage = () => {
        switch(status) {
            case 'playing': return 'Find the different pixel!';
            case 'found': return 'Correct!';
            case 'wrong': return 'Incorrect!';
        }
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4 animate-fade-in">{getStatusMessage()}</h3>
            <div className="flex flex-col md:flex-row gap-4">
                <canvas ref={canvas1Ref} onClick={(e) => handleClick(0, e)} className="cursor-pointer border-2 border-star-purple rounded-md w-full max-w-sm md:w-auto md:h-64" style={{imageRendering: 'pixelated'}} />
                <canvas ref={canvas2Ref} onClick={(e) => handleClick(1, e)} className="cursor-pointer border-2 border-star-purple rounded-md w-full max-w-sm md:w-auto md:h-64" style={{imageRendering: 'pixelated'}} />
            </div>
        </div>
    );
};

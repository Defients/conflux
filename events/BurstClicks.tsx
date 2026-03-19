import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

const MAX_CPS = 15; // Hard cap for anti-cheese

export const BurstClicks: React.FC<EventProps> = ({ onComplete, event, settings, tile, isBlurred , isPaused }) => {
    const [clicks, setClicks] = useState(0);
    const [validClicks, setValidClicks] = useState(0);
    const validClicksRef = useRef(0);
    const [timeLeft, setTimeLeft] = useState(5);
    const clickTimestamps = useRef<number[]>([]);
    const isDoneRef = useRef(false);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: validClicksRef.current / 5 }); // CPS
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(timer);
                    setTimeout(finishEvent, 1000);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isPaused, finishEvent]);

    const handleClick = () => {
        if (isDoneRef.current || timeLeft <= 0) return;

        const now = performance.now();
        setClicks(c => c + 1);

        // Anti-cheese: check if click is faster than allowed CPS
        const oneSecondAgo = now - 1000;
        clickTimestamps.current = clickTimestamps.current.filter(ts => ts > oneSecondAgo);
        
        if (clickTimestamps.current.length < MAX_CPS) {
            validClicksRef.current += 1;
            setValidClicks(validClicksRef.current);
        }
        clickTimestamps.current.push(now);
    };

    const targetSize = 200 - tile.difficulty * 30; // 170, 140, 110

    return (
        <div 
            className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none cursor-pointer ${isBlurred ? 'filter blur-md' : ''}`}
            onClick={handleClick}
        >
            <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">Burst Clicks!</h3>
                 <p className="font-mono text-xl">Time Left: <span className="text-solar-orange">{timeLeft}</span></p>
            </div>

            <div 
                className="bg-nebula-pink rounded-full flex flex-col items-center justify-center text-white border-8 border-star-purple"
                style={{ width: targetSize, height: targetSize }}
            >
                <span className="text-5xl font-black">{validClicks}</span>
                <span className="text-lg">Clicks</span>
            </div>
            
             {isDoneRef.current && (
                <div className="mt-8 text-3xl font-bold animate-fade-in text-hyper-green">
                    CPS: {(validClicks / 5).toFixed(2)}
                </div>
            )}
        </div>
    );
};

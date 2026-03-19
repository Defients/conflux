import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const generateTargetAngles = (rng: SeededRNG): [number, number, number] => {
    return [rng.nextInt(0, 360), rng.nextInt(0, 360), rng.nextInt(0, 360)];
};

export const AngleNudge: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const rng = useMemo(() => new SeededRNG(`anglenudge-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
    const targetAngles = useMemo(() => generateTargetAngles(rng), [rng]);

    const [currentAngle, setCurrentAngle] = useState(0);
    const [round, setRound] = useState(0);
    const [errors, setErrors] = useState<number[]>([]);
    const errorsRef = useRef<number[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const isDoneRef = useRef(false);
    
    const dialRef = useRef<HTMLDivElement>(null);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        const finalErrors = errorsRef.current;
        const meanError = finalErrors.length > 0 ? finalErrors.reduce((sum, err) => sum + err, 0) / finalErrors.length : 180;
        onComplete({ primaryMetric: meanError });
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isDoneRef.current) {
                finishEvent();
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const handleInteraction = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!dialRef.current || round >= 3) return;
        const rect = dialRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let angleDeg = (angleRad * 180) / Math.PI + 90; // Add 90 degrees to make 0 at the top
        if (angleDeg < 0) angleDeg += 360;
        setCurrentAngle(angleDeg);
    }, [round]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (round >= 3) return;
        setIsDragging(true);
        handleInteraction(e);
    };
    
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            handleInteraction(e);
        }
    }, [isDragging, handleInteraction]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const confirmAngle = () => {
        if (round >= 3) return;
        
        const target = targetAngles[round];
        const diff = Math.abs(currentAngle - target);
        // Handle wraparound distance (e.g., 359deg vs 1deg)
        const error = Math.min(diff, 360 - diff);
        const newErrors = [...errors, error];
        errorsRef.current = newErrors;
        setErrors(newErrors);

        if (round + 1 >= 3) {
            finishEvent();
            setRound(r => r + 1);
        } else {
            setRound(r => r + 1);
            setCurrentAngle(0);
        }
    };
    
    const hideNumbers = tile.difficulty >= 2;

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-2">Rotate the Dial to the Target Angle</h3>
            <p className="mb-4 text-gray-400">{round >= 3 ? `Finished! Mean Error: ${(errors.reduce((a,b) => a+b, 0)/3).toFixed(1)}°` : `Round ${round + 1} of 3`}</p>

            <div 
                ref={dialRef}
                className="w-64 h-64 md:w-80 md:h-80 bg-gray-900/50 rounded-full relative flex items-center justify-center cursor-pointer border-4 border-star-purple"
                onMouseDown={handleMouseDown}
            >
                {/* Target Angle Marker */}
                <div 
                    className="absolute w-4 h-full"
                    style={{ transform: `rotate(${targetAngles[round]}deg)` }}
                >
                    <div className="w-4 h-8 bg-hyper-green rounded-t-full" />
                </div>

                {/* Current Angle Dial */}
                 <div 
                    className="absolute w-2 h-1/2 top-0"
                    style={{ transform: `rotate(${currentAngle}deg)`, transformOrigin: 'bottom center' }}
                >
                    <div className="w-full h-full bg-nebula-pink" />
                </div>
                 <div className="w-8 h-8 rounded-full bg-star-purple z-10" />
            </div>

            <div className="mt-6 text-2xl font-mono text-center">
                <p>Target: <span className="text-hyper-green">{hideNumbers ? '???' : `${targetAngles[round]?.toFixed(0) ?? ''}°`}</span></p>
                <p>Your Angle: <span className="text-nebula-pink">{hideNumbers ? '???' : `${currentAngle.toFixed(0)}°`}</span></p>
            </div>
            
             <button onClick={confirmAngle} disabled={round >= 3} className="mt-6 px-8 py-3 bg-hyper-green text-cosmic-blue font-bold text-lg rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
              CONFIRM
            </button>
        </div>
    );
};

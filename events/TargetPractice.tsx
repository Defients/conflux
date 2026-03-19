import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EventProps } from '../types';

type Target = {
  id: number;
  x: number;
  y: number;
  size: number;
  createdAt: number;
};

const TARGET_LIFESPAN = 2000; // ms

export const TargetPractice: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred , isPaused }) => {
    const [targets, setTargets] = useState<Target[]>([]);
    const [score, setScore] = useState({ hits: 0, total: 0 });
    const scoreRef = useRef({ hits: 0, total: 0 });
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const nextTargetId = useRef(0);
    const isDoneRef = useRef(false);

    const spawnInterval = 600 - tile.difficulty * 100; // 500ms, 400ms, 300ms
    const targetSize = 80 - tile.difficulty * 15; // 65, 50, 35 px

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: scoreRef.current.hits, secondaryMetric: scoreRef.current.total });
    }, [onComplete]);
    
    // Game over timer
    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const spawnTarget = useCallback(() => {
        if (isDoneRef.current || !gameAreaRef.current) return;
        const { width, height } = gameAreaRef.current.getBoundingClientRect();
        const newTarget: Target = {
            id: nextTargetId.current++,
            x: Math.random() * (width - targetSize),
            y: Math.random() * (height - targetSize),
            size: targetSize,
            createdAt: Date.now(),
        };
        setTargets(t => [...t, newTarget]);
        scoreRef.current.total += 1;
        setScore({ ...scoreRef.current });
    }, [targetSize]);

    // Target spawner and cleaner loop
    useEffect(() => {
        if (isPaused) return;
        const spawner = setInterval(spawnTarget, spawnInterval);
        const cleaner = setInterval(() => {
             setTargets(t => t.filter(target => Date.now() - target.createdAt < TARGET_LIFESPAN));
        }, 100);
        
        return () => {
            clearInterval(spawner);
            clearInterval(cleaner);
        };
    }, [isPaused, spawnTarget, spawnInterval]);

    const handleTargetClick = (targetId: number) => {
        setTargets(t => t.filter(target => target.id !== targetId));
        scoreRef.current.hits += 1;
        setScore({ ...scoreRef.current });
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">Target Practice!</h3>
                 <p className="font-mono text-xl">Score: {score.hits} / {score.total}</p>
            </div>
            <div ref={gameAreaRef} className="w-full h-full relative cursor-crosshair">
                {targets.map(target => (
                    <div
                        key={target.id}
                        className="absolute bg-nebula-pink rounded-full flex items-center justify-center animate-fade-in border-4 border-white"
                        style={{
                            left: target.x,
                            top: target.y,
                            width: target.size,
                            height: target.size,
                            opacity: 1 - (Date.now() - target.createdAt) / TARGET_LIFESPAN,
                        }}
                        onClick={() => handleTargetClick(target.id)}
                    >
                        <div className="w-1/3 h-1/3 bg-solar-orange rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
};

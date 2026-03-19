import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const SNIPPETS = [
    "The data stream is live.",
    "Firewall breach detected!",
    "Engage quantum drive.",
    "System reboot required.",
    "Access code: ZX-99.",
    "Pathfinding algorithm complete."
];

export const TypeRacerSnippet: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const targetPhrase = useMemo(() => {
        const rng = new SeededRNG(`typeracer-${settings.seed}-${tile.tileIndex}`);
        return SNIPPETS[rng.nextInt(0, SNIPPETS.length)];
    }, [settings.seed, tile.tileIndex]);
    
    const [typedText, setTypedText] = useState('');
    const [isDone, setIsDone] = useState(false);
    const isDoneRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
        startTimeRef.current = performance.now();
    }, []);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setIsDone(true);
        const endTime = performance.now();
        const timeTakenMs = endTime - startTimeRef.current;
        onComplete({ primaryMetric: timeTakenMs });
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timeout = setTimeout(() => {
            if (!isDoneRef.current) {
                // Timeout penalty
                isDoneRef.current = true;
                setIsDone(true);
                onComplete({ primaryMetric: 99999 });
            }
        }, duration);
        return () => clearTimeout(timeout);
    }, [event, tile.difficulty, settings.accessibility, onComplete, isPaused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDoneRef.current) return;
        const currentText = e.target.value;

        // Prevent incorrect characters from being typed
        if (targetPhrase.startsWith(currentText)) {
            setTypedText(currentText);
            if (currentText === targetPhrase) {
                finishEvent();
            }
        }
    };

    const renderPhrase = () => {
        return targetPhrase.split('').map((char, index) => {
            const isTyped = index < typedText.length;
            return <span key={index} className={isTyped ? 'text-hyper-green' : 'text-gray-400'}>{char}</span>;
        });
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-8 bg-cosmic-blue/50 ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">Type Racer Snippet!</h3>
            <div className="glass-panel p-6 mb-6 w-full max-w-2xl">
                <p className="text-3xl font-mono tracking-wider text-center select-none">
                    {renderPhrase()}
                </p>
            </div>
            <input
                ref={inputRef}
                type="text"
                value={typedText}
                onChange={handleChange}
                disabled={isDone}
                className="w-full max-w-2xl p-4 text-xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />
             {isDone && <p className="mt-4 text-2xl font-bold text-hyper-green animate-fade-in">Completed in {(performance.now() - startTimeRef.current).toFixed(0)}ms</p>}
        </div>
    );
};

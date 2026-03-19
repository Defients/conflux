import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EventProps } from '../types';
import { TYPING_PHRASES } from '../constants';

// A simple Levenshtein distance function for error calculation
const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

export const TypeBurst: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred , isPaused }) => {
    const phrases = settings.accessibility ? TYPING_PHRASES.accessible : TYPING_PHRASES.standard;
    const targetPhrase = useMemo(() => phrases[Math.floor(Math.random() * phrases.length)], [phrases]);
    
    const [typedText, setTypedText] = useState('');
    const typedTextRef = useRef('');
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

    const calculateWPM = (text: string, timeMs: number) => {
        const words = text.trim().split(/\s+/).length;
        const minutes = timeMs / 60000;
        return minutes > 0 ? Math.round(words / minutes) : 0;
    };
    
    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setIsDone(true);
        
        const endTime = performance.now();
        const timeTakenMs = endTime - startTimeRef.current;

        const currentText = typedTextRef.current;
        const errors = levenshtein(targetPhrase, currentText);
        const wpm = calculateWPM(currentText, timeTakenMs);
        
        onComplete({ primaryMetric: wpm, secondaryMetric: errors });
    }, [onComplete, targetPhrase]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDoneRef.current) return;
        const currentText = e.target.value;
        typedTextRef.current = currentText;
        setTypedText(currentText);

        if (currentText === targetPhrase) {
            finishEvent();
        }
    };

    const renderPhrase = () => {
        return targetPhrase.split('').map((char, index) => {
            let color = 'text-gray-400';
            if (index < typedText.length) {
                color = char === typedText[index] ? 'text-hyper-green' : 'text-nebula-pink';
            }
            return <span key={index} className={color}>{char}</span>;
        });
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-8 bg-cosmic-blue/50 ${isBlurred ? 'filter blur-md' : ''}`}>
            <div className="glass-panel p-6 mb-6 w-full max-w-3xl">
                <p className="text-2xl font-mono tracking-wider text-center select-none">
                    {renderPhrase()}
                </p>
            </div>
            <input
                ref={inputRef}
                type="text"
                value={typedText}
                onChange={handleChange}
                disabled={isDone}
                className="w-full max-w-3xl p-4 text-xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />
        </div>
    );
};

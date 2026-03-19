import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

const MIN_INTERVAL = 1000 / 9; // ~111ms for 9 Hz
const MAX_INTERVAL = 1000 / 2; // 500ms for 2 Hz

export const SprintMash: React.FC<EventProps> = ({ onComplete, event, tile, settings, isBlurred , isPaused }) => {
    const [progress, setProgress] = useState(0);
    const progressRef = useRef(0);
    const [lastChar, setLastChar] = useState('');
    const lastCharRef = useRef('');
    const [feedback, setFeedback] = useState<'good' | 'fast' | 'slow' | 'wrong' | null>(null);

    const lastPressTime = useRef(0);
    const isDoneRef = useRef(false);
    
    // Difficulty narrows the valid cadence band
    const difficultyMultiplier = (4 - tile.difficulty) / 3; // 1, 0.66, 0.33
    const minInterval = MIN_INTERVAL;
    const maxInterval = MIN_INTERVAL + (MAX_INTERVAL - MIN_INTERVAL) * difficultyMultiplier;

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: progressRef.current });
    }, [onComplete]);
    
    useEffect(() => {
        const timer = setTimeout(finishEvent, event.durationSec(tile.difficulty, settings.accessibility) * 1000);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent]);

    const showFeedback = (type: 'good' | 'fast' | 'slow' | 'wrong') => {
        setFeedback(type);
        setTimeout(() => setFeedback(null), 300);
    }

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (isDoneRef.current || e.repeat) return;
        
        const key = e.key.toLowerCase();
        if (key !== 'a' && key !== 'd') return;

        e.preventDefault();

        const now = performance.now();
        const interval = now - lastPressTime.current;
        
        if (key === lastCharRef.current) {
            showFeedback('wrong');
            progressRef.current = Math.max(0, progressRef.current - 10);
            setProgress(progressRef.current); // Penalty for wrong key
            return;
        }

        if (interval < minInterval) {
            showFeedback('fast');
            progressRef.current = Math.max(0, progressRef.current - 5);
            setProgress(progressRef.current); // Penalty for spam
        } else if (interval > maxInterval) {
            showFeedback('slow');
            // No progress penalty for being slow, just less efficient
        } else {
            showFeedback('good');
            progressRef.current = Math.min(100, progressRef.current + 8);
            setProgress(progressRef.current);
            if (progressRef.current >= 100) {
                finishEvent();
            }
        }
        
        lastCharRef.current = key;
        setLastChar(key);
        lastPressTime.current = now;

    }, [minInterval, maxInterval, finishEvent]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
    
    const getFeedbackText = () => {
        switch (feedback) {
            case 'good': return <span className="text-hyper-green">Good!</span>;
            case 'fast': return <span className="text-solar-orange">Too Fast!</span>;
            case 'slow': return <span className="text-gray-400">Too Slow!</span>;
            case 'wrong': return <span className="text-nebula-pink">Alternate!</span>;
            default: return <span>&nbsp;</span>;
        }
    }

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-2">Sprint Mash!</h3>
            <p className="mb-6 text-gray-400">Alternate A and D with a steady rhythm!</p>

            <div className="w-full max-w-2xl">
                <div className="w-full bg-star-purple/50 h-10 rounded-lg border-2 border-star-purple">
                    <div 
                        className="bg-hyper-green h-full rounded-md transition-all duration-100" 
                        style={{ width: `${progress}%` }} 
                    />
                </div>
                <div className="flex justify-between mt-2 text-2xl font-black">
                    <span className={lastChar === 'd' ? 'text-galaxy-cyan' : 'text-gray-500'}>A</span>
                    <span className={lastChar === 'a' ? 'text-galaxy-cyan' : 'text-gray-500'}>D</span>
                </div>
            </div>
            
            <div className="mt-6 text-3xl font-bold h-10">
                {getFeedbackText()}
            </div>
        </div>
    );
};

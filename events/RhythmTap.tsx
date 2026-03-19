
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EventProps } from '../types';

type Judgement = 'Perfect' | 'Good' | 'Miss' | '';

export const RhythmTap: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred , isPaused }) => {
    const [judgement, setJudgement] = useState<Judgement>('');
    const [score, setScore] = useState(0);
    const [beat, setBeat] = useState(0);
    const [animationKey, setAnimationKey] = useState(0);

    const totalBeats = 12;
    const bpm = 100 + tile.difficulty * 25; // 125, 150, 175
    const beatDuration = 60000 / bpm; // ms per beat

    const perfectWindow = beatDuration * 0.15; // +/- 15%
    const goodWindow = beatDuration * 0.3; // +/- 30%
    
    const isDoneRef = useRef(false);
    const startTimeRef = useRef(0);
    const scoreRef = useRef(0);
    const tappedBeatsRef = useRef<Set<number>>(new Set());
    const judgementTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: scoreRef.current, secondaryMetric: totalBeats });
    }, [onComplete, totalBeats]);
    
    const handleTap = useCallback(() => {
        if (isDoneRef.current || startTimeRef.current === 0) return;
        
        const tapTime = performance.now();
        const elapsed = tapTime - startTimeRef.current;
        
        // The first beat is at beatDuration, so we want to find the closest multiple of beatDuration
        // However, we shouldn't allow tapping for beat 0 (which is at time 0)
        const closestBeatIndex = Math.max(1, Math.round(elapsed / beatDuration));
        
        if (tappedBeatsRef.current.has(closestBeatIndex)) {
            return; // Already tapped for this beat
        }
        tappedBeatsRef.current.add(closestBeatIndex);
        
        const expectedBeatTime = startTimeRef.current + closestBeatIndex * beatDuration;
        
        const diff = Math.abs(tapTime - expectedBeatTime);

        let currentJudgement: Judgement = 'Miss';
        let scoreChange = -1;
        if (diff <= perfectWindow) {
            currentJudgement = 'Perfect';
            scoreChange = 3;
        } else if (diff <= goodWindow) {
            currentJudgement = 'Good';
            scoreChange = 1;
        }
        
        scoreRef.current += scoreChange;
        setScore(scoreRef.current);
        setJudgement(currentJudgement);

        if (judgementTimeout.current) clearTimeout(judgementTimeout.current);
        judgementTimeout.current = setTimeout(() => setJudgement(''), 500);

    }, [perfectWindow, goodWindow, beatDuration]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                handleTap();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleTap]);

    useEffect(() => {
        if (isPaused) return;
        startTimeRef.current = performance.now();
        let currentBeat = 0;
        
        // Initial setup for the first beat
        setAnimationKey(k => k + 1);
        
        const beatInterval = setInterval(() => {
            currentBeat++;
            if (currentBeat >= totalBeats) {
                clearInterval(beatInterval);
                finishEvent();
                return;
            }
            
            setBeat(currentBeat);
            setAnimationKey(k => k + 1); // Re-trigger animation
        }, beatDuration);

        return () => clearInterval(beatInterval);
    }, [isPaused, beatDuration, finishEvent, totalBeats]);

    const getJudgementColor = () => {
        switch (judgement) {
            case 'Perfect': return 'text-hyper-green';
            case 'Good': return 'text-solar-orange';
            case 'Miss': return 'text-nebula-pink';
            default: return 'text-transparent';
        }
    };
    
    const animationStyle = {
        animationName: 'shrink',
        animationDuration: `${beatDuration}ms`,
        animationTimingFunction: 'linear',
    };
    
    const dynamicKeyframes = `
        @keyframes shrink {
            from { transform: scale(3); opacity: 1; }
            to { transform: scale(1); opacity: 0.5; }
        }
    `;

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none overflow-hidden ${isBlurred ? 'filter blur-md' : ''}`} onClick={handleTap}>
            <style>{dynamicKeyframes}</style>
            <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">Rhythm Tap!</h3>
                 <p className="font-mono text-xl">Score: {score}</p>
                 <p className={`text-4xl font-black transition-colors duration-200 ${getJudgementColor()}`}>{judgement}</p>
            </div>
            
            <div className="relative flex items-center justify-center">
                 {/* Shrinking Ring */}
                 <div
                    key={animationKey}
                    className="absolute w-48 h-48 rounded-full border-8 border-galaxy-cyan"
                    style={animationStyle}
                 />

                 {/* Center Target */}
                <div className="w-48 h-48 rounded-full bg-star-purple/50 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">TAP</span>
                </div>
            </div>
            <p className="mt-8 text-lg">Beat: {beat + 1} / {totalBeats}</p>
        </div>
    );
};

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

export const AudioBeat: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const { referenceBPM, optionsBPM } = useMemo(() => {
        const rng = new SeededRNG(`audiobeat-${settings.seed}-${tile.tileIndex}`);
        const baseBPM = rng.nextInt(90, 150);
        const options: number[] = [baseBPM];
        const difficultyOffset = 20 - tile.difficulty * 5; // 15, 10, 5

        while(options.length < 4) {
            const offset = (rng.nextInt(1, 4) * difficultyOffset) * (rng.nextFloat() > 0.5 ? 1 : -1);
            const newBPM = baseBPM + offset;
            if (!options.includes(newBPM) && newBPM > 0) {
                options.push(newBPM);
            }
        }
        
        return { referenceBPM: baseBPM, optionsBPM: rng.shuffle(options) };
    }, [settings.seed, tile.tileIndex, tile.difficulty]);

    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const startTimeRef = useRef(performance.now());
    const isDoneRef = useRef(false);

    const finishEvent = useCallback((isCorrect: boolean) => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        const timeTakenMs = performance.now() - startTimeRef.current;
        onComplete({ primaryMetric: isCorrect ? 1 : 0, secondaryMetric: timeTakenMs });
    }, [onComplete]);
    
    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => finishEvent(false), duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);


    const handleSelect = (index: number) => {
        if (selectedOption !== null) return;
        setSelectedOption(index);
        const isCorrect = optionsBPM[index] === referenceBPM;
        finishEvent(isCorrect);
    };

    const PulseVisualizer = ({ bpm, isReference = false }: { bpm: number, isReference?: boolean }) => {
        const animationDuration = 60 / bpm;
        return (
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${isReference ? 'bg-star-purple/50' : 'bg-cosmic-blue border-2 border-star-purple'}`}>
                <div 
                    className="absolute w-full h-full rounded-full bg-hyper-green"
                    style={{ animation: `pulse ${animationDuration}s ease-in-out infinite` }}
                />
                <span className="relative text-white font-bold">{isReference ? 'REF' : `${bpm} BPM`}</span>
            </div>
        );
    };
    
    const getButtonClass = (index: number) => {
        if (selectedOption === null) {
            return 'bg-star-purple hover:bg-nebula-pink';
        }
        if (optionsBPM[index] === referenceBPM) {
            return 'bg-hyper-green';
        }
        if (index === selectedOption) {
            return 'bg-nebula-pink';
        }
        return 'bg-star-purple opacity-50';
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-6">Match the Reference Beat</h3>
            
            <div className="mb-8">
                <PulseVisualizer bpm={referenceBPM} isReference />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {optionsBPM.map((bpm, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleSelect(i)}
                        disabled={selectedOption !== null}
                        className={`p-4 rounded-lg transition-colors duration-200 ${getButtonClass(i)}`}
                    >
                        <PulseVisualizer bpm={bpm} />
                    </button>
                ))}
            </div>
        </div>
    );
};

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type GameStatus = 'showing' | 'waiting' | 'correct' | 'incorrect';

export const SequenceSort: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const sequenceLength = 4 + tile.difficulty; // 5, 6, 7
    const { sequence, options } = useMemo(() => {
        const rng = new SeededRNG(`sequencesort-${settings.seed}-${tile.tileIndex}`);
        const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        rng.shuffle(pool);
        const seq = pool.slice(0, sequenceLength);
        const scrambled = [...seq];
        rng.shuffle(scrambled);
        return { sequence: seq, options: scrambled };
    }, [sequenceLength, settings.seed, tile.tileIndex]);

    const [status, setStatus] = useState<GameStatus>('showing');
    const [userInput, setUserInput] = useState<number[]>([]);
    const userInputRef = useRef<number[]>([]);
    const isDoneRef = useRef(false);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isDoneRef.current) {
                isDoneRef.current = true;
                setStatus('incorrect');
                onComplete({ primaryMetric: userInputRef.current.length, secondaryMetric: sequence.length });
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, onComplete, sequence.length, isPaused]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setStatus('waiting');
        }, 1500 + sequenceLength * 300); // More time to view for longer sequences
        return () => clearTimeout(timer);
    }, [sequenceLength]);

    const handleOptionClick = (num: number) => {
        if (status !== 'waiting' || isDoneRef.current) return;

        const newUserInput = [...userInputRef.current, num];
        userInputRef.current = newUserInput;
        setUserInput(newUserInput);

        if (sequence[newUserInput.length - 1] !== num) {
            isDoneRef.current = true;
            setStatus('incorrect');
            onComplete({ primaryMetric: newUserInput.length - 1, secondaryMetric: sequence.length });
            return;
        }

        if (newUserInput.length === sequence.length) {
            isDoneRef.current = true;
            setStatus('correct');
            onComplete({ primaryMetric: newUserInput.length, secondaryMetric: sequence.length });
        }
    };
    
    const getButtonClass = (num: number) => {
        if (userInput.includes(num)) return 'bg-gray-600 opacity-50';
        return 'bg-star-purple hover:bg-nebula-pink';
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-6">
                {status === 'showing' && 'Memorize the sequence...'}
                {status === 'waiting' && 'Click the numbers in order...'}
                {status === 'correct' && 'Sequence Correct!'}
                {status === 'incorrect' && 'Incorrect Sequence!'}
            </h3>
            
            {status === 'showing' && (
                <div className="flex space-x-4 animate-fade-in">
                    {sequence.map((num, i) => (
                        <div key={i} className="w-16 h-16 bg-galaxy-cyan text-cosmic-blue flex items-center justify-center text-4xl font-bold rounded-lg">
                            {num}
                        </div>
                    ))}
                </div>
            )}
            
            {(status === 'waiting' || status === 'correct' || status === 'incorrect') && (
                <div className="flex flex-col items-center">
                    <div className="h-16 mb-4 flex space-x-2">
                         {userInput.map((num, i) => (
                             <div key={i} className={`w-12 h-12 flex items-center justify-center text-2xl font-bold rounded-md text-white ${sequence[i] === num ? 'bg-hyper-green/80' : 'bg-nebula-pink'}`}>
                                 {num}
                             </div>
                         ))}
                    </div>
                     <div className="grid grid-cols-4 gap-3">
                        {options.map((num) => (
                            <button
                                key={num}
                                onClick={() => handleOptionClick(num)}
                                disabled={status !== 'waiting' || userInput.includes(num)}
                                className={`w-16 h-16 text-white flex items-center justify-center text-4xl font-bold rounded-lg transition-colors ${getButtonClass(num)}`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

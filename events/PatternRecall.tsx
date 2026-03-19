
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type GameStatus = 'showing' | 'waiting' | 'correct' | 'incorrect';

export const PatternRecall: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const sequenceLength = 3 + tile.difficulty; // 4, 5, 6
    const sequence = useMemo(() => {
        const rng = new SeededRNG(`pattern-recall-${settings.seed}-${tile.tileIndex}`);
        return Array.from({ length: sequenceLength }, () => rng.nextInt(0, 9));
    }, [sequenceLength, settings.seed, tile.tileIndex]);

    const [status, setStatus] = useState<GameStatus>('showing');
    const [litPad, setLitPad] = useState<number | null>(null);
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
        let timeouts: ReturnType<typeof setTimeout>[] = [];
        setStatus('showing');
        sequence.forEach((padIndex, i) => {
            const t1 = setTimeout(() => {
                setLitPad(padIndex);
                const t2 = setTimeout(() => setLitPad(null), 400 - tile.difficulty * 50);
                timeouts.push(t2);
                if (i === sequence.length - 1) {
                    const t3 = setTimeout(() => setStatus('waiting'), 500);
                    timeouts.push(t3);
                }
            }, (i + 1) * (600 - tile.difficulty * 50));
            timeouts.push(t1);
        });
        return () => timeouts.forEach(clearTimeout);
    }, [sequence, tile.difficulty]);

    const handlePadClick = useCallback((index: number) => {
        if (status !== 'waiting' || isDoneRef.current) return;

        const newUserInput = [...userInputRef.current, index];
        userInputRef.current = newUserInput;
        setUserInput(newUserInput);

        if (sequence[newUserInput.length - 1] !== index) {
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
    }, [status, sequence, onComplete]);
    
    const getPadBgColor = (index: number) => {
        if (litPad === index) return 'bg-hyper-green';
        if (status === 'correct') return 'bg-hyper-green/50';
        if (status === 'incorrect' && userInput[userInput.length - 1] === index) return 'bg-nebula-pink';
        return 'bg-star-purple/50';
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">
                {status === 'showing' && 'Memorize the pattern...'}
                {status === 'waiting' && 'Repeat the pattern...'}
                {status === 'correct' && 'Sequence Correct!'}
                {status === 'incorrect' && 'Incorrect Sequence!'}
            </h3>
            <div className="grid grid-cols-3 gap-3 w-64 h-64 md:w-80 md:h-80">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div
                        key={i}
                        onClick={() => handlePadClick(i)}
                        className={`rounded-lg transition-colors duration-200 ${getPadBgColor(i)} ${status === 'waiting' ? 'cursor-pointer hover:bg-star-purple' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
};

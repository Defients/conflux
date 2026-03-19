
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const SYMBOLS = ['★', '◆', '▲', '●', '■', '✚', '♦', '♥', '♠', '♣'];
const GRID_SIZE = 4;

type GridItem = { symbol: string; index: number };
type Question = { symbol: string; correctIndex: number };
type Status = 'revealing' | 'asking' | 'feedback';

export const SnapshotMemory: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const { items, questions } = useMemo(() => {
        const rng = new SeededRNG(`snapshot-${settings.seed}-${tile.tileIndex}`);
        const symbolCount = 5 + tile.difficulty; // 6, 7, 8 symbols
        const shuffledSymbols = rng.shuffle([...SYMBOLS]).slice(0, symbolCount);
        const gridIndices = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);
        rng.shuffle(gridIndices);

        const gridItems: GridItem[] = [];
        for (let i = 0; i < symbolCount; i++) {
            gridItems.push({ symbol: shuffledSymbols[i], index: gridIndices[i] });
        }
        
        rng.shuffle(gridItems);
        const quizItems = gridItems.slice(0, 3);
        const generatedQuestions: Question[] = quizItems.map(item => ({
            symbol: item.symbol,
            correctIndex: item.index
        }));
        
        return { items: gridItems, questions: generatedQuestions };
    }, [settings.seed, tile.tileIndex, tile.difficulty]);

    const [status, setStatus] = useState<Status>('revealing');
    const [questionIndex, setQuestionIndex] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const correctAnswersRef = useRef(0);
    const [selectedCell, setSelectedCell] = useState<number | null>(null);
    const isDoneRef = useRef(false);

    // Reveal phase
    useEffect(() => {
        const revealDuration = 2000 + tile.difficulty * 500; // 2.5s, 3s, 3.5s
        const timer = setTimeout(() => {
            setStatus('asking');
        }, revealDuration);
        return () => clearTimeout(timer);
    }, [tile.difficulty]);
    
    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: correctAnswersRef.current });
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

    const handleCellClick = (index: number) => {
        if (status !== 'asking') return;
        
        setSelectedCell(index);
        setStatus('feedback');
        
        if (index === questions[questionIndex].correctIndex) {
            correctAnswersRef.current += 1;
            setCorrectAnswers(correctAnswersRef.current);
        }

        setTimeout(() => {
            if (questionIndex >= questions.length - 1) {
                finishEvent();
            } else {
                setQuestionIndex(q => q + 1);
                setSelectedCell(null);
                setStatus('asking');
            }
        }, 1000);
    };
    
    const getCellClass = (index: number) => {
        if (status === 'feedback') {
            if (index === questions[questionIndex].correctIndex) return 'bg-hyper-green/50';
            if (index === selectedCell) return 'bg-nebula-pink/50';
        }
        return 'bg-star-purple/30 hover:bg-star-purple/60';
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">
                {status === 'revealing' && 'Memorize the layout!'}
                {status === 'asking' && `Where was the ${questions[questionIndex].symbol}?`}
                {status === 'feedback' && (selectedCell === questions[questionIndex].correctIndex ? 'Correct!' : 'Incorrect!')}
            </h3>
            
            <div className="grid gap-2 w-72 h-72 md:w-96 md:h-96" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`}}>
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                    const item = items.find(it => it.index === i);
                    return (
                        <div 
                            key={i} 
                            className={`rounded-lg flex items-center justify-center transition-colors ${status === 'asking' ? 'cursor-pointer' : ''} ${getCellClass(i)}`}
                            onClick={() => handleCellClick(i)}
                        >
                            {(status === 'revealing' && item) && <span className="text-4xl md:text-5xl animate-fade-in">{item.symbol}</span>}
                            {(status === 'feedback' && i === selectedCell) && <span className="text-4xl md:text-5xl">?</span>}
                        </div>
                    );
                })}
            </div>
             <p className="mt-4 text-lg">Score: {correctAnswers} / 3</p>
        </div>
    );
};

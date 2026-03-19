import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

// Simple icon set for cards
const ICONS = ['⚛️', '🚀', '🌟', '🛰️', '🪐', '☄️'];

type Card = {
    id: number;
    icon: string;
    isFlipped: boolean;
    isMatched: boolean;
};

const generateCards = (seed: string): Card[] => {
    const rng = new SeededRNG(`memoryflip-${seed}`);
    const pairs = ICONS.map((icon, index) => [{ id: index * 2, icon, isFlipped: false, isMatched: false }, { id: index * 2 + 1, icon, isFlipped: false, isMatched: false }]).flat();
    return rng.shuffle(pairs);
};

export const MemoryFlip: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const [cards, setCards] = useState<Card[]>(() => generateCards(`${settings.seed}-${tile.tileIndex}`));
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [errors, setErrors] = useState(0);
    const errorsRef = useRef(0);
    const [isRevealing, setIsRevealing] = useState(true);
    
    const startTimeRef = useRef<number>(0);
    const isDoneRef = useRef(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const finishEvent = useCallback((finalErrors: number) => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        const timeTakenMs = performance.now() - startTimeRef.current;
        onComplete({ primaryMetric: finalErrors, secondaryMetric: timeTakenMs });
    }, [onComplete]);

    // Initial reveal phase
    useEffect(() => {
        const revealDuration = 2500 - tile.difficulty * 500; // 2s, 1.5s, 1s
        const revealTimer = setTimeout(() => {
            setIsRevealing(false);
            startTimeRef.current = performance.now();
        }, revealDuration);
        return () => clearTimeout(revealTimer);
    }, [tile.difficulty]);
    
    // Timeout for the event
    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const gameTimer = setTimeout(() => finishEvent(errorsRef.current + 5), duration); // Add penalty for timeout
        return () => clearTimeout(gameTimer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const handleCardClick = (index: number) => {
        if (isRevealing || flippedIndices.length === 2 || cards[index].isFlipped || isDoneRef.current) {
            return;
        }

        const newFlippedIndices = [...flippedIndices, index];
        setFlippedIndices(newFlippedIndices);

        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);

        if (newFlippedIndices.length === 2) {
            const card1 = cards[newFlippedIndices[0]];
            const card2 = cards[newFlippedIndices[1]];

            if (card1.icon === card2.icon) {
                // Match
                const matchedCards = newCards.map(card => 
                    (card.id === card1.id || card.id === card2.id) ? { ...card, isMatched: true } : card
                );
                setCards(matchedCards);
                setFlippedIndices([]);
                if (matchedCards.every(c => c.isMatched)) {
                    finishEvent(errorsRef.current);
                }
            } else {
                // No Match
                errorsRef.current += 1;
                setErrors(errorsRef.current);
                timeoutRef.current = setTimeout(() => {
                    const resetCards = newCards.map(card => 
                        (!card.isMatched) ? { ...card, isFlipped: false } : card
                    );
                    setCards(resetCards);
                    setFlippedIndices([]);
                }, 1000);
            }
        }
    };
    
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
             <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">
                {isRevealing ? 'Memorize!' : 'Find the pairs!'} | Errors: {errors}
            </h3>
            <div className="grid grid-cols-4 gap-3 w-full max-w-md">
                {cards.map((card, index) => (
                    <div key={card.id} className="aspect-square" onClick={() => handleCardClick(index)}>
                        <div className={`w-full h-full rounded-lg transition-transform duration-500 cursor-pointer`} style={{ transformStyle: 'preserve-3d', transform: (isRevealing || card.isFlipped) ? 'rotateY(180deg)' : '' }}>
                            {/* Card Back */}
                            <div className="absolute w-full h-full bg-star-purple backface-hidden flex items-center justify-center text-4xl font-black text-cosmic-blue">?</div>
                            {/* Card Front */}
                            <div className="absolute w-full h-full bg-galaxy-cyan/80 backface-hidden flex items-center justify-center text-4xl" style={{ transform: 'rotateY(180deg)' }}>{card.icon}</div>
                        </div>
                    </div>
                ))}
            </div>
            <style>{`.backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }`}</style>
        </div>
    );
};

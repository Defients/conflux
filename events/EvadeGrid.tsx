
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EventProps } from '../types';

const GRID_SIZE = 5;

type Position = { x: number; y: number };

export const EvadeGrid: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const [playerPos, setPlayerPos] = useState<Position>({ x: 2, y: 4 });
    const [dangerZones, setDangerZones] = useState<Position[]>([]);
    const [telegraphZones, setTelegraphZones] = useState<Position[]>([]);
    const [hits, setHits] = useState(0);
    const hitsRef = useRef(0);
    const [round, setRound] = useState(0);
    const isGameOver = useRef(false);

    const totalRounds = 4 + tile.difficulty; // 5, 6, 7 rounds
    const roundDuration = 2000 - tile.difficulty * 250; // 1750, 1500, 1250 ms

    const generateNewTelegraphs = useCallback(() => {
        const newZones: Position[] = [];
        const numDangers = Math.min(GRID_SIZE * GRID_SIZE - 2, 2 + tile.difficulty);
        while (newZones.length < numDangers) {
            const pos = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE),
            };
            if (!newZones.some(z => z.x === pos.x && z.y === pos.y)) {
                newZones.push(pos);
            }
        }
        return newZones;
    }, [tile.difficulty]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isGameOver.current) {
                isGameOver.current = true;
                onComplete({ primaryMetric: hitsRef.current });
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, onComplete, isPaused]);

    useEffect(() => {
        if (isPaused) return;
        const gameLoop = setInterval(() => {
            if (isGameOver.current) {
                clearInterval(gameLoop);
                return;
            }

            setRound(r => {
                const nextRound = r + 1;
                if (nextRound > totalRounds) {
                    isGameOver.current = true;
                    setTimeout(() => onComplete({ primaryMetric: hitsRef.current }), 0);
                    return r;
                }

                // Phase 1: Telegraph
                setDangerZones([]);
                const newTelegraphs = generateNewTelegraphs();
                setTelegraphZones(newTelegraphs);

                // Phase 2: Activate
                setTimeout(() => {
                    if (isGameOver.current) return;
                    setTelegraphZones([]);
                    setDangerZones(newTelegraphs);
                    // Check for hit using a ref to get the latest position
                    setPlayerPos(currentPos => {
                        if (newTelegraphs.some(z => z.x === currentPos.x && z.y === currentPos.y)) {
                            hitsRef.current += 1;
                            setHits(hitsRef.current);
                        }
                        return currentPos;
                    });
                }, roundDuration * 0.4);
                
                return nextRound;
            });
        }, roundDuration);

        return () => clearInterval(gameLoop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPaused, generateNewTelegraphs, roundDuration, totalRounds, onComplete]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (isGameOver.current) return;
        setPlayerPos(prev => {
            let { x, y } = prev;
            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') y = Math.max(0, y - 1);
            if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') y = Math.min(GRID_SIZE - 1, y + 1);
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') x = Math.max(0, x - 1);
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') x = Math.min(GRID_SIZE - 1, x + 1);
            return { x, y };
        });
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const getCellClass = (x: number, y: number) => {
        if (playerPos.x === x && playerPos.y === y) return 'bg-galaxy-cyan';
        if (dangerZones.some(z => z.x === x && z.y === y)) return 'bg-nebula-pink animate-pulse';
        if (telegraphZones.some(z => z.x === x && z.y === y)) return 'bg-solar-orange/50';
        return 'bg-star-purple/30';
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 ${isBlurred ? 'filter blur-md' : ''}`}>
            <div className="w-full flex justify-between items-center max-w-sm mb-4">
                <h3 className="text-xl font-bold text-galaxy-cyan">Evade The Grid!</h3>
                <div className="text-lg">
                    <span className="font-bold text-nebula-pink">Hits: {hits}</span> | <span className="text-gray-400">Round: {round}/{totalRounds}</span>
                </div>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                    const x = i % GRID_SIZE;
                    const y = Math.floor(i / GRID_SIZE);
                    return <div key={i} className={`w-14 h-14 md:w-16 md:h-16 rounded-md transition-colors duration-150 ${getCellClass(x, y)}`} />;
                })}
            </div>
        </div>
    );
};

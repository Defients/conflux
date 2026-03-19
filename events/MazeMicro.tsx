import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Cell = {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
};
type Position = { r: number; c: number };

const generateMaze = (width: number, height: number, rng: SeededRNG): Cell[][] => {
    const grid: Cell[][] = Array.from({ length: height }, () => 
        Array.from({ length: width }, () => ({ top: true, right: true, bottom: true, left: true }))
    );
    const stack: Position[] = [{ r: 0, c: 0 }];
    const visited = new Set<string>(['0,0']);

    const getNeighbors = ({ r, c }: Position) => {
        const neighbors: { pos: Position; wall: keyof Cell; opposite: keyof Cell }[] = [];
        if (r > 0) neighbors.push({ pos: { r: r - 1, c }, wall: 'top', opposite: 'bottom' });
        if (c < width - 1) neighbors.push({ pos: { r, c: c + 1 }, wall: 'right', opposite: 'left' });
        if (r < height - 1) neighbors.push({ pos: { r: r + 1, c }, wall: 'bottom', opposite: 'top' });
        if (c > 0) neighbors.push({ pos: { r, c: c - 1 }, wall: 'left', opposite: 'right' });
        return neighbors.filter(n => !visited.has(`${n.pos.r},${n.pos.c}`));
    };

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = getNeighbors(current);
        if (neighbors.length > 0) {
            const { pos, wall, opposite } = neighbors[rng.nextInt(0, neighbors.length)];
            grid[current.r][current.c][wall] = false;
            grid[pos.r][pos.c][opposite] = false;
            visited.add(`${pos.r},${pos.c}`);
            stack.push(pos);
        } else {
            stack.pop();
        }
    }
    
    // Open the entrance and exit
    grid[0][0].left = false;
    grid[height - 1][width - 1].right = false;
    
    return grid;
};

export const MazeMicro: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred , isPaused }) => {
    const { gridSize, maze } = useMemo(() => {
        const size = 7 + (tile.difficulty - 1) * 2; // 7, 9, 11
        const rng = new SeededRNG(`maze-${settings.seed}-${tile.tileIndex}`);
        return { gridSize: size, maze: generateMaze(size, size, rng) };
    }, [tile.difficulty, settings.seed, tile.tileIndex]);
    
    const [playerPos, setPlayerPos] = useState<Position>({ r: 0, c: 0 });
    const [isFinished, setIsFinished] = useState(false);
    
    const startTimeRef = useRef(performance.now());
    const isDoneRef = useRef(false);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setIsFinished(true);
        const timeTaken = performance.now() - startTimeRef.current;
        onComplete({ primaryMetric: timeTaken });
    }, [onComplete]);
    
    useEffect(() => {
        const timeout = setTimeout(() => finishEvent(), event.durationSec(tile.difficulty, settings.accessibility) * 1000);
        return () => clearTimeout(timeout);
    }, [event, tile.difficulty, settings.accessibility, finishEvent]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (isDoneRef.current) return;
        
        setPlayerPos(prevPos => {
            let newPos = { ...prevPos };
            const currentCell = maze[prevPos.r][prevPos.c];

            if ((e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') && !currentCell.top && prevPos.r > 0) newPos.r--;
            else if ((e.key === 'ArrowDown' || e.key.toLowerCase() === 's') && !currentCell.bottom && prevPos.r < gridSize - 1) newPos.r++;
            else if ((e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') && !currentCell.left && prevPos.c > 0) newPos.c--;
            else if ((e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') && !currentCell.right && prevPos.c < gridSize - 1) newPos.c++;
            
            if (newPos.r === gridSize - 1 && newPos.c === gridSize - 1) {
                finishEvent();
            }
            return newPos;
        });

    }, [maze, gridSize, finishEvent]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
    
    const cellStyle = (cell: Cell) => ({
        borderTop: cell.top ? '2px solid #4a3f9d' : '2px solid transparent',
        borderRight: cell.right ? '2px solid #4a3f9d' : '2px solid transparent',
        borderBottom: cell.bottom ? '2px solid #4a3f9d' : '2px solid transparent',
        borderLeft: cell.left ? '2px solid #4a3f9d' : '2px solid transparent',
    });

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">
                {isFinished ? 'Maze Complete!' : 'Reach the exit!'}
            </h3>
            <div className="bg-gray-900/50 p-2 rounded-lg">
                <div className="relative" style={{ width: 'min(80vh, 500px)', height: 'min(80vh, 500px)' }}>
                     <div className="grid w-full h-full" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`}}>
                        {maze.flat().map((cell, i) => (
                            <div key={i} className="relative" style={cellStyle(cell)}>
                                {i === 0 && <div className="absolute inset-0 bg-hyper-green/50"></div>}
                                {i === gridSize * gridSize - 1 && <div className="absolute inset-0 bg-nebula-pink/50"></div>}
                            </div>
                        ))}
                    </div>
                    <div 
                        className="absolute w-full h-full top-0 left-0 pointer-events-none"
                        style={{
                            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                            gridTemplateRows: `repeat(${gridSize}, 1fr)`,
                            display: 'grid'
                        }}
                    >
                        <div 
                            className="bg-galaxy-cyan rounded-full transition-all duration-100 ease-linear" 
                            style={{ 
                                gridColumn: playerPos.c + 1,
                                gridRow: playerPos.r + 1,
                                margin: '20%'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

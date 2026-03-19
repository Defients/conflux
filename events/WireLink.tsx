
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Position = { x: number; y: number };
type Node = Position & { id: number; color: string };
type Wire = { id: number; color: string; path: Position[] };

const COLORS = ['#00dffc', '#d64f8a', '#4dffaf', '#ffae42', '#a77dff'];

const generatePuzzle = (difficulty: number, seed: string): { nodes: Node[], gridSize: number } => {
    const rng = new SeededRNG(`wirelink-${seed}-${difficulty}`);
    const gridSize = 3 + difficulty; // 4, 5, 6
    const numPairs = 2 + difficulty; // 3, 4, 5
    const usedPositions: Set<string> = new Set();
    const nodes: Node[] = [];
    
    for (let i = 0; i < numPairs; i++) {
        const color = COLORS[i % COLORS.length];
        let pos1: Position, pos2: Position;
        do {
            pos1 = { x: rng.nextInt(0, gridSize), y: rng.nextInt(0, gridSize) };
        } while (usedPositions.has(`${pos1.x},${pos1.y}`));
        usedPositions.add(`${pos1.x},${pos1.y}`);
        nodes.push({ ...pos1, id: i, color });
        
        do {
            pos2 = { x: rng.nextInt(0, gridSize), y: rng.nextInt(0, gridSize) };
        } while (usedPositions.has(`${pos2.x},${pos2.y}`));
        usedPositions.add(`${pos2.x},${pos2.y}`);
        nodes.push({ ...pos2, id: i, color });
    }
    return { nodes, gridSize };
};

export const WireLink: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred , isPaused }) => {
    const { nodes, gridSize } = useMemo(() => generatePuzzle(tile.difficulty, settings.seed), [tile.difficulty, settings.seed]);
    
    const [wires, setWires] = useState<Wire[]>([]);
    const [activeWire, setActiveWire] = useState<{ id: number; color: string; path: Position[] } | null>(null);
    const [isSolved, setIsSolved] = useState(false);
    
    const svgRef = useRef<SVGSVGElement>(null);
    const startTimeRef = useRef<number>(performance.now());
    const isDoneRef = useRef(false);
    
    const finishEvent = useCallback((time: number) => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: time });
    }, [onComplete]);

    const pathOccupied = useCallback((pos: Position, checkWireId?: number) => {
        for (const wire of wires) {
            if (checkWireId !== undefined && wire.id === checkWireId) continue;
            // Don't check start/end points of other wires
            for (let i = 1; i < wire.path.length - 1; i++) {
                const p = wire.path[i];
                if (p.x === pos.x && p.y === pos.y) return true;
            }
        }
        return false;
    }, [wires]);

    const getSVGCoords = useCallback((e: React.MouseEvent | MouseEvent): Position | null => {
        if (!svgRef.current) return null;
        const svgPoint = svgRef.current.createSVGPoint();
        svgPoint.x = e.clientX;
        svgPoint.y = e.clientY;
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return null;
        const invertedCTM = CTM.inverse();
        const { x, y } = svgPoint.matrixTransform(invertedCTM);
        const cellSize = 100;
        return { x: Math.floor(x / cellSize), y: Math.floor(y / cellSize) };
    }, []);

    const handleMouseDown = useCallback((node: Node) => {
        if (isSolved) return;
        const existingWire = wires.find(w => w.id === node.id);
        if (existingWire) {
            setWires(wires => wires.filter(w => w.id !== node.id));
            return;
        }
        setActiveWire({ id: node.id, color: node.color, path: [node] });
    }, [wires, isSolved]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!activeWire) return;
        const pos = getSVGCoords(e);
        if (!pos) return;

        const lastPos = activeWire.path[activeWire.path.length - 1];
        if (pos.x === lastPos.x && pos.y === lastPos.y) return;

        if (pos.x < 0 || pos.x >= gridSize || pos.y < 0 || pos.y >= gridSize) {
            return;
        }
        
        // Backtracking
        if (activeWire.path.length > 1 && pos.x === activeWire.path[activeWire.path.length - 2].x && pos.y === activeWire.path[activeWire.path.length - 2].y) {
             setActiveWire(w => w ? { ...w, path: w.path.slice(0, -1) } : null);
             return;
        }

        // Only allow cardinal moves & check for collision
        if (Math.abs(pos.x - lastPos.x) + Math.abs(pos.y - lastPos.y) === 1 && !pathOccupied(pos, activeWire.id)) {
            setActiveWire(w => w ? { ...w, path: [...w.path, pos] } : null);
        }
    }, [activeWire, getSVGCoords, gridSize, pathOccupied]);

    const handleMouseUp = useCallback(() => {
        if (!activeWire) return;
        
        const endPos = activeWire.path[activeWire.path.length - 1];
        const targetNode = nodes.find(n => n.id === activeWire.id && (n.x !== activeWire.path[0].x || n.y !== activeWire.path[0].y));
        
        if (targetNode && endPos.x === targetNode.x && endPos.y === targetNode.y) {
            setWires(w => [...w, activeWire]);
        }
        setActiveWire(null);
    }, [activeWire, nodes]);
    
    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    useEffect(() => {
        const numPairs = nodes.length / 2;
        if (wires.length === numPairs) {
            setIsSolved(true);
            finishEvent(performance.now() - startTimeRef.current);
        }
    }, [wires, nodes.length, finishEvent]);
    
     useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => finishEvent(99999), duration);
        return () => clearTimeout(timer);
    }, [finishEvent, settings.accessibility, tile.difficulty, event, isPaused]);

    const renderPath = (path: Position[]) => {
        return path.map((p, i) => {
            if (i === 0) return `M ${p.x * 100 + 50} ${p.y * 100 + 50}`;
            return `L ${p.x * 100 + 50} ${p.y * 100 + 50}`;
        }).join(' ');
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">
                {isSolved ? 'Puzzle Solved!' : 'Connect the matching nodes!'}
            </h3>
            <div className="bg-gray-900/50 p-2 rounded-lg" style={{ width: '80vh', maxWidth: '500px', aspectRatio: '1 / 1' }}>
                <svg
                    ref={svgRef}
                    viewBox={`-10 -10 ${gridSize * 100 + 20} ${gridSize * 100 + 20}`}
                    className="w-full h-full"
                    onMouseLeave={handleMouseUp}
                >
                    {/* Grid dots */}
                    {Array.from({ length: gridSize * gridSize }).map((_, i) => (
                        <circle key={i} cx={i % gridSize * 100 + 50} cy={Math.floor(i / gridSize) * 100 + 50} r="2" fill="#4a3f9d" />
                    ))}
                    
                    {/* Wires */}
                    {wires.map(wire => (
                         <path key={wire.id} d={renderPath(wire.path)} stroke={wire.color} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    
                    {/* Active Wire */}
                    {activeWire && (
                        <path d={renderPath(activeWire.path)} stroke={activeWire.color} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                    )}

                    {/* Nodes */}
                    {nodes.map((node, i) => (
                        <circle
                            key={i}
                            cx={node.x * 100 + 50}
                            cy={node.y * 100 + 50}
                            r="20"
                            fill={node.color}
                            onMouseDown={() => handleMouseDown(node)}
                            className="cursor-pointer"
                        />
                    ))}
                </svg>
            </div>
        </div>
    );
};

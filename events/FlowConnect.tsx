import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type TileType = 'source' | 'dest' | 'empty';
interface PipeTile {
  index: number;
  type: TileType;
  rotation: number; // 0, 90, 180, 270
  baseConnections: boolean[]; // canonical [top, right, bottom, left] at rotation=0
  connections: boolean[]; // rotated [top, right, bottom, left]
}

const GRID_SIZE = 3;

const PIPE_SHAPES: { connections: boolean[]; name: string }[] = [
  { connections: [true, true, false, false], name: 'TR' },   // top-right
  { connections: [false, true, true, false], name: 'RB' },   // right-bottom
  { connections: [false, false, true, true], name: 'BL' },   // bottom-left
  { connections: [true, false, false, true], name: 'TL' },   // top-left
  { connections: [true, false, true, false], name: 'TB' },   // top-bottom (straight)
  { connections: [false, true, false, true], name: 'RL' },   // right-left (straight)
];

export function rotateConnections(conn: boolean[], rotation: number): boolean[] {
  const steps = ((rotation / 90) % 4 + 4) % 4;
  const result = [...conn];
  for (let i = 0; i < steps; i++) {
    result.unshift(result.pop()!);
  }
  return result;
}

/**
 * Generate a guaranteed-solvable pipe grid from (0,0) to (gridSize-1, gridSize-1).
 * Builds a monotonic path from source to dest, assigns exact connecting pipe shapes
 * along the path, and scrambles interior tile rotations so the puzzle is solvable
 * by rotating interior tiles.
 */
export function generateSolvableFlowGrid(gridSize: number, rng: SeededRNG): PipeTile[] {
  const path: { r: number; c: number }[] = [{ r: 0, c: 0 }];
  let r = 0;
  let c = 0;
  while (r < gridSize - 1 || c < gridSize - 1) {
    if (r === gridSize - 1) {
      c++;
    } else if (c === gridSize - 1) {
      r++;
    } else if (rng.nextFloat() < 0.5) {
      r++;
    } else {
      c++;
    }
    path.push({ r, c });
  }

  const pathMap = new Map<number, number>();
  path.forEach((pos, stepIdx) => {
    pathMap.set(pos.r * gridSize + pos.c, stepIdx);
  });

  const dirBetween = (from: { r: number; c: number }, to: { r: number; c: number }): number => {
    if (to.r < from.r) return 0; // top
    if (to.c > from.c) return 1; // right
    if (to.r > from.r) return 2; // bottom
    return 3; // left
  };

  const tiles: PipeTile[] = [];
  for (let i = 0; i < gridSize * gridSize; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    let type: TileType = 'empty';
    if (row === 0 && col === 0) type = 'source';
    else if (row === gridSize - 1 && col === gridSize - 1) type = 'dest';

    const stepIdx = pathMap.get(i);
    if (stepIdx !== undefined) {
      const neededDirs = new Set<number>();
      if (stepIdx > 0) {
        neededDirs.add(dirBetween(path[stepIdx], path[stepIdx - 1]));
      }
      if (stepIdx < path.length - 1) {
        neededDirs.add(dirBetween(path[stepIdx], path[stepIdx + 1]));
      }
      // If source or dest only has 1 neighbor on the path, add a second non-conflicting arm
      if (neededDirs.size === 1) {
        const onlyDir = [...neededDirs][0];
        const oppDir = (onlyDir + 2) % 4;
        neededDirs.add(oppDir);
      }

      const solvedConnections = [0, 1, 2, 3].map(d => neededDirs.has(d));
      // Keep source and dest fixed in their solved orientation since handleRotate locks them;
      // rotate interior path tiles by 90/180/270 so the player has to rotate them into place.
      const scrambleSteps = type === 'empty' ? rng.nextInt(1, 4) : 0;
      const rotation = scrambleSteps * 90;
      tiles.push({
        index: i,
        type,
        rotation,
        baseConnections: solvedConnections,
        connections: rotateConnections(solvedConnections, rotation),
      });
    } else {
      const shapeIdx = rng.nextInt(0, PIPE_SHAPES.length);
      const baseConnections = [...PIPE_SHAPES[shapeIdx].connections];
      const rotation = rng.nextInt(0, 4) * 90;
      tiles.push({
        index: i,
        type,
        rotation,
        baseConnections,
        connections: rotateConnections(baseConnections, rotation),
      });
    }
  }

  return tiles;
}

export const FlowConnect: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`flowconnect-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [grid, setGrid] = useState<PipeTile[]>([]);
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);
  const [startTime] = useState(performance.now);
  const isDoneRef = useRef(false);
  const gridRef = useRef<PipeTile[]>([]);

  const gridSize = GRID_SIZE + (tile.difficulty >= 3 ? 1 : 0);

  useEffect(() => {
    const tiles = generateSolvableFlowGrid(gridSize, rng);
    gridRef.current = tiles;
    setGrid(tiles);
  }, [rng, gridSize]);

  const finishEvent = useCallback((didSolve?: boolean) => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    const isSolved = didSolve ?? solvedRef.current;
    const timeMs = Math.max(1, performance.now() - startTime);
    onComplete({ primaryMetric: isSolved ? timeMs : 99999 });
  }, [onComplete, startTime]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(() => finishEvent(false), duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  const checkSolved = useCallback((tiles: PipeTile[]) => {
    const visited = new Set<number>();
    const queue = [0];
    visited.add(0);

    while (queue.length > 0) {
      const idx = queue.shift()!;
      const row = Math.floor(idx / gridSize);
      const col = idx % gridSize;
      const t = tiles[idx];
      const conn = t.connections;

      const neighbors = [
        { dir: 0, dr: -1, dc: 0, opposite: 2 },
        { dir: 1, dr: 0, dc: 1, opposite: 3 },
        { dir: 2, dr: 1, dc: 0, opposite: 0 },
        { dir: 3, dr: 0, dc: -1, opposite: 1 },
      ];

      for (const n of neighbors) {
        if (!conn[n.dir]) continue;
        const nr = row + n.dr;
        const nc = col + n.dc;
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
        const nIdx = nr * gridSize + nc;
        if (visited.has(nIdx)) continue;
        if (tiles[nIdx].connections[n.opposite]) {
          visited.add(nIdx);
          queue.push(nIdx);
          if (tiles[nIdx].type === 'dest') {
            return true;
          }
        }
      }
    }
    return false;
  }, [gridSize]);

  const handleRotate = (index: number) => {
    if (isDoneRef.current || isPaused) return;
    const current = gridRef.current[index];
    if (!current || current.type === 'source' || current.type === 'dest') return;
    const newRotation = (current.rotation + 90) % 360;
    const newConn = rotateConnections(current.baseConnections, newRotation);
    const newTiles = gridRef.current.map(t =>
      t.index === index ? { ...t, rotation: newRotation, connections: newConn } : t
    );
    gridRef.current = newTiles;
    setGrid(newTiles);
    if (checkSolved(newTiles)) {
      solvedRef.current = true;
      setSolved(true);
      setTimeout(() => finishEvent(true), 400);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Flow Connect</h3>
        <p className="text-sm text-gray-400">Click tiles to rotate. Connect source → destination!</p>
      </div>

      <div
        className="grid gap-1 mt-8 p-2 bg-gray-900/50 rounded-lg border-2 border-star-purple/30"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {grid.map((t, i) => (
          <div
            key={i}
            onClick={() => handleRotate(i)}
            className={`w-16 h-16 rounded border-2 flex items-center justify-center cursor-pointer transition-colors duration-150 ${
              t.type === 'source' ? 'border-hyper-green bg-hyper-green/20' :
              t.type === 'dest' ? 'border-solar-orange bg-solar-orange/20' :
              'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <svg width="48" height="48" viewBox="0 0 48 48">
              {t.connections[0] && <rect x="22" y="0" width="4" height="24" fill={t.type === 'source' ? '#00ff88' : t.type === 'dest' ? '#ff8c42' : '#6b21a8'} />}
              {t.connections[1] && <rect x="24" y="22" width="24" height="4" fill={t.type === 'source' ? '#00ff88' : t.type === 'dest' ? '#ff8c42' : '#6b21a8'} />}
              {t.connections[2] && <rect x="22" y="24" width="4" height="24" fill={t.type === 'source' ? '#00ff88' : t.type === 'dest' ? '#ff8c42' : '#6b21a8'} />}
              {t.connections[3] && <rect x="0" y="22" width="24" height="4" fill={t.type === 'source' ? '#00ff88' : t.type === 'dest' ? '#ff8c42' : '#6b21a8'} />}
              <circle cx="24" cy="24" r="6" fill={t.type === 'source' ? '#00ff88' : t.type === 'dest' ? '#ff8c42' : '#6b21a8'} />
            </svg>
          </div>
        ))}
      </div>

      {solved && (
        <p className="mt-6 text-3xl font-bold text-hyper-green animate-fade-in">Connected!</p>
      )}
    </div>
  );
};

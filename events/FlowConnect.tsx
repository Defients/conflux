import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type TileType = 'source' | 'dest' | 'empty';
interface PipeTile {
  index: number;
  type: TileType;
  rotation: number; // 0, 90, 180, 270
  connections: boolean[]; // [top, right, bottom, left]
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

function rotateConnections(conn: boolean[], rotation: number): boolean[] {
  const steps = (rotation / 90) % 4;
  const result = [...conn];
  for (let i = 0; i < steps; i++) {
    result.unshift(result.pop()!);
  }
  return result;
}

export const FlowConnect: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`flowconnect-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [grid, setGrid] = useState<PipeTile[]>([]);
  const [solved, setSolved] = useState(false);
  const [startTime] = useState(performance.now);
  const isDoneRef = useRef(false);
  const gridRef = useRef<PipeTile[]>([]);

  const gridSize = GRID_SIZE + (tile.difficulty >= 3 ? 1 : 0);

  useEffect(() => {
    const tiles: PipeTile[] = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      let type: TileType = 'empty';
      if (row === 0 && col === 0) type = 'source';
      else if (row === gridSize - 1 && col === gridSize - 1) type = 'dest';

      const shapeIdx = rng.nextInt(0, PIPE_SHAPES.length);
      const rotation = rng.nextInt(0, 4) * 90;
      tiles.push({
        index: i,
        type,
        rotation,
        connections: rotateConnections(PIPE_SHAPES[shapeIdx].connections, rotation),
      });
    }
    gridRef.current = tiles;
    setGrid(tiles);
  }, [rng, gridSize]);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    const timeMs = performance.now() - startTime;
    onComplete({ primaryMetric: solved ? timeMs : 99999 });
  }, [onComplete, solved, startTime]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
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
    if (isDoneRef.current) return;
    const tile = gridRef.current[index];
    if (tile.type === 'source' || tile.type === 'dest') return;
    const newRotation = (tile.rotation + 90) % 360;
    const shapeIdx = PIPE_SHAPES.findIndex(s =>
      JSON.stringify(rotateConnections(s.connections, tile.rotation)) === JSON.stringify(tile.connections)
    );
    const baseConn = shapeIdx >= 0 ? PIPE_SHAPES[shapeIdx].connections : tile.connections;
    const newConn = rotateConnections(baseConn, newRotation);
    const newTiles = gridRef.current.map(t =>
      t.index === index ? { ...t, rotation: newRotation, connections: newConn } : t
    );
    gridRef.current = newTiles;
    setGrid(newTiles);
    if (checkSolved(newTiles)) {
      setSolved(true);
      setTimeout(() => finishEvent(), 500);
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
            className={`w-16 h-16 rounded border-2 flex items-center justify-center cursor-pointer transition-transform duration-150 ${
              t.type === 'source' ? 'border-hyper-green bg-hyper-green/20' :
              t.type === 'dest' ? 'border-solar-orange bg-solar-orange/20' :
              'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
            style={{ transform: `rotate(${t.rotation}deg)` }}
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

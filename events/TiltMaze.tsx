import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const CELL_SIZE = 32;
const GRID_W = 10;
const GRID_H = 10;

type Cell = { walls: { top: boolean; right: boolean; bottom: boolean; left: boolean } };

function generateMaze(seed: string): Cell[][] {
  const rng = new SeededRNG(`tiltmaze-${seed}`);
  const grid: Cell[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      grid[y][x] = { walls: { top: true, right: true, bottom: true, left: true } };
    }
  }

  // Simple recursive backtracking maze generation
  const visited = new Set<string>();
  const stack: [number, number][] = [[0, 0]];
  visited.add('0,0');

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors: [number, number, string, string][] = [
      [cx, cy - 1, 'top', 'bottom'],
      [cx + 1, cy, 'right', 'left'],
      [cx, cy + 1, 'bottom', 'top'],
      [cx - 1, cy, 'left', 'right'],
    ];
    const valid = neighbors.filter(([nx, ny]) =>
      nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(`${nx},${ny}`)
    );

    if (valid.length === 0) {
      stack.pop();
      continue;
    }

    const [nx, ny, wallA, wallB] = valid[rng.nextInt(0, valid.length)];
    grid[cy][cx].walls[wallA as keyof Cell['walls']] = false;
    grid[ny][nx].walls[wallB as keyof Cell['walls']] = false;
    visited.add(`${nx},${ny}`);
    stack.push([nx, ny]);
  }

  return grid;
}

export const TiltMaze: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const [maze] = useState(() => generateMaze(`${settings.seed}-${tile.tileIndex}`));
  const [ballPos, setBallPos] = useState({ x: 0, y: 0 });
  const [ballPx, setBallPx] = useState({ x: CELL_SIZE / 2, y: CELL_SIZE / 2 });
  const [isDone, setIsDone] = useState(false);
  const startTimeRef = useRef(Date.now());
  const isDoneRef = useRef(false);
  const posRef = useRef({ px: CELL_SIZE / 2, py: CELL_SIZE / 2 });
  const velRef = useRef({ vx: 0, vy: 0 });
  const tiltRef = useRef({ tx: 0, ty: 0 });
  const requestRef = useRef<number | null>(null);

  const maxDuration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;

  const finish = useCallback((elapsed: number) => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    setIsDone(true);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setTimeout(() => onComplete({ primaryMetric: elapsed / 1000 }), 500);
  }, [onComplete]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') tiltRef.current = { tx: -1, ty: 0 };
      else if (e.key === 'ArrowRight' || e.key === 'd') tiltRef.current = { tx: 1, ty: 0 };
      else if (e.key === 'ArrowUp' || e.key === 'w') tiltRef.current = { tx: 0, ty: -1 };
      else if (e.key === 'ArrowDown' || e.key === 's') tiltRef.current = { tx: 0, ty: 1 };
    };
    const handleKeyUp = () => { tiltRef.current = { tx: 0, ty: 0 }; };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    tiltRef.current = {
      tx: Math.max(-1, Math.min(1, (e.clientX - rect.left - cx) / cx)),
      ty: Math.max(-1, Math.min(1, (e.clientY - rect.top - cy) / cy)),
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    tiltRef.current = { tx: 0, ty: 0 };
  }, []);

  useEffect(() => {
    if (isPaused || isDone) return;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (elapsed >= maxDuration) {
        finish(maxDuration);
        return;
      }

      const accel = 0.3 + tile.difficulty * 0.1;
      velRef.current.vx += tiltRef.current.tx * accel;
      velRef.current.vy += tiltRef.current.ty * accel;
      velRef.current.vx *= 0.92;
      velRef.current.vy *= 0.92;

      let newPx = posRef.current.px + velRef.current.vx;
      let newPy = posRef.current.py + velRef.current.vy;

      const cellX = Math.floor(newPx / CELL_SIZE);
      const cellY = Math.floor(newPy / CELL_SIZE);

      if (cellX >= 0 && cellX < GRID_W && cellY >= 0 && cellY < GRID_H) {
        const cell = maze[cellY][cellX];
        const localX = newPx - cellX * CELL_SIZE;
        const localY = newPy - cellY * CELL_SIZE;
        const radius = CELL_SIZE * 0.3;

        if (cell.walls.left && localX < radius) { newPx = cellX * CELL_SIZE + radius; velRef.current.vx = 0; }
        if (cell.walls.right && localX > CELL_SIZE - radius) { newPx = (cellX + 1) * CELL_SIZE - radius; velRef.current.vx = 0; }
        if (cell.walls.top && localY < radius) { newPy = cellY * CELL_SIZE + radius; velRef.current.vy = 0; }
        if (cell.walls.bottom && localY > CELL_SIZE - radius) { newPy = (cellY + 1) * CELL_SIZE - radius; velRef.current.vy = 0; }

        posRef.current = { px: newPx, py: newPy };
        setBallPx({ x: newPx, y: newPy });

        const gridX = Math.floor(newPx / CELL_SIZE);
        const gridY = Math.floor(newPy / CELL_SIZE);
        if (gridX !== ballPos.x || gridY !== ballPos.y) {
          setBallPos({ x: gridX, y: gridY });
        }

        if (gridX === GRID_W - 1 && gridY === GRID_H - 1) {
          finish(elapsed);
          return;
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPaused, isDone, maze, tile.difficulty, maxDuration, finish, ballPos]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full select-none"
      style={{ filter: isBlurred ? 'blur(8px)' : 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mb-2 text-sm text-cyan-300/70">Tilt to guide the ball to the exit (bottom-right)</div>
      <div
        className="relative bg-slate-900/80 rounded-lg"
        style={{ width: GRID_W * CELL_SIZE, height: GRID_H * CELL_SIZE }}
      >
        {maze.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className="absolute"
              style={{
                left: x * CELL_SIZE,
                top: y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderTop: cell.walls.top ? '2px solid #00dffc' : 'none',
                borderRight: cell.walls.right ? '2px solid #00dffc' : 'none',
                borderBottom: cell.walls.bottom ? '2px solid #00dffc' : 'none',
                borderLeft: cell.walls.left ? '2px solid #00dffc' : 'none',
              }}
            />
          ))
        )}
        <div
          className="absolute rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 transition-none"
          style={{
            width: CELL_SIZE * 0.6,
            height: CELL_SIZE * 0.6,
            left: ballPx.x - CELL_SIZE * 0.3,
            top: ballPx.y - CELL_SIZE * 0.3,
          }}
        />
        <div
          className="absolute rounded bg-green-400/30 border border-green-400"
          style={{
            left: (GRID_W - 1) * CELL_SIZE,
            top: (GRID_H - 1) * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
          }}
        />
      </div>
    </div>
  );
};

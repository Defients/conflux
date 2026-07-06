import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const CANVAS_W = 400;
const CANVAS_H = 300;
const PATH_POINTS = 40;

interface Point { x: number; y: number; }

function generateCirclePath(rng: SeededRNG): Point[] {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const rx = 120 + rng.nextFloat() * 20;
  const ry = 80 + rng.nextFloat() * 20;
  const points: Point[] = [];
  for (let i = 0; i < PATH_POINTS; i++) {
    const angle = (i / PATH_POINTS) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return points;
}

function generateZigzagPath(rng: SeededRNG): Point[] {
  const points: Point[] = [];
  const segments = 5;
  const segW = CANVAS_W / segments;
  for (let i = 0; i < PATH_POINTS; i++) {
    const t = i / PATH_POINTS;
    const segIdx = Math.floor(t * segments);
    const segT = (t * segments) % 1;
    const x = segIdx * segW + segT * segW;
    const y = CANVAS_H / 2 + (segIdx % 2 === 0 ? -60 : 60) * (1 - Math.abs(segT * 2 - 1));
    points.push({ x, y });
  }
  return points;
}

export const MirrorDraw: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`mirrordraw-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const pathPoints = useMemo<Point[]>(() => {
    return rng.nextFloat() > 0.5 ? generateCirclePath(rng) : generateZigzagPath(rng);
  }, [rng]);

  const [tracing, setTracing] = useState(false);
  const [completion, setCompletion] = useState(0);
  const completionRef = useRef(0);
  const visitedRef = useRef<Set<number>>(new Set());
  const isDoneRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    onComplete({ primaryMetric: completionRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  const getNearestPointIndex = (x: number, y: number): number => {
    let minDist = Infinity;
    let nearest = -1;
    for (let i = 0; i < pathPoints.length; i++) {
      const dx = pathPoints[i].x - x;
      const dy = pathPoints[i].y - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    return minDist < 1600 ? nearest : -1;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isDoneRef.current || !tracing || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const mirroredX = CANVAS_W - x;

    const idx = getNearestPointIndex(mirroredX, y);
    if (idx >= 0) {
      visitedRef.current.add(idx);
      const pct = (visitedRef.current.size / pathPoints.length) * 100;
      completionRef.current = pct;
      setCompletion(pct);
      if (pct >= 90) {
        finishEvent();
      }
    }
  };

  const pathD = useMemo(() => {
    return pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [pathPoints]);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Mirror Draw</h3>
        <p className="font-mono text-xl text-hyper-green">{completion.toFixed(0)}%</p>
      </div>

      <p className="text-sm text-gray-400 mb-4 mt-8">Trace the shape — but your cursor is mirrored horizontally!</p>

      <svg
        ref={svgRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="border-2 border-star-purple/30 rounded-lg bg-gray-900/30"
        onMouseDown={() => setTracing(true)}
        onMouseUp={() => setTracing(false)}
        onMouseLeave={() => setTracing(false)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onTouchStart={() => setTracing(true)}
        onTouchEnd={() => setTracing(false)}
        onTouchMove={(e) => {
          if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }}
        style={{ cursor: 'crosshair', touchAction: 'none' }}
      >
        <path d={pathD} fill="none" stroke="#6b21a8" strokeWidth="3" strokeDasharray="5,5" opacity={0.5} />
        <path
          d={pathD}
          fill="none"
          stroke="#00dffc"
          strokeWidth="4"
          strokeDasharray={pathD.length}
          strokeDashoffset={pathD.length * (1 - completion / 100)}
          style={{ transition: 'stroke-dashoffset 0.1s' }}
        />
      </svg>

      <p className="mt-4 text-sm text-gray-500">Hold mouse button and trace. Moving right draws left!</p>
    </div>
  );
};

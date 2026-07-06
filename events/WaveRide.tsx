import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const CANVAS_W = 400;
const CANVAS_H = 300;
const BAND_HEIGHT = 30;

export const WaveRide: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`waveride-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [pct, setPct] = useState(0);
  const [markerY, setMarkerY] = useState(CANVAS_H / 2);
  const pctRef = useRef(0);
  const markerYRef = useRef(CANVAS_H / 2);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const isDoneRef = useRef(false);
  const inputRef = useRef(0);

  const amplitude = 60 + tile.difficulty * 15;
  const frequency = 0.015 + tile.difficulty * 0.005;
  const freqChange = rng.nextFloat() * 0.003;

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onComplete({ primaryMetric: pctRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    if (isPaused) return;
    startTimeRef.current = performance.now();
    let onWaveFrames = 0;
    let totalFrames = 0;

    const animate = () => {
      if (isDoneRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const t = elapsed * 0.001;

      const centerY = CANVAS_H / 2 + Math.sin(t * (frequency + freqChange) * 60) * (amplitude * 0.3);
      const waveY = centerY + Math.sin(elapsed * frequency) * amplitude;

      markerYRef.current += inputRef.current * 3;
      markerYRef.current = Math.max(0, Math.min(CANVAS_H, markerYRef.current));
      inputRef.current *= 0.7;
      setMarkerY(markerYRef.current);

      const dist = Math.abs(markerYRef.current - waveY);
      totalFrames++;
      if (dist <= BAND_HEIGHT / 2) onWaveFrames++;

      pctRef.current = totalFrames > 0 ? (onWaveFrames / totalFrames) * 100 : 0;
      setPct(pctRef.current);

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused, amplitude, frequency, freqChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current = -1;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current = 1;
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scaleY = CANVAS_H / rect.height;
    markerYRef.current = (e.clientY - rect.top) * scaleY;
    setMarkerY(markerYRef.current);
  };

  const elapsed = performance.now() - startTimeRef.current;
  const waveY = CANVAS_H / 2 + Math.sin(elapsed * frequency) * amplitude;

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Wave Ride</h3>
        <p className="font-mono text-xl text-hyper-green">{pct.toFixed(0)}% on wave</p>
      </div>

      <p className="text-sm text-gray-400 mb-4 mt-8">Keep your marker on the wave!</p>

      <div
        className="relative border-2 border-star-purple/30 rounded-lg bg-gray-900/30 overflow-hidden"
        style={{ width: CANVAS_W, height: CANVAS_H }}
        onMouseMove={handleMouseMove}
      >
        <svg width={CANVAS_W} height={CANVAS_H} className="absolute inset-0">
          <path
            d={`M 0 ${waveY} ${Array.from({ length: CANVAS_W }, (_, x) => `L ${x} ${CANVAS_H / 2 + Math.sin((elapsed + x * 10) * frequency) * amplitude}`).join(' ')}`}
            fill="none"
            stroke="#00dffc"
            strokeWidth="2"
            opacity="0.5"
          />
          <rect
            x={0}
            y={waveY - BAND_HEIGHT / 2}
            width={CANVAS_W}
            height={BAND_HEIGHT}
            fill="#00dffc22"
          />
        </svg>
        <div
          className="absolute w-4 h-4 rounded-full bg-solar-orange"
          style={{
            left: CANVAS_W / 2 - 8,
            top: markerY - 8,
            boxShadow: '0 0 10px #ff8c42',
            transition: 'none',
          }}
        />
      </div>

      <p className="mt-4 text-sm text-gray-500">Mouse or ↑ ↓ keys to move</p>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const ROUNDS = 3;

export const DialLock: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`diallock-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [angle, setAngle] = useState(0);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'play' | 'feedback'>('play');
  const [errors, setErrors] = useState<number[]>([]);
  const [lastError, setLastError] = useState<number | null>(null);
  const angleRef = useRef(0);
  const isDoneRef = useRef(false);
  const errorsRef = useRef<number[]>([]);
  const draggingRef = useRef(false);

  const targets = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      arr.push(rng.nextInt(0, 360));
    }
    return arr;
  }, [rng]);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    const totalError = errorsRef.current.reduce((a, b) => a + b, 0);
    onComplete({ primaryMetric: totalError });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  const getWarmthColor = (currentAngle: number, targetAngle: number) => {
    let diff = Math.abs(currentAngle - targetAngle);
    diff = Math.min(diff, 360 - diff);
    const ratio = 1 - diff / 180;
    const r = Math.round(255 * ratio + 30 * (1 - ratio));
    const g = Math.round(50 * ratio + 100 * (1 - ratio));
    const b = Math.round(50 * ratio + 200 * (1 - ratio));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleConfirm = useCallback(() => {
    if (phase !== 'play' || isDoneRef.current) return;
    let diff = Math.abs(angleRef.current - targets[round]);
    diff = Math.min(diff, 360 - diff);
    errorsRef.current.push(diff);
    setErrors([...errorsRef.current]);
    setLastError(diff);
    setPhase('feedback');

    setTimeout(() => {
      if (round + 1 >= ROUNDS) {
        finishEvent();
      } else {
        setRound(r => r + 1);
        angleRef.current = 0;
        setAngle(0);
        setPhase('play');
        setLastError(null);
      }
    }, 1500);
  }, [phase, round, targets, finishEvent]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isDoneRef.current) return;
      if (e.code === 'ArrowLeft') {
        angleRef.current = (angleRef.current - 3 + 360) % 360;
        setAngle(angleRef.current);
      } else if (e.code === 'ArrowRight') {
        angleRef.current = (angleRef.current + 3) % 360;
        setAngle(angleRef.current);
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleConfirm]);

  const handleMouseDown = () => { draggingRef.current = true; };
  const handleMouseUp = () => { draggingRef.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current || isDoneRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const newAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    angleRef.current = newAngle;
    setAngle(newAngle);
  };

  const warmth = getWarmthColor(angle, targets[round]);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Dial Lock</h3>
        <p className="text-sm text-gray-400">Round {Math.min(round + 1, ROUNDS)} / {ROUNDS} — Find the unlock position</p>
      </div>

      <div
        className="relative mt-8"
        style={{ width: 200, height: 200 }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute inset-0 rounded-full border-4 transition-colors duration-100"
          style={{ borderColor: warmth, boxShadow: `0 0 20px ${warmth}` }}
        />
        <div
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 4,
            height: 90,
            marginLeft: -2,
            marginTop: -90,
            backgroundColor: warmth,
            borderRadius: 2,
            transform: `rotate(${angle}deg)`,
            transformOrigin: 'bottom center',
          }}
        />
        <div className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />
      </div>

      <p className="mt-4 text-lg text-gray-400">
        Drag or use ← → keys. Press Enter to confirm.
      </p>

      {phase === 'feedback' && lastError !== null && (
        <p className={`mt-2 text-2xl font-bold ${lastError <= 5 ? 'text-hyper-green' : lastError <= 15 ? 'text-solar-orange' : 'text-nebula-pink'}`}>
          {lastError <= 5 ? 'Perfect!' : lastError <= 15 ? 'Close!' : 'Off!'} ({lastError.toFixed(0)}°)
        </p>
      )}

      <div className="mt-4 flex gap-4">
        {errors.map((e, i) => (
          <div key={i} className="text-center">
            <p className="text-xs text-gray-500">R{i + 1}</p>
            <p className={`font-mono font-bold ${e <= 5 ? 'text-hyper-green' : e <= 15 ? 'text-solar-orange' : 'text-nebula-pink'}`}>
              {e.toFixed(0)}°
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

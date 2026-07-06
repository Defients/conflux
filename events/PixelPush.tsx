import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const ROUNDS = 3;
const TRACK_WIDTH = 400;
const TARGET_WIDTH = 60;
const FRICTION = 0.92;
const FORCE = 0.5;

interface RoundResult {
  stoppedInZone: boolean;
  distanceFromCenter: number;
}

export const PixelPush: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`pixelpush-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState(TRACK_WIDTH / 2);
  const [phase, setPhase] = useState<'play' | 'feedback'>('play');
  const [results, setResults] = useState<RoundResult[]>([]);
  const [targetCenter, setTargetCenter] = useState(200);
  const posRef = useRef(TRACK_WIDTH / 2);
  const velRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isDoneRef = useRef(false);
  const resultsRef = useRef<RoundResult[]>([]);
  const settlingRef = useRef(false);

  const setupRound = useCallback((roundIdx: number) => {
    const center = rng.nextInt(80, TRACK_WIDTH - 80);
    setTargetCenter(center);
    posRef.current = TRACK_WIDTH / 2;
    velRef.current = 0;
    setPos(TRACK_WIDTH / 2);
    setPhase('play');
    settlingRef.current = false;
  }, [rng]);

  useEffect(() => {
    setupRound(0);
  }, [setupRound]);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const successCount = resultsRef.current.filter(r => r.stoppedInZone).length;
    onComplete({ primaryMetric: successCount });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    if (isPaused) return;
    const animate = () => {
      if (settlingRef.current) {
        velRef.current *= FRICTION;
        posRef.current += velRef.current;
        if (posRef.current < 0) { posRef.current = 0; velRef.current = 0; }
        if (posRef.current > TRACK_WIDTH) { posRef.current = TRACK_WIDTH; velRef.current = 0; }
        setPos(posRef.current);
        if (Math.abs(velRef.current) < 0.1) {
          settlingRef.current = false;
          const dist = Math.abs(posRef.current - targetCenter);
          const inZone = dist <= TARGET_WIDTH / 2;
          resultsRef.current.push({ stoppedInZone: inZone, distanceFromCenter: dist });
          setResults([...resultsRef.current]);
          setPhase('feedback');
          setTimeout(() => {
            if (round + 1 >= ROUNDS) {
              finishEvent();
            } else {
              setRound(r => r + 1);
              setupRound(round + 1);
            }
          }, 1500);
        }
      }
      if (!isDoneRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused, round, targetCenter, setupRound, finishEvent]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isDoneRef.current || phase !== 'play' || settlingRef.current) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      velRef.current -= FORCE;
      settlingRef.current = true;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      velRef.current += FORCE;
      settlingRef.current = true;
    }
  }, [phase]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Pixel Push</h3>
        <p className="text-sm text-gray-400">Round {Math.min(round + 1, ROUNDS)} / {ROUNDS} — Stop in the target zone</p>
      </div>

      <div className="mt-12 relative" style={{ width: TRACK_WIDTH, height: 60 }}>
        <div className="absolute inset-0 bg-gray-800 rounded-lg border-2 border-gray-700" />
        <div
          className="absolute rounded-lg border-2 border-hyper-green/60 bg-hyper-green/20"
          style={{ left: targetCenter - TARGET_WIDTH / 2, width: TARGET_WIDTH, height: '100%' }}
        />
        <div
          className="absolute w-6 h-6 rounded-full bg-galaxy-cyan"
          style={{
            left: pos - 12,
            top: '50%',
            marginTop: -12,
            boxShadow: '0 0 10px #00dffc',
            transition: 'none',
          }}
        />
      </div>

      <p className="mt-4 text-lg text-gray-400">
        Use ← → to push the block. It has momentum!
      </p>

      {phase === 'feedback' && results.length > 0 && (
        <p className={`mt-2 text-2xl font-bold ${results[results.length - 1].stoppedInZone ? 'text-hyper-green' : 'text-nebula-pink'}`}>
          {results[results.length - 1].stoppedInZone ? 'In the zone!' : 'Missed!'}
        </p>
      )}

      <div className="mt-4 flex gap-4">
        {results.map((r, i) => (
          <div key={i} className="text-center">
            <p className="text-xs text-gray-500">R{i + 1}</p>
            <p className={`font-bold ${r.stoppedInZone ? 'text-hyper-green' : 'text-nebula-pink'}`}>
              {r.stoppedInZone ? '✓' : '✗'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

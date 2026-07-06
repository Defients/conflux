import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const ROUNDS = 3;

export const StopTheClock: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`stopclock-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [round, setRound] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [target, setTarget] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [phase, setPhase] = useState<'show' | 'run' | 'done'>('show');
  const [feedback, setFeedback] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const isDoneRef = useRef(false);
  const resultsRef = useRef<number[]>([]);

  const targets = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      arr.push(rng.nextInt(2000, 6000));
    }
    return arr;
  }, [rng]);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    const validResults = resultsRef.current.filter(r => r >= 0);
    const avgError = validResults.length > 0
      ? validResults.reduce((a, b) => a + b, 0) / validResults.length
      : 9999;
    onComplete({ primaryMetric: avgError });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    if (phase === 'show' && round < ROUNDS) {
      setTarget(targets[round]);
      const t = setTimeout(() => {
        setPhase('run');
        startTimeRef.current = performance.now();
      }, 1500);
      return () => clearTimeout(t);
    } else if (phase === 'show' && round >= ROUNDS) {
      finishEvent();
    }
  }, [phase, round, targets, finishEvent]);

  useEffect(() => {
    if (phase === 'run') {
      const animate = () => {
        const elapsed = performance.now() - startTimeRef.current;
        setDisplayTime(elapsed);
        if (elapsed < 10000) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [phase]);

  const handleStop = useCallback(() => {
    if (phase !== 'run' || isDoneRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const elapsed = performance.now() - startTimeRef.current;
    const error = Math.abs(elapsed - target);
    resultsRef.current.push(error);
    setResults([...resultsRef.current]);
    setFeedback(`Error: ${error.toFixed(0)}ms`);
    setPhase('done');

    setTimeout(() => {
      setFeedback(null);
      setRound(r => r + 1);
      setPhase('show');
    }, 1500);
  }, [phase, target]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleStop]);

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none cursor-pointer ${isBlurred ? 'filter blur-md' : ''}`}
      onClick={handleStop}
    >
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Stop the Clock!</h3>
        <p className="text-sm text-gray-400">Round {Math.min(round + 1, ROUNDS)} / {ROUNDS}</p>
      </div>

      {phase === 'show' && round < ROUNDS && (
        <div className="text-center">
          <p className="text-lg text-gray-400 mb-2">Target:</p>
          <p className="text-6xl font-black text-hyper-green font-mono">{(target / 1000).toFixed(3)}s</p>
        </div>
      )}

      {phase === 'run' && (
        <div className="text-center">
          <p className="text-lg text-gray-400 mb-2">Click or Space to STOP!</p>
          <p className="text-6xl font-black text-galaxy-cyan font-mono">{(displayTime / 1000).toFixed(3)}s</p>
        </div>
      )}

      {phase === 'done' && feedback && (
        <div className="text-center">
          <p className="text-4xl font-bold text-solar-orange">{feedback}</p>
        </div>
      )}

      {round >= ROUNDS && phase === 'show' && (
        <div className="text-center">
          <p className="text-2xl text-gray-400">Calculating...</p>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        {results.map((r, i) => (
          <div key={i} className="text-center">
            <p className="text-xs text-gray-500">R{i + 1}</p>
            <p className={`font-mono font-bold ${r <= 50 ? 'text-hyper-green' : r <= 150 ? 'text-solar-orange' : 'text-nebula-pink'}`}>
              {r.toFixed(0)}ms
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

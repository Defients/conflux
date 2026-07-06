import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const COLORS = [
  { name: 'red', value: '#ef4444' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'green', value: '#22c55e' },
  { name: 'yellow', value: '#eabf08' },
];

interface Orb {
  id: number;
  colorIndex: number;
  y: number;
  sorted: boolean;
  wrong: boolean;
}

export const ColorSort: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`colorsort-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const scoreRef = useRef(0);
  const totalRef = useRef(0);
  const isDoneRef = useRef(false);
  const orbsRef = useRef<Orb[]>([]);
  const nextIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fallSpeed = 0.4 + tile.difficulty * 0.15;
  const spawnInterval = 2000 - tile.difficulty * 300;

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    onComplete({ primaryMetric: scoreRef.current, secondaryMetric: totalRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  const spawnOrb = useCallback(() => {
    if (isDoneRef.current) return;
    const orb: Orb = {
      id: nextIdRef.current++,
      colorIndex: rng.nextInt(0, COLORS.length),
      y: 0,
      sorted: false,
      wrong: false,
    };
    orbsRef.current = [...orbsRef.current, orb];
    setOrbs(orbsRef.current);
    totalRef.current++;
    setTotal(totalRef.current);
    if (!isDoneRef.current) {
      spawnTimerRef.current = setTimeout(spawnOrb, spawnInterval);
    }
  }, [rng, spawnInterval]);

  useEffect(() => {
    if (isPaused) return;
    const startTimer = setTimeout(spawnOrb, 800);
    return () => clearTimeout(startTimer);
  }, [spawnOrb, isPaused]);

  useEffect(() => {
    if (isPaused || isDoneRef.current) return;
    const animate = () => {
      let escaped = false;
      orbsRef.current = orbsRef.current.map(o => {
        if (o.sorted || o.wrong) return o;
        const newY = o.y + fallSpeed;
        if (newY >= 80) {
          escaped = true;
          return { ...o, y: 80, wrong: true };
        }
        return { ...o, y: newY };
      });
      if (escaped) setFeedback('incorrect');
      setTimeout(() => setFeedback(null), 200);
      setOrbs([...orbsRef.current]);
      if (!isDoneRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused, fallSpeed]);

  const handleSort = (colorIndex: number) => {
    if (isDoneRef.current) return;
    const activeOrbs = orbsRef.current.filter(o => !o.sorted && !o.wrong);
    if (activeOrbs.length === 0) return;
    const lowest = activeOrbs.reduce((min, o) => o.y > min.y ? o : min, activeOrbs[0]);

    if (lowest.colorIndex === colorIndex) {
      lowest.sorted = true;
      scoreRef.current++;
      setScore(scoreRef.current);
      setFeedback('correct');
    } else {
      lowest.wrong = true;
      setFeedback('incorrect');
    }
    setOrbs([...orbsRef.current]);
    setTimeout(() => setFeedback(null), 200);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-start p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Color Sort</h3>
        <p className="font-mono text-xl text-hyper-green">Sorted: {score} / {total}</p>
      </div>

      <div className="relative w-full max-w-md h-[50vh] mt-16 overflow-hidden border-2 border-star-purple/30 rounded-lg">
        {orbs.filter(o => !o.sorted && !o.wrong).map(o => (
          <div
            key={o.id}
            className="absolute w-12 h-12 rounded-full"
            style={{
              left: '50%',
              marginLeft: -24,
              top: `${o.y}%`,
              backgroundColor: COLORS[o.colorIndex].value,
              boxShadow: `0 0 10px ${COLORS[o.colorIndex].value}88`,
            }}
          />
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        {COLORS.map((c, i) => (
          <button
            key={i}
            onClick={() => handleSort(i)}
            className="w-16 h-16 rounded-lg border-2 transition-all hover:scale-105"
            style={{
              backgroundColor: c.value,
              borderColor: c.value,
              boxShadow: `0 0 8px ${c.value}66`,
            }}
          />
        ))}
      </div>

      <div className="mt-2 text-xl font-bold h-6">
        {feedback === 'correct' && <span className="text-hyper-green">Sorted!</span>}
        {feedback === 'incorrect' && <span className="text-nebula-pink">Wrong!</span>}
      </div>
    </div>
  );
};

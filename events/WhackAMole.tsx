import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

interface Mole {
  index: number;
  upAt: number;
  duration: number;
  hit: boolean;
}

export const WhackAMole: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`whackamole-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [activeMole, setActiveMole] = useState<Mole | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null);
  const scoreRef = useRef(0);
  const totalRef = useRef(0);
  const isDoneRef = useRef(false);
  const moleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMoleRef = useRef<Mole | null>(null);

  const moleDuration = 1200 - tile.difficulty * 200;
  const spawnInterval = 700 - tile.difficulty * 100;

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    onComplete({ primaryMetric: scoreRef.current, secondaryMetric: totalRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  const spawnMole = useCallback(() => {
    if (isDoneRef.current) return;
    const index = rng.nextInt(0, 9);
    const mole: Mole = { index, upAt: performance.now(), duration: moleDuration, hit: false };
    activeMoleRef.current = mole;
    setActiveMole(mole);
    totalRef.current++;
    setTotal(totalRef.current);

    moleTimerRef.current = setTimeout(() => {
      if (activeMoleRef.current === mole && !mole.hit) {
        setFeedback('miss');
        setTimeout(() => setFeedback(null), 200);
      }
      activeMoleRef.current = null;
      setActiveMole(null);
      if (!isDoneRef.current) {
        moleTimerRef.current = setTimeout(spawnMole, spawnInterval);
      }
    }, moleDuration);
  }, [moleDuration, spawnInterval, rng]);

  useEffect(() => {
    if (isPaused) return;
    const startTimer = setTimeout(spawnMole, 500);
    return () => {
      clearTimeout(startTimer);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    };
  }, [spawnMole, isPaused]);

  const handleWhack = (index: number) => {
    if (isDoneRef.current) return;
    const mole = activeMoleRef.current;
    if (mole && mole.index === index && !mole.hit) {
      mole.hit = true;
      scoreRef.current++;
      setScore(scoreRef.current);
      setFeedback('hit');
      setTimeout(() => setFeedback(null), 200);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
      activeMoleRef.current = null;
      setActiveMole(null);
      moleTimerRef.current = setTimeout(spawnMole, spawnInterval);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isDoneRef.current || isPaused) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        handleWhack(num - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPaused]);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Whack-a-Mole!</h3>
        <p className="font-mono text-xl text-hyper-green">Hits: {score} / {total}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            onClick={() => handleWhack(i)}
            className="w-24 h-24 rounded-full bg-gray-800 border-4 border-gray-700 flex items-center justify-center cursor-pointer transition-all duration-100 hover:border-gray-600"
            aria-label={`Hole ${i + 1}`}
          >
            {activeMole?.index === i && (
              <div className="w-16 h-16 rounded-full bg-solar-orange animate-bounce" style={{ boxShadow: '0 0 15px #ff8c42' }} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-2xl font-bold h-8">
        {feedback === 'hit' && <span className="text-hyper-green">Whacked!</span>}
        {feedback === 'miss' && <span className="text-nebula-pink">Missed!</span>}
      </div>
    </div>
  );
};

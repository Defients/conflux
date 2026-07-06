import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

interface FallingWord {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  destroyed: boolean;
}

const WORD_BANK = [
  'orbit', 'nebula', 'comet', 'pulsar', 'quasar', 'galaxy', 'photon', 'plasma',
  'vector', 'matrix', 'binary', 'cipher', 'kernel', 'syntax', 'buffer', 'packet',
  'signal', 'module', 'thread', 'stream', 'cache', 'proxy', 'daemon', 'socket',
  'cosmic', 'stellar', 'vortex', 'fusion', 'beacon', 'helix', 'quantum', 'prism',
];

export const WordStorm: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`wordstorm-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [words, setWords] = useState<FallingWord[]>([]);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null);
  const scoreRef = useRef(0);
  const totalRef = useRef(0);
  const isDoneRef = useRef(false);
  const wordsRef = useRef<FallingWord[]>([]);
  const nextIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fallSpeed = 0.3 + tile.difficulty * 0.15;
  const spawnInterval = 2500 - tile.difficulty * 400;
  const maxWords = 3 + tile.difficulty;

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

  const spawnWord = useCallback(() => {
    if (isDoneRef.current) return;
    const activeCount = wordsRef.current.filter(w => !w.destroyed).length;
    if (activeCount < maxWords) {
      const text = WORD_BANK[rng.nextInt(0, WORD_BANK.length)];
      const word: FallingWord = {
        id: nextIdRef.current++,
        text,
        x: 10 + rng.nextFloat() * 80,
        y: 0,
        speed: fallSpeed * (0.8 + rng.nextFloat() * 0.4),
        destroyed: false,
      };
      wordsRef.current = [...wordsRef.current, word];
      setWords(wordsRef.current);
      totalRef.current++;
      setTotal(totalRef.current);
    }
    if (!isDoneRef.current) {
      spawnTimerRef.current = setTimeout(spawnWord, spawnInterval);
    }
  }, [fallSpeed, maxWords, rng, spawnInterval]);

  useEffect(() => {
    if (isPaused) return;
    const startTimer = setTimeout(spawnWord, 800);
    return () => clearTimeout(startTimer);
  }, [spawnWord, isPaused]);

  useEffect(() => {
    if (isPaused || isDoneRef.current) return;
    const animate = () => {
      let escaped = false;
      wordsRef.current = wordsRef.current.map(w => {
        if (w.destroyed) return w;
        const newY = w.y + w.speed;
        if (newY >= 100) {
          escaped = true;
          return { ...w, destroyed: true, y: 100 };
        }
        return { ...w, y: newY };
      });
      if (escaped) setFeedback('miss');
      setTimeout(() => setFeedback(null), 200);
      setWords([...wordsRef.current]);
      if (!isDoneRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDoneRef.current || !input.trim()) return;

    const typed = input.trim().toLowerCase();
    const target = wordsRef.current.find(w => !w.destroyed && w.text === typed);

    if (target) {
      target.destroyed = true;
      scoreRef.current++;
      setScore(scoreRef.current);
      setFeedback('hit');
      setWords([...wordsRef.current]);
    } else {
      setFeedback('miss');
    }
    setInput('');
    setTimeout(() => setFeedback(null), 200);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-start p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Word Storm!</h3>
        <p className="font-mono text-xl text-hyper-green">Destroyed: {score} / {total}</p>
      </div>

      <div className="relative w-full max-w-2xl h-[60vh] mt-16 overflow-hidden border-2 border-star-purple/30 rounded-lg">
        {words.filter(w => !w.destroyed).map(w => (
          <div
            key={w.id}
            className="absolute text-2xl font-bold font-mono text-galaxy-cyan transition-none"
            style={{ left: `${w.x}%`, top: `${w.y}%` }}
          >
            {w.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 w-full max-w-xs">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full p-3 text-center text-xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
          autoComplete="off"
          placeholder="Type a word..."
        />
      </form>

      <div className="mt-2 text-xl font-bold h-6">
        {feedback === 'hit' && <span className="text-hyper-green">Destroyed!</span>}
        {feedback === 'miss' && <span className="text-nebula-pink">Missed!</span>}
      </div>
    </div>
  );
};

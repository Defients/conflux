import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const WORDS = [
  'planet', 'rocket', 'system', 'energy', 'signal', 'cosmic', 'galaxy', 'nebula',
  'binary', 'kernel', 'module', 'vector', 'matrix', 'cipher', 'syntax', 'buffer',
  'photon', 'plasma', 'quasar', 'pulsar', 'beacon', 'helix', 'prism', 'fusion',
  'orbit', 'comet', 'lunar', 'solar', 'nova', 'void', 'flux', 'warp',
];

function scramble(word: string, rng: SeededRNG): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  if (result === word) return scramble(word, rng);
  return result;
}

export const AnagramRush: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`anagram-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [scrambled, setScrambled] = useState('');
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const scoreRef = useRef(0);
  const isDoneRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentWordRef = useRef('');

  const wordLen = 4 + tile.difficulty;

  const nextWord = useCallback(() => {
    const candidates = WORDS.filter(w => w.length >= wordLen && w.length <= wordLen + 2);
    const word = candidates[rng.nextInt(0, candidates.length)] || WORDS[rng.nextInt(0, WORDS.length)];
    currentWordRef.current = word;
    setScrambled(scramble(word, rng));
    setAnswer('');
  }, [rng, wordLen]);

  useEffect(() => {
    nextWord();
  }, [nextWord]);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    onComplete({ primaryMetric: scoreRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [scrambled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDoneRef.current || !answer.trim()) return;

    if (answer.trim().toLowerCase() === currentWordRef.current) {
      scoreRef.current++;
      setScore(scoreRef.current);
      setFeedback('correct');
      nextWord();
    } else {
      setFeedback('incorrect');
      setAnswer('');
    }
    setTimeout(() => setFeedback(null), 300);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Anagram Rush!</h3>
        <p className="font-mono text-xl text-hyper-green">Solved: {score}</p>
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-gray-400 mb-2">Unscramble this word:</p>
        <div className={`p-6 rounded-lg border-2 transition-colors duration-200 ${feedback === 'correct' ? 'bg-hyper-green/20 border-hyper-green' : feedback === 'incorrect' ? 'bg-nebula-pink/20 border-nebula-pink' : 'border-star-purple'}`}>
          <p className="text-5xl font-black text-white font-mono tracking-[0.2em] uppercase">{scrambled}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full max-w-xs p-4 text-center text-2xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
            autoComplete="off"
            placeholder="Type the word..."
          />
        </form>
      </div>
    </div>
  );
};

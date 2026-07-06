import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const WORDS = [
  'QUANTUM', 'NEBULA', 'CIRCUIT', 'PROTOCOL', 'COSMIC', 'MATRIX',
  'FREQUENCY', 'SIGNAL', 'ORBIT', 'PAYLOAD', 'ENCRYPT', 'BANDWIDTH',
  'KERNEL', 'PROXY', 'BYPASS', 'FIREWALL', 'BINARY', 'CIPHER',
  'VECTOR', 'FRAGMENT', 'STREAM', 'PULSE', 'NEXUS', 'GRID',
];

function scramble(word: string, rng: SeededRNG): string {
  const arr = word.split('');
  let scrambled: string[];
  do {
    scrambled = rng.shuffle(arr);
  } while (scrambled.join('') === word && word.length > 1);
  return scrambled.join('');
}

export const WordScramble: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const [words, setWords] = useState<{ original: string; scrambled: string }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState('');
  const [solvedCount, setSolvedCount] = useState(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const isDoneRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(Date.now());

  const maxDuration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
  const wordCount = 3 + tile.difficulty;

  const finish = useCallback((totalSolved: number) => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    setTimeout(() => onComplete({ primaryMetric: totalSolved }), 400);
  }, [onComplete]);

  useEffect(() => {
    const rng = new SeededRNG(`wordscramble-${settings.seed}-${tile.tileIndex}`);
    const selected: string[] = [];
    const available = [...WORDS];
    for (let i = 0; i < wordCount; i++) {
      const idx = rng.nextInt(0, available.length);
      selected.push(available.splice(idx, 1)[0]);
    }
    setWords(selected.map(w => ({ original: w, scrambled: scramble(w, rng) })));
  }, [settings.seed, tile.tileIndex, wordCount]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => finish(solvedCount), maxDuration);
    return () => clearTimeout(timer);
  }, [isPaused, solvedCount, maxDuration, finish]);

  useEffect(() => {
    if (words.length > 0 && !isDoneRef.current) {
      inputRef.current?.focus();
    }
  }, [words, currentIdx]);

  const handleSubmit = useCallback(() => {
    if (isDoneRef.current || currentIdx >= words.length) return;
    const current = words[currentIdx];
    if (input.toUpperCase().trim() === current.original) {
      setFeedback('correct');
      setSolvedCount(prev => {
        const newCount = prev + 1;
        if (currentIdx + 1 >= words.length) {
          finish(newCount);
        }
        return newCount;
      });
      setTimeout(() => {
        setFeedback('none');
        setInput('');
        setCurrentIdx(prev => prev + 1);
      }, 300);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback('none'), 300);
      setInput('');
    }
  }, [input, currentIdx, words, finish]);

  if (words.length === 0) return null;

  const currentWord = words[currentIdx];

  return (
    <div
      className="flex flex-col items-center justify-center h-full select-none gap-4"
      style={{ filter: isBlurred ? 'blur(8px)' : 'none' }}
    >
      <div className="text-sm text-cyan-300/70">
        Unscramble the word! ({currentIdx}/{words.length} solved: {solvedCount})
      </div>

      {currentWord && (
        <>
          <div
            className="text-4xl font-bold tracking-[0.3em] transition-colors duration-200"
            style={{
              color: feedback === 'correct' ? '#39ff14' : feedback === 'wrong' ? '#ff2a75' : '#00dffc',
            }}
          >
            {currentWord.scrambled}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            disabled={isPaused}
            className="bg-slate-800/80 border-2 border-cyan-500/50 rounded-lg px-4 py-2 text-center text-xl font-mono uppercase text-white outline-none focus:border-cyan-400"
            placeholder="TYPE ANSWER"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />

          <button
            onClick={handleSubmit}
            disabled={isPaused || !input.trim()}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 rounded-lg text-white font-bold transition-colors"
          >
            SUBMIT
          </button>
        </>
      )}

      {currentIdx >= words.length && !currentWord && (
        <div className="text-2xl text-green-400 font-bold">All done!</div>
      )}
    </div>
  );
};

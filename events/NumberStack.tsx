import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

export const NumberStack: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`numberstack-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const sequenceLength = 4 + tile.difficulty;
  const [sequence] = useState<number[]>(() => {
    const arr: number[] = [];
    for (let i = 0; i < sequenceLength; i++) {
      arr.push(rng.nextInt(0, 10));
    }
    return arr;
  });
  const [phase, setPhase] = useState<'show' | 'input' | 'done'>('show');
  const [showIndex, setShowIndex] = useState(0);
  const [input, setInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const correctRef = useRef(0);
  const isDoneRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    onComplete({ primaryMetric: correctRef.current, secondaryMetric: sequenceLength });
  }, [onComplete, sequenceLength]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    if (phase !== 'show') return;
    if (showIndex >= sequence.length) {
      setPhase('input');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    const showTime = 800;
    const gapTime = 300;
    const timer = setTimeout(() => {
      setShowIndex(prev => prev + 1);
    }, showTime + gapTime);
    return () => clearTimeout(timer);
  }, [phase, showIndex, sequence.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDoneRef.current || phase !== 'input') return;

    const reverseIndex = sequence.length - 1 - input.length;
    const expected = sequence[reverseIndex];
    const typed = parseInt(input, 10);

    if (typed === expected) {
      correctRef.current++;
      setCorrectCount(correctRef.current);
      setFeedback('correct');
    } else {
      setFeedback('incorrect');
    }

    setInput('');

    if (input.length + 1 >= sequence.length) {
      setTimeout(() => {
        setPhase('done');
        finishEvent();
      }, 500);
    } else {
      setTimeout(() => setFeedback(null), 300);
    }
  };

  const showingNumber = phase === 'show' && showIndex < sequence.length ? sequence[showIndex] : null;
  const inputProgress = phase === 'input' ? input.length : 0;

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Number Stack</h3>
        <p className="text-sm text-gray-400">Type them in REVERSE order!</p>
      </div>

      {phase === 'show' && (
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400 mb-4">Memorize the sequence...</p>
          <p className="text-7xl font-black text-hyper-green font-mono">
            {showingNumber !== null ? showingNumber : ''}
          </p>
          <div className="mt-4 flex gap-1 justify-center">
            {sequence.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < showIndex ? 'bg-hyper-green' : 'bg-gray-700'}`}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'input' && (
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400 mb-4">Type the numbers in reverse order:</p>
          <div className="flex gap-2 justify-center mb-6">
            {sequence.map((_, i) => (
              <div
                key={i}
                className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-mono font-bold ${
                  i < inputProgress
                    ? (feedback === 'incorrect' && i === inputProgress - 1 ? 'border-nebula-pink text-nebula-pink' : 'border-hyper-green text-hyper-green')
                    : 'border-gray-700 text-gray-600'
                }`}
              >
                {i < inputProgress ? '✓' : '?'}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-32 p-4 text-center text-3xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
              autoComplete="off"
              placeholder="0-9"
            />
          </form>
        </div>
      )}

      {phase === 'done' && (
        <div className="text-center mt-8">
          <p className="text-4xl font-bold text-galaxy-cyan">
            {correctRef.current} / {sequenceLength} correct
          </p>
        </div>
      )}
    </div>
  );
};

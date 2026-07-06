import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const SYMBOLS = ['◆', '▲', '●', '■', '★', '✚', '◐', '✦', '▼', '◇', '△', '○', '□', '☆', '✛', '◑'];
const GRID_SIZE = 12;

export const SymbolMatch: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`symbolmatch-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const setCount = 3 + tile.difficulty;
  const [phase, setPhase] = useState<'show' | 'pick' | 'done'>('show');
  const [targetSet, setTargetSet] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [correctSel, setCorrectSel] = useState(0);
  const [wrongSel, setWrongSel] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const isDoneRef = useRef(false);
  const targetSetRef = useRef<string[]>([]);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    onComplete({ primaryMetric: correctRef.current, secondaryMetric: wrongRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    const shuffled = [...SYMBOLS];
    rng.shuffle(shuffled);
    const targets = shuffled.slice(0, setCount);
    targetSetRef.current = targets;
    setTargetSet(targets);

    const gridSymbols: string[] = [];
    const allSymbols = [...targets];
    while (allSymbols.length < GRID_SIZE) {
      const s = SYMBOLS[rng.nextInt(0, SYMBOLS.length)];
      if (!targets.includes(s) || allSymbols.filter(x => x === s).length < 2) {
        allSymbols.push(s);
      }
    }
    rng.shuffle(allSymbols);
    setGrid(allSymbols.slice(0, GRID_SIZE));
  }, [rng, setCount]);

  useEffect(() => {
    if (phase !== 'show') return;
    const timer = setTimeout(() => setPhase('pick'), 2500);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleSelect = (index: number) => {
    if (isDoneRef.current || phase !== 'pick' || selected.has(index)) return;

    const symbol = grid[index];
    const isTarget = targetSetRef.current.includes(symbol);
    const newSelected = new Set(selected);
    newSelected.add(index);
    setSelected(newSelected);

    if (isTarget) {
      correctRef.current++;
      setCorrectSel(correctRef.current);
      setFeedback('correct');
    } else {
      wrongRef.current++;
      setWrongSel(wrongRef.current);
      setFeedback('incorrect');
    }
    setTimeout(() => setFeedback(null), 200);

    if (correctRef.current >= setCount) {
      setTimeout(() => {
        setPhase('done');
        finishEvent();
      }, 300);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Symbol Match</h3>
        <p className="text-sm text-gray-400">
          {phase === 'show' ? 'Memorize these symbols!' : `Find all ${setCount} matching symbols`}
        </p>
        {phase === 'pick' && (
          <p className="font-mono text-lg">
            <span className="text-hyper-green">Correct: {correctSel}</span>
            {' / '}
            <span className="text-nebula-pink">Wrong: {wrongSel}</span>
          </p>
        )}
      </div>

      {phase === 'show' && (
        <div className="flex gap-4 mt-8">
          {targetSet.map((s, i) => (
            <div key={i} className="w-16 h-16 rounded-lg border-2 border-hyper-green/60 bg-hyper-green/10 flex items-center justify-center text-3xl text-hyper-green">
              {s}
            </div>
          ))}
        </div>
      )}

      {phase === 'pick' && (
        <div className="grid grid-cols-4 gap-3 mt-8">
          {grid.map((symbol, i) => (
            <div
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-3xl cursor-pointer transition-all duration-100 ${
                selected.has(i)
                  ? targetSetRef.current.includes(symbol)
                    ? 'border-hyper-green bg-hyper-green/20 text-hyper-green'
                    : 'border-nebula-pink bg-nebula-pink/20 text-nebula-pink'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              {symbol}
            </div>
          ))}
        </div>
      )}

      {phase === 'done' && (
        <div className="text-center mt-8">
          <p className="text-4xl font-bold text-galaxy-cyan">
            {correctRef.current} correct, {wrongRef.current} wrong
          </p>
        </div>
      )}
    </div>
  );
};

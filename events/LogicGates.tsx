import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Gate = 'AND' | 'OR' | 'NOT' | 'XOR';

interface Circuit {
  inputs: number[];
  gate: Gate;
  answer: number;
  text: string;
}

function computeCircuit(inputs: number[], gate: Gate): number {
  switch (gate) {
    case 'AND': return inputs.every(v => v === 1) ? 1 : 0;
    case 'OR': return inputs.some(v => v === 1) ? 1 : 0;
    case 'NOT': return inputs[0] === 1 ? 0 : 1;
    case 'XOR': return inputs.reduce((a, b) => a ^ b, 0);
  }
}

function generateCircuit(rng: SeededRNG, difficulty: number): Circuit {
  const gates: Gate[] = difficulty === 1
    ? ['AND', 'OR']
    : difficulty === 2
    ? ['AND', 'OR', 'NOT', 'XOR']
    : ['AND', 'OR', 'XOR'];

  const gate = gates[rng.nextInt(0, gates.length)];
  const inputCount = gate === 'NOT' ? 1 : (difficulty >= 2 ? 2 + rng.nextInt(0, 2) : 2);
  const inputs: number[] = [];
  for (let i = 0; i < inputCount; i++) {
    inputs.push(rng.nextInt(0, 2));
  }
  const answer = computeCircuit(inputs, gate);
  const text = gate === 'NOT'
    ? `NOT ${inputs[0]}`
    : `${inputs.join(' ')} ${gate}`;
  return { inputs, gate, answer, text };
}

export const LogicGates: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`logicgates-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [circuit, setCircuit] = useState<Circuit>(() => generateCircuit(rng, tile.difficulty));
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const scoreRef = useRef(0);
  const totalRef = useRef(0);
  const isDoneRef = useRef(false);

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    onComplete({ primaryMetric: scoreRef.current, secondaryMetric: totalRef.current });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  const handleAnswer = (value: number) => {
    if (isDoneRef.current) return;

    totalRef.current++;
    setTotal(totalRef.current);

    if (value === circuit.answer) {
      scoreRef.current++;
      setScore(scoreRef.current);
      setFeedback('correct');
    } else {
      setFeedback('incorrect');
    }

    setCircuit(generateCircuit(rng, tile.difficulty));
    setTimeout(() => setFeedback(null), 250);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Logic Gates</h3>
        <p className="font-mono text-xl text-hyper-green">Correct: {score} / {total}</p>
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-gray-400 mb-4">What is the output?</p>
        <div className={`p-8 rounded-lg border-2 transition-colors duration-200 ${feedback === 'correct' ? 'bg-hyper-green/20 border-hyper-green' : feedback === 'incorrect' ? 'bg-nebula-pink/20 border-nebula-pink' : 'border-star-purple'}`}>
          <p className="text-4xl font-black text-white font-mono tracking-wider">
            {circuit.text}
          </p>
          <p className="text-lg text-gray-400 mt-2">= ?</p>
        </div>

        <div className="flex gap-4 justify-center mt-6">
          <button
            onClick={() => handleAnswer(0)}
            className="w-20 h-20 rounded-lg border-2 border-nebula-pink/60 bg-nebula-pink/10 text-4xl font-black text-nebula-pink hover:bg-nebula-pink/20 transition-all"
          >
            0
          </button>
          <button
            onClick={() => handleAnswer(1)}
            className="w-20 h-20 rounded-lg border-2 border-hyper-green/60 bg-hyper-green/10 text-4xl font-black text-hyper-green hover:bg-hyper-green/20 transition-all"
          >
            1
          </button>
        </div>
      </div>
    </div>
  );
};

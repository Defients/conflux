import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const PADS = 4;
const PAD_COLORS = ['#00dffc', '#ff8c42', '#d64f8a', '#a78bfa'];
const SEQUENCE_LEN = 4 + 2; // 6 hits

export const DrumEcho: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const rng = useMemo(() => new SeededRNG(`drumecho-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
  const [sequence] = useState<number[]>(() => {
    const arr: number[] = [];
    for (let i = 0; i < SEQUENCE_LEN; i++) {
      arr.push(rng.nextInt(0, PADS));
    }
    return arr;
  });
  const [phase, setPhase] = useState<'demo' | 'play' | 'done'>('demo');
  const [demoIndex, setDemoIndex] = useState(-1);
  const [playIndex, setPlayIndex] = useState(0);
  const [activePad, setActivePad] = useState(-1);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const scoreRef = useRef(0);
  const isDoneRef = useRef(false);
  const playIndexRef = useRef(0);
  const beatTimesRef = useRef<number[]>([]);
  const playStartTimeRef = useRef(0);

  const bpm = 90 + tile.difficulty * 20;
  const beatInterval = 60000 / bpm;

  const finishEvent = useCallback(() => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    onComplete({ primaryMetric: scoreRef.current, secondaryMetric: SEQUENCE_LEN });
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timer = setTimeout(finishEvent, duration);
    return () => clearTimeout(timer);
  }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

  useEffect(() => {
    if (phase !== 'demo') return;
    let i = 0;
    const playNext = () => {
      if (i >= sequence.length) {
        setTimeout(() => {
          setPhase('play');
          playStartTimeRef.current = performance.now();
        }, beatInterval);
        return;
      }
      setDemoIndex(i);
      setActivePad(sequence[i]);
      setTimeout(() => setActivePad(-1), beatInterval * 0.6);
      i++;
      setTimeout(playNext, beatInterval);
    };
    const startTimer = setTimeout(playNext, 800);
    return () => clearTimeout(startTimer);
  }, [phase, sequence, beatInterval]);

  const handlePadPress = useCallback((padIndex: number) => {
    if (isDoneRef.current || phase !== 'play') return;

    const expected = sequence[playIndexRef.current];
    const now = performance.now();
    const expectedTime = playStartTimeRef.current + playIndexRef.current * beatInterval;
    const timingError = Math.abs(now - expectedTime);

    setActivePad(padIndex);
    setTimeout(() => setActivePad(-1), 150);

    if (padIndex === expected) {
      let points = 0;
      if (timingError < beatInterval * 0.1) points = 3;
      else if (timingError < beatInterval * 0.25) points = 2;
      else if (timingError < beatInterval * 0.5) points = 1;
      scoreRef.current += points;
      setScore(scoreRef.current);
      setFeedback('good');
    } else {
      setFeedback('bad');
    }

    playIndexRef.current++;
    setPlayIndex(playIndexRef.current);

    if (playIndexRef.current >= sequence.length) {
      setTimeout(() => {
        setPhase('done');
        finishEvent();
      }, 500);
    } else {
      setTimeout(() => setFeedback(null), 200);
    }
  }, [phase, sequence, beatInterval, finishEvent]);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
      <div className="absolute top-4 text-center z-10">
        <h3 className="text-2xl font-bold text-galaxy-cyan">Drum Echo</h3>
        <p className="text-sm text-gray-400">
          {phase === 'demo' ? `Watch the pattern... (${demoIndex + 1}/${sequence.length})` : phase === 'play' ? `Repeat it! (${playIndex}/${sequence.length})` : 'Done!'}
        </p>
        <p className="font-mono text-lg text-hyper-green">Score: {score}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        {Array.from({ length: PADS }, (_, i) => (
          <div
            key={i}
            onClick={() => handlePadPress(i)}
            className="w-28 h-28 rounded-2xl border-4 flex items-center justify-center text-4xl font-bold cursor-pointer transition-all duration-100"
            style={{
              backgroundColor: activePad === i ? PAD_COLORS[i] : `${PAD_COLORS[i]}33`,
              borderColor: activePad === i ? PAD_COLORS[i] : `${PAD_COLORS[i]}66`,
              boxShadow: activePad === i ? `0 0 20px ${PAD_COLORS[i]}` : 'none',
              color: activePad === i ? '#fff' : PAD_COLORS[i],
              opacity: phase === 'play' ? 1 : 0.6,
              pointerEvents: phase === 'play' ? 'auto' : 'none',
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="mt-6 text-2xl font-bold h-8">
        {feedback === 'good' && <span className="text-hyper-green">Good!</span>}
        {feedback === 'bad' && <span className="text-nebula-pink">Wrong pad!</span>}
      </div>

      {phase === 'done' && (
        <p className="mt-4 text-3xl font-bold text-galaxy-cyan">
          Score: {score} / {SEQUENCE_LEN * 3}
        </p>
      )}
    </div>
  );
};

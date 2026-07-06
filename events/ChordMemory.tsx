import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const NOTE_COLORS = [
  { id: 0, color: '#ff2a75', label: 'Red' },
  { id: 1, color: '#00dffc', label: 'Cyan' },
  { id: 2, color: '#39ff14', label: 'Green' },
  { id: 3, color: '#ffae42', label: 'Orange' },
  { id: 4, color: '#a77dff', label: 'Purple' },
];

export const ChordMemory: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userIndex, setUserIndex] = useState(0);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [phase, setPhase] = useState<'showing' | 'input' | 'done'>('showing');
  const [showIndex, setShowIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const isDoneRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const maxDuration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
  const initialLength = 2 + tile.difficulty;
  const maxRounds = 5;

  const finish = useCallback((totalCorrect: number) => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    setPhase('done');
    setTimeout(() => onComplete({ primaryMetric: totalCorrect }), 500);
  }, [onComplete]);

  useEffect(() => {
    const rng = new SeededRNG(`chord-${settings.seed}-${tile.tileIndex}`);
    const seq: number[] = [];
    for (let i = 0; i < initialLength + maxRounds; i++) {
      seq.push(rng.nextInt(0, NOTE_COLORS.length));
    }
    setSequence(seq);
  }, [settings.seed, tile.tileIndex, initialLength, maxRounds]);

  useEffect(() => {
    if (isPaused || phase !== 'showing' || sequence.length === 0) return;
    if (showIndex >= sequence.length) {
      setPhase('input');
      return;
    }

    const noteId = sequence[showIndex];
    const showDelay = 600 - tile.difficulty * 100;
    const timer1 = setTimeout(() => setActiveNote(noteId), 200);
    const timer2 = setTimeout(() => {
      setActiveNote(null);
      setShowIndex(prev => prev + 1);
    }, showDelay);

    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [phase, showIndex, sequence, tile.difficulty, isPaused]);

  useEffect(() => {
    if (isPaused || phase === 'done') return;
    const timer = setTimeout(() => finish(correctCount), maxDuration);
    return () => clearTimeout(timer);
  }, [isPaused, phase, correctCount, maxDuration, finish]);

  const handleNoteClick = (noteId: number) => {
    if (phase !== 'input' || isDoneRef.current) return;

    setActiveNote(noteId);
    setTimeout(() => setActiveNote(null), 200);

    const expectedNote = sequence[userIndex];
    if (noteId === expectedNote) {
      const newIndex = userIndex + 1;
      const newCorrect = correctCount + 1;
      setUserIndex(newIndex);
      setCorrectCount(newCorrect);

      if (newIndex >= sequence.length) {
        finish(newCorrect);
      }
    } else {
      finish(correctCount);
    }
  };

  const inputProgress = phase === 'input' ? `${userIndex}/${sequence.length}` : '';

  return (
    <div
      className="flex flex-col items-center justify-center h-full select-none gap-4"
      style={{ filter: isBlurred ? 'blur(8px)' : 'none' }}
    >
      <div className="text-sm text-cyan-300/70">
        {phase === 'showing' && 'Watch the sequence...'}
        {phase === 'input' && `Repeat the sequence! (${inputProgress})`}
        {phase === 'done' && 'Done!'}
      </div>

      <div className="grid grid-cols-5 gap-3">
        {NOTE_COLORS.map(note => (
          <button
            key={note.id}
            className="w-16 h-16 rounded-lg transition-all duration-150 active:scale-95"
            style={{
              backgroundColor: activeNote === note.id ? note.color : `${note.color}30`,
              boxShadow: activeNote === note.id ? `0 0 24px ${note.color}` : 'none',
              border: `2px solid ${note.color}`,
            }}
            onClick={() => handleNoteClick(note.id)}
            disabled={phase !== 'input'}
          />
        ))}
      </div>

      {phase === 'showing' && (
        <div className="flex gap-1 mt-2">
          {sequence.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: i < showIndex ? '#00dffc' : '#ffffff20' }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

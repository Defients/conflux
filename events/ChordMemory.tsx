import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';
import { audioService } from '../services/audioService';

const NOTE_COLORS = [
  { id: 0, color: '#ff2a75', label: 'Red', freq: 261.63 },
  { id: 1, color: '#00dffc', label: 'Cyan', freq: 329.63 },
  { id: 2, color: '#39ff14', label: 'Green', freq: 392.00 },
  { id: 3, color: '#ffae42', label: 'Orange', freq: 493.88 },
  { id: 4, color: '#a77dff', label: 'Purple', freq: 587.33 },
];

export const ChordMemory: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred, isPaused }) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [roundLength, setRoundLength] = useState(3);
  const [userIndex, setUserIndex] = useState(0);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [phase, setPhase] = useState<'showing' | 'input' | 'done'>('showing');
  const [showIndex, setShowIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const isDoneRef = useRef(false);

  const maxDuration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
  const initialLength = 2 + tile.difficulty;
  const maxRounds = 3;
  const totalNotes = initialLength + maxRounds - 1;

  const finish = useCallback((totalCorrect: number) => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    setPhase('done');
    setTimeout(() => onComplete({ primaryMetric: totalCorrect }), 500);
  }, [onComplete]);

  useEffect(() => {
    const rng = new SeededRNG(`chord-${settings.seed}-${tile.tileIndex}`);
    const seq: number[] = [];
    for (let i = 0; i < totalNotes; i++) {
      seq.push(rng.nextInt(0, NOTE_COLORS.length));
    }
    setSequence(seq);
    setRoundLength(initialLength);
  }, [settings.seed, tile.tileIndex, initialLength, totalNotes]);

  useEffect(() => {
    if (isPaused || phase !== 'showing' || sequence.length === 0) return;
    if (showIndex >= roundLength) {
      setPhase('input');
      return;
    }

    const noteId = sequence[showIndex];
    const showDelay = 600 - tile.difficulty * 100;
    const timer1 = setTimeout(() => {
      setActiveNote(noteId);
      const note = NOTE_COLORS[noteId];
      if (note) audioService.playTone(note.freq, 0.18, 'triangle');
    }, 150);
    const timer2 = setTimeout(() => {
      setActiveNote(null);
      setShowIndex(prev => prev + 1);
    }, showDelay);

    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [phase, showIndex, roundLength, sequence, tile.difficulty, isPaused]);

  useEffect(() => {
    if (isPaused || phase === 'done') return;
    const timer = setTimeout(() => finish(correctCount), maxDuration);
    return () => clearTimeout(timer);
  }, [isPaused, phase, correctCount, maxDuration, finish]);

  const handleNoteClick = (noteId: number) => {
    if (phase !== 'input' || isDoneRef.current || isPaused) return;

    setActiveNote(noteId);
    const note = NOTE_COLORS[noteId];
    if (note) audioService.playTone(note.freq, 0.15, 'triangle');
    setTimeout(() => setActiveNote(null), 200);

    const expectedNote = sequence[userIndex];
    if (noteId === expectedNote) {
      const newIndex = userIndex + 1;
      const newCorrect = correctCount + 1;
      setUserIndex(newIndex);
      setCorrectCount(newCorrect);

      if (newIndex >= roundLength) {
        if (roundLength >= sequence.length) {
          finish(newCorrect);
        } else {
          // Advance to next growing round
          setTimeout(() => {
            if (isDoneRef.current) return;
            setRoundLength(r => r + 1);
            setUserIndex(0);
            setShowIndex(0);
            setPhase('showing');
          }, 350);
        }
      }
    } else {
      finish(correctCount);
    }
  };

  const inputProgress = phase === 'input' ? `${userIndex}/${roundLength}` : '';

  return (
    <div
      className="flex flex-col items-center justify-center h-full select-none gap-4"
      style={{ filter: isBlurred ? 'blur(8px)' : 'none' }}
    >
      <div className="text-sm text-cyan-300/70">
        {phase === 'showing' && `Watch the sequence (Length ${roundLength})...`}
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
          {Array.from({ length: roundLength }).map((_, i) => (
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

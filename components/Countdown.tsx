import React, { useState, useEffect, useCallback } from 'react';
import { useSound } from '../hooks/useSound';
import { GameEvent } from '../types';
import { STAR_MOVEMENT_MULTIPLIERS } from '../constants';

interface CountdownProps {
  tileNumber: number;
  eventName: string;
  event: GameEvent;
  onComplete: () => void;
  /** v5.0: Optional duration in ms for the countdown (default 3500ms = 3...2...1...GO). */
  durationMs?: number;
}

const InstructionCard: React.FC<{ event: GameEvent; visible: boolean }> = ({ event, visible }) => {
    return (
        <div 
            className={`absolute top-4 sm:top-8 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-full max-w-md transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={!visible}
        >
            <div className="glass-panel p-3 sm:p-6">
                <ul className="space-y-2 sm:space-y-4 text-left">
                    <li className="flex items-start gap-2 sm:gap-3">
                        <span className="text-xl sm:text-3xl mt-0.5 sm:mt-1" aria-hidden="true">🎮</span>
                        <div>
                            <p className="text-[10px] sm:text-sm uppercase tracking-widest text-galaxy-cyan">How to Play</p>
                            <p className="text-sm sm:text-xl font-bold">{event.interactionHint}</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-2 sm:gap-3">
                        <span className="text-xl sm:text-3xl mt-0.5 sm:mt-1" aria-hidden="true">📈</span>
                        <div>
                            <p className="text-[10px] sm:text-sm uppercase tracking-widest text-galaxy-cyan">Scoring</p>
                            <p className="text-sm sm:text-xl font-bold">{event.scoringHint}</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-2 sm:gap-3 landscape-hide">
                        <span className="text-xl sm:text-3xl mt-0.5 sm:mt-1" aria-hidden="true">🚀</span>
                         <div>
                            <p className="text-[10px] sm:text-sm uppercase tracking-widest text-galaxy-cyan">Movement</p>
                            <p className="text-xs sm:text-lg font-mono tracking-wider">
                                <span className="text-hyper-green">★★★</span>={STAR_MOVEMENT_MULTIPLIERS[3]}x | <span className="text-solar-orange">★★</span>={STAR_MOVEMENT_MULTIPLIERS[2]}x | ★={STAR_MOVEMENT_MULTIPLIERS[1]}x
                            </p>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export const Countdown: React.FC<CountdownProps> = ({ tileNumber, eventName, event, onComplete, durationMs }) => {
  const [count, setCount] = useState(4);
  const { playSound } = useSound();

  // v5.0: If durationMs is provided, derive the tick interval from it
  const tickInterval = durationMs ? Math.max(500, Math.floor(durationMs / 4)) : 1000;

  const handleSkip = useCallback(() => {
    setCount(0);
  }, []);

  useEffect(() => {
    if (count > 0) {
      playSound('countdown-beep');
      const timer = setTimeout(() => setCount(count - 1), tickInterval);
      return () => clearTimeout(timer);
    } else {
      const goTimer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(goTimer);
    }
  }, [count, onComplete, playSound, tickInterval]);

  // Escape or Space to skip countdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  return (
    <div 
      className="fixed inset-0 bg-cosmic-blue/80 sm:backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fade-in countdown-overlay"
      role="status"
      aria-live="assertive"
      aria-label={count > 0 ? `Starting in ${count}` : 'Go!'}
    >
      <InstructionCard event={event} visible={count > 1} />
      <div className="text-center">
        <p className="text-lg sm:text-2xl text-galaxy-cyan mb-2 sm:mb-4">{`Tile ${tileNumber} — ${eventName}`}</p>
        <div key={count} className="text-6xl sm:text-8xl md:text-9xl font-black text-hyper-green animate-pulse countdown-number">
          {count > 0 ? count : 'GO!'}
        </div>
        {count > 1 && <p className="text-xs text-gray-500 mt-4 hidden sm:block">Press Space to skip</p>}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { useSound } from '../hooks/useSound';
import { GameEvent, EventMastery } from '../types';
import { STAR_MOVEMENT_MULTIPLIERS } from '../constants';

interface CountdownProps {
  tileNumber: number;
  eventName: string;
  event: GameEvent;
  onComplete: () => void;
  /** v5.0: Optional duration in ms for the countdown (default 3500ms = 3...2...1...GO). */
  durationMs?: number;
  /** Pilot's mastery record for this event, if any. */
  mastery?: EventMastery;
  /** When true, disable keyboard skip so online players stay synchronized with server clock. */
  onlineMode?: boolean;
}

const InstructionCard: React.FC<{ event: GameEvent; visible: boolean; mastery?: EventMastery }> = ({ event, visible, mastery }) => {
    return (
        <div 
            className={`absolute top-4 sm:top-8 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-full max-w-md transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={!visible}
        >
            <div className="glass-panel p-3 sm:p-6">
                {mastery && mastery.totalPlays > 0 && (
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10 text-xs">
                        <span className="font-bold text-solar-orange uppercase tracking-wider">
                            ★ Mastery Lv.{mastery.masteryLevel}/5
                        </span>
                        <span className="font-mono text-gray-400">
                            {mastery.totalPlays} Plays • {(mastery.totalStars / mastery.totalPlays).toFixed(1)}★ Avg
                        </span>
                    </div>
                )}
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

export const Countdown: React.FC<CountdownProps> = ({ tileNumber, eventName, event, onComplete, durationMs, mastery, onlineMode = false }) => {
  const [count, setCount] = useState(3);
  const { playSound } = useSound();

  // Default 3500ms = 3 ticks * 1000ms + 500ms GO! (matches ConfluxRoom 3500ms timer)
  const tickInterval = durationMs ? Math.max(400, Math.floor((durationMs - 500) / 3)) : 1000;

  const handleSkip = useCallback(() => {
    if (onlineMode) return;
    setCount(0);
  }, [onlineMode]);

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

  // Escape or Space to skip countdown (local mode only)
  useEffect(() => {
    if (onlineMode) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip, onlineMode]);

  return (
    <div 
      className="fixed inset-0 bg-cosmic-blue/80 sm:backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fade-in countdown-overlay"
      role="status"
      aria-live="assertive"
      aria-label={count > 0 ? `Starting in ${count}` : 'Go!'}
    >
      <InstructionCard event={event} visible={count > 1} mastery={mastery} />
      <div className="text-center">
        <p className="text-lg sm:text-2xl text-galaxy-cyan mb-2 sm:mb-4">{`Tile ${tileNumber} — ${eventName}`}</p>
        <div key={count} className="text-6xl sm:text-8xl md:text-9xl font-black text-hyper-green animate-pulse countdown-number">
          {count > 0 ? count : 'GO!'}
        </div>
        {!onlineMode && count > 1 && <p className="text-xs text-gray-500 mt-4 hidden sm:block">Press Space to skip</p>}
      </div>
    </div>
  );
};

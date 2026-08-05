import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';
import { useEventFeedback } from '../hooks/useEventFeedback';

enum State {
  Ready,
  Waiting,
  Active,
  Done,
}

export const ReactionTap: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
  const [state, setState] = useState<State>(State.Ready);
  const stateRef = useRef<State>(State.Ready);
  const [message, setMessage] = useState('Get Ready...');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const [ripple, setRipple] = useState<{x: number, y: number} | null>(null);
  const feedback = useEventFeedback();

  const endEvent = useCallback((reactionTime: number) => {
    if (stateRef.current === State.Done) return;
    stateRef.current = State.Done;
    setState(State.Done);
    onComplete({ primaryMetric: reactionTime });
  }, [onComplete]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
    const timeout = setTimeout(() => {
        if (stateRef.current !== State.Done) {
            endEvent(9999);
        }
    }, duration);
    return () => clearTimeout(timeout);
  }, [event, tile.difficulty, settings.accessibility, endEvent, isPaused]);

  useEffect(() => {
    if (isPaused) return;
    if (state === State.Ready) {
      timerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        stateRef.current = State.Waiting;
        setState(State.Waiting);
        setMessage('Wait for Green');
        
        const rng = new SeededRNG(`reaction-tap-${settings.seed}-${tile.tileIndex}`);
        const delay = rng.nextFloat() * 1200 + 800; // 0.8s to 2.0s
        timerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          stateRef.current = State.Active;
          setState(State.Active);
          setMessage('TAP!');
          startTimeRef.current = performance.now();
        }, delay);

      }, 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, settings.seed, tile.tileIndex, isPaused]);

  const handleTap = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'clientX' in e) {
        setRipple({ x: e.clientX, y: e.clientY });
    } else {
        setRipple({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
    
    setTimeout(() => setRipple(null), 500);

    if (stateRef.current === State.Waiting) {
      setMessage('Too Soon!');
      feedback.onFail();
      endEvent(9999); // Penalty
    } else if (stateRef.current === State.Active) {
      const reactionTime = performance.now() - startTimeRef.current;
      const clampedTime = Math.max(80, reactionTime);
      setMessage(`${clampedTime.toFixed(0)} ms`);
      feedback.onSuccess();
      endEvent(clampedTime);
    }
  }, [endEvent, feedback]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space') {
      handleTap(event);
    }
  }, [handleTap]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const getBgColor = () => {
    switch (state) {
      case State.Ready: return 'bg-gray-800';
      case State.Waiting: return 'bg-red-600';
      case State.Active: return 'bg-hyper-green';
      case State.Done: return 'bg-star-purple';
    }
  };

  return (
    <div 
      className={`w-full h-full flex items-center justify-center text-white select-none cursor-pointer transition-colors duration-200 relative overflow-hidden ${getBgColor()} ${isBlurred ? 'filter blur-md' : ''}`}
      onClick={handleTap}
    >
      {ripple && (
          <div 
            className="absolute rounded-full bg-white/30 animate-ping" 
            style={{ left: ripple.x - 50, top: ripple.y - 50, width: 100, height: 100 }} 
          />
      )}
      
      <div className="text-center z-10">
        {state === State.Active && <div className="text-6xl font-black animate-pulse scale-110">TAP!</div>}
        {state !== State.Active && <div className="text-4xl font-bold opacity-80">{message}</div>}
      </div>
    </div>
  );
};

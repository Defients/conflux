/**
 * hooks/useCountdown.ts
 *
 * Reusable countdown timer hook with start, pause, reset, and completion callback.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCountdownOptions {
  durationMs: number;
  onComplete?: () => void;
  autoStart?: boolean;
}

export function useCountdown({ durationMs, onComplete, autoStart = true }: UseCountdownOptions) {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [isRunning, setIsRunning] = useState(autoStart);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const tick = useCallback(() => {
    if (startTimeRef.current === null) return;
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, durationMs - elapsed);
    setRemainingMs(remaining);

    if (remaining <= 0) {
      setIsRunning(false);
      startTimeRef.current = null;
      onCompleteRef.current?.();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs]);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setRemainingMs(durationMs);
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, tick]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setRemainingMs(durationMs);
    startTimeRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [durationMs]);

  useEffect(() => {
    if (autoStart) start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [autoStart, start]);

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    progress: 1 - remainingMs / durationMs,
    isRunning,
    start,
    pause,
    reset,
  };
}

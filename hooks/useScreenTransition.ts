/**
 * hooks/useScreenTransition.ts
 *
 * Manages screen transitions with optional animation states.
 */

import { useState, useCallback, useRef } from 'react';

export type ScreenName = string;

interface ScreenTransitionState {
  current: ScreenName;
  previous: ScreenName | null;
  isTransitioning: boolean;
}

export function useScreenTransition(initialScreen: ScreenName) {
  const [state, setState] = useState<ScreenTransitionState>({
    current: initialScreen,
    previous: null,
    isTransitioning: false,
  });
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transitionTo = useCallback((screen: ScreenName) => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setState(prev => ({
      current: screen,
      previous: prev.current,
      isTransitioning: true,
    }));
    transitionTimer.current = setTimeout(() => {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }, 300);
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      if (!prev.previous) return prev;
      return {
        current: prev.previous,
        previous: null,
        isTransitioning: true,
      };
    });
    transitionTimer.current = setTimeout(() => {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }, 300);
  }, []);

  return {
    currentScreen: state.current,
    previousScreen: state.previous,
    isTransitioning: state.isTransitioning,
    transitionTo,
    goBack,
  };
}

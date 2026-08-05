/**
 * hooks/useEventFeedback.ts
 *
 * Shared hook for event components to provide audio and haptic feedback
 * at key interaction points. Centralizes sound/haptic calls so individual
 * events don't need to import audioService or hapticsService directly.
 *
 * Usage in an event component:
 *   const feedback = useEventFeedback();
 *   feedback.onSuccess();    // play success sound + light haptic
 *   feedback.onFail();       // play fail sound + medium haptic
 *   feedback.onTick();       // play tick sound (for rhythm events)
 *   feedback.onInput();      // light haptic on each input
 */

import { useCallback } from 'react';
import { useSound } from './useSound';
import { hapticsService } from '../services/hapticsService';

export interface EventFeedback {
  /** Play success sound and light haptic — call on 3-star performance or correct answer. */
  onSuccess: () => void;
  /** Play fail sound and medium haptic — call on wrong answer or poor performance. */
  onFail: () => void;
  /** Play tick/click sound — call on each beat in rhythm events or each input. */
  onTick: () => void;
  /** Light haptic only — call on each input tap/click. */
  onInput: () => void;
  /** Play power-up sound — call when a power-up is acquired. */
  onPowerUp: () => void;
}

export function useEventFeedback(): EventFeedback {
  const { playSound } = useSound();

  const onSuccess = useCallback(() => {
    playSound('event-success');
    hapticsService.trigger('light');
  }, [playSound]);

  const onFail = useCallback(() => {
    playSound('event-fail');
    hapticsService.trigger('medium');
  }, [playSound]);

  const onTick = useCallback(() => {
    playSound('ui-click');
  }, [playSound]);

  const onInput = useCallback(() => {
    hapticsService.trigger('light');
  }, []);

  const onPowerUp = useCallback(() => {
    playSound('powerup-get');
    hapticsService.trigger('medium');
  }, [playSound]);

  return { onSuccess, onFail, onTick, onInput, onPowerUp };
}

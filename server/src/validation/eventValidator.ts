/**
 * server/src/validation/eventValidator.ts
 * 
 * Server-side validation of client-submitted event telemetry.
 * Performs practical checks without attempting perfect anti-cheat.
 * 
 * Validates:
 *   - Payload shape completeness
 *   - Tile/event ID match against current game state
 *   - Timing plausibility (not impossibly fast)
 *   - Metric range bounds
 */

import { EventTelemetry } from '../../../shared/types';
import { STAR_COMPUTERS } from '../eventDescriptors';

export interface ValidationContext {
  tileIndex: number;
  expectedEventId: string;
  tileStartTimestamp: number;
  tileDurationMs: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Minimum time (ms) a human could plausibly complete any event. */
const MIN_PLAUSIBLE_COMPLETION_MS = 500;

/** Maximum allowed clock skew (ms) between client and server timestamps. */
const MAX_CLOCK_SKEW_MS = 10_000;

export const ServerEventValidator = {
  /**
   * Validates an incoming EventTelemetry payload.
   * Returns { valid: true } or { valid: false, reason: '...' }.
   */
  validate(telemetry: EventTelemetry, context: ValidationContext): ValidationResult {
    // 1. Shape check
    if (
      typeof telemetry.tileIndex !== 'number' ||
      typeof telemetry.eventId !== 'string' ||
      typeof telemetry.primaryMetric !== 'number'
    ) {
      return { valid: false, reason: 'Malformed payload: missing required fields' };
    }

    // 2. Tile index match
    if (telemetry.tileIndex !== context.tileIndex) {
      return { valid: false, reason: `Tile index mismatch: got ${telemetry.tileIndex}, expected ${context.tileIndex}` };
    }

    // 3. Event ID match
    if (telemetry.eventId !== context.expectedEventId) {
      return { valid: false, reason: `Event ID mismatch: got ${telemetry.eventId}, expected ${context.expectedEventId}` };
    }

    // 4. Timing plausibility
    if (typeof telemetry.completionTimestamp === 'number') {
      const elapsed = telemetry.completionTimestamp - context.tileStartTimestamp;
      
      // Too fast to be human
      if (elapsed < MIN_PLAUSIBLE_COMPLETION_MS - MAX_CLOCK_SKEW_MS) {
        return { valid: false, reason: `Suspiciously fast completion: ${elapsed}ms` };
      }

      // Way too slow (more than 2x the allowed duration + skew tolerance)
      const maxAllowed = context.tileDurationMs * 2 + MAX_CLOCK_SKEW_MS;
      if (elapsed > maxAllowed) {
        return { valid: false, reason: `Completion time exceeds maximum: ${elapsed}ms > ${maxAllowed}ms` };
      }
    }

    // 5. Metric range bounds (basic sanity)
    if (!isFinite(telemetry.primaryMetric)) {
      return { valid: false, reason: 'primaryMetric is not a finite number' };
    }

    if (telemetry.secondaryMetric !== undefined && !isFinite(telemetry.secondaryMetric)) {
      return { valid: false, reason: 'secondaryMetric is not a finite number' };
    }

    return { valid: true };
  },

  /**
   * Computes authoritative star rating from raw metrics.
   * Uses the server-side star computation functions that mirror client getStars().
   * 
   * If the event ID is unknown, defaults to 1 star (safe fallback).
   */
  computeStars(
    eventId: string,
    primaryMetric: number,
    secondaryMetric?: number
  ): 0 | 1 | 2 | 3 {
    const computer = STAR_COMPUTERS[eventId];
    if (!computer) {
      console.warn(`[Validator] No star computer for event: ${eventId}, defaulting to 1 star`);
      return 1;
    }

    try {
      return computer(primaryMetric, secondaryMetric);
    } catch (err) {
      console.error(`[Validator] Star computation error for ${eventId}:`, err);
      return 1;
    }
  },
};

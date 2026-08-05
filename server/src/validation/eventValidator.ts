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
 *   - Metric range bounds (per-event min/max)
 *   - Negative metric rejection
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

/**
 * Per-event metric bounds. These define the plausible range for
 * primaryMetric (pm) and secondaryMetric (sm) for each event.
 *
 * Metrics outside these bounds are rejected as suspicious.
 * Bounds are generous to avoid false positives from legitimate play.
 *
 * Convention:
 *   - For time-based metrics (ms): min=0, max=120000 (2 minutes)
 *   - For count-based metrics: min=0, max=1000
 *   - For accuracy ratios: min=0, max=1 (but stored as count/total)
 *   - For error counts: min=0, max=100
 */
const METRIC_BOUNDS: Record<string, { pmMin: number; pmMax: number; smMin?: number; smMax?: number }> = {
  // Time-based events (pm = ms)
  'reaction-tap': { pmMin: 0, pmMax: 5000 },
  'wire-link': { pmMin: 0, pmMax: 120000 },
  'maze-micro': { pmMin: 0, pmMax: 120000 },
  'find-pixel': { pmMin: 0, pmMax: 120000 },
  'type-racer-snippet': { pmMin: 0, pmMax: 120000 },
  'flow-connect': { pmMin: 0, pmMax: 120000 },
  'ghost-trajectory': { pmMin: 0, pmMax: 120000 },

  // Accuracy/count events (pm = correct count, sm = total)
  'system-purge': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'pattern-recall': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'target-practice': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'whack-a-mole': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'word-storm': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'number-stack': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'logic-gates': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'color-sort': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'jump-bar': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'sequence-sort': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },

  // Score/ratio events
  'rhythm-tap': { pmMin: 0, pmMax: 300, smMin: 0, smMax: 100 },
  'drum-echo': { pmMin: 0, pmMax: 300, smMin: 0, smMax: 100 },

  // WPM/typing events
  'type-burst': { pmMin: 0, pmMax: 200, smMin: 0, smMax: 100 },

  // Quiz/logic events
  'quick-quiz': { pmMin: 0, pmMax: 10, smMin: 0, smMax: 60000 },
  'quick-math': { pmMin: 0, pmMax: 20 },
  'code-breaker': { pmMin: 0, pmMax: 20 },
  'anagram-rush': { pmMin: 0, pmMax: 20 },
  'word-scramble': { pmMin: 0, pmMax: 20 },

  // Precision/aim events
  'balance-beam': { pmMin: 0, pmMax: 12 },
  'aim-flick': { pmMin: 0, pmMax: 3 },
  'slider-precision': { pmMin: 0, pmMax: 100 },
  'angle-nudge': { pmMin: 0, pmMax: 100 },
  'stop-the-clock': { pmMin: 0, pmMax: 10000 },
  'dial-lock': { pmMin: 0, pmMax: 100 },

  // Memory events
  'memory-flip': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 60000 },
  'snapshot-memory': { pmMin: 0, pmMax: 3 },
  'chord-memory': { pmMin: 0, pmMax: 10 },

  // Evade/dodge events (pm = errors/hits)
  'evade-grid': { pmMin: 0, pmMax: 100 },
  'asteroid-dodge': { pmMin: 0, pmMax: 100 },

  // Click/mash events
  'burst-clicks': { pmMin: 0, pmMax: 1000 },
  'sprint-mash': { pmMin: 0, pmMax: 1000 },

  // Path/trace events
  'path-tracer': { pmMin: 0, pmMax: 100 },
  'pixel-push': { pmMin: 0, pmMax: 100 },
  'mirror-draw': { pmMin: 0, pmMax: 100 },
  'wave-ride': { pmMin: 0, pmMax: 100 },

  // Color/symbol events
  'color-math': { pmMin: 0, pmMax: 100 },
  'symbol-match': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
  'emoji-cipher': { pmMin: 0, pmMax: 100, smMin: 0, smMax: 60000 },

  // Audio events
  'audio-beat': { pmMin: 0, pmMax: 1, smMin: 0, smMax: 60000 },

  // Tilt/maze events
  'tilt-maze': { pmMin: 0, pmMax: 100 },
};

/** Default bounds for events not explicitly listed. */
const DEFAULT_BOUNDS = { pmMin: 0, pmMax: 120000, smMin: 0, smMax: 120000 };

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

      // Completion before start is always impossible, regardless of clock skew
      if (elapsed < 0) {
        return { valid: false, reason: `Suspiciously fast completion: ${elapsed}ms (negative elapsed)` };
      }

      // Too fast to be human (accounting for clock skew)
      if (elapsed < MIN_PLAUSIBLE_COMPLETION_MS - MAX_CLOCK_SKEW_MS) {
        return { valid: false, reason: `Suspiciously fast completion: ${elapsed}ms` };
      }

      // Way too slow (more than 2x the allowed duration + skew tolerance)
      const maxAllowed = context.tileDurationMs * 2 + MAX_CLOCK_SKEW_MS;
      if (elapsed > maxAllowed) {
        return { valid: false, reason: `Completion time exceeds maximum: ${elapsed}ms > ${maxAllowed}ms` };
      }
    }

    // 5. Metric finiteness
    if (!isFinite(telemetry.primaryMetric)) {
      return { valid: false, reason: 'primaryMetric is not a finite number' };
    }

    if (telemetry.secondaryMetric !== undefined && !isFinite(telemetry.secondaryMetric)) {
      return { valid: false, reason: 'secondaryMetric is not a finite number' };
    }

    // 6. Per-event metric range bounds
    const bounds = METRIC_BOUNDS[telemetry.eventId] ?? DEFAULT_BOUNDS;
    if (telemetry.primaryMetric < bounds.pmMin || telemetry.primaryMetric > bounds.pmMax) {
      return {
        valid: false,
        reason: `primaryMetric out of bounds for ${telemetry.eventId}: ${telemetry.primaryMetric} (expected ${bounds.pmMin}-${bounds.pmMax})`,
      };
    }

    if (telemetry.secondaryMetric !== undefined) {
      const smMin = bounds.smMin ?? DEFAULT_BOUNDS.smMin!;
      const smMax = bounds.smMax ?? DEFAULT_BOUNDS.smMax!;
      if (telemetry.secondaryMetric < smMin || telemetry.secondaryMetric > smMax) {
        return {
          valid: false,
          reason: `secondaryMetric out of bounds for ${telemetry.eventId}: ${telemetry.secondaryMetric} (expected ${smMin}-${smMax})`,
        };
      }
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

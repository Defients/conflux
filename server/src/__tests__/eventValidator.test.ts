/**
 * server/src/__tests__/eventValidator.test.ts
 *
 * Tests for server-side event telemetry validation.
 * Focuses on metric range bounds and timing plausibility.
 */

import { describe, it, expect } from 'vitest';
import { ServerEventValidator, ValidationContext } from '../validation/eventValidator';
import { EventTelemetry } from '../../../shared/types';

const BASE_CONTEXT: ValidationContext = {
  tileIndex: 0,
  expectedEventId: 'reaction-tap',
  tileStartTimestamp: 1000,
  tileDurationMs: 5000,
};

/** Helper to create valid EventTelemetry with defaults. */
function makeTelemetry(overrides: Partial<EventTelemetry>): EventTelemetry {
  return {
    tileIndex: 0,
    eventId: 'reaction-tap',
    seed: 'test-seed',
    primaryMetric: 200,
    completionTimestamp: 3000,
    ...overrides,
  };
}

describe('ServerEventValidator', () => {
  describe('validate — shape checks', () => {
    it('should reject missing required fields', () => {
      const result = ServerEventValidator.validate(
        { tileIndex: 0, eventId: 'reaction-tap' } as any,
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Malformed');
    });

    it('should reject tile index mismatch', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ tileIndex: 5 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Tile index mismatch');
    });

    it('should reject event ID mismatch', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'wrong-event' }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Event ID mismatch');
    });
  });

  describe('validate — timing plausibility', () => {
    it('should reject suspiciously fast completion (negative elapsed)', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ completionTimestamp: 500 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('fast');
    });

    it('should reject completion exceeding maximum duration', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ completionTimestamp: 30000 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });

    it('should accept plausible timing', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ completionTimestamp: 3000 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('validate — metric finiteness', () => {
    it('should reject Infinity as primaryMetric', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ primaryMetric: Infinity }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('finite');
    });

    it('should reject NaN as primaryMetric', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ primaryMetric: NaN }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('finite');
    });

    it('should reject Infinity as secondaryMetric', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'system-purge', primaryMetric: 5, secondaryMetric: Infinity }),
        { ...BASE_CONTEXT, expectedEventId: 'system-purge' }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('finite');
    });
  });

  describe('validate — per-event metric bounds', () => {
    it('should reject negative primaryMetric for reaction-tap', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ primaryMetric: -100 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should reject absurdly large primaryMetric for reaction-tap', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ primaryMetric: 99999 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should reject negative primaryMetric that would give 3 stars (reaction-tap)', () => {
      // -1000 < 180 would give 3 stars, but -1000 is out of bounds
      const result = ServerEventValidator.validate(
        makeTelemetry({ primaryMetric: -1000 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should accept valid primaryMetric for reaction-tap', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ primaryMetric: 200 }),
        BASE_CONTEXT
      );
      expect(result.valid).toBe(true);
    });

    it('should reject absurdly large count for burst-clicks', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'burst-clicks', primaryMetric: 99999 }),
        { ...BASE_CONTEXT, expectedEventId: 'burst-clicks' }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should reject negative secondaryMetric for system-purge', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'system-purge', primaryMetric: 5, secondaryMetric: -1 }),
        { ...BASE_CONTEXT, expectedEventId: 'system-purge' }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('secondaryMetric out of bounds');
    });

    it('should reject absurdly large secondaryMetric for system-purge', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'system-purge', primaryMetric: 5, secondaryMetric: 99999 }),
        { ...BASE_CONTEXT, expectedEventId: 'system-purge' }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('secondaryMetric out of bounds');
    });

    it('should use default bounds for unknown events', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'unknown-event', primaryMetric: 500 }),
        { ...BASE_CONTEXT, expectedEventId: 'unknown-event' }
      );
      expect(result.valid).toBe(true);
    });

    it('should reject negative primaryMetric for unknown events (default bounds)', () => {
      const result = ServerEventValidator.validate(
        makeTelemetry({ eventId: 'unknown-event', primaryMetric: -1 }),
        { ...BASE_CONTEXT, expectedEventId: 'unknown-event' }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });
  });

  describe('computeStars', () => {
    it('should compute 3 stars for excellent reaction-tap', () => {
      const stars = ServerEventValidator.computeStars('reaction-tap', 150);
      expect(stars).toBe(3);
    });

    it('should compute 1 star for slow reaction-tap', () => {
      const stars = ServerEventValidator.computeStars('reaction-tap', 500);
      expect(stars).toBe(1);
    });

    it('should default to 1 star for unknown event', () => {
      const stars = ServerEventValidator.computeStars('unknown-event', 100);
      expect(stars).toBe(1);
    });

    it('should handle star computation errors gracefully', () => {
      // Pass NaN to trigger potential error in computation
      const stars = ServerEventValidator.computeStars('reaction-tap', NaN);
      // NaN comparisons are always false, so it should fall through to 1 star
      expect(stars).toBe(1);
    });
  });
});

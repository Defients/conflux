"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerEventValidator = void 0;
const eventDescriptors_1 = require("../eventDescriptors");
/** Minimum time (ms) a human could plausibly complete any event. */
const MIN_PLAUSIBLE_COMPLETION_MS = 500;
/** Maximum allowed clock skew (ms) between client and server timestamps. */
const MAX_CLOCK_SKEW_MS = 10000;
exports.ServerEventValidator = {
    /**
     * Validates an incoming EventTelemetry payload.
     * Returns { valid: true } or { valid: false, reason: '...' }.
     */
    validate(telemetry, context) {
        // 1. Shape check
        if (typeof telemetry.tileIndex !== 'number' ||
            typeof telemetry.eventId !== 'string' ||
            typeof telemetry.primaryMetric !== 'number') {
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
    computeStars(eventId, primaryMetric, secondaryMetric) {
        const computer = eventDescriptors_1.STAR_COMPUTERS[eventId];
        if (!computer) {
            console.warn(`[Validator] No star computer for event: ${eventId}, defaulting to 1 star`);
            return 1;
        }
        try {
            return computer(primaryMetric, secondaryMetric);
        }
        catch (err) {
            console.error(`[Validator] Star computation error for ${eventId}:`, err);
            return 1;
        }
    },
};
//# sourceMappingURL=eventValidator.js.map
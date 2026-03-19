"use strict";
/**
 * server/src/eventDescriptors.ts
 *
 * Server-side event descriptors and star computation functions.
 * Mirrors the client eventRegistry but WITHOUT React components.
 * Used by the server to:
 *   1. Generate runs (via shared pathGenerator)
 *   2. Compute authoritative star ratings from raw metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_DESCRIPTORS = exports.STAR_COMPUTERS = void 0;
/** Map of eventId -> star computation function. */
exports.STAR_COMPUTERS = {
    'balance-beam': (pm) => {
        const ratio = pm / 12;
        if (ratio >= 0.85)
            return 3;
        if (ratio >= 0.5)
            return 2;
        return 1;
    },
    'reaction-tap': (pm) => {
        if (pm < 180)
            return 3;
        if (pm <= 300)
            return 2;
        return 1;
    },
    'system-purge': (pm, sm) => {
        const total = sm ?? 1;
        const accuracy = total > 0 ? pm / total : 0;
        if (accuracy >= 0.9)
            return 3;
        if (accuracy >= 0.6)
            return 2;
        return 1;
    },
    'type-burst': (pm, sm) => {
        const wpm = pm;
        const errors = sm ?? 99;
        if (errors <= 1 && wpm >= 55)
            return 3;
        if (errors <= 3 && wpm >= 40)
            return 2;
        return 1;
    },
    'quick-quiz': (pm, sm) => {
        const correctCount = pm;
        const totalTimeMs = sm ?? 12000;
        const avgTimeMs = correctCount > 0 ? totalTimeMs / correctCount : 9999;
        if (correctCount === 3 && avgTimeMs < 1500)
            return 3;
        if (correctCount === 3 || correctCount === 2)
            return 2;
        return 1;
    },
    'aim-flick': (pm) => {
        if (pm === 1)
            return 3;
        if (pm === 2)
            return 2;
        return 1;
    },
    'memory-flip': (pm, sm) => {
        const errors = pm;
        const timeMs = sm ?? 20000;
        if (timeMs < 14000 && errors <= 2)
            return 3;
        if (timeMs < 20000)
            return 2;
        return 1;
    },
    'slider-precision': (pm) => {
        if (pm <= 3)
            return 3;
        if (pm <= 8)
            return 2;
        return 1;
    },
    'pattern-recall': (pm, sm) => {
        const total = sm ?? 1;
        const accuracy = total > 0 ? pm / total : 0;
        if (accuracy >= 1)
            return 3;
        if (accuracy >= 0.6)
            return 2;
        return 1;
    },
    'evade-grid': (pm) => {
        if (pm === 0)
            return 3;
        if (pm <= 2)
            return 2;
        return 1;
    },
    'jump-bar': (pm, sm) => {
        const total = sm ?? 1;
        if (total === 0)
            return 1;
        if (pm === total)
            return 3;
        if (pm >= total - 1 && total > 1)
            return 2;
        return 1;
    },
    'wire-link': (pm) => {
        if (pm > 90000)
            return 1;
        if (pm < 15000)
            return 3;
        if (pm < 25000)
            return 2;
        return 1;
    },
    'maze-micro': (pm) => {
        if (pm < 8000)
            return 3;
        if (pm < 12000)
            return 2;
        return 1;
    },
    'find-pixel': (pm) => {
        if (pm < 4000)
            return 3;
        if (pm < 8000)
            return 2;
        return 1;
    },
    'target-practice': (pm, sm) => {
        const total = sm ?? 1;
        if (total === 0)
            return 1;
        const accuracy = pm / total;
        if (accuracy >= 0.9)
            return 3;
        if (accuracy >= 0.6)
            return 2;
        return 1;
    },
    'rhythm-tap': (pm, sm) => {
        const totalBeats = sm ?? 1;
        const maxScore = totalBeats * 3;
        if (maxScore === 0)
            return 1;
        const ratio = pm / maxScore;
        if (ratio >= 0.8)
            return 3;
        if (ratio >= 0.5)
            return 2;
        return 1;
    },
    'sequence-sort': (pm, sm) => {
        const total = sm ?? 1;
        const accuracy = total > 0 ? pm / total : 0;
        if (accuracy >= 1)
            return 3;
        if (accuracy >= 0.7)
            return 2;
        return 1;
    },
    'asteroid-dodge': (pm) => {
        if (pm === 0)
            return 3;
        if (pm <= 2)
            return 2;
        return 1;
    },
    'path-tracer': (pm) => {
        if (pm >= 99)
            return 3;
        if (pm >= 80)
            return 2;
        return 1;
    },
    'code-breaker': (pm) => {
        if (pm <= 4)
            return 3;
        if (pm <= 7)
            return 2;
        return 1;
    },
    'quick-math': (pm) => {
        if (pm >= 8)
            return 3;
        if (pm >= 5)
            return 2;
        return 1;
    },
    'color-math': (pm) => {
        if (pm <= 4)
            return 3;
        if (pm <= 8)
            return 2;
        return 1;
    },
    'angle-nudge': (pm) => {
        if (pm <= 2)
            return 3;
        if (pm <= 5)
            return 2;
        return 1;
    },
    'type-racer-snippet': (pm) => {
        if (pm < 4000)
            return 3;
        if (pm < 6000)
            return 2;
        return 1;
    },
    'snapshot-memory': (pm) => {
        if (pm === 3)
            return 3;
        if (pm === 2)
            return 2;
        return 1;
    },
    'burst-clicks': (pm) => {
        if (pm >= 10)
            return 3;
        if (pm >= 7)
            return 2;
        return 1;
    },
    'sprint-mash': (pm) => {
        if (pm >= 100)
            return 3;
        if (pm >= 80)
            return 2;
        return 1;
    },
    'ghost-trajectory': (pm) => {
        if (pm <= 20)
            return 3;
        if (pm <= 45)
            return 2;
        return 1;
    },
    'emoji-cipher': (pm, sm) => {
        const timeMs = sm ?? 99999;
        if (pm >= 95 && timeMs < 12000)
            return 3;
        if (pm >= 85 && timeMs < 18000)
            return 2;
        return 1;
    },
    'audio-beat': (pm, sm) => {
        const isCorrect = pm === 1;
        const timeMs = sm ?? 99999;
        if (isCorrect && timeMs < 6000)
            return 3;
        if (isCorrect)
            return 2;
        return 1;
    },
};
/**
 * Server-side event descriptors for run generation.
 * Contains only portable metadata (no React components).
 */
exports.EVENT_DESCRIPTORS = [
    { id: 'balance-beam', displayName: 'Balance Beam', performanceDimension: 'precision' },
    { id: 'reaction-tap', displayName: 'Reaction Tap', performanceDimension: 'reaction' },
    { id: 'system-purge', displayName: 'System Purge', performanceDimension: 'typing' },
    { id: 'type-burst', displayName: 'Type Burst', performanceDimension: 'typing' },
    { id: 'quick-quiz', displayName: 'Quick Quiz', performanceDimension: 'logic' },
    { id: 'aim-flick', displayName: 'Aim Flick', performanceDimension: 'precision' },
    { id: 'memory-flip', displayName: 'Memory Flip', performanceDimension: 'memory' },
    { id: 'slider-precision', displayName: 'Slider Precision', performanceDimension: 'precision' },
    { id: 'pattern-recall', displayName: 'Pattern Recall', performanceDimension: 'memory' },
    { id: 'evade-grid', displayName: 'Evade Grid', performanceDimension: 'rhythm' },
    { id: 'jump-bar', displayName: 'Jump Bar', performanceDimension: 'rhythm' },
    { id: 'wire-link', displayName: 'Wire Link', performanceDimension: 'logic' },
    { id: 'maze-micro', displayName: 'Maze Micro', performanceDimension: 'logic' },
    { id: 'find-pixel', displayName: 'Find the Missing Pixel', performanceDimension: 'precision' },
    { id: 'target-practice', displayName: 'Target Practice', performanceDimension: 'precision' },
    { id: 'rhythm-tap', displayName: 'Rhythm Tap', performanceDimension: 'rhythm' },
    { id: 'sequence-sort', displayName: 'Sequence Sort', performanceDimension: 'memory' },
    { id: 'asteroid-dodge', displayName: 'Asteroid Dodge', performanceDimension: 'reaction' },
    { id: 'path-tracer', displayName: 'Path Tracer', performanceDimension: 'precision' },
    { id: 'code-breaker', displayName: 'Code Breaker', performanceDimension: 'logic' },
    { id: 'quick-math', displayName: 'Quick Math', performanceDimension: 'logic' },
    { id: 'color-math', displayName: 'Color Math', performanceDimension: 'precision' },
    { id: 'angle-nudge', displayName: 'Angle Nudge', performanceDimension: 'precision' },
    { id: 'type-racer-snippet', displayName: 'Type-Racer Snippet', performanceDimension: 'typing' },
    { id: 'snapshot-memory', displayName: 'Snapshot Memory', performanceDimension: 'memory' },
    { id: 'burst-clicks', displayName: 'Burst Clicks', performanceDimension: 'reaction' },
    { id: 'sprint-mash', displayName: 'Sprint Mash', performanceDimension: 'rhythm' },
    { id: 'ghost-trajectory', displayName: 'Ghost Trajectory', performanceDimension: 'precision' },
    { id: 'emoji-cipher', displayName: 'Emoji Cipher', performanceDimension: 'logic' },
    { id: 'audio-beat', displayName: 'Audio Beat Match', performanceDimension: 'rhythm' },
];
//# sourceMappingURL=eventDescriptors.js.map
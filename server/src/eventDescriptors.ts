/**
 * server/src/eventDescriptors.ts
 * 
 * Server-side event descriptors and star computation functions.
 * Mirrors the client eventRegistry but WITHOUT React components.
 * Used by the server to:
 *   1. Generate runs (via shared pathGenerator)
 *   2. Compute authoritative star ratings from raw metrics
 */

import { SharedEventDescriptor } from '../../shared/types';

/** Server-side star computation function type. */
export type StarComputer = (primaryMetric: number, secondaryMetric?: number) => 1 | 2 | 3;

/** Map of eventId -> star computation function. */
export const STAR_COMPUTERS: Record<string, StarComputer> = {
  'balance-beam': (pm) => {
    const ratio = pm / 12;
    if (ratio >= 0.85) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  },
  'reaction-tap': (pm) => {
    if (pm < 180) return 3;
    if (pm <= 300) return 2;
    return 1;
  },
  'system-purge': (pm, sm) => {
    const total = sm ?? 1;
    const accuracy = total > 0 ? pm / total : 0;
    if (accuracy >= 0.9) return 3;
    if (accuracy >= 0.6) return 2;
    return 1;
  },
  'type-burst': (pm, sm) => {
    const wpm = pm;
    const errors = sm ?? 99;
    if (errors <= 1 && wpm >= 55) return 3;
    if (errors <= 3 && wpm >= 40) return 2;
    return 1;
  },
  'quick-quiz': (pm, sm) => {
    const correctCount = pm;
    const totalTimeMs = sm ?? 12000;
    const avgTimeMs = correctCount > 0 ? totalTimeMs / correctCount : 9999;
    if (correctCount === 3 && avgTimeMs < 1500) return 3;
    if (correctCount === 3 || correctCount === 2) return 2;
    return 1;
  },
  'aim-flick': (pm) => {
    if (pm === 1) return 3;
    if (pm === 2) return 2;
    return 1;
  },
  'memory-flip': (pm, sm) => {
    const errors = pm;
    const timeMs = sm ?? 20000;
    if (timeMs < 14000 && errors <= 2) return 3;
    if (timeMs < 20000) return 2;
    return 1;
  },
  'slider-precision': (pm) => {
    if (pm <= 3) return 3;
    if (pm <= 8) return 2;
    return 1;
  },
  'pattern-recall': (pm, sm) => {
    const total = sm ?? 1;
    const accuracy = total > 0 ? pm / total : 0;
    if (accuracy >= 1) return 3;
    if (accuracy >= 0.6) return 2;
    return 1;
  },
  'evade-grid': (pm) => {
    if (pm === 0) return 3;
    if (pm <= 2) return 2;
    return 1;
  },
  'jump-bar': (pm, sm) => {
    const total = sm ?? 1;
    if (total === 0) return 1;
    if (pm === total) return 3;
    if (pm >= total - 1 && total > 1) return 2;
    return 1;
  },
  'wire-link': (pm) => {
    if (pm > 90000) return 1;
    if (pm < 15000) return 3;
    if (pm < 25000) return 2;
    return 1;
  },
  'maze-micro': (pm) => {
    if (pm < 8000) return 3;
    if (pm < 12000) return 2;
    return 1;
  },
  'find-pixel': (pm) => {
    if (pm < 4000) return 3;
    if (pm < 8000) return 2;
    return 1;
  },
  'target-practice': (pm, sm) => {
    const total = sm ?? 1;
    if (total === 0) return 1;
    const accuracy = pm / total;
    if (accuracy >= 0.9) return 3;
    if (accuracy >= 0.6) return 2;
    return 1;
  },
  'rhythm-tap': (pm, sm) => {
    const totalBeats = sm ?? 1;
    const maxScore = totalBeats * 3;
    if (maxScore === 0) return 1;
    const ratio = pm / maxScore;
    if (ratio >= 0.8) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  },
  'sequence-sort': (pm, sm) => {
    const total = sm ?? 1;
    const accuracy = total > 0 ? pm / total : 0;
    if (accuracy >= 1) return 3;
    if (accuracy >= 0.7) return 2;
    return 1;
  },
  'asteroid-dodge': (pm) => {
    if (pm === 0) return 3;
    if (pm <= 2) return 2;
    return 1;
  },
  'path-tracer': (pm) => {
    if (pm >= 99) return 3;
    if (pm >= 80) return 2;
    return 1;
  },
  'code-breaker': (pm) => {
    if (pm <= 4) return 3;
    if (pm <= 7) return 2;
    return 1;
  },
  'quick-math': (pm) => {
    if (pm >= 8) return 3;
    if (pm >= 5) return 2;
    return 1;
  },
  'color-math': (pm) => {
    if (pm <= 4) return 3;
    if (pm <= 8) return 2;
    return 1;
  },
  'angle-nudge': (pm) => {
    if (pm <= 2) return 3;
    if (pm <= 5) return 2;
    return 1;
  },
  'type-racer-snippet': (pm) => {
    if (pm < 4000) return 3;
    if (pm < 6000) return 2;
    return 1;
  },
  'snapshot-memory': (pm) => {
    if (pm === 3) return 3;
    if (pm === 2) return 2;
    return 1;
  },
  'burst-clicks': (pm) => {
    if (pm >= 10) return 3;
    if (pm >= 7) return 2;
    return 1;
  },
  'sprint-mash': (pm) => {
    if (pm >= 100) return 3;
    if (pm >= 80) return 2;
    return 1;
  },
  'ghost-trajectory': (pm) => {
    if (pm <= 20) return 3;
    if (pm <= 45) return 2;
    return 1;
  },
  'emoji-cipher': (pm, sm) => {
    const timeMs = sm ?? 99999;
    if (pm >= 95 && timeMs < 12000) return 3;
    if (pm >= 85 && timeMs < 18000) return 2;
    return 1;
  },
  'audio-beat': (pm, sm) => {
    const isCorrect = pm === 1;
    const timeMs = sm ?? 99999;
    if (isCorrect && timeMs < 6000) return 3;
    if (isCorrect) return 2;
    return 1;
  },
  'whack-a-mole': (pm, sm) => {
    const total = sm ?? 1;
    if (total === 0) return 1;
    const accuracy = pm / total;
    if (accuracy >= 0.9) return 3;
    if (accuracy >= 0.6) return 2;
    return 1;
  },
  'stop-the-clock': (pm) => {
    if (pm <= 50) return 3;
    if (pm <= 150) return 2;
    return 1;
  },
  'word-storm': (pm, sm) => {
    const total = sm ?? 1;
    if (total === 0) return 1;
    const accuracy = pm / total;
    if (accuracy >= 0.9) return 3;
    if (accuracy >= 0.6) return 2;
    return 1;
  },
  'anagram-rush': (pm) => {
    if (pm >= 5) return 3;
    if (pm >= 3) return 2;
    return 1;
  },
  'dial-lock': (pm) => {
    if (pm <= 15) return 3;
    if (pm <= 40) return 2;
    return 1;
  },
  'pixel-push': (pm) => {
    if (pm >= 3) return 3;
    if (pm >= 2) return 2;
    return 1;
  },
  'mirror-draw': (pm) => {
    if (pm >= 90) return 3;
    if (pm >= 70) return 2;
    return 1;
  },
  'number-stack': (pm, sm) => {
    const total = sm ?? 1;
    const accuracy = total > 0 ? pm / total : 0;
    if (accuracy >= 1) return 3;
    if (accuracy >= 0.7) return 2;
    return 1;
  },
  'symbol-match': (pm, sm) => {
    const wrong = sm ?? 99;
    const targetCount = 4;
    if (pm >= targetCount && wrong === 0) return 3;
    if (pm >= targetCount - 1 && wrong <= 1) return 2;
    return 1;
  },
  'drum-echo': (pm, sm) => {
    const totalHits = sm ?? 1;
    const maxScore = totalHits * 3;
    if (maxScore === 0) return 1;
    const ratio = pm / maxScore;
    if (ratio >= 0.8) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  },
  'wave-ride': (pm) => {
    if (pm >= 85) return 3;
    if (pm >= 60) return 2;
    return 1;
  },
  'color-sort': (pm, sm) => {
    const total = sm ?? 1;
    if (total === 0) return 1;
    const accuracy = pm / total;
    if (accuracy >= 0.95) return 3;
    if (accuracy >= 0.75) return 2;
    return 1;
  },
  'flow-connect': (pm) => {
    if (pm >= 99999) return 1;
    if (pm < 15000) return 3;
    if (pm < 30000) return 2;
    return 1;
  },
  'logic-gates': (pm, sm) => {
    const total = sm ?? 1;
    if (total === 0) return 1;
    const accuracy = pm / total;
    if (accuracy >= 0.9) return 3;
    if (accuracy >= 0.6) return 2;
    return 1;
  },
  'tilt-maze': (pm) => {
    if (pm <= 10) return 3;
    if (pm <= 18) return 2;
    return 1;
  },
  'chord-memory': (pm) => {
    if (pm >= 7) return 3;
    if (pm >= 4) return 2;
    return 1;
  },
  'word-scramble': (pm) => {
    if (pm >= 5) return 3;
    if (pm >= 3) return 2;
    return 1;
  },
};

/**
 * Server-side event descriptors for run generation.
 * Contains only portable metadata (no React components).
 */
export const EVENT_DESCRIPTORS: SharedEventDescriptor[] = [
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
  { id: 'whack-a-mole', displayName: 'Whack-a-Mole', performanceDimension: 'reaction' },
  { id: 'stop-the-clock', displayName: 'Stop the Clock', performanceDimension: 'reaction' },
  { id: 'word-storm', displayName: 'Word Storm', performanceDimension: 'typing' },
  { id: 'anagram-rush', displayName: 'Anagram Rush', performanceDimension: 'typing' },
  { id: 'dial-lock', displayName: 'Dial Lock', performanceDimension: 'precision' },
  { id: 'pixel-push', displayName: 'Pixel Push', performanceDimension: 'precision' },
  { id: 'mirror-draw', displayName: 'Mirror Draw', performanceDimension: 'precision' },
  { id: 'number-stack', displayName: 'Number Stack', performanceDimension: 'memory' },
  { id: 'symbol-match', displayName: 'Symbol Match', performanceDimension: 'memory' },
  { id: 'drum-echo', displayName: 'Drum Echo', performanceDimension: 'rhythm' },
  { id: 'wave-ride', displayName: 'Wave Ride', performanceDimension: 'rhythm' },
  { id: 'color-sort', displayName: 'Color Sort', performanceDimension: 'logic' },
  { id: 'flow-connect', displayName: 'Flow Connect', performanceDimension: 'logic' },
  { id: 'logic-gates', displayName: 'Logic Gates', performanceDimension: 'logic' },
  { id: 'tilt-maze', displayName: 'Tilt Maze', performanceDimension: 'precision' },
  { id: 'chord-memory', displayName: 'Chord Memory', performanceDimension: 'memory' },
  { id: 'word-scramble', displayName: 'Word Scramble', performanceDimension: 'typing' },
];

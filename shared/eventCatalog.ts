/**
 * shared/eventCatalog.ts
 *
 * Canonical portable event catalog for all 47 Conflux Circuit mini-games.
 * Single source of truth for metadata, durations, star computation, and metric bounds
 * shared across client (`events/eventRegistry.ts`) and server (`server/src/eventDescriptors.ts`).
 *
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */

import { EventResult, SharedEventDescriptor } from './types';

export type StarComputerFn = (primaryMetric: number, secondaryMetric?: number) => 1 | 2 | 3;

export interface EventCatalogEntry extends SharedEventDescriptor {
  instructions: string;
  interactionHint: string;
  scoringHint: string;
  durationSec: (difficulty: number, accessibility: boolean) => number;
  getStars: (result: Omit<EventResult, 'stars' | 'playerId'>) => 1 | 2 | 3;
  bounds: { pmMin: number; pmMax: number; smMin?: number; smMax?: number };
}

export const EVENT_CATALOG: EventCatalogEntry[] = [
  {
    id: 'balance-beam',
    displayName: 'Balance Beam',
    instructions: 'Keep the ball balanced on the beam as long as possible. The beam tilts randomly — counteract it!',
    interactionHint: 'Arrow Keys / Mouse Position',
    scoringHint: 'Longest Survival Time',
    durationSec: (d) => (d === 1 ? 12 : d === 2 ? 10 : 8),
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 12, smMin: 0, smMax: 20 },
    getStars: (result) => {
      const maxTime = result.secondaryMetric && result.secondaryMetric > 0 ? result.secondaryMetric : 12;
      const ratio = result.primaryMetric / maxTime;
      if (ratio >= 0.85) return 3;
      if (ratio >= 0.5) return 2;
      return 1;
    },
  },
  {
    id: 'reaction-tap',
    displayName: 'Reaction Tap',
    instructions: "Tap when the panel turns green. Don't tap too early!",
    interactionHint: 'Click / Space',
    scoringHint: 'Lowest Reaction Time',
    durationSec: (_d, a) => (a ? 10 : 8),
    performanceDimension: 'reaction',
    bounds: { pmMin: 0, pmMax: 5000 },
    getStars: (result) => {
      if (result.primaryMetric < 180) return 3;
      if (result.primaryMetric <= 300) return 2;
      return 1;
    },
  },
  {
    id: 'system-purge',
    displayName: 'System Purge',
    instructions: 'Type the valid commands. Use Spacebar to skip corrupted commands.',
    interactionHint: 'Type or Skip',
    scoringHint: 'Highest Score',
    durationSec: (d) => 15 - d,
    performanceDimension: 'typing',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? result.primaryMetric / total : 0;
      if (accuracy >= 0.9) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'type-burst',
    displayName: 'Type Burst',
    instructions: 'Type the phrase exactly as shown. Correct errors to finish.',
    interactionHint: 'Type the Phrase',
    scoringHint: 'High WPM & Accuracy',
    durationSec: (_d, a) => (a ? 15 : 12),
    performanceDimension: 'typing',
    bounds: { pmMin: 0, pmMax: 200, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const wpm = result.primaryMetric;
      const errors = result.secondaryMetric ?? 99;
      if (errors <= 1 && wpm >= 55) return 3;
      if (errors <= 3 && wpm >= 40) return 2;
      return 1;
    },
  },
  {
    id: 'quick-quiz',
    displayName: 'Quick Quiz',
    instructions: 'Answer 3 questions as quickly as possible.',
    interactionHint: 'Click Answer',
    scoringHint: 'Correct & Fast Answers',
    durationSec: () => 12,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 10, smMin: 0, smMax: 60000 },
    getStars: (result) => {
      const correctCount = result.primaryMetric;
      const totalTimeMs = result.secondaryMetric ?? 12000;
      const avgTimeMs = correctCount > 0 ? totalTimeMs / correctCount : 9999;
      if (correctCount === 3 && avgTimeMs < 1500) return 3;
      if (correctCount === 3 || correctCount === 2) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'aim-flick',
    displayName: 'Aim Flick',
    instructions: 'Drag and release to shoot the projectile into the goal.',
    interactionHint: 'Drag & Release',
    scoringHint: 'Score on 1st/2nd Try',
    durationSec: () => 10,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 3 },
    getStars: (result) => {
      if (result.primaryMetric === 1) return 3;
      if (result.primaryMetric === 2) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'memory-flip',
    displayName: 'Memory Flip',
    instructions: 'Find all the matching pairs of cards.',
    interactionHint: 'Click Cards',
    scoringHint: 'Few Errors, Fast Time',
    durationSec: () => 20,
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 60000 },
    getStars: (result) => {
      const errors = result.primaryMetric;
      const timeMs = result.secondaryMetric ?? 20000;
      if (timeMs < 14000 && errors <= 2) return 3;
      if (timeMs < 20000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'slider-precision',
    displayName: 'Slider Precision',
    instructions: 'Stop the slider at the target value.',
    interactionHint: 'Click / Space',
    scoringHint: 'Stop Closest to Target',
    durationSec: () => 10,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric <= 3) return 3;
      if (result.primaryMetric <= 8) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'pattern-recall',
    displayName: 'Pattern Recall',
    instructions: 'Memorize and repeat the sequence.',
    interactionHint: 'Click Pads',
    scoringHint: 'Perfect Sequence Recall',
    durationSec: () => 15,
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? result.primaryMetric / total : 0;
      if (accuracy >= 1) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'evade-grid',
    displayName: 'Evade Grid',
    instructions: 'Survive the hazards until the timer runs out.',
    interactionHint: 'Arrow Keys / WASD',
    scoringHint: 'Fewest Hits Taken',
    durationSec: () => 15,
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric === 0) return 3;
      if (result.primaryMetric <= 2) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'jump-bar',
    displayName: 'Jump Bar',
    instructions: 'Time your jump to clear the bar.',
    interactionHint: 'Click / Space to Jump',
    scoringHint: 'Clear All Bars',
    durationSec: (difficulty) => 15 + difficulty * 5,
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      if (result.primaryMetric === total) return 3;
      if (result.primaryMetric >= total - 1 && total > 1) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'wire-link',
    displayName: 'Wire Link',
    instructions: 'Connect the matching nodes without crossing wires.',
    interactionHint: 'Drag to Connect',
    scoringHint: 'Fastest Completion Time',
    durationSec: (d) => 15 + d * 5,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 120000 },
    getStars: (result) => {
      if (result.primaryMetric > 90000) return 1;
      if (result.primaryMetric < 15000) return 3;
      if (result.primaryMetric < 25000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'maze-micro',
    displayName: 'Maze Micro',
    instructions: 'Use arrow keys to reach the exit as fast as possible.',
    interactionHint: 'Arrow Keys / WASD',
    scoringHint: 'Fastest Completion Time',
    durationSec: (d) => 12 + d * 3,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 120000 },
    getStars: (result) => {
      if (result.primaryMetric < 8000) return 3;
      if (result.primaryMetric < 12000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'find-pixel',
    displayName: 'Find the Missing Pixel',
    instructions: 'Spot the difference between the two images.',
    interactionHint: 'Click the Different Pixel',
    scoringHint: 'Find it Quickly',
    durationSec: () => 12,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 120000 },
    getStars: (result) => {
      if (result.primaryMetric < 4000) return 3;
      if (result.primaryMetric < 8000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'target-practice',
    displayName: 'Target Practice',
    instructions: "Click on the targets as they appear. Don't miss!",
    interactionHint: 'Click Targets',
    scoringHint: 'Highest Accuracy',
    durationSec: () => 10,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = result.primaryMetric / total;
      if (accuracy >= 0.9) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'rhythm-tap',
    displayName: 'Rhythm Tap',
    instructions: 'Tap the spacebar in time with the pulse.',
    interactionHint: 'Click / Space on Beat',
    scoringHint: 'Highest Timing Score',
    durationSec: () => 12,
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 300, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const totalBeats = result.secondaryMetric ?? 1;
      const maxScore = totalBeats * 3;
      if (maxScore === 0) return 1;
      const ratio = result.primaryMetric / maxScore;
      if (ratio >= 0.8) return 3;
      if (ratio >= 0.5) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'sequence-sort',
    displayName: 'Sequence Sort',
    instructions: 'Memorize the number sequence, then click them in the correct order.',
    interactionHint: 'Click Numbers in Order',
    scoringHint: 'Perfect Sequence Recall',
    durationSec: () => 15,
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? result.primaryMetric / total : 0;
      if (accuracy >= 1) return 3;
      if (accuracy >= 0.7) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'asteroid-dodge',
    displayName: 'Asteroid Dodge',
    instructions: 'Use the arrow keys to dodge the falling asteroids.',
    interactionHint: 'Arrow Keys / A/D',
    scoringHint: 'Fewest Hits Taken',
    durationSec: () => 12,
    performanceDimension: 'reaction',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric === 0) return 3;
      if (result.primaryMetric <= 2) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'path-tracer',
    displayName: 'Path Tracer',
    instructions: 'Trace the path with your mouse without leaving the lines.',
    interactionHint: 'Trace with Mouse',
    scoringHint: 'Highest Completion %',
    durationSec: () => 15,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric >= 99) return 3;
      if (result.primaryMetric >= 80) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'code-breaker',
    displayName: 'Code Breaker',
    instructions: 'Guess the secret code using the clues provided.',
    interactionHint: 'Click Numbers & Submit',
    scoringHint: 'Fewest Guesses',
    durationSec: (d) => 20 + d * 5,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 20 },
    getStars: (result) => {
      if (result.primaryMetric <= 4) return 3;
      if (result.primaryMetric <= 7) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'quick-math',
    displayName: 'Quick Math',
    instructions: 'Solve as many math problems as you can before time runs out.',
    interactionHint: 'Type Answer & Enter',
    scoringHint: 'Most Correct Answers',
    durationSec: () => 15,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 20 },
    getStars: (result) => {
      if (result.primaryMetric >= 8) return 3;
      if (result.primaryMetric >= 5) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'color-math',
    displayName: 'Color Math',
    instructions: 'Adjust the sliders to match the target color.',
    interactionHint: 'Move Sliders & Submit',
    scoringHint: 'Lowest Color Difference',
    durationSec: (d) => 12 + d,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric <= 4) return 3;
      if (result.primaryMetric <= 8) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'angle-nudge',
    displayName: 'Angle Nudge',
    instructions: 'Rotate the dial to the target angle and confirm.',
    interactionHint: 'Drag Dial & Confirm',
    scoringHint: 'Lowest Average Error',
    durationSec: () => 15,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric <= 2) return 3;
      if (result.primaryMetric <= 5) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'type-racer-snippet',
    displayName: 'Type-Racer Snippet',
    instructions: 'Type the short phrase as fast as possible. You must correct errors.',
    interactionHint: 'Type the Snippet',
    scoringHint: 'Lowest Time',
    durationSec: (_d, a) => (a ? 10 : 8),
    performanceDimension: 'typing',
    bounds: { pmMin: 0, pmMax: 120000 },
    getStars: (result) => {
      if (result.primaryMetric < 4000) return 3;
      if (result.primaryMetric < 6000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'snapshot-memory',
    displayName: 'Snapshot Memory',
    instructions: 'Memorize the grid, then answer questions about the symbol locations.',
    interactionHint: 'Click Grid Cell',
    scoringHint: 'Most Correct Answers',
    durationSec: (d) => 12 + d,
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 3 },
    getStars: (result) => {
      if (result.primaryMetric === 3) return 3;
      if (result.primaryMetric === 2) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'burst-clicks',
    displayName: 'Burst Clicks',
    instructions: 'Click the target as fast as you can for 5 seconds. Avoid inhuman speeds!',
    interactionHint: 'Click the Target',
    scoringHint: 'Highest Clicks/Second',
    durationSec: () => 5,
    performanceDimension: 'reaction',
    bounds: { pmMin: 0, pmMax: 1000 },
    getStars: (result) => {
      if (result.primaryMetric >= 10) return 3;
      if (result.primaryMetric >= 7) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'sprint-mash',
    displayName: 'Sprint Mash',
    instructions: 'Alternate keys (A/D) with a steady rhythm to sprint. Spamming will stall you!',
    interactionHint: 'Alternate A & D',
    scoringHint: 'Maintain Good Rhythm',
    durationSec: () => 7,
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 1000 },
    getStars: (result) => {
      if (result.primaryMetric >= 100) return 3;
      if (result.primaryMetric >= 80) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'ghost-trajectory',
    displayName: 'Ghost Trajectory',
    instructions: 'Watch the launch, then click where you think the object will land.',
    interactionHint: 'Click Landing Spot',
    scoringHint: 'Lowest Guess Error',
    durationSec: (d) => 10 + d,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 120000 },
    getStars: (result) => {
      if (result.primaryMetric <= 20) return 3;
      if (result.primaryMetric <= 45) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'emoji-cipher',
    displayName: 'Emoji Cipher',
    instructions: 'Use the legend to decode the secret word.',
    interactionHint: 'Type the Word',
    scoringHint: 'Decode Correctly & Fast',
    durationSec: (d) => 15 + d,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 60000 },
    getStars: (result) => {
      const timeMs = result.secondaryMetric ?? 99999;
      if (result.primaryMetric >= 95 && timeMs < 12000) return 3;
      if (result.primaryMetric >= 85 && timeMs < 18000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'audio-beat',
    displayName: 'Audio Beat Match',
    instructions: 'Select the option that matches the reference beat.',
    interactionHint: 'Click Matching Beat',
    scoringHint: 'Correct & Fast',
    durationSec: (_d, a) => (a ? 15 : 12),
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 1, smMin: 0, smMax: 60000 },
    getStars: (result) => {
      const isCorrect = result.primaryMetric === 1;
      const timeMs = result.secondaryMetric ?? 99999;
      if (isCorrect && timeMs < 6000) return 3;
      if (isCorrect) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'whack-a-mole',
    displayName: 'Whack-a-Mole',
    instructions: 'Click the moles before they retreat!',
    interactionHint: 'Click Moles',
    scoringHint: 'Highest Hit Rate',
    durationSec: () => 12,
    performanceDimension: 'reaction',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = result.primaryMetric / total;
      if (accuracy >= 0.9) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'stop-the-clock',
    displayName: 'Stop the Clock',
    instructions: 'Stop the timer at the exact target time. 3 rounds, lowest average error wins!',
    interactionHint: 'Click / Space to Stop',
    scoringHint: 'Lowest Average Error',
    durationSec: () => 15,
    performanceDimension: 'reaction',
    bounds: { pmMin: 0, pmMax: 10000 },
    getStars: (result) => {
      if (result.primaryMetric <= 50) return 3;
      if (result.primaryMetric <= 150) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'word-storm',
    displayName: 'Word Storm',
    instructions: 'Type the falling words to destroy them before they hit the bottom!',
    interactionHint: 'Type Falling Words',
    scoringHint: 'Highest Destroy Rate',
    durationSec: (d) => 15 - d,
    performanceDimension: 'typing',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = result.primaryMetric / total;
      if (accuracy >= 0.9) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'anagram-rush',
    displayName: 'Anagram Rush',
    instructions: 'Unscramble as many words as you can before time runs out!',
    interactionHint: 'Type Unscrambled Word + Enter',
    scoringHint: 'Most Words Solved',
    durationSec: (d) => 12 + d,
    performanceDimension: 'typing',
    bounds: { pmMin: 0, pmMax: 20 },
    getStars: (result) => {
      if (result.primaryMetric >= 5) return 3;
      if (result.primaryMetric >= 3) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'dial-lock',
    displayName: 'Dial Lock',
    instructions: 'Rotate the dial to find the hidden unlock position. Warm/cold feedback guides you. 3 locks!',
    interactionHint: 'Drag / Arrow Keys + Enter',
    scoringHint: 'Lowest Total Angular Error',
    durationSec: (d) => 15 + d * 5,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric <= 15) return 3;
      if (result.primaryMetric <= 40) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'pixel-push',
    displayName: 'Pixel Push',
    instructions: 'Push the block into the target zone. It has momentum — tap carefully! 3 rounds.',
    interactionHint: 'Arrow Keys to Push',
    scoringHint: 'Most Rounds in Zone',
    durationSec: () => 15,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric >= 3) return 3;
      if (result.primaryMetric >= 2) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'mirror-draw',
    displayName: 'Mirror Draw',
    instructions: 'Trace the shape — but your cursor is mirrored horizontally!',
    interactionHint: 'Move Mouse (Mirrored)',
    scoringHint: 'Highest Completion %',
    durationSec: (d) => 12 + d,
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric >= 90) return 3;
      if (result.primaryMetric >= 70) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'number-stack',
    displayName: 'Number Stack',
    instructions: 'Memorize the number sequence, then type it in REVERSE order!',
    interactionHint: 'Type Numbers + Enter',
    scoringHint: 'Perfect Reverse Recall',
    durationSec: (d) => 10 + d * 3,
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? result.primaryMetric / total : 0;
      if (accuracy >= 1) return 3;
      if (accuracy >= 0.7) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'symbol-match',
    displayName: 'Symbol Match',
    instructions: 'Memorize the symbol set, then click only those symbols from the grid.',
    interactionHint: 'Click Matching Symbols',
    scoringHint: 'All Correct, No Wrong',
    durationSec: (_d, a) => (a ? 15 : 12),
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const wrong = result.secondaryMetric ?? 99;
      const targetCount = 4;
      if (result.primaryMetric >= targetCount && wrong === 0) return 3;
      if (result.primaryMetric >= targetCount - 1 && wrong <= 1) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'drum-echo',
    displayName: 'Drum Echo',
    instructions: 'Watch the drum pattern, then reproduce it on the pads with the same rhythm!',
    interactionHint: 'Click Drum Pads',
    scoringHint: 'Highest Timing Score',
    durationSec: (d) => 12 + d,
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 300, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const totalHits = result.secondaryMetric ?? 1;
      const maxScore = totalHits * 3;
      if (maxScore === 0) return 1;
      const ratio = result.primaryMetric / maxScore;
      if (ratio >= 0.8) return 3;
      if (ratio >= 0.5) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'wave-ride',
    displayName: 'Wave Ride',
    instructions: 'Keep your marker on the scrolling sine wave. The wave shifts over time!',
    interactionHint: 'Mouse / Arrow Keys',
    scoringHint: 'Highest Time on Wave',
    durationSec: (d) => 10 + d,
    performanceDimension: 'rhythm',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric >= 85) return 3;
      if (result.primaryMetric >= 60) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'color-sort',
    displayName: 'Color Sort',
    instructions: 'Click the matching colored bin to sort each falling orb. Speed up!',
    interactionHint: 'Click Colored Bins',
    scoringHint: 'Highest Sort Accuracy',
    durationSec: () => 12,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = result.primaryMetric / total;
      if (accuracy >= 0.95) return 3;
      if (accuracy >= 0.75) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'flow-connect',
    displayName: 'Flow Connect',
    instructions: 'Rotate the pipe tiles to connect the source to the destination.',
    interactionHint: 'Click Tiles to Rotate',
    scoringHint: 'Fastest Completion Time',
    durationSec: (d) => 20 + d * 5,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 120000 },
    getStars: (result) => {
      if (result.primaryMetric >= 99999) return 1;
      if (result.primaryMetric < 15000) return 3;
      if (result.primaryMetric < 30000) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'logic-gates',
    displayName: 'Logic Gates',
    instructions: 'Determine the output of each logic gate circuit. Answer as many as you can!',
    interactionHint: 'Click 0 or 1',
    scoringHint: 'Highest Accuracy',
    durationSec: (d) => 12 + d,
    performanceDimension: 'logic',
    bounds: { pmMin: 0, pmMax: 100, smMin: 0, smMax: 100 },
    getStars: (result) => {
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = result.primaryMetric / total;
      if (accuracy >= 0.9) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'tilt-maze',
    displayName: 'Tilt Maze',
    instructions: 'Navigate the ball through the maze to the exit. Tilt with arrow keys or mouse movement!',
    interactionHint: 'Arrow Keys / Mouse',
    scoringHint: 'Fastest Exit Time',
    durationSec: (d) => (d === 1 ? 25 : d === 2 ? 20 : 15),
    performanceDimension: 'precision',
    bounds: { pmMin: 0, pmMax: 100 },
    getStars: (result) => {
      if (result.primaryMetric <= 10) return 3;
      if (result.primaryMetric <= 18) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'chord-memory',
    displayName: 'Chord Memory',
    instructions: 'Watch the sequence of colored notes light up, then replay them in order. The sequence grows!',
    interactionHint: 'Click Colored Pads',
    scoringHint: 'Longest Correct Sequence',
    durationSec: (d, a) => (a ? 15 : 12) + d * 2,
    performanceDimension: 'memory',
    bounds: { pmMin: 0, pmMax: 30 },
    getStars: (result) => {
      if (result.primaryMetric >= 7) return 3;
      if (result.primaryMetric >= 4) return 2;
      return 1;
    },
    isStub: false,
  },
  {
    id: 'word-scramble',
    displayName: 'Word Scramble',
    instructions: 'Unscramble the jumbled cyberpunk words as fast as you can!',
    interactionHint: 'Type + Enter',
    scoringHint: 'Most Words Solved',
    durationSec: (d) => 15 + d * 5,
    performanceDimension: 'typing',
    bounds: { pmMin: 0, pmMax: 20 },
    getStars: (result) => {
      if (result.primaryMetric >= 5) return 3;
      if (result.primaryMetric >= 3) return 2;
      return 1;
    },
    isStub: false,
  },
];

export const EVENT_CATALOG_BY_ID: Record<string, EventCatalogEntry> = Object.fromEntries(
  EVENT_CATALOG.map((entry) => [entry.id, entry])
);

export function getCanonicalEventDurationSec(
  eventId: string,
  difficulty: number,
  accessibility: boolean = false,
  anomalyId?: string | null
): number {
  const entry = EVENT_CATALOG_BY_ID[eventId];
  const baseSec = entry ? entry.durationSec(difficulty, accessibility) : 15;
  return anomalyId === 'TIME_DILATION' ? baseSec * 0.8 : baseSec;
}

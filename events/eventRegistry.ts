
import { GameEvent } from '../types';
import { ReactionTap } from './ReactionTap';
import { TypeBurst } from './TypeBurst';
import { EventStub } from './EventStub';
import { SliderPrecision } from './SliderPrecision';
import { PatternRecall } from './PatternRecall';
import { EvadeGrid } from './EvadeGrid';
import { JumpBar } from './JumpBar';
import { WireLink } from './WireLink';
import { FindPixel } from './FindPixel';
import { TargetPractice } from './TargetPractice';
import { RhythmTap } from './RhythmTap';
import { SequenceSort } from './SequenceSort';
import { AsteroidDodge } from './AsteroidDodge';
import { PathTracer } from './PathTracer';
import { CodeBreaker } from './CodeBreaker';
import { QuickMath } from './QuickMath';
import { QuickQuiz } from './QuickQuiz';
import { MemoryFlip } from './MemoryFlip';
import { AimFlick } from './AimFlick';
import { MazeMicro } from './MazeMicro';
import { ColorMath } from './ColorMath';
import { AngleNudge } from './AngleNudge';
import { TypeRacerSnippet } from './TypeRacerSnippet';
import { SnapshotMemory } from './SnapshotMemory';
import { BurstClicks } from './BurstClicks';
import { SprintMash } from './SprintMash';
import { GhostTrajectory } from './GhostTrajectory';
import { EmojiCipher } from './EmojiCipher';
import { AudioBeat } from './AudioBeat';
import { SystemPurge } from './SystemPurge';
import { BalanceBeam } from './BalanceBeam';
import { WhackAMole } from './WhackAMole';
import { StopTheClock } from './StopTheClock';
import { WordStorm } from './WordStorm';
import { AnagramRush } from './AnagramRush';
import { DialLock } from './DialLock';
import { PixelPush } from './PixelPush';
import { MirrorDraw } from './MirrorDraw';
import { NumberStack } from './NumberStack';
import { SymbolMatch } from './SymbolMatch';
import { DrumEcho } from './DrumEcho';
import { WaveRide } from './WaveRide';
import { ColorSort } from './ColorSort';
import { FlowConnect } from './FlowConnect';
import { LogicGates } from './LogicGates';

export const eventRegistry: GameEvent[] = [
  // --- Fully Implemented Events ---
  {
    id: 'balance-beam',
    displayName: 'Balance Beam',
    instructions: 'Keep the ball balanced on the beam as long as possible. The beam tilts randomly — counteract it!',
    interactionHint: 'Arrow Keys / Mouse Position',
    scoringHint: 'Longest Survival Time',
    durationSec: (d) => d === 1 ? 12 : d === 2 ? 10 : 8,
    performanceDimension: 'precision',
    Component: BalanceBeam,
    getStars: (result) => {
      const maxTime = 12;
      const ratio = result.primaryMetric / maxTime;
      if (ratio >= 0.85) return 3;
      if (ratio >= 0.5) return 2;
      return 1;
    },
  },
  {
    id: 'reaction-tap',
    displayName: 'Reaction Tap',
    instructions: 'Tap when the panel turns green. Don\'t tap too early!',
    interactionHint: 'Click / Space',
    scoringHint: 'Lowest Reaction Time',
    durationSec: (d, a) => (a ? 10 : 8),
    performanceDimension: 'reaction',
    Component: ReactionTap,
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
    durationSec: (d) => 15 - d, // 14, 13, 12s
    performanceDimension: 'typing',
    Component: SystemPurge,
    getStars: (result) => {
        const score = result.primaryMetric;
        const total = result.secondaryMetric ?? 1;
        const accuracy = total > 0 ? score / total : 0;
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
    durationSec: (d, a) => (a ? 15 : 12),
    performanceDimension: 'typing',
    Component: TypeBurst,
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
    durationSec: () => 12, // 3 questions * 4s each
    performanceDimension: 'logic',
    Component: QuickQuiz,
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
    Component: AimFlick,
    getStars: (result) => {
      const attempts = result.primaryMetric; // 1 for first try, 2 for second, 0 or >2 for miss
      if (attempts === 1) return 3;
      if (attempts === 2) return 2;
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
    Component: MemoryFlip,
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
    Component: SliderPrecision,
    getStars: (result) => {
      const distance = result.primaryMetric;
      if (distance <= 3) return 3;
      if (distance <= 8) return 2;
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
    Component: PatternRecall,
    getStars: (result) => {
      const correct = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? correct / total : 0;
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
    Component: EvadeGrid,
    getStars: (result) => {
        const hits = result.primaryMetric;
        if (hits === 0) return 3;
        if (hits <= 2) return 2;
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
    Component: JumpBar,
    getStars: (result) => {
        const successful = result.primaryMetric;
        const total = result.secondaryMetric ?? 1;
        // Handle case where total is 0 to avoid division by zero
        if (total === 0) return 1;
        if (successful === total) return 3;
        // Allow for one mistake for 2 stars, if there was more than one round
        if (successful >= total - 1 && total > 1) return 2;
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
    Component: WireLink,
    getStars: (result) => {
        const timeMs = result.primaryMetric;
        if (timeMs > 90000) return 1; // Penalty for not finishing
        if (timeMs < 15000) return 3;
        if (timeMs < 25000) return 2;
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
    Component: MazeMicro,
    getStars: (result) => {
      const timeMs = result.primaryMetric;
      if (timeMs < 8000) return 3;
      if (timeMs < 12000) return 2;
      return 1; // Includes timeout penalty
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
    Component: FindPixel,
    getStars: (result) => {
      const timeMs = result.primaryMetric;
      if (timeMs < 4000) return 3;
      if (timeMs < 8000) return 2;
      return 1; // Includes failures (metric > 8000)
    },
    isStub: false,
  },
  {
    id: 'target-practice',
    displayName: 'Target Practice',
    instructions: 'Click on the targets as they appear. Don\'t miss!',
    interactionHint: 'Click Targets',
    scoringHint: 'Highest Accuracy',
    durationSec: () => 10,
    performanceDimension: 'precision',
    Component: TargetPractice,
    getStars: (result) => {
      const hits = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = hits / total;
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
    Component: RhythmTap,
    getStars: (result) => {
      const score = result.primaryMetric;
      const totalBeats = result.secondaryMetric ?? 1;
      const maxScore = totalBeats * 3;
      if (maxScore === 0) return 1;
      const ratio = score / maxScore;
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
    Component: SequenceSort,
    getStars: (result) => {
      const correct = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? correct / total : 0;
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
    Component: AsteroidDodge,
    getStars: (result) => {
        const hits = result.primaryMetric;
        if (hits === 0) return 3;
        if (hits <= 2) return 2;
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
    Component: PathTracer,
    getStars: (result) => {
      const completion = result.primaryMetric;
      if (completion >= 99) return 3;
      if (completion >= 80) return 2;
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
    Component: CodeBreaker,
    getStars: (result) => {
      const guesses = result.primaryMetric;
      if (guesses <= 4) return 3;
      if (guesses <= 7) return 2;
      return 1; // Includes failures (metric > 7)
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
    Component: QuickMath,
    getStars: (result) => {
      const score = result.primaryMetric;
      if (score >= 8) return 3;
      if (score >= 5) return 2;
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
    durationSec: (d) => 12 + d, // 13, 14, 15s
    performanceDimension: 'precision',
    Component: ColorMath,
    getStars: (result) => {
        const deltaE = result.primaryMetric;
        if (deltaE <= 4) return 3;
        if (deltaE <= 8) return 2;
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
    durationSec: () => 15, // Fixed time for 3 rounds
    performanceDimension: 'precision',
    Component: AngleNudge,
    getStars: (result) => {
        const meanError = result.primaryMetric;
        if (meanError <= 2) return 3;
        if (meanError <= 5) return 2;
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
    durationSec: (d, a) => (a ? 10 : 8),
    performanceDimension: 'typing',
    Component: TypeRacerSnippet,
    getStars: (result) => {
      const timeMs = result.primaryMetric;
      if (timeMs < 4000) return 3;
      if (timeMs < 6000) return 2;
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
    durationSec: (d, a) => 12 + d, // 13, 14, 15s
    performanceDimension: 'memory',
    Component: SnapshotMemory,
    getStars: (result) => {
      const correct = result.primaryMetric;
      if (correct === 3) return 3;
      if (correct === 2) return 2;
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
    Component: BurstClicks,
    getStars: (result) => {
      const cps = result.primaryMetric;
      if (cps >= 10) return 3;
      if (cps >= 7) return 2;
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
    Component: SprintMash,
    getStars: (result) => {
      const progress = result.primaryMetric; // 0-100
      if (progress >= 100) return 3;
      if (progress >= 80) return 2;
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
    durationSec: (d) => 10 + d, // 11, 12, 13s
    performanceDimension: 'precision',
    Component: GhostTrajectory,
    getStars: (result) => {
        const avgError = result.primaryMetric;
        if (avgError <= 20) return 3;
        if (avgError <= 45) return 2;
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
    durationSec: (d) => 15 + d, // 16, 17, 18s
    performanceDimension: 'logic',
    Component: EmojiCipher,
    getStars: (result) => {
      const accuracy = result.primaryMetric; // 0-100
      const timeMs = result.secondaryMetric ?? 99999;
      if (accuracy >= 95 && timeMs < 12000) return 3;
      if (accuracy >= 85 && timeMs < 18000) return 2;
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
    durationSec: (d, a) => (a ? 15 : 12),
    performanceDimension: 'rhythm',
    Component: AudioBeat,
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
    Component: WhackAMole,
    getStars: (result) => {
      const hits = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = hits / total;
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
    Component: StopTheClock,
    getStars: (result) => {
      const avgError = result.primaryMetric;
      if (avgError <= 50) return 3;
      if (avgError <= 150) return 2;
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
    Component: WordStorm,
    getStars: (result) => {
      const destroyed = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = destroyed / total;
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
    Component: AnagramRush,
    getStars: (result) => {
      const correct = result.primaryMetric;
      if (correct >= 5) return 3;
      if (correct >= 3) return 2;
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
    Component: DialLock,
    getStars: (result) => {
      const totalError = result.primaryMetric;
      if (totalError <= 15) return 3;
      if (totalError <= 40) return 2;
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
    Component: PixelPush,
    getStars: (result) => {
      const rounds = result.primaryMetric;
      if (rounds >= 3) return 3;
      if (rounds >= 2) return 2;
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
    Component: MirrorDraw,
    getStars: (result) => {
      const completion = result.primaryMetric;
      if (completion >= 90) return 3;
      if (completion >= 70) return 2;
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
    Component: NumberStack,
    getStars: (result) => {
      const correct = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      const accuracy = total > 0 ? correct / total : 0;
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
    durationSec: (d, a) => (a ? 15 : 12),
    performanceDimension: 'memory',
    Component: SymbolMatch,
    getStars: (result) => {
      const correct = result.primaryMetric;
      const wrong = result.secondaryMetric ?? 99;
      const targetCount = 3 + 1; // minimum setCount
      if (correct >= targetCount && wrong === 0) return 3;
      if (correct >= targetCount - 1 && wrong <= 1) return 2;
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
    Component: DrumEcho,
    getStars: (result) => {
      const score = result.primaryMetric;
      const totalHits = result.secondaryMetric ?? 1;
      const maxScore = totalHits * 3;
      if (maxScore === 0) return 1;
      const ratio = score / maxScore;
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
    Component: WaveRide,
    getStars: (result) => {
      const pct = result.primaryMetric;
      if (pct >= 85) return 3;
      if (pct >= 60) return 2;
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
    Component: ColorSort,
    getStars: (result) => {
      const correct = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = correct / total;
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
    Component: FlowConnect,
    getStars: (result) => {
      const timeMs = result.primaryMetric;
      if (timeMs >= 99999) return 1;
      if (timeMs < 15000) return 3;
      if (timeMs < 30000) return 2;
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
    Component: LogicGates,
    getStars: (result) => {
      const correct = result.primaryMetric;
      const total = result.secondaryMetric ?? 1;
      if (total === 0) return 1;
      const accuracy = correct / total;
      if (accuracy >= 0.9) return 3;
      if (accuracy >= 0.6) return 2;
      return 1;
    },
    isStub: false,
  },
];

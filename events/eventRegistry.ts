import React from 'react';
import { GameEvent, EventProps } from '../types';
import { EVENT_CATALOG } from '../shared/eventCatalog';

// v5.0: Lazy-load all event components for code splitting
const ReactionTap = React.lazy(() => import('./ReactionTap').then(m => ({ default: m.ReactionTap })));
const TypeBurst = React.lazy(() => import('./TypeBurst').then(m => ({ default: m.TypeBurst })));
const SliderPrecision = React.lazy(() => import('./SliderPrecision').then(m => ({ default: m.SliderPrecision })));
const PatternRecall = React.lazy(() => import('./PatternRecall').then(m => ({ default: m.PatternRecall })));
const EvadeGrid = React.lazy(() => import('./EvadeGrid').then(m => ({ default: m.EvadeGrid })));
const JumpBar = React.lazy(() => import('./JumpBar').then(m => ({ default: m.JumpBar })));
const WireLink = React.lazy(() => import('./WireLink').then(m => ({ default: m.WireLink })));
const FindPixel = React.lazy(() => import('./FindPixel').then(m => ({ default: m.FindPixel })));
const TargetPractice = React.lazy(() => import('./TargetPractice').then(m => ({ default: m.TargetPractice })));
const RhythmTap = React.lazy(() => import('./RhythmTap').then(m => ({ default: m.RhythmTap })));
const SequenceSort = React.lazy(() => import('./SequenceSort').then(m => ({ default: m.SequenceSort })));
const AsteroidDodge = React.lazy(() => import('./AsteroidDodge').then(m => ({ default: m.AsteroidDodge })));
const PathTracer = React.lazy(() => import('./PathTracer').then(m => ({ default: m.PathTracer })));
const CodeBreaker = React.lazy(() => import('./CodeBreaker').then(m => ({ default: m.CodeBreaker })));
const QuickMath = React.lazy(() => import('./QuickMath').then(m => ({ default: m.QuickMath })));
const QuickQuiz = React.lazy(() => import('./QuickQuiz').then(m => ({ default: m.QuickQuiz })));
const MemoryFlip = React.lazy(() => import('./MemoryFlip').then(m => ({ default: m.MemoryFlip })));
const AimFlick = React.lazy(() => import('./AimFlick').then(m => ({ default: m.AimFlick })));
const MazeMicro = React.lazy(() => import('./MazeMicro').then(m => ({ default: m.MazeMicro })));
const ColorMath = React.lazy(() => import('./ColorMath').then(m => ({ default: m.ColorMath })));
const AngleNudge = React.lazy(() => import('./AngleNudge').then(m => ({ default: m.AngleNudge })));
const TypeRacerSnippet = React.lazy(() => import('./TypeRacerSnippet').then(m => ({ default: m.TypeRacerSnippet })));
const SnapshotMemory = React.lazy(() => import('./SnapshotMemory').then(m => ({ default: m.SnapshotMemory })));
const BurstClicks = React.lazy(() => import('./BurstClicks').then(m => ({ default: m.BurstClicks })));
const SprintMash = React.lazy(() => import('./SprintMash').then(m => ({ default: m.SprintMash })));
const GhostTrajectory = React.lazy(() => import('./GhostTrajectory').then(m => ({ default: m.GhostTrajectory })));
const EmojiCipher = React.lazy(() => import('./EmojiCipher').then(m => ({ default: m.EmojiCipher })));
const AudioBeat = React.lazy(() => import('./AudioBeat').then(m => ({ default: m.AudioBeat })));
const SystemPurge = React.lazy(() => import('./SystemPurge').then(m => ({ default: m.SystemPurge })));
const BalanceBeam = React.lazy(() => import('./BalanceBeam').then(m => ({ default: m.BalanceBeam })));
const WhackAMole = React.lazy(() => import('./WhackAMole').then(m => ({ default: m.WhackAMole })));
const StopTheClock = React.lazy(() => import('./StopTheClock').then(m => ({ default: m.StopTheClock })));
const WordStorm = React.lazy(() => import('./WordStorm').then(m => ({ default: m.WordStorm })));
const AnagramRush = React.lazy(() => import('./AnagramRush').then(m => ({ default: m.AnagramRush })));
const DialLock = React.lazy(() => import('./DialLock').then(m => ({ default: m.DialLock })));
const PixelPush = React.lazy(() => import('./PixelPush').then(m => ({ default: m.PixelPush })));
const MirrorDraw = React.lazy(() => import('./MirrorDraw').then(m => ({ default: m.MirrorDraw })));
const NumberStack = React.lazy(() => import('./NumberStack').then(m => ({ default: m.NumberStack })));
const SymbolMatch = React.lazy(() => import('./SymbolMatch').then(m => ({ default: m.SymbolMatch })));
const DrumEcho = React.lazy(() => import('./DrumEcho').then(m => ({ default: m.DrumEcho })));
const WaveRide = React.lazy(() => import('./WaveRide').then(m => ({ default: m.WaveRide })));
const ColorSort = React.lazy(() => import('./ColorSort').then(m => ({ default: m.ColorSort })));
const FlowConnect = React.lazy(() => import('./FlowConnect').then(m => ({ default: m.FlowConnect })));
const LogicGates = React.lazy(() => import('./LogicGates').then(m => ({ default: m.LogicGates })));
const TiltMaze = React.lazy(() => import('./TiltMaze').then(m => ({ default: m.TiltMaze })));
const ChordMemory = React.lazy(() => import('./ChordMemory').then(m => ({ default: m.ChordMemory })));
const WordScramble = React.lazy(() => import('./WordScramble').then(m => ({ default: m.WordScramble })));

const EVENT_COMPONENTS: Record<string, React.FC<EventProps>> = {
  'balance-beam': BalanceBeam,
  'reaction-tap': ReactionTap,
  'system-purge': SystemPurge,
  'type-burst': TypeBurst,
  'quick-quiz': QuickQuiz,
  'aim-flick': AimFlick,
  'memory-flip': MemoryFlip,
  'slider-precision': SliderPrecision,
  'pattern-recall': PatternRecall,
  'evade-grid': EvadeGrid,
  'jump-bar': JumpBar,
  'wire-link': WireLink,
  'maze-micro': MazeMicro,
  'find-pixel': FindPixel,
  'target-practice': TargetPractice,
  'rhythm-tap': RhythmTap,
  'sequence-sort': SequenceSort,
  'asteroid-dodge': AsteroidDodge,
  'path-tracer': PathTracer,
  'code-breaker': CodeBreaker,
  'quick-math': QuickMath,
  'color-math': ColorMath,
  'angle-nudge': AngleNudge,
  'type-racer-snippet': TypeRacerSnippet,
  'snapshot-memory': SnapshotMemory,
  'burst-clicks': BurstClicks,
  'sprint-mash': SprintMash,
  'ghost-trajectory': GhostTrajectory,
  'emoji-cipher': EmojiCipher,
  'audio-beat': AudioBeat,
  'whack-a-mole': WhackAMole,
  'stop-the-clock': StopTheClock,
  'word-storm': WordStorm,
  'anagram-rush': AnagramRush,
  'dial-lock': DialLock,
  'pixel-push': PixelPush,
  'mirror-draw': MirrorDraw,
  'number-stack': NumberStack,
  'symbol-match': SymbolMatch,
  'drum-echo': DrumEcho,
  'wave-ride': WaveRide,
  'color-sort': ColorSort,
  'flow-connect': FlowConnect,
  'logic-gates': LogicGates,
  'tilt-maze': TiltMaze,
  'chord-memory': ChordMemory,
  'word-scramble': WordScramble,
};

export const eventRegistry: GameEvent[] = EVENT_CATALOG.map((entry) => ({
  id: entry.id,
  displayName: entry.displayName,
  instructions: entry.instructions,
  interactionHint: entry.interactionHint,
  scoringHint: entry.scoringHint,
  durationSec: entry.durationSec,
  performanceDimension: entry.performanceDimension,
  Component: EVENT_COMPONENTS[entry.id] ?? ReactionTap,
  getStars: entry.getStars,
  isStub: entry.isStub ?? false,
}));

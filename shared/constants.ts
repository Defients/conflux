/**
 * shared/constants.ts
 * 
 * Game constants used by both client and server.
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */

import {
  BotPersonality, BotProfile, PowerUp, TileModifier, ChassisId, Chassis,
  AccoladeId, Accolade, RivalTraitId, RivalTrait, CorporationId, Corporation,
  EventPreset, AnomalyId, Anomaly
} from './types';

export const ANOMALY_DEFINITIONS: { [key in AnomalyId]: Omit<Anomaly, 'id'> } = {
    [AnomalyId.TimeDilation]: { name: 'Time Dilation', description: 'All event timers are reduced by 20%.', icon: '⏳', color: '#ff2a75' },
    [AnomalyId.GravityWell]: { name: 'Gravity Well', description: 'Movement gains are halved for all racers.', icon: '🌌', color: '#3a2b8c' },
    [AnomalyId.DataCorruption]: { name: 'Data Corruption', description: 'UI elements glitch and scramble randomly.', icon: '👾', color: '#00f0ff' },
    [AnomalyId.HyperFlux]: { name: 'Hyper Flux', description: 'Power-ups are twice as effective.', icon: '⚡', color: '#39ff14' },
    [AnomalyId.WarpDrive]: { name: 'Warp Drive', description: 'Passive movement speed doubled for all racers.', icon: '🚀', color: '#00f0ff' },
    [AnomalyId.CosmicStorm]: { name: 'Cosmic Storm', description: 'Random energy surges grant spontaneous Overdrive.', icon: '🌪️', color: '#ffeb3b' },
    [AnomalyId.ChronosShift]: { name: 'Chronos Shift', description: 'The sequence of upcoming events is completely randomized.', icon: '🌀', color: '#a77dff' },
    [AnomalyId.VoidCollapse]: { name: 'Void Collapse', description: 'The track is shorter, but all events are harder.', icon: '🕳️', color: '#8b00ff' },
    [AnomalyId.QuantumEntanglement]: { name: 'Quantum Entanglement', description: 'Power-ups affect a random racer instead of the intended target.', icon: '🔗', color: '#ff00ff' },
};

export const PLAYER_COLORS = [
  '#00dffc', // Player 1 (Human) - Galaxy Cyan
  '#d64f8a', // Player 2 - Nebula Pink
  '#4dffaf', // Player 3 - Hyper Green
  '#ffae42', // Player 4 - Solar Orange
  '#a77dff', // Player 5 - Comet Violet
  '#ff6b6b', // Player 6 - Supernova Red
];

export const RIVAL_NAMES = ["Vector", "Glitch", "Apex", "Jolt", "Orion", "Cipher"];

export const POWERUP_DEFINITIONS: { [key in PowerUp]: { description: string; icon: string } } = {
  'Clarity': { description: 'Instantly removes the Mist Bomb\'s blur effect.', icon: '👁️' },
  'Mist Bomb': { description: 'Blurs opponents\' screens for half of the next event.', icon: '🌫️' },
  'Time Snare': { description: 'Freezes the leader (or 2nd place) on the next tile.', icon: '⏳' },
  'Shield': { description: 'Blocks the next incoming debuff.', icon: '🛡️' },
  'Data Spike': { description: 'Scrambles an opponent\'s upcoming tile view.', icon: '📡' },
};

export const TILE_MODIFIER_DEFINITIONS: { [key in TileModifier]: { description: string; icon: string } } = {
    'BOOST_PAD': { description: '3-Star performance grants double movement!', icon: '🚀' },
    'POWER_SURGE': { description: 'Guaranteed Power-Up reward on completion!', icon: '⚡️' },
    'STATIC_FIELD': { description: 'All Power-Ups are disabled for this tile!', icon: '🚫' },
    'FOG_BANK': { description: 'The next event is hidden until it starts!', icon: '🌫️' },
    'SPONSORED': { description: 'Bonus reputation for high performance!', icon: '🏢' },
};

export const STAR_MOVEMENT_MULTIPLIERS: Record<number, number> = {
  0: 0,
  1: 1.0,
  2: 1.6,
  3: 2.1,
  4: 3.0,
};

export const RUBBER_BAND_THRESHOLD = 2;
export const RUBBER_BAND_BOOST = 0.3;

export const BOT_NAMES = [
  "Cipher", "Vector", "Glitch", "Echo", "Rune", "Bolt", "Apex", "Jolt", "Nova", "Orion", "Pylon"
];

export const BOT_PROFILES: { [key in BotPersonality]: BotProfile } = {
  [BotPersonality.Easy]: {
    reaction: { mean: 320, std: 80, clamp: [140, 700] },
    typing: { wpm: 35, std: 6, errorRate: [0.03, 0.06] },
    precision: { star2Chance: 0.40, star3Chance: 0.15 },
  },
  [BotPersonality.Intermediate]: {
    reaction: { mean: 240, std: 60, clamp: [120, 600] },
    typing: { wpm: 50, std: 7, errorRate: [0.01, 0.04] },
    precision: { star2Chance: 0.55, star3Chance: 0.30 },
  },
  [BotPersonality.Rival]: {
    reaction: { mean: 220, std: 50, clamp: [110, 550] },
    typing: { wpm: 55, std: 6, errorRate: [0.01, 0.03] },
    precision: { star2Chance: 0.60, star3Chance: 0.38 },
  }
};

export const POWERUP_AWARD_RULES: Record<1 | 2 | 3, PowerUp> = {
    1: 'Clarity',
    2: 'Mist Bomb',
    3: 'Data Spike'
};
export const SHIELD_UPGRADE_CHANCE = 0.1;

export const TYPING_PHRASES = {
    standard: [
        "The quick brown fox jumps over the lazy dog.",
        "Cosmic rays shimmered through the asteroid field.",
        "Secure the data network before the breach escalates.",
        "A journey of a thousand miles begins with a single step.",
        "Quantum computing unlocks parallel realities.",
        "Victory is reserved for those willing to pay its price.",
    ],
    accessible: [
        "The big red ball is fun.",
        "See the happy cat play.",
        "My friend has a blue car.",
        "We can go to the park.",
        "I like to read good books.",
        "The sun is very bright today.",
    ]
};

export const TYPING_GLITCH_WORDS = {
    valid: ["ACCESS", "SYSTEM", "ROOT", "GRANT", "KERNEL", "PROXY", "BYPASS", "ADMIN", "EXECUTE", "PURGE"],
    corrupted: ["ACCE55", "5YSTEM", "R00T", "GR@NT", "K3RNEL", "PR0XY", "BYPA55", "ADM1N", "3XECUTE", "PURG3"]
};

export const CP_AWARD_RULES = {
  placement: [50, 35, 25, 15, 10, 5],
  perStar: 2,
  hazardBonus: 25,
  sabotageBonus: 50,
};

export const AVATARS = [
  '👩‍🚀', '👨‍🚀', '🪐', '🤖', '👽', '👾', '🚀', '🛸', '🌌', '⚡', '🛰️', '🔮', '🦾', '🐉'
];

export const CHASSIS_DEFINITIONS: { [key in ChassisId]: Omit<Chassis, 'id'> } = {
  [ChassisId.Standard]: { name: 'Standard Issue', description: 'Balanced starter frame. No bonuses, no drawbacks, fully dependable.', cost: 0, icon: '🔧', stats: { movementGain: 'Balanced', debuffDuration: 'No Penalty' } },
  [ChassisId.Aegis]: { name: 'Aegis Chassis', description: 'Defensive frame. Start each race with a Shield for safer openers and recovery.', cost: 250, icon: '🛡️', stats: { movementGain: 'Defensive Start', debuffDuration: 'No Penalty' } },
  [ChassisId.Momentum]: { name: 'Momentum Chassis', description: 'Snowball frame. Earn a permanent speed boost each time you score 3 stars or better.', cost: 500, icon: '⚡', stats: { movementGain: 'Stacks on 3★+', debuffDuration: 'No Penalty' } },
  [ChassisId.Scavenger]: { name: 'Scavenger Chassis', description: 'Sustain frame. High-end rewards are more likely to convert into Shields.', cost: 350, icon: '♻️', stats: { movementGain: 'Reward Utility', debuffDuration: 'No Penalty' } },
  [ChassisId.GlassCannon]: { name: 'Glass Cannon', description: 'High-risk race frame. Gain more movement from every success, but debuffs hit harder.', cost: 700, icon: '💥', stats: { movementGain: '+15% Movement', debuffDuration: '+1 Tile Debuffs' } },
};

export const ACCOLADE_DEFINITIONS: { [key in AccoladeId]: Omit<Accolade, 'id'> } = {
    [AccoladeId.FirstVictory]: { name: 'First Victory', description: 'Win your first race against any opponents.', icon: '🏆' },
    [AccoladeId.RivalryBegins]: { name: 'Rivalry Begins', description: 'Defeat your persistent Rival for the first time.', icon: '⚔️' },
    [AccoladeId.HazardousDuty]: { name: 'Hazardous Duty', description: 'Accept a Rival\'s Hazard challenge and achieve 3 stars.', icon: '⚠️' },
    [AccoladeId.Perfectionist]: { name: 'Perfectionist', description: 'Finish a race with a perfect 3-star average.', icon: '🌟' },
    [AccoladeId.Overdriver]: { name: 'Overdriver', description: 'Successfully execute an Overdrive for a 4-star result.', icon: '🚀' },
    [AccoladeId.Collector]: { name: 'Collector', description: 'Unlock all available Chassis in the Hangar.', icon: '🛠️' },
};

export const RIVAL_TRAIT_DEFINITIONS: { [key in RivalTraitId]: Omit<RivalTrait, 'id'> } = {
    [RivalTraitId.PrecisionFocus]: { name: 'Precision Focus', description: 'Rival has honed their skills in Precision events.', icon: '🎯' },
    [RivalTraitId.ReactionPro]: { name: 'Reaction Pro', description: 'Rival has lightning-fast reflexes in Reaction events.', icon: '⚡' },
    [RivalTraitId.TypingAce]: { name: 'Typing Ace', description: 'Rival excels at all Typing-based challenges.', icon: '⌨️' },
    [RivalTraitId.DebuffResistant]: { name: 'Debuff Resistant', description: 'Rival is more likely to start with a Shield or Clarity.', icon: '🛡️' },
    [RivalTraitId.AggressivePowerups]: { name: 'Aggressive', description: 'Rival is more likely to use offensive Power-Ups.', icon: '💥' },
};

export const CORPORATION_DEFINITIONS: { [key in CorporationId]: Omit<Corporation, 'id'> } = {
    [CorporationId.Cyberex]: { name: 'Cyberex Solutions', description: 'Precision engineering for a perfect future. They value flawless execution.', icon: '🎯' },
    [CorporationId.Zenith]: { name: 'Zenith Performance', description: 'A racing syndicate that values raw speed and aggressive tactics above all.', icon: '🏆' },
    [CorporationId.Rogue]: { name: 'Rogue Dynamics', description: 'An enigmatic collective known for their disruptive tech and high-risk, high-reward approach.', icon: '🎭' },
};

export const RIVAL_BANTER = {
  takeLead: [
    "Catch up, slowpoke!",
    "Eating my dust yet?",
    "You're looking at first place!",
    "Too easy."
  ],
  usePowerUp: [
    "A gift, from me to you.",
    "Bet you didn't see that coming!",
    "This should slow you down.",
    "Try to keep up now."
  ],
  win: [
    "Was there ever any doubt?",
    "Better luck next time. Or not.",
    "Perfection.",
    "And that's how it's done."
  ]
};

export const PIT_STOP_CONFIG = {
    tilesPerStage: 4,
    actions: {
        scrub: { cost: 3, description: "Remove a negative status effect.", icon: '🧼' },
        tuneUp: { cost: 4, description: "Gain a random Power-Up.", icon: '🔧' },
        analyze: { cost: 2, description: "Reveal the next set of upcoming tiles.", icon: '📊' },
        recharge: { cost: 0, description: "Skip your action to gain 2 Energy.", icon: '🔋' },
    }
};

// --- V2 UPGRADE CONSTANTS ---

export const OVERDRIVE_COOLDOWN = 2;
export const OVERDRIVE_ENERGY_COST = 5;
export const IMMUNITY_DURATION = 1;

export const DEBUFF_PRIORITY: Record<string, number> = {
    'FROZEN': 3,
    'STUNNED': 3,
    'SLOWED': 2,
    'BLURRED': 1,
    'SCRAMBLED': 1,
};

export const CP_STREAK_MULTIPLIER = (streak: number) => 1 + Math.min(streak, 5) * 0.05;

export const GAUNTLET_CONFIG = {
    startingLives: 3,
    difficultyEscalationInterval: 4,
    maxDifficulty: 3,
    runLength: 50,
    starLossThreshold: 1,
};

export const WEEKLY_CUP_PRESETS: EventPreset[] = [
    { name: 'Precision & Reflexes', eventIds: ['reaction-tap', 'aim-flick', 'target-practice', 'path-tracer', 'asteroid-dodge', 'slider-precision'] },
    { name: 'Cognitive Overload', eventIds: ['quick-math', 'code-breaker', 'sequence-sort', 'memory-flip', 'emoji-cipher', 'system-purge'] },
    { name: 'Rhythm & Flow', eventIds: ['rhythm-tap', 'jump-bar', 'sprint-mash', 'evade-grid', 'audio-beat'] },
];

// ─── Online Multiplayer Constants ────────────────────────────────────────────

/** Maximum players per room (humans + bots). */
export const MAX_ROOM_PLAYERS = 6;

/** Time (ms) to wait for all players to submit results before timeout. */
export const EVENT_RESULT_TIMEOUT_MS = 30_000;

/** Time (ms) after disconnect before a player is considered abandoned. */
export const RECONNECT_GRACE_PERIOD_MS = 30_000;

/** Room code length. */
export const ROOM_CODE_LENGTH = 4;

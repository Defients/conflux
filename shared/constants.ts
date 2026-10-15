/**
 * shared/constants.ts
 * 
 * Game constants used by both client and server.
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */

import {
  BotPersonality, BotProfile, PowerUp, TileModifier, ChassisId, Chassis,
  AccoladeId, Accolade, RivalTraitId, RivalTrait, CorporationId, Corporation,
  EventPreset, AnomalyId, Anomaly,
  SkillNode, SkillTreeId, ChassisModule, LoadoutSlot,
  SeasonalModifier, LeaderboardCategory,
} from './types';

/**
 * Build valid 3-segment (odd) Firestore collection path segments for leaderboard queries.
 */
export function getLeaderboardCollectionSegments(
  category: LeaderboardCategory,
  dailySeed?: string
): [string, string, string] {
  if (category === 'allTime') {
    return ['leaderboards', 'allTime', 'entries'];
  }
  if (category === 'daily') {
    const seed = dailySeed ?? new Date().toISOString().split('T')[0];
    return ['leaderboards', `daily_${seed}`, 'entries'];
  }
  return ['leaderboards', 'gauntlet', 'entries'];
}

/**
 * Build a valid 4-segment (even) Firestore document path for leaderboard entries.
 */
export function getLeaderboardDocPath(
  category: LeaderboardCategory,
  userId: string,
  dailySeed?: string
): string {
  const [col, docId, subcol] = getLeaderboardCollectionSegments(category, dailySeed);
  return `${col}/${docId}/${subcol}/${userId}`;
}

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
  'Overcharge': { description: 'Instantly gain +2 energy for power-up activation.', icon: '🔋' },
  'Sludge': { description: 'Slows all opponents on the next tile.', icon: '🛢️' },
  'Reflector': { description: 'Reflects the next incoming debuff back at the sender.', icon: '🪞' },
  'Rally': { description: 'Boost a teammate\'s movement by 1.5x on the next tile.', icon: '🤝' },
  'Shield Wall': { description: 'Both teammates get a Shield.', icon: '🏰' },
};

export const TILE_MODIFIER_DEFINITIONS: { [key in TileModifier]: { description: string; icon: string } } = {
    'BOOST_PAD': { description: '3-Star performance grants double movement!', icon: '🚀' },
    'POWER_SURGE': { description: 'Guaranteed Power-Up reward on completion!', icon: '⚡️' },
    'STATIC_FIELD': { description: 'All Power-Ups are disabled for this tile!', icon: '🚫' },
    'FOG_BANK': { description: 'The next event is hidden until it starts!', icon: '🌫️' },
    'SPONSORED': { description: 'Bonus reputation for high performance!', icon: '🏢' },
    'ICE_PATCH': { description: 'Slippery! 3★ is harder but grants bonus movement.', icon: '🧊' },
    'NEBULA_DRIFT': { description: 'Cosmic chaos! The event is replaced with a random one.', icon: '🌌' },
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
    [AccoladeId.GhostHunter]: { name: 'Ghost Hunter', description: 'Defeat a recorded ghost run in Ghost Race mode.', icon: '👻' },
    [AccoladeId.TournamentChampion]: { name: 'Tournament Champion', description: 'Win a single-elimination tournament bracket.', icon: '🏅' },
    [AccoladeId.ComebackKing]: { name: 'Comeback King', description: 'Win a race after being in last place at the halfway point.', icon: '👑' },
    [AccoladeId.PowerPlayer]: { name: 'Power Player', description: 'Use 5 or more Power-Ups in a single race.', icon: '🎮' },
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

/** Reconnect grace period for v5.0 (increased from 30s). */
export const RECONNECT_GRACE_PERIOD_V5_MS = 60_000;

/** Max reconnect attempts for v5.0 (increased from 5). */
export const MAX_RECONNECT_ATTEMPTS_V5 = 8;

// ─── v5.0: Skill Tree Nodes ───────────────────────────────────────────────────

export const SKILL_TREE_NODES: SkillNode[] = [
  // Speed Tree
  { id: 'speed-t1', tree: 'speed', tier: 1, name: 'Quick Start', description: 'Begin each race with +0.5 bonus energy per star.', icon: '⚡', cpCost: 50, effect: { energyPerStarBonus: 0.5 }, prerequisites: [] },
  { id: 'speed-t2', tree: 'speed', tier: 2, name: 'Overclock', description: 'Overdrive cooldown reduced by 1 tile.', icon: '🔥', cpCost: 150, effect: { overdriveCooldownReduction: 1 }, prerequisites: ['speed-t1'] },
  { id: 'speed-t3', tree: 'speed', tier: 3, name: 'Hyperdrive', description: 'Overdrive success grants +25% extra hyperdrive movement surge.', icon: '🚀', cpCost: 300, effect: { hyperdriveBonus: true }, prerequisites: ['speed-t2'] },
  { id: 'speed-t4', tree: 'speed', tier: 2, name: 'Adrenaline', description: '15% chance to start each race with a random Power-Up.', icon: '💊', cpCost: 100, effect: { powerUpStartChance: 0.15 }, prerequisites: ['speed-t1'] },
  { id: 'speed-t5', tree: 'speed', tier: 3, name: 'Velocity Surge', description: 'Earn +0.5 additional bonus energy per star.', icon: '💨', cpCost: 250, effect: { energyPerStarBonus: 0.5 }, prerequisites: ['speed-t2'] },

  // Tech Tree
  { id: 'tech-t1', tree: 'tech', tier: 1, name: 'Shield Protocol', description: 'Start each race with a Shield.', icon: '🛡️', cpCost: 75, effect: { shieldStart: true }, prerequisites: [] },
  { id: 'tech-t2', tree: 'tech', tier: 2, name: 'Cleanse Field', description: 'Debuffs last 1 fewer tile.', icon: '🧼', cpCost: 150, effect: { debuffResistance: 1 }, prerequisites: ['tech-t1'] },
  { id: 'tech-t3', tree: 'tech', tier: 3, name: 'Power Surge', description: 'Power-ups gain +1 tile duration or +1 bonus energy.', icon: '⚡', cpCost: 300, effect: { powerUpEffectivenessBonus: 1 }, prerequisites: ['tech-t2'] },
  { id: 'tech-t4', tree: 'tech', tier: 2, name: 'Scanner', description: 'See the next 2 upcoming tiles for free & Pit Stop Analyze costs 0⚡.', icon: '📡', cpCost: 100, effect: { freeScanner: true }, prerequisites: ['tech-t1'] },
  { id: 'tech-t5', tree: 'tech', tier: 3, name: 'Data Override', description: 'Data Spike scrambles targets for 2 tiles instead of 1.', icon: '👾', cpCost: 250, effect: { dataSpikeBonus: 1 }, prerequisites: ['tech-t2'] },

  // Endurance Tree
  { id: 'endurance-t1', tree: 'endurance', tier: 1, name: 'Tough Frame', description: 'Debuffs last 1 fewer tile.', icon: '🦾', cpCost: 50, effect: { debuffResistance: 1 }, prerequisites: [] },
  { id: 'endurance-t2', tree: 'endurance', tier: 2, name: 'Energy Bank', description: 'Earn +1 bonus energy per star.', icon: '🔋', cpCost: 150, effect: { energyPerStarBonus: 1 }, prerequisites: ['endurance-t1'] },
  { id: 'endurance-t3', tree: 'endurance', tier: 3, name: 'Iron Will', description: '1★ results grant 2★ movement speed (1.6x).', icon: '💪', cpCost: 300, effect: { ironWill: true }, prerequisites: ['endurance-t2'] },
  { id: 'endurance-t4', tree: 'endurance', tier: 2, name: 'Recovery', description: 'Pit Stop Recharge gives +3 Energy instead of +2.', icon: '🔄', cpCost: 100, effect: { pitStopRechargeBonus: 1 }, prerequisites: ['endurance-t1'] },
  { id: 'endurance-t5', tree: 'endurance', tier: 3, name: 'Last Stand', description: 'Once per race, a 0★ result is upgraded to 1★.', icon: '🛡️', cpCost: 250, effect: { lastStand: true }, prerequisites: ['endurance-t2'] },
];

export function getSkillNode(id: string): SkillNode | undefined {
  return SKILL_TREE_NODES.find(n => n.id === id);
}

export function getSkillsByTree(tree: SkillTreeId): SkillNode[] {
  return SKILL_TREE_NODES.filter(n => n.tree === tree);
}

// ─── v5.0: Chassis Modules ───────────────────────────────────────────────────

export const CHASSIS_MODULES: ChassisModule[] = [
  // Core modules
  { id: 'core-shield', slot: 'core', name: 'Shield Core', description: 'Start each race with a Shield.', icon: '🛡️', cpCost: 200, effects: { startWithShield: true } },
  { id: 'core-energy', slot: 'core', name: 'Energy Core', description: 'Start each race with +2 Energy.', icon: '🔋', cpCost: 150, effects: { energyBonus: 2 } },
  { id: 'core-clarity', slot: 'core', name: 'Clarity Core', description: 'Start each race with a Clarity power-up.', icon: '👁️', cpCost: 180, effects: { startWithPowerUp: 'Clarity' } },

  // Thruster modules
  { id: 'thrusters-momentum', slot: 'thrusters', name: 'Momentum Thrusters', description: '+10% movement from all star results.', icon: '⚡', cpCost: 200, effects: { movementBonus: 0.1 } },
  { id: 'thrusters-speed', slot: 'thrusters', name: 'Speed Thrusters', description: '+15% movement from all star results.', icon: '💨', cpCost: 320, effects: { movementBonus: 0.15 } },
  { id: 'thrusters-utility', slot: 'thrusters', name: 'Utility Thrusters', description: 'Start each race with a random Power-Up.', icon: '🔧', cpCost: 220, effects: { randomStartPowerUp: true } },

  // Shielding modules
  { id: 'shielding-cleanse', slot: 'shielding', name: 'Cleanse Shielding', description: 'Debuffs last 1 fewer tile.', icon: '🧼', cpCost: 180, effects: { debuffDurationReduction: 1 } },
  { id: 'shielding-powerup', slot: 'shielding', name: 'Power Shielding', description: 'Start with a Clarity power-up.', icon: '✨', cpCost: 200, effects: { startWithPowerUp: 'Clarity' } },
  { id: 'shielding-fortify', slot: 'shielding', name: 'Fortify Shielding', description: 'Shield absorbs an extra debuff hit before breaking.', icon: '🏰', cpCost: 300, effects: { fortifiedShield: true } },
];

export function getChassisModule(id: string): ChassisModule | undefined {
  return CHASSIS_MODULES.find(m => m.id === id);
}

export function getModulesBySlot(slot: LoadoutSlot): ChassisModule[] {
  return CHASSIS_MODULES.filter(m => m.slot === slot);
}

// ─── v5.0: Seasonal Modifiers ────────────────────────────────────────────────

export const SEASONAL_MODIFIERS: SeasonalModifier[] = [
  { id: 'double-energy', name: 'Double Energy Week', description: 'All energy gains are doubled!', icon: '⚡', startWeek: 1, endWeek: 2, effect: { energyMultiplier: 2 } },
  { id: 'hardcore', name: 'Hardcore Week', description: 'No power-ups. Pure skill only.', icon: '💀', startWeek: 5, endWeek: 6, effect: { disablePowerUps: true } },
  { id: 'anomaly-chaos', name: 'Anomaly Chaos', description: 'Every race has an anomaly. Expect the unexpected.', icon: '🌀', startWeek: 9, endWeek: 10, effect: { anomalyChance: 1.0 } },
  { id: 'sprint-mode', name: 'Sprint Week', description: 'All races are 4 tiles. Fast and furious.', icon: '🏁', startWeek: 13, endWeek: 14, effect: { runLengthOverride: 4 } },
  { id: 'marathon', name: 'Marathon Week', description: 'All races are 16 tiles. Endurance test.', icon: '🏃', startWeek: 17, endWeek: 18, effect: { runLengthOverride: 16 } },
  { id: 'turbo-energy', name: 'Turbo Energy Week', description: 'Triple energy gains!', icon: '🔥', startWeek: 21, endWeek: 22, effect: { energyMultiplier: 3 } },
];

/**
 * Compute ISO-8601 week number (1..53) in UTC.
 */
export function getIsoWeekNumber(date: Date = new Date()): number {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the active seasonal modifier for the current ISO week (or a pinned season ID).
 * Cycles the 6 seasonal modifiers across all 52 weeks on a 24-week repeating schedule
 * so seasons remain active year-round instead of stopping after week 22.
 * Returns null if no modifier is active.
 */
export function getActiveSeasonalModifier(pinnedOrDate?: string | Date | null): SeasonalModifier | null {
  if (typeof pinnedOrDate === 'string') {
    if (pinnedOrDate === 'none') return null;
    return SEASONAL_MODIFIERS.find(m => m.id === pinnedOrDate) ?? null;
  }
  const now = pinnedOrDate instanceof Date ? pinnedOrDate : new Date();
  const weekNumber = getIsoWeekNumber(now);
  const cycleWeek = ((weekNumber - 1) % 24) + 1;

  return SEASONAL_MODIFIERS.find(m => cycleWeek >= m.startWeek && cycleWeek <= m.endWeek) ?? null;
}

// ─── v5.0: Team Power-Ups ────────────────────────────────────────────────────

export const TEAM_POWERUP_DEFINITIONS: Record<string, { description: string; icon: string }> = {
  'Rally': { description: 'Boost a teammate\'s movement by 1.5x on the next tile.', icon: '🤝' },
  'Shield Wall': { description: 'Both teammates get a Shield.', icon: '🏰' },
};

// ─── Corporation Syndicate Ranks & Perks ─────────────────────────────────────

export interface SyndicateTierInfo {
  level: 0 | 1 | 2 | 3;
  title: 'Freelancer' | 'Contractor' | 'Operative' | 'Champion';
  minRep: number;
  nextRep: number | null;
  perkSummary: string;
}

export const SYNDICATE_PERK_DESCRIPTIONS: Record<CorporationId, Record<1 | 2 | 3, string>> = {
  [CorporationId.Cyberex]: {
    1: '+5% movement on 3★ results',
    2: '+1 Starting Energy & +5% 3★ movement',
    3: '+10% movement on 3★ results & +1 Starting Energy',
  },
  [CorporationId.Zenith]: {
    1: '+0.25 Energy per Star',
    2: '+5% base movement & +0.25 Energy/Star',
    3: '-1 Overdrive Cooldown, +5% movement & +0.25 Energy/Star',
  },
  [CorporationId.Rogue]: {
    1: '+10% chance to start with a random Power-Up',
    2: '+1 Debuff Resistance & +10% Power-Up start chance',
    3: 'Start with Reflector Immunity (1 tile), +1 Debuff Res & +10% Power-Up chance',
  },
};

export function getSyndicateTier(corpId: CorporationId, reputation: number = 0): SyndicateTierInfo {
  const perks = SYNDICATE_PERK_DESCRIPTIONS[corpId];
  if (reputation >= 150) {
    return { level: 3, title: 'Champion', minRep: 150, nextRep: null, perkSummary: perks[3] };
  }
  if (reputation >= 75) {
    return { level: 2, title: 'Operative', minRep: 75, nextRep: 150, perkSummary: perks[2] };
  }
  if (reputation >= 25) {
    return { level: 1, title: 'Contractor', minRep: 25, nextRep: 75, perkSummary: perks[1] };
  }
  return { level: 0, title: 'Freelancer', minRep: 0, nextRep: 25, perkSummary: `Reach 25 Rep: ${perks[1]}` };
}

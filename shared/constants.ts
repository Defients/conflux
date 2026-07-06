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
  SeasonalModifier, RankTier,
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

/** Reconnect grace period for v5.0 (increased from 30s). */
export const RECONNECT_GRACE_PERIOD_V5_MS = 60_000;

/** Max reconnect attempts for v5.0 (increased from 5). */
export const MAX_RECONNECT_ATTEMPTS_V5 = 8;

// ─── v5.0: Skill Tree Nodes ───────────────────────────────────────────────────

export const SKILL_TREE_NODES: SkillNode[] = [
  // Speed Tree
  { id: 'speed-t1', tree: 'speed', tier: 1, name: 'Quick Start', description: 'Begin each race with +2 Energy.', icon: '⚡', cpCost: 50, effect: { energyPerStarBonus: 0.5 }, prerequisites: [] },
  { id: 'speed-t2', tree: 'speed', tier: 2, name: 'Overclock', description: 'Overdrive cooldown reduced by 1 tile.', icon: '🔥', cpCost: 150, effect: { overdriveCooldownReduction: 1 }, prerequisites: ['speed-t1'] },
  { id: 'speed-t3', tree: 'speed', tier: 3, name: 'Hyperdrive', description: 'Overdrive grants +4★ instead of +3★ on success.', icon: '🚀', cpCost: 300, effect: {}, prerequisites: ['speed-t2'] },
  { id: 'speed-t4', tree: 'speed', tier: 2, name: 'Adrenaline', description: '15% chance to start with a random Power-Up.', icon: '💊', cpCost: 100, effect: { powerUpStartChance: 0.15 }, prerequisites: ['speed-t1'] },
  { id: 'speed-t5', tree: 'speed', tier: 3, name: 'Velocity Surge', description: '3★ performance grants +0.5 bonus energy.', icon: '💨', cpCost: 250, effect: { energyPerStarBonus: 0.5 }, prerequisites: ['speed-t2'] },

  // Tech Tree
  { id: 'tech-t1', tree: 'tech', tier: 1, name: 'Shield Protocol', description: 'Start each race with a Shield.', icon: '🛡️', cpCost: 75, effect: { shieldStart: true }, prerequisites: [] },
  { id: 'tech-t2', tree: 'tech', tier: 2, name: 'Cleanse Field', description: 'Debuffs last 1 fewer tile.', icon: '🧼', cpCost: 150, effect: { debuffResistance: 1 }, prerequisites: ['tech-t1'] },
  { id: 'tech-t3', tree: 'tech', tier: 3, name: 'Power Surge', description: 'Power-ups are 25% more effective.', icon: '⚡', cpCost: 300, effect: {}, prerequisites: ['tech-t2'] },
  { id: 'tech-t4', tree: 'tech', tier: 2, name: 'Scanner', description: 'See the next 2 upcoming tiles during Pit Stops for free.', icon: '📡', cpCost: 100, effect: {}, prerequisites: ['tech-t1'] },
  { id: 'tech-t5', tree: 'tech', tier: 3, name: 'Data Override', description: 'Data Spike affects 2 tiles instead of 1.', icon: '👾', cpCost: 250, effect: {}, prerequisites: ['tech-t2'] },

  // Endurance Tree
  { id: 'endurance-t1', tree: 'endurance', tier: 1, name: 'Tough Frame', description: 'Debuffs last 1 fewer tile.', icon: '🦾', cpCost: 50, effect: { debuffResistance: 1 }, prerequisites: [] },
  { id: 'endurance-t2', tree: 'endurance', tier: 2, name: 'Energy Bank', description: 'Start each race with +3 Energy.', icon: '🔋', cpCost: 150, effect: { energyPerStarBonus: 1 }, prerequisites: ['endurance-t1'] },
  { id: 'endurance-t3', tree: 'endurance', tier: 3, name: 'Iron Will', description: '1★ results still grant full movement.', icon: '💪', cpCost: 300, effect: {}, prerequisites: ['endurance-t2'] },
  { id: 'endurance-t4', tree: 'endurance', tier: 2, name: 'Recovery', description: 'Pit Stop Recharge gives +3 Energy instead of +2.', icon: '🔄', cpCost: 100, effect: {}, prerequisites: ['endurance-t1'] },
  { id: 'endurance-t5', tree: 'endurance', tier: 3, name: 'Last Stand', description: 'Once per race, a 0★ result is upgraded to 1★.', icon: '🛡️', cpCost: 250, effect: {}, prerequisites: ['endurance-t2'] },
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
  { id: 'thrusters-momentum', slot: 'thrusters', name: 'Momentum Thrusters', description: '+10% movement from all star results.', icon: '⚡', cpCost: 250, effects: { movementBonus: 0.1 } },
  { id: 'thrusters-speed', slot: 'thrusters', name: 'Speed Thrusters', description: '+15% movement from 3★ results only.', icon: '💨', cpCost: 200, effects: { movementBonus: 0.15 } },
  { id: 'thrusters-utility', slot: 'thrusters', name: 'Utility Thrusters', description: 'Start with a random Power-Up.', icon: '🔧', cpCost: 220, effects: {} },

  // Shielding modules
  { id: 'shielding-cleanse', slot: 'shielding', name: 'Cleanse Shielding', description: 'Debuffs last 1 fewer tile.', icon: '🧼', cpCost: 180, effects: { debuffDurationReduction: 1 } },
  { id: 'shielding-powerup', slot: 'shielding', name: 'Power Shielding', description: 'Start with a Clarity power-up.', icon: '✨', cpCost: 200, effects: { startWithPowerUp: 'Clarity' } },
  { id: 'shielding-fortify', slot: 'shielding', name: 'Fortify Shielding', description: 'Shield blocks 2 debuffs instead of 1.', icon: '🏰', cpCost: 300, effects: {} },
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
 * Get the active seasonal modifier for the current ISO week.
 * Returns null if no modifier is active.
 */
export function getActiveSeasonalModifier(): SeasonalModifier | null {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

  return SEASONAL_MODIFIERS.find(m => weekNumber >= m.startWeek && weekNumber <= m.endWeek) ?? null;
}

// ─── v5.0: Team Power-Ups ────────────────────────────────────────────────────

export const TEAM_POWERUP_DEFINITIONS: Record<string, { description: string; icon: string }> = {
  'Rally': { description: 'Boost a teammate\'s movement by 1.5x on the next tile.', icon: '🤝' },
  'Shield Wall': { description: 'Both teammates get a Shield.', icon: '🏰' },
};

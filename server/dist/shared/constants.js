"use strict";
/**
 * shared/constants.ts
 *
 * Game constants used by both client and server.
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_CODE_LENGTH = exports.RECONNECT_GRACE_PERIOD_MS = exports.EVENT_RESULT_TIMEOUT_MS = exports.MAX_ROOM_PLAYERS = exports.WEEKLY_CUP_PRESETS = exports.GAUNTLET_CONFIG = exports.CP_STREAK_MULTIPLIER = exports.DEBUFF_PRIORITY = exports.IMMUNITY_DURATION = exports.OVERDRIVE_ENERGY_COST = exports.OVERDRIVE_COOLDOWN = exports.PIT_STOP_CONFIG = exports.RIVAL_BANTER = exports.CORPORATION_DEFINITIONS = exports.RIVAL_TRAIT_DEFINITIONS = exports.ACCOLADE_DEFINITIONS = exports.CHASSIS_DEFINITIONS = exports.AVATARS = exports.CP_AWARD_RULES = exports.TYPING_GLITCH_WORDS = exports.TYPING_PHRASES = exports.SHIELD_UPGRADE_CHANCE = exports.POWERUP_AWARD_RULES = exports.BOT_PROFILES = exports.BOT_NAMES = exports.RUBBER_BAND_BOOST = exports.RUBBER_BAND_THRESHOLD = exports.STAR_MOVEMENT_MULTIPLIERS = exports.TILE_MODIFIER_DEFINITIONS = exports.POWERUP_DEFINITIONS = exports.RIVAL_NAMES = exports.PLAYER_COLORS = exports.ANOMALY_DEFINITIONS = void 0;
const types_1 = require("./types");
exports.ANOMALY_DEFINITIONS = {
    [types_1.AnomalyId.TimeDilation]: { name: 'Time Dilation', description: 'All event timers are reduced by 20%.', icon: '⏳', color: '#ff2a75' },
    [types_1.AnomalyId.GravityWell]: { name: 'Gravity Well', description: 'Movement gains are halved for all racers.', icon: '🌌', color: '#3a2b8c' },
    [types_1.AnomalyId.DataCorruption]: { name: 'Data Corruption', description: 'UI elements glitch and scramble randomly.', icon: '👾', color: '#00f0ff' },
    [types_1.AnomalyId.HyperFlux]: { name: 'Hyper Flux', description: 'Power-ups are twice as effective.', icon: '⚡', color: '#39ff14' },
    [types_1.AnomalyId.WarpDrive]: { name: 'Warp Drive', description: 'Passive movement speed doubled for all racers.', icon: '🚀', color: '#00f0ff' },
    [types_1.AnomalyId.CosmicStorm]: { name: 'Cosmic Storm', description: 'Random energy surges grant spontaneous Overdrive.', icon: '🌪️', color: '#ffeb3b' },
    [types_1.AnomalyId.ChronosShift]: { name: 'Chronos Shift', description: 'The sequence of upcoming events is completely randomized.', icon: '🌀', color: '#a77dff' },
    [types_1.AnomalyId.VoidCollapse]: { name: 'Void Collapse', description: 'The track is shorter, but all events are harder.', icon: '🕳️', color: '#8b00ff' },
    [types_1.AnomalyId.QuantumEntanglement]: { name: 'Quantum Entanglement', description: 'Power-ups affect a random racer instead of the intended target.', icon: '🔗', color: '#ff00ff' },
};
exports.PLAYER_COLORS = [
    '#00dffc', // Player 1 (Human) - Galaxy Cyan
    '#d64f8a', // Player 2 - Nebula Pink
    '#4dffaf', // Player 3 - Hyper Green
    '#ffae42', // Player 4 - Solar Orange
    '#a77dff', // Player 5 - Comet Violet
    '#ff6b6b', // Player 6 - Supernova Red
];
exports.RIVAL_NAMES = ["Vector", "Glitch", "Apex", "Jolt", "Orion", "Cipher"];
exports.POWERUP_DEFINITIONS = {
    'Clarity': { description: 'Instantly removes the Mist Bomb\'s blur effect.', icon: '👁️' },
    'Mist Bomb': { description: 'Blurs opponents\' screens for half of the next event.', icon: '🌫️' },
    'Time Snare': { description: 'Freezes the leader (or 2nd place) on the next tile.', icon: '⏳' },
    'Shield': { description: 'Blocks the next incoming debuff.', icon: '🛡️' },
    'Data Spike': { description: 'Scrambles an opponent\'s upcoming tile view.', icon: '📡' },
};
exports.TILE_MODIFIER_DEFINITIONS = {
    'BOOST_PAD': { description: '3-Star performance grants double movement!', icon: '🚀' },
    'POWER_SURGE': { description: 'Guaranteed Power-Up reward on completion!', icon: '⚡️' },
    'STATIC_FIELD': { description: 'All Power-Ups are disabled for this tile!', icon: '🚫' },
    'FOG_BANK': { description: 'The next event is hidden until it starts!', icon: '🌫️' },
    'SPONSORED': { description: 'Bonus reputation for high performance!', icon: '🏢' },
};
exports.STAR_MOVEMENT_MULTIPLIERS = {
    0: 0,
    1: 1.0,
    2: 1.6,
    3: 2.1,
    4: 3.0,
};
exports.RUBBER_BAND_THRESHOLD = 2;
exports.RUBBER_BAND_BOOST = 0.3;
exports.BOT_NAMES = [
    "Cipher", "Vector", "Glitch", "Echo", "Rune", "Bolt", "Apex", "Jolt", "Nova", "Orion", "Pylon"
];
exports.BOT_PROFILES = {
    [types_1.BotPersonality.Easy]: {
        reaction: { mean: 320, std: 80, clamp: [140, 700] },
        typing: { wpm: 35, std: 6, errorRate: [0.03, 0.06] },
        precision: { star2Chance: 0.40, star3Chance: 0.15 },
    },
    [types_1.BotPersonality.Intermediate]: {
        reaction: { mean: 240, std: 60, clamp: [120, 600] },
        typing: { wpm: 50, std: 7, errorRate: [0.01, 0.04] },
        precision: { star2Chance: 0.55, star3Chance: 0.30 },
    },
    [types_1.BotPersonality.Rival]: {
        reaction: { mean: 220, std: 50, clamp: [110, 550] },
        typing: { wpm: 55, std: 6, errorRate: [0.01, 0.03] },
        precision: { star2Chance: 0.60, star3Chance: 0.38 },
    }
};
exports.POWERUP_AWARD_RULES = {
    1: 'Clarity',
    2: 'Mist Bomb',
    3: 'Data Spike'
};
exports.SHIELD_UPGRADE_CHANCE = 0.1;
exports.TYPING_PHRASES = {
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
exports.TYPING_GLITCH_WORDS = {
    valid: ["ACCESS", "SYSTEM", "ROOT", "GRANT", "KERNEL", "PROXY", "BYPASS", "ADMIN", "EXECUTE", "PURGE"],
    corrupted: ["ACCE55", "5YSTEM", "R00T", "GR@NT", "K3RNEL", "PR0XY", "BYPA55", "ADM1N", "3XECUTE", "PURG3"]
};
exports.CP_AWARD_RULES = {
    placement: [50, 35, 25, 15, 10, 5],
    perStar: 2,
    hazardBonus: 25,
    sabotageBonus: 50,
};
exports.AVATARS = [
    '👩‍🚀', '👨‍🚀', '🤖', '👽', '👾', '🚀'
];
exports.CHASSIS_DEFINITIONS = {
    [types_1.ChassisId.Standard]: { name: 'Standard Issue', description: 'The reliable default. No special modifications.', cost: 0, icon: '🔧', stats: { movementGain: '±0%', debuffDuration: 'Normal' } },
    [types_1.ChassisId.Aegis]: { name: 'Aegis Chassis', description: 'Starts every race with a "Shield" Power-Up.', cost: 300, icon: '🛡️', stats: { movementGain: '±0%', debuffDuration: 'Normal' } },
    [types_1.ChassisId.Momentum]: { name: 'Momentum Chassis', description: 'Gain a permanent speed boost after a 3+ star result.', cost: 500, icon: '⚡', stats: { movementGain: '+10% (on boost)', debuffDuration: 'Normal' } },
    [types_1.ChassisId.Scavenger]: { name: 'Scavenger Chassis', description: 'Increases the chance a 3-star reward becomes a "Shield".', cost: 400, icon: '♻️', stats: { movementGain: '±0%', debuffDuration: 'Normal' } },
    [types_1.ChassisId.GlassCannon]: { name: 'Glass Cannon', description: 'All movement gains are increased, but debuffs last longer.', cost: 750, icon: '💥', stats: { movementGain: '+15%', debuffDuration: '+1 Tile' } },
};
exports.ACCOLADE_DEFINITIONS = {
    [types_1.AccoladeId.FirstVictory]: { name: 'First Victory', description: 'Win your first race against any opponents.', icon: '🏆' },
    [types_1.AccoladeId.RivalryBegins]: { name: 'Rivalry Begins', description: 'Defeat your persistent Rival for the first time.', icon: '⚔️' },
    [types_1.AccoladeId.HazardousDuty]: { name: 'Hazardous Duty', description: 'Accept a Rival\'s Hazard challenge and achieve 3 stars.', icon: '⚠️' },
    [types_1.AccoladeId.Perfectionist]: { name: 'Perfectionist', description: 'Finish a race with a perfect 3-star average.', icon: '🌟' },
    [types_1.AccoladeId.Overdriver]: { name: 'Overdriver', description: 'Successfully execute an Overdrive for a 4-star result.', icon: '🚀' },
    [types_1.AccoladeId.Collector]: { name: 'Collector', description: 'Unlock all available Chassis in the Hangar.', icon: '🛠️' },
};
exports.RIVAL_TRAIT_DEFINITIONS = {
    [types_1.RivalTraitId.PrecisionFocus]: { name: 'Precision Focus', description: 'Rival has honed their skills in Precision events.', icon: '🎯' },
    [types_1.RivalTraitId.ReactionPro]: { name: 'Reaction Pro', description: 'Rival has lightning-fast reflexes in Reaction events.', icon: '⚡' },
    [types_1.RivalTraitId.TypingAce]: { name: 'Typing Ace', description: 'Rival excels at all Typing-based challenges.', icon: '⌨️' },
    [types_1.RivalTraitId.DebuffResistant]: { name: 'Debuff Resistant', description: 'Rival is more likely to start with a Shield or Clarity.', icon: '🛡️' },
    [types_1.RivalTraitId.AggressivePowerups]: { name: 'Aggressive', description: 'Rival is more likely to use offensive Power-Ups.', icon: '💥' },
};
exports.CORPORATION_DEFINITIONS = {
    [types_1.CorporationId.Cyberex]: { name: 'Cyberex Solutions', description: 'Precision engineering for a perfect future. They value flawless execution.', icon: '🎯' },
    [types_1.CorporationId.Zenith]: { name: 'Zenith Performance', description: 'A racing syndicate that values raw speed and aggressive tactics above all.', icon: '🏆' },
    [types_1.CorporationId.Rogue]: { name: 'Rogue Dynamics', description: 'An enigmatic collective known for their disruptive tech and high-risk, high-reward approach.', icon: '🎭' },
};
exports.RIVAL_BANTER = {
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
exports.PIT_STOP_CONFIG = {
    tilesPerStage: 4,
    actions: {
        scrub: { cost: 3, description: "Remove a negative status effect.", icon: '🧼' },
        tuneUp: { cost: 4, description: "Gain a random Power-Up.", icon: '🔧' },
        analyze: { cost: 2, description: "Reveal the next set of upcoming tiles.", icon: '📊' },
        recharge: { cost: 0, description: "Skip your action to gain 2 Energy.", icon: '🔋' },
    }
};
// --- V2 UPGRADE CONSTANTS ---
exports.OVERDRIVE_COOLDOWN = 2;
exports.OVERDRIVE_ENERGY_COST = 5;
exports.IMMUNITY_DURATION = 1;
exports.DEBUFF_PRIORITY = {
    'FROZEN': 3,
    'STUNNED': 3,
    'SLOWED': 2,
    'BLURRED': 1,
    'SCRAMBLED': 1,
};
const CP_STREAK_MULTIPLIER = (streak) => 1 + Math.min(streak, 5) * 0.05;
exports.CP_STREAK_MULTIPLIER = CP_STREAK_MULTIPLIER;
exports.GAUNTLET_CONFIG = {
    startingLives: 3,
    difficultyEscalationInterval: 4,
    maxDifficulty: 3,
    runLength: 50,
    starLossThreshold: 1,
};
exports.WEEKLY_CUP_PRESETS = [
    { name: 'Precision & Reflexes', eventIds: ['reaction-tap', 'aim-flick', 'target-practice', 'path-tracer', 'asteroid-dodge', 'slider-precision'] },
    { name: 'Cognitive Overload', eventIds: ['quick-math', 'code-breaker', 'sequence-sort', 'memory-flip', 'emoji-cipher', 'system-purge'] },
    { name: 'Rhythm & Flow', eventIds: ['rhythm-tap', 'jump-bar', 'sprint-mash', 'evade-grid', 'audio-beat'] },
];
// ─── Online Multiplayer Constants ────────────────────────────────────────────
/** Maximum players per room (humans + bots). */
exports.MAX_ROOM_PLAYERS = 6;
/** Time (ms) to wait for all players to submit results before timeout. */
exports.EVENT_RESULT_TIMEOUT_MS = 30000;
/** Time (ms) after disconnect before a player is considered abandoned. */
exports.RECONNECT_GRACE_PERIOD_MS = 30000;
/** Room code length. */
exports.ROOM_CODE_LENGTH = 4;
//# sourceMappingURL=constants.js.map
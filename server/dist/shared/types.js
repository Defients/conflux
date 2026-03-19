"use strict";
/**
 * shared/types.ts
 *
 * Portable type definitions used by both client and server.
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyId = exports.CorporationId = exports.RivalTraitId = exports.AccoladeId = exports.ChassisId = exports.BotPersonality = exports.GameScreen = void 0;
// ─── Enums ───────────────────────────────────────────────────────────────────
var GameScreen;
(function (GameScreen) {
    GameScreen["Lobby"] = "LOBBY";
    GameScreen["EventList"] = "EVENT_LIST";
    GameScreen["EventPlaytest"] = "EVENT_PLAYTEST";
    GameScreen["Countdown"] = "COUNTDOWN";
    GameScreen["Event"] = "EVENT";
    GameScreen["TileResults"] = "TILE_RESULTS";
    GameScreen["Results"] = "RESULTS";
    GameScreen["PitStop"] = "PIT_STOP";
    GameScreen["Accolades"] = "ACCOLADES";
})(GameScreen || (exports.GameScreen = GameScreen = {}));
var BotPersonality;
(function (BotPersonality) {
    BotPersonality["Easy"] = "Easy";
    BotPersonality["Intermediate"] = "Intermediate";
    BotPersonality["Rival"] = "Rival";
})(BotPersonality || (exports.BotPersonality = BotPersonality = {}));
var ChassisId;
(function (ChassisId) {
    ChassisId["Standard"] = "STANDARD";
    ChassisId["Aegis"] = "AEGIS";
    ChassisId["Momentum"] = "MOMENTUM";
    ChassisId["Scavenger"] = "SCAVENGER";
    ChassisId["GlassCannon"] = "GLASS_CANNON";
})(ChassisId || (exports.ChassisId = ChassisId = {}));
var AccoladeId;
(function (AccoladeId) {
    AccoladeId["FirstVictory"] = "FIRST_VICTORY";
    AccoladeId["RivalryBegins"] = "RIVALRY_BEGINS";
    AccoladeId["HazardousDuty"] = "HAZARDOUS_DUTY";
    AccoladeId["Perfectionist"] = "PERFECTIONIST";
    AccoladeId["Overdriver"] = "OVERDRIVER";
    AccoladeId["Collector"] = "COLLECTOR";
})(AccoladeId || (exports.AccoladeId = AccoladeId = {}));
var RivalTraitId;
(function (RivalTraitId) {
    RivalTraitId["PrecisionFocus"] = "PRECISION_FOCUS";
    RivalTraitId["ReactionPro"] = "REACTION_PRO";
    RivalTraitId["TypingAce"] = "TYPING_ACE";
    RivalTraitId["DebuffResistant"] = "DEBUFF_RESISTANT";
    RivalTraitId["AggressivePowerups"] = "AGGRESSIVE_POWERUPS";
})(RivalTraitId || (exports.RivalTraitId = RivalTraitId = {}));
var CorporationId;
(function (CorporationId) {
    CorporationId["Cyberex"] = "CYBEREX";
    CorporationId["Zenith"] = "ZENITH";
    CorporationId["Rogue"] = "ROGUE";
})(CorporationId || (exports.CorporationId = CorporationId = {}));
var AnomalyId;
(function (AnomalyId) {
    AnomalyId["TimeDilation"] = "TIME_DILATION";
    AnomalyId["GravityWell"] = "GRAVITY_WELL";
    AnomalyId["DataCorruption"] = "DATA_CORRUPTION";
    AnomalyId["HyperFlux"] = "HYPER_FLUX";
    AnomalyId["WarpDrive"] = "WARP_DRIVE";
    AnomalyId["CosmicStorm"] = "COSMIC_STORM";
    AnomalyId["ChronosShift"] = "CHRONOS_SHIFT";
    AnomalyId["VoidCollapse"] = "VOID_COLLAPSE";
    AnomalyId["QuantumEntanglement"] = "QUANTUM_ENTANGLEMENT";
})(AnomalyId || (exports.AnomalyId = AnomalyId = {}));
//# sourceMappingURL=types.js.map
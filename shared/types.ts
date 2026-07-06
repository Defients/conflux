/**
 * shared/types.ts
 * 
 * Portable type definitions used by both client and server.
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum GameScreen {
  Lobby = 'LOBBY',
  EventList = 'EVENT_LIST',
  EventPlaytest = 'EVENT_PLAYTEST',
  Countdown = 'COUNTDOWN',
  Event = 'EVENT',
  TileResults = 'TILE_RESULTS',
  Results = 'RESULTS',
  PitStop = 'PIT_STOP',
  Accolades = 'ACCOLADES',
  Leaderboard = 'LEADERBOARD',
  MatchHistory = 'MATCH_HISTORY',
}

export enum BotPersonality {
  Easy = 'Easy',
  Intermediate = 'Intermediate',
  Rival = 'Rival',
}

export enum ChassisId {
  Standard = 'STANDARD',
  Aegis = 'AEGIS',
  Momentum = 'MOMENTUM',
  Scavenger = 'SCAVENGER',
  GlassCannon = 'GLASS_CANNON',
}

export enum AccoladeId {
    FirstVictory = 'FIRST_VICTORY',
    RivalryBegins = 'RIVALRY_BEGINS',
    HazardousDuty = 'HAZARDOUS_DUTY',
    Perfectionist = 'PERFECTIONIST',
    Overdriver = 'OVERDRIVER',
    Collector = 'COLLECTOR',
}

export enum RivalTraitId {
    PrecisionFocus = 'PRECISION_FOCUS',
    ReactionPro = 'REACTION_PRO',
    TypingAce = 'TYPING_ACE',
    DebuffResistant = 'DEBUFF_RESISTANT',
    AggressivePowerups = 'AGGRESSIVE_POWERUPS',
}

export enum CorporationId {
    Cyberex = 'CYBEREX',
    Zenith = 'ZENITH',
    Rogue = 'ROGUE',
}

export enum AnomalyId {
    TimeDilation = 'TIME_DILATION',
    GravityWell = 'GRAVITY_WELL',
    DataCorruption = 'DATA_CORRUPTION',
    HyperFlux = 'HYPER_FLUX',
    WarpDrive = 'WARP_DRIVE',
    CosmicStorm = 'COSMIC_STORM',
    ChronosShift = 'CHRONOS_SHIFT',
    VoidCollapse = 'VOID_COLLAPSE',
    QuantumEntanglement = 'QUANTUM_ENTANGLEMENT',
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Chassis {
  id: ChassisId;
  name: string;
  description: string;
  cost: number;
  icon: string;
  stats: {
    movementGain: string;
    debuffDuration: string;
  };
}

export interface Accolade {
    id: AccoladeId;
    name: string;
    description: string;
    icon: string;
}

export interface RivalTrait {
    id: RivalTraitId;
    name: string;
    description: string;
    icon: string;
}

export interface RivalData {
    name: string;
    avatarId: string;
    favoredChassis: ChassisId;
    wins: number;
    losses: number;
    traits: RivalTraitId[];
}

export interface Corporation {
    id: CorporationId;
    name: string;
    description: string;
    icon: string;
}

export type ObjectiveType = 'FINISH_RACE_IN_POS' | 'AVG_STARS_ABOVE' | 'GET_STARS_IN_DIMENSION';

export interface ContractObjective {
    type: ObjectiveType;
    description: string;
    targetValue: number;
    dimension?: PerformanceDimension;
    isComplete: boolean;
}

export interface Contract {
    corporationId: CorporationId;
    objectives: ContractObjective[];
    cpReward: number;
    repReward: number;
}

export interface PilotProfile {
  name: string;
  avatarId: string;
  circuitPoints: number;
  winStreak: number;
  unlockedChassis: ChassisId[];
  unlockedAccolades: AccoladeId[];
  rivalData: RivalData;
  gauntletHighScore: number;
  sponsorships: {
      [key in CorporationId]?: {
          reputation: number;
          activeContract: Contract | null;
      };
  };
  /** IDs of match summaries already applied to this profile (bounded FIFO). */
  appliedMatchIds?: string[];
  /** Record of daily challenge seeds to best scores */
  dailyBests?: Record<string, number>;
}

export interface GameSettings {
  playerCount: number;
  easyBots: number;
  intermediateBots: number;
  seed: string;
  runLength: number;
  sound: boolean;
  accessibility: boolean;
  uiEffects: boolean;
  colorBlindMode: boolean;
  selectedChassis: ChassisId;
  isGauntlet?: boolean;
}

export type PowerUp = 'Clarity' | 'Mist Bomb' | 'Time Snare' | 'Shield' | 'Data Spike';

export interface PlayerStatus {
  type: 'SLOWED' | 'FROZEN' | 'BLURRED' | 'SHIELDED' | 'STUNNED' | 'BOOSTED' | 'SCRAMBLED' | 'IMMUNE';
  duration: number;
}

// ─── Player Model ────────────────────────────────────────────────────────────
// Evolved to support both local and online multiplayer.

/** Discriminated player type for multiplayer support. */
export type PlayerType = 'human' | 'bot';

export interface Player {
  id: number;
  name: string;
  isBot: boolean;
  isRival: boolean;
  personality?: BotPersonality;
  chassisId?: ChassisId;
  color: string;
  position: number;
  powerUps: PowerUp[];
  statuses: PlayerStatus[];
  tileHistory: { tileIndex: number; stars: number }[];
  energy: number;
  overdriveCooldown: number;
  scrambledTileData?: Tile[];
  lives?: number;

  // ─── Online multiplayer fields (optional, absent in local mode) ───
  /** Discriminated player type: 'human' or 'bot'. */
  playerType?: PlayerType;
  /** Colyseus sessionId for this player's connection. */
  connectionId?: string;
  /** Firebase or anonymous user ID. */
  userId?: string;
  /** Whether this player has readied up in the lobby. */
  isReady?: boolean;
  /** Whether this player is currently connected (for reconnect handling). */
  isConnected?: boolean;
}

export type TileModifier = 'BOOST_PAD' | 'POWER_SURGE' | 'STATIC_FIELD' | 'FOG_BANK' | 'SPONSORED';

export interface Tile {
  tileIndex: number;
  eventId: string;
  difficulty: number;
  modifier?: TileModifier;
  isHazard?: boolean;
  sponsoringCorp?: CorporationId;
  subSeed?: string;
}

export type InterventionType = 'HAZARD' | 'SABOTAGE' | 'VETO';

export interface Anomaly {
    id: AnomalyId;
    name: string;
    description: string;
    icon: string;
    color: string;
}

export interface RivalIntervention {
    type: InterventionType;
    hazardTile?: Tile;
    vetoSelection?: string[];
    cpBonus: number;
}

export interface GameState {
  settings: GameSettings;
  players: Player[];
  run: Tile[];
  currentTileIndex: number;
  eventResults: { [playerId: number]: EventResult };
  lastTileResults: { [playerId: number]: EventResult } | null;
  overdrivingPlayerIds: number[];
  activeIntervention: RivalIntervention | null;
  lastHazardInterventionIndex: number;
  activeAnomaly: Anomaly | null;
}

export interface EventResult {
  playerId: number;
  stars: 0 | 1 | 2 | 3 | 4;
  primaryMetric: number;
  secondaryMetric?: number;
}

export type PerformanceDimension = 'reaction' | 'typing' | 'precision' | 'memory' | 'rhythm' | 'logic';

/**
 * Shared-safe event descriptor.
 * Unlike the client-side GameEvent, this does NOT include React Component
 * or browser-dependent scoring functions. It is used by the server to
 * understand event metadata without needing React.
 */
export interface SharedEventDescriptor {
  id: string;
  displayName: string;
  performanceDimension: PerformanceDimension;
  isStub?: boolean;
}

/**
 * Minimal event info needed for bot simulation.
 * Both client (via GameEvent adapter) and server (via EVENT_DESCRIPTORS + STAR_COMPUTERS)
 * can construct this without React dependencies.
 */
export interface BotEventInfo {
  id: string;
  performanceDimension: PerformanceDimension;
  getStars: (result: Omit<EventResult, 'stars' | 'playerId'>) => 1 | 2 | 3;
  isStub?: boolean;
}

export interface BotProfile {
  reaction: { mean: number; std: number; clamp: [number, number] };
  typing: { wpm: number; std: number; errorRate: [number, number] };
  precision: { star2Chance: number; star3Chance: number };
}

export interface ToastMessage {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning';
}

export type SoundEvent = 'ui-click' | 'countdown-beep' | 'event-start' | 'event-success' | 'event-fail' | 'powerup-use' | 'powerup-get' | 'debuff-hit' | 'overdrive-activate' | 'overdrive-success' | 'overdrive-fail' | 'rival-tell';

export interface EventPreset {
  name: string;
  eventIds: string[];
}

// ─── Online Multiplayer Types ────────────────────────────────────────────────

/** Room configuration sent when creating or joining a room. */
export interface RoomConfig {
  playerName: string;
  avatarId: string;
  chassisId: ChassisId;
  userId?: string;
  isPrivate?: boolean;
}

/** Lobby-visible player entry (before match starts). */
export interface LobbyPlayer {
  sessionId: string;
  name: string;
  avatarId: string;
  chassisId: ChassisId;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
}

/** Match phase tracked by the server room. */
export type MatchPhase = 'lobby' | 'countdown' | 'playing' | 'tile_results' | 'finished';

/**
 * Event result telemetry submitted by client to server.
 * Contains raw metrics; the server computes stars.
 */
export interface EventTelemetry {
  tileIndex: number;
  eventId: string;
  seed: string;
  primaryMetric: number;
  secondaryMetric?: number;
  /** Client-measured completion timestamp for plausibility checks. */
  completionTimestamp: number;
}

/**
 * Room state summary broadcast to clients.
 * This is the authoritative snapshot the client renders.
 */
export interface RoomStateSummary {
  roomCode: string;
  phase: MatchPhase;
  hostSessionId: string;
  players: LobbyPlayer[];
  settings: GameSettings;
  isPrivate: boolean;
  /** Set once match begins. */
  gameState?: GameState;
}

// ─── Leaderboard & Match History Types ────────────────────────────────────────

export type LeaderboardCategory = 'allTime' | 'daily' | 'gauntlet';

export interface LeaderboardEntry {
  userId: string;
  playerName: string;
  avatarId: string;
  circuitPoints: number;
  /** For daily leaderboards: the best position score. For gauntlet: tiles survived. */
  bestScore: number;
  updatedAt: number;
}

export interface MatchHistoryEntry {
  matchId: string;
  seed: string;
  mode: 'local' | 'online';
  completedAt: number;
  runLength: number;
  placement: number;
  totalPlayers: number;
  cpEarned: number;
  isDaily: boolean;
  isGauntlet: boolean;
  rivalDefeated: boolean;
  gauntletTilesSurvived: number | null;
}

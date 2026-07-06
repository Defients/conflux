/**
 * shared/protocol.ts
 * 
 * Typed message definitions for Colyseus client↔server communication.
 * All messages use a consistent naming convention: "domain:action".
 * 
 * ─── Client → Server Messages ────────────────────────────────────────────────
 * 
 * | Message Type              | Payload                        | Description                              |
 * |---------------------------|--------------------------------|------------------------------------------|
 * | room:ready                | { ready: boolean }             | Toggle ready state in lobby              |
 * | room:start                | {}                             | Host requests match start                |
 * | room:updateSettings       | Partial<GameSettings>          | Host updates room settings               |
 * | game:submitEventResult    | EventTelemetry                 | Submit event performance telemetry       |
 * | game:usePowerUp           | UsePowerUpPayload              | Request power-up activation              |
 * | game:activateOverdrive    | ActivateOverdrivePayload       | Request overdrive activation             |
 * | game:interventionChoice   | { accept: boolean }            | Respond to rival intervention            |
 * | game:pitStopAction        | PitStopActionPayload           | Execute pit stop action                  |
 * | game:requestRematch       | {}                             | Request a rematch after match ends       |
 * 
 * ─── Server → Client Messages ────────────────────────────────────────────────
 * 
 * | Message Type              | Payload                        | Description                              |
 * |---------------------------|--------------------------------|------------------------------------------|
 * | room:created              | { roomCode: string }           | Room successfully created                |
 * | room:error                | { message: string }            | Error message                            |
 * | game:tileStart            | TileStartPayload               | Server starts a new tile                 |
 * | game:tileResults          | TileResultsPayload             | Server broadcasts tile results           |
 * | game:raceFinished         | RaceFinishedPayload            | Server broadcasts final standings        |
 * | game:intervention         | InterventionPayload            | Rival intervention prompt                |
 * | game:pitStop              | {}                             | Pit stop phase notification              |
 * | game:countdown            | { tileIndex: number }          | Countdown before tile starts             |
 * | game:playerDisconnected   | { sessionId: string }          | Player disconnected notification         |
 * | game:playerReconnected    | { sessionId: string }          | Player reconnected notification          |
 */

import {
  EventResult, GameSettings,
  GameState, PowerUp, Tile
} from './types';
import { MatchSummary } from './matchSummary';

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface ReadyPayload {
  ready: boolean;
}

export interface UpdateSettingsPayload {
  settings: Partial<GameSettings>;
}

export interface UsePowerUpPayload {
  powerUp: PowerUp;
  targetId?: number;
}

export interface ActivateOverdrivePayload {
  force?: boolean;
}

export interface InterventionChoicePayload {
  accept: boolean;
}

export interface PitStopActionPayload {
  action: 'scrub' | 'tuneUp' | 'analyze' | 'recharge';
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface RoomCreatedPayload {
  roomCode: string;
}

export interface RoomErrorPayload {
  message: string;
}

export interface TileStartPayload {
  tileIndex: number;
  eventId: string;
  subSeed: string;
  difficulty: number;
  modifier?: string;
  isHazard?: boolean;
  startTimestamp: number;
  durationMs: number;
  anomalyId?: string;
}

export interface TileResultsPayload {
  results: { [playerId: number]: EventResult };
  /** Updated game state snapshot after tile processing. */
  gameState: GameState;
}

export interface RaceFinishedPayload {
  finalStandings: Array<{
    playerId: number;
    name: string;
    position: number;
    totalStars: number;
    placement: number;
  }>;
  gameState: GameState;
}

export interface InterventionPayload {
  rivalName: string;
  standardTile: Tile;
  hazardTile: Tile;
  cpBonus: number;
}

export interface PlayerConnectionPayload {
  sessionId: string;
  playerName?: string;
  userId?: string; // Firebase Auth UID
}

export interface MatchSummaryPayload {
  summary: MatchSummary;
}

// ─── Message Type String Constants ───────────────────────────────────────────

export const ClientMessages = {
  READY: 'room:ready',
  START: 'room:start',
  UPDATE_SETTINGS: 'room:updateSettings',
  SUBMIT_EVENT_RESULT: 'game:submitEventResult',
  USE_POWER_UP: 'game:usePowerUp',
  ACTIVATE_OVERDRIVE: 'game:activateOverdrive',
  INTERVENTION_CHOICE: 'game:interventionChoice',
  PIT_STOP_ACTION: 'game:pitStopAction',
  REQUEST_REMATCH: 'game:requestRematch',
  SPECTATE: 'room:spectate',
} as const;

export const ServerMessages = {
  ROOM_CREATED: 'room:created',
  ROOM_ERROR: 'room:error',
  TILE_START: 'game:tileStart',
  TILE_RESULTS: 'game:tileResults',
  RACE_FINISHED: 'game:raceFinished',
  INTERVENTION: 'game:intervention',
  PIT_STOP: 'game:pitStop',
  COUNTDOWN: 'game:countdown',
  PLAYER_DISCONNECTED: 'game:playerDisconnected',
  PLAYER_RECONNECTED: 'game:playerReconnected',
  MATCH_SUMMARY: 'game:matchSummary',
  SPECTATOR_MODE: 'room:spectatorMode',
} as const;

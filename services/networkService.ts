/**
 * services/networkService.ts
 * 
 * Client-side Colyseus connection manager.
 * Handles room creation, joining, reconnection, and message routing.
 * Provides a clean API that UI components consume via hooks.
 */

import { Client, Room } from 'colyseus.js';
import {
  RoomConfig, GameSettings, GameState, EventTelemetry,
  PowerUp, LobbyPlayer, MatchPhase,
} from '../types';
import {
  ClientMessages, ServerMessages,
  ReadyPayload, UsePowerUpPayload, ActivateOverdrivePayload,
  InterventionChoicePayload, PitStopActionPayload, UpdateSettingsPayload,
  TileStartPayload, TileResultsPayload, RaceFinishedPayload,
  RoomCreatedPayload, RoomErrorPayload, PlayerConnectionPayload, MatchSummaryPayload
} from '../shared/protocol';

// ─── Configuration ───────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
const HTTP_SERVER_URL = SERVER_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
const ROOM_NAME = 'conflux_match';
const RECONNECT_TOKEN_KEY = 'conflux-reconnect-token';

export interface OpenRoomInfo {
  roomId: string;
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
}

// ─── Event Listener Types ────────────────────────────────────────────────────

export interface NetworkEventHandlers {
  onLobbyStateUpdate?: (data: {
    roomCode: string;
    phase: MatchPhase;
    hostSessionId: string;
    players: LobbyPlayer[];
    settings: GameSettings;
  }) => void;
  onGameStateUpdate?: (data: { gameState: GameState; phase?: MatchPhase }) => void;
  onTileStart?: (data: TileStartPayload) => void;
  onTileResults?: (data: TileResultsPayload) => void;
  onRaceFinished?: (data: RaceFinishedPayload) => void;
  onMatchSummary?: (data: MatchSummaryPayload) => void;
  onIntervention?: (data: { rivalName: string; standardTile: unknown; hazardTile: unknown; cpBonus: number }) => void;
  onPitStop?: () => void;
  onCountdown?: (data: { tileIndex: number }) => void;
  onPlayerDisconnected?: (data: PlayerConnectionPayload) => void;
  onPlayerReconnected?: (data: PlayerConnectionPayload) => void;
  onRoomError?: (message: string) => void;
  onRoomCreated?: (roomCode: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

// ─── NetworkService Singleton ────────────────────────────────────────────────

class NetworkService {
  private client: Client | null = null;
  private room: Room | null = null;
  private handlers: NetworkEventHandlers = {};
  private _sessionId: string | null = null;
  private _isConnected = false;
  private _isReconnecting = false;
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastSubmittedTileIndex: number = -1;
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly BASE_RECONNECT_DELAY_MS = 1000;

  get sessionId(): string | null {
    return this._sessionId;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isReconnecting(): boolean {
    return this._isReconnecting;
  }

  get currentRoom(): Room | null {
    return this.room;
  }

  /**
   * Register event handlers. Call this from React hooks/components.
   * Returns an unsubscribe function.
   */
  setHandlers(handlers: NetworkEventHandlers): () => void {
    this.handlers = { ...this.handlers, ...handlers };
    return () => {
      // Remove only the handlers that were set in this call
      for (const key of Object.keys(handlers) as (keyof NetworkEventHandlers)[]) {
        if (this.handlers[key] === handlers[key]) {
          delete this.handlers[key];
        }
      }
    };
  }

  /**
   * Initialize the Colyseus client (lazy, idempotent).
   */
  private ensureClient(): Client {
    if (!this.client) {
      this.client = new Client(SERVER_URL);
    }
    return this.client;
  }

  /**
   * Create a new room and join it.
   */
  async createRoom(config: RoomConfig): Promise<string> {
    const client = this.ensureClient();

    try {
      this.room = await client.create(ROOM_NAME, config);
      this.setupRoomListeners();
      this.saveReconnectData();
      this._sessionId = this.room.sessionId;
      this._isConnected = true;
      this.handlers.onConnectionChange?.(true);
      return this.room.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      this.handlers.onRoomError?.(message);
      throw err;
    }
  }

  /**
   * Join an existing room by room ID or room code.
   * For room code lookup, the server handles matching.
   */
  async joinRoom(roomId: string, config: RoomConfig): Promise<void> {
    const client = this.ensureClient();

    try {
      this.room = await client.joinById(roomId, config);
      this.setupRoomListeners();
      this.saveReconnectData();
      this._sessionId = this.room.sessionId;
      this._isConnected = true;
      this.handlers.onConnectionChange?.(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      this.handlers.onRoomError?.(message);
      throw err;
    }
  }

  /**
   * Join a room by name with filter options (e.g., room code).
   */
  async joinByCode(roomCode: string, config: RoomConfig): Promise<void> {
    const client = this.ensureClient();

    try {
      // Try to find available rooms and match by code
      const rooms = await client.getAvailableRooms(ROOM_NAME);
      const target = rooms.find(r => {
        // Room metadata would contain the code - for now use roomId
        return r.roomId === roomCode || r.metadata?.roomCode === roomCode;
      });

      if (target) {
        await this.joinRoom(target.roomId, config);
      } else {
        throw new Error(`Room with code "${roomCode}" not found`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      this.handlers.onRoomError?.(message);
      throw err;
    }
  }

  /**
   * Attempt to reconnect to a previously joined room.
   */
  async tryReconnect(): Promise<boolean> {
    const reconnectData = this.loadReconnectData();
    if (!reconnectData) return false;

    const client = this.ensureClient();

    try {
      this.room = await client.reconnect(reconnectData.reconnectionToken);
      this.setupRoomListeners();
      this.saveReconnectData();
      this._sessionId = this.room.sessionId;
      this._isConnected = true;
      this.handlers.onConnectionChange?.(true);
      return true;
    } catch {
      this.clearReconnectData();
      return false;
    }
  }

  /**
   * Leave the current room gracefully.
   */
  async leaveRoom(consented = true): Promise<void> {
    this.cancelReconnect();
    if (this.room) {
      try {
        await this.room.leave(consented);
      } catch {
        // Room may already be disposed
      }
      this.room = null;
      this._sessionId = null;
      this._isConnected = false;
      this.clearReconnectData();
      this.handlers.onConnectionChange?.(false);
    }
  }

  /**
   * Cancel any pending reconnect attempts.
   */
  private cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._isReconnecting = false;
    this._reconnectAttempts = 0;
  }

  /**
   * Attempt automatic reconnection with exponential backoff.
   * Called when an unexpected disconnect is detected.
   */
  private async autoReconnect() {
    if (this._isReconnecting) return;
    if (this._reconnectAttempts >= NetworkService.MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Network] Max reconnect attempts reached, giving up');
      this._isReconnecting = false;
      this.clearReconnectData();
      this.handlers.onRoomError?.('Connection lost. Please rejoin the room.');
      return;
    }

    this._isReconnecting = true;
    const delay = NetworkService.BASE_RECONNECT_DELAY_MS * Math.pow(2, this._reconnectAttempts);
    console.log(`[Network] Reconnect attempt ${this._reconnectAttempts + 1}/${NetworkService.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectAttempts++;
      try {
        const success = await this.tryReconnect();
        if (success) {
          console.log('[Network] Reconnected successfully');
          this._isReconnecting = false;
          this._reconnectAttempts = 0;
        } else {
          this._isReconnecting = false;
          this.autoReconnect();
        }
      } catch {
        this._isReconnecting = false;
        this.autoReconnect();
      }
    }, delay);
  }

  // ─── Message Senders (Client → Server) ─────────────────────────────────

  sendReady(ready: boolean) {
    this.room?.send(ClientMessages.READY, { ready } satisfies ReadyPayload);
  }

  sendStart() {
    this.room?.send(ClientMessages.START, {});
  }

  sendUpdateSettings(settings: Partial<GameSettings>) {
    this.room?.send(ClientMessages.UPDATE_SETTINGS, { settings } satisfies UpdateSettingsPayload);
  }

  sendEventResult(telemetry: EventTelemetry) {
    if (telemetry.tileIndex === this._lastSubmittedTileIndex) {
      console.warn(`[Network] Duplicate telemetry suppressed for tile ${telemetry.tileIndex}`);
      return;
    }
    this._lastSubmittedTileIndex = telemetry.tileIndex;
    this.room?.send(ClientMessages.SUBMIT_EVENT_RESULT, telemetry);
  }

  sendUsePowerUp(powerUp: PowerUp, targetId?: number) {
    this.room?.send(ClientMessages.USE_POWER_UP, { powerUp, targetId } satisfies UsePowerUpPayload);
  }

  sendActivateOverdrive(force?: boolean) {
    this.room?.send(ClientMessages.ACTIVATE_OVERDRIVE, { force } satisfies ActivateOverdrivePayload);
  }

  sendInterventionChoice(accept: boolean) {
    this.room?.send(ClientMessages.INTERVENTION_CHOICE, { accept } satisfies InterventionChoicePayload);
  }

  sendPitStopAction(action: 'scrub' | 'tuneUp' | 'analyze' | 'recharge') {
    this.room?.send(ClientMessages.PIT_STOP_ACTION, { action } satisfies PitStopActionPayload);
  }

  sendRequestRematch() {
    this.room?.send(ClientMessages.REQUEST_REMATCH, {});
  }

  // ─── Room Listeners Setup ──────────────────────────────────────────────

  private setupRoomListeners() {
    if (!this.room) return;

    // Lobby/room state updates
    this.room.onMessage('room:state', (data) => {
      this.handlers.onLobbyStateUpdate?.(data);
    });

    this.room.onMessage(ServerMessages.ROOM_CREATED, (data: RoomCreatedPayload) => {
      this.handlers.onRoomCreated?.(data.roomCode);
    });

    this.room.onMessage(ServerMessages.ROOM_ERROR, (data: RoomErrorPayload) => {
      this.handlers.onRoomError?.(data.message);
    });

    // Game state updates
    this.room.onMessage('game:state', (data) => {
      this.handlers.onGameStateUpdate?.(data);
    });

    this.room.onMessage(ServerMessages.TILE_START, (data: TileStartPayload) => {
      this.handlers.onTileStart?.(data);
    });

    this.room.onMessage(ServerMessages.TILE_RESULTS, (data: TileResultsPayload) => {
      this.handlers.onTileResults?.(data);
    });

    this.room.onMessage(ServerMessages.RACE_FINISHED, (data: RaceFinishedPayload) => {
      this.handlers.onRaceFinished?.(data);
    });

    this.room.onMessage(ServerMessages.MATCH_SUMMARY, (data: MatchSummaryPayload) => {
      this.handlers.onMatchSummary?.(data);
    });

    this.room.onMessage(ServerMessages.INTERVENTION, (data) => {
      this.handlers.onIntervention?.(data);
    });

    this.room.onMessage(ServerMessages.PIT_STOP, () => {
      this.handlers.onPitStop?.();
    });

    this.room.onMessage(ServerMessages.COUNTDOWN, (data) => {
      this.handlers.onCountdown?.(data);
    });

    this.room.onMessage(ServerMessages.PLAYER_DISCONNECTED, (data: PlayerConnectionPayload) => {
      this.handlers.onPlayerDisconnected?.(data);
    });

    this.room.onMessage(ServerMessages.PLAYER_RECONNECTED, (data: PlayerConnectionPayload) => {
      this.handlers.onPlayerReconnected?.(data);
    });

    // Connection lifecycle
    this.room.onLeave((code) => {
      console.log(`[Network] Left room (code: ${code})`);
      this._isConnected = false;
      this._lastSubmittedTileIndex = -1;
      this.handlers.onConnectionChange?.(false);

      // code >= 4000 means consented leave; < 4000 means unexpected disconnect
      if (code < 4000 && this.loadReconnectData()) {
        this.autoReconnect();
      }
    });

    this.room.onError((code, message) => {
      console.error(`[Network] Room error (${code}): ${message}`);
      this.handlers.onRoomError?.(message ?? `Room error: ${code}`);
    });
  }

  // ─── Reconnect Token Persistence ───────────────────────────────────────

  private saveReconnectData() {
    if (!this.room) return;
    try {
      sessionStorage.setItem(RECONNECT_TOKEN_KEY, this.room.reconnectionToken);
    } catch {
      // sessionStorage may not be available
    }
  }

  private loadReconnectData(): { reconnectionToken: string } | null {
    try {
      const token = sessionStorage.getItem(RECONNECT_TOKEN_KEY);
      if (token) return { reconnectionToken: token };
    } catch {
      // sessionStorage may not be available
    }
    return null;
  }

  private clearReconnectData() {
    try {
      sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
    } catch {
      // sessionStorage may not be available
    }
  }

  /**
   * Fetch open rooms from the REST endpoint.
   */
  async getOpenRooms(): Promise<OpenRoomInfo[]> {
    try {
      const res = await fetch(`${HTTP_SERVER_URL}/api/rooms`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.rooms ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Join a room as a spectator (can join during active matches).
   */
  async spectateRoom(roomId: string): Promise<void> {
    const client = this.ensureClient();
    try {
      this.room = await client.joinById(roomId, { spectate: true } as any);
      this.setupRoomListeners();
      this._sessionId = this.room.sessionId;
      this._isConnected = true;
      this.handlers.onConnectionChange?.(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to spectate room';
      this.handlers.onRoomError?.(message);
      throw err;
    }
  }
}

/** Singleton network service instance. */
export const networkService = new NetworkService();

/**
 * server/src/rooms/ConfluxRoom.ts
 * 
 * Authoritative Colyseus room for Conflux Circuit multiplayer matches.
 * Manages: lobby roster, ready state, match lifecycle, tile progression,
 * event result validation, scoring, and reconnection.
 */

import { Room, Client, Delayed } from 'colyseus';
import {
  GameState, GameSettings, Player, EventResult, Tile, PowerUp,
  ChassisId, BotPersonality, AnomalyId, SharedEventDescriptor,
  RoomConfig, MatchPhase, EventTelemetry, LobbyPlayer,
  PilotSkills, ChassisLoadout, TeamId,
} from '../../../shared/types';
import {
  PLAYER_COLORS, BOT_NAMES, CHASSIS_DEFINITIONS, ANOMALY_DEFINITIONS,
  GAUNTLET_CONFIG, MAX_ROOM_PLAYERS, EVENT_RESULT_TIMEOUT_MS,
  RECONNECT_GRACE_PERIOD_MS, ROOM_CODE_LENGTH,
  RECONNECT_GRACE_PERIOD_V5_MS, MAX_RECONNECT_ATTEMPTS_V5,
} from '../../../shared/constants';
import { SeededRNG } from '../../../shared/seededRNG';
import { generateRun } from '../../../shared/pathGenerator';
import { GameRules } from '../../../shared/gameRules';
import { simulateBotPerformance, decideBotPowerUp, decideBotOverdrive } from '../../../shared/botMind';
import {
  ClientMessages, ServerMessages,
  TileStartPayload, TileResultsPayload, RaceFinishedPayload,
  ReadyPayload, UsePowerUpPayload, ActivateOverdrivePayload,
  InterventionChoicePayload, PitStopActionPayload, UpdateSettingsPayload,
  KickPlayerPayload, BanPlayerPayload,
} from '../../../shared/protocol';
import { RoomNames } from '../../../shared/protocol';
import { EVENT_DESCRIPTORS, STAR_COMPUTERS } from '../eventDescriptors';
import { ServerEventValidator } from '../validation/eventValidator';
import { ClientRateLimiter, RATE_LIMITS } from '../validation/rateLimiter';
import { computeMatchSummary, applyMatchSummaryToProfile } from '../../../shared/matchSummary';
import { computeMultiPlayerRatingChanges, applyRatingChange, createDefaultRankInfo } from '../../../shared/rankSystem';
import { applySkillEffects, applyLoadoutEffects, assignTeams } from '../../../shared/gameSetup';
import { generateContracts } from '../../../shared/contractService';
import { getProfile, saveProfile, updateProfileTransaction } from '../services/profileRepository';
import { writeLeaderboardEntry } from '../services/leaderboardRepository';
import { writeMatchHistory } from '../services/matchHistoryRepository';
import { LeaderboardEntry, MatchHistoryEntry } from '../../../shared/types';
import { verifyAuthToken, validateUserIdClaim } from '../auth/verifyToken';

// ─── Room State (plain object, synced via messages) ──────────────────────────

interface RoomPlayer {
  sessionId: string;
  name: string;
  avatarId: string;
  chassisId: ChassisId;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  playerId: number; // in-game player ID
  reconnectToken?: string;
  userId?: string; // Firebase Auth UID
  // v5.0 fields
  teamId?: TeamId;
  rating?: number;
  skillNodeIds?: string[];
  moduleIds?: string[];
  rttMs?: number;
  reconnectAttempts?: number;
}

interface ConfluxRoomState {
  roomCode: string;
  phase: MatchPhase;
  hostSessionId: string;
  players: Map<string, RoomPlayer>;
  settings: GameSettings;
  gameState: GameState | null;
  pendingResults: Map<number, EventResult>; // playerId -> result
  pendingPitStops: Set<number>; // playerIds who have submitted pit stop actions
  tileStartTimestamp: number;
  tileDurationMs: number;
  isPrivate: boolean;
  bannedUserIds: Set<string>;
  bannedSessionIds: Set<string>;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const DEFAULT_SETTINGS: GameSettings = {
  playerCount: 4,
  easyBots: 2,
  intermediateBots: 1,
  seed: '',
  runLength: 8,
  sound: true,
  accessibility: false,
  uiEffects: true,
  colorBlindMode: false,
  selectedChassis: ChassisId.Standard,
};

export class ConfluxRoom extends Room {
  private roomState: ConfluxRoomState = {
    roomCode: '',
    phase: 'lobby',
    hostSessionId: '',
    players: new Map(),
    settings: { ...DEFAULT_SETTINGS },
    gameState: null,
    pendingResults: new Map(),
    pendingPitStops: new Set(),
    tileStartTimestamp: 0,
    tileDurationMs: 0,
    isPrivate: false,
    bannedUserIds: new Set(),
    bannedSessionIds: new Set(),
  };

  private resultTimeout: Delayed | null = null;
  private nextPlayerId = 1;
  private eventDimensionMap: Record<string, string> = {};
  private rateLimiter = new ClientRateLimiter();
  private spectatorIds: Set<string> = new Set();
  /** v5.1: Matchmaking options — auto-start when expectedPlayers have joined. */
  private autoStart = false;
  private expectedPlayers = 0;

  private getEventDimensionMap(): Record<string, string> {
    if (Object.keys(this.eventDimensionMap).length === 0) {
      EVENT_DESCRIPTORS.forEach(e => { this.eventDimensionMap[e.id] = e.performanceDimension; });
    }
    return this.eventDimensionMap;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  onCreate(options: Record<string, unknown>) {
    this.roomState.roomCode = generateRoomCode();
    this.roomState.settings.seed = String(Math.floor(Math.random() * 1000000));
    this.roomState.isPrivate = !!options.isPrivate;

    // v5.1: Matchmaking-created rooms auto-start when all expected players join.
    this.autoStart = !!options.autoStart;
    this.expectedPlayers = typeof options.expectedPlayers === 'number' ? options.expectedPlayers : 0;

    // Set max clients
    this.maxClients = MAX_ROOM_PLAYERS;

    // Allow reconnection
    this.autoDispose = false;

    // Expose room code, phase, and privacy in metadata so clients can discover via getAvailableRooms
    this.setMetadata({ roomCode: this.roomState.roomCode, phase: 'lobby', isPrivate: this.roomState.isPrivate });

    console.log(`[Room ${this.roomState.roomCode}] Created`);

    // ─── Register message handlers (with rate limiting) ────────────────
    const wrapWithRateLimit = <P,>(msgType: string, handler: (client: Client, payload: P) => void) => {
      this.onMessage(msgType, (client: Client, payload: P) => {
        const limit = (RATE_LIMITS as Record<string, { burst: number; refill: number }>)[msgType];
        if (limit) {
          if (!this.rateLimiter.isAllowed(client.sessionId, msgType, limit.burst, limit.refill)) {
            console.warn(`[Room ${this.roomState.roomCode}] Rate limited: ${msgType} from ${client.sessionId}`);
            client.send(ServerMessages.ROOM_ERROR, { message: 'Too many requests. Please slow down.' });
            return;
          }
        }
        handler(client, payload);
      });
    };

    wrapWithRateLimit<ReadyPayload>(ClientMessages.READY, (client, payload) => {
      this.handleReady(client, payload);
    });

    wrapWithRateLimit<Record<string, never>>(ClientMessages.START, (client) => {
      this.handleStart(client);
    });

    wrapWithRateLimit<UpdateSettingsPayload>(ClientMessages.UPDATE_SETTINGS, (client, payload) => {
      this.handleUpdateSettings(client, payload);
    });

    wrapWithRateLimit<EventTelemetry>(ClientMessages.SUBMIT_EVENT_RESULT, (client, payload) => {
      this.handleSubmitEventResult(client, payload);
    });

    wrapWithRateLimit<UsePowerUpPayload>(ClientMessages.USE_POWER_UP, (client, payload) => {
      this.handleUsePowerUp(client, payload);
    });

    wrapWithRateLimit<ActivateOverdrivePayload>(ClientMessages.ACTIVATE_OVERDRIVE, (client, payload) => {
      this.handleActivateOverdrive(client, payload);
    });

    wrapWithRateLimit<InterventionChoicePayload>(ClientMessages.INTERVENTION_CHOICE, (client, payload) => {
      this.handleInterventionChoice(client, payload);
    });

    wrapWithRateLimit<PitStopActionPayload>(ClientMessages.PIT_STOP_ACTION, (client, payload) => {
      this.handlePitStopAction(client, payload);
    });

    wrapWithRateLimit<Record<string, never>>(ClientMessages.REQUEST_REMATCH, (client) => {
      this.handleRematch(client);
    });

    wrapWithRateLimit<Record<string, never>>(ClientMessages.TOGGLE_PRIVATE, (client) => {
      this.handleTogglePrivate(client);
    });

    wrapWithRateLimit<KickPlayerPayload>(ClientMessages.KICK_PLAYER, (client, payload) => {
      this.handleKickPlayer(client, payload);
    });

    wrapWithRateLimit<BanPlayerPayload>(ClientMessages.BAN_PLAYER, (client, payload) => {
      this.handleBanPlayer(client, payload);
    });

    // v5.1: Latency measurement — respond to ping with pong so clients can compute RTT.
    this.onMessage(ClientMessages.PING, (client) => {
      client.send(ServerMessages.PONG, {});
    });
  }

  /**
   * Authentication gate: verifies Firebase ID token before allowing join.
   * The verified UID is stored on the client for use in onJoin.
   * In dev mode (FIREBASE_AUTH_DISABLED=1), auth is bypassed.
   */
  async onAuth(client: Client, options: RoomConfig): Promise<boolean> {
    const identity = await verifyAuthToken(options.idToken);
    if (!identity) {
      console.warn(`[Room ${this.roomState.roomCode}] Rejected join: invalid or missing auth token (session: ${client.sessionId})`);
      return false;
    }

    // Check ban list using verified UID (not client-supplied userId).
    if (this.roomState.bannedUserIds.has(identity.uid)) {
      console.warn(`[Room ${this.roomState.roomCode}] Rejected join: banned UID ${identity.uid}`);
      return false;
    }

    // Validate that client-supplied userId matches verified UID (anti-spoofing).
    if (!validateUserIdClaim(options.userId, identity.uid)) {
      console.warn(`[Room ${this.roomState.roomCode}] Rejected join: userId spoof (claimed: ${options.userId}, verified: ${identity.uid})`);
      return false;
    }

    // Store verified identity on client for use in onJoin.
    (client as any).verifiedUid = identity.uid;
    (client as any).authBypassed = identity.authBypassed;
    return true;
  }

  onJoin(client: Client, options: RoomConfig) {
    // Check ban lists (using verified UID from onAuth, not client-supplied userId)
    const verifiedUid = (client as any).verifiedUid as string | undefined;
    if (this.roomState.bannedSessionIds.has(client.sessionId) ||
        (verifiedUid && this.roomState.bannedUserIds.has(verifiedUid))) {
      throw new Error('You are banned from this room.');
    }

    // Reject joins during an active match unless spectating
    if (this.roomState.phase !== 'lobby') {
      // Check if this is a spectator join
      if ((options as any).spectate) {
        this.spectatorIds.add(client.sessionId);
        client.send(ServerMessages.SPECTATOR_MODE, { roomCode: this.roomState.roomCode });
        if (this.roomState.gameState) {
          this.sendGameStateToClient(client);
        }
        console.log(`[Room ${this.roomState.roomCode}] Spectator joined (session: ${client.sessionId})`);
        return;
      }
      throw new Error('Match already in progress.');
    }

    const playerId = this.nextPlayerId++;

    // Sanitize inputs
    const rawName = typeof options.playerName === 'string' ? options.playerName.trim() : '';
    const sanitizedName = rawName.slice(0, 20) || `Player ${playerId}`;
    const validChassis = Object.values(ChassisId).includes(options.chassisId as ChassisId)
      ? options.chassisId
      : ChassisId.Standard;

    const roomPlayer: RoomPlayer = {
      sessionId: client.sessionId,
      name: sanitizedName,
      avatarId: options.avatarId || '🤖',
      chassisId: validChassis,
      isReady: false,
      isHost: this.roomState.players.size === 0, // First player is host
      isConnected: true,
      playerId,
      userId: verifiedUid ?? options.userId, // Prefer verified UID over client claim
      // v5.0 fields
      rating: options.rating,
      teamId: options.teamId,
      skillNodeIds: options.skillNodeIds,
      moduleIds: options.moduleIds,
      reconnectAttempts: 0,
    };

    if (roomPlayer.isHost) {
      this.roomState.hostSessionId = client.sessionId;
    }

    this.roomState.players.set(client.sessionId, roomPlayer);

    console.log(`[Room ${this.roomState.roomCode}] ${roomPlayer.name} joined (session: ${client.sessionId}, playerId: ${playerId})`);

    // Send room code to joiner
    client.send(ServerMessages.ROOM_CREATED, { roomCode: this.roomState.roomCode });

    // Broadcast updated lobby state
    this.broadcastLobbyState();

    // v5.1: Auto-start when all expected players have joined (matchmaking flow).
    if (this.autoStart && this.expectedPlayers > 0 && this.roomState.players.size >= this.expectedPlayers) {
      console.log(`[Room ${this.roomState.roomCode}] Auto-starting with ${this.roomState.players.size} players`);
      this.startMatch();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    // Spectators simply leave - no reconnection needed
    if (this.spectatorIds.has(client.sessionId)) {
      this.spectatorIds.delete(client.sessionId);
      console.log(`[Room ${this.roomState.roomCode}] Spectator left (session: ${client.sessionId})`);
      if (this.roomState.players.size === 0 && this.spectatorIds.size === 0) {
        this.disconnect();
      }
      return;
    }

    const player = this.roomState.players.get(client.sessionId);
    if (!player) return;

    player.isConnected = false;

    if (this.roomState.phase === 'lobby') {
      // In lobby, just remove the player
      this.roomState.players.delete(client.sessionId);

      // Reassign host if needed
      if (player.isHost && this.roomState.players.size > 0) {
        const newHost = this.roomState.players.values().next().value;
        if (newHost) {
          newHost.isHost = true;
          this.roomState.hostSessionId = newHost.sessionId;
        }
      }

      this.broadcastLobbyState();
      console.log(`[Room ${this.roomState.roomCode}] ${player.name} left lobby`);
    } else {
      // During match, allow reconnection
      console.log(`[Room ${this.roomState.roomCode}] ${player.name} disconnected (consented: ${consented})`);

      this.broadcast(ServerMessages.PLAYER_DISCONNECTED, {
        sessionId: client.sessionId,
        playerName: player.name,
      });

      if (!consented) {
        const attempts = (player.reconnectAttempts ?? 0) + 1;
        player.reconnectAttempts = attempts;
        if (attempts > MAX_RECONNECT_ATTEMPTS_V5) {
          this.handlePlayerAbandoned(client.sessionId);
        } else {
          try {
            // Wait for reconnection (v5.0: extended grace period)
            await this.allowReconnection(client, RECONNECT_GRACE_PERIOD_V5_MS / 1000);

            // Reconnected!
            player.isConnected = true;
            console.log(`[Room ${this.roomState.roomCode}] ${player.name} reconnected`);

            this.broadcast(ServerMessages.PLAYER_RECONNECTED, {
              sessionId: client.sessionId,
              playerName: player.name,
            });

            // Send current game state to reconnected client
            if (this.roomState.gameState) {
              this.sendGameStateToClient(client);
            }
          } catch {
            // Reconnection timed out - mark as abandoned
            console.log(`[Room ${this.roomState.roomCode}] ${player.name} abandoned (reconnect timeout)`);
            this.handlePlayerAbandoned(client.sessionId);
          }
        }
      } else {
        this.handlePlayerAbandoned(client.sessionId);
      }
    }

    // Auto-dispose if empty (no players and no spectators)
    if (this.roomState.players.size === 0 && this.spectatorIds.size === 0) {
      this.disconnect();
    }
  }

  onDispose() {
    console.log(`[Room ${this.roomState.roomCode}] Disposed`);
  }

  // ─── Message Handlers ──────────────────────────────────────────────────

  private handleReady(client: Client, payload: ReadyPayload) {
    if (this.roomState.phase !== 'lobby') return;

    const player = this.roomState.players.get(client.sessionId);
    if (!player) return;

    player.isReady = payload.ready;
    this.broadcastLobbyState();
  }

  private handleStart(client: Client) {
    if (this.roomState.phase !== 'lobby') return;

    const player = this.roomState.players.get(client.sessionId);
    if (!player?.isHost) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Only the host can start the match.' });
      return;
    }

    // Check all players are ready
    const allReady = Array.from(this.roomState.players.values()).every(p => p.isReady || p.isHost);
    if (!allReady) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Not all players are ready.' });
      return;
    }

    this.startMatch();
  }

  private handleUpdateSettings(client: Client, payload: UpdateSettingsPayload) {
    if (this.roomState.phase !== 'lobby') return;

    const player = this.roomState.players.get(client.sessionId);
    if (!player?.isHost) return;

    const s = { ...this.roomState.settings, ...payload.settings };
    s.playerCount = Math.max(1, Math.min(s.playerCount, MAX_ROOM_PLAYERS));
    s.runLength = Math.max(1, Math.min(s.runLength, 20));
    s.easyBots = Math.max(0, s.easyBots);
    s.intermediateBots = Math.max(0, s.intermediateBots);
    this.roomState.settings = s;
    this.broadcastLobbyState();
  }

  private handleSubmitEventResult(client: Client, payload: EventTelemetry) {
    if (this.roomState.phase !== 'playing' || !this.roomState.gameState) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    const playerId = roomPlayer.playerId;

    // Prevent duplicate submissions
    if (this.roomState.pendingResults.has(playerId)) return;

    // Validate telemetry
    const validation = ServerEventValidator.validate(payload, {
      tileIndex: this.roomState.gameState.currentTileIndex,
      expectedEventId: this.roomState.gameState.run[this.roomState.gameState.currentTileIndex]?.eventId,
      tileStartTimestamp: this.roomState.tileStartTimestamp,
      tileDurationMs: this.roomState.tileDurationMs,
    });

    if (!validation.valid) {
      console.warn(`[Room ${this.roomState.roomCode}] Invalid telemetry from ${roomPlayer.name}: ${validation.reason}`);
      // Still accept with degraded score rather than rejecting outright
    }

    // Server computes stars from raw metrics
    const stars = ServerEventValidator.computeStars(
      payload.eventId,
      payload.primaryMetric,
      payload.secondaryMetric
    );

    const result: EventResult = {
      playerId,
      stars,
      primaryMetric: payload.primaryMetric,
      secondaryMetric: payload.secondaryMetric,
    };

    this.roomState.pendingResults.set(playerId, result);

    // Check if all human players have submitted
    this.checkAllResultsReceived();
  }

  private handleUsePowerUp(client: Client, payload: UsePowerUpPayload) {
    if (this.roomState.phase !== 'playing' || !this.roomState.gameState) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    const { newState } = GameRules.applyPowerUp(
      this.roomState.gameState,
      roomPlayer.playerId,
      payload.powerUp,
      payload.targetId,
      EVENT_DESCRIPTORS
    );

    this.roomState.gameState = newState;
    this.broadcastGameState();
  }

  private handleActivateOverdrive(client: Client, payload: ActivateOverdrivePayload) {
    if (this.roomState.phase !== 'playing' || !this.roomState.gameState) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    const { newState } = GameRules.activateOverdrive(
      this.roomState.gameState,
      roomPlayer.playerId,
      payload.force
    );

    this.roomState.gameState = newState;
    this.broadcastGameState();
  }

  private handleInterventionChoice(client: Client, payload: InterventionChoicePayload) {
    if (!this.roomState.gameState) return;
    if (!this.roomState.gameState.activeIntervention) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    // Only host can decide interventions
    if (!roomPlayer.isHost) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Only the host can decide interventions.' });
      return;
    }

    const { newState } = GameRules.resolveIntervention(
      this.roomState.gameState,
      payload.accept
    );

    this.roomState.gameState = newState;
    this.broadcastGameState();
    this.advanceToNextTile();
  }

  private handlePitStopAction(client: Client, payload: PitStopActionPayload) {
    if (!this.roomState.gameState) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    // Prevent duplicate submissions
    if (this.roomState.pendingPitStops.has(roomPlayer.playerId)) return;

    const { newState } = GameRules.processPitStop(
      this.roomState.gameState,
      roomPlayer.playerId,
      payload.action
    );

    this.roomState.gameState = newState;
    this.roomState.pendingPitStops.add(roomPlayer.playerId);
    this.broadcastGameState();

    // Check if all connected human players have submitted
    const humanPlayers = this.roomState.gameState.players.filter(
      p => !p.isBot && p.isConnected !== false
    );
    const allSubmitted = humanPlayers.every(p => this.roomState.pendingPitStops.has(p.id));

    if (allSubmitted) {
      this.roomState.pendingPitStops.clear();
      this.advanceToNextTile();
    }
  }

  private handleRematch(_client: Client) {
    if (this.roomState.phase !== 'finished') return;

    // Reset all players to unready
    for (const player of this.roomState.players.values()) {
      player.isReady = false;
    }

    this.roomState.phase = 'lobby';
    this.roomState.gameState = null;
    this.roomState.pendingResults.clear();
    this.roomState.pendingPitStops.clear();
    this.roomState.settings.seed = String(Math.floor(Math.random() * 1000000));
    this.broadcastLobbyState();
  }

  private handleTogglePrivate(client: Client) {
    if (this.roomState.phase !== 'lobby') return;

    const player = this.roomState.players.get(client.sessionId);
    if (!player?.isHost) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Only the host can toggle private mode.' });
      return;
    }

    this.roomState.isPrivate = !this.roomState.isPrivate;
    this.setMetadata({ isPrivate: this.roomState.isPrivate });
    this.broadcastLobbyState();
    console.log(`[Room ${this.roomState.roomCode}] Private: ${this.roomState.isPrivate}`);
  }

  private handleKickPlayer(client: Client, payload: KickPlayerPayload) {
    if (this.roomState.phase !== 'lobby') return;

    const host = this.roomState.players.get(client.sessionId);
    if (!host?.isHost) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Only the host can kick players.' });
      return;
    }

    if (payload.sessionId === client.sessionId) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'You cannot kick yourself.' });
      return;
    }

    const target = this.roomState.players.get(payload.sessionId);
    if (!target) return;

    // Notify the kicked player
    const targetClient = this.clients.find((c: Client) => c.sessionId === payload.sessionId);
    if (targetClient) {
      targetClient.send(ServerMessages.PLAYER_KICKED, { message: 'You were kicked from the room.' });
    }

    // Remove from room state
    this.roomState.players.delete(payload.sessionId);
    this.broadcastLobbyState();
    console.log(`[Room ${this.roomState.roomCode}] Kicked ${target.name}`);
  }

  private handleBanPlayer(client: Client, payload: BanPlayerPayload) {
    if (this.roomState.phase !== 'lobby') return;

    const host = this.roomState.players.get(client.sessionId);
    if (!host?.isHost) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Only the host can ban players.' });
      return;
    }

    if (payload.sessionId === client.sessionId) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'You cannot ban yourself.' });
      return;
    }

    const target = this.roomState.players.get(payload.sessionId);
    if (!target) return;

    // Add to ban lists
    this.roomState.bannedSessionIds.add(payload.sessionId);
    if (target.userId) {
      this.roomState.bannedUserIds.add(target.userId);
    }

    // Notify the banned player
    const targetClient = this.clients.find((c: Client) => c.sessionId === payload.sessionId);
    if (targetClient) {
      targetClient.send(ServerMessages.PLAYER_BANNED, { message: 'You were banned from the room.' });
    }

    // Remove from room state
    this.roomState.players.delete(payload.sessionId);
    this.broadcastLobbyState();
    console.log(`[Room ${this.roomState.roomCode}] Banned ${target.name}`);
  }

  // ─── Match Lifecycle ───────────────────────────────────────────────────

  private startMatch() {
    this.roomState.phase = 'countdown';
    this.lock(); // Prevent new joins during match

    const settings = { ...this.roomState.settings };
    const humanCount = this.roomState.players.size;
    const totalPlayers = settings.playerCount;
    const botCount = Math.max(0, totalPlayers - humanCount);

    // Adjust bot counts
    settings.easyBots = Math.min(settings.easyBots, botCount);
    settings.intermediateBots = botCount - settings.easyBots;

    // Initialize game state
    const gameState = this.initializeGameState(settings);
    this.roomState.gameState = gameState;

    // Broadcast initial game state so clients have data before the countdown transition
    this.broadcastGameState();

    // Broadcast countdown
    this.broadcast(ServerMessages.COUNTDOWN, { tileIndex: 0 });
    this.broadcast(ServerMessages.START_COUNTDOWN, { durationMs: 3500, tileIndex: 0 });

    // Start first tile after countdown delay
    this.clock.setTimeout(() => {
      this.roomState.phase = 'playing';
      this.startTile();
    }, 3500); // Match the existing countdown duration
  }

  private initializeGameState(settings: GameSettings): GameState {
    const rng = new SeededRNG(`players-${settings.seed}`);
    const players: Player[] = [];
    const shuffledBotNames = rng.shuffle([...BOT_NAMES]);
    let botCount = 0;

    // Add human players
    for (const roomPlayer of this.roomState.players.values()) {
      players.push({
        id: roomPlayer.playerId,
        name: roomPlayer.name,
        isBot: false,
        isRival: false,
        playerType: 'human',
        connectionId: roomPlayer.sessionId,
        chassisId: roomPlayer.chassisId,
        color: PLAYER_COLORS[(roomPlayer.playerId - 1) % PLAYER_COLORS.length],
        position: 0,
        powerUps: [],
        statuses: [],
        tileHistory: [],
        energy: 0,
        overdriveCooldown: 0,
        isConnected: true,
        isReady: true,
      });

      // Apply Chassis effects
      if (roomPlayer.chassisId === ChassisId.Aegis) {
        players[players.length - 1].powerUps.push('Shield');
      }

      // v5.0: Apply skill and loadout effects
      if (roomPlayer.skillNodeIds && roomPlayer.skillNodeIds.length > 0) {
        const skills: PilotSkills = {
          speed: {}, tech: {}, endurance: {}, availableCP: 0,
        };
        for (const id of roomPlayer.skillNodeIds) {
          if (id.startsWith('speed-')) skills.speed[id] = true;
          else if (id.startsWith('tech-')) skills.tech[id] = true;
          else if (id.startsWith('endurance-')) skills.endurance[id] = true;
        }
        players[players.length - 1] = applySkillEffects(players[players.length - 1], skills);
      }
      if (roomPlayer.moduleIds && roomPlayer.moduleIds.length > 0) {
        const loadout: ChassisLoadout = {
          chassisId: roomPlayer.chassisId,
          modules: {},
        };
        const slotKeys = ['core', 'thrusters', 'shielding'] as const;
        roomPlayer.moduleIds.forEach((mid, i) => {
          if (i < 3) loadout.modules[slotKeys[i]] = mid;
        });
        players[players.length - 1] = applyLoadoutEffects(players[players.length - 1], loadout);
      }
    }

    // Add bots
    const botConfigs: { personality: BotPersonality; count: number }[] = [
      { personality: BotPersonality.Intermediate, count: settings.intermediateBots },
      { personality: BotPersonality.Easy, count: settings.easyBots },
    ];

    botConfigs.forEach(config => {
      for (let i = 0; i < config.count; i++) {
        const pid = this.nextPlayerId++;
        players.push({
          id: pid,
          name: shuffledBotNames[botCount++ % shuffledBotNames.length],
          isBot: true,
          isRival: false,
          playerType: 'bot',
          personality: config.personality,
          color: PLAYER_COLORS[(pid - 1) % PLAYER_COLORS.length],
          position: 0,
          powerUps: [],
          statuses: [],
          tileHistory: [],
          energy: 0,
          overdriveCooldown: 0,
        });
      }
    });

    // Config Rival
    const potentialRivals = players.filter(p => p.isBot && p.personality === BotPersonality.Intermediate);
    let rivalBot = potentialRivals.length > 0 ? potentialRivals[0] : players.find(p => p.isBot);

    if (rivalBot) {
      rivalBot.isRival = true;
      rivalBot.personality = BotPersonality.Rival;
      rivalBot.name = `Rival ${rivalBot.name}`;

      const chassisIds = Object.values(ChassisId).filter(id => CHASSIS_DEFINITIONS[id].cost > 0);
      const randomChassisId = chassisIds[rng.nextInt(0, chassisIds.length)];
      rivalBot.chassisId = randomChassisId;
      if (randomChassisId === ChassisId.Aegis) rivalBot.powerUps.push('Shield');
    }

    // Generate run
    let run = generateRun(settings.seed, settings.runLength, EVENT_DESCRIPTORS);

    // 15% chance for anomaly
    let activeAnomaly = null;
    if (rng.nextFloat() < 0.15) {
      const anomalyIds = Object.values(AnomalyId);
      const randomAnomalyId = anomalyIds[rng.nextInt(0, anomalyIds.length)];
      activeAnomaly = { id: randomAnomalyId, ...ANOMALY_DEFINITIONS[randomAnomalyId] };

      if (randomAnomalyId === AnomalyId.ChronosShift) {
        const firstTile = run[0];
        const remainingTiles = run.slice(1);
        run = [firstTile, ...rng.shuffle(remainingTiles)];
      } else if (randomAnomalyId === AnomalyId.VoidCollapse) {
        const newLength = Math.max(4, Math.floor(run.length * 0.75));
        run = run.slice(0, newLength).map(tile => ({
          ...tile,
          difficulty: Math.min(3, tile.difficulty + 1),
        }));
      }
    }

    return {
      settings,
      players,
      run,
      currentTileIndex: 0,
      eventResults: {},
      lastTileResults: null,
      overdrivingPlayerIds: [],
      activeIntervention: null,
      lastHazardInterventionIndex: -99,
      activeAnomaly,
    };
  }

  private startTile() {
    if (!this.roomState.gameState) return;

    const gs = this.roomState.gameState;
    if (gs.currentTileIndex >= gs.run.length) {
      this.finishRace();
      return;
    }

    const tile = gs.run[gs.currentTileIndex];
    // Conservative server-side default for timeout validation; actual event duration is client-side.
    const baseDuration = 15000;
    const anomalyMult = gs.activeAnomaly?.id === 'TIME_DILATION' ? 0.8 : 1;
    this.roomState.tileDurationMs = baseDuration * anomalyMult;
    this.roomState.tileStartTimestamp = Date.now();
    this.roomState.pendingResults.clear();

    const tileStart: TileStartPayload = {
      tileIndex: gs.currentTileIndex,
      eventId: tile.eventId,
      subSeed: tile.subSeed || '',
      difficulty: tile.difficulty,
      modifier: tile.modifier,
      isHazard: tile.isHazard,
      startTimestamp: this.roomState.tileStartTimestamp,
      durationMs: this.roomState.tileDurationMs,
      anomalyId: gs.activeAnomaly?.id,
    };

    this.broadcast(ServerMessages.TILE_START, tileStart);

    // Simulate bot power-up and overdrive decisions (mirroring client EventRunner logic)
    if (this.roomState.gameState) {
      const gsForBots = this.roomState.gameState;
      this.clock.setTimeout(() => {
        if (!this.roomState.gameState) return;
        for (const player of gsForBots.players) {
          if (!player.isBot) continue;

          if (decideBotOverdrive(player, gsForBots)) {
            const { newState } = GameRules.activateOverdrive(gsForBots, player.id);
            this.roomState.gameState = newState;
          }

          const powerUpDecision = decideBotPowerUp(player, gsForBots, tile);
          if (powerUpDecision) {
            const { newState } = GameRules.applyPowerUp(
              this.roomState.gameState, player.id, powerUpDecision.use,
              powerUpDecision.targetId, EVENT_DESCRIPTORS
            );
            this.roomState.gameState = newState;
          }
        }
        this.broadcastGameState();
      }, Math.floor(Math.random() * 2000) + 500);
    }

    // Set timeout for missing submissions
    if (this.resultTimeout) this.resultTimeout.clear();
    this.resultTimeout = this.clock.setTimeout(() => {
      this.handleResultTimeout();
    }, EVENT_RESULT_TIMEOUT_MS);
  }

  private checkAllResultsReceived() {
    if (!this.roomState.gameState) return;

    const humanPlayers = this.roomState.gameState.players.filter(
      p => !p.isBot && p.isConnected !== false
    );

    const allReceived = humanPlayers.every(p =>
      this.roomState.pendingResults.has(p.id)
    );

    if (allReceived) {
      if (this.resultTimeout) this.resultTimeout.clear();
      this.processTileResults();
    }
  }

  private handleResultTimeout() {
    if (!this.roomState.gameState) return;

    // Assign 0 stars to missing human players
    for (const player of this.roomState.gameState.players) {
      if (!player.isBot && !this.roomState.pendingResults.has(player.id)) {
        this.roomState.pendingResults.set(player.id, {
          playerId: player.id,
          stars: 0,
          primaryMetric: 0,
        });
      }
    }

    this.processTileResults();
  }

  private processTileResults() {
    if (!this.roomState.gameState) return;

    // Simulate bot performance
    const gs = this.roomState.gameState;
    const currentTile = gs.run[gs.currentTileIndex];

    // Build BotEventInfo from server-side descriptors + star computers
    const eventDesc = EVENT_DESCRIPTORS.find(e => e.id === currentTile.eventId);
    const starComputer = STAR_COMPUTERS[currentTile.eventId];
    const botEventInfo = eventDesc && starComputer ? {
      id: eventDesc.id,
      performanceDimension: eventDesc.performanceDimension,
      isStub: eventDesc.isStub,
      getStars: (result: { primaryMetric: number; secondaryMetric?: number }) =>
        starComputer(result.primaryMetric, result.secondaryMetric),
    } : null;

    for (const player of gs.players) {
      if (player.isBot && !this.roomState.pendingResults.has(player.id)) {
        let botResult: { stars: number; primaryMetric: number; secondaryMetric?: number };

        if (botEventInfo) {
          // Full bot simulation using shared botMind
          // rivalTraits come from PilotProfile (Phase 3: Firebase); not available on server yet
          const result = simulateBotPerformance(
            player, botEventInfo, currentTile.difficulty, gs.settings
          );
          botResult = { stars: result.stars, primaryMetric: result.primaryMetric, secondaryMetric: result.secondaryMetric };
        } else {
          // Fallback: simplified star-probability roll for unknown events
          const botRng = new SeededRNG(`bot-${player.id}-tile-${currentTile.eventId}-${gs.settings.seed}`);
          const starRoll = botRng.nextFloat();
          const stars: 1 | 2 | 3 = starRoll < 0.25 ? 3 : starRoll < 0.70 ? 2 : 1;
          botResult = { stars, primaryMetric: 0 };
        }

        this.roomState.pendingResults.set(player.id, {
          playerId: player.id,
          stars: botResult.stars as 0 | 1 | 2 | 3,
          primaryMetric: botResult.primaryMetric,
        });
      }
    }

    // Build results map
    const results: { [playerId: number]: EventResult } = {};
    for (const [pid, result] of this.roomState.pendingResults) {
      results[pid] = result;
    }

    // Process through shared game rules
    const { newState } = GameRules.processRaceStep(gs, results, EVENT_DESCRIPTORS);
    this.roomState.gameState = newState;

    // Broadcast results
    const tileResults: TileResultsPayload = {
      results,
      gameState: newState,
    };

    this.roomState.phase = 'tile_results';
    this.broadcast(ServerMessages.TILE_RESULTS, tileResults);

    // Auto-advance after delay
    this.clock.setTimeout(() => {
      this.advanceAfterResults();
    }, 3000);
  }

  private advanceAfterResults() {
    if (!this.roomState.gameState) return;

    const gs = this.roomState.gameState;

    // Check for race end
    if (gs.currentTileIndex >= gs.run.length) {
      this.finishRace();
      return;
    }

    // Check for intervention
    if (gs.activeIntervention) {
      const rival = gs.players.find(p => p.isRival);
      const standardTile = gs.run[gs.currentTileIndex];
      this.broadcast(ServerMessages.INTERVENTION, {
        rivalName: rival?.name ?? 'Rival',
        standardTile,
        hazardTile: gs.activeIntervention.hazardTile,
        cpBonus: gs.activeIntervention.cpBonus,
      });
      // Wait for host's intervention choice
      return;
    }

    // Check for pit stop
    const tilesPerStage = 4;
    if (gs.currentTileIndex > 0 && gs.currentTileIndex % tilesPerStage === 0) {
      this.broadcast(ServerMessages.PIT_STOP, {});
      return;
    }

    this.advanceToNextTile();
  }

  private advanceToNextTile() {
    this.roomState.phase = 'playing';
    this.broadcast(ServerMessages.COUNTDOWN, {
      tileIndex: this.roomState.gameState?.currentTileIndex ?? 0,
    });
    this.broadcast(ServerMessages.START_COUNTDOWN, {
      durationMs: 3500,
      tileIndex: this.roomState.gameState?.currentTileIndex ?? 0,
    });

    this.clock.setTimeout(() => {
      this.startTile();
    }, 3500);
  }

  private async finishRace() {
    if (!this.roomState.gameState) return;

    this.roomState.phase = 'finished';

    const sortedPlayers = [...this.roomState.gameState.players].sort(
      (a, b) => b.position - a.position
    );

    const finalStandings = sortedPlayers.map((p, idx) => ({
      playerId: p.id,
      name: p.name,
      position: p.position,
      totalStars: p.tileHistory.reduce((sum, h) => sum + h.stars, 0),
      placement: idx + 1,
    }));

    // Broadcast race finished immediately — clients see standings without waiting for Firebase
    const payload: RaceFinishedPayload = {
      finalStandings,
      gameState: this.roomState.gameState,
    };
    this.broadcast(ServerMessages.RACE_FINISHED, payload);
    this.unlock(); // Allow new joins for rematch

    // ── Async per-player summary pipeline (parallel, non-blocking) ──────────
    const dailySeed = new Date().toISOString().split('T')[0];
    const contracts = generateContracts(this.roomState.gameState.settings.seed);
    const eventDimensionMap = this.getEventDimensionMap();
    const gs = this.roomState.gameState; // capture snapshot
    const roomCode = this.roomState.roomCode;

    const summaryTasks = [...this.roomState.players.entries()]
      .filter(([, rp]) => !!rp.userId)
      .map(async ([sessionId, roomPlayer]) => {
        const gamePlayer = gs.players.find(p => p.id === roomPlayer.playerId);
        if (!gamePlayer || gamePlayer.isBot) return;

        // Use a Firestore transaction for atomic read-modify-write.
        // This prevents lost updates if two matches finish for the same user
        // simultaneously, and ensures the appliedMatchIds dedup check is atomic.
        const updatedProfile = await updateProfileTransaction(roomPlayer.userId!, (currentProfile) => {
          if (!currentProfile) {
            console.log(`[Room ${roomCode}] No profile for ${roomPlayer.userId} — skipping summary.`);
            return null;
          }

          const currentDailyBest = currentProfile.dailyBests?.[dailySeed] ?? null;
          const summary = computeMatchSummary({
            gameState: gs,
            profile: currentProfile,
            mode: 'online',
            contracts,
            eventDimensionMap,
            dailySeed,
            currentDailyBest,
            targetPlayerId: roomPlayer.playerId,
          });

          const newProfile = applyMatchSummaryToProfile(currentProfile, summary);
          if (!newProfile) {
            console.log(`[Room ${roomCode}] Match ${summary.matchId} already applied for ${roomPlayer.userId}.`);
            return null;
          }

          // v5.0: Compute ranked rating changes if this was a ranked match
          if (roomPlayer.rating) {
            const allPlayers = gs.players.map(p => {
              const rp = [...this.roomState.players.values()].find(r => r.playerId === p.id);
              return { playerId: p.id, rating: rp?.rating ?? 1000, placement: sortedPlayers.indexOf(p) };
            });
            const ratingChanges = computeMultiPlayerRatingChanges(allPlayers);
            const myChange = ratingChanges.get(roomPlayer.playerId) ?? 0;
            if (myChange !== 0) {
              if (!newProfile.rank) newProfile.rank = createDefaultRankInfo();
              newProfile.rank = applyRatingChange(newProfile.rank, myChange, myChange > 0);
            }
          }

          return newProfile;
        });

        if (!updatedProfile) return;

        // Re-derive summary for leaderboard/history from the updated profile.
        // The summary was computed inside the transaction; we recompute here
        // for the side-effect data (leaderboard, history).
        const currentDailyBest = updatedProfile.dailyBests?.[dailySeed] ?? null;
        const summary = computeMatchSummary({
          gameState: gs,
          profile: updatedProfile,
          mode: 'online',
          contracts,
          eventDimensionMap,
          dailySeed,
          currentDailyBest,
          targetPlayerId: roomPlayer.playerId,
        });

        // ── Write leaderboard entries (allTime + daily + gauntlet) ────────
        const lbEntry: LeaderboardEntry = {
          userId: roomPlayer.userId!,
          playerName: updatedProfile.name,
          avatarId: updatedProfile.avatarId,
          circuitPoints: updatedProfile.circuitPoints,
          bestScore: summary.humanPlacement === 0 ? 1 : 0,
          updatedAt: Date.now(),
        };
        await writeLeaderboardEntry('allTime', lbEntry);

        if (summary.isDaily && summary.dailyIsNewBest && summary.dailyPersonalBest !== null) {
          await writeLeaderboardEntry('daily', { ...lbEntry, bestScore: summary.dailyPersonalBest }, dailySeed);
        }

        if (summary.isGauntlet && summary.gauntletNewHighScore && summary.gauntletTilesSurvived !== null) {
          await writeLeaderboardEntry('gauntlet', { ...lbEntry, bestScore: summary.gauntletTilesSurvived });
        }

        // ── Write match history ───────────────────────────────────────────
        const historyEntry: MatchHistoryEntry = {
          matchId: summary.matchId,
          seed: summary.seed,
          mode: 'online',
          completedAt: summary.completedAt,
          runLength: summary.runLength,
          placement: summary.humanPlacement + 1,
          totalPlayers: gs.players.length,
          cpEarned: summary.cp.totalCp,
          isDaily: summary.isDaily,
          isGauntlet: summary.isGauntlet,
          rivalDefeated: summary.rivalDelta?.wins === 1,
          gauntletTilesSurvived: summary.gauntletTilesSurvived,
        };
        await writeMatchHistory(roomPlayer.userId!, historyEntry);

        const client = this.clients.find(c => c.sessionId === sessionId);
        if (client) {
          client.send(ServerMessages.MATCH_SUMMARY, { summary });
        }
      });

    Promise.allSettled(summaryTasks).then(results => {
      results.forEach(r => {
        if (r.status === 'rejected') {
          console.error(`[Room ${roomCode}] Summary pipeline error:`, r.reason);
        }
      });
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private handlePlayerAbandoned(sessionId: string) {
    const player = this.roomState.players.get(sessionId);
    if (!player) return;

    // Mark player as disconnected in game state
    if (this.roomState.gameState) {
      const gamePlayer = this.roomState.gameState.players.find(
        p => p.connectionId === sessionId
      );
      if (gamePlayer) {
        gamePlayer.isConnected = false;
      }
    }

    // Remove the player from the room so empty-room detection works
    this.roomState.players.delete(sessionId);
    this.rateLimiter.removeClient(sessionId);

    // If we're waiting for their result, submit a 0-star default
    if (this.roomState.phase === 'playing') {
      if (!this.roomState.pendingResults.has(player.playerId)) {
        this.roomState.pendingResults.set(player.playerId, {
          playerId: player.playerId,
          stars: 0,
          primaryMetric: 0,
        });
        this.checkAllResultsReceived();
      }
    }

    // If a disconnected player hasn't submitted pit stop action, auto-advance
    if (this.roomState.phase === 'tile_results' || this.roomState.phase === 'playing') {
      if (!this.roomState.pendingPitStops.has(player.playerId)) {
        this.roomState.pendingPitStops.add(player.playerId);
        const humanPlayers = this.roomState.gameState?.players.filter(
          p => !p.isBot && p.isConnected !== false
        ) ?? [];
        const allSubmitted = humanPlayers.every(p => this.roomState.pendingPitStops.has(p.id));
        if (allSubmitted && this.roomState.pendingPitStops.size > 0) {
          this.roomState.pendingPitStops.clear();
          this.advanceToNextTile();
        }
      }
    }

    // If host abandons during intervention, auto-reject it
    if (this.roomState.phase === 'tile_results' && player.isHost && this.roomState.gameState?.activeIntervention) {
      const { newState } = GameRules.resolveIntervention(this.roomState.gameState, false);
      this.roomState.gameState = newState;
      this.broadcastGameState();
      this.advanceToNextTile();
    }
  }

  private broadcastLobbyState() {
    const lobbyPlayers: LobbyPlayer[] = Array.from(this.roomState.players.values()).map(p => ({
      sessionId: p.sessionId,
      name: p.name,
      avatarId: p.avatarId,
      chassisId: p.chassisId,
      isReady: p.isReady,
      isHost: p.isHost,
      isConnected: p.isConnected,
      // v5.0 fields
      rating: p.rating,
      teamId: p.teamId,
    }));

    // Update metadata with current phase and privacy for room discovery
    this.setMetadata({ phase: this.roomState.phase, isPrivate: this.roomState.isPrivate });

    this.broadcast('room:state', {
      roomCode: this.roomState.roomCode,
      phase: this.roomState.phase,
      hostSessionId: this.roomState.hostSessionId,
      players: lobbyPlayers,
      settings: this.roomState.settings,
      isPrivate: this.roomState.isPrivate,
    });
  }

  private broadcastGameState() {
    if (this.roomState.gameState) {
      this.broadcast('game:state', {
        gameState: this.roomState.gameState,
        phase: this.roomState.phase,
      });
    }
  }

  private sendGameStateToClient(client: Client) {
    if (!this.roomState.gameState) return;

    client.send('game:state', {
      gameState: this.roomState.gameState,
      phase: this.roomState.phase,
    });

    // Re-send phase-specific messages so the reconnecting client renders correctly
    const gs = this.roomState.gameState;
    if (gs.activeIntervention && this.roomState.phase === 'tile_results') {
      const rival = gs.players.find(p => p.isRival);
      const standardTile = gs.run[gs.currentTileIndex];
      client.send(ServerMessages.INTERVENTION, {
        rivalName: rival?.name ?? 'Rival',
        standardTile,
        hazardTile: gs.activeIntervention.hazardTile,
        cpBonus: gs.activeIntervention.cpBonus,
      });
    } else if (
      this.roomState.phase === 'tile_results' &&
      gs.currentTileIndex > 0 &&
      gs.currentTileIndex % 4 === 0 &&
      this.roomState.pendingPitStops.size > 0
    ) {
      // Still awaiting pit stop actions
      client.send(ServerMessages.PIT_STOP, {});
    }
  }
}

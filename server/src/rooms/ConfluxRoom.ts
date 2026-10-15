/**
 * server/src/rooms/ConfluxRoom.ts
 * 
 * Authoritative Colyseus room for Conflux Circuit multiplayer matches.
 * Manages: lobby roster, ready state, match lifecycle, tile progression,
 * event result validation, scoring, and reconnection.
 */

import { Room, Client, Delayed, matchMaker } from 'colyseus';
import {
  GameState, GameSettings, Player, EventResult,
  ChassisId, BotPersonality, AnomalyId,
  RoomConfig, MatchPhase, EventTelemetry, LobbyPlayer,
  TeamId, PilotProfile,
} from '../../../shared/types';
import {
  PLAYER_COLORS, BOT_NAMES, CHASSIS_DEFINITIONS, ANOMALY_DEFINITIONS,
  MAX_ROOM_PLAYERS, EVENT_RESULT_TIMEOUT_MS,
  ROOM_CODE_LENGTH,
  RECONNECT_GRACE_PERIOD_V5_MS, MAX_RECONNECT_ATTEMPTS_V5,
  PIT_STOP_CONFIG,
} from '../../../shared/constants';
import { SeededRNG } from '../../../shared/seededRNG';
import { generateRun, generateCustomRun } from '../../../shared/pathGenerator';
import { GameRules } from '../../../shared/gameRules';
import { simulateBotPerformance, decideBotPowerUp, decideBotOverdrive, applyRivalTraitsToPlayer } from '../../../shared/botMind';
import {
  ClientMessages, ServerMessages,
  TileStartPayload, TileResultsPayload, RaceFinishedPayload,
  ReadyPayload, UsePowerUpPayload, ActivateOverdrivePayload,
  InterventionChoicePayload, PitStopActionPayload, UpdateSettingsPayload,
  KickPlayerPayload, BanPlayerPayload,
} from '../../../shared/protocol';
import { EVENT_DESCRIPTORS, STAR_COMPUTERS } from '../eventDescriptors';
import { getCanonicalEventDurationSec } from '../../../shared/eventCatalog';
import { ServerEventValidator } from '../validation/eventValidator';
import { ClientRateLimiter, RATE_LIMITS } from '../validation/rateLimiter';
import {
  applySkillEffects, applyLoadoutEffects, applySyndicatePerks,
  rollStartingLoadoutPerks, assignTeams, applySeasonalModifierToSettings,
  applySeasonalModifierToPlayer, getSeasonalAnomalyChance,
  sanitizeGameSettings, validateLoadoutAndSkills,
} from '../../../shared/gameSetup';
import { getProfile } from '../services/profileRepository';
import { runMatchSummaryPipeline, RoomPlayerInfo } from '../services/matchSummaryPipeline';
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
  storedProfile?: PilotProfile | null;
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
  private pitStopTimeout: Delayed | null = null;
  private interventionTimeout: Delayed | null = null;
  private stormInterval: Delayed | null = null;
  private nextPlayerId = 1;
  private eventDimensionMap: Record<string, string> = {};
  private rateLimiter = new ClientRateLimiter();
  private spectatorIds: Set<string> = new Set();
  /** v5.1: Matchmaking options — auto-start when expectedPlayers have joined. */
  private autoStart = false;
  private expectedPlayers = 0;
  private isRankedMatch = false;
  private tournamentRoomId: string | null = null;
  private tournamentMatchId: string | null = null;
  private allowedParticipantIds: Set<string> | null = null;
  /** Timeout handle for auto-start grace period. */
  private autoStartTimeout: Delayed | null = null;

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
    this.isRankedMatch = options.queueType === 'ranked';
    this.tournamentRoomId = typeof options.tournamentRoomId === 'string' ? options.tournamentRoomId : null;
    this.tournamentMatchId = typeof options.tournamentMatchId === 'string' ? options.tournamentMatchId : null;
    this.allowedParticipantIds = Array.isArray(options.allowedParticipantIds)
      ? new Set((options.allowedParticipantIds as string[]).filter(Boolean))
      : null;

    // v5.1: Auto-start timeout — if not all expected players join within 30s
    // (e.g., a matched player disconnected before consuming their seat reservation),
    // start with available players and fill remaining slots with bots.
    if (this.autoStart && this.expectedPlayers > 0) {
      this.autoStartTimeout = this.clock.setTimeout(() => {
        if (this.roomState.phase === 'lobby' && this.roomState.players.size < this.expectedPlayers) {
          console.log(`[Room ${this.roomState.roomCode}] Auto-start timeout: only ${this.roomState.players.size}/${this.expectedPlayers} players joined, filling with bots`);
          this.startMatch();
        }
      }, 30_000);
    }

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

    // Store verified identity and authoritative stored profile on client for use in onJoin.
    (client as any).verifiedUid = identity.uid;
    (client as any).authBypassed = identity.authBypassed;
    if (!identity.authBypassed) {
      try {
        const storedProfile = await getProfile(identity.uid);
        (client as any).storedProfile = storedProfile;
      } catch {
        (client as any).storedProfile = null;
      }
    } else {
      (client as any).storedProfile = null;
    }
    return true;
  }

  onJoin(client: Client, options: RoomConfig) {
    if (!this.spectatorIds) this.spectatorIds = new Set();
    // Check ban lists (using verified UID from onAuth, not client-supplied userId)
    const verifiedUid = (client as any).verifiedUid as string | undefined;
    const storedProfile = (client as any).storedProfile as PilotProfile | null | undefined;
    if (this.roomState.bannedSessionIds.has(client.sessionId) ||
        (verifiedUid && this.roomState.bannedUserIds.has(verifiedUid))) {
      throw new Error('You are banned from this room.');
    }

    // Check if this is a spectator join (allowed in any phase)
    if ((options as any)?.spectate) {
      this.spectatorIds.add(client.sessionId);
      client.send(ServerMessages.SPECTATOR_MODE, { roomCode: this.roomState.roomCode });
      if (this.roomState.gameState) {
        this.sendGameStateToClient(client);
      }
      console.log(`[Room ${this.roomState.roomCode}] Spectator joined (session: ${client.sessionId})`);
      return;
    }

    // Reject non-spectator joins during an active match
    if (this.roomState.phase !== 'lobby') {
      throw new Error('Match already in progress.');
    }

    // If this is a restricted tournament child match, verify participant admission
    if (this.allowedParticipantIds && this.allowedParticipantIds.size > 0) {
      const candidateIds = [
        client.sessionId,
        verifiedUid,
        options?.userId,
        options?.playerName,
      ].filter((v): v is string => typeof v === 'string' && v.length > 0);
      const isAllowed = candidateIds.some(id => this.allowedParticipantIds!.has(id));
      if (!isAllowed) {
        throw new Error('You are not a participant in this tournament match.');
      }
    }

    const playerId = this.nextPlayerId++;

    // Sanitize inputs and validate loadout/skills against authoritative profile if available
    const rawName = typeof options?.playerName === 'string' ? options.playerName.trim() : '';
    const sanitizedName = rawName.slice(0, 20) || storedProfile?.name?.slice(0, 20) || `Player ${playerId}`;
    const { validChassisId, skills, loadout } = validateLoadoutAndSkills(
      options?.chassisId as ChassisId,
      options?.skillNodeIds,
      options?.moduleIds,
      storedProfile
    );
    const validatedSkillIds = [
      ...Object.keys(skills.speed).filter(k => skills.speed[k]),
      ...Object.keys(skills.tech).filter(k => skills.tech[k]),
      ...Object.keys(skills.endurance).filter(k => skills.endurance[k]),
    ];
    const validatedModuleIds = Object.values(loadout.modules).filter(Boolean) as string[];
    const authoritativeRating = storedProfile?.rank?.rating ?? (
      typeof options?.rating === 'number' && Number.isFinite(options.rating)
        ? Math.max(0, Math.min(5000, Math.round(options.rating)))
        : undefined
    );

    const roomPlayer: RoomPlayer = {
      sessionId: client.sessionId,
      name: sanitizedName,
      avatarId: options?.avatarId || storedProfile?.avatarId || '🤖',
      chassisId: validChassisId,
      isReady: false,
      isHost: this.roomState.players.size === 0, // First player is host
      isConnected: true,
      playerId,
      userId: verifiedUid ?? options?.userId, // Prefer verified UID over client claim
      // v5.0 fields
      rating: authoritativeRating,
      teamId: options?.teamId,
      skillNodeIds: validatedSkillIds,
      moduleIds: validatedModuleIds,
      storedProfile: storedProfile ?? null,
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
      if (this.autoStartTimeout) {
        this.autoStartTimeout.clear();
        this.autoStartTimeout = null;
      }
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
    this.clearTimers();
    console.log(`[Room ${this.roomState.roomCode}] Disposed`);
  }

  private clearTimers() {
    if (this.autoStartTimeout) {
      this.autoStartTimeout.clear();
      this.autoStartTimeout = null;
    }
    if (this.resultTimeout) {
      this.resultTimeout.clear();
      this.resultTimeout = null;
    }
    if (this.pitStopTimeout) {
      this.pitStopTimeout.clear();
      this.pitStopTimeout = null;
    }
    if (this.interventionTimeout) {
      this.interventionTimeout.clear();
      this.interventionTimeout = null;
    }
    if (this.stormInterval) {
      this.stormInterval.clear();
      this.stormInterval = null;
    }
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
    if (!payload || typeof payload.settings !== 'object' || payload.settings === null) return;

    const player = this.roomState.players.get(client.sessionId);
    if (!player?.isHost) return;

    this.roomState.settings = sanitizeGameSettings(
      { ...this.roomState.settings, ...payload.settings },
      { defaultSeed: this.roomState.settings.seed }
    );
    this.roomState.settings.playerCount = Math.max(1, Math.min(this.roomState.settings.playerCount, MAX_ROOM_PLAYERS));
    this.broadcastLobbyState();
  }

  private handleSubmitEventResult(client: Client, payload: EventTelemetry) {
    if (this.roomState.phase !== 'playing' || !this.roomState.gameState) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    const playerId = roomPlayer.playerId;

    // Prevent duplicate submissions
    if (this.roomState.pendingResults.has(playerId)) return;

    const expectedTile = this.roomState.gameState.run[this.roomState.gameState.currentTileIndex];
    if (!expectedTile) return;

    // Validate telemetry against authoritative tile and event state
    const validation = ServerEventValidator.validate(payload, {
      tileIndex: this.roomState.gameState.currentTileIndex,
      expectedEventId: expectedTile.eventId,
      tileStartTimestamp: this.roomState.tileStartTimestamp,
      tileDurationMs: this.roomState.tileDurationMs,
    });

    if (!validation.valid) {
      console.warn(`[Room ${this.roomState.roomCode}] Invalid telemetry rejected from ${roomPlayer.name}: ${validation.reason}`);
      client.send?.(ServerMessages.ROOM_ERROR, {
        message: `Invalid event result rejected: ${validation.reason}`,
      });
      this.roomState.pendingResults.set(playerId, {
        playerId,
        stars: 0,
        primaryMetric: 0,
      });
      this.checkAllResultsReceived();
      return;
    }

    // Server computes stars from raw metrics using the authoritative tile's eventId
    const stars = ServerEventValidator.computeStars(
      expectedTile.eventId,
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
    if (!payload || typeof payload.powerUp !== 'string') return;

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

  private handleActivateOverdrive(client: Client, _payload: ActivateOverdrivePayload) {
    if (this.roomState.phase !== 'playing' || !this.roomState.gameState) return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    // Never trust client-supplied `force`; clients must pay energy and obey cooldown
    const { newState } = GameRules.activateOverdrive(
      this.roomState.gameState,
      roomPlayer.playerId,
      false
    );

    this.roomState.gameState = newState;
    this.broadcastGameState();
  }

  private handleInterventionChoice(client: Client, payload: InterventionChoicePayload) {
    if (!this.roomState.gameState) return;
    if (this.roomState.phase !== 'intervention' && this.roomState.phase !== 'tile_results') return;
    if (!this.roomState.gameState.activeIntervention) return;
    if (!payload || typeof payload.accept !== 'boolean') return;

    const roomPlayer = this.roomState.players.get(client.sessionId);
    if (!roomPlayer) return;

    // Only host can decide interventions
    if (!roomPlayer.isHost) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Only the host can decide interventions.' });
      return;
    }

    if (this.interventionTimeout) {
      this.interventionTimeout.clear();
      this.interventionTimeout = null;
    }

    const { newState } = GameRules.resolveIntervention(
      this.roomState.gameState,
      payload.accept
    );

    this.roomState.gameState = newState;
    this.broadcastGameState();
    this.advanceAfterIntervention();
  }

  private handlePitStopAction(client: Client, payload: PitStopActionPayload) {
    if (!this.roomState.gameState) return;
    if (this.roomState.phase !== 'pit_stop') {
      client.send?.(ServerMessages.ROOM_ERROR, { message: 'Pit stop actions are only allowed during a pit stop.' });
      return;
    }

    if (
      !payload ||
      typeof payload.action !== 'string' ||
      !Object.prototype.hasOwnProperty.call(PIT_STOP_CONFIG.actions, payload.action)
    ) {
      client.send?.(ServerMessages.ROOM_ERROR, { message: 'Invalid pit stop action.' });
      return;
    }

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
      if (this.pitStopTimeout) {
        this.pitStopTimeout.clear();
        this.pitStopTimeout = null;
      }
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
    // Note: onJoin already rejects non-spectator joins when phase !== 'lobby';
    // keeping the room unlocked at the transport layer allows spectators to join active matches.

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

  private initializeGameState(rawSettings: GameSettings): GameState {
    const sanitized = sanitizeGameSettings(rawSettings, { defaultSeed: rawSettings.seed });
    const { settings, modifier: seasonalModifier } = applySeasonalModifierToSettings(sanitized);
    const rng = new SeededRNG(`players-${settings.seed}`);
    let players: Player[] = [];
    const shuffledBotNames = rng.shuffle([...BOT_NAMES]);
    let botCount = 0;

    // Add human players
    for (const roomPlayer of this.roomState.players.values()) {
      const { validChassisId, skills, loadout } = validateLoadoutAndSkills(
        roomPlayer.chassisId,
        roomPlayer.skillNodeIds,
        roomPlayer.moduleIds,
        roomPlayer.storedProfile
      );

      let humanPlayer: Player = {
        id: roomPlayer.playerId,
        name: roomPlayer.name,
        isBot: false,
        isRival: false,
        playerType: 'human',
        connectionId: roomPlayer.sessionId,
        userId: roomPlayer.userId,
        chassisId: validChassisId,
        teamId: roomPlayer.teamId,
        color: PLAYER_COLORS[(roomPlayer.playerId - 1) % PLAYER_COLORS.length],
        position: 0,
        powerUps: [],
        statuses: [],
        tileHistory: [],
        energy: 0,
        overdriveCooldown: 0,
        isConnected: true,
        isReady: true,
      };

      // Apply Chassis effects
      if (validChassisId === ChassisId.Aegis) {
        humanPlayer.powerUps.push('Shield');
      }

      // v5.0: Apply validated skill, loadout, and syndicate effects
      humanPlayer = applySkillEffects(humanPlayer, skills);
      humanPlayer = applyLoadoutEffects(humanPlayer, loadout);
      humanPlayer = applySyndicatePerks(humanPlayer, roomPlayer.storedProfile);
      humanPlayer = rollStartingLoadoutPerks(humanPlayer, rng);
      players.push(humanPlayer);
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
    const rivalBot = potentialRivals.length > 0 ? potentialRivals[0] : players.find(p => p.isBot);

    if (rivalBot) {
      rivalBot.isRival = true;
      rivalBot.personality = BotPersonality.Rival;
      rivalBot.name = `Rival ${rivalBot.name}`;

      const chassisIds = Object.values(ChassisId).filter(id => CHASSIS_DEFINITIONS[id].cost > 0);
      const randomChassisId = chassisIds[rng.nextInt(0, chassisIds.length)];
      rivalBot.chassisId = randomChassisId;
      if (randomChassisId === ChassisId.Aegis) rivalBot.powerUps.push('Shield');

      const hostProfile = this.roomState.players.get(this.roomState.hostSessionId)?.storedProfile;
      if (hostProfile?.rivalData?.traits && hostProfile.rivalData.traits.length > 0) {
        const rivalIdx = players.findIndex(p => p === rivalBot);
        if (rivalIdx >= 0) {
          players[rivalIdx] = applyRivalTraitsToPlayer(rivalBot, hostProfile.rivalData.traits, rng);
        }
      }
    }

    if (settings.teamMode) {
      players = assignTeams(players);
    }

    if (seasonalModifier) {
      players = players.map(p => applySeasonalModifierToPlayer(p, seasonalModifier));
    }

    // Generate run
    let run = (settings.customEventIds && settings.customEventIds.length > 0)
      ? generateCustomRun(settings.seed, settings.runLength, EVENT_DESCRIPTORS, settings.customEventIds)
      : generateRun(settings.seed, settings.runLength, EVENT_DESCRIPTORS);

    // Anomaly chance: base 15%, boosted by seasonal modifier if active
    let activeAnomaly = null;
    const anomalyChance = Math.max(0.15, getSeasonalAnomalyChance(settings.activeSeasonId));
    if (rng.nextFloat() < anomalyChance) {
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

    const matchId = `${settings.seed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      matchId,
      isRanked: this.isRankedMatch,
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
    // Canonical per-event duration (with accessibility and Time Dilation support)
    const canonicalSec = getCanonicalEventDurationSec(
      tile.eventId,
      tile.difficulty,
      gs.settings.accessibility,
      gs.activeAnomaly?.id
    );
    this.roomState.tileDurationMs = Math.round(canonicalSec * 1000);
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

    // Authoritative server-side Cosmic Storm surges
    if (this.stormInterval) {
      this.stormInterval.clear();
      this.stormInterval = null;
    }
    if (gs.activeAnomaly?.id === 'COSMIC_STORM') {
      const stormRng = new SeededRNG(`storm-${gs.settings.seed}-${gs.currentTileIndex}`);
      this.stormInterval = this.clock.setTimeout(() => {
        if (this.roomState.phase !== 'playing' || !this.roomState.gameState) return;
        if (stormRng.nextFloat() < 0.35 && this.roomState.gameState.players.length > 0) {
          const targetIdx = stormRng.nextInt(0, this.roomState.gameState.players.length);
          const randomPlayer = this.roomState.gameState.players[targetIdx];
          if (randomPlayer && !this.roomState.gameState.overdrivingPlayerIds.includes(randomPlayer.id)) {
            const { newState } = GameRules.activateOverdrive(this.roomState.gameState, randomPlayer.id, true);
            this.roomState.gameState = newState;
            this.broadcastGameState();
          }
        }
      }, 2500);
    }

    // Simulate bot power-up and overdrive decisions (mirroring client EventRunner logic)
    if (this.roomState.gameState) {
      const expectedTileIdx = gs.currentTileIndex;
      const expectedMatchId = gs.matchId;
      const botRng = new SeededRNG(`bot-delay-${gs.settings.seed}-${expectedTileIdx}`);
      this.clock.setTimeout(() => {
        if (
          !this.roomState.gameState ||
          this.roomState.phase !== 'playing' ||
          this.roomState.gameState.currentTileIndex !== expectedTileIdx ||
          this.roomState.gameState.matchId !== expectedMatchId
        ) {
          return;
        }
        const hostTraits = this.roomState.players.get(this.roomState.hostSessionId)?.storedProfile?.rivalData?.traits;
        for (const player of this.roomState.gameState.players) {
          if (!player.isBot) continue;

          if (decideBotOverdrive(player, this.roomState.gameState)) {
            const { newState } = GameRules.activateOverdrive(this.roomState.gameState, player.id);
            this.roomState.gameState = newState;
          }

          const powerUpDecision = decideBotPowerUp(
            player,
            this.roomState.gameState,
            tile,
            player.isRival ? hostTraits : undefined
          );
          if (powerUpDecision) {
            const { newState } = GameRules.applyPowerUp(
              this.roomState.gameState, player.id, powerUpDecision.use,
              powerUpDecision.targetId, EVENT_DESCRIPTORS
            );
            this.roomState.gameState = newState;
          }
        }
        this.broadcastGameState();
      }, botRng.nextInt(500, 2500));
    }

    // Set timeout for missing submissions based on canonical tile duration + 10s grace buffer
    if (this.resultTimeout) this.resultTimeout.clear();
    const timeoutMs = Math.max(EVENT_RESULT_TIMEOUT_MS, this.roomState.tileDurationMs + 10_000);
    this.resultTimeout = this.clock.setTimeout(() => {
      this.handleResultTimeout();
    }, timeoutMs);
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
      this.roomState.phase = 'intervention';
      const rival = gs.players.find(p => p.isRival);
      const standardTile = gs.run[gs.currentTileIndex];
      this.broadcast(ServerMessages.INTERVENTION, {
        rivalName: rival?.name ?? 'Rival',
        standardTile,
        hazardTile: gs.activeIntervention.hazardTile,
        cpBonus: gs.activeIntervention.cpBonus,
        interventionType: gs.activeIntervention.type,
        sabotageStatus: gs.activeIntervention.sabotageStatus as 'BLURRED' | 'SLOWED' | undefined,
      });
      if (this.interventionTimeout) this.interventionTimeout.clear();
      this.interventionTimeout = this.clock.setTimeout(() => {
        if (this.roomState.phase === 'intervention' && this.roomState.gameState?.activeIntervention) {
          const { newState } = GameRules.resolveIntervention(this.roomState.gameState, false);
          this.roomState.gameState = newState;
          this.broadcastGameState();
          this.advanceAfterIntervention();
        }
      }, 20_000);
      return;
    }

    this.advanceAfterIntervention();
  }

  private advanceAfterIntervention() {
    if (!this.roomState.gameState) return;
    const gs = this.roomState.gameState;

    // Check for pit stop
    const tilesPerStage = PIT_STOP_CONFIG.tilesPerStage;
    if (gs.currentTileIndex > 0 && gs.currentTileIndex % tilesPerStage === 0) {
      this.roomState.phase = 'pit_stop';
      this.roomState.pendingPitStops.clear();
      this.broadcast(ServerMessages.PIT_STOP, {});
      if (this.pitStopTimeout) this.pitStopTimeout.clear();
      this.pitStopTimeout = this.clock.setTimeout(() => {
        if (this.roomState.phase === 'pit_stop' && this.roomState.gameState) {
          const humanPlayers = this.roomState.gameState.players.filter(
            p => !p.isBot && p.isConnected !== false
          );
          for (const hp of humanPlayers) {
            if (!this.roomState.pendingPitStops.has(hp.id)) {
              const { newState } = GameRules.processPitStop(this.roomState.gameState, hp.id, 'recharge');
              this.roomState.gameState = newState;
              this.roomState.pendingPitStops.add(hp.id);
            }
          }
          this.roomState.pendingPitStops.clear();
          this.broadcastGameState();
          this.advanceToNextTile();
        }
      }, 20_000);
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

    // If this was a tournament child match, report the authoritative winner to the parent TournamentRoom
    if (this.tournamentRoomId && this.tournamentMatchId && sortedPlayers.length > 0) {
      const winningPlayer = sortedPlayers.find(p => !p.isBot) ?? sortedPlayers[0];
      const winningRoomPlayer = winningPlayer
        ? Array.from(this.roomState.players.values()).find(rp => rp.playerId === winningPlayer.id)
        : undefined;
      matchMaker.remoteRoomCall(
        this.tournamentRoomId,
        'onChildMatchFinished',
        [{
          matchId: this.tournamentMatchId,
          winnerSessionId: winningRoomPlayer?.sessionId ?? winningPlayer?.connectionId,
          winnerUserId: winningRoomPlayer?.userId ?? winningPlayer?.userId,
          winnerName: winningPlayer?.name,
        }]
      ).catch((err) => {
        console.error(`[Room ${this.roomState.roomCode}] Failed to report tournament outcome:`, err);
      });
    }

    // ── Async per-player summary pipeline (extracted to matchSummaryPipeline) ──
    const eventDimensionMap = this.getEventDimensionMap();
    const gs = this.roomState.gameState; // capture snapshot

    const roomPlayers: RoomPlayerInfo[] = [...this.roomState.players.entries()].map(
      ([sessionId, rp]) => ({
        sessionId,
        playerId: rp.playerId,
        userId: rp.userId ?? null,
        rating: rp.rating,
      })
    );

    runMatchSummaryPipeline({
      gameState: gs,
      roomPlayers,
      sortedPlayers,
      eventDimensionMap,
      roomCode: this.roomState.roomCode,
      isRanked: Boolean(this.isRankedMatch),
      matchId: gs.matchId,
      findClient: (sessionId: string) => this.clients.find(c => c.sessionId === sessionId),
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

    // Reassign host if the abandoned player was host and players remain
    if (player.isHost && this.roomState.players.size > 0) {
      const newHost = this.roomState.players.values().next().value;
      if (newHost) {
        newHost.isHost = true;
        this.roomState.hostSessionId = newHost.sessionId;
      }
    }

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

    // If a disconnected player hasn't submitted pit stop action during pit_stop phase, auto-advance
    if (this.roomState.phase === 'pit_stop') {
      if (!this.roomState.pendingPitStops.has(player.playerId)) {
        this.roomState.pendingPitStops.add(player.playerId);
        const humanPlayers = this.roomState.gameState?.players.filter(
          p => !p.isBot && p.isConnected !== false
        ) ?? [];
        const allSubmitted = humanPlayers.every(p => this.roomState.pendingPitStops.has(p.id));
        if (allSubmitted && this.roomState.pendingPitStops.size > 0) {
          if (this.pitStopTimeout) {
            this.pitStopTimeout.clear();
            this.pitStopTimeout = null;
          }
          this.roomState.pendingPitStops.clear();
          this.advanceToNextTile();
        }
      }
    }

    // If host abandons during intervention, auto-reject it
    if (this.roomState.phase === 'intervention' && player.isHost && this.roomState.gameState?.activeIntervention) {
      if (this.interventionTimeout) {
        this.interventionTimeout.clear();
        this.interventionTimeout = null;
      }
      const { newState } = GameRules.resolveIntervention(this.roomState.gameState, false);
      this.roomState.gameState = newState;
      this.broadcastGameState();
      this.advanceAfterIntervention();
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
        interventionType: gs.activeIntervention.type,
        sabotageStatus: gs.activeIntervention.sabotageStatus as 'BLURRED' | 'SLOWED' | undefined,
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

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
} from '../../../shared/types';
import {
  PLAYER_COLORS, BOT_NAMES, CHASSIS_DEFINITIONS, ANOMALY_DEFINITIONS,
  GAUNTLET_CONFIG, MAX_ROOM_PLAYERS, EVENT_RESULT_TIMEOUT_MS,
  RECONNECT_GRACE_PERIOD_MS, ROOM_CODE_LENGTH,
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
} from '../../../shared/protocol';
import { EVENT_DESCRIPTORS, STAR_COMPUTERS } from '../eventDescriptors';
import { ServerEventValidator } from '../validation/eventValidator';
import { computeMatchSummary, applyMatchSummaryToProfile } from '../../../shared/matchSummary';
import { generateContracts } from '../../../shared/contractService';
import { getProfile, saveProfile } from '../services/profileRepository';

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
  };

  private resultTimeout: Delayed | null = null;
  private nextPlayerId = 1;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  onCreate(_options: Record<string, unknown>) {
    this.roomState.roomCode = generateRoomCode();
    this.roomState.settings.seed = String(Math.floor(Math.random() * 1000000));

    // Set max clients
    this.maxClients = MAX_ROOM_PLAYERS;

    // Allow reconnection
    this.autoDispose = false;

    // Expose room code in metadata so clients can discover via getAvailableRooms
    this.setMetadata({ roomCode: this.roomState.roomCode });

    console.log(`[Room ${this.roomState.roomCode}] Created`);

    // ─── Register message handlers ─────────────────────────────────────
    this.onMessage(ClientMessages.READY, (client, payload: ReadyPayload) => {
      this.handleReady(client, payload);
    });

    this.onMessage(ClientMessages.START, (client) => {
      this.handleStart(client);
    });

    this.onMessage(ClientMessages.UPDATE_SETTINGS, (client, payload: UpdateSettingsPayload) => {
      this.handleUpdateSettings(client, payload);
    });

    this.onMessage(ClientMessages.SUBMIT_EVENT_RESULT, (client, payload: EventTelemetry) => {
      this.handleSubmitEventResult(client, payload);
    });

    this.onMessage(ClientMessages.USE_POWER_UP, (client, payload: UsePowerUpPayload) => {
      this.handleUsePowerUp(client, payload);
    });

    this.onMessage(ClientMessages.ACTIVATE_OVERDRIVE, (client, payload: ActivateOverdrivePayload) => {
      this.handleActivateOverdrive(client, payload);
    });

    this.onMessage(ClientMessages.INTERVENTION_CHOICE, (client, payload: InterventionChoicePayload) => {
      this.handleInterventionChoice(client, payload);
    });

    this.onMessage(ClientMessages.PIT_STOP_ACTION, (client, payload: PitStopActionPayload) => {
      this.handlePitStopAction(client, payload);
    });

    this.onMessage(ClientMessages.REQUEST_REMATCH, (client) => {
      this.handleRematch(client);
    });
  }

  onJoin(client: Client, options: RoomConfig) {
    // Reject joins during an active match (non-lobby phase)
    if (this.roomState.phase !== 'lobby') {
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
      userId: options.userId,
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
  }

  async onLeave(client: Client, consented: boolean) {
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
        try {
          // Wait for reconnection
          await this.allowReconnection(client, RECONNECT_GRACE_PERIOD_MS / 1000);

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
      } else {
        this.handlePlayerAbandoned(client.sessionId);
      }
    }

    // Auto-dispose if empty
    if (this.roomState.players.size === 0) {
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

    this.roomState.settings = { ...this.roomState.settings, ...payload.settings };
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
    const baseDuration = 15000; // Default 15 seconds, actual varies per event
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
    const eventDimensionMap: Record<string, string> = {};
    EVENT_DESCRIPTORS.forEach(e => { eventDimensionMap[e.id] = e.performanceDimension; });
    const gs = this.roomState.gameState; // capture snapshot
    const roomCode = this.roomState.roomCode;

    const summaryTasks = [...this.roomState.players.entries()]
      .filter(([, rp]) => !!rp.userId)
      .map(async ([sessionId, roomPlayer]) => {
        const gamePlayer = gs.players.find(p => p.id === roomPlayer.playerId);
        if (!gamePlayer || gamePlayer.isBot) return;

        const profile = await getProfile(roomPlayer.userId!);
        if (!profile) {
          console.log(`[Room ${roomCode}] No profile for ${roomPlayer.userId} — skipping summary.`);
          return;
        }

        const currentDailyBest = profile.dailyBests?.[dailySeed] ?? null;
        const summary = computeMatchSummary({
          gameState: gs,
          profile,
          mode: 'online',
          contracts,
          eventDimensionMap,
          dailySeed,
          currentDailyBest,
          targetPlayerId: roomPlayer.playerId,
        });

        const updatedProfile = applyMatchSummaryToProfile(profile, summary);
        if (!updatedProfile) {
          console.log(`[Room ${roomCode}] Match ${summary.matchId} already applied for ${roomPlayer.userId}.`);
          return;
        }

        await saveProfile(roomPlayer.userId!, updatedProfile);

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
    }));

    this.broadcast('room:state', {
      roomCode: this.roomState.roomCode,
      phase: this.roomState.phase,
      hostSessionId: this.roomState.hostSessionId,
      players: lobbyPlayers,
      settings: this.roomState.settings,
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

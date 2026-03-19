"use strict";
/**
 * server/src/rooms/ConfluxRoom.ts
 *
 * Authoritative Colyseus room for Conflux Circuit multiplayer matches.
 * Manages: lobby roster, ready state, match lifecycle, tile progression,
 * event result validation, scoring, and reconnection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluxRoom = void 0;
const colyseus_1 = require("colyseus");
const types_1 = require("../../../shared/types");
const constants_1 = require("../../../shared/constants");
const seededRNG_1 = require("../../../shared/seededRNG");
const pathGenerator_1 = require("../../../shared/pathGenerator");
const gameRules_1 = require("../../../shared/gameRules");
const botMind_1 = require("../../../shared/botMind");
const protocol_1 = require("../../../shared/protocol");
const eventDescriptors_1 = require("../eventDescriptors");
const eventValidator_1 = require("../validation/eventValidator");
const matchSummary_1 = require("../../../shared/matchSummary");
const contractService_1 = require("../../../shared/contractService");
const profileRepository_1 = require("../services/profileRepository");
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    let code = '';
    for (let i = 0; i < constants_1.ROOM_CODE_LENGTH; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
const DEFAULT_SETTINGS = {
    playerCount: 4,
    easyBots: 2,
    intermediateBots: 1,
    seed: '',
    runLength: 8,
    sound: true,
    accessibility: false,
    uiEffects: true,
    colorBlindMode: false,
    selectedChassis: types_1.ChassisId.Standard,
};
class ConfluxRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.roomState = {
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
        this.resultTimeout = null;
        this.nextPlayerId = 1;
    }
    // ─── Lifecycle ───────────────────────────────────────────────────────────
    onCreate(_options) {
        this.roomState.roomCode = generateRoomCode();
        this.roomState.settings.seed = String(Math.floor(Math.random() * 1000000));
        // Set max clients
        this.maxClients = constants_1.MAX_ROOM_PLAYERS;
        // Allow reconnection
        this.autoDispose = false;
        // Expose room code in metadata so clients can discover via getAvailableRooms
        this.setMetadata({ roomCode: this.roomState.roomCode });
        console.log(`[Room ${this.roomState.roomCode}] Created`);
        // ─── Register message handlers ─────────────────────────────────────
        this.onMessage(protocol_1.ClientMessages.READY, (client, payload) => {
            this.handleReady(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.START, (client) => {
            this.handleStart(client);
        });
        this.onMessage(protocol_1.ClientMessages.UPDATE_SETTINGS, (client, payload) => {
            this.handleUpdateSettings(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.SUBMIT_EVENT_RESULT, (client, payload) => {
            this.handleSubmitEventResult(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.USE_POWER_UP, (client, payload) => {
            this.handleUsePowerUp(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.ACTIVATE_OVERDRIVE, (client, payload) => {
            this.handleActivateOverdrive(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.INTERVENTION_CHOICE, (client, payload) => {
            this.handleInterventionChoice(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.PIT_STOP_ACTION, (client, payload) => {
            this.handlePitStopAction(client, payload);
        });
        this.onMessage(protocol_1.ClientMessages.REQUEST_REMATCH, (client) => {
            this.handleRematch(client);
        });
    }
    onJoin(client, options) {
        // Reject joins during an active match (non-lobby phase)
        if (this.roomState.phase !== 'lobby') {
            throw new Error('Match already in progress.');
        }
        const playerId = this.nextPlayerId++;
        // Sanitize inputs
        const rawName = typeof options.playerName === 'string' ? options.playerName.trim() : '';
        const sanitizedName = rawName.slice(0, 20) || `Player ${playerId}`;
        const validChassis = Object.values(types_1.ChassisId).includes(options.chassisId)
            ? options.chassisId
            : types_1.ChassisId.Standard;
        const roomPlayer = {
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
        client.send(protocol_1.ServerMessages.ROOM_CREATED, { roomCode: this.roomState.roomCode });
        // Broadcast updated lobby state
        this.broadcastLobbyState();
    }
    async onLeave(client, consented) {
        const player = this.roomState.players.get(client.sessionId);
        if (!player)
            return;
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
        }
        else {
            // During match, allow reconnection
            console.log(`[Room ${this.roomState.roomCode}] ${player.name} disconnected (consented: ${consented})`);
            this.broadcast(protocol_1.ServerMessages.PLAYER_DISCONNECTED, {
                sessionId: client.sessionId,
                playerName: player.name,
            });
            if (!consented) {
                try {
                    // Wait for reconnection
                    await this.allowReconnection(client, constants_1.RECONNECT_GRACE_PERIOD_MS / 1000);
                    // Reconnected!
                    player.isConnected = true;
                    console.log(`[Room ${this.roomState.roomCode}] ${player.name} reconnected`);
                    this.broadcast(protocol_1.ServerMessages.PLAYER_RECONNECTED, {
                        sessionId: client.sessionId,
                        playerName: player.name,
                    });
                    // Send current game state to reconnected client
                    if (this.roomState.gameState) {
                        this.sendGameStateToClient(client);
                    }
                }
                catch {
                    // Reconnection timed out - mark as abandoned
                    console.log(`[Room ${this.roomState.roomCode}] ${player.name} abandoned (reconnect timeout)`);
                    this.handlePlayerAbandoned(client.sessionId);
                }
            }
            else {
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
    handleReady(client, payload) {
        if (this.roomState.phase !== 'lobby')
            return;
        const player = this.roomState.players.get(client.sessionId);
        if (!player)
            return;
        player.isReady = payload.ready;
        this.broadcastLobbyState();
    }
    handleStart(client) {
        if (this.roomState.phase !== 'lobby')
            return;
        const player = this.roomState.players.get(client.sessionId);
        if (!player?.isHost) {
            client.send(protocol_1.ServerMessages.ROOM_ERROR, { message: 'Only the host can start the match.' });
            return;
        }
        // Check all players are ready
        const allReady = Array.from(this.roomState.players.values()).every(p => p.isReady || p.isHost);
        if (!allReady) {
            client.send(protocol_1.ServerMessages.ROOM_ERROR, { message: 'Not all players are ready.' });
            return;
        }
        this.startMatch();
    }
    handleUpdateSettings(client, payload) {
        if (this.roomState.phase !== 'lobby')
            return;
        const player = this.roomState.players.get(client.sessionId);
        if (!player?.isHost)
            return;
        this.roomState.settings = { ...this.roomState.settings, ...payload.settings };
        this.broadcastLobbyState();
    }
    handleSubmitEventResult(client, payload) {
        if (this.roomState.phase !== 'playing' || !this.roomState.gameState)
            return;
        const roomPlayer = this.roomState.players.get(client.sessionId);
        if (!roomPlayer)
            return;
        const playerId = roomPlayer.playerId;
        // Prevent duplicate submissions
        if (this.roomState.pendingResults.has(playerId))
            return;
        // Validate telemetry
        const validation = eventValidator_1.ServerEventValidator.validate(payload, {
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
        const stars = eventValidator_1.ServerEventValidator.computeStars(payload.eventId, payload.primaryMetric, payload.secondaryMetric);
        const result = {
            playerId,
            stars,
            primaryMetric: payload.primaryMetric,
            secondaryMetric: payload.secondaryMetric,
        };
        this.roomState.pendingResults.set(playerId, result);
        // Check if all human players have submitted
        this.checkAllResultsReceived();
    }
    handleUsePowerUp(client, payload) {
        if (this.roomState.phase !== 'playing' || !this.roomState.gameState)
            return;
        const roomPlayer = this.roomState.players.get(client.sessionId);
        if (!roomPlayer)
            return;
        const { newState } = gameRules_1.GameRules.applyPowerUp(this.roomState.gameState, roomPlayer.playerId, payload.powerUp, payload.targetId, eventDescriptors_1.EVENT_DESCRIPTORS);
        this.roomState.gameState = newState;
        this.broadcastGameState();
    }
    handleActivateOverdrive(client, payload) {
        if (this.roomState.phase !== 'playing' || !this.roomState.gameState)
            return;
        const roomPlayer = this.roomState.players.get(client.sessionId);
        if (!roomPlayer)
            return;
        const { newState } = gameRules_1.GameRules.activateOverdrive(this.roomState.gameState, roomPlayer.playerId, payload.force);
        this.roomState.gameState = newState;
        this.broadcastGameState();
    }
    handleInterventionChoice(client, payload) {
        if (!this.roomState.gameState)
            return;
        if (!this.roomState.gameState.activeIntervention)
            return;
        const roomPlayer = this.roomState.players.get(client.sessionId);
        if (!roomPlayer)
            return;
        // Only host can decide interventions
        if (!roomPlayer.isHost) {
            client.send(protocol_1.ServerMessages.ROOM_ERROR, { message: 'Only the host can decide interventions.' });
            return;
        }
        const { newState } = gameRules_1.GameRules.resolveIntervention(this.roomState.gameState, payload.accept);
        this.roomState.gameState = newState;
        this.broadcastGameState();
        this.advanceToNextTile();
    }
    handlePitStopAction(client, payload) {
        if (!this.roomState.gameState)
            return;
        const roomPlayer = this.roomState.players.get(client.sessionId);
        if (!roomPlayer)
            return;
        // Prevent duplicate submissions
        if (this.roomState.pendingPitStops.has(roomPlayer.playerId))
            return;
        const { newState } = gameRules_1.GameRules.processPitStop(this.roomState.gameState, roomPlayer.playerId, payload.action);
        this.roomState.gameState = newState;
        this.roomState.pendingPitStops.add(roomPlayer.playerId);
        this.broadcastGameState();
        // Check if all connected human players have submitted
        const humanPlayers = this.roomState.gameState.players.filter(p => !p.isBot && p.isConnected !== false);
        const allSubmitted = humanPlayers.every(p => this.roomState.pendingPitStops.has(p.id));
        if (allSubmitted) {
            this.roomState.pendingPitStops.clear();
            this.advanceToNextTile();
        }
    }
    handleRematch(_client) {
        if (this.roomState.phase !== 'finished')
            return;
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
    startMatch() {
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
        this.broadcast(protocol_1.ServerMessages.COUNTDOWN, { tileIndex: 0 });
        // Start first tile after countdown delay
        this.clock.setTimeout(() => {
            this.roomState.phase = 'playing';
            this.startTile();
        }, 3500); // Match the existing countdown duration
    }
    initializeGameState(settings) {
        const rng = new seededRNG_1.SeededRNG(`players-${settings.seed}`);
        const players = [];
        const shuffledBotNames = rng.shuffle([...constants_1.BOT_NAMES]);
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
                color: constants_1.PLAYER_COLORS[(roomPlayer.playerId - 1) % constants_1.PLAYER_COLORS.length],
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
            if (roomPlayer.chassisId === types_1.ChassisId.Aegis) {
                players[players.length - 1].powerUps.push('Shield');
            }
        }
        // Add bots
        const botConfigs = [
            { personality: types_1.BotPersonality.Intermediate, count: settings.intermediateBots },
            { personality: types_1.BotPersonality.Easy, count: settings.easyBots },
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
                    color: constants_1.PLAYER_COLORS[(pid - 1) % constants_1.PLAYER_COLORS.length],
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
        const potentialRivals = players.filter(p => p.isBot && p.personality === types_1.BotPersonality.Intermediate);
        let rivalBot = potentialRivals.length > 0 ? potentialRivals[0] : players.find(p => p.isBot);
        if (rivalBot) {
            rivalBot.isRival = true;
            rivalBot.personality = types_1.BotPersonality.Rival;
            rivalBot.name = `Rival ${rivalBot.name}`;
            const chassisIds = Object.values(types_1.ChassisId).filter(id => constants_1.CHASSIS_DEFINITIONS[id].cost > 0);
            const randomChassisId = chassisIds[rng.nextInt(0, chassisIds.length)];
            rivalBot.chassisId = randomChassisId;
            if (randomChassisId === types_1.ChassisId.Aegis)
                rivalBot.powerUps.push('Shield');
        }
        // Generate run
        let run = (0, pathGenerator_1.generateRun)(settings.seed, settings.runLength, eventDescriptors_1.EVENT_DESCRIPTORS);
        // 15% chance for anomaly
        let activeAnomaly = null;
        if (rng.nextFloat() < 0.15) {
            const anomalyIds = Object.values(types_1.AnomalyId);
            const randomAnomalyId = anomalyIds[rng.nextInt(0, anomalyIds.length)];
            activeAnomaly = { id: randomAnomalyId, ...constants_1.ANOMALY_DEFINITIONS[randomAnomalyId] };
            if (randomAnomalyId === types_1.AnomalyId.ChronosShift) {
                const firstTile = run[0];
                const remainingTiles = run.slice(1);
                run = [firstTile, ...rng.shuffle(remainingTiles)];
            }
            else if (randomAnomalyId === types_1.AnomalyId.VoidCollapse) {
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
    startTile() {
        if (!this.roomState.gameState)
            return;
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
        const tileStart = {
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
        this.broadcast(protocol_1.ServerMessages.TILE_START, tileStart);
        // Simulate bot power-up and overdrive decisions (mirroring client EventRunner logic)
        if (this.roomState.gameState) {
            const gsForBots = this.roomState.gameState;
            this.clock.setTimeout(() => {
                if (!this.roomState.gameState)
                    return;
                for (const player of gsForBots.players) {
                    if (!player.isBot)
                        continue;
                    if ((0, botMind_1.decideBotOverdrive)(player, gsForBots)) {
                        const { newState } = gameRules_1.GameRules.activateOverdrive(gsForBots, player.id);
                        this.roomState.gameState = newState;
                    }
                    const powerUpDecision = (0, botMind_1.decideBotPowerUp)(player, gsForBots, tile);
                    if (powerUpDecision) {
                        const { newState } = gameRules_1.GameRules.applyPowerUp(this.roomState.gameState, player.id, powerUpDecision.use, powerUpDecision.targetId, eventDescriptors_1.EVENT_DESCRIPTORS);
                        this.roomState.gameState = newState;
                    }
                }
                this.broadcastGameState();
            }, Math.floor(Math.random() * 2000) + 500);
        }
        // Set timeout for missing submissions
        if (this.resultTimeout)
            this.resultTimeout.clear();
        this.resultTimeout = this.clock.setTimeout(() => {
            this.handleResultTimeout();
        }, constants_1.EVENT_RESULT_TIMEOUT_MS);
    }
    checkAllResultsReceived() {
        if (!this.roomState.gameState)
            return;
        const humanPlayers = this.roomState.gameState.players.filter(p => !p.isBot && p.isConnected !== false);
        const allReceived = humanPlayers.every(p => this.roomState.pendingResults.has(p.id));
        if (allReceived) {
            if (this.resultTimeout)
                this.resultTimeout.clear();
            this.processTileResults();
        }
    }
    handleResultTimeout() {
        if (!this.roomState.gameState)
            return;
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
    processTileResults() {
        if (!this.roomState.gameState)
            return;
        // Simulate bot performance
        const gs = this.roomState.gameState;
        const currentTile = gs.run[gs.currentTileIndex];
        // Build BotEventInfo from server-side descriptors + star computers
        const eventDesc = eventDescriptors_1.EVENT_DESCRIPTORS.find(e => e.id === currentTile.eventId);
        const starComputer = eventDescriptors_1.STAR_COMPUTERS[currentTile.eventId];
        const botEventInfo = eventDesc && starComputer ? {
            id: eventDesc.id,
            performanceDimension: eventDesc.performanceDimension,
            isStub: eventDesc.isStub,
            getStars: (result) => starComputer(result.primaryMetric, result.secondaryMetric),
        } : null;
        for (const player of gs.players) {
            if (player.isBot && !this.roomState.pendingResults.has(player.id)) {
                let botResult;
                if (botEventInfo) {
                    // Full bot simulation using shared botMind
                    // rivalTraits come from PilotProfile (Phase 3: Firebase); not available on server yet
                    const result = (0, botMind_1.simulateBotPerformance)(player, botEventInfo, currentTile.difficulty, gs.settings);
                    botResult = { stars: result.stars, primaryMetric: result.primaryMetric, secondaryMetric: result.secondaryMetric };
                }
                else {
                    // Fallback: simplified star-probability roll for unknown events
                    const botRng = new seededRNG_1.SeededRNG(`bot-${player.id}-tile-${currentTile.eventId}-${gs.settings.seed}`);
                    const starRoll = botRng.nextFloat();
                    const stars = starRoll < 0.25 ? 3 : starRoll < 0.70 ? 2 : 1;
                    botResult = { stars, primaryMetric: 0 };
                }
                this.roomState.pendingResults.set(player.id, {
                    playerId: player.id,
                    stars: botResult.stars,
                    primaryMetric: botResult.primaryMetric,
                });
            }
        }
        // Build results map
        const results = {};
        for (const [pid, result] of this.roomState.pendingResults) {
            results[pid] = result;
        }
        // Process through shared game rules
        const { newState } = gameRules_1.GameRules.processRaceStep(gs, results, eventDescriptors_1.EVENT_DESCRIPTORS);
        this.roomState.gameState = newState;
        // Broadcast results
        const tileResults = {
            results,
            gameState: newState,
        };
        this.roomState.phase = 'tile_results';
        this.broadcast(protocol_1.ServerMessages.TILE_RESULTS, tileResults);
        // Auto-advance after delay
        this.clock.setTimeout(() => {
            this.advanceAfterResults();
        }, 3000);
    }
    advanceAfterResults() {
        if (!this.roomState.gameState)
            return;
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
            this.broadcast(protocol_1.ServerMessages.INTERVENTION, {
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
            this.broadcast(protocol_1.ServerMessages.PIT_STOP, {});
            return;
        }
        this.advanceToNextTile();
    }
    advanceToNextTile() {
        this.roomState.phase = 'playing';
        this.broadcast(protocol_1.ServerMessages.COUNTDOWN, {
            tileIndex: this.roomState.gameState?.currentTileIndex ?? 0,
        });
        this.clock.setTimeout(() => {
            this.startTile();
        }, 3500);
    }
    async finishRace() {
        if (!this.roomState.gameState)
            return;
        this.roomState.phase = 'finished';
        const sortedPlayers = [...this.roomState.gameState.players].sort((a, b) => b.position - a.position);
        const finalStandings = sortedPlayers.map((p, idx) => ({
            playerId: p.id,
            name: p.name,
            position: p.position,
            totalStars: p.tileHistory.reduce((sum, h) => sum + h.stars, 0),
            placement: idx + 1,
        }));
        // Broadcast race finished immediately — clients see standings without waiting for Firebase
        const payload = {
            finalStandings,
            gameState: this.roomState.gameState,
        };
        this.broadcast(protocol_1.ServerMessages.RACE_FINISHED, payload);
        this.unlock(); // Allow new joins for rematch
        // ── Async per-player summary pipeline (parallel, non-blocking) ──────────
        const dailySeed = new Date().toISOString().split('T')[0];
        const contracts = (0, contractService_1.generateContracts)(this.roomState.gameState.settings.seed);
        const eventDimensionMap = {};
        eventDescriptors_1.EVENT_DESCRIPTORS.forEach(e => { eventDimensionMap[e.id] = e.performanceDimension; });
        const gs = this.roomState.gameState; // capture snapshot
        const roomCode = this.roomState.roomCode;
        const summaryTasks = [...this.roomState.players.entries()]
            .filter(([, rp]) => !!rp.userId)
            .map(async ([sessionId, roomPlayer]) => {
            const gamePlayer = gs.players.find(p => p.id === roomPlayer.playerId);
            if (!gamePlayer || gamePlayer.isBot)
                return;
            const profile = await (0, profileRepository_1.getProfile)(roomPlayer.userId);
            if (!profile) {
                console.log(`[Room ${roomCode}] No profile for ${roomPlayer.userId} — skipping summary.`);
                return;
            }
            const currentDailyBest = profile.dailyBests?.[dailySeed] ?? null;
            const summary = (0, matchSummary_1.computeMatchSummary)({
                gameState: gs,
                profile,
                mode: 'online',
                contracts,
                eventDimensionMap,
                dailySeed,
                currentDailyBest,
                targetPlayerId: roomPlayer.playerId,
            });
            const updatedProfile = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
            if (!updatedProfile) {
                console.log(`[Room ${roomCode}] Match ${summary.matchId} already applied for ${roomPlayer.userId}.`);
                return;
            }
            await (0, profileRepository_1.saveProfile)(roomPlayer.userId, updatedProfile);
            const client = this.clients.find(c => c.sessionId === sessionId);
            if (client) {
                client.send(protocol_1.ServerMessages.MATCH_SUMMARY, { summary });
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
    handlePlayerAbandoned(sessionId) {
        const player = this.roomState.players.get(sessionId);
        if (!player)
            return;
        // Mark player as disconnected in game state
        if (this.roomState.gameState) {
            const gamePlayer = this.roomState.gameState.players.find(p => p.connectionId === sessionId);
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
                const humanPlayers = this.roomState.gameState?.players.filter(p => !p.isBot && p.isConnected !== false) ?? [];
                const allSubmitted = humanPlayers.every(p => this.roomState.pendingPitStops.has(p.id));
                if (allSubmitted && this.roomState.pendingPitStops.size > 0) {
                    this.roomState.pendingPitStops.clear();
                    this.advanceToNextTile();
                }
            }
        }
        // If host abandons during intervention, auto-reject it
        if (this.roomState.phase === 'tile_results' && player.isHost && this.roomState.gameState?.activeIntervention) {
            const { newState } = gameRules_1.GameRules.resolveIntervention(this.roomState.gameState, false);
            this.roomState.gameState = newState;
            this.broadcastGameState();
            this.advanceToNextTile();
        }
    }
    broadcastLobbyState() {
        const lobbyPlayers = Array.from(this.roomState.players.values()).map(p => ({
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
    broadcastGameState() {
        if (this.roomState.gameState) {
            this.broadcast('game:state', {
                gameState: this.roomState.gameState,
                phase: this.roomState.phase,
            });
        }
    }
    sendGameStateToClient(client) {
        if (!this.roomState.gameState)
            return;
        client.send('game:state', {
            gameState: this.roomState.gameState,
            phase: this.roomState.phase,
        });
        // Re-send phase-specific messages so the reconnecting client renders correctly
        const gs = this.roomState.gameState;
        if (gs.activeIntervention && this.roomState.phase === 'tile_results') {
            const rival = gs.players.find(p => p.isRival);
            const standardTile = gs.run[gs.currentTileIndex];
            client.send(protocol_1.ServerMessages.INTERVENTION, {
                rivalName: rival?.name ?? 'Rival',
                standardTile,
                hazardTile: gs.activeIntervention.hazardTile,
                cpBonus: gs.activeIntervention.cpBonus,
            });
        }
        else if (this.roomState.phase === 'tile_results' &&
            gs.currentTileIndex > 0 &&
            gs.currentTileIndex % 4 === 0 &&
            this.roomState.pendingPitStops.size > 0) {
            // Still awaiting pit stop actions
            client.send(protocol_1.ServerMessages.PIT_STOP, {});
        }
    }
}
exports.ConfluxRoom = ConfluxRoom;
//# sourceMappingURL=ConfluxRoom.js.map
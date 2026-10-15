import { describe, it, expect, vi } from 'vitest';
import { ConfluxRoom } from '../rooms/ConfluxRoom';
import { TournamentRoom } from '../rooms/TournamentRoom';
import { ClientMessages, ServerMessages } from '../../../shared/protocol';
import { ChassisId, CorporationId, PilotProfile, GameState } from '../../../shared/types';
import { generateRun } from '../../../shared/pathGenerator';
import { GameRules } from '../../../shared/gameRules';
import { computeMultiPlayerRatingChanges } from '../../../shared/rankSystem';
import { EVENT_DESCRIPTORS } from '../eventDescriptors';
import { getLeaderboardDocPath, getLeaderboardCollectionSegments } from '../services/leaderboardRepository';
import * as leaderboardRepo from '../services/leaderboardRepository';
import * as matchHistoryRepo from '../services/matchHistoryRepository';
import * as tournamentRepo from '../services/tournamentRepository';
import { verifyAuthToken } from '../auth/verifyToken';
import * as profileRepo from '../services/profileRepository';
import { runMatchSummaryPipeline } from '../services/matchSummaryPipeline';

function createMockClient(sessionId: string) {
  const sentMessages: Array<{ type: string; data: unknown }> = [];
  return {
    sessionId,
    sentMessages,
    send: vi.fn((type: string, data?: unknown) => {
      sentMessages.push({ type, data });
    }),
  };
}

function createTestRoom() {
  const room = Object.create(ConfluxRoom.prototype) as ConfluxRoom;
  (room as any).roomState = {
    roomCode: 'TEST',
    phase: 'lobby',
    hostSessionId: '',
    players: new Map(),
    settings: {
      playerCount: 2,
      easyBots: 1,
      intermediateBots: 0,
      seed: 'audit-seed',
      runLength: 8,
      sound: true,
      accessibility: false,
      uiEffects: true,
      colorBlindMode: false,
      selectedChassis: ChassisId.Standard,
    },
    gameState: null,
    pendingResults: new Map(),
    pendingPitStops: new Set(),
    tileStartTimestamp: Date.now() - 2000,
    tileDurationMs: 15000,
    isPrivate: false,
    bannedUserIds: new Set(),
    bannedSessionIds: new Set(),
  };
  (room as any).resultTimeout = null;
  (room as any).pitStopTimeout = null;
  (room as any).interventionTimeout = null;
  (room as any).stormInterval = null;
  (room as any).nextPlayerId = 1;
  (room as any).eventDimensionMap = {};
  (room as any).spectatorIds = new Set();
  (room as any).rateLimiter = { isAllowed: () => true, removeClient: () => {} };
  (room as any).broadcast = vi.fn();
  (room as any).clients = [];
  (room as any).maxClients = 6;
  Object.defineProperty(room, 'autoDispose', { value: false, writable: true, configurable: true });
  (room as any).clock = {
    setTimeout: vi.fn(() => ({ clear: vi.fn() })),
  };
  (room as any).lock = vi.fn();
  (room as any).unlock = vi.fn();
  (room as any).disconnect = vi.fn();
  (room as any).setMetadata = vi.fn();
  (room as any)._messageHandlers = new Map();
  (room as any).onMessage = vi.fn((type: string, handler: unknown) => {
    (room as any)._messageHandlers.set(type, handler);
  });

  room.onCreate({});
  return room as any;
}

describe('Audit Remediation — All 11 Diagnostic Probes & §6 Progression Contract', () => {
  it('Probe 1 (B01): Rejected event ID / tile mismatch is NOT scored as 3★; records 0★ and warns client', () => {
    const room = createTestRoom();
    const client = createMockClient('s1');
    room.onJoin(client, { playerName: 'Alice', avatarId: '🚀', chassisId: ChassisId.Standard });
    room.roomState.phase = 'playing';
    room.roomState.gameState = (room as any).initializeGameState(room.roomState.settings);
    room.roomState.gameState.run[0] = {
      tileIndex: 1,
      eventId: 'reaction-tap',
      difficulty: 1,
      subSeed: '0.1',
    };
    room.roomState.tileStartTimestamp = Date.now() - 2000;
    room.roomState.tileDurationMs = 8000;

    const submitHandler = room._messageHandlers.get(ClientMessages.SUBMIT_EVENT_RESULT);
    // Submit tile 999 and slider-precision's 0-error metric during reaction-tap
    submitHandler(client, {
      tileIndex: 999,
      eventId: 'slider-precision',
      seed: 'audit-seed',
      primaryMetric: 0,
      completionTimestamp: Date.now(),
    });

    const recorded = room.roomState.gameState.lastTileResults?.[1] ?? room.roomState.pendingResults.get(1);
    expect(recorded?.stars).toBe(0);
    expect(client.sentMessages.some(m => m.type === ServerMessages.ROOM_ERROR)).toBe(true);
  });

  it('Probe 2 (B02): Client force flag in ACTIVATE_OVERDRIVE cannot grant free overdrive at 0 energy', () => {
    const room = createTestRoom();
    const client = createMockClient('s1');
    room.onJoin(client, { playerName: 'Alice', avatarId: '🚀', chassisId: ChassisId.Standard });
    room.roomState.phase = 'playing';
    room.roomState.gameState = (room as any).initializeGameState(room.roomState.settings);
    room.roomState.gameState.players[0].energy = 0;

    const odHandler = room._messageHandlers.get(ClientMessages.ACTIVATE_OVERDRIVE);
    odHandler(client, { force: true });

    expect(room.roomState.gameState.overdrivingPlayerIds).not.toContain(1);
    expect(room.roomState.gameState.players[0].energy).toBe(0);
  });

  it('Probe 3 (B02): Pit-stop recharge is rejected during active play and does not advance tile or grant energy', () => {
    const room = createTestRoom();
    const client = createMockClient('s1');
    room.onJoin(client, { playerName: 'Alice', avatarId: '🚀', chassisId: ChassisId.Standard });
    room.roomState.phase = 'playing';
    room.roomState.gameState = (room as any).initializeGameState(room.roomState.settings);
    const initialTile = room.roomState.gameState.currentTileIndex;
    const initialEnergy = room.roomState.gameState.players[0].energy;

    const pitHandler = room._messageHandlers.get(ClientMessages.PIT_STOP_ACTION);
    pitHandler(client, { action: 'recharge' });

    expect(room.roomState.gameState.currentTileIndex).toBe(initialTile);
    expect(room.roomState.gameState.players[0].energy).toBe(initialEnergy);
    expect(client.sentMessages.some(m => m.type === ServerMessages.ROOM_ERROR)).toBe(true);
  });

  it('Probe 4 (B02): Malformed pit-stop action is rejected without throwing TypeError', () => {
    const room = createTestRoom();
    const client = createMockClient('s1');
    room.onJoin(client, { playerName: 'Alice', avatarId: '🚀', chassisId: ChassisId.Standard });
    room.roomState.phase = 'pit_stop';
    room.roomState.gameState = (room as any).initializeGameState(room.roomState.settings);

    const pitHandler = room._messageHandlers.get(ClientMessages.PIT_STOP_ACTION);
    expect(() => pitHandler(client, { action: 'nonexistent_action' })).not.toThrow();
    expect(() => pitHandler(client, null)).not.toThrow();
    expect(client.sentMessages.some(m => m.type === ServerMessages.ROOM_ERROR)).toBe(true);
  });

  it('Probe 5 (B03): Three-tile run generation terminates immediately with valid tiles', () => {
    const start = performance.now();
    const run = generateRun('three-tile-seed', 3, EVENT_DESCRIPTORS);
    const elapsedMs = performance.now() - start;

    expect(run).toHaveLength(3);
    expect(elapsedMs).toBeLessThan(100);
  });

  it('Probe 6 (B11): Single tournament victory report does NOT complete match on next tick', () => {
    const saveSpy = vi.spyOn(tournamentRepo, 'saveTournamentBracket').mockResolvedValue();
    const tRoom = Object.create(TournamentRoom.prototype) as TournamentRoom;
    Object.defineProperty(tRoom, 'roomId', { value: 'tourney-1', writable: true, configurable: true });
    (tRoom as any).participants = new Map();
    (tRoom as any).pendingMatches = new Map();
    (tRoom as any).pendingResultReports = new Map();
    (tRoom as any).firstReportTimestamps = new Map();
    (tRoom as any).broadcast = vi.fn();
    (tRoom as any).onMessage = vi.fn((type: string, handler: unknown) => {
      if (!(tRoom as any)._handlers) (tRoom as any)._handlers = new Map();
      (tRoom as any)._handlers.set(type, handler);
    });
    tRoom.onCreate({ size: 4 });
    if (tRoom.tickInterval) clearInterval(tRoom.tickInterval);

    tRoom.bracket = {
      id: 'tourney-1',
      name: 'Test',
      size: 4,
      currentRound: 0,
      participants: [
        { id: 'a', name: 'A', avatarId: '🚀', seedRank: 1, eliminated: false },
        { id: 'b', name: 'B', avatarId: '🚀', seedRank: 2, eliminated: false },
      ],
      rounds: [
        {
          roundNumber: 1,
          isComplete: false,
          matches: [
            { matchId: 'm1', participants: ['a', 'b'], roomCode: 'room', isComplete: false },
          ],
        },
      ],
    };

    const reportHandler = (tRoom as any)._handlers.get(ClientMessages.REPORT_TOURNAMENT_RESULT);
    reportHandler({ sessionId: 'a' }, { matchId: 'm1', won: true });

    // Trigger next tick immediately (before 30s timeout)
    (tRoom as any).processRound();

    const match = tRoom.bracket.rounds[0].matches[0];
    expect(match.isComplete).toBe(false);
    expect(match.winner).toBeUndefined();
    saveSpy.mockRestore();
  });

  it('Probe 7 (B06 & §6): Post-transaction summary equals persisted summary with zero recomputation divergence', async () => {
    const initialProfile: PilotProfile = {
      name: 'Alice',
      avatarId: '🚀',
      circuitPoints: 100,
      winStreak: 0,
      unlockedChassis: [ChassisId.Standard],
      unlockedAccolades: [],
      rivalData: { name: 'Rival', avatarId: '👾', favoredChassis: ChassisId.Aegis, wins: 0, losses: 0, traits: [] },
      gauntletHighScore: 0,
      sponsorships: {
        [CorporationId.Cyberex]: { reputation: 0, activeContract: null },
        [CorporationId.Zenith]: { reputation: 0, activeContract: null },
        [CorporationId.Rogue]: { reputation: 0, activeContract: null },
      },
      appliedMatchIds: [],
      dailyBests: {},
      eventMastery: {},
    };

    let storedProfile: PilotProfile = JSON.parse(JSON.stringify(initialProfile));
    const txSpy = vi.spyOn(profileRepo, 'updateProfileTransaction').mockImplementation(async (_uid, fn) => {
      const updated = fn(storedProfile);
      if (updated) storedProfile = updated;
      return updated;
    });
    const receiptSpy = vi.spyOn(profileRepo, 'saveMatchReceipt').mockResolvedValue();
    const lbSpy = vi.spyOn(leaderboardRepo, 'writeLeaderboardEntry').mockResolvedValue();
    const mhSpy = vi.spyOn(matchHistoryRepo, 'writeMatchHistory').mockResolvedValue();

    const todaySeed = new Date().toISOString().split('T')[0];
    const gameState: GameState = {
      matchId: 'audit-100',
      isRanked: false,
      settings: {
        playerCount: 2,
        easyBots: 0,
        intermediateBots: 1,
        seed: todaySeed,
        runLength: 2,
        sound: true,
        accessibility: false,
        uiEffects: true,
        colorBlindMode: false,
        selectedChassis: ChassisId.Standard,
      },
      players: [
        {
          id: 1,
          name: 'Alice',
          isBot: false,
          isRival: false,
          color: '#00dffc',
          position: 100,
          powerUps: [],
          statuses: [],
          tileHistory: [
            { tileIndex: 0, stars: 3, primaryMetric: 120 },
            { tileIndex: 1, stars: 3, primaryMetric: 130 },
          ],
          energy: 6,
          overdriveCooldown: 0,
        },
        {
          id: 2,
          name: 'Rival Bot',
          isBot: true,
          isRival: true,
          color: '#d64f8a',
          position: 50,
          powerUps: [],
          statuses: [],
          tileHistory: [
            { tileIndex: 0, stars: 1, primaryMetric: 400 },
            { tileIndex: 1, stars: 1, primaryMetric: 400 },
          ],
          energy: 2,
          overdriveCooldown: 0,
        },
      ],
      run: [
        { tileIndex: 1, eventId: 'reaction-tap', difficulty: 1 },
        { tileIndex: 2, eventId: 'reaction-tap', difficulty: 1 },
      ],
      currentTileIndex: 2,
      eventResults: {},
      lastTileResults: null,
      overdrivingPlayerIds: [],
      activeIntervention: null,
      lastHazardInterventionIndex: -99,
      activeAnomaly: null,
    };

    const client = createMockClient('s1');
    const delivered = await runMatchSummaryPipeline({
      gameState,
      roomPlayers: [{ sessionId: 's1', playerId: 1, userId: 'u-alice' }],
      sortedPlayers: gameState.players,
      eventDimensionMap: { 'reaction-tap': 'reaction' },
      roomCode: 'AUDT',
      isRanked: false,
      matchId: 'audit-100',
      completedAt: 1700000000000,
      findClient: () => client as any,
    });

    const deliveredSummary = delivered.get(1)!;
    expect(deliveredSummary).toBeDefined();
    expect(deliveredSummary.matchId).toBe('audit-100');
    expect(storedProfile.appliedMatchIds).toContain('audit-100');
    expect(deliveredSummary.streakDelta.newStreak).toBe(1);
    expect(storedProfile.winStreak).toBe(1);
    expect(deliveredSummary.dailyIsNewBest).toBe(true);
    expect(deliveredSummary.eventMasteryUpdates[0].mastery.totalPlays).toBe(2);
    expect(storedProfile.eventMastery?.['reaction-tap']?.totalPlays).toBe(2);

    // Repeating finalization must be idempotent (no second reward application)
    const cpAfterFirst = storedProfile.circuitPoints;
    const secondRun = await runMatchSummaryPipeline({
      gameState,
      roomPlayers: [{ sessionId: 's1', playerId: 1, userId: 'u-alice' }],
      sortedPlayers: gameState.players,
      eventDimensionMap: { 'reaction-tap': 'reaction' },
      roomCode: 'AUDT',
      isRanked: false,
      matchId: 'audit-100',
      completedAt: 1700000000000,
      findClient: () => client as any,
    });
    expect(secondRun.size).toBe(0);
    expect(storedProfile.circuitPoints).toBe(cpAfterFirst);

    txSpy.mockRestore();
    receiptSpy.mockRestore();
    lbSpy.mockRestore();
    mhSpy.mockRestore();
  });

  it('Probe 8 (B09): Daily leaderboard collection and document paths have valid Firestore segment parity', () => {
    const colSegments = getLeaderboardCollectionSegments('daily', '2026-10-15');
    const docPath = getLeaderboardDocPath('daily', 'user-123', '2026-10-15');
    const docSegments = docPath.split('/');

    // Collection path must have an ODD number of segments (3)
    expect(colSegments.length % 2).toBe(1);
    expect(colSegments).toHaveLength(3);

    // Document path must have an EVEN number of segments (4)
    expect(docSegments.length % 2).toBe(0);
    expect(docSegments).toHaveLength(4);
  });

  it('Probe 9 (B02): Repeated forced overdrive is idempotent and does not reverse a 3★ success to 0★', () => {
    const room = createTestRoom();
    const client = createMockClient('s1');
    room.onJoin(client, { playerName: 'Alice', avatarId: '🚀', chassisId: ChassisId.Standard });
    let gs: GameState = (room as any).initializeGameState(room.roomState.settings);

    // Activate forced overdrive twice (e.g. duplicate Cosmic Storm surge)
    gs = GameRules.activateOverdrive(gs, 1, true).newState;
    gs = GameRules.activateOverdrive(gs, 1, true).newState;

    expect(gs.overdrivingPlayerIds).toEqual([1]);

    // Processing a 3★ result must upgrade to 4★ (not downgrade to 0★)
    const step = GameRules.processRaceStep(
      gs,
      {
        1: { playerId: 1, stars: 3, primaryMetric: 120 },
        2: { playerId: 2, stars: 2, primaryMetric: 220 },
      },
      EVENT_DESCRIPTORS
    );
    expect(step.newState.lastTileResults?.[1]?.stars).toBe(4);
  });

  it('Probe 10 (B07): Equal-rated two-player ranked match gives +16 to winner and -16 to loser (even if 0-based placements passed)', () => {
    const changes1Based = computeMultiPlayerRatingChanges([
      { playerId: 1, rating: 1000, placement: 1 },
      { playerId: 2, rating: 1000, placement: 2 },
    ]);
    expect(changes1Based.get(1)).toBe(16);
    expect(changes1Based.get(2)).toBe(-16);

    const changes0Based = computeMultiPlayerRatingChanges([
      { playerId: 1, rating: 1000, placement: 0 },
      { playerId: 2, rating: 1000, placement: 1 },
    ]);
    expect(changes0Based.get(1)).toBe(16);
    expect(changes0Based.get(2)).toBe(-16);
  });

  it('Probe 11 (R13): verifyAuthToken rejects FIREBASE_AUTH_DISABLED=1 when NODE_ENV=production', async () => {
    const prevDisable = process.env.FIREBASE_AUTH_DISABLED;
    const prevEnv = process.env.NODE_ENV;
    process.env.FIREBASE_AUTH_DISABLED = '1';
    process.env.NODE_ENV = 'production';
    try {
      const identity = await verifyAuthToken(undefined);
      expect(identity).toBeNull();
    } finally {
      process.env.FIREBASE_AUTH_DISABLED = prevDisable;
      process.env.NODE_ENV = prevEnv;
    }
  });
});

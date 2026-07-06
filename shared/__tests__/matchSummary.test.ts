import { describe, it, expect } from 'vitest';
import { computeMatchSummary, applyMatchSummaryToProfile, MatchSummaryInput } from '../matchSummary';
import { GameState, GameSettings, Player, PilotProfile, ChassisId, AccoladeId, CorporationId, BotPersonality } from '../types';

const BASE_SETTINGS: GameSettings = {
  playerCount: 4,
  easyBots: 2,
  intermediateBots: 1,
  seed: 'summary-test',
  runLength: 4,
  sound: true,
  accessibility: false,
  uiEffects: true,
  colorBlindMode: false,
  selectedChassis: ChassisId.Standard,
};

const BASE_PROFILE: PilotProfile = {
  name: 'TestPilot',
  avatarId: '🚀',
  circuitPoints: 100,
  winStreak: 2,
  unlockedChassis: [ChassisId.Standard],
  unlockedAccolades: [],
  rivalData: {
    name: 'Vector',
    avatarId: '👾',
    favoredChassis: ChassisId.Momentum,
    wins: 1,
    losses: 2,
    traits: [],
  },
  gauntletHighScore: 5,
  sponsorships: {
    [CorporationId.Cyberex]: { reputation: 10, activeContract: null },
    [CorporationId.Zenith]: { reputation: 5, activeContract: null },
    [CorporationId.Rogue]: { reputation: 0, activeContract: null },
  },
};

function makeGameState(overrides?: Partial<GameState>): GameState {
  const players: Player[] = [
    {
      id: 1, name: 'TestPilot', isBot: false, isRival: false, color: '#00dffc',
      position: 100, powerUps: [], statuses: [], tileHistory: [
        { tileIndex: 1, stars: 3 },
        { tileIndex: 2, stars: 2 },
        { tileIndex: 3, stars: 3 },
        { tileIndex: 4, stars: 3 },
      ], energy: 0, overdriveCooldown: 0,
    },
    {
      id: 2, name: 'Rival Vector', isBot: true, isRival: true, color: '#d64f8a',
      personality: BotPersonality.Rival, position: 80, powerUps: [], statuses: [],
      tileHistory: [
        { tileIndex: 1, stars: 2 },
        { tileIndex: 2, stars: 2 },
        { tileIndex: 3, stars: 1 },
        { tileIndex: 4, stars: 2 },
      ], energy: 0, overdriveCooldown: 0,
    },
  ];
  return {
    settings: BASE_SETTINGS,
    players,
    run: [
      { tileIndex: 1, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.1' },
      { tileIndex: 2, eventId: 'aim-flick', difficulty: 2, subSeed: '0.2' },
      { tileIndex: 3, eventId: 'quick-math', difficulty: 2, subSeed: '0.3' },
      { tileIndex: 4, eventId: 'memory-flip', difficulty: 3, subSeed: '0.4' },
    ],
    currentTileIndex: 4,
    eventResults: {},
    lastTileResults: null,
    overdrivingPlayerIds: [],
    activeIntervention: null,
    lastHazardInterventionIndex: -99,
    activeAnomaly: null,
    ...overrides,
  };
}

const EVENT_DIM_MAP: Record<string, string> = {
  'reaction-tap': 'reaction',
  'aim-flick': 'precision',
  'quick-math': 'logic',
  'memory-flip': 'memory',
};

describe('computeMatchSummary', () => {
  const input: MatchSummaryInput = {
    gameState: makeGameState(),
    profile: BASE_PROFILE,
    mode: 'local',
    contracts: [],
    eventDimensionMap: EVENT_DIM_MAP,
    dailySeed: null,
    currentDailyBest: null,
  };

  it('returns a summary with correct standings', () => {
    const summary = computeMatchSummary(input);
    expect(summary.standings).toHaveLength(2);
    expect(summary.standings[0].name).toBe('TestPilot');
    expect(summary.humanPlacement).toBe(0);
  });

  it('calculates CP from placement and stars', () => {
    const summary = computeMatchSummary(input);
    expect(summary.cp.placement).toBe(50);
    expect(summary.cp.totalCp).toBeGreaterThan(0);
  });

  it('applies streak multiplier', () => {
    const summary = computeMatchSummary(input);
    expect(summary.streakDelta.newStreak).toBe(3);
    expect(summary.cp.streakMultiplier).toBeCloseTo(1 + 3 * 0.05, 2);
  });

  it('detects rival defeat', () => {
    const summary = computeMatchSummary(input);
    expect(summary.rivalDelta).toEqual({ wins: 1, losses: 0 });
  });

  it('unlocks FirstVictory accolade on first win', () => {
    const profile: PilotProfile = { ...BASE_PROFILE, unlockedAccolades: [] };
    const summary = computeMatchSummary({ ...input, profile });
    expect(summary.accoladeUnlocks).toContain(AccoladeId.FirstVictory);
  });

  it('unlocks RivalryBegins when defeating rival for first time', () => {
    const profile: PilotProfile = { ...BASE_PROFILE, unlockedAccolades: [] };
    const summary = computeMatchSummary({ ...input, profile });
    expect(summary.accoladeUnlocks).toContain(AccoladeId.RivalryBegins);
  });

  it('does not re-unlock already unlocked accolades', () => {
    const profile: PilotProfile = {
      ...BASE_PROFILE,
      unlockedAccolades: [AccoladeId.FirstVictory, AccoladeId.RivalryBegins],
    };
    const summary = computeMatchSummary({ ...input, profile });
    expect(summary.accoladeUnlocks).not.toContain(AccoladeId.FirstVictory);
    expect(summary.accoladeUnlocks).not.toContain(AccoladeId.RivalryBegins);
  });

  it('detects anti-farming when >50% same event', () => {
    const gs = makeGameState({
      run: [
        { tileIndex: 1, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.1' },
        { tileIndex: 2, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.2' },
        { tileIndex: 3, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.3' },
        { tileIndex: 4, eventId: 'aim-flick', difficulty: 1, subSeed: '0.4' },
      ],
    });
    const summary = computeMatchSummary({ ...input, gameState: gs });
    expect(summary.cp.isFarming).toBe(true);
    expect(summary.cp.farmingPenaltyApplied).toBe(true);
  });

  it('handles gauntlet mode correctly', () => {
    const gs = makeGameState({
      settings: { ...BASE_SETTINGS, isGauntlet: true },
    });
    const summary = computeMatchSummary({ ...input, gameState: gs });
    expect(summary.isGauntlet).toBe(true);
    expect(summary.gauntletTilesSurvived).toBe(4);
  });

  it('handles empty human player gracefully', () => {
    const gs = makeGameState({
      players: [{
        id: 1, name: 'Bot', isBot: true, isRival: false, color: '#fff',
        position: 0, powerUps: [], statuses: [], tileHistory: [], energy: 0, overdriveCooldown: 0,
      }],
    });
    const summary = computeMatchSummary({ ...input, gameState: gs });
    expect(summary.humanPlacement).toBe(-1);
    expect(summary.standings).toEqual([]);
  });
});

describe('applyMatchSummaryToProfile', () => {
  it('applies CP and streak to profile', () => {
    const summary = computeMatchSummary({
      gameState: makeGameState(),
      profile: BASE_PROFILE,
      mode: 'local',
      contracts: [],
      eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null,
      currentDailyBest: null,
    });
    const updated = applyMatchSummaryToProfile(BASE_PROFILE, summary);
    expect(updated).not.toBeNull();
    expect(updated!.circuitPoints).toBe(BASE_PROFILE.circuitPoints + summary.cp.totalCp);
    expect(updated!.winStreak).toBe(summary.streakDelta.newStreak);
  });

  it('is idempotent — second apply returns null', () => {
    const summary = computeMatchSummary({
      gameState: makeGameState(),
      profile: BASE_PROFILE,
      mode: 'local',
      contracts: [],
      eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null,
      currentDailyBest: null,
    });
    const firstApply = applyMatchSummaryToProfile(BASE_PROFILE, summary);
    expect(firstApply).not.toBeNull();
    const secondApply = applyMatchSummaryToProfile(firstApply!, summary);
    expect(secondApply).toBeNull();
  });

  it('applies rival W/L', () => {
    const summary = computeMatchSummary({
      gameState: makeGameState(),
      profile: BASE_PROFILE,
      mode: 'local',
      contracts: [],
      eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null,
      currentDailyBest: null,
    });
    const updated = applyMatchSummaryToProfile(BASE_PROFILE, summary);
    expect(updated).not.toBeNull();
    expect(updated!.rivalData.wins).toBe(BASE_PROFILE.rivalData.wins + 1);
  });

  it('applies accolades', () => {
    const summary = computeMatchSummary({
      gameState: makeGameState(),
      profile: { ...BASE_PROFILE, unlockedAccolades: [] },
      mode: 'local',
      contracts: [],
      eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null,
      currentDailyBest: null,
    });
    const updated = applyMatchSummaryToProfile(BASE_PROFILE, summary);
    expect(updated).not.toBeNull();
    expect(updated!.unlockedAccolades).toContain(AccoladeId.FirstVictory);
  });

  it('bounds appliedMatchIds to prevent unbounded growth', () => {
    let profile: PilotProfile = { ...BASE_PROFILE, appliedMatchIds: [] };
    for (let i = 0; i < 60; i++) {
      const summary = computeMatchSummary({
        gameState: makeGameState(),
        profile,
        mode: 'local',
        contracts: [],
        eventDimensionMap: EVENT_DIM_MAP,
        dailySeed: null,
        currentDailyBest: null,
        timestamp: 1000 + i,
      });
      const updated = applyMatchSummaryToProfile(profile, summary);
      if (updated) profile = updated;
    }
    expect(profile.appliedMatchIds!.length).toBeLessThanOrEqual(50);
  });
});

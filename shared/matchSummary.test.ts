/**
 * shared/matchSummary.test.ts
 *
 * Tests for the canonical post-race progression pipeline.
 * Covers: summary correctness, idempotent profile application,
 * local/online parity, gauntlet mode, daily challenge, contracts,
 * accolades, and UI purity guarantees.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMatchSummary,
  applyMatchSummaryToProfile,
  MatchSummaryInput,
  MatchSummary,
} from './matchSummary';
import {
  GameState, GameSettings, Player, Tile, PilotProfile, Contract,
  AccoladeId, ChassisId, CorporationId, RivalTraitId, BotPersonality,
} from './types';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeSettings(overrides?: Partial<GameSettings>): GameSettings {
  return {
    playerCount: 4,
    easyBots: 1,
    intermediateBots: 1,
    seed: 'test-seed-42',
    runLength: 6,
    sound: false,
    accessibility: false,
    uiEffects: false,
    colorBlindMode: false,
    selectedChassis: ChassisId.Standard,
    ...overrides,
  };
}

function makePlayer(overrides?: Partial<Player>): Player {
  return {
    id: 1,
    name: 'TestPilot',
    isBot: false,
    isRival: false,
    color: '#00dffc',
    position: 80,
    powerUps: [],
    statuses: [],
    tileHistory: [
      { tileIndex: 1, stars: 3 },
      { tileIndex: 2, stars: 2 },
      { tileIndex: 3, stars: 3 },
      { tileIndex: 4, stars: 2 },
      { tileIndex: 5, stars: 3 },
      { tileIndex: 6, stars: 1 },
    ],
    energy: 100,
    overdriveCooldown: 0,
    ...overrides,
  };
}

function makeRivalPlayer(overrides?: Partial<Player>): Player {
  return makePlayer({
    id: 2,
    name: 'Rival-Vector',
    isBot: true,
    isRival: true,
    personality: BotPersonality.Rival,
    color: '#d64f8a',
    position: 70,
    tileHistory: [
      { tileIndex: 1, stars: 2 },
      { tileIndex: 2, stars: 2 },
      { tileIndex: 3, stars: 2 },
      { tileIndex: 4, stars: 2 },
      { tileIndex: 5, stars: 2 },
      { tileIndex: 6, stars: 2 },
    ],
    ...overrides,
  });
}

function makeBotPlayer(id: number, position: number): Player {
  return makePlayer({
    id,
    name: `Bot-${id}`,
    isBot: true,
    isRival: false,
    personality: BotPersonality.Easy,
    color: '#4dffaf',
    position,
    tileHistory: [
      { tileIndex: 1, stars: 1 },
      { tileIndex: 2, stars: 1 },
      { tileIndex: 3, stars: 1 },
      { tileIndex: 4, stars: 1 },
      { tileIndex: 5, stars: 1 },
      { tileIndex: 6, stars: 1 },
    ],
  });
}

function makeTiles(count: number): Tile[] {
  return Array.from({ length: count }, (_, i) => ({
    tileIndex: i + 1,
    eventId: `event-${String.fromCharCode(65 + (i % 6))}`,
    difficulty: 1,
  }));
}

function makeProfile(overrides?: Partial<PilotProfile>): PilotProfile {
  return {
    name: 'TestPilot',
    avatarId: 'avatar-1',
    circuitPoints: 100,
    winStreak: 2,
    unlockedChassis: [ChassisId.Standard],
    unlockedAccolades: [],
    rivalData: {
      name: 'Rival-Vector',
      avatarId: 'rival-avatar',
      favoredChassis: ChassisId.Aegis,
      wins: 3,
      losses: 1,
      traits: [RivalTraitId.PrecisionFocus],
    },
    gauntletHighScore: 10,
    sponsorships: {
      [CorporationId.Cyberex]: { reputation: 50, activeContract: null },
      [CorporationId.Zenith]: { reputation: 30, activeContract: null },
      [CorporationId.Rogue]: { reputation: 10, activeContract: null },
    },
    appliedMatchIds: [],
    ...overrides,
  };
}

function makeGameState(overrides?: Partial<GameState>): GameState {
  const tiles = makeTiles(6);
  return {
    settings: makeSettings(),
    players: [
      makePlayer(),
      makeRivalPlayer(),
      makeBotPlayer(3, 50),
      makeBotPlayer(4, 40),
    ],
    run: tiles,
    currentTileIndex: 6, // Race finished
    eventResults: {},
    lastTileResults: null,
    overdrivingPlayerIds: [],
    activeIntervention: null,
    lastHazardInterventionIndex: -1,
    activeAnomaly: null,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<MatchSummaryInput>): MatchSummaryInput {
  return {
    gameState: makeGameState(),
    profile: makeProfile(),
    mode: 'local',
    contracts: [],
    eventDimensionMap: {
      'event-A': 'reaction',
      'event-B': 'typing',
      'event-C': 'precision',
      'event-D': 'memory',
      'event-E': 'rhythm',
      'event-F': 'logic',
    },
    dailySeed: null,
    currentDailyBest: null,
    timestamp: 1700000000000,
    ...overrides,
  };
}

// ─── Summary Correctness ────────────────────────────────────────────────────

describe('computeMatchSummary', () => {
  it('produces correct standings sorted by position', () => {
    const summary = computeMatchSummary(makeInput());
    expect(summary.standings).toHaveLength(4);
    expect(summary.standings[0].name).toBe('TestPilot');
    expect(summary.standings[0].position).toBe(80);
    expect(summary.standings[1].name).toBe('Rival-Vector');
    // Descending by position
    for (let i = 0; i < summary.standings.length - 1; i++) {
      expect(summary.standings[i].position).toBeGreaterThanOrEqual(summary.standings[i + 1].position);
    }
  });

  it('identifies the human player placement', () => {
    const summary = computeMatchSummary(makeInput());
    expect(summary.humanPlacement).toBe(0); // Human is 1st
    expect(summary.humanPlayerId).toBe(1);
  });

  it('computes CP correctly (placement + stars × perStar)', () => {
    const summary = computeMatchSummary(makeInput());
    // Placement[0] = 50, total stars = 3+2+3+2+3+1 = 14, perStar = 2 => 28
    // Base = 50 + 28 = 78, streak multiplier(3) = 1 + min(3,5)*0.05 = 1.15
    // Total = round(78 * 1.15) = round(89.7) = 90
    expect(summary.cp.placement).toBe(50);
    expect(summary.cp.stars).toBe(28);
    expect(summary.cp.baseCp).toBe(78);
    expect(summary.cp.streakMultiplier).toBeCloseTo(1.15, 2);
    expect(summary.cp.totalCp).toBe(90); // round(78 * 1.15) = 90
  });

  it('detects farming penalty when one event dominates >50%', () => {
    const farmTiles: Tile[] = Array.from({ length: 6 }, (_, i) => ({
      tileIndex: i + 1,
      eventId: 'event-A', // All same event
      difficulty: 1,
    }));
    const gs = makeGameState({ run: farmTiles });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.cp.isFarming).toBe(true);
    expect(summary.cp.farmingPenaltyApplied).toBe(true);
    // Stars should be discounted by 30%
    expect(summary.cp.stars).toBeCloseTo(28 * 0.7, 1);
  });

  it('returns rivalDelta with wins=1 when human beats rival', () => {
    const summary = computeMatchSummary(makeInput());
    expect(summary.rivalDelta).not.toBeNull();
    expect(summary.rivalDelta!.wins).toBe(1);
    expect(summary.rivalDelta!.losses).toBe(0);
  });

  it('returns rivalDelta with losses=1 when rival beats human', () => {
    const gs = makeGameState({
      players: [
        makePlayer({ position: 50 }),
        makeRivalPlayer({ position: 90 }),
        makeBotPlayer(3, 40),
        makeBotPlayer(4, 30),
      ],
    });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.rivalDelta!.wins).toBe(0);
    expect(summary.rivalDelta!.losses).toBe(1);
  });

  it('updates win streak: +1 on rival defeat, 0 on rival loss', () => {
    const profile = makeProfile({ winStreak: 3 });
    const summary = computeMatchSummary(makeInput({ profile }));
    expect(summary.streakDelta.oldStreak).toBe(3);
    expect(summary.streakDelta.newStreak).toBe(4); // Defeated rival

    // Now lose
    const gs = makeGameState({
      players: [
        makePlayer({ position: 50 }),
        makeRivalPlayer({ position: 90 }),
        makeBotPlayer(3, 40),
        makeBotPlayer(4, 30),
      ],
    });
    const lostSummary = computeMatchSummary(makeInput({ profile, gameState: gs }));
    expect(lostSummary.streakDelta.newStreak).toBe(0);
  });

  it('generates a deterministic matchId from seed+timestamp', () => {
    const s1 = computeMatchSummary(makeInput({ timestamp: 1000 }));
    const s2 = computeMatchSummary(makeInput({ timestamp: 1000 }));
    expect(s1.matchId).toBe(s2.matchId);
    expect(s1.matchId).toBe('test-seed-42-1000');
  });
});

// ─── Accolades ──────────────────────────────────────────────────────────────

describe('computeMatchSummary accolades', () => {
  it('unlocks FirstVictory when human places 1st', () => {
    const summary = computeMatchSummary(makeInput());
    expect(summary.accoladeUnlocks).toContain(AccoladeId.FirstVictory);
  });

  it('does NOT unlock FirstVictory if already unlocked', () => {
    const profile = makeProfile({ unlockedAccolades: [AccoladeId.FirstVictory] });
    const summary = computeMatchSummary(makeInput({ profile }));
    expect(summary.accoladeUnlocks).not.toContain(AccoladeId.FirstVictory);
  });

  it('unlocks RivalryBegins when human beats rival', () => {
    const summary = computeMatchSummary(makeInput());
    expect(summary.accoladeUnlocks).toContain(AccoladeId.RivalryBegins);
  });

  it('unlocks Overdriver when any tile has 4 stars', () => {
    const gs = makeGameState({
      players: [
        makePlayer({
          tileHistory: [
            { tileIndex: 1, stars: 4 },
            { tileIndex: 2, stars: 2 },
            { tileIndex: 3, stars: 2 },
            { tileIndex: 4, stars: 2 },
            { tileIndex: 5, stars: 2 },
            { tileIndex: 6, stars: 2 },
          ],
        }),
        makeRivalPlayer(),
        makeBotPlayer(3, 50),
        makeBotPlayer(4, 40),
      ],
    });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.accoladeUnlocks).toContain(AccoladeId.Overdriver);
  });

  it('unlocks Perfectionist when avgStars >= 3', () => {
    const gs = makeGameState({
      players: [
        makePlayer({
          tileHistory: [
            { tileIndex: 1, stars: 3 },
            { tileIndex: 2, stars: 3 },
            { tileIndex: 3, stars: 3 },
            { tileIndex: 4, stars: 3 },
            { tileIndex: 5, stars: 3 },
            { tileIndex: 6, stars: 3 },
          ],
        }),
        makeRivalPlayer(),
        makeBotPlayer(3, 50),
        makeBotPlayer(4, 40),
      ],
    });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.accoladeUnlocks).toContain(AccoladeId.Perfectionist);
  });

  it('unlocks HazardousDuty when >=3 stars on a hazard tile', () => {
    const tiles = makeTiles(6);
    tiles[2] = { ...tiles[2], isHazard: true };
    const gs = makeGameState({ run: tiles });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    // Human's tileHistory[2] has 3 stars, tile[2] is hazard
    expect(summary.accoladeUnlocks).toContain(AccoladeId.HazardousDuty);
  });
});

// ─── Contracts ──────────────────────────────────────────────────────────────

describe('computeMatchSummary contracts', () => {
  it('evaluates a FINISH_RACE_IN_POS contract correctly', () => {
    const contract: Contract = {
      corporationId: CorporationId.Cyberex,
      objectives: [
        { type: 'FINISH_RACE_IN_POS', description: 'Finish in top 2', targetValue: 2, isComplete: false },
      ],
      cpReward: 20,
      repReward: 5,
    };
    const summary = computeMatchSummary(makeInput({ contracts: [contract] }));
    expect(summary.contractOutcomes).toHaveLength(1);
    expect(summary.contractOutcomes[0].allComplete).toBe(true);
    expect(summary.contractOutcomes[0].cpReward).toBe(20);
    expect(summary.cp.contractCp).toBe(20);
  });

  it('evaluates a failed AVG_STARS_ABOVE contract', () => {
    const contract: Contract = {
      corporationId: CorporationId.Zenith,
      objectives: [
        { type: 'AVG_STARS_ABOVE', description: 'Average 3.5+ stars', targetValue: 3.5, isComplete: false },
      ],
      cpReward: 30,
      repReward: 10,
    };
    // Human average stars = 14/6 ≈ 2.33
    const summary = computeMatchSummary(makeInput({ contracts: [contract] }));
    expect(summary.contractOutcomes[0].allComplete).toBe(false);
    expect(summary.cp.contractCp).toBe(0);
  });

  it('adds sponsorship reputation from completed contracts', () => {
    const contract: Contract = {
      corporationId: CorporationId.Rogue,
      objectives: [
        { type: 'FINISH_RACE_IN_POS', description: 'Finish top 4', targetValue: 4, isComplete: false },
      ],
      cpReward: 15,
      repReward: 8,
    };
    const summary = computeMatchSummary(makeInput({ contracts: [contract] }));
    const contractDelta = summary.sponsorshipDeltas.find(d => d.source === 'contract' && d.corpId === CorporationId.Rogue);
    expect(contractDelta).toBeDefined();
    expect(contractDelta!.repChange).toBe(8);
  });
});

// ─── Sponsorship from sponsored tiles ───────────────────────────────────────

describe('computeMatchSummary sponsorships', () => {
  it('grants reputation for 3+ stars on sponsored tiles', () => {
    const tiles = makeTiles(6);
    tiles[0] = { ...tiles[0], modifier: 'SPONSORED', sponsoringCorp: CorporationId.Cyberex };
    // Human's tile 0 has 3 stars
    const gs = makeGameState({ run: tiles });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    const sponsoredDelta = summary.sponsorshipDeltas.find(d => d.source === 'sponsored_tile' && d.corpId === CorporationId.Cyberex);
    expect(sponsoredDelta).toBeDefined();
    expect(sponsoredDelta!.repChange).toBeGreaterThanOrEqual(3);
    expect(sponsoredDelta!.repChange).toBeLessThanOrEqual(5);
  });

  it('does NOT grant reputation for <3 stars on sponsored tiles', () => {
    const tiles = makeTiles(6);
    tiles[5] = { ...tiles[5], modifier: 'SPONSORED', sponsoringCorp: CorporationId.Zenith };
    // Human's tile 5 has 1 star
    const gs = makeGameState({ run: tiles });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    const sponsoredDelta = summary.sponsorshipDeltas.find(d => d.source === 'sponsored_tile' && d.corpId === CorporationId.Zenith);
    expect(sponsoredDelta).toBeUndefined();
  });
});

// ─── Gauntlet Mode ──────────────────────────────────────────────────────────

describe('computeMatchSummary gauntlet', () => {
  it('returns gauntlet summary with no CP', () => {
    const gs = makeGameState({
      settings: makeSettings({ isGauntlet: true }),
    });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.isGauntlet).toBe(true);
    expect(summary.cp.totalCp).toBe(0);
    expect(summary.rivalDelta).toBeNull();
    expect(summary.accoladeUnlocks).toHaveLength(0);
  });

  it('detects gauntlet new high score', () => {
    const gs = makeGameState({
      settings: makeSettings({ isGauntlet: true }),
    });
    // Human tileHistory has 6 entries, gauntletHighScore is 10 → not new
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.gauntletTilesSurvived).toBe(6);
    expect(summary.gauntletNewHighScore).toBe(false);

    // Now with low high score
    const profile = makeProfile({ gauntletHighScore: 3 });
    const summary2 = computeMatchSummary(makeInput({ gameState: gs, profile }));
    expect(summary2.gauntletNewHighScore).toBe(true);
  });
});

// ─── Daily Challenge ────────────────────────────────────────────────────────

describe('computeMatchSummary daily', () => {
  it('detects daily challenge when seed matches dailySeed', () => {
    const summary = computeMatchSummary(makeInput({ dailySeed: 'test-seed-42' }));
    expect(summary.isDaily).toBe(true);
  });

  it('marks new daily best correctly', () => {
    const summary = computeMatchSummary(makeInput({
      dailySeed: 'test-seed-42',
      currentDailyBest: null,
    }));
    expect(summary.dailyIsNewBest).toBe(true);
    expect(summary.dailyPersonalBest).toBe(80); // humanPlayer.position
  });

  it('does not mark new best when existing is higher', () => {
    const summary = computeMatchSummary(makeInput({
      dailySeed: 'test-seed-42',
      currentDailyBest: 95,
    }));
    expect(summary.dailyIsNewBest).toBe(false);
    expect(summary.dailyPersonalBest).toBe(95); // existing best preserved
  });
});

// ─── Local/Online Parity ────────────────────────────────────────────────────

describe('local/online parity', () => {
  it('produces identical summaries for local and online given same game state', () => {
    const baseInput = makeInput();
    const localSummary = computeMatchSummary({ ...baseInput, mode: 'local' });
    const onlineSummary = computeMatchSummary({ ...baseInput, mode: 'online' });

    // Core rewards must be identical
    expect(localSummary.cp.totalCp).toBe(onlineSummary.cp.totalCp);
    expect(localSummary.streakDelta).toEqual(onlineSummary.streakDelta);
    expect(localSummary.rivalDelta).toEqual(onlineSummary.rivalDelta);
    expect(localSummary.accoladeUnlocks).toEqual(onlineSummary.accoladeUnlocks);
    expect(localSummary.contractOutcomes).toEqual(onlineSummary.contractOutcomes);
    expect(localSummary.sponsorshipDeltas).toEqual(onlineSummary.sponsorshipDeltas);
    expect(localSummary.standings).toEqual(onlineSummary.standings);

    // Mode differs
    expect(localSummary.mode).toBe('local');
    expect(onlineSummary.mode).toBe('online');
  });

  it('applies contracts and accolades identically for both modes', () => {
    const contract: Contract = {
      corporationId: CorporationId.Cyberex,
      objectives: [
        { type: 'FINISH_RACE_IN_POS', description: 'Top 2', targetValue: 2, isComplete: false },
      ],
      cpReward: 25,
      repReward: 5,
    };
    const baseInput = makeInput({ contracts: [contract] });

    const localSummary = computeMatchSummary({ ...baseInput, mode: 'local' });
    const onlineSummary = computeMatchSummary({ ...baseInput, mode: 'online' });

    expect(localSummary.contractOutcomes[0].allComplete).toBe(onlineSummary.contractOutcomes[0].allComplete);
    expect(localSummary.cp.contractCp).toBe(onlineSummary.cp.contractCp);
    expect(localSummary.accoladeUnlocks).toEqual(onlineSummary.accoladeUnlocks);
  });
});

// ─── Idempotent Profile Application ─────────────────────────────────────────

describe('applyMatchSummaryToProfile', () => {
  it('applies CP, streak, rival W/L, accolades, sponsorships', () => {
    const summary = computeMatchSummary(makeInput());
    const profile = makeProfile();
    const updated = applyMatchSummaryToProfile(profile, summary);

    expect(updated).not.toBeNull();
    expect(updated!.circuitPoints).toBe(profile.circuitPoints + summary.cp.totalCp);
    expect(updated!.winStreak).toBe(summary.streakDelta.newStreak);
    expect(updated!.rivalData.wins).toBe(profile.rivalData.wins + (summary.rivalDelta?.wins ?? 0));
    expect(updated!.rivalData.losses).toBe(profile.rivalData.losses + (summary.rivalDelta?.losses ?? 0));
    for (const accolade of summary.accoladeUnlocks) {
      expect(updated!.unlockedAccolades).toContain(accolade);
    }
  });

  it('returns null on second application (idempotency)', () => {
    const summary = computeMatchSummary(makeInput());
    const profile = makeProfile();
    const first = applyMatchSummaryToProfile(profile, summary);
    expect(first).not.toBeNull();

    const second = applyMatchSummaryToProfile(first!, summary);
    expect(second).toBeNull(); // Already applied
  });

  it('tracks matchId in appliedMatchIds', () => {
    const summary = computeMatchSummary(makeInput());
    const profile = makeProfile();
    const updated = applyMatchSummaryToProfile(profile, summary);
    expect(updated!.appliedMatchIds).toContain(summary.matchId);
  });

  it('bounds appliedMatchIds to prevent unbounded growth', () => {
    const profile = makeProfile({
      appliedMatchIds: Array.from({ length: 60 }, (_, i) => `old-match-${i}`),
    });
    const summary = computeMatchSummary(makeInput());
    const updated = applyMatchSummaryToProfile(profile, summary);
    expect(updated!.appliedMatchIds!.length).toBeLessThanOrEqual(50);
    expect(updated!.appliedMatchIds).toContain(summary.matchId);
  });

  it('does not mutate the original profile', () => {
    const summary = computeMatchSummary(makeInput());
    const profile = makeProfile();
    const originalCp = profile.circuitPoints;
    const originalWins = profile.rivalData.wins;
    applyMatchSummaryToProfile(profile, summary);
    expect(profile.circuitPoints).toBe(originalCp);
    expect(profile.rivalData.wins).toBe(originalWins);
  });

  it('applies gauntlet high score update', () => {
    const gs = makeGameState({ settings: makeSettings({ isGauntlet: true }) });
    const profile = makeProfile({ gauntletHighScore: 3 });
    const summary = computeMatchSummary(makeInput({ gameState: gs, profile }));
    const updated = applyMatchSummaryToProfile(profile, summary);
    expect(updated!.gauntletHighScore).toBe(6); // 6 tiles survived
  });

  it('does NOT lower gauntlet high score', () => {
    const gs = makeGameState({ settings: makeSettings({ isGauntlet: true }) });
    const profile = makeProfile({ gauntletHighScore: 20 });
    const summary = computeMatchSummary(makeInput({ gameState: gs, profile }));
    const updated = applyMatchSummaryToProfile(profile, summary);
    expect(updated!.gauntletHighScore).toBe(20); // Not lowered
  });

  it('applies sponsorship reputation from contracts and sponsored tiles', () => {
    const tiles = makeTiles(6);
    tiles[0] = { ...tiles[0], modifier: 'SPONSORED', sponsoringCorp: CorporationId.Cyberex };
    const gs = makeGameState({ run: tiles });
    const contract: Contract = {
      corporationId: CorporationId.Rogue,
      objectives: [{ type: 'FINISH_RACE_IN_POS', description: 'Top 4', targetValue: 4, isComplete: false }],
      cpReward: 10,
      repReward: 7,
    };
    const profile = makeProfile();
    const summary = computeMatchSummary(makeInput({ gameState: gs, contracts: [contract], profile }));
    const updated = applyMatchSummaryToProfile(profile, summary);

    // Rogue rep should increase by 7 (contract)
    expect(updated!.sponsorships[CorporationId.Rogue]!.reputation).toBe(profile.sponsorships[CorporationId.Rogue]!.reputation + 7);
    // Cyberex rep should increase (sponsored tile)
    expect(updated!.sponsorships[CorporationId.Cyberex]!.reputation).toBeGreaterThan(profile.sponsorships[CorporationId.Cyberex]!.reputation);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles race with no rival gracefully', () => {
    const gs = makeGameState({
      players: [
        makePlayer(),
        makeBotPlayer(2, 60),
        makeBotPlayer(3, 50),
        makeBotPlayer(4, 40),
      ],
    });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.rivalDelta).toBeNull();
    expect(summary.streakDelta.newStreak).toBe(0); // No rival defeat = streak reset
  });

  it('handles empty tile history', () => {
    const gs = makeGameState({
      players: [
        makePlayer({ tileHistory: [] }),
        makeRivalPlayer({ tileHistory: [] }),
        makeBotPlayer(3, 50),
        makeBotPlayer(4, 40),
      ],
    });
    const summary = computeMatchSummary(makeInput({ gameState: gs }));
    expect(summary.cp.stars).toBe(0);
  });

  it('determinism: same input produces same output', () => {
    const input = makeInput();
    const s1 = computeMatchSummary(input);
    const s2 = computeMatchSummary(input);
    expect(s1).toEqual(s2);
  });
});

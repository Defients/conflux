"use strict";
/**
 * shared/matchSummary.test.ts
 *
 * Tests for the canonical post-race progression pipeline.
 * Covers: summary correctness, idempotent profile application,
 * local/online parity, gauntlet mode, daily challenge, contracts,
 * accolades, and UI purity guarantees.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const matchSummary_1 = require("./matchSummary");
const types_1 = require("./types");
// ─── Test Fixtures ──────────────────────────────────────────────────────────
function makeSettings(overrides) {
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
        selectedChassis: types_1.ChassisId.Standard,
        ...overrides,
    };
}
function makePlayer(overrides) {
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
            { tileIndex: 0, stars: 3 },
            { tileIndex: 1, stars: 2 },
            { tileIndex: 2, stars: 3 },
            { tileIndex: 3, stars: 2 },
            { tileIndex: 4, stars: 3 },
            { tileIndex: 5, stars: 1 },
        ],
        energy: 100,
        overdriveCooldown: 0,
        ...overrides,
    };
}
function makeRivalPlayer(overrides) {
    return makePlayer({
        id: 2,
        name: 'Rival-Vector',
        isBot: true,
        isRival: true,
        personality: types_1.BotPersonality.Rival,
        color: '#d64f8a',
        position: 70,
        tileHistory: [
            { tileIndex: 0, stars: 2 },
            { tileIndex: 1, stars: 2 },
            { tileIndex: 2, stars: 2 },
            { tileIndex: 3, stars: 2 },
            { tileIndex: 4, stars: 2 },
            { tileIndex: 5, stars: 2 },
        ],
        ...overrides,
    });
}
function makeBotPlayer(id, position) {
    return makePlayer({
        id,
        name: `Bot-${id}`,
        isBot: true,
        isRival: false,
        personality: types_1.BotPersonality.Easy,
        color: '#4dffaf',
        position,
        tileHistory: [
            { tileIndex: 0, stars: 1 },
            { tileIndex: 1, stars: 1 },
            { tileIndex: 2, stars: 1 },
            { tileIndex: 3, stars: 1 },
            { tileIndex: 4, stars: 1 },
            { tileIndex: 5, stars: 1 },
        ],
    });
}
function makeTiles(count) {
    return Array.from({ length: count }, (_, i) => ({
        tileIndex: i,
        eventId: `event-${String.fromCharCode(65 + (i % 6))}`,
        difficulty: 1,
    }));
}
function makeProfile(overrides) {
    return {
        name: 'TestPilot',
        avatarId: 'avatar-1',
        circuitPoints: 100,
        winStreak: 2,
        unlockedChassis: [types_1.ChassisId.Standard],
        unlockedAccolades: [],
        rivalData: {
            name: 'Rival-Vector',
            avatarId: 'rival-avatar',
            favoredChassis: types_1.ChassisId.Aegis,
            wins: 3,
            losses: 1,
            traits: [types_1.RivalTraitId.PrecisionFocus],
        },
        gauntletHighScore: 10,
        sponsorships: {
            [types_1.CorporationId.Cyberex]: { reputation: 50, activeContract: null },
            [types_1.CorporationId.Zenith]: { reputation: 30, activeContract: null },
            [types_1.CorporationId.Rogue]: { reputation: 10, activeContract: null },
        },
        appliedMatchIds: [],
        ...overrides,
    };
}
function makeGameState(overrides) {
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
function makeInput(overrides) {
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
(0, vitest_1.describe)('computeMatchSummary', () => {
    (0, vitest_1.it)('produces correct standings sorted by position', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        (0, vitest_1.expect)(summary.standings).toHaveLength(4);
        (0, vitest_1.expect)(summary.standings[0].name).toBe('TestPilot');
        (0, vitest_1.expect)(summary.standings[0].position).toBe(80);
        (0, vitest_1.expect)(summary.standings[1].name).toBe('Rival-Vector');
        // Descending by position
        for (let i = 0; i < summary.standings.length - 1; i++) {
            (0, vitest_1.expect)(summary.standings[i].position).toBeGreaterThanOrEqual(summary.standings[i + 1].position);
        }
    });
    (0, vitest_1.it)('identifies the human player placement', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        (0, vitest_1.expect)(summary.humanPlacement).toBe(0); // Human is 1st
        (0, vitest_1.expect)(summary.humanPlayerId).toBe(1);
    });
    (0, vitest_1.it)('computes CP correctly (placement + stars × perStar)', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        // Placement[0] = 50, total stars = 3+2+3+2+3+1 = 14, perStar = 2 => 28
        // Base = 50 + 28 = 78, streak multiplier(2) = 1 + min(2,5)*0.05 = 1.10
        // Total = round(78 * 1.10) = round(85.8) = 86
        (0, vitest_1.expect)(summary.cp.placement).toBe(50);
        (0, vitest_1.expect)(summary.cp.stars).toBe(28);
        (0, vitest_1.expect)(summary.cp.baseCp).toBe(78);
        (0, vitest_1.expect)(summary.cp.streakMultiplier).toBeCloseTo(1.10, 2);
        (0, vitest_1.expect)(summary.cp.totalCp).toBe(86); // round(78 * 1.10) = 86
    });
    (0, vitest_1.it)('detects farming penalty when one event dominates >50%', () => {
        const farmTiles = Array.from({ length: 6 }, (_, i) => ({
            tileIndex: i,
            eventId: 'event-A', // All same event
            difficulty: 1,
        }));
        const gs = makeGameState({ run: farmTiles });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.cp.isFarming).toBe(true);
        (0, vitest_1.expect)(summary.cp.farmingPenaltyApplied).toBe(true);
        // Stars should be discounted by 30%
        (0, vitest_1.expect)(summary.cp.stars).toBeCloseTo(28 * 0.7, 1);
    });
    (0, vitest_1.it)('returns rivalDelta with wins=1 when human beats rival', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        (0, vitest_1.expect)(summary.rivalDelta).not.toBeNull();
        (0, vitest_1.expect)(summary.rivalDelta.wins).toBe(1);
        (0, vitest_1.expect)(summary.rivalDelta.losses).toBe(0);
    });
    (0, vitest_1.it)('returns rivalDelta with losses=1 when rival beats human', () => {
        const gs = makeGameState({
            players: [
                makePlayer({ position: 50 }),
                makeRivalPlayer({ position: 90 }),
                makeBotPlayer(3, 40),
                makeBotPlayer(4, 30),
            ],
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.rivalDelta.wins).toBe(0);
        (0, vitest_1.expect)(summary.rivalDelta.losses).toBe(1);
    });
    (0, vitest_1.it)('updates win streak: +1 on rival defeat, 0 on rival loss', () => {
        const profile = makeProfile({ winStreak: 3 });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ profile }));
        (0, vitest_1.expect)(summary.streakDelta.oldStreak).toBe(3);
        (0, vitest_1.expect)(summary.streakDelta.newStreak).toBe(4); // Defeated rival
        // Now lose
        const gs = makeGameState({
            players: [
                makePlayer({ position: 50 }),
                makeRivalPlayer({ position: 90 }),
                makeBotPlayer(3, 40),
                makeBotPlayer(4, 30),
            ],
        });
        const lostSummary = (0, matchSummary_1.computeMatchSummary)(makeInput({ profile, gameState: gs }));
        (0, vitest_1.expect)(lostSummary.streakDelta.newStreak).toBe(0);
    });
    (0, vitest_1.it)('generates a deterministic matchId from seed+timestamp', () => {
        const s1 = (0, matchSummary_1.computeMatchSummary)(makeInput({ timestamp: 1000 }));
        const s2 = (0, matchSummary_1.computeMatchSummary)(makeInput({ timestamp: 1000 }));
        (0, vitest_1.expect)(s1.matchId).toBe(s2.matchId);
        (0, vitest_1.expect)(s1.matchId).toBe('test-seed-42-1000');
    });
});
// ─── Accolades ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeMatchSummary accolades', () => {
    (0, vitest_1.it)('unlocks FirstVictory when human places 1st', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        (0, vitest_1.expect)(summary.accoladeUnlocks).toContain(types_1.AccoladeId.FirstVictory);
    });
    (0, vitest_1.it)('does NOT unlock FirstVictory if already unlocked', () => {
        const profile = makeProfile({ unlockedAccolades: [types_1.AccoladeId.FirstVictory] });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ profile }));
        (0, vitest_1.expect)(summary.accoladeUnlocks).not.toContain(types_1.AccoladeId.FirstVictory);
    });
    (0, vitest_1.it)('unlocks RivalryBegins when human beats rival', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        (0, vitest_1.expect)(summary.accoladeUnlocks).toContain(types_1.AccoladeId.RivalryBegins);
    });
    (0, vitest_1.it)('unlocks Overdriver when any tile has 4 stars', () => {
        const gs = makeGameState({
            players: [
                makePlayer({
                    tileHistory: [
                        { tileIndex: 0, stars: 4 },
                        { tileIndex: 1, stars: 2 },
                        { tileIndex: 2, stars: 2 },
                        { tileIndex: 3, stars: 2 },
                        { tileIndex: 4, stars: 2 },
                        { tileIndex: 5, stars: 2 },
                    ],
                }),
                makeRivalPlayer(),
                makeBotPlayer(3, 50),
                makeBotPlayer(4, 40),
            ],
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.accoladeUnlocks).toContain(types_1.AccoladeId.Overdriver);
    });
    (0, vitest_1.it)('unlocks Perfectionist when avgStars >= 3', () => {
        const gs = makeGameState({
            players: [
                makePlayer({
                    tileHistory: [
                        { tileIndex: 0, stars: 3 },
                        { tileIndex: 1, stars: 3 },
                        { tileIndex: 2, stars: 3 },
                        { tileIndex: 3, stars: 3 },
                        { tileIndex: 4, stars: 3 },
                        { tileIndex: 5, stars: 3 },
                    ],
                }),
                makeRivalPlayer(),
                makeBotPlayer(3, 50),
                makeBotPlayer(4, 40),
            ],
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.accoladeUnlocks).toContain(types_1.AccoladeId.Perfectionist);
    });
    (0, vitest_1.it)('unlocks HazardousDuty when >=3 stars on a hazard tile', () => {
        const tiles = makeTiles(6);
        tiles[2] = { ...tiles[2], isHazard: true };
        const gs = makeGameState({ run: tiles });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        // Human's tileHistory[2] has 3 stars, tile[2] is hazard
        (0, vitest_1.expect)(summary.accoladeUnlocks).toContain(types_1.AccoladeId.HazardousDuty);
    });
});
// ─── Contracts ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeMatchSummary contracts', () => {
    (0, vitest_1.it)('evaluates a FINISH_RACE_IN_POS contract correctly', () => {
        const contract = {
            corporationId: types_1.CorporationId.Cyberex,
            objectives: [
                { type: 'FINISH_RACE_IN_POS', description: 'Finish in top 2', targetValue: 2, isComplete: false },
            ],
            cpReward: 20,
            repReward: 5,
        };
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ contracts: [contract] }));
        (0, vitest_1.expect)(summary.contractOutcomes).toHaveLength(1);
        (0, vitest_1.expect)(summary.contractOutcomes[0].allComplete).toBe(true);
        (0, vitest_1.expect)(summary.contractOutcomes[0].cpReward).toBe(20);
        (0, vitest_1.expect)(summary.cp.contractCp).toBe(20);
    });
    (0, vitest_1.it)('evaluates a failed AVG_STARS_ABOVE contract', () => {
        const contract = {
            corporationId: types_1.CorporationId.Zenith,
            objectives: [
                { type: 'AVG_STARS_ABOVE', description: 'Average 3.5+ stars', targetValue: 3.5, isComplete: false },
            ],
            cpReward: 30,
            repReward: 10,
        };
        // Human average stars = 14/6 ≈ 2.33
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ contracts: [contract] }));
        (0, vitest_1.expect)(summary.contractOutcomes[0].allComplete).toBe(false);
        (0, vitest_1.expect)(summary.cp.contractCp).toBe(0);
    });
    (0, vitest_1.it)('adds sponsorship reputation from completed contracts', () => {
        const contract = {
            corporationId: types_1.CorporationId.Rogue,
            objectives: [
                { type: 'FINISH_RACE_IN_POS', description: 'Finish top 4', targetValue: 4, isComplete: false },
            ],
            cpReward: 15,
            repReward: 8,
        };
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ contracts: [contract] }));
        const contractDelta = summary.sponsorshipDeltas.find(d => d.source === 'contract' && d.corpId === types_1.CorporationId.Rogue);
        (0, vitest_1.expect)(contractDelta).toBeDefined();
        (0, vitest_1.expect)(contractDelta.repChange).toBe(8);
    });
});
// ─── Sponsorship from sponsored tiles ───────────────────────────────────────
(0, vitest_1.describe)('computeMatchSummary sponsorships', () => {
    (0, vitest_1.it)('grants reputation for 3+ stars on sponsored tiles', () => {
        const tiles = makeTiles(6);
        tiles[0] = { ...tiles[0], modifier: 'SPONSORED', sponsoringCorp: types_1.CorporationId.Cyberex };
        // Human's tile 0 has 3 stars
        const gs = makeGameState({ run: tiles });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        const sponsoredDelta = summary.sponsorshipDeltas.find(d => d.source === 'sponsored_tile' && d.corpId === types_1.CorporationId.Cyberex);
        (0, vitest_1.expect)(sponsoredDelta).toBeDefined();
        (0, vitest_1.expect)(sponsoredDelta.repChange).toBeGreaterThanOrEqual(3);
        (0, vitest_1.expect)(sponsoredDelta.repChange).toBeLessThanOrEqual(5);
    });
    (0, vitest_1.it)('does NOT grant reputation for <3 stars on sponsored tiles', () => {
        const tiles = makeTiles(6);
        tiles[5] = { ...tiles[5], modifier: 'SPONSORED', sponsoringCorp: types_1.CorporationId.Zenith };
        // Human's tile 5 has 1 star
        const gs = makeGameState({ run: tiles });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        const sponsoredDelta = summary.sponsorshipDeltas.find(d => d.source === 'sponsored_tile' && d.corpId === types_1.CorporationId.Zenith);
        (0, vitest_1.expect)(sponsoredDelta).toBeUndefined();
    });
});
// ─── Gauntlet Mode ──────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeMatchSummary gauntlet', () => {
    (0, vitest_1.it)('returns gauntlet summary with no CP', () => {
        const gs = makeGameState({
            settings: makeSettings({ isGauntlet: true }),
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.isGauntlet).toBe(true);
        (0, vitest_1.expect)(summary.cp.totalCp).toBe(0);
        (0, vitest_1.expect)(summary.rivalDelta).toBeNull();
        (0, vitest_1.expect)(summary.accoladeUnlocks).toHaveLength(0);
    });
    (0, vitest_1.it)('detects gauntlet new high score', () => {
        const gs = makeGameState({
            settings: makeSettings({ isGauntlet: true }),
        });
        // Human tileHistory has 6 entries, gauntletHighScore is 10 → not new
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.gauntletTilesSurvived).toBe(6);
        (0, vitest_1.expect)(summary.gauntletNewHighScore).toBe(false);
        // Now with low high score
        const profile = makeProfile({ gauntletHighScore: 3 });
        const summary2 = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs, profile }));
        (0, vitest_1.expect)(summary2.gauntletNewHighScore).toBe(true);
    });
});
// ─── Daily Challenge ────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeMatchSummary daily', () => {
    (0, vitest_1.it)('detects daily challenge when seed matches dailySeed', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ dailySeed: 'test-seed-42' }));
        (0, vitest_1.expect)(summary.isDaily).toBe(true);
    });
    (0, vitest_1.it)('marks new daily best correctly', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({
            dailySeed: 'test-seed-42',
            currentDailyBest: null,
        }));
        (0, vitest_1.expect)(summary.dailyIsNewBest).toBe(true);
        (0, vitest_1.expect)(summary.dailyPersonalBest).toBe(80); // humanPlayer.position
    });
    (0, vitest_1.it)('does not mark new best when existing is higher', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({
            dailySeed: 'test-seed-42',
            currentDailyBest: 95,
        }));
        (0, vitest_1.expect)(summary.dailyIsNewBest).toBe(false);
        (0, vitest_1.expect)(summary.dailyPersonalBest).toBe(95); // existing best preserved
    });
});
// ─── Local/Online Parity ────────────────────────────────────────────────────
(0, vitest_1.describe)('local/online parity', () => {
    (0, vitest_1.it)('produces identical summaries for local and online given same game state', () => {
        const baseInput = makeInput();
        const localSummary = (0, matchSummary_1.computeMatchSummary)({ ...baseInput, mode: 'local' });
        const onlineSummary = (0, matchSummary_1.computeMatchSummary)({ ...baseInput, mode: 'online' });
        // Core rewards must be identical
        (0, vitest_1.expect)(localSummary.cp.totalCp).toBe(onlineSummary.cp.totalCp);
        (0, vitest_1.expect)(localSummary.streakDelta).toEqual(onlineSummary.streakDelta);
        (0, vitest_1.expect)(localSummary.rivalDelta).toEqual(onlineSummary.rivalDelta);
        (0, vitest_1.expect)(localSummary.accoladeUnlocks).toEqual(onlineSummary.accoladeUnlocks);
        (0, vitest_1.expect)(localSummary.contractOutcomes).toEqual(onlineSummary.contractOutcomes);
        (0, vitest_1.expect)(localSummary.sponsorshipDeltas).toEqual(onlineSummary.sponsorshipDeltas);
        (0, vitest_1.expect)(localSummary.standings).toEqual(onlineSummary.standings);
        // Mode differs
        (0, vitest_1.expect)(localSummary.mode).toBe('local');
        (0, vitest_1.expect)(onlineSummary.mode).toBe('online');
    });
    (0, vitest_1.it)('applies contracts and accolades identically for both modes', () => {
        const contract = {
            corporationId: types_1.CorporationId.Cyberex,
            objectives: [
                { type: 'FINISH_RACE_IN_POS', description: 'Top 2', targetValue: 2, isComplete: false },
            ],
            cpReward: 25,
            repReward: 5,
        };
        const baseInput = makeInput({ contracts: [contract] });
        const localSummary = (0, matchSummary_1.computeMatchSummary)({ ...baseInput, mode: 'local' });
        const onlineSummary = (0, matchSummary_1.computeMatchSummary)({ ...baseInput, mode: 'online' });
        (0, vitest_1.expect)(localSummary.contractOutcomes[0].allComplete).toBe(onlineSummary.contractOutcomes[0].allComplete);
        (0, vitest_1.expect)(localSummary.cp.contractCp).toBe(onlineSummary.cp.contractCp);
        (0, vitest_1.expect)(localSummary.accoladeUnlocks).toEqual(onlineSummary.accoladeUnlocks);
    });
});
// ─── Idempotent Profile Application ─────────────────────────────────────────
(0, vitest_1.describe)('applyMatchSummaryToProfile', () => {
    (0, vitest_1.it)('applies CP, streak, rival W/L, accolades, sponsorships', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        const profile = makeProfile();
        const updated = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(updated).not.toBeNull();
        (0, vitest_1.expect)(updated.circuitPoints).toBe(profile.circuitPoints + summary.cp.totalCp);
        (0, vitest_1.expect)(updated.winStreak).toBe(summary.streakDelta.newStreak);
        (0, vitest_1.expect)(updated.rivalData.wins).toBe(profile.rivalData.wins + (summary.rivalDelta?.wins ?? 0));
        (0, vitest_1.expect)(updated.rivalData.losses).toBe(profile.rivalData.losses + (summary.rivalDelta?.losses ?? 0));
        for (const accolade of summary.accoladeUnlocks) {
            (0, vitest_1.expect)(updated.unlockedAccolades).toContain(accolade);
        }
    });
    (0, vitest_1.it)('returns null on second application (idempotency)', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        const profile = makeProfile();
        const first = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(first).not.toBeNull();
        const second = (0, matchSummary_1.applyMatchSummaryToProfile)(first, summary);
        (0, vitest_1.expect)(second).toBeNull(); // Already applied
    });
    (0, vitest_1.it)('tracks matchId in appliedMatchIds', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        const profile = makeProfile();
        const updated = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(updated.appliedMatchIds).toContain(summary.matchId);
    });
    (0, vitest_1.it)('bounds appliedMatchIds to prevent unbounded growth', () => {
        const profile = makeProfile({
            appliedMatchIds: Array.from({ length: 60 }, (_, i) => `old-match-${i}`),
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        const updated = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(updated.appliedMatchIds.length).toBeLessThanOrEqual(50);
        (0, vitest_1.expect)(updated.appliedMatchIds).toContain(summary.matchId);
    });
    (0, vitest_1.it)('does not mutate the original profile', () => {
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput());
        const profile = makeProfile();
        const originalCp = profile.circuitPoints;
        const originalWins = profile.rivalData.wins;
        (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(profile.circuitPoints).toBe(originalCp);
        (0, vitest_1.expect)(profile.rivalData.wins).toBe(originalWins);
    });
    (0, vitest_1.it)('applies gauntlet high score update', () => {
        const gs = makeGameState({ settings: makeSettings({ isGauntlet: true }) });
        const profile = makeProfile({ gauntletHighScore: 3 });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs, profile }));
        const updated = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(updated.gauntletHighScore).toBe(6); // 6 tiles survived
    });
    (0, vitest_1.it)('does NOT lower gauntlet high score', () => {
        const gs = makeGameState({ settings: makeSettings({ isGauntlet: true }) });
        const profile = makeProfile({ gauntletHighScore: 20 });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs, profile }));
        const updated = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        (0, vitest_1.expect)(updated.gauntletHighScore).toBe(20); // Not lowered
    });
    (0, vitest_1.it)('applies sponsorship reputation from contracts and sponsored tiles', () => {
        const tiles = makeTiles(6);
        tiles[0] = { ...tiles[0], modifier: 'SPONSORED', sponsoringCorp: types_1.CorporationId.Cyberex };
        const gs = makeGameState({ run: tiles });
        const contract = {
            corporationId: types_1.CorporationId.Rogue,
            objectives: [{ type: 'FINISH_RACE_IN_POS', description: 'Top 4', targetValue: 4, isComplete: false }],
            cpReward: 10,
            repReward: 7,
        };
        const profile = makeProfile();
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs, contracts: [contract], profile }));
        const updated = (0, matchSummary_1.applyMatchSummaryToProfile)(profile, summary);
        // Rogue rep should increase by 7 (contract)
        (0, vitest_1.expect)(updated.sponsorships[types_1.CorporationId.Rogue].reputation).toBe(profile.sponsorships[types_1.CorporationId.Rogue].reputation + 7);
        // Cyberex rep should increase (sponsored tile)
        (0, vitest_1.expect)(updated.sponsorships[types_1.CorporationId.Cyberex].reputation).toBeGreaterThan(profile.sponsorships[types_1.CorporationId.Cyberex].reputation);
    });
});
// ─── Edge Cases ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)('edge cases', () => {
    (0, vitest_1.it)('handles race with no rival gracefully', () => {
        const gs = makeGameState({
            players: [
                makePlayer(),
                makeBotPlayer(2, 60),
                makeBotPlayer(3, 50),
                makeBotPlayer(4, 40),
            ],
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.rivalDelta).toBeNull();
        (0, vitest_1.expect)(summary.streakDelta.newStreak).toBe(0); // No rival defeat = streak reset
    });
    (0, vitest_1.it)('handles empty tile history', () => {
        const gs = makeGameState({
            players: [
                makePlayer({ tileHistory: [] }),
                makeRivalPlayer({ tileHistory: [] }),
                makeBotPlayer(3, 50),
                makeBotPlayer(4, 40),
            ],
        });
        const summary = (0, matchSummary_1.computeMatchSummary)(makeInput({ gameState: gs }));
        (0, vitest_1.expect)(summary.cp.stars).toBe(0);
    });
    (0, vitest_1.it)('determinism: same input produces same output', () => {
        const input = makeInput();
        const s1 = (0, matchSummary_1.computeMatchSummary)(input);
        const s2 = (0, matchSummary_1.computeMatchSummary)(input);
        (0, vitest_1.expect)(s1).toEqual(s2);
    });
});
//# sourceMappingURL=matchSummary.test.js.map
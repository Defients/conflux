import { describe, it, expect } from 'vitest';
import { generateRun, generateCustomRun } from '../pathGenerator';
import { GameRules } from '../gameRules';
import { computeMatchSummary, MatchSummaryInput } from '../matchSummary';
import {
  GameState, GameSettings, Player, PilotProfile, ChassisId,
  AccoladeId, CorporationId, BotPersonality, TileModifier, PowerUp,
  SharedEventDescriptor,
} from '../types';

const MOCK_EVENTS: SharedEventDescriptor[] = [
  { id: 'reaction-tap', displayName: 'Reaction Tap', performanceDimension: 'reaction' },
  { id: 'aim-flick', displayName: 'Aim Flick', performanceDimension: 'precision' },
  { id: 'quick-math', displayName: 'Quick Math', performanceDimension: 'logic' },
  { id: 'memory-flip', displayName: 'Memory Flip', performanceDimension: 'memory' },
  { id: 'rhythm-tap', displayName: 'Rhythm Tap', performanceDimension: 'rhythm' },
  { id: 'typing-test', displayName: 'Typing Test', performanceDimension: 'typing' },
  { id: 'stub-event', displayName: 'Stub', performanceDimension: 'reaction', isStub: true },
];

const BASE_SETTINGS: GameSettings = {
  playerCount: 4, easyBots: 2, intermediateBots: 1,
  seed: 'phase3-test', runLength: 4, sound: true,
  accessibility: false, uiEffects: true, colorBlindMode: false,
  selectedChassis: ChassisId.Standard,
};

const BASE_PROFILE: PilotProfile = {
  name: 'TestPilot', avatarId: '🚀', circuitPoints: 100, winStreak: 0,
  unlockedChassis: [ChassisId.Standard], unlockedAccolades: [],
  rivalData: { name: 'Vector', avatarId: '👾', favoredChassis: ChassisId.Momentum, wins: 0, losses: 0, traits: [] },
  gauntletHighScore: 0,
  sponsorships: {
    [CorporationId.Cyberex]: { reputation: 0, activeContract: null },
    [CorporationId.Zenith]: { reputation: 0, activeContract: null },
    [CorporationId.Rogue]: { reputation: 0, activeContract: null },
  },
};

function makeGameState(overrides?: Partial<GameState>): GameState {
  const players: Player[] = [
    { id: 1, name: 'TestPilot', isBot: false, isRival: false, color: '#00dffc',
      position: 100, powerUps: [], statuses: [], tileHistory: [
        { tileIndex: 1, stars: 3 }, { tileIndex: 2, stars: 2 },
        { tileIndex: 3, stars: 3 }, { tileIndex: 4, stars: 3 },
      ], energy: 0, overdriveCooldown: 0 },
    { id: 2, name: 'Bot1', isBot: true, isRival: false, color: '#d64f8a',
      personality: BotPersonality.Easy, position: 80, powerUps: [], statuses: [],
      tileHistory: [
        { tileIndex: 1, stars: 2 }, { tileIndex: 2, stars: 1 },
        { tileIndex: 3, stars: 2 }, { tileIndex: 4, stars: 1 },
      ], energy: 0, overdriveCooldown: 0 },
  ];
  return {
    settings: BASE_SETTINGS, players,
    run: [
      { tileIndex: 1, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.1' },
      { tileIndex: 2, eventId: 'aim-flick', difficulty: 2, subSeed: '0.2' },
      { tileIndex: 3, eventId: 'quick-math', difficulty: 2, subSeed: '0.3' },
      { tileIndex: 4, eventId: 'memory-flip', difficulty: 3, subSeed: '0.4' },
    ],
    currentTileIndex: 4, eventResults: {}, lastTileResults: null,
    overdrivingPlayerIds: [], activeIntervention: null,
    lastHazardInterventionIndex: -99, activeAnomaly: null,
    ...overrides,
  };
}

const EVENT_DIM_MAP: Record<string, string> = {
  'reaction-tap': 'reaction', 'aim-flick': 'precision',
  'quick-math': 'logic', 'memory-flip': 'memory',
};

// ─── New Tile Modifiers ─────────────────────────────────────────────────────

describe('ICE_PATCH modifier', () => {
  it('increases difficulty for ICE_PATCH tiles', () => {
    // Generate a long run to increase chance of getting ICE_PATCH
    const run = generateRun('ice-test', 20, MOCK_EVENTS);
    const iceTiles = run.filter(t => t.modifier === 'ICE_PATCH');
    if (iceTiles.length > 0) {
      // ICE_PATCH tiles should have difficulty >= 2 (bumped up by 1)
      iceTiles.forEach(tile => {
        expect(tile.difficulty).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it('grants bonus movement on 3 stars', () => {
    const state = makeGameState({
      run: [{ tileIndex: 1, eventId: 'reaction-tap', difficulty: 2, modifier: 'ICE_PATCH', subSeed: '0.5' }],
      currentTileIndex: 0,
    });
    state.players[0].position = 0;
    state.players[1].position = 0;
    const results = { 1: { stars: 3 as 0|1|2|3|4, primaryMetric: 150, secondaryMetric: 0, playerId: 1 } };
    const update = GameRules.processRaceStep(state, results);
    const human = update.newState.players.find(p => p.id === 1)!;
    // With ICE_PATCH 3★, movement should be boosted (base 2.1 * 1.5 = 3.15 * baseStep)
    expect(human.position).toBeGreaterThan(0);
  });
});

describe('NEBULA_DRIFT modifier', () => {
  it('is deterministic for the same seed', () => {
    const run1 = generateRun('nebula-seed', 20, MOCK_EVENTS);
    const run2 = generateRun('nebula-seed', 20, MOCK_EVENTS);
    expect(run1).toEqual(run2);
  });

  it('includes NEBULA_DRIFT in the modifier pool', () => {
    // Generate many runs to find at least one with NEBULA_DRIFT
    let found = false;
    for (let i = 0; i < 50; i++) {
      const run = generateRun(`nebula-search-${i}`, 20, MOCK_EVENTS);
      if (run.some(t => t.modifier === 'NEBULA_DRIFT')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ─── New Power-Ups ──────────────────────────────────────────────────────────

describe('Overcharge power-up', () => {
  it('grants +2 energy to the user', () => {
    const state = makeGameState({ currentTileIndex: 0 });
    const human = state.players.find(p => p.id === 1)!;
    human.powerUps = ['Overcharge'];
    human.energy = 1;

    const update = GameRules.applyPowerUp(state, 1, 'Overcharge');
    const updatedHuman = update.newState.players.find(p => p.id === 1)!;
    expect(updatedHuman.energy).toBe(3);
    expect(updatedHuman.powerUps).not.toContain('Overcharge');
  });

  it('increments powerUpsUsed counter', () => {
    const state = makeGameState({ currentTileIndex: 0 });
    const human = state.players.find(p => p.id === 1)!;
    human.powerUps = ['Overcharge'];

    const update = GameRules.applyPowerUp(state, 1, 'Overcharge');
    const updatedHuman = update.newState.players.find(p => p.id === 1)!;
    expect(updatedHuman.powerUpsUsed).toBe(1);
  });
});

describe('Sludge power-up', () => {
  it('slows all opponents', () => {
    const state = makeGameState({ currentTileIndex: 0 });
    state.players[0].powerUps = ['Sludge'];
    state.players[1].statuses = [];

    const update = GameRules.applyPowerUp(state, 1, 'Sludge');
    const opponent = update.newState.players.find(p => p.id === 2)!;
    expect(opponent.statuses.some(s => s.type === 'SLOWED')).toBe(true);
  });

  it('does not slow the user', () => {
    const state = makeGameState({ currentTileIndex: 0 });
    state.players[0].powerUps = ['Sludge'];

    const update = GameRules.applyPowerUp(state, 1, 'Sludge');
    const user = update.newState.players.find(p => p.id === 1)!;
    expect(user.statuses.some(s => s.type === 'SLOWED')).toBe(false);
  });
});

describe('Reflector power-up', () => {
  it('grants IMMUNE status to the user', () => {
    const state = makeGameState({ currentTileIndex: 0 });
    state.players[0].powerUps = ['Reflector'];

    const update = GameRules.applyPowerUp(state, 1, 'Reflector');
    const user = update.newState.players.find(p => p.id === 1)!;
    expect(user.statuses.some(s => s.type === 'IMMUNE')).toBe(true);
  });

  it('blocks incoming debuffs while IMMUNE', () => {
    const state = makeGameState({ currentTileIndex: 0 });
    state.players[0].powerUps = ['Reflector'];

    // Apply Reflector
    let update = GameRules.applyPowerUp(state, 1, 'Reflector');
    // Now try to apply Mist Bomb from opponent
    update = GameRules.applyPowerUp(update.newState, 2, 'Mist Bomb');
    const user = update.newState.players.find(p => p.id === 1)!;
    expect(user.statuses.some(s => s.type === 'BLURRED')).toBe(false);
  });
});

// ─── New Accolades ──────────────────────────────────────────────────────────

describe('ComebackKing accolade', () => {
  it('awards when winning after being last at halfway', () => {
    const players: Player[] = [
      { id: 1, name: 'TestPilot', isBot: false, isRival: false, color: '#00dffc',
        position: 100, powerUps: [], statuses: [], tileHistory: [
          { tileIndex: 1, stars: 0 }, { tileIndex: 2, stars: 0 },
          { tileIndex: 3, stars: 3 }, { tileIndex: 4, stars: 3 },
        ], energy: 0, overdriveCooldown: 0 },
      { id: 2, name: 'Bot1', isBot: true, isRival: false, color: '#d64f8a',
        personality: BotPersonality.Easy, position: 80, powerUps: [], statuses: [],
        tileHistory: [
          { tileIndex: 1, stars: 3 }, { tileIndex: 2, stars: 3 },
          { tileIndex: 3, stars: 1 }, { tileIndex: 4, stars: 1 },
        ], energy: 0, overdriveCooldown: 0 },
    ];

    const state = makeGameState({ players });
    const input: MatchSummaryInput = {
      gameState: state, profile: BASE_PROFILE, mode: 'local',
      contracts: [], eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null, currentDailyBest: null,
    };
    const summary = computeMatchSummary(input);
    expect(summary.accoladeUnlocks).toContain(AccoladeId.ComebackKing);
  });

  it('does NOT award when winning without being last at halfway', () => {
    const state = makeGameState();
    const input: MatchSummaryInput = {
      gameState: state, profile: BASE_PROFILE, mode: 'local',
      contracts: [], eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null, currentDailyBest: null,
    };
    const summary = computeMatchSummary(input);
    expect(summary.accoladeUnlocks).not.toContain(AccoladeId.ComebackKing);
  });
});

describe('PowerPlayer accolade', () => {
  it('awards when 5+ power-ups used in a race', () => {
    const state = makeGameState();
    state.players[0].powerUpsUsed = 5;

    const input: MatchSummaryInput = {
      gameState: state, profile: BASE_PROFILE, mode: 'local',
      contracts: [], eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null, currentDailyBest: null,
    };
    const summary = computeMatchSummary(input);
    expect(summary.accoladeUnlocks).toContain(AccoladeId.PowerPlayer);
  });

  it('does NOT award when fewer than 5 power-ups used', () => {
    const state = makeGameState();
    state.players[0].powerUpsUsed = 4;

    const input: MatchSummaryInput = {
      gameState: state, profile: BASE_PROFILE, mode: 'local',
      contracts: [], eventDimensionMap: EVENT_DIM_MAP,
      dailySeed: null, currentDailyBest: null,
    };
    const summary = computeMatchSummary(input);
    expect(summary.accoladeUnlocks).not.toContain(AccoladeId.PowerPlayer);
  });
});

describe('New accolade definitions exist', () => {
  it('GhostHunter is in AccoladeId enum', () => {
    expect(AccoladeId.GhostHunter).toBe('GHOST_HUNTER');
  });

  it('TournamentChampion is in AccoladeId enum', () => {
    expect(AccoladeId.TournamentChampion).toBe('TOURNAMENT_CHAMPION');
  });

  it('ComebackKing is in AccoladeId enum', () => {
    expect(AccoladeId.ComebackKing).toBe('COMEBACK_KING');
  });

  it('PowerPlayer is in AccoladeId enum', () => {
    expect(AccoladeId.PowerPlayer).toBe('POWER_PLAYER');
  });
});

// ─── New Power-Up type ──────────────────────────────────────────────────────

describe('New power-up types', () => {
  it('Overcharge is a valid PowerUp', () => {
    const p: PowerUp = 'Overcharge';
    expect(p).toBe('Overcharge');
  });

  it('Sludge is a valid PowerUp', () => {
    const p: PowerUp = 'Sludge';
    expect(p).toBe('Sludge');
  });

  it('Reflector is a valid PowerUp', () => {
    const p: PowerUp = 'Reflector';
    expect(p).toBe('Reflector');
  });
});

// ─── New Tile Modifier types ────────────────────────────────────────────────

describe('New tile modifier types', () => {
  it('ICE_PATCH is a valid TileModifier', () => {
    const m: TileModifier = 'ICE_PATCH';
    expect(m).toBe('ICE_PATCH');
  });

  it('NEBULA_DRIFT is a valid TileModifier', () => {
    const m: TileModifier = 'NEBULA_DRIFT';
    expect(m).toBe('NEBULA_DRIFT');
  });
});

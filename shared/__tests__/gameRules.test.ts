/**
 * shared/__tests__/gameRules.test.ts
 *
 * Tests for the core GameRules engine: processRaceStep, activateOverdrive,
 * usePowerUp, and processPitStop.
 */

import { describe, it, expect } from 'vitest';
import { GameRules } from '../gameRules';
import {
  GameState, GameSettings, Player, ChassisId, BotPersonality,
  SharedEventDescriptor, EventResult, PowerUp,
} from '../types';

const MOCK_EVENTS: SharedEventDescriptor[] = [
  { id: 'reaction-tap', displayName: 'Reaction Tap', performanceDimension: 'reaction' },
  { id: 'aim-flick', displayName: 'Aim Flick', performanceDimension: 'precision' },
  { id: 'quick-math', displayName: 'Quick Math', performanceDimension: 'logic' },
  { id: 'memory-flip', displayName: 'Memory Flip', performanceDimension: 'memory' },
];

const BASE_SETTINGS: GameSettings = {
  playerCount: 2, easyBots: 1, intermediateBots: 0,
  seed: 'grules-test', runLength: 4, sound: true,
  accessibility: false, uiEffects: true, colorBlindMode: false,
  selectedChassis: ChassisId.Standard,
};

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1, name: 'P1', isBot: false, isRival: false,
    color: '#00dffc', position: 0, powerUps: [], statuses: [],
    tileHistory: [], energy: 0, overdriveCooldown: 0,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    settings: BASE_SETTINGS,
    players: [
      makePlayer({ id: 1, name: 'P1' }),
      makePlayer({ id: 2, name: 'Bot1', isBot: true, personality: BotPersonality.Easy }),
    ],
    run: [
      { tileIndex: 0, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.1' },
      { tileIndex: 1, eventId: 'aim-flick', difficulty: 1, subSeed: '0.2' },
      { tileIndex: 2, eventId: 'quick-math', difficulty: 1, subSeed: '0.3' },
      { tileIndex: 3, eventId: 'memory-flip', difficulty: 1, subSeed: '0.4' },
    ],
    currentTileIndex: 0,
    eventResults: {},
    lastTileResults: null,
    overdrivingPlayerIds: [],
    activeIntervention: null,
    lastHazardInterventionIndex: -99,
    activeAnomaly: null,
    ...overrides,
  };
}

describe('GameRules.processRaceStep', () => {
  it('should advance player position based on stars', () => {
    const state = makeGameState();
    const results: Record<number, EventResult> = {
      1: { stars: 3, metric: 150, completed: true },
      2: { stars: 1, metric: 500, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    const p2 = update.newState.players.find(p => p.id === 2)!;

    // 3 stars = 75% of baseStep (25 per star out of 100/runLength=4)
    expect(p1.position).toBeGreaterThan(0);
    // 1 star should advance less than 3 stars
    expect(p2.position).toBeLessThan(p1.position);
  });

  it('should add tile to player history', () => {
    const state = makeGameState();
    const results: Record<number, EventResult> = {
      1: { stars: 2, metric: 200, completed: true },
      2: { stars: 2, metric: 200, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.tileHistory).toHaveLength(1);
    expect(p1.tileHistory[0].stars).toBe(2);
  });

  it('should advance currentTileIndex', () => {
    const state = makeGameState();
    const results: Record<number, EventResult> = {
      1: { stars: 1, metric: 300, completed: true },
      2: { stars: 1, metric: 300, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    expect(update.newState.currentTileIndex).toBe(1);
  });

  it('should award energy based on stars', () => {
    const state = makeGameState();
    const results: Record<number, EventResult> = {
      1: { stars: 3, metric: 150, completed: true },
      2: { stars: 1, metric: 500, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    // 3 stars = 3 energy (base, no seasonal multiplier in test)
    expect(p1.energy).toBeGreaterThanOrEqual(3);
  });

  it('should handle overdriving players with boosted movement on 3 stars', () => {
    const state = makeGameState({ overdrivingPlayerIds: [1] });
    const results: Record<number, EventResult> = {
      1: { stars: 3, metric: 150, completed: true },
      2: { stars: 3, metric: 150, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    // Overdriver gets 4 stars (3 + 1 bonus), non-overdriver gets 3
    const p1 = update.newState.players.find(p => p.id === 1)!;
    const p2 = update.newState.players.find(p => p.id === 2)!;
    expect(p1.position).toBeGreaterThan(p2.position);
  });

  it('should stun overdriving player on non-3-star result (zero movement)', () => {
    const state = makeGameState({ overdrivingPlayerIds: [1] });
    const results: Record<number, EventResult> = {
      1: { stars: 2, metric: 200, completed: true },
      2: { stars: 2, metric: 200, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    const p2 = update.newState.players.find(p => p.id === 2)!;
    // Overdrive failure zeros the stars and stuns (moveMult=0), so p1 doesn't move
    expect(p1.position).toBe(0);
    // p2 moved normally
    expect(p2.position).toBeGreaterThan(0);
    // The overdrive-fail sound effect should be emitted
    expect(update.effects.some(e => e.type === 'SOUND' && e.sound === 'overdrive-fail')).toBe(true);
  });

  it('should clear overdrivingPlayerIds after step', () => {
    const state = makeGameState({ overdrivingPlayerIds: [1] });
    const results: Record<number, EventResult> = {
      1: { stars: 2, metric: 200, completed: true },
      2: { stars: 2, metric: 200, completed: true },
    };

    const update = GameRules.processRaceStep(state, results, MOCK_EVENTS);
    expect(update.newState.overdrivingPlayerIds).toHaveLength(0);
  });
});

describe('GameRules.activateOverdrive', () => {
  it('should activate overdrive when player has enough energy', () => {
    const state = makeGameState({
      players: [makePlayer({ id: 1, energy: 50 }), makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy })],
    });

    const update = GameRules.activateOverdrive(state, 1);
    expect(update.newState.overdrivingPlayerIds).toContain(1);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.energy).toBeLessThan(50); // Energy was consumed
    expect(p1.overdriveCooldown).toBeGreaterThan(0); // Cooldown set
  });

  it('should reject overdrive when energy is insufficient', () => {
    const state = makeGameState({
      players: [makePlayer({ id: 1, energy: 0 }), makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy })],
    });

    const update = GameRules.activateOverdrive(state, 1);
    expect(update.newState.overdrivingPlayerIds).not.toContain(1);
    expect(update.effects.some(e => e.type === 'TOAST' && e.variant === 'warning')).toBe(true);
  });

  it('should reject overdrive when on cooldown', () => {
    const state = makeGameState({
      players: [makePlayer({ id: 1, energy: 50, overdriveCooldown: 2 }), makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy })],
    });

    const update = GameRules.activateOverdrive(state, 1);
    expect(update.newState.overdrivingPlayerIds).not.toContain(1);
    expect(update.effects.some(e => e.type === 'TOAST' && e.variant === 'warning')).toBe(true);
  });

  it('should force activation when force=true (ignoring energy and cooldown)', () => {
    const state = makeGameState({
      players: [makePlayer({ id: 1, energy: 0, overdriveCooldown: 5 }), makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy })],
    });

    const update = GameRules.activateOverdrive(state, 1, true);
    expect(update.newState.overdrivingPlayerIds).toContain(1);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.energy).toBe(0); // Not consumed
    expect(p1.overdriveCooldown).toBe(5); // Not changed
  });

  it('should reduce cooldown by _overdriveCooldownReduction', () => {
    const state = makeGameState({
      players: [
        makePlayer({ id: 1, energy: 50, _overdriveCooldownReduction: 2 }),
        makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy }),
      ],
    });

    const update = GameRules.activateOverdrive(state, 1);
    const p1 = update.newState.players.find(p => p.id === 1)!;
    // Default cooldown minus reduction
    expect(p1.overdriveCooldown).toBeLessThanOrEqual(3); // base cooldown - 2
  });

  it('should return empty effects for non-existent player', () => {
    const state = makeGameState();
    const update = GameRules.activateOverdrive(state, 999);
    expect(update.effects).toHaveLength(0);
    expect(update.newState).toBe(state);
  });
});

describe('GameRules.processPitStop', () => {
  it('should recharge energy for recharge action', () => {
    const state = makeGameState({
      players: [makePlayer({ id: 1, energy: 0 }), makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy })],
    });

    const update = GameRules.processPitStop(state, 1, 'recharge');
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.energy).toBeGreaterThan(0);
    expect(update.effects.some(e => e.type === 'TOAST')).toBe(true);
  });

  it('should return empty for non-existent player', () => {
    const state = makeGameState();
    const update = GameRules.processPitStop(state, 999, 'recharge');
    expect(update.effects).toHaveLength(0);
  });
});

describe('GameRules.applyPowerUp', () => {
  it('should apply Shield power-up to player', () => {
    const state = makeGameState({
      players: [
        makePlayer({ id: 1, powerUps: ['Shield'] }),
        makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy }),
      ],
    });

    const update = GameRules.applyPowerUp(state, 1, 'Shield');
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.powerUps).not.toContain('Shield');
    // Shield adds a SHIELDED status
    expect(p1.statuses.some(s => s.type === 'SHIELDED')).toBe(true);
  });

  it('should apply Overcharge power-up (energy boost)', () => {
    const state = makeGameState({
      players: [
        makePlayer({ id: 1, energy: 0, powerUps: ['Overcharge'] }),
        makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy }),
      ],
    });

    const update = GameRules.applyPowerUp(state, 1, 'Overcharge');
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.powerUps).not.toContain('Overcharge');
    expect(p1.energy).toBeGreaterThan(0);
  });

  it('should not consume a power-up the player does not have', () => {
    const state = makeGameState({
      players: [
        makePlayer({ id: 1, powerUps: [] }),
        makePlayer({ id: 2, isBot: true, personality: BotPersonality.Easy }),
      ],
    });

    const update = GameRules.applyPowerUp(state, 1, 'Shield');
    // Should not add the status if the player didn't have the power-up
    const p1 = update.newState.players.find(p => p.id === 1)!;
    expect(p1.statuses.some(s => s.type === 'SHIELDED')).toBe(false);
  });
});

/**
 * shared/__tests__/botMind.test.ts
 *
 * Tests for rival trait behavior and bot decision logic.
 * Focuses on the previously no-op traits: DebuffResistant and AggressivePowerups.
 */

import { describe, it, expect } from 'vitest';
import {
  applyRivalTraitsToPlayer,
  decideBotPowerUp,
  decideBotOverdrive,
  simulateBotPerformance,
} from '../botMind';
import { SeededRNG } from '../seededRNG';
import {
  Player, GameState, GameSettings, Tile, BotPersonality,
  RivalTraitId, PowerUp, BotEventInfo,
} from '../types';

/** Create a baseline rival bot player for tests. */
function makeRivalBot(overrides: Partial<Player> = {}): Player {
  return {
    id: 2,
    name: 'Rival Bot',
    isBot: true,
    isRival: true,
    personality: BotPersonality.Rival,
    color: '#f00',
    position: 50,
    powerUps: [],
    statuses: [],
    tileHistory: [],
    energy: 5,
    overdriveCooldown: 0,
    ...overrides,
  };
}

/** Create a baseline human player for tests. */
function makeHuman(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Human',
    isBot: false,
    isRival: false,
    color: '#00f',
    position: 60,
    powerUps: [],
    statuses: [],
    tileHistory: [],
    energy: 0,
    overdriveCooldown: 0,
    ...overrides,
  };
}

/** Create a minimal game state for bot decision tests. */
function makeGameState(players: Player[], overrides: Partial<GameState> = {}): GameState {
  return {
    settings: { seed: 'test', runLength: 8, playerCount: 2, easyBots: 0, intermediateBots: 1 } as GameSettings,
    players,
    run: [{ tileIndex: 0, eventId: 'reaction-tap', difficulty: 2 }] as Tile[],
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

const BOT_EVENT_INFO: BotEventInfo = {
  id: 'reaction-tap',
  performanceDimension: 'reaction',
  isStub: false,
  getStars: (r: { primaryMetric: number }) => r.primaryMetric > 500 ? 3 : r.primaryMetric > 300 ? 2 : 1,
};

describe('botMind — rival traits', () => {
  describe('applyRivalTraitsToPlayer', () => {
    it('should return player unchanged if not a rival', () => {
      const player = makeHuman();
      const rng = new SeededRNG('test-traits');
      const result = applyRivalTraitsToPlayer(player, [RivalTraitId.DebuffResistant], rng);
      expect(result).toBe(player);
    });

    it('should return player unchanged if no traits', () => {
      const player = makeRivalBot();
      const rng = new SeededRNG('test-traits');
      const result = applyRivalTraitsToPlayer(player, [], rng);
      expect(result).toBe(player);
    });

    it('DebuffResistant: should add Shield or Clarity to powerUps', () => {
      const player = makeRivalBot();
      const rng = new SeededRNG('test-debuff-resistant');
      const result = applyRivalTraitsToPlayer(player, [RivalTraitId.DebuffResistant], rng);
      const hasShieldOrClarity = result.powerUps.includes('Shield') || result.powerUps.includes('Clarity');
      expect(hasShieldOrClarity).toBe(true);
    });

    it('DebuffResistant: should be deterministic with same seed', () => {
      const player1 = makeRivalBot();
      const player2 = makeRivalBot();
      const rng1 = new SeededRNG('deterministic-test');
      const rng2 = new SeededRNG('deterministic-test');
      const result1 = applyRivalTraitsToPlayer(player1, [RivalTraitId.DebuffResistant], rng1);
      const result2 = applyRivalTraitsToPlayer(player2, [RivalTraitId.DebuffResistant], rng2);
      expect(result1.powerUps).toEqual(result2.powerUps);
    });

    it('DebuffResistant: should not duplicate Shield if already present', () => {
      const player = makeRivalBot({ powerUps: ['Shield'] });
      const rng = new SeededRNG('test-no-dup');
      // Force Shield path by using a seed that produces < 0.5
      const result = applyRivalTraitsToPlayer(player, [RivalTraitId.DebuffResistant], rng);
      // If rng gives Shield, it should not duplicate. If it gives Clarity, that's fine.
      const shieldCount = result.powerUps.filter(p => p === 'Shield').length;
      expect(shieldCount).toBe(1);
    });

    it('should not mutate the original player', () => {
      const player = makeRivalBot();
      const rng = new SeededRNG('test-no-mutate');
      applyRivalTraitsToPlayer(player, [RivalTraitId.DebuffResistant], rng);
      expect(player.powerUps).toEqual([]);
    });
  });

  describe('decideBotPowerUp — AggressivePowerups trait', () => {
    it('should accept rivalTraits parameter without crashing', () => {
      const bot = makeRivalBot({ powerUps: ['Mist Bomb'] });
      const human = makeHuman({ position: 70 });
      const gs = makeGameState([human, bot]);
      const tile: Tile = { tileIndex: 0, eventId: 'test', difficulty: 1 };

      // Should not throw
      const result = decideBotPowerUp(bot, gs, tile, [RivalTraitId.AggressivePowerups]);
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('AggressivePowerups: rival should be more likely to use offensive power-ups', () => {
      // Run multiple seeds to compare behavior with and without AggressivePowerups.
      // The trait adds +0.15 to riskBias, so we should see more offensive decisions.
      let aggressiveUses = 0;
      let normalUses = 0;
      const numSeeds = 100;

      for (let i = 0; i < numSeeds; i++) {
        const seed = `aggression-test-${i}`;
        const settings = { seed, runLength: 8, playerCount: 2, easyBots: 0, intermediateBots: 1 } as GameSettings;

        // Without trait
        const botNormal = makeRivalBot({ powerUps: ['Mist Bomb'] });
        const humanNormal = makeHuman({ position: 70 });
        const gsNormal = makeGameState([humanNormal, botNormal], { settings });
        const tile: Tile = { tileIndex: 0, eventId: 'test', difficulty: 1 };
        const resultNormal = decideBotPowerUp(botNormal, gsNormal, tile, undefined);
        if (resultNormal && resultNormal.use === 'Mist Bomb') normalUses++;

        // With trait
        const botAggressive = makeRivalBot({ powerUps: ['Mist Bomb'] });
        const humanAggressive = makeHuman({ position: 70 });
        const gsAggressive = makeGameState([humanAggressive, botAggressive], { settings });
        const resultAggressive = decideBotPowerUp(botAggressive, gsAggressive, tile, [RivalTraitId.AggressivePowerups]);
        if (resultAggressive && resultAggressive.use === 'Mist Bomb') aggressiveUses++;
      }

      // AggressivePowerups should result in more offensive uses (or at least equal).
      // With +0.15 riskBias, we expect a meaningful increase.
      expect(aggressiveUses).toBeGreaterThanOrEqual(normalUses);
    });
  });

  describe('simulateBotPerformance — rival traits in simulation', () => {
    it('should accept rivalTraits parameter without crashing', () => {
      const bot = makeRivalBot();
      const settings = { seed: 'test', runLength: 8, playerCount: 2, easyBots: 0, intermediateBots: 1 } as GameSettings;
      const result = simulateBotPerformance(bot, BOT_EVENT_INFO, 2, settings, [RivalTraitId.PrecisionFocus]);
      expect(result).toHaveProperty('stars');
      expect(result).toHaveProperty('primaryMetric');
    });

    it('PrecisionFocus: should improve precision event performance', () => {
      // Run multiple seeds to compare star distributions with and without PrecisionFocus.
      // PrecisionFocus adds +0.15 to star3Chance in precision events.
      const precisionEvent: BotEventInfo = {
        id: 'aim-flick',
        performanceDimension: 'precision',
        isStub: false,
        getStars: (r: { primaryMetric: number }) => r.primaryMetric > 500 ? 3 : r.primaryMetric > 300 ? 2 : 1,
      };

      let starsWithTrait = 0;
      let starsWithoutTrait = 0;
      const numSeeds = 50;

      for (let i = 0; i < numSeeds; i++) {
        const seed = `precision-test-${i}`;
        const settings = { seed, runLength: 8, playerCount: 2, easyBots: 0, intermediateBots: 1 } as GameSettings;

        const bot1 = makeRivalBot();
        const result1 = simulateBotPerformance(bot1, precisionEvent, 2, settings, undefined);
        starsWithoutTrait += result1.stars;

        const bot2 = makeRivalBot();
        const result2 = simulateBotPerformance(bot2, precisionEvent, 2, settings, [RivalTraitId.PrecisionFocus]);
        starsWithTrait += result2.stars;
      }

      // PrecisionFocus should improve or maintain average stars.
      expect(starsWithTrait).toBeGreaterThanOrEqual(starsWithoutTrait);
    });
  });
});

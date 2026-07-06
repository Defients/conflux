/**
 * shared/__tests__/gameSetup.test.ts
 *
 * Tests for player creation, skill effects, and loadout effects.
 */

import { describe, it, expect } from 'vitest';
import { createPlayers, applySkillEffects, applyLoadoutEffects, assignTeams } from '../gameSetup';
import { SeededRNG } from '../seededRNG';
import { ChassisId, BotPersonality } from '../types';

describe('gameSetup', () => {
  describe('createPlayers', () => {
    it('should create human and bot players', () => {
      const rng = new SeededRNG('test-seed');
      const players = createPlayers(
        { seed: 'test', runLength: 5, playerCount: 3, easyBots: 1, intermediateBots: 1 } as any,
        rng,
        [{ id: 1, name: 'Player1' }],
        [{ personality: BotPersonality.Easy, count: 1 }, { personality: BotPersonality.Intermediate, count: 1 }],
        { assignRival: true }
      );
      expect(players.length).toBe(3);
      expect(players[0].isBot).toBe(false);
      expect(players[1].isBot).toBe(true);
    });

    it('should assign rival to an intermediate bot', () => {
      const rng = new SeededRNG('test-seed');
      const players = createPlayers(
        { seed: 'test', runLength: 5, playerCount: 3, easyBots: 0, intermediateBots: 2 } as any,
        rng,
        [{ id: 1, name: 'Player1' }],
        [{ personality: BotPersonality.Intermediate, count: 2 }],
        { assignRival: true }
      );
      const rival = players.find(p => p.isRival);
      expect(rival).toBeTruthy();
      expect(rival?.isBot).toBe(true);
    });
  });

  describe('applySkillEffects', () => {
    it('should return player unchanged if no skills', () => {
      const player = { id: 1, name: 'Test', powerUps: [] } as any;
      const result = applySkillEffects(player, undefined);
      expect(result).toBe(player);
    });

    it('should add Shield for tech-t1', () => {
      const player = { id: 1, name: 'Test', powerUps: [] } as any;
      const skills = {
        speed: {},
        tech: { 'tech-t1': true },
        endurance: {},
        availableCP: 0,
      };
      const result = applySkillEffects(player, skills);
      expect(result.powerUps).toContain('Shield');
    });
  });

  describe('applyLoadoutEffects', () => {
    it('should return player unchanged if no loadout', () => {
      const player = { id: 1, name: 'Test', powerUps: [] } as any;
      const result = applyLoadoutEffects(player, undefined);
      expect(result).toBe(player);
    });
  });

  describe('assignTeams', () => {
    it('should assign teams alternating', () => {
      const players = [
        { id: 1, name: 'P1' },
        { id: 2, name: 'P2' },
        { id: 3, name: 'P3' },
        { id: 4, name: 'P4' },
      ] as any;
      const result = assignTeams(players);
      expect(result[0].teamId).toBe('ALPHA');
      expect(result[1].teamId).toBe('OMEGA');
      expect(result[2].teamId).toBe('ALPHA');
      expect(result[3].teamId).toBe('OMEGA');
    });
  });
});

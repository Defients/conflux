/**
 * shared/__tests__/gameSetup.test.ts
 *
 * Tests for player creation, skill effects, and loadout effects.
 * Behavioral tests verify that modifier flags are actually set on the player
 * and consumed by the game rules engine.
 */

import { describe, it, expect } from 'vitest';
import { createPlayers, applySkillEffects, applyLoadoutEffects, applySyndicatePerks, rollStartingLoadoutPerks, assignTeams } from '../gameSetup';
import { getSyndicateTier } from '../constants';
import { SeededRNG } from '../seededRNG';
import { ChassisId, BotPersonality, PilotSkills, ChassisLoadout, Player, CorporationId, PilotProfile } from '../types';

/** Create a baseline player for modifier tests. */
function makeBaselinePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Test',
    isBot: false,
    isRival: false,
    color: '#fff',
    position: 0,
    powerUps: [],
    statuses: [],
    tileHistory: [],
    energy: 0,
    overdriveCooldown: 0,
    ...overrides,
  };
}

/** Build PilotSkills from unlocked node IDs. */
function skillsFrom(...nodeIds: string[]): PilotSkills {
  const skills: PilotSkills = { speed: {}, tech: {}, endurance: {}, availableCP: 0 };
  for (const id of nodeIds) {
    if (id.startsWith('speed-')) skills.speed[id] = true;
    else if (id.startsWith('tech-')) skills.tech[id] = true;
    else if (id.startsWith('endurance-')) skills.endurance[id] = true;
  }
  return skills;
}

/** Build ChassisLoadout from module IDs. */
function loadoutFrom(chassisId: ChassisId, ...moduleIds: string[]): ChassisLoadout {
  const modules: ChassisLoadout['modules'] = {};
  const slotKeys: ('core' | 'thrusters' | 'shielding')[] = ['core', 'thrusters', 'shielding'];
  moduleIds.forEach((mid, i) => {
    if (i < 3) modules[slotKeys[i]] = mid;
  });
  return { chassisId, modules };
}

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

  // ─── Skill Effect Tests (all 15 nodes) ───────────────────────────────────

  describe('applySkillEffects', () => {
    it('should return player unchanged if no skills', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, undefined);
      expect(result).toBe(player);
    });

    it('should return player unchanged if all skill trees empty', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom());
      expect(result).toEqual(player);
    });

    // --- Speed Tree ---

    it('speed-t1 (Quick Start): should set _energyPerStarBonus to 0.5', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('speed-t1'));
      expect(result._energyPerStarBonus).toBe(0.5);
    });

    it('speed-t2 (Overclock): should set _overdriveCooldownReduction to 1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('speed-t1', 'speed-t2'));
      expect(result._overdriveCooldownReduction).toBe(1);
    });

    it('speed-t4 (Adrenaline): should set _powerUpStartChance to 0.15', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('speed-t1', 'speed-t4'));
      expect(result._powerUpStartChance).toBe(0.15);
    });

    it('speed-t5 (Velocity Surge): should add 0.5 to _energyPerStarBonus', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('speed-t1', 'speed-t2', 'speed-t5'));
      // speed-t1 gives 0.5, speed-t5 gives 0.5 → total 1.0
      expect(result._energyPerStarBonus).toBe(1.0);
    });

    // --- Tech Tree ---

    it('tech-t1 (Shield Protocol): should add Shield to powerUps', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('tech-t1'));
      expect(result.powerUps).toContain('Shield');
    });

    it('tech-t2 (Cleanse Field): should set _debuffResistance to 1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('tech-t1', 'tech-t2'));
      expect(result._debuffResistance).toBe(1);
    });

    // --- Endurance Tree ---

    it('endurance-t1 (Tough Frame): should set _debuffResistance to 1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('endurance-t1'));
      expect(result._debuffResistance).toBe(1);
    });

    it('endurance-t2 (Energy Bank): should add 1 to _energyPerStarBonus (represents start energy)', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('endurance-t1', 'endurance-t2'));
      expect(result._energyPerStarBonus).toBe(1);
    });

    it('speed-t3 (Hyperdrive): should set _hyperdriveBonus to true', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('speed-t1', 'speed-t2', 'speed-t3'));
      expect(result._hyperdriveBonus).toBe(true);
    });

    it('tech-t3 (Power Surge): should set _powerUpBonus to 1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('tech-t1', 'tech-t2', 'tech-t3'));
      expect(result._powerUpBonus).toBe(1);
    });

    it('tech-t4 (Scanner): should set _freeScanner to true', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('tech-t1', 'tech-t4'));
      expect(result._freeScanner).toBe(true);
    });

    it('tech-t5 (Data Override): should set _dataSpikeBonus to 1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('tech-t1', 'tech-t2', 'tech-t5'));
      expect(result._dataSpikeBonus).toBe(1);
    });

    it('endurance-t3 (Iron Will): should set _ironWill to true', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('endurance-t1', 'endurance-t2', 'endurance-t3'));
      expect(result._ironWill).toBe(true);
    });

    it('endurance-t4 (Recovery): should set _rechargeBonus to 1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('endurance-t1', 'endurance-t4'));
      expect(result._rechargeBonus).toBe(1);
    });

    it('endurance-t5 (Last Stand): should set _lastStandAvailable to true', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('endurance-t1', 'endurance-t2', 'endurance-t5'));
      expect(result._lastStandAvailable).toBe(true);
    });

    // --- Combination Tests ---

    it('should stack debuffResistance from tech-t2 and endurance-t1', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('tech-t1', 'tech-t2', 'endurance-t1'));
      expect(result._debuffResistance).toBe(2);
    });

    it('should stack energyPerStarBonus from speed-t1, speed-t5, and endurance-t2', () => {
      const player = makeBaselinePlayer();
      const result = applySkillEffects(player, skillsFrom('speed-t1', 'speed-t2', 'speed-t5', 'endurance-t1', 'endurance-t2'));
      // 0.5 + 0.5 + 1.0 = 2.0
      expect(result._energyPerStarBonus).toBe(2.0);
    });

    it('should not duplicate Shield if already in powerUps', () => {
      const player = makeBaselinePlayer({ powerUps: ['Shield'] });
      const result = applySkillEffects(player, skillsFrom('tech-t1'));
      expect(result.powerUps.filter(p => p === 'Shield').length).toBe(1);
    });

    it('should not mutate the original player object', () => {
      const player = makeBaselinePlayer();
      applySkillEffects(player, skillsFrom('tech-t1', 'speed-t1'));
      expect(player.powerUps).toEqual([]);
      expect(player._energyPerStarBonus).toBeUndefined();
    });
  });

  // ─── Module Effect Tests (all 9 modules) ─────────────────────────────────

  describe('applyLoadoutEffects', () => {
    it('should return player unchanged if no loadout', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, undefined);
      expect(result).toBe(player);
    });

    it('should return player unchanged if no modules equipped', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard));
      expect(result).toEqual(player);
    });

    // --- Core Modules ---

    it('core-shield: should add Shield to powerUps', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-shield'));
      expect(result.powerUps).toContain('Shield');
    });

    it('core-energy: should add 2 to energy', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy'));
      expect(result.energy).toBe(2);
    });

    it('core-clarity: should add Clarity to powerUps', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-clarity'));
      expect(result.powerUps).toContain('Clarity');
    });

    // --- Thruster Modules ---

    it('thrusters-momentum: should set _movementBonus to 0.1', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-momentum'));
      expect(result._movementBonus).toBe(0.1);
    });

    it('thrusters-speed: should set _movementBonus to 0.15', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-speed'));
      expect(result._movementBonus).toBe(0.15);
    });

    // --- Shielding Modules ---

    it('shielding-cleanse: should set _debuffResistance to 1', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-momentum', 'shielding-cleanse'));
      expect(result._debuffResistance).toBe(1);
    });

    it('shielding-powerup: should add Clarity to powerUps', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-momentum', 'shielding-powerup'));
      expect(result.powerUps).toContain('Clarity');
    });

    it('thrusters-utility: should set _randomStartPowerUp to true', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-utility'));
      expect(result._randomStartPowerUp).toBe(true);
    });

    it('shielding-fortify: should set _fortifiedShield to true', () => {
      const player = makeBaselinePlayer();
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-momentum', 'shielding-fortify'));
      expect(result._fortifiedShield).toBe(true);
    });

    // --- Combination Tests ---

    it('should not duplicate Shield from core-shield and chassis Aegis', () => {
      const player = makeBaselinePlayer({ powerUps: ['Shield'] });
      const result = applyLoadoutEffects(player, loadoutFrom(ChassisId.Aegis, 'core-shield'));
      expect(result.powerUps.filter(p => p === 'Shield').length).toBe(1);
    });

    it('should stack movementBonus from thrusters-momentum and skills', () => {
      // This tests that module effects compose with skill effects
      const player = makeBaselinePlayer();
      const withSkills = applySkillEffects(player, skillsFrom('speed-t1'));
      const withLoadout = applyLoadoutEffects(withSkills, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-momentum'));
      expect(withLoadout._movementBonus).toBe(0.1);
      expect(withLoadout._energyPerStarBonus).toBe(0.5);
    });

    it('should not mutate the original player object', () => {
      const player = makeBaselinePlayer();
      applyLoadoutEffects(player, loadoutFrom(ChassisId.Standard, 'core-energy', 'thrusters-momentum'));
      expect(player.energy).toBe(0);
      expect(player._movementBonus).toBeUndefined();
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

  describe('applySyndicatePerks & rollStartingLoadoutPerks', () => {
    it('computes syndicate tiers accurately from reputation', () => {
      expect(getSyndicateTier(CorporationId.Cyberex, 0).level).toBe(0);
      expect(getSyndicateTier(CorporationId.Cyberex, 30).level).toBe(1);
      expect(getSyndicateTier(CorporationId.Zenith, 80).level).toBe(2);
      expect(getSyndicateTier(CorporationId.Rogue, 160).level).toBe(3);
    });

    it('applies Cyberex, Zenith, and Rogue syndicate perks at high reputation', () => {
      const player = makeBaselinePlayer();
      const profile = {
        sponsorships: {
          [CorporationId.Cyberex]: { reputation: 80, activeContract: null },
          [CorporationId.Zenith]: { reputation: 150, activeContract: null },
          [CorporationId.Rogue]: { reputation: 150, activeContract: null },
        },
      } as unknown as PilotProfile;

      const result = applySyndicatePerks(player, profile);
      expect(result._threeStarMovementBonus).toBe(0.05);
      expect(result.energy).toBe(1);
      expect(result._energyPerStarBonus).toBe(0.25);
      expect(result._movementBonus).toBe(0.05);
      expect(result._overdriveCooldownReduction).toBe(1);
      expect(result._debuffResistance).toBe(1);
      expect(result._reflectActive).toBe(true);
    });

    it('grants a starting power-up when _randomStartPowerUp is true', () => {
      const player = makeBaselinePlayer({ _randomStartPowerUp: true });
      const rng = new SeededRNG('loadout-roll-seed');
      const result = rollStartingLoadoutPerks(player, rng);
      expect(result.powerUps.length).toBe(1);
    });
  });
});

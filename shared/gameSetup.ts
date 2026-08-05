/**
 * shared/gameSetup.ts
 *
 * Shared player/bot/rival setup logic used by both client (useGameEngine)
 * and server (ConfluxRoom) to initialize game state consistently.
 *
 * Portable: no React, no browser APIs.
 */

import {
  Player, GameSettings, BotPersonality, ChassisId, PlayerType,
  TeamId, PilotProfile, PilotSkills, ChassisLoadout,
  SeasonalModifier,
} from './types';
import {
  PLAYER_COLORS, BOT_NAMES, CHASSIS_DEFINITIONS,
  SKILL_TREE_NODES, CHASSIS_MODULES,
  getActiveSeasonalModifier,
} from './constants';
import { SeededRNG } from './seededRNG';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HumanPlayerConfig {
  id: number;
  name: string;
  avatarId?: string;
  chassisId?: ChassisId;
  connectionId?: string;
  userId?: string;
  teamId?: TeamId;
}

export interface BotSlotConfig {
  personality: BotPersonality;
  count: number;
}

// ─── Player Creation ──────────────────────────────────────────────────────────

/**
 * Create the full player array for a new game.
 * Used by both client (local mode) and server (online mode).
 */
export function createPlayers(
  settings: GameSettings,
  rng: SeededRNG,
  humanConfigs: HumanPlayerConfig[],
  botConfigs: BotSlotConfig[],
  options?: {
    assignRival?: boolean;
    teamMode?: boolean;
  }
): Player[] {
  const players: Player[] = [];
  const shuffledBotNames = rng.shuffle([...BOT_NAMES]);
  let botCount = 0;
  const assignRival = options?.assignRival ?? true;
  const teamMode = options?.teamMode ?? false;

  // Add human players
  for (const config of humanConfigs) {
    const player: Player = {
      id: config.id,
      name: config.name,
      isBot: false,
      isRival: false,
      color: PLAYER_COLORS[(config.id - 1) % PLAYER_COLORS.length],
      position: 0,
      powerUps: [],
      statuses: [],
      tileHistory: [],
      energy: 0,
      overdriveCooldown: 0,
      playerType: 'human' as PlayerType,
      connectionId: config.connectionId,
      userId: config.userId,
      chassisId: config.chassisId,
      isReady: true,
      isConnected: true,
      teamId: config.teamId,
    };

    // Apply chassis effects
    if (config.chassisId === ChassisId.Aegis) {
      player.powerUps.push('Shield');
    }

    players.push(player);
  }

  // Add bot players
  for (const config of botConfigs) {
    for (let i = 0; i < config.count; i++) {
      const pid = players.length + 1;
      const teamId = teamMode
        ? (players.filter(p => !p.isBot).length % 2 === 0 ? 'ALPHA' as TeamId : 'OMEGA' as TeamId)
        : undefined;

      players.push({
        id: pid,
        name: shuffledBotNames[botCount++ % shuffledBotNames.length],
        isBot: true,
        isRival: false,
        personality: config.personality,
        color: PLAYER_COLORS[(pid - 1) % PLAYER_COLORS.length],
        position: 0,
        powerUps: [],
        statuses: [],
        tileHistory: [],
        energy: 0,
        overdriveCooldown: 0,
        playerType: 'bot' as PlayerType,
        teamId,
      });
    }
  }

  // Assign rival
  if (assignRival) {
    const potentialRivals = players.filter(
      p => p.isBot && p.personality === BotPersonality.Intermediate
    );
    const rivalBot = potentialRivals.length > 0
      ? potentialRivals[0]
      : players.find(p => p.isBot);

    if (rivalBot) {
      rivalBot.isRival = true;
      rivalBot.personality = BotPersonality.Rival;
      rivalBot.name = `Rival ${rivalBot.name}`;

      const chassisIds = Object.values(ChassisId).filter(id => CHASSIS_DEFINITIONS[id].cost > 0);
      const randomChassisId = chassisIds[rng.nextInt(0, chassisIds.length)];
      rivalBot.chassisId = randomChassisId;
      if (randomChassisId === ChassisId.Aegis) rivalBot.powerUps.push('Shield');
    }
  }

  return players;
}

// ─── Skill Effects ────────────────────────────────────────────────────────────

/**
 * Apply pilot skill tree effects to a player at game initialization.
 *
 * Reads the `effect` field from SKILL_TREE_NODES (constants.ts) and translates
 * each defined effect into a typed modifier flag on the player. The flags are
 * consumed by GameRules during processRaceStep, applyDebuff, and activateOverdrive.
 *
 * Skills with empty effect objects (speed-t3, tech-t3, tech-t4, tech-t5,
 * endurance-t3, endurance-t4, endurance-t5) represent design-intent features
 * that are not yet implemented in the rules engine. They are intentionally
 * not applied here to avoid cosmetic-only progression.
 */
export function applySkillEffects(
  player: Player,
  skills?: PilotSkills
): Player {
  if (!skills) return player;

  const allUnlocked: string[] = [
    ...Object.keys(skills.speed).filter(k => skills.speed[k]),
    ...Object.keys(skills.tech).filter(k => skills.tech[k]),
    ...Object.keys(skills.endurance).filter(k => skills.endurance[k]),
  ];

  if (allUnlocked.length === 0) return player;

  // Look up each unlocked node's effect from the canonical definitions.
  const modifiedPlayer: Player = {
    ...player,
    powerUps: [...player.powerUps],
  };

  // Accumulate additive modifiers across all unlocked nodes.
  let energyPerStarBonus = modifiedPlayer._energyPerStarBonus ?? 0;
  let overdriveCooldownReduction = modifiedPlayer._overdriveCooldownReduction ?? 0;
  let debuffResistance = modifiedPlayer._debuffResistance ?? 0;
  let powerUpStartChance = modifiedPlayer._powerUpStartChance ?? 0;

  for (const nodeId of allUnlocked) {
    const node = SKILL_TREE_NODES.find(n => n.id === nodeId);
    if (!node || !node.effect) continue;

    const eff = node.effect;

    if (typeof eff.energyPerStarBonus === 'number') {
      energyPerStarBonus += eff.energyPerStarBonus;
    }
    if (typeof eff.overdriveCooldownReduction === 'number') {
      overdriveCooldownReduction += eff.overdriveCooldownReduction;
    }
    if (typeof eff.debuffResistance === 'number') {
      debuffResistance += eff.debuffResistance;
    }
    if (typeof eff.powerUpStartChance === 'number') {
      powerUpStartChance += eff.powerUpStartChance;
    }
    if (eff.shieldStart === true) {
      if (!modifiedPlayer.powerUps.includes('Shield')) {
        modifiedPlayer.powerUps.push('Shield');
      }
    }
  }

  // Only assign non-zero values to keep the player object clean.
  if (energyPerStarBonus > 0) modifiedPlayer._energyPerStarBonus = energyPerStarBonus;
  if (overdriveCooldownReduction > 0) modifiedPlayer._overdriveCooldownReduction = overdriveCooldownReduction;
  if (debuffResistance > 0) modifiedPlayer._debuffResistance = debuffResistance;
  if (powerUpStartChance > 0) modifiedPlayer._powerUpStartChance = powerUpStartChance;

  return modifiedPlayer;
}

// ─── Loadout Effects ──────────────────────────────────────────────────────────

/**
 * Apply chassis module loadout effects to a player at game initialization.
 *
 * Reads the `effects` field from CHASSIS_MODULES (constants.ts) and translates
 * each defined effect into typed modifier flags or direct player changes.
 *
 * Modules with empty effect objects (thrusters-utility, shielding-fortify)
 * represent design-intent features not yet implemented in the rules engine.
 */
export function applyLoadoutEffects(
  player: Player,
  loadout?: ChassisLoadout
): Player {
  if (!loadout) return player;

  const allModuleIds = Object.values(loadout.modules).filter(Boolean) as string[];
  if (allModuleIds.length === 0) return player;

  const modifiedPlayer: Player = {
    ...player,
    powerUps: [...player.powerUps],
  };

  // Accumulate additive modifiers.
  let movementBonus = modifiedPlayer._movementBonus ?? 0;
  let debuffResistance = modifiedPlayer._debuffResistance ?? 0;

  for (const moduleId of allModuleIds) {
    const mod = CHASSIS_MODULES.find(m => m.id === moduleId);
    if (!mod || !mod.effects) continue;

    const eff = mod.effects;

    if (typeof eff.movementBonus === 'number') {
      movementBonus += eff.movementBonus;
    }
    if (typeof eff.debuffDurationReduction === 'number') {
      debuffResistance += eff.debuffDurationReduction;
    }
    if (typeof eff.energyBonus === 'number') {
      modifiedPlayer.energy += eff.energyBonus;
    }
    if (eff.startWithShield === true) {
      if (!modifiedPlayer.powerUps.includes('Shield')) {
        modifiedPlayer.powerUps.push('Shield');
      }
    }
    if (eff.startWithPowerUp) {
      if (!modifiedPlayer.powerUps.includes(eff.startWithPowerUp)) {
        modifiedPlayer.powerUps.push(eff.startWithPowerUp);
      }
    }
  }

  if (movementBonus > 0) modifiedPlayer._movementBonus = movementBonus;
  if (debuffResistance > 0) modifiedPlayer._debuffResistance = debuffResistance;

  return modifiedPlayer;
}

// ─── Team Assignment ──────────────────────────────────────────────────────────

/**
 * Assign team IDs to players for team race mode.
 * Alternates between ALPHA and OMEGA based on join order.
 */
export function assignTeams(players: Player[]): Player[] {
  let alphaCount = 0;
  let omegaCount = 0;

  return players.map(p => {
    if (p.isBot) {
      // Bots fill the team with fewer players
      const teamId = alphaCount <= omegaCount ? 'ALPHA' as TeamId : 'OMEGA' as TeamId;
      if (teamId === 'ALPHA') alphaCount++;
      else omegaCount++;
      return { ...p, teamId };
    }

    // Humans keep their assigned team, or get assigned alternately
    if (p.teamId) {
      if (p.teamId === 'ALPHA') alphaCount++;
      else omegaCount++;
      return p;
    }

    const teamId = alphaCount <= omegaCount ? 'ALPHA' as TeamId : 'OMEGA' as TeamId;
    if (teamId === 'ALPHA') alphaCount++;
    else omegaCount++;
    return { ...p, teamId };
  });
}

/**
 * Compute team positions (average of team members' positions).
 */
export function getTeamPositions(players: Player[]): { teamId: TeamId; position: number }[] {
  const teams: Record<string, { sum: number; count: number }> = {};

  for (const p of players) {
    if (!p.teamId) continue;
    if (!teams[p.teamId]) teams[p.teamId] = { sum: 0, count: 0 };
    teams[p.teamId].sum += p.position;
    teams[p.teamId].count++;
  }

  return Object.entries(teams).map(([teamId, data]) => ({
    teamId: teamId as TeamId,
    position: data.sum / data.count,
  }));
}

/**
 * Apply the active seasonal modifier to game settings.
 * Returns modified settings (runLength override) and the modifier itself
 * so the caller can apply player-level effects (energy multiplier, etc.).
 *
 * - runLengthOverride: replaces settings.runLength
 * - disablePowerUps: flagged via the returned modifier (caller handles)
 * - energyMultiplier: flagged via the returned modifier (caller handles)
 * - anomalyChance: flagged via the returned modifier (caller handles)
 */
export function applySeasonalModifierToSettings(settings: GameSettings): {
  settings: GameSettings;
  modifier: SeasonalModifier | null;
} {
  const modifier = getActiveSeasonalModifier();
  if (!modifier) {
    return { settings, modifier: null };
  }

  const modifiedSettings = { ...settings };

  if (modifier.effect.runLengthOverride !== undefined) {
    modifiedSettings.runLength = modifier.effect.runLengthOverride;
  }

  return { settings: modifiedSettings, modifier };
}

/**
 * Apply seasonal modifier effects to a player at game start.
 * Currently handles disablePowerUps (removes starting power-ups).
 * Energy multiplier is applied at energy gain time (see gameRules).
 */
export function applySeasonalModifierToPlayer(
  player: Player,
  modifier: SeasonalModifier | null
): Player {
  if (!modifier) return player;

  const modifiedPlayer = { ...player };

  if (modifier.effect.disablePowerUps) {
    modifiedPlayer.powerUps = [];
  }

  return modifiedPlayer;
}

/**
 * Get the energy multiplier from the active seasonal modifier.
 * Returns 1 if no modifier is active or the modifier doesn't affect energy.
 */
export function getSeasonalEnergyMultiplier(): number {
  const modifier = getActiveSeasonalModifier();
  if (!modifier?.effect.energyMultiplier) return 1;
  return modifier.effect.energyMultiplier;
}

/**
 * Get the anomaly chance from the active seasonal modifier.
 * Returns 0 if no modifier is active or the modifier doesn't affect anomalies.
 */
export function getSeasonalAnomalyChance(): number {
  const modifier = getActiveSeasonalModifier();
  if (!modifier?.effect.anomalyChance) return 0;
  return modifier.effect.anomalyChance;
}

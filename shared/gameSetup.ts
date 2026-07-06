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
} from './types';
import {
  PLAYER_COLORS, BOT_NAMES, CHASSIS_DEFINITIONS,
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

  // Import SKILL_TREE_NODES lazily to avoid circular deps in some contexts
  // The caller should pass in the resolved effects instead
  const modifiedPlayer = { ...player, powerUps: [...player.powerUps] };

  // Apply effects based on unlocked skill IDs
  // These match the SKILL_TREE_NODES defined in constants.ts
  if (allUnlocked.includes('speed-t1')) {
    // +0.5 energy per star
    // Applied during processRaceStep via a flag on the player
    modifiedPlayer.energy = player.energy; // base energy unchanged at init
  }
  if (allUnlocked.includes('tech-t1')) {
    // Start with Shield
    if (!modifiedPlayer.powerUps.includes('Shield')) {
      modifiedPlayer.powerUps.push('Shield');
    }
  }
  if (allUnlocked.includes('endurance-t1')) {
    // Debuff resistance - applied during debuff application
    // Marked via a flag; actual reduction handled in gameRules
  }

  return modifiedPlayer;
}

// ─── Loadout Effects ──────────────────────────────────────────────────────────

/**
 * Apply chassis module loadout effects to a player at game initialization.
 */
export function applyLoadoutEffects(
  player: Player,
  loadout?: ChassisLoadout
): Player {
  if (!loadout) return player;

  const modifiedPlayer = { ...player, powerUps: [...player.powerUps] };

  // Effects are applied based on module IDs in the loadout
  // The actual module definitions are in constants.ts CHASSIS_MODULES
  // We check for known module IDs and apply their effects
  const allModuleIds = Object.values(loadout.modules).filter(Boolean) as string[];

  for (const moduleId of allModuleIds) {
    switch (moduleId) {
      case 'core-shield':
        if (!modifiedPlayer.powerUps.includes('Shield')) {
          modifiedPlayer.powerUps.push('Shield');
        }
        break;
      case 'core-energy':
        modifiedPlayer.energy += 2;
        break;
      case 'thrusters-momentum':
        // Movement bonus applied during processRaceStep
        break;
      case 'shielding-cleanse':
        // Debuff duration reduction applied during debuff application
        break;
      case 'shielding-powerup':
        if (!modifiedPlayer.powerUps.includes('Clarity')) {
          modifiedPlayer.powerUps.push('Clarity');
        }
        break;
    }
  }

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

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
  SeasonalModifier, CorporationId, PowerUp,
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

/**
 * Sanitize and clamp GameSettings at any ingress (URL share, localStorage, online room).
 */
export function sanitizeGameSettings(
  raw: Partial<GameSettings> | null | undefined,
  options?: { allowGauntlet?: boolean; defaultSeed?: string }
): GameSettings {
  const s = raw ?? {};
  const isGauntlet = !!(options?.allowGauntlet && s.isGauntlet);
  const playerCount = typeof s.playerCount === 'number' && Number.isFinite(s.playerCount)
    ? Math.max(1, Math.min(6, Math.floor(s.playerCount)))
    : 4;
  const maxBots = Math.max(0, playerCount - 1);
  const easyBots = typeof s.easyBots === 'number' && Number.isFinite(s.easyBots)
    ? Math.max(0, Math.min(maxBots, Math.floor(s.easyBots)))
    : Math.min(2, maxBots);
  const intermediateBots = typeof s.intermediateBots === 'number' && Number.isFinite(s.intermediateBots)
    ? Math.max(0, Math.min(maxBots - easyBots, Math.floor(s.intermediateBots)))
    : Math.max(0, maxBots - easyBots);
  const minLength = isGauntlet ? 1 : 4;
  const maxLength = isGauntlet ? 50 : 20;
  const runLength = typeof s.runLength === 'number' && Number.isFinite(s.runLength)
    ? Math.max(minLength, Math.min(maxLength, Math.floor(s.runLength)))
    : (isGauntlet ? 50 : 8);
  const rawSeed = typeof s.seed === 'string' ? s.seed.trim().slice(0, 64) : '';
  const seed = rawSeed || options?.defaultSeed || String(Math.floor(Math.random() * 1000000));
  const selectedChassis = s.selectedChassis && Object.values(ChassisId).includes(s.selectedChassis)
    ? s.selectedChassis
    : ChassisId.Standard;

  return {
    playerCount,
    easyBots,
    intermediateBots,
    seed,
    runLength,
    sound: typeof s.sound === 'boolean' ? s.sound : true,
    accessibility: typeof s.accessibility === 'boolean' ? s.accessibility : false,
    uiEffects: typeof s.uiEffects === 'boolean' ? s.uiEffects : true,
    colorBlindMode: typeof s.colorBlindMode === 'boolean' ? s.colorBlindMode : false,
    selectedChassis,
    ...(isGauntlet ? { isGauntlet: true } : {}),
    ...(s.teamMode ? { teamMode: true } : {}),
    ...(s.activeSeasonId !== undefined ? { activeSeasonId: s.activeSeasonId } : {}),
    ...(Array.isArray(s.customEventIds) ? { customEventIds: s.customEventIds.filter(id => typeof id === 'string') } : {}),
  };
}

/**
 * Validate and sanitize skill node IDs and chassis module IDs against catalog rules
 * and an optional authoritative PilotProfile.
 */
export function validateLoadoutAndSkills(
  chassisId: ChassisId,
  claimedSkillNodeIds?: string[],
  claimedModuleIds?: string[],
  storedProfile?: PilotProfile | null
): {
  validChassisId: ChassisId;
  skills: PilotSkills;
  loadout: ChassisLoadout;
} {
  const validChassisId = storedProfile
    ? (storedProfile.unlockedChassis?.includes(chassisId) ? chassisId : (storedProfile.unlockedChassis?.[0] ?? ChassisId.Standard))
    : (Object.values(ChassisId).includes(chassisId) ? chassisId : ChassisId.Standard);

  const skills: PilotSkills = { speed: {}, tech: {}, endurance: {}, availableCP: 0 };
  if (storedProfile?.skills) {
    skills.speed = { ...storedProfile.skills.speed };
    skills.tech = { ...storedProfile.skills.tech };
    skills.endurance = { ...storedProfile.skills.endurance };
  } else if (Array.isArray(claimedSkillNodeIds)) {
    const claimedSet = new Set(claimedSkillNodeIds.filter(id => typeof id === 'string'));
    // Enforce tier order so prerequisites must also be present
    const sortedNodes = [...SKILL_TREE_NODES].sort((a, b) => a.tier - b.tier);
    for (const node of sortedNodes) {
      if (!claimedSet.has(node.id)) continue;
      const prereqsMet = node.prerequisites.every(p =>
        skills.speed[p] || skills.tech[p] || skills.endurance[p]
      );
      if (prereqsMet) {
        skills[node.tree][node.id] = true;
      }
    }
  }

  const loadout: ChassisLoadout = { chassisId: validChassisId, modules: {} };
  if (storedProfile?.loadouts?.[validChassisId]) {
    const storedMods = storedProfile.loadouts[validChassisId]?.modules ?? {};
    const ownedSet = new Set(storedProfile.unlockedModules ?? []);
    for (const slot of ['core', 'thrusters', 'shielding'] as const) {
      const modId = storedMods[slot];
      const modDef = modId ? CHASSIS_MODULES.find(m => m.id === modId && m.slot === slot) : undefined;
      if (modDef && (ownedSet.size === 0 || ownedSet.has(modDef.id))) {
        loadout.modules[slot] = modDef.id;
      }
    }
  } else if (Array.isArray(claimedModuleIds)) {
    const ownedSet = storedProfile?.unlockedModules ? new Set(storedProfile.unlockedModules) : null;
    for (const rawId of claimedModuleIds) {
      if (typeof rawId !== 'string') continue;
      const modDef = CHASSIS_MODULES.find(m => m.id === rawId);
      if (!modDef) continue;
      if (ownedSet && !ownedSet.has(modDef.id)) continue;
      // Only one module per slot; first valid module for that slot wins
      if (!loadout.modules[modDef.slot]) {
        loadout.modules[modDef.slot] = modDef.id;
      }
    }
  }

  return { validChassisId, skills, loadout };
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
  let powerUpBonus = modifiedPlayer._powerUpBonus ?? 0;
  let dataSpikeBonus = modifiedPlayer._dataSpikeBonus ?? 0;
  let rechargeBonus = modifiedPlayer._rechargeBonus ?? 0;

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
    if (eff.hyperdriveBonus === true) {
      modifiedPlayer._hyperdriveBonus = true;
    }
    if (typeof eff.powerUpEffectivenessBonus === 'number') {
      powerUpBonus += eff.powerUpEffectivenessBonus;
    }
    if (eff.freeScanner === true) {
      modifiedPlayer._freeScanner = true;
    }
    if (typeof eff.dataSpikeBonus === 'number') {
      dataSpikeBonus += eff.dataSpikeBonus;
    }
    if (eff.ironWill === true) {
      modifiedPlayer._ironWill = true;
    }
    if (typeof eff.pitStopRechargeBonus === 'number') {
      rechargeBonus += eff.pitStopRechargeBonus;
    }
    if (eff.lastStand === true) {
      modifiedPlayer._lastStandAvailable = true;
    }
  }

  // Only assign non-zero values to keep the player object clean.
  if (energyPerStarBonus > 0) modifiedPlayer._energyPerStarBonus = energyPerStarBonus;
  if (overdriveCooldownReduction > 0) modifiedPlayer._overdriveCooldownReduction = overdriveCooldownReduction;
  if (debuffResistance > 0) modifiedPlayer._debuffResistance = debuffResistance;
  if (powerUpStartChance > 0) modifiedPlayer._powerUpStartChance = powerUpStartChance;
  if (powerUpBonus > 0) modifiedPlayer._powerUpBonus = powerUpBonus;
  if (dataSpikeBonus > 0) modifiedPlayer._dataSpikeBonus = dataSpikeBonus;
  if (rechargeBonus > 0) modifiedPlayer._rechargeBonus = rechargeBonus;

  return modifiedPlayer;
}

// ─── Loadout Effects ──────────────────────────────────────────────────────────

/**
 * Apply chassis module loadout effects to a player at game initialization.
 *
 * Reads the `effects` field from CHASSIS_MODULES (constants.ts) and translates
 * each defined effect into typed modifier flags or direct player changes.
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
    if (eff.randomStartPowerUp === true) {
      modifiedPlayer._randomStartPowerUp = true;
    }
    if (eff.fortifiedShield === true) {
      modifiedPlayer._fortifiedShield = true;
    }
  }

  if (movementBonus > 0) modifiedPlayer._movementBonus = movementBonus;
  if (debuffResistance > 0) modifiedPlayer._debuffResistance = debuffResistance;

  return modifiedPlayer;
}

// ─── Syndicate Perks & Starting Loadout Rolls ─────────────────────────────────

/**
 * Apply passive Corporation Syndicate perks based on reputation levels.
 */
export function applySyndicatePerks(
  player: Player,
  profile?: PilotProfile | null
): Player {
  if (!profile?.sponsorships) return player;

  const cyberexRep = profile.sponsorships[CorporationId.Cyberex]?.reputation ?? 0;
  const zenithRep = profile.sponsorships[CorporationId.Zenith]?.reputation ?? 0;
  const rogueRep = profile.sponsorships[CorporationId.Rogue]?.reputation ?? 0;

  if (cyberexRep < 25 && zenithRep < 25 && rogueRep < 25) return player;

  const modified: Player = {
    ...player,
    powerUps: [...player.powerUps],
    statuses: [...player.statuses],
  };

  // Cyberex: Precision Syndicate (+3★ movement & starting energy)
  if (cyberexRep >= 150) {
    modified._threeStarMovementBonus = (modified._threeStarMovementBonus ?? 0) + 0.10;
    modified.energy += 1;
  } else if (cyberexRep >= 75) {
    modified._threeStarMovementBonus = (modified._threeStarMovementBonus ?? 0) + 0.05;
    modified.energy += 1;
  } else if (cyberexRep >= 25) {
    modified._threeStarMovementBonus = (modified._threeStarMovementBonus ?? 0) + 0.05;
  }

  // Zenith: Speed Syndicate (+energy/star, +movement, -overdrive cooldown)
  if (zenithRep >= 150) {
    modified._energyPerStarBonus = (modified._energyPerStarBonus ?? 0) + 0.25;
    modified._movementBonus = (modified._movementBonus ?? 0) + 0.05;
    modified._overdriveCooldownReduction = (modified._overdriveCooldownReduction ?? 0) + 1;
  } else if (zenithRep >= 75) {
    modified._energyPerStarBonus = (modified._energyPerStarBonus ?? 0) + 0.25;
    modified._movementBonus = (modified._movementBonus ?? 0) + 0.05;
  } else if (zenithRep >= 25) {
    modified._energyPerStarBonus = (modified._energyPerStarBonus ?? 0) + 0.25;
  }

  // Rogue: Disruptor Syndicate (+starting power-up chance, +debuff resistance, +Reflector immunity)
  if (rogueRep >= 150) {
    modified._powerUpStartChance = (modified._powerUpStartChance ?? 0) + 0.10;
    modified._debuffResistance = (modified._debuffResistance ?? 0) + 1;
    modified._reflectActive = true;
    if (!modified.statuses.some(s => s.type === 'IMMUNE')) {
      modified.statuses.push({ type: 'IMMUNE', duration: 1 });
    }
  } else if (rogueRep >= 75) {
    modified._powerUpStartChance = (modified._powerUpStartChance ?? 0) + 0.10;
    modified._debuffResistance = (modified._debuffResistance ?? 0) + 1;
  } else if (rogueRep >= 25) {
    modified._powerUpStartChance = (modified._powerUpStartChance ?? 0) + 0.10;
  }

  return modified;
}

/**
 * Deterministically roll starting power-up perks (_randomStartPowerUp from
 * Utility Thrusters and _powerUpStartChance from Adrenaline / Rogue Syndicate).
 */
export function rollStartingLoadoutPerks(
  player: Player,
  rng: SeededRNG
): Player {
  const hasGuaranteed = !!player._randomStartPowerUp;
  const chance = player._powerUpStartChance ?? 0;

  if (!hasGuaranteed && chance <= 0) return player;

  const modified: Player = {
    ...player,
    powerUps: [...player.powerUps],
  };

  const pool: PowerUp[] = ['Clarity', 'Mist Bomb', 'Time Snare', 'Shield', 'Data Spike', 'Overcharge', 'Sludge', 'Reflector'];

  if (hasGuaranteed) {
    const pick = pool[rng.nextInt(0, pool.length)];
    modified.powerUps.push(pick);
  }

  if (chance > 0 && rng.nextFloat() < chance) {
    const pick = pool[rng.nextInt(0, pool.length)];
    modified.powerUps.push(pick);
  }

  return modified;
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
  const modifier = getActiveSeasonalModifier(settings.activeSeasonId);
  if (!modifier) {
    return { settings: { ...settings, activeSeasonId: 'none' }, modifier: null };
  }

  const modifiedSettings: GameSettings = {
    ...settings,
    activeSeasonId: modifier.id,
  };

  if (modifier.effect.runLengthOverride !== undefined && !settings.isGauntlet) {
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
 * Check whether power-ups are disabled for the given season (or current active season).
 */
export function isSeasonalPowerUpsDisabled(seasonId?: string | null): boolean {
  const modifier = getActiveSeasonalModifier(seasonId);
  return !!modifier?.effect.disablePowerUps;
}

/**
 * Get the energy multiplier from the active seasonal modifier.
 * Returns 1 if no modifier is active or the modifier doesn't affect energy.
 */
export function getSeasonalEnergyMultiplier(seasonId?: string | null): number {
  const modifier = getActiveSeasonalModifier(seasonId);
  if (!modifier?.effect.energyMultiplier) return 1;
  return modifier.effect.energyMultiplier;
}

/**
 * Get the anomaly chance from the active seasonal modifier.
 * Returns 0 if no modifier is active or the modifier doesn't affect anomalies.
 */
export function getSeasonalAnomalyChance(seasonId?: string | null): number {
  const modifier = getActiveSeasonalModifier(seasonId);
  if (!modifier?.effect.anomalyChance) return 0;
  return modifier.effect.anomalyChance;
}

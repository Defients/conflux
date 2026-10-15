/**
 * shared/matchSummary.ts
 *
 * Canonical post-race progression pipeline.
 * Produces a single MatchSummary artifact from any finished race,
 * then applies it to a PilotProfile exactly once via idempotent guards.
 *
 * MUST NOT import React, browser APIs, or any client-only dependencies.
 */

import {
  GameState, PilotProfile, AccoladeId, ChassisId, CorporationId,
  Contract, ContractObjective, Player, Tile,
  EventMastery, RankInfo, TeamId,
} from './types';
import {
  CP_AWARD_RULES, CP_STREAK_MULTIPLIER,
} from './constants';
import { SeededRNG } from './seededRNG';
import { computeMultiPlayerRatingChanges, applyRatingChange, ratingToTier, createDefaultRankInfo, DEFAULT_RATING } from './rankSystem';
import { getTeamPositions } from './gameSetup';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MatchMode = 'local' | 'online';

export interface SponsorshipDelta {
  corpId: CorporationId;
  repChange: number;
  source: 'sponsored_tile' | 'contract';
}

export interface ContractOutcome {
  corporationId: CorporationId;
  objectives: ContractObjective[];
  cpReward: number;
  repReward: number;
  allComplete: boolean;
}

export interface CpBreakdown {
  placement: number;
  stars: number;
  isFarming: boolean;
  farmingPenaltyApplied: boolean;
  streakMultiplier: number;
  baseCp: number;
  contractCp: number;
  totalCp: number;
  displayText: string;
}

export interface MatchSummary {
  // ─── Identity / provenance ──────────────────────────────────────────
  matchId: string;
  mode: MatchMode;
  completedAt: number;
  seed: string;
  runLength: number;
  isGauntlet: boolean;
  isDaily: boolean;

  // ─── Outcome ────────────────────────────────────────────────────────
  standings: Array<{
    playerId: number;
    name: string;
    position: number;
    placement: number;   // 0-indexed rank
    isBot: boolean;
    isRival: boolean;
    tileHistory: Array<{ tileIndex: number; stars: number }>;
  }>;
  humanPlacement: number; // 0-indexed rank of the human player
  humanPlayerId: number;

  // ─── Rewards / deltas ───────────────────────────────────────────────
  cp: CpBreakdown;
  streakDelta: { oldStreak: number; newStreak: number };
  sponsorshipDeltas: SponsorshipDelta[];
  rivalDelta: { wins: number; losses: number } | null; // null if no rival in race
  accoladeUnlocks: AccoladeId[];
  contractOutcomes: ContractOutcome[];

  // ─── Gauntlet-specific ──────────────────────────────────────────────
  gauntletTilesSurvived: number | null;
  gauntletNewHighScore: boolean;

  // ─── Daily challenge ────────────────────────────────────────────────
  dailyPersonalBest: number | null; // null if not a daily
  dailyIsNewBest: boolean;

  // ─── v5.0: Event mastery updates ────────────────────────────────────
  eventMasteryUpdates: { eventId: string; mastery: EventMastery }[];

  // ─── v5.0: Ranked rating change ─────────────────────────────────────
  ratingChange: number | null;
  newRating: number | null;
  newTier: RankInfo['tier'] | null;

  // ─── v5.0: Team mode ────────────────────────────────────────────────
  teamId?: TeamId;
  teamPlacement?: number;
}

// ─── Input types ────────────────────────────────────────────────────────────

export interface MatchSummaryInput {
  gameState: GameState;
  profile: PilotProfile;
  mode: MatchMode;
  contracts: Contract[];
  /** Map from eventId → performanceDimension, needed for contract eval. */
  eventDimensionMap: Record<string, string>;
  /** Daily seed string to compare against, e.g. "2026-03-18". Null if unknown. */
  dailySeed: string | null;
  /** Current daily personal best. Null if none or not a daily. */
  currentDailyBest: number | null;
  /** Timestamp of match completion. Defaults to Date.now(). */
  timestamp?: number;
  /** Explicit immutable match ID (overrides seed-timestamp fallback). */
  matchId?: string;
  /** Specific player ID to generate summary for (vital for multiplayer). */
  targetPlayerId?: number;
  /** Ranked match context for authoritative ELO computation. */
  rankedContext?: {
    isRanked: boolean;
    participants?: { playerId: number; rating: number; placement: number }[];
  };
}

// ─── Core computation ───────────────────────────────────────────────────────

/**
 * Produce a canonical MatchSummary from a finished race.
 * Pure function — no side effects, no mutations, no storage access.
 */
export function computeMatchSummary(input: MatchSummaryInput): MatchSummary {
  const { gameState, profile, mode, contracts, eventDimensionMap, dailySeed, currentDailyBest } = input;
  const timestamp = input.timestamp ?? Date.now();
  const settings = gameState.settings;
  const isGauntlet = !!settings.isGauntlet;
  const isDaily = dailySeed !== null && settings.seed === dailySeed;

  // Use immutable matchId if provided on input or gameState, otherwise deterministic seed-timestamp
  const matchId = input.matchId ?? gameState.matchId ?? `${settings.seed}-${timestamp}`;

  // ─── Standings ──────────────────────────────────────────────────────
  const sortedPlayers = [...gameState.players].sort((a, b) => b.position - a.position);
  
  const humanPlayer = input.targetPlayerId !== undefined 
    ? sortedPlayers.find(p => p.id === input.targetPlayerId)
    : sortedPlayers.find(p => !p.isBot);

  const rival = sortedPlayers.find(p => p.isRival);

  if (!humanPlayer) {
    // Defensive: if no human player found, return a minimal summary
    return createEmptySummary(matchId, mode, timestamp, settings.seed, gameState.run.length, isGauntlet, isDaily);
  }

  const humanPlacement = sortedPlayers.indexOf(humanPlayer);
  const rivalPlacement = rival ? sortedPlayers.indexOf(rival) : -1;

  const standings = sortedPlayers.map((p, index) => ({
    playerId: p.id,
    name: p.name,
    position: p.position,
    placement: index,
    isBot: p.isBot,
    isRival: p.isRival,
    tileHistory: [...p.tileHistory],
  }));

  // ─── Gauntlet special path ─────────────────────────────────────────
  if (isGauntlet) {
    const tilesSurvived = humanPlayer.tileHistory.length;
    const isNewHigh = tilesSurvived > profile.gauntletHighScore;
    return {
      matchId, mode, completedAt: timestamp, seed: settings.seed,
      runLength: gameState.run.length, isGauntlet: true, isDaily: false,
      standings, humanPlacement, humanPlayerId: humanPlayer.id,
      cp: emptyCpBreakdown(),
      streakDelta: { oldStreak: profile.winStreak, newStreak: profile.winStreak },
      sponsorshipDeltas: [],
      rivalDelta: null,
      accoladeUnlocks: [],
      contractOutcomes: [],
      gauntletTilesSurvived: tilesSurvived,
      gauntletNewHighScore: isNewHigh,
      dailyPersonalBest: null,
      dailyIsNewBest: false,
      eventMasteryUpdates: [],
      ratingChange: null,
      newRating: null,
      newTier: null,
    };
  }

  // ─── CP calculation ────────────────────────────────────────────────
  const cpPlacement = CP_AWARD_RULES.placement[humanPlacement] ?? 0;
  const totalStars = humanPlayer.tileHistory.reduce((sum, tile) => sum + tile.stars, 0);
  let cpStars = totalStars * CP_AWARD_RULES.perStar;

  // Anti-farming: penalize if >50% of tiles are the same event
  const eventCounts: Record<string, number> = {};
  gameState.run.forEach(tile => {
    eventCounts[tile.eventId] = (eventCounts[tile.eventId] || 0) + 1;
  });
  const mostFrequentEventCount = Math.max(...Object.values(eventCounts), 0);
  const isFarming = gameState.run.length > 0 && mostFrequentEventCount / gameState.run.length > 0.5;
  if (isFarming) {
    cpStars *= 0.7;
  }

  const baseCp = cpPlacement + cpStars;

  // ─── Rival W/L + streak ────────────────────────────────────────────
  const rivalDefeated = rival ? humanPlacement < rivalPlacement : false;
  const newWinStreak = rivalDefeated ? profile.winStreak + 1 : 0;
  const streakMultiplier = CP_STREAK_MULTIPLIER(newWinStreak);

  // ─── Sponsorship from sponsored tiles ──────────────────────────────
  const sponsorshipDeltas: SponsorshipDelta[] = [];
  const repRng = new SeededRNG(`rep-${settings.seed}`);
  const isZeroIndexedHistory = humanPlayer.tileHistory.some(h => h.tileIndex === 0);
  humanPlayer.tileHistory.forEach(history => {
    const tile = resolveHistoryTile(gameState.run, history.tileIndex, isZeroIndexedHistory);
    if (tile && tile.modifier === 'SPONSORED' && tile.sponsoringCorp) {
      if (history.stars >= 3) {
        const repGain = repRng.nextInt(3, 6);
        sponsorshipDeltas.push({ corpId: tile.sponsoringCorp, repChange: repGain, source: 'sponsored_tile' });
      }
    }
  });

  // ─── Contract evaluation ───────────────────────────────────────────
  const contractOutcomes = evaluateContractsForSummary(contracts, gameState, humanPlayer, sortedPlayers, eventDimensionMap);

  let contractCp = 0;
  for (const outcome of contractOutcomes) {
    if (outcome.allComplete) {
      contractCp += outcome.cpReward;
      sponsorshipDeltas.push({
        corpId: outcome.corporationId,
        repChange: outcome.repReward,
        source: 'contract',
      });
    }
  }

  const totalCp = Math.round(baseCp * streakMultiplier) + contractCp;

  const cpBreakdown: CpBreakdown = {
    placement: cpPlacement,
    stars: cpStars,
    isFarming,
    farmingPenaltyApplied: isFarming,
    streakMultiplier,
    baseCp,
    contractCp,
    totalCp,
    displayText: `Placement (${cpPlacement}) + Stars (${cpStars.toFixed(0)}) ${isFarming ? '(DR)' : ''} x Streak (${streakMultiplier.toFixed(2)})${contractCp > 0 ? ` + Contracts (${contractCp})` : ''}`,
  };

  // ─── Accolade checks ───────────────────────────────────────────────
  const accoladeUnlocks: AccoladeId[] = [];
  const checkAccolade = (id: AccoladeId) => {
    if (!profile.unlockedAccolades.includes(id)) {
      accoladeUnlocks.push(id);
    }
  };

  if (humanPlacement === 0) checkAccolade(AccoladeId.FirstVictory);
  if (rival && humanPlacement < rivalPlacement) checkAccolade(AccoladeId.RivalryBegins);

  const avgStars = humanPlayer.tileHistory.length > 0
    ? humanPlayer.tileHistory.reduce((sum, h) => sum + h.stars, 0) / humanPlayer.tileHistory.length
    : 0;
  if (avgStars >= 3) checkAccolade(AccoladeId.Perfectionist);
  if (humanPlayer.tileHistory.some(h => h.stars === 4)) checkAccolade(AccoladeId.Overdriver);

  const hazardTile = humanPlayer.tileHistory.find(h => {
    const tile = resolveHistoryTile(gameState.run, h.tileIndex, isZeroIndexedHistory);
    return tile && tile.isHazard;
  });
  if (hazardTile && hazardTile.stars >= 3) checkAccolade(AccoladeId.HazardousDuty);

  if (Object.values(ChassisId).every(id => profile.unlockedChassis.includes(id))) {
    checkAccolade(AccoladeId.Collector);
  }

  // ComebackKing: win after being in last place at the halfway point
  if (humanPlacement === 0 && gameState.players.length > 1) {
    const halfwayIndex = Math.floor(gameState.run.length / 2);
    const positionsAtHalfway = gameState.players.map(p => {
      const tilesPlayed = p.tileHistory.filter(t => t.tileIndex <= halfwayIndex);
      const starsAtHalfway = tilesPlayed.reduce((sum, t) => sum + t.stars, 0);
      return { playerId: p.id, stars: starsAtHalfway };
    }).sort((a, b) => b.stars - a.stars);
    const humanRankAtHalfway = positionsAtHalfway.findIndex(p => p.playerId === humanPlayer.id);
    if (humanRankAtHalfway === positionsAtHalfway.length - 1) {
      checkAccolade(AccoladeId.ComebackKing);
    }
  }

  // PowerPlayer: use 5+ power-ups in a single race
  if (humanPlayer.powerUpsUsed && humanPlayer.powerUpsUsed >= 5) {
    checkAccolade(AccoladeId.PowerPlayer);
  }

  // ─── Rival delta ───────────────────────────────────────────────────
  const rivalDelta = rival
    ? { wins: rivalDefeated ? 1 : 0, losses: rivalDefeated ? 0 : 1 }
    : null;

  // ─── Daily challenge ───────────────────────────────────────────────
  let dailyPersonalBest: number | null = null;
  let dailyIsNewBest = false;
  if (isDaily) {
    const playerPosition = humanPlayer.position;
    if (currentDailyBest === null || playerPosition > currentDailyBest) {
      dailyPersonalBest = playerPosition;
      dailyIsNewBest = true;
    } else {
      dailyPersonalBest = currentDailyBest;
      dailyIsNewBest = false;
    }
  }

  // ─── Ranked rating computation ─────────────────────────────────────
  let ratingChange: number | null = null;
  let newRating: number | null = null;
  let newTier: RankInfo['tier'] | null = null;
  const isRankedMatch = input.rankedContext ? input.rankedContext.isRanked : Boolean(gameState.isRanked);

  if (isRankedMatch) {
    const participants = input.rankedContext?.participants ?? sortedPlayers
      .filter(p => !p.isBot)
      .map((p) => ({
        playerId: p.id,
        rating: p.id === humanPlayer.id ? (profile.rank?.rating ?? DEFAULT_RATING) : DEFAULT_RATING,
        placement: sortedPlayers.indexOf(p) + 1,
      }));
    if (participants.length >= 2) {
      const changes = computeMultiPlayerRatingChanges(participants);
      const delta = changes.get(humanPlayer.id) ?? 0;
      const baseRank = profile.rank ?? createDefaultRankInfo();
      const updatedRank = applyRatingChange(baseRank, delta, humanPlacement === 0);
      ratingChange = delta;
      newRating = updatedRank.rating;
      newTier = updatedRank.tier;
    } else {
      ratingChange = 0;
      newRating = profile.rank?.rating ?? DEFAULT_RATING;
      newTier = profile.rank?.tier ?? ratingToTier(newRating);
    }
  }

  // ─── Team placement ────────────────────────────────────────────────
  let teamPlacement: number | undefined;
  if (humanPlayer.teamId) {
    const teamStandings = getTeamPositions(gameState.players).sort((a, b) => b.position - a.position);
    const idx = teamStandings.findIndex(t => t.teamId === humanPlayer.teamId);
    if (idx >= 0) teamPlacement = idx + 1;
  }

  return {
    matchId, mode, completedAt: timestamp, seed: settings.seed,
    runLength: gameState.run.length, isGauntlet: false, isDaily,
    standings, humanPlacement, humanPlayerId: humanPlayer.id,
    cp: cpBreakdown,
    streakDelta: { oldStreak: profile.winStreak, newStreak: newWinStreak },
    sponsorshipDeltas,
    rivalDelta,
    accoladeUnlocks,
    contractOutcomes,
    gauntletTilesSurvived: null,
    gauntletNewHighScore: false,
    dailyPersonalBest,
    dailyIsNewBest,
    eventMasteryUpdates: computeEventMastery(gameState, humanPlayer, profile),
    ratingChange,
    newRating,
    newTier,
    teamId: humanPlayer.teamId,
    teamPlacement,
  };
}

// ─── Profile application (idempotent) ───────────────────────────────────────

/** Maximum number of applied match IDs to retain (prevents unbounded growth). */
const MAX_APPLIED_MATCH_IDS = 50;

/**
 * Apply a MatchSummary to a PilotProfile.
 * Returns the updated profile, or null if this summary was already applied.
 * Pure function — caller is responsible for persistence.
 */
export function applyMatchSummaryToProfile(
  profile: PilotProfile,
  summary: MatchSummary,
): PilotProfile | null {
  // ─── Idempotency guard ──────────────────────────────────────────────
  const appliedIds = profile.appliedMatchIds ?? [];
  if (appliedIds.includes(summary.matchId)) {
    return null; // Already applied — skip
  }

  const updated: PilotProfile = JSON.parse(JSON.stringify(profile)); // deep clone

  // Record this match as applied (bounded FIFO)
  if (!updated.appliedMatchIds) updated.appliedMatchIds = [];
  updated.appliedMatchIds.push(summary.matchId);
  if (updated.appliedMatchIds.length > MAX_APPLIED_MATCH_IDS) {
    updated.appliedMatchIds = updated.appliedMatchIds.slice(-MAX_APPLIED_MATCH_IDS);
  }

  // ─── Gauntlet ───────────────────────────────────────────────────────
  if (summary.isGauntlet) {
    if (summary.gauntletNewHighScore && summary.gauntletTilesSurvived !== null) {
      updated.gauntletHighScore = summary.gauntletTilesSurvived;
    }
    return updated;
  }

  // ─── CP ─────────────────────────────────────────────────────────────
  updated.circuitPoints += summary.cp.totalCp;
  if (updated.skills) {
    updated.skills.availableCP = updated.circuitPoints;
  }

  // ─── Win streak ─────────────────────────────────────────────────────
  updated.winStreak = summary.streakDelta.newStreak;

  // ─── Rival W/L ──────────────────────────────────────────────────────
  if (summary.rivalDelta) {
    updated.rivalData.wins += summary.rivalDelta.wins;
    updated.rivalData.losses += summary.rivalDelta.losses;
  }

  // ─── Daily Challenge (bounded to 90 most recent days) ─────────────────
  if (summary.isDaily && summary.dailyIsNewBest && summary.dailyPersonalBest !== null) {
    if (!updated.dailyBests) {
      updated.dailyBests = {};
    }
    updated.dailyBests[summary.seed] = summary.dailyPersonalBest;
    const keys = Object.keys(updated.dailyBests).sort();
    if (keys.length > 90) {
      for (const oldKey of keys.slice(0, keys.length - 90)) {
        delete updated.dailyBests[oldKey];
      }
    }
  }

  // ─── Sponsorship reputation ───────────────────────────────────────────
  for (const delta of summary.sponsorshipDeltas) {
    const sponsorship = updated.sponsorships[delta.corpId];
    if (sponsorship) {
      sponsorship.reputation += delta.repChange;
    }
  }

  // ─── Accolades ──────────────────────────────────────────────────────
  for (const accoladeId of summary.accoladeUnlocks) {
    if (!updated.unlockedAccolades.includes(accoladeId)) {
      updated.unlockedAccolades.push(accoladeId);
    }
  }

  // ─── v5.0: Event Mastery ────────────────────────────────────────────
  if (summary.eventMasteryUpdates.length > 0) {
    if (!updated.eventMastery) updated.eventMastery = {};
    for (const update of summary.eventMasteryUpdates) {
      updated.eventMastery[update.eventId] = update.mastery;
    }
  }

  // ─── v5.0: Ranked Rating ────────────────────────────────────────────
  if (summary.ratingChange !== null && summary.newRating !== null) {
    if (!updated.rank) updated.rank = createDefaultRankInfo();
    const won = summary.humanPlacement === 0;
    updated.rank = applyRatingChange(updated.rank, summary.ratingChange, won);
  }

  updated.revision = (updated.revision ?? 0) + 1;

  return updated;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a Tile from gameState.run given a tileHistory entry's tileIndex.
 * Supports both 0-indexed runtime tileHistory (where tile 0 has tileIndex=0)
 * and 1-indexed test fixtures (where tile 0 has tileIndex=1).
 */
export function resolveHistoryTile(
  run: Tile[],
  historyTileIndex: number,
  isZeroIndexed: boolean
): Tile | undefined {
  if (isZeroIndexed) {
    return run[historyTileIndex];
  }
  return run[historyTileIndex - 1] ?? run[historyTileIndex];
}

function evaluateContractsForSummary(
  contracts: Contract[],
  gameState: GameState,
  humanPlayer: Player,
  sortedPlayers: Player[],
  eventDimensionMap: Record<string, string>,
): ContractOutcome[] {
  const humanRank = sortedPlayers.indexOf(humanPlayer) + 1;
  const avgStars = humanPlayer.tileHistory.length > 0
    ? humanPlayer.tileHistory.reduce((s, h) => s + h.stars, 0) / humanPlayer.tileHistory.length
    : 0;
  const isZeroIndexed = humanPlayer.tileHistory.some(h => h.tileIndex === 0);

  return contracts.map(contract => {
    const evaluatedObjectives = contract.objectives.map(obj => {
      let isComplete = false;
      switch (obj.type) {
        case 'FINISH_RACE_IN_POS':
          isComplete = humanRank <= obj.targetValue;
          break;
        case 'AVG_STARS_ABOVE':
          isComplete = avgStars >= obj.targetValue;
          break;
        case 'GET_STARS_IN_DIMENSION':
          if (obj.dimension) {
            isComplete = humanPlayer.tileHistory.some(h => {
              const tile = resolveHistoryTile(gameState.run, h.tileIndex, isZeroIndexed);
              if (!tile) return false;
              return eventDimensionMap[tile.eventId] === obj.dimension && h.stars >= obj.targetValue;
            });
          }
          break;
      }
      return { ...obj, isComplete };
    });

    const allComplete = evaluatedObjectives.every(o => o.isComplete);
    return {
      corporationId: contract.corporationId,
      objectives: evaluatedObjectives,
      cpReward: contract.cpReward,
      repReward: contract.repReward,
      allComplete,
    };
  });
}

function emptyCpBreakdown(): CpBreakdown {
  return {
    placement: 0, stars: 0, isFarming: false, farmingPenaltyApplied: false,
    streakMultiplier: 1, baseCp: 0, contractCp: 0, totalCp: 0, displayText: '',
  };
}

function computeEventMastery(
  gameState: GameState,
  humanPlayer: Player,
  profile: PilotProfile,
): { eventId: string; mastery: EventMastery }[] {
  const existingMastery = profile.eventMastery ?? {};
  const workingMastery: Record<string, EventMastery> = {};
  const isZeroIndexed = humanPlayer.tileHistory.some(h => h.tileIndex === 0);

  for (const history of humanPlayer.tileHistory) {
    const tile = resolveHistoryTile(gameState.run, history.tileIndex, isZeroIndexed);
    if (!tile) continue;
    const eventId = tile.eventId;
    const current: EventMastery = workingMastery[eventId] ?? existingMastery[eventId] ?? {
      eventId,
      totalPlays: 0,
      totalStars: 0,
      bestMetric: 0,
      masteryLevel: 0,
    };

    const newTotalPlays = current.totalPlays + 1;
    const newTotalStars = current.totalStars + history.stars;
    const avgStars = newTotalStars / newTotalPlays;
    const newMasteryLevel = Math.min(5, Math.floor(avgStars * 1.5));
    const bestMetric = typeof history.primaryMetric === 'number' && history.primaryMetric > 0
      ? (current.bestMetric === 0 ? history.primaryMetric : Math.max(current.bestMetric, history.primaryMetric))
      : current.bestMetric;

    workingMastery[eventId] = {
      eventId,
      totalPlays: newTotalPlays,
      totalStars: newTotalStars,
      bestMetric,
      masteryLevel: newMasteryLevel,
    };
  }

  return Object.entries(workingMastery).map(([eventId, mastery]) => ({
    eventId,
    mastery,
  }));
}

function createEmptySummary(
  matchId: string, mode: MatchMode, timestamp: number, seed: string,
  runLength: number, isGauntlet: boolean, isDaily: boolean,
): MatchSummary {
  return {
    matchId, mode, completedAt: timestamp, seed, runLength, isGauntlet, isDaily,
    standings: [], humanPlacement: -1, humanPlayerId: -1,
    cp: emptyCpBreakdown(),
    streakDelta: { oldStreak: 0, newStreak: 0 },
    sponsorshipDeltas: [], rivalDelta: null, accoladeUnlocks: [],
    contractOutcomes: [],
    gauntletTilesSurvived: null, gauntletNewHighScore: false,
    dailyPersonalBest: null, dailyIsNewBest: false,
    eventMasteryUpdates: [],
    ratingChange: null, newRating: null, newTier: null,
  };
}

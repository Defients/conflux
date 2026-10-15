/**
 * shared/rankSystem.ts
 *
 * ELO-based rating system for ranked online matches.
 * Portable: no React, no browser APIs.
 */

import { RankTier, RankInfo } from './types';

// ─── Tier Thresholds ──────────────────────────────────────────────────────────

const TIER_THRESHOLDS: { tier: RankTier; min: number }[] = [
  { tier: 'bronze', min: 0 },
  { tier: 'silver', min: 1200 },
  { tier: 'gold', min: 1500 },
  { tier: 'platinum', min: 1800 },
  { tier: 'diamond', min: 2100 },
];

export const DEFAULT_RATING = 1000;
export const K_FACTOR = 32;

// ─── Tier Mapping ─────────────────────────────────────────────────────────────

export function ratingToTier(rating: number): RankTier {
  let tier: RankTier = 'bronze';
  for (const t of TIER_THRESHOLDS) {
    if (rating >= t.min) tier = t.tier;
  }
  return tier;
}

export function getTierIcon(tier: RankTier): string {
  switch (tier) {
    case 'bronze': return '🥉';
    case 'silver': return '🥈';
    case 'gold': return '🥇';
    case 'platinum': return '💎';
    case 'diamond': return '💠';
  }
}

export function getTierColor(tier: RankTier): string {
  switch (tier) {
    case 'bronze': return '#cd7f32';
    case 'silver': return '#c0c0c0';
    case 'gold': return '#ffd700';
    case 'platinum': return '#e5e4e2';
    case 'diamond': return '#b9f2ff';
  }
}

// ─── ELO Computation ──────────────────────────────────────────────────────────

/**
 * Compute ELO rating change for a single player.
 * Uses standard ELO formula with configurable K-factor.
 */
export function computeRatingChange(
  playerRating: number,
  opponentRating: number,
  score: number, // 1 = win, 0 = loss, 0.5 = draw
  k: number = K_FACTOR
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(k * (score - expectedScore));
}

/**
 * Compute rating changes for a multi-player race.
 * Each player is compared against the average rating of all other players.
 * Placement is 1-based (1 = 1st place, N = last place). If 0-based placements
 * (containing 0) are supplied, they are automatically normalized to 1-based.
 */
export function computeMultiPlayerRatingChanges(
  players: { playerId: number; rating: number; placement: number }[]
): Map<number, number> {
  const changes = new Map<number, number>();
  const totalPlayers = players.length;

  if (totalPlayers < 2) {
    for (const p of players) {
      changes.set(p.playerId, 0);
    }
    return changes;
  }

  const isZeroBased = players.some(p => p.placement <= 0);
  const normalized = players.map(p => ({
    ...p,
    rating: Number.isFinite(p.rating) ? p.rating : DEFAULT_RATING,
    placement: Math.max(1, Math.min(totalPlayers, isZeroBased ? p.placement + 1 : p.placement)),
  }));

  for (const player of normalized) {
    const others = normalized.filter(p => p.playerId !== player.playerId);
    if (others.length === 0) {
      changes.set(player.playerId, 0);
      continue;
    }
    const avgOpponentRating = others.reduce((sum, o) => sum + o.rating, 0) / others.length;

    // Convert 1-based placement to score: 1st = 1.0, last = 0.0, linear interpolation
    const score = (totalPlayers - player.placement) / (totalPlayers - 1);
    const change = computeRatingChange(player.rating, avgOpponentRating, score);
    changes.set(player.playerId, change);
  }

  return changes;
}

// ─── Rank Info Helpers ────────────────────────────────────────────────────────

export function createDefaultRankInfo(): RankInfo {
  return {
    rating: DEFAULT_RATING,
    tier: ratingToTier(DEFAULT_RATING),
    peakRating: DEFAULT_RATING,
    wins: 0,
    losses: 0,
  };
}

export function applyRatingChange(
  rank: RankInfo,
  change: number,
  won: boolean
): RankInfo {
  const newRating = Math.max(0, rank.rating + change);
  return {
    rating: newRating,
    tier: ratingToTier(newRating),
    peakRating: Math.max(rank.peakRating, newRating),
    wins: rank.wins + (won ? 1 : 0),
    losses: rank.losses + (won ? 0 : 1),
  };
}

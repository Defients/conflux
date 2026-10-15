/**
 * server/src/services/matchSummaryPipeline.ts
 *
 * Extracted from ConfluxRoom.finishRace — handles the per-player
 * post-match summary pipeline: profile update (transactional),
 * leaderboard writes, match history, and client notification.
 *
 * This keeps ConfluxRoom focused on room/state management while
 * the summary pipeline lives in a testable service module.
 */

import { Client } from 'colyseus';
import { ServerMessages } from '../../../shared/protocol';
import {
  GameState, Player, LeaderboardEntry, MatchHistoryEntry,
} from '../../../shared/types';
import {
  MatchSummary, computeMatchSummary, applyMatchSummaryToProfile,
} from '../../../shared/matchSummary';
import { DEFAULT_RATING } from '../../../shared/rankSystem';
import { generateContracts } from '../../../shared/contractService';
import { updateProfileTransaction, saveMatchReceipt } from './profileRepository';
import { writeLeaderboardEntry } from './leaderboardRepository';
import { writeMatchHistory } from './matchHistoryRepository';

/** Room player info needed for the summary pipeline. */
export interface RoomPlayerInfo {
  sessionId: string;
  playerId: number;
  userId: string | null;
  rating?: number;
}

/** Context for the summary pipeline. */
export interface SummaryPipelineContext {
  gameState: GameState;
  roomPlayers: RoomPlayerInfo[];
  sortedPlayers: Player[];
  eventDimensionMap: Record<string, string>;
  roomCode: string;
  /** Explicit ranked match flag (only true for ranked matchmaking rooms). */
  isRanked?: boolean;
  /** Optional explicit match ID and completion timestamp. */
  matchId?: string;
  completedAt?: number;
  /** Callback to find a client by sessionId (for sending match summary). */
  findClient: (sessionId: string) => Client | undefined;
}

/**
 * Run the per-player summary pipeline for a finished race.
 * Each human player gets:
 * 1. Single-pass atomic profile update + immutable MatchSummary receipt (transaction)
 * 2. Leaderboard entries (allTime, daily, gauntlet) from the exact committed summary
 * 3. Match history entry from the exact committed summary
 * 4. MATCH_SUMMARY message to their client with zero post-commit recomputation
 *
 * All tasks run in parallel via Promise.allSettled.
 */
export function runMatchSummaryPipeline(ctx: SummaryPipelineContext): Promise<Map<number, MatchSummary>> {
  const { gameState: gs, roomPlayers, sortedPlayers, eventDimensionMap, roomCode, findClient } = ctx;

  const completedAt = ctx.completedAt ?? Date.now();
  const matchId = ctx.matchId ?? gs.matchId ?? `${gs.settings.seed}-${completedAt}`;
  const dailySeed = new Date().toISOString().split('T')[0];
  const contracts = generateContracts(gs.settings.seed);
  const isRanked = ctx.isRanked !== undefined
    ? ctx.isRanked
    : (gs.isRanked !== undefined ? gs.isRanked : roomPlayers.some(rp => typeof rp.rating === 'number' && rp.rating > 0));

  // Build 1-based placement participant list for ranked ELO calculation
  const rankedParticipants = isRanked
    ? gs.players.map(p => {
        const rp = roomPlayers.find(r => r.playerId === p.id);
        return {
          playerId: p.id,
          rating: rp?.rating ?? DEFAULT_RATING,
          placement: Math.max(1, sortedPlayers.indexOf(p) + 1),
        };
      })
    : undefined;

  const deliveredSummaries = new Map<number, MatchSummary>();

  const summaryTasks = roomPlayers
    .filter((rp) => !!rp.userId)
    .map(async (roomPlayer) => {
      const gamePlayer = gs.players.find((p) => p.id === roomPlayer.playerId);
      if (!gamePlayer || gamePlayer.isBot) return;

      let committedSummary: MatchSummary | null = null;

      // Use a Firestore transaction for atomic read-modify-write.
      // Compute MatchSummary ONCE inside the transaction against the pre-match profile.
      const updatedProfile = await updateProfileTransaction(roomPlayer.userId!, (currentProfile) => {
        if (!currentProfile) {
          console.log(`[Room ${roomCode}] No profile for ${roomPlayer.userId} — skipping summary.`);
          return null;
        }

        const currentDailyBest = currentProfile.dailyBests?.[dailySeed] ?? null;
        const participantsForPlayer = rankedParticipants?.map(pt =>
          pt.playerId === roomPlayer.playerId
            ? { ...pt, rating: currentProfile.rank?.rating ?? pt.rating }
            : pt
        );

        const summary = computeMatchSummary({
          gameState: gs,
          profile: currentProfile,
          mode: 'online',
          contracts,
          eventDimensionMap,
          dailySeed,
          currentDailyBest,
          timestamp: completedAt,
          matchId,
          targetPlayerId: roomPlayer.playerId,
          rankedContext: {
            isRanked,
            participants: participantsForPlayer,
          },
        });

        const newProfile = applyMatchSummaryToProfile(currentProfile, summary);
        if (!newProfile) {
          console.log(`[Room ${roomCode}] Match ${summary.matchId} already applied for ${roomPlayer.userId}.`);
          return null;
        }

        committedSummary = summary;
        return newProfile;
      });

      if (!updatedProfile || !committedSummary) return;

      // Deliver and project the exact summary committed in the transaction (NEVER recompute).
      const summary: MatchSummary = committedSummary;
      deliveredSummaries.set(roomPlayer.playerId, summary);

      // Persist immutable receipt for reconnect recovery
      await saveMatchReceipt(roomPlayer.userId!, summary);

      // Write leaderboard entries
      const lbEntry: LeaderboardEntry = {
        userId: roomPlayer.userId!,
        playerName: updatedProfile.name,
        avatarId: updatedProfile.avatarId,
        circuitPoints: updatedProfile.circuitPoints,
        bestScore: summary.humanPlacement === 0 ? 1 : 0,
        updatedAt: completedAt,
      };
      await writeLeaderboardEntry('allTime', lbEntry);

      if (summary.isDaily && summary.dailyIsNewBest && summary.dailyPersonalBest !== null) {
        await writeLeaderboardEntry('daily', { ...lbEntry, bestScore: summary.dailyPersonalBest }, dailySeed);
      }

      if (summary.isGauntlet && summary.gauntletNewHighScore && summary.gauntletTilesSurvived !== null) {
        await writeLeaderboardEntry('gauntlet', { ...lbEntry, bestScore: summary.gauntletTilesSurvived });
      }

      // Write match history
      const historyEntry: MatchHistoryEntry = {
        matchId: summary.matchId,
        seed: summary.seed,
        mode: 'online',
        completedAt: summary.completedAt,
        runLength: summary.runLength,
        placement: summary.humanPlacement + 1,
        totalPlayers: gs.players.length,
        cpEarned: summary.cp.totalCp,
        isDaily: summary.isDaily,
        isGauntlet: summary.isGauntlet,
        rivalDefeated: summary.rivalDelta?.wins === 1,
        gauntletTilesSurvived: summary.gauntletTilesSurvived,
        ...(summary.ratingChange !== null ? { ratingChange: summary.ratingChange } : {}),
        ...(summary.newRating !== null ? { newRating: summary.newRating } : {}),
        ...(summary.teamId ? { teamId: summary.teamId } : {}),
      };
      await writeMatchHistory(roomPlayer.userId!, historyEntry);

      const client = findClient(roomPlayer.sessionId);
      if (client) {
        client.send(ServerMessages.MATCH_SUMMARY, { summary });
      }
    });

  return Promise.allSettled(summaryTasks).then((results) => {
    results.forEach((r) => {
      if (r.status === 'rejected') {
        console.error(`[Room ${roomCode}] Summary pipeline error:`, r.reason);
      }
    });
    return deliveredSummaries;
  });
}

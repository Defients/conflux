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
  GameState, Player, PilotProfile, LeaderboardEntry, MatchHistoryEntry,
} from '../../../shared/types';
import {
  computeMatchSummary, applyMatchSummaryToProfile,
} from '../../../shared/matchSummary';
import {
  computeMultiPlayerRatingChanges, applyRatingChange, createDefaultRankInfo,
} from '../../../shared/rankSystem';
import { generateContracts } from '../../../shared/contractService';
import { updateProfileTransaction } from './profileRepository';
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
  /** Callback to find a client by sessionId (for sending match summary). */
  findClient: (sessionId: string) => Client | undefined;
}

/**
 * Run the per-player summary pipeline for a finished race.
 * Each human player gets:
 * 1. Atomic profile update (transaction)
 * 2. Leaderboard entries (allTime, daily, gauntlet)
 * 3. Match history entry
 * 4. MATCH_SUMMARY message to their client
 *
 * All tasks run in parallel via Promise.allSettled.
 */
export function runMatchSummaryPipeline(ctx: SummaryPipelineContext): void {
  const { gameState: gs, roomPlayers, sortedPlayers, eventDimensionMap, roomCode, findClient } = ctx;

  const dailySeed = new Date().toISOString().split('T')[0];
  const contracts = generateContracts(gs.settings.seed);

  const summaryTasks = roomPlayers
    .filter((rp) => !!rp.userId)
    .map(async (roomPlayer) => {
      const gamePlayer = gs.players.find((p) => p.id === roomPlayer.playerId);
      if (!gamePlayer || gamePlayer.isBot) return;

      // Use a Firestore transaction for atomic read-modify-write.
      const updatedProfile = await updateProfileTransaction(roomPlayer.userId!, (currentProfile) => {
        if (!currentProfile) {
          console.log(`[Room ${roomCode}] No profile for ${roomPlayer.userId} — skipping summary.`);
          return null;
        }

        const currentDailyBest = currentProfile.dailyBests?.[dailySeed] ?? null;
        const summary = computeMatchSummary({
          gameState: gs,
          profile: currentProfile,
          mode: 'online',
          contracts,
          eventDimensionMap,
          dailySeed,
          currentDailyBest,
          targetPlayerId: roomPlayer.playerId,
        });

        const newProfile = applyMatchSummaryToProfile(currentProfile, summary);
        if (!newProfile) {
          console.log(`[Room ${roomCode}] Match ${summary.matchId} already applied for ${roomPlayer.userId}.`);
          return null;
        }

        // Compute ranked rating changes if this was a ranked match
        if (roomPlayer.rating) {
          const allPlayers = gs.players.map((p) => {
            const rp = roomPlayers.find((r) => r.playerId === p.id);
            return { playerId: p.id, rating: rp?.rating ?? 1000, placement: sortedPlayers.indexOf(p) };
          });
          const ratingChanges = computeMultiPlayerRatingChanges(allPlayers);
          const myChange = ratingChanges.get(roomPlayer.playerId) ?? 0;
          if (myChange !== 0) {
            if (!newProfile.rank) newProfile.rank = createDefaultRankInfo();
            newProfile.rank = applyRatingChange(newProfile.rank, myChange, myChange > 0);
          }
        }

        return newProfile;
      });

      if (!updatedProfile) return;

      // Re-derive summary for leaderboard/history from the updated profile.
      const currentDailyBest = updatedProfile.dailyBests?.[dailySeed] ?? null;
      const summary = computeMatchSummary({
        gameState: gs,
        profile: updatedProfile,
        mode: 'online',
        contracts,
        eventDimensionMap,
        dailySeed,
        currentDailyBest,
        targetPlayerId: roomPlayer.playerId,
      });

      // Write leaderboard entries
      const lbEntry: LeaderboardEntry = {
        userId: roomPlayer.userId!,
        playerName: updatedProfile.name,
        avatarId: updatedProfile.avatarId,
        circuitPoints: updatedProfile.circuitPoints,
        bestScore: summary.humanPlacement === 0 ? 1 : 0,
        updatedAt: Date.now(),
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
      };
      await writeMatchHistory(roomPlayer.userId!, historyEntry);

      const client = findClient(roomPlayer.sessionId);
      if (client) {
        client.send(ServerMessages.MATCH_SUMMARY, { summary });
      }
    });

  Promise.allSettled(summaryTasks).then((results) => {
    results.forEach((r) => {
      if (r.status === 'rejected') {
        console.error(`[Room ${roomCode}] Summary pipeline error:`, r.reason);
      }
    });
  });
}

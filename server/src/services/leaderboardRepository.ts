import { db } from '../firebaseAdmin';
import { LeaderboardEntry, LeaderboardCategory } from '../../../shared/types';
import { withRetry } from './retry';

export const writeLeaderboardEntry = async (
  category: LeaderboardCategory,
  entry: LeaderboardEntry,
  dailySeed?: string,
): Promise<void> => {
  if (!db) return;
  try {
    await withRetry(async () => {
      let docPath: string;
      if (category === 'allTime') {
        docPath = `leaderboards/allTime/entries/${entry.userId}`;
      } else if (category === 'daily') {
        const seed = dailySeed ?? new Date().toISOString().split('T')[0];
        docPath = `leaderboards/daily/${seed}/entries/${entry.userId}`;
      } else {
        docPath = `leaderboards/gauntlet/entries/${entry.userId}`;
      }
      await db!.doc(docPath).set(entry, { merge: true });
    });
  } catch (err) {
    console.error('Error writing leaderboard entry:', err);
  }
};

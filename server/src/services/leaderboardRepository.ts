import { db } from '../firebaseAdmin';
import { LeaderboardEntry, LeaderboardCategory } from '../../../shared/types';
import { getLeaderboardDocPath, getLeaderboardCollectionSegments } from '../../../shared/constants';
import { withRetry } from './retry';

export { getLeaderboardDocPath, getLeaderboardCollectionSegments };

export const writeLeaderboardEntry = async (
  category: LeaderboardCategory,
  entry: LeaderboardEntry,
  dailySeed?: string,
): Promise<void> => {
  if (!db) return;
  try {
    await withRetry(async () => {
      const docPath = getLeaderboardDocPath(category, entry.userId, dailySeed);
      await db!.doc(docPath).set(entry, { merge: true });
    });
  } catch (err) {
    console.error('Error writing leaderboard entry:', err);
  }
};

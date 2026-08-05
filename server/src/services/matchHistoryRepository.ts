import { db } from '../firebaseAdmin';
import { MatchHistoryEntry } from '../../../shared/types';
import { withRetry } from './retry';

export const writeMatchHistory = async (userId: string, entry: MatchHistoryEntry): Promise<void> => {
  if (!db) return;
  try {
    await withRetry(() => db!.doc(`matchHistory/${userId}/matches/${entry.matchId}`).set(entry));
  } catch (err) {
    console.error('Error writing match history:', err);
  }
};

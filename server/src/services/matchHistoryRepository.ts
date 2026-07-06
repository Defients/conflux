import { db } from '../firebaseAdmin';
import { MatchHistoryEntry } from '../../../shared/types';

export const writeMatchHistory = async (userId: string, entry: MatchHistoryEntry): Promise<void> => {
  if (!db) return;
  try {
    await db.doc(`matchHistory/${userId}/matches/${entry.matchId}`).set(entry);
  } catch (err) {
    console.error('Error writing match history:', err);
  }
};

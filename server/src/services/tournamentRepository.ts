/**
 * server/src/services/tournamentRepository.ts
 *
 * Persists tournament brackets to Firestore so they survive server restarts.
 * Active tournaments (without a champion) are saved and can be restored.
 */

import { db } from '../firebaseAdmin';
import { TournamentBracket } from '../../../shared/types';
import { withRetry } from './retry';

/**
 * Save or update a tournament bracket in Firestore.
 * Uses the bracket ID as the document key.
 */
export const saveTournamentBracket = async (bracket: TournamentBracket): Promise<void> => {
  if (!db) return;
  try {
    await withRetry(() => db!.collection('tournaments').doc(bracket.id).set(bracket));
  } catch (err) {
    console.error('Error saving tournament bracket', bracket.id, err);
  }
};

/**
 * Load an active tournament bracket from Firestore by ID.
 * Returns null if not found or if the tournament is already complete.
 */
export const loadTournamentBracket = async (bracketId: string): Promise<TournamentBracket | null> => {
  if (!db) return null;
  try {
    return await withRetry(async () => {
      const docSnap = await db!.collection('tournaments').doc(bracketId).get();
      if (docSnap.exists) {
        const bracket = docSnap.data() as TournamentBracket;
        // Don't restore completed tournaments
        if (bracket.champion) return null;
        return bracket;
      }
      return null;
    });
  } catch (err) {
    console.error('Error loading tournament bracket', bracketId, err);
    return null;
  }
};

/**
 * Delete a tournament bracket from Firestore.
 * Called when a tournament completes (champion declared) or is abandoned.
 */
export const deleteTournamentBracket = async (bracketId: string): Promise<void> => {
  if (!db) return;
  try {
    await withRetry(() => db!.collection('tournaments').doc(bracketId).delete());
  } catch (err) {
    console.error('Error deleting tournament bracket', bracketId, err);
  }
};

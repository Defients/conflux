import { db } from '../firebaseAdmin';
import { PilotProfile } from '../../../shared/types';
import { MatchSummary } from '../../../shared/matchSummary';
import { withRetry } from './retry';

/** In-memory LRU-bounded receipt cache so receipts are recoverable even without Firestore. */
const memoryReceipts = new Map<string, MatchSummary>();
const MAX_MEMORY_RECEIPTS = 500;

export const saveMatchReceipt = async (userId: string, summary: MatchSummary): Promise<void> => {
  const key = `${userId}:${summary.matchId}`;
  memoryReceipts.set(key, summary);
  if (memoryReceipts.size > MAX_MEMORY_RECEIPTS) {
    const oldestKey = memoryReceipts.keys().next().value;
    if (oldestKey) memoryReceipts.delete(oldestKey);
  }
  if (!db) return;
  try {
    await withRetry(() =>
      db!.doc(`matchReceipts/${userId}/receipts/${summary.matchId}`).set({
        ...summary,
        persistedAt: Date.now(),
      })
    );
  } catch (err) {
    console.error('Error saving match receipt for user', userId, err);
  }
};

export const getMatchReceipt = async (userId: string, matchId: string): Promise<MatchSummary | null> => {
  const key = `${userId}:${matchId}`;
  const cached = memoryReceipts.get(key);
  if (cached) return cached;
  if (!db) return null;
  try {
    return await withRetry(async () => {
      const snap = await db!.doc(`matchReceipts/${userId}/receipts/${matchId}`).get();
      if (snap.exists) {
        return snap.data() as MatchSummary;
      }
      return null;
    });
  } catch (err) {
    console.error('Error fetching match receipt for user', userId, err);
    return null;
  }
};

export const getProfile = async (userId: string): Promise<PilotProfile | null> => {
  if (!db) return null;
  try {
    return await withRetry(async () => {
      const docSnap = await db!.collection('profiles').doc(userId).get();
      if (docSnap.exists) {
        return docSnap.data() as PilotProfile;
      }
      return null;
    });
  } catch (err) {
    console.error('Error fetching profile for user', userId, err);
    return null;
  }
};

export const saveProfile = async (userId: string, profile: PilotProfile): Promise<void> => {
  if (!db) return;
  try {
    await withRetry(() => db!.collection('profiles').doc(userId).set(profile));
  } catch (err) {
    console.error('Error saving profile for user', userId, err);
  }
};

/**
 * Atomically update a profile using a Firestore transaction.
 * Reads the current profile, applies the update function, and writes the result.
 * If the profile doesn't exist, the update function receives null.
 *
 * @param userId - The user's Firebase Auth UID.
 * @param updateFn - Function that takes the current profile and returns the updated profile.
 * @returns The updated profile, or null if the profile doesn't exist and updateFn returns null.
 */
export const updateProfileTransaction = async (
  userId: string,
  updateFn: (current: PilotProfile | null) => PilotProfile | null
): Promise<PilotProfile | null> => {
  if (!db) return null;
  try {
    return await withRetry(async () => {
      const docRef = db!.collection('profiles').doc(userId);
      return await db!.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(docRef);
        const current = docSnap.exists ? (docSnap.data() as PilotProfile) : null;
        const updated = updateFn(current);
        if (updated) {
          transaction.set(docRef, updated);
        }
        return updated;
      });
    });
  } catch (err) {
    console.error('Error in profile transaction for user', userId, err);
    return null;
  }
};

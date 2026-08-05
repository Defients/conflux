import { db } from '../firebaseAdmin';
import { PilotProfile } from '../../../shared/types';
import { withRetry } from './retry';

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

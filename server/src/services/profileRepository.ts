import { db } from '../firebaseAdmin';
import { PilotProfile } from '../../../shared/types';

export const getProfile = async (userId: string): Promise<PilotProfile | null> => {
  if (!db) return null;
  try {
    const docSnap = await db.collection('profiles').doc(userId).get();
    if (docSnap.exists) {
      return docSnap.data() as PilotProfile;
    }
  } catch (err) {
    console.error('Error fetching profile for user', userId, err);
  }
  return null;
};

export const saveProfile = async (userId: string, profile: PilotProfile): Promise<void> => {
  if (!db) return;
  try {
    await db.collection('profiles').doc(userId).set(profile);
  } catch (err) {
    console.error('Error saving profile for user', userId, err);
  }
};

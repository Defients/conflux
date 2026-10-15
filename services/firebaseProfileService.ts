import { PilotProfile } from '../shared/types';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { loadProfile as loadLocalProfile, saveProfile as saveLocalProfile } from './profileService';

/**
 * Cloud profile authority model:
 *  - Progression fields (circuitPoints, rank, skills, unlocks, mastery, …) are
 *    server-owned. Firestore rules reject any client write that modifies them.
 *  - Clients may only write cosmetic/identity keys. Server-side endpoints
 *    (match summaries, purchases) apply progression inside transactions.
 */
const cosmeticPayload = (profile: PilotProfile, uid: string) => ({
  name: profile.name,
  avatarId: profile.avatarId,
  firebaseUid: uid,
  revision: profile.revision ?? 0,
  onboardingComplete: profile.onboardingComplete ?? false,
});

export const syncProfile = async (profile: PilotProfile) => {
  const uid = auth?.currentUser?.uid;
  const boundProfile: PilotProfile = uid
    ? { ...profile, firebaseUid: profile.firebaseUid ?? uid, revision: (profile.revision ?? 0) + 1 }
    : profile;
  if (!uid || !db) return saveLocalProfile(boundProfile);
  // Only sync to cloud if this local pilot is bound to the current Firebase session (or unbound)
  if (boundProfile.firebaseUid && boundProfile.firebaseUid !== uid) {
    return saveLocalProfile(boundProfile);
  }
  try {
    const docRef = doc(db, 'profiles', uid);
    await setDoc(docRef, cosmeticPayload(boundProfile, uid), { merge: true });
    saveLocalProfile(boundProfile);
  } catch (err) {
    console.error('Error syncing profile to Firebase', err);
    saveLocalProfile(boundProfile);
  }
};

export const syncProfileMerge = syncProfile;

export const fetchProfile = async (): Promise<PilotProfile | null> => {
  const local = loadLocalProfile();
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return local;
  // If an active local profile exists and is already bound to a DIFFERENT Firebase UID,
  // do not overwrite the switched local pilot with a different cloud document.
  if (local && local.firebaseUid && local.firebaseUid !== uid) {
    return local;
  }
  try {
    const docRef = doc(db, 'profiles', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const cloudProfile = { ...(docSnap.data() as PilotProfile), firebaseUid: uid };
      if (local && (local.revision ?? 0) > (cloudProfile.revision ?? 0)) {
        // Local cosmetics are newer — keep them, but progression fields come
        // from the cloud document since those are server-authoritative.
        const merged: PilotProfile = {
          ...cloudProfile,
          name: local.name,
          avatarId: local.avatarId,
          onboardingComplete: local.onboardingComplete,
          revision: local.revision,
          firebaseUid: uid,
        };
        saveLocalProfile(merged);
        return merged;
      }
      saveLocalProfile(cloudProfile);
      return cloudProfile;
    } else if (local && !local.firebaseUid) {
      const boundLocal = { ...local, firebaseUid: uid };
      saveLocalProfile(boundLocal);
      return boundLocal;
    }
  } catch (err) {
    console.error('Error fetching profile from Firebase', err);
  }
  return local;
};

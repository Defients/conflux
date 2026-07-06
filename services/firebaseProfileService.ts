import { PilotProfile } from '../shared/types';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { loadProfile as loadLocalProfile, saveProfile as saveLocalProfile } from './profileService';

export const syncProfile = async (profile: PilotProfile) => {
  if (!auth?.currentUser || !db) return saveLocalProfile(profile);
  try {
    const docRef = doc(db, 'profiles', auth.currentUser.uid);
    await setDoc(docRef, profile);
    saveLocalProfile(profile);
  } catch (err) {
    console.error('Error syncing profile to Firebase', err);
    saveLocalProfile(profile);
  }
};

export const syncProfileMerge = async (profile: PilotProfile) => {
  if (!auth?.currentUser || !db) return saveLocalProfile(profile);
  try {
    const docRef = doc(db, 'profiles', auth.currentUser.uid);
    await setDoc(docRef, profile, { merge: true });
    saveLocalProfile(profile);
  } catch (err) {
    console.error('Error merge-syncing profile to Firebase', err);
    saveLocalProfile(profile);
  }
};

export const fetchProfile = async (): Promise<PilotProfile | null> => {
  if (!auth?.currentUser || !db) return loadLocalProfile();
  try {
    const docRef = doc(db, 'profiles', auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = docSnap.data() as PilotProfile;
      saveLocalProfile(profile);
      return profile;
    }
  } catch (err) {
    console.error('Error fetching profile from Firebase', err);
  }
  return loadLocalProfile();
};


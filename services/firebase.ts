import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut as firebaseSignOut, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'MOCK_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mock-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mock-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000:web:abcdef'
};

const isMock = firebaseConfig.apiKey === 'MOCK_API_KEY';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (!isMock) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error('Failed to initialize Firebase:', err);
  }
}

export { app, auth, db, isMock };

export const signIn = async () => {
  if (isMock || !auth) {
    console.warn('Firebase is using mock config or failed to init. Skipping auth.');
    return null;
  }
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in anonymously', error);
    return null;
  }
};

export const signOut = async () => {
  if (isMock || !auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};

export const resetAnonymousSession = async () => {
  await signOut();
  return signIn();
};

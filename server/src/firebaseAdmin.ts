import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  db = admin.firestore();
} catch {
  console.warn('[Firebase] Admin SDK init skipped — GOOGLE_APPLICATION_CREDENTIALS not configured. Profile persistence disabled.');
}

export { db, admin };

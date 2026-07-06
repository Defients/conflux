/**
 * services/firebaseGhostService.ts
 *
 * Firestore CRUD for async PvP ghost runs.
 */

import { collection, query, where, orderBy, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { GhostRun } from '../types';

const GHOSTS_COLLECTION = 'ghosts';

/**
 * Submit a ghost run to Firestore.
 */
export async function submitGhostRun(
  userId: string,
  ghost: Omit<GhostRun, 'ghostId' | 'userId' | 'submittedAt'>
): Promise<string | null> {
  if (!db) return null;
  try {
    const ghostId = `${userId}-${ghost.seed}-${Date.now()}`;
    const data: GhostRun = {
      ...ghost,
      ghostId,
      userId,
      submittedAt: Date.now(),
    };
    await setDoc(doc(db, GHOSTS_COLLECTION, ghostId), data);
    return ghostId;
  } catch (err) {
    console.error('[firebaseGhostService] Failed to submit ghost run:', err);
    return null;
  }
}

/**
 * Fetch ghost runs matching a specific seed.
 */
export async function fetchGhostRuns(seed: string, limitCount = 5): Promise<GhostRun[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, GHOSTS_COLLECTION),
      where('seed', '==', seed),
      orderBy('ownerCircuitPoints', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as GhostRun);
  } catch (err) {
    console.error('[firebaseGhostService] Failed to fetch ghost runs:', err);
    return [];
  }
}

/**
 * Fetch a random ghost run (for daily challenge opponents).
 */
export async function fetchRandomGhost(): Promise<GhostRun | null> {
  if (!db) return null;
  try {
    const q = query(
      collection(db, GHOSTS_COLLECTION),
      limit(20)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const ghosts = snapshot.docs.map(d => d.data() as GhostRun);
    return ghosts[Math.floor(Math.random() * ghosts.length)];
  } catch (err) {
    console.error('[firebaseGhostService] Failed to fetch random ghost:', err);
    return null;
  }
}

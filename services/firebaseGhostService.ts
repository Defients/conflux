/**
 * services/firebaseGhostService.ts
 *
 * Firestore CRUD for async PvP ghost runs.
 */

import { collection, query, where, orderBy, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { GhostRun } from '../types';
import { SeededRNG } from '../shared/seededRNG';

const GHOSTS_COLLECTION = 'ghosts';
const GHOST_SCHEMA_VERSION = 1;

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
      schemaVersion: ghost.schemaVersion ?? GHOST_SCHEMA_VERSION,
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
    // Preferred path: index-backed query (requires the composite index from
    // firestore.indexes.json — deploy with `firebase deploy --only firestore`).
    const q = query(
      collection(db, GHOSTS_COLLECTION),
      where('seed', '==', seed),
      orderBy('ownerCircuitPoints', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as GhostRun);
  } catch (err) {
    // Degrade gracefully when the composite index isn't deployed yet: fetch
    // an unordered page for the seed and sort client-side.
    try {
      const fallback = query(
        collection(db, GHOSTS_COLLECTION),
        where('seed', '==', seed),
        limit(limitCount * 4)
      );
      const snapshot = await getDocs(fallback);
      return snapshot.docs
        .map(d => d.data() as GhostRun)
        .sort((a, b) => (b.ownerCircuitPoints ?? 0) - (a.ownerCircuitPoints ?? 0))
        .slice(0, limitCount);
    } catch (fallbackErr) {
      console.error('[firebaseGhostService] Failed to fetch ghost runs:', fallbackErr ?? err);
      return [];
    }
  }
}

/**
 * Fetch a ghost run preferring matching runLength and seed when available.
 */
export async function fetchRandomGhost(runLength?: number, seed?: string): Promise<GhostRun | null> {
  if (!db) return null;
  try {
    const q = query(
      collection(db, GHOSTS_COLLECTION),
      limit(20)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const allGhosts = snapshot.docs
      .map(d => d.data() as GhostRun)
      .filter(g => g && Array.isArray(g.tileResults) && g.tileResults.length > 0 && typeof g.seed === 'string');
    if (allGhosts.length === 0) return null;

    const matchingLength = typeof runLength === 'number'
      ? allGhosts.filter(g => g.runLength === runLength)
      : [];
    const pool = matchingLength.length > 0 ? matchingLength : allGhosts;
    const rng = new SeededRNG(`ghost-pick-${seed ?? runLength ?? pool.length}`);
    return pool[rng.nextInt(0, pool.length)];
  } catch (err) {
    console.error('[firebaseGhostService] Failed to fetch random ghost:', err);
    return null;
  }
}

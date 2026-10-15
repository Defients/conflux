import { db, isMock } from './firebase';
import { LeaderboardEntry, LeaderboardCategory } from '../shared/types';
import { getLeaderboardCollectionSegments } from '../shared/constants';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export { getLeaderboardCollectionSegments };

const MAX_ENTRIES = 50;

export async function fetchLeaderboard(category: LeaderboardCategory, dailySeed?: string): Promise<LeaderboardEntry[]> {
  if (isMock || !db) return [];
  try {
    const [col, docId, subcol] = getLeaderboardCollectionSegments(category, dailySeed);
    const sortField = category === 'allTime' ? 'circuitPoints' : 'bestScore';
    const q = query(collection(db, col, docId, subcol), orderBy(sortField, 'desc'), limit(MAX_ENTRIES));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as LeaderboardEntry);
  } catch (err) {
    console.error('Failed to fetch leaderboard:', err);
    return [];
  }
}

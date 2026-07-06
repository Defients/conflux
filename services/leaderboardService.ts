import { db, isMock } from './firebase';
import { LeaderboardEntry, LeaderboardCategory } from '../shared/types';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const MAX_ENTRIES = 50;

export async function fetchLeaderboard(category: LeaderboardCategory, dailySeed?: string): Promise<LeaderboardEntry[]> {
  if (isMock || !db) return [];
  try {
    let q;
    if (category === 'allTime') {
      q = query(collection(db, 'leaderboards', 'allTime', 'entries'), orderBy('circuitPoints', 'desc'), limit(MAX_ENTRIES));
    } else if (category === 'daily') {
      const seed = dailySeed ?? new Date().toISOString().split('T')[0];
      q = query(collection(db, 'leaderboards', 'daily', seed, 'entries'), orderBy('bestScore', 'desc'), limit(MAX_ENTRIES));
    } else {
      q = query(collection(db, 'leaderboards', 'gauntlet', 'entries'), orderBy('bestScore', 'desc'), limit(MAX_ENTRIES));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as LeaderboardEntry);
  } catch (err) {
    console.error('Failed to fetch leaderboard:', err);
    return [];
  }
}

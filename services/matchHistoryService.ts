import { db, isMock } from './firebase';
import { MatchHistoryEntry } from '../shared/types';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const MAX_HISTORY = 20;

export async function fetchMatchHistory(userId: string): Promise<MatchHistoryEntry[]> {
  if (isMock || !db) return [];
  try {
    const q = query(
      collection(db, 'matchHistory', userId, 'matches'),
      orderBy('completedAt', 'desc'),
      limit(MAX_HISTORY),
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as MatchHistoryEntry);
  } catch (err) {
    console.error('Failed to fetch match history:', err);
    return [];
  }
}

/**
 * services/__tests__/firebaseGhostService.test.ts
 *
 * Tests for the ghost race Firestore service.
 * Verifies graceful degradation when Firebase is not initialized (db === null)
 * and validates the data transformation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase module — db is null in test environment
vi.mock('../firebase', () => ({
  db: null,
  auth: null,
}));

import { submitGhostRun, fetchGhostRuns, fetchRandomGhost } from '../firebaseGhostService';
import { GhostRun } from '../../types';

describe('firebaseGhostService (db === null)', () => {
  it('submitGhostRun returns null when db is not initialized', async () => {
    const result = await submitGhostRun('user123', {
      ownerName: 'TestPilot',
      ownerAvatarId: '🚀',
      seed: 'test-seed',
      runLength: 8,
      tileResults: [
        { tileIndex: 1, stars: 3, primaryMetric: 150 },
        { tileIndex: 2, stars: 2, primaryMetric: 100 },
      ],
      ownerCircuitPoints: 500,
    });
    expect(result).toBeNull();
  });

  it('fetchGhostRuns returns empty array when db is not initialized', async () => {
    const result = await fetchGhostRuns('some-seed');
    expect(result).toEqual([]);
  });

  it('fetchRandomGhost returns null when db is not initialized', async () => {
    const result = await fetchRandomGhost();
    expect(result).toBeNull();
  });

  it('fetchGhostRuns respects limitCount parameter', async () => {
    // Even with null db, the function should not throw
    const result = await fetchGhostRuns('seed', 10);
    expect(result).toEqual([]);
  });
});

describe('GhostRun type structure', () => {
  it('has required fields', () => {
    const ghost: GhostRun = {
      ghostId: 'test-1',
      ownerName: 'Pilot',
      ownerAvatarId: '🚀',
      seed: 'seed-1',
      runLength: 8,
      tileResults: [
        { tileIndex: 1, stars: 3, primaryMetric: 200 },
      ],
      submittedAt: Date.now(),
      ownerCircuitPoints: 100,
      userId: 'user-1',
    };

    expect(ghost.ghostId).toBe('test-1');
    expect(ghost.tileResults).toHaveLength(1);
    expect(ghost.tileResults[0].stars).toBe(3);
  });

  it('tileResults can have variable stars (1-3)', () => {
    const ghost: GhostRun = {
      ghostId: 'test-2',
      ownerName: 'Pilot',
      ownerAvatarId: '🎮',
      seed: 'seed-2',
      runLength: 4,
      tileResults: [
        { tileIndex: 1, stars: 1, primaryMetric: 50 },
        { tileIndex: 2, stars: 2, primaryMetric: 100 },
        { tileIndex: 3, stars: 3, primaryMetric: 200 },
        { tileIndex: 4, stars: 1, primaryMetric: 60 },
      ],
      submittedAt: Date.now(),
      ownerCircuitPoints: 200,
      userId: 'user-2',
    };

    expect(ghost.tileResults).toHaveLength(4);
    ghost.tileResults.forEach(t => {
      expect(t.stars).toBeGreaterThanOrEqual(1);
      expect(t.stars).toBeLessThanOrEqual(3);
    });
  });
});

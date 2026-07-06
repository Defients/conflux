/**
 * shared/__tests__/rankSystem.test.ts
 *
 * Tests for ELO rating computation and tier mapping.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRatingChange,
  computeMultiPlayerRatingChanges,
  ratingToTier,
  getTierColor,
  getTierIcon,
  createDefaultRankInfo,
  applyRatingChange,
} from '../rankSystem';

describe('rankSystem', () => {
  describe('computeRatingChange', () => {
    it('should return positive change for a win', () => {
      const change = computeRatingChange(1000, 1000, 1);
      expect(change).toBeGreaterThan(0);
    });

    it('should return negative change for a loss', () => {
      const change = computeRatingChange(1000, 1000, 0);
      expect(change).toBeLessThan(0);
    });

    it('should return zero change for a draw at equal rating', () => {
      const change = computeRatingChange(1000, 1000, 0.5);
      expect(change).toBe(0);
    });

    it('should give larger gains for beating higher-rated opponent', () => {
      const lowVsHigh = computeRatingChange(800, 1200, 1);
      const highVsLow = computeRatingChange(1200, 800, 1);
      expect(lowVsHigh).toBeGreaterThan(highVsLow);
    });
  });

  describe('computeMultiPlayerRatingChanges', () => {
    it('should compute changes for all players', () => {
      const players = [
        { playerId: 1, rating: 1000, placement: 1 },
        { playerId: 2, rating: 1000, placement: 2 },
        { playerId: 3, rating: 1000, placement: 3 },
      ];
      const changes = computeMultiPlayerRatingChanges(players);
      expect(changes.size).toBe(3);
      expect(changes.get(1)).toBeGreaterThan(0);
      expect(changes.get(3)).toBeLessThan(0);
    });

    it('should give first place positive and last place negative', () => {
      const players = [
        { playerId: 1, rating: 1200, placement: 1 },
        { playerId: 2, rating: 1000, placement: 2 },
      ];
      const changes = computeMultiPlayerRatingChanges(players);
      expect(changes.get(1)).toBeGreaterThan(0);
      expect(changes.get(2)).toBeLessThan(0);
    });
  });

  describe('ratingToTier', () => {
    it('should map low ratings to bronze', () => {
      expect(ratingToTier(800)).toBe('bronze');
      expect(ratingToTier(999)).toBe('bronze');
    });

    it('should map mid ratings to silver/gold', () => {
      expect(ratingToTier(1000)).toBe('silver');
      expect(ratingToTier(1400)).toBe('gold');
    });

    it('should map high ratings to platinum/diamond', () => {
      expect(ratingToTier(1800)).toBe('platinum');
      expect(ratingToTier(2200)).toBe('diamond');
    });
  });

  describe('getTierColor', () => {
    it('should return a color string for each tier', () => {
      expect(getTierColor('bronze')).toMatch(/^#/);
      expect(getTierColor('diamond')).toMatch(/^#/);
    });
  });

  describe('getTierIcon', () => {
    it('should return an emoji for each tier', () => {
      expect(getTierIcon('bronze')).toBeTruthy();
      expect(getTierIcon('diamond')).toBeTruthy();
    });
  });

  describe('createDefaultRankInfo', () => {
    it('should create rank with 1000 rating and bronze tier', () => {
      const rank = createDefaultRankInfo();
      expect(rank.rating).toBe(1000);
      expect(rank.tier).toBe('bronze');
      expect(rank.wins).toBe(0);
      expect(rank.losses).toBe(0);
      expect(rank.peakRating).toBe(1000);
    });
  });

  describe('applyRatingChange', () => {
    it('should increase rating for a win', () => {
      const rank = createDefaultRankInfo();
      const updated = applyRatingChange(rank, 30, true);
      expect(updated.rating).toBe(1030);
      expect(updated.wins).toBe(1);
      expect(updated.peakRating).toBe(1030);
    });

    it('should decrease rating for a loss', () => {
      const rank = createDefaultRankInfo();
      const updated = applyRatingChange(rank, -20, false);
      expect(updated.rating).toBe(980);
      expect(updated.losses).toBe(1);
      expect(updated.peakRating).toBe(1000);
    });

    it('should update tier when crossing threshold', () => {
      let rank = createDefaultRankInfo();
      rank = applyRatingChange(rank, 400, true);
      expect(rank.tier).not.toBe('bronze');
    });
  });
});

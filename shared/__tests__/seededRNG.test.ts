import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../seededRNG';

describe('SeededRNG', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = new SeededRNG('test-seed');
    const rng2 = new SeededRNG('test-seed');
    const vals1 = Array.from({ length: 10 }, () => rng1.nextFloat());
    const vals2 = Array.from({ length: 10 }, () => rng2.nextFloat());
    expect(vals1).toEqual(vals2);
  });

  it('produces different output for different seeds', () => {
    const rng1 = new SeededRNG('seed-a');
    const rng2 = new SeededRNG('seed-b');
    const vals1 = Array.from({ length: 10 }, () => rng1.nextFloat());
    const vals2 = Array.from({ length: 10 }, () => rng2.nextFloat());
    expect(vals1).not.toEqual(vals2);
  });

  it('nextFloat returns values in [0, 1)', () => {
    const rng = new SeededRNG('range-test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt returns values in [min, max)', () => {
    const rng = new SeededRNG('int-test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('shuffle returns all elements', () => {
    const rng = new SeededRNG('shuffle-test');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle([...arr]);
    expect(shuffled.sort((a, b) => a - b)).toEqual(arr);
  });

  it('shuffle is deterministic', () => {
    const rng1 = new SeededRNG('shuffle-det');
    const rng2 = new SeededRNG('shuffle-det');
    const arr = [1, 2, 3, 4, 5];
    expect(rng1.shuffle([...arr])).toEqual(rng2.shuffle([...arr]));
  });

  it('nextGaussian produces reasonable distribution', () => {
    const rng = new SeededRNG('gaussian-test');
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) {
      samples.push(rng.nextGaussian(100, 15));
    }
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    expect(mean).toBeCloseTo(100, 0);
  });
});

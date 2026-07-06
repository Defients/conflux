import { describe, it, expect } from 'vitest';
import { generateRun, generateCustomRun } from '../pathGenerator';
import { SharedEventDescriptor } from '../types';

const MOCK_EVENTS: SharedEventDescriptor[] = [
  { id: 'reaction-tap', displayName: 'Reaction Tap', performanceDimension: 'reaction' },
  { id: 'aim-flick', displayName: 'Aim Flick', performanceDimension: 'precision' },
  { id: 'quick-math', displayName: 'Quick Math', performanceDimension: 'logic' },
  { id: 'memory-flip', displayName: 'Memory Flip', performanceDimension: 'memory' },
  { id: 'rhythm-tap', displayName: 'Rhythm Tap', performanceDimension: 'rhythm' },
  { id: 'typing-test', displayName: 'Typing Test', performanceDimension: 'typing' },
  { id: 'stub-event', displayName: 'Stub', performanceDimension: 'reaction', isStub: true },
];

describe('generateRun', () => {
  it('generates a run of the specified length', () => {
    const run = generateRun('test-seed', 8, MOCK_EVENTS);
    expect(run).toHaveLength(8);
  });

  it('is deterministic for the same seed', () => {
    const run1 = generateRun('det-seed', 10, MOCK_EVENTS);
    const run2 = generateRun('det-seed', 10, MOCK_EVENTS);
    expect(run1).toEqual(run2);
  });

  it('produces different runs for different seeds', () => {
    const run1 = generateRun('seed-a', 10, MOCK_EVENTS);
    const run2 = generateRun('seed-b', 10, MOCK_EVENTS);
    expect(run1).not.toEqual(run2);
  });

  it('excludes stub events', () => {
    const run = generateRun('no-stub-seed', 20, MOCK_EVENTS);
    const eventIds = run.map(t => t.eventId);
    expect(eventIds).not.toContain('stub-event');
  });

  it('assigns valid difficulties (1-3)', () => {
    const run = generateRun('diff-seed', 20, MOCK_EVENTS);
    run.forEach(tile => {
      expect(tile.difficulty).toBeGreaterThanOrEqual(1);
      expect(tile.difficulty).toBeLessThanOrEqual(3);
    });
  });

  it('assigns sequential tile indices starting from 1', () => {
    const run = generateRun('index-seed', 8, MOCK_EVENTS);
    run.forEach((tile, i) => {
      expect(tile.tileIndex).toBe(i + 1);
    });
  });

  it('generates subSeeds', () => {
    const run = generateRun('subseed-seed', 4, MOCK_EVENTS);
    run.forEach(tile => {
      expect(tile.subSeed).toBeDefined();
      expect(typeof tile.subSeed).toBe('string');
    });
  });
});

describe('generateCustomRun', () => {
  it('only uses events from the custom pool', () => {
    const customIds = ['reaction-tap', 'aim-flick'];
    const run = generateCustomRun('custom-seed', 10, MOCK_EVENTS, customIds);
    const eventIds = run.map(t => t.eventId);
    const uniqueIds = [...new Set(eventIds)];
    uniqueIds.forEach(id => {
      expect(customIds).toContain(id);
    });
  });

  it('falls back to all events if custom pool is empty', () => {
    const run = generateCustomRun('fallback-seed', 5, MOCK_EVENTS, ['nonexistent-id']);
    expect(run).toHaveLength(5);
    const eventIds = run.map(t => t.eventId);
    expect(eventIds).not.toContain('nonexistent-id');
  });

  it('is deterministic', () => {
    const customIds = ['reaction-tap', 'quick-math'];
    const run1 = generateCustomRun('det-custom', 8, MOCK_EVENTS, customIds);
    const run2 = generateCustomRun('det-custom', 8, MOCK_EVENTS, customIds);
    expect(run1).toEqual(run2);
  });
});

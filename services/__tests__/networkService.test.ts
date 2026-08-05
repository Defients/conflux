/**
 * services/__tests__/networkService.test.ts
 *
 * Tests for NetworkService pure logic: connection quality derivation,
 * handler registration, and state getters.
 * Network operations (createRoom, joinRoom) require a live server and
 * are covered by integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock colyseus.js before importing networkService
vi.mock('colyseus.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    joinOrCreate: vi.fn(),
    joinById: vi.fn(),
    create: vi.fn(),
  })),
}));

import { networkService } from '../networkService';

describe('NetworkService — connection quality', () => {
  beforeEach(() => {
    // Reset internal state between tests
    // The service is a singleton, so we access private state via any
    (networkService as any)._isConnected = false;
    (networkService as any)._hasRtt = false;
    (networkService as any)._rttMs = 0;
  });

  it('should return critical when not connected', () => {
    expect(networkService.connectionQuality).toBe('critical');
  });

  it('should return good when connected but no RTT data yet', () => {
    (networkService as any)._isConnected = true;
    (networkService as any)._hasRtt = false;
    expect(networkService.connectionQuality).toBe('good');
  });

  it('should return excellent when RTT < 50ms', () => {
    (networkService as any)._isConnected = true;
    (networkService as any)._hasRtt = true;
    (networkService as any)._rttMs = 30;
    expect(networkService.connectionQuality).toBe('excellent');
  });

  it('should return good when RTT 50-149ms', () => {
    (networkService as any)._isConnected = true;
    (networkService as any)._hasRtt = true;
    (networkService as any)._rttMs = 100;
    expect(networkService.connectionQuality).toBe('good');
  });

  it('should return poor when RTT 150-299ms', () => {
    (networkService as any)._isConnected = true;
    (networkService as any)._hasRtt = true;
    (networkService as any)._rttMs = 200;
    expect(networkService.connectionQuality).toBe('poor');
  });

  it('should return critical when RTT >= 300ms', () => {
    (networkService as any)._isConnected = true;
    (networkService as any)._hasRtt = true;
    (networkService as any)._rttMs = 350;
    expect(networkService.connectionQuality).toBe('critical');
  });
});

describe('NetworkService — handler registration', () => {
  it('should register and unregister handlers via setHandlers', () => {
    const handler = vi.fn();
    const unsubscribe = networkService.setHandlers({
      onRaceFinished: handler,
    });

    // Handler should be stored
    expect((networkService as any).handlers.onRaceFinished).toBe(handler);

    // Unsubscribe should remove it
    unsubscribe();
    expect((networkService as any).handlers.onRaceFinished).toBeUndefined();
  });

  it('should not remove a handler if it was replaced', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = networkService.setHandlers({
      onRaceFinished: handler1,
    });

    // Replace handler1 with handler2
    networkService.setHandlers({
      onRaceFinished: handler2,
    });

    // unsub1 should NOT remove handler2 (only removes if same reference)
    unsub1();
    expect((networkService as any).handlers.onRaceFinished).toBe(handler2);
  });
});

describe('NetworkService — state getters', () => {
  beforeEach(() => {
    (networkService as any)._isConnected = false;
    (networkService as any)._isReconnecting = false;
    (networkService as any)._sessionId = null;
  });

  it('should expose isConnected getter', () => {
    expect(networkService.isConnected).toBe(false);
    (networkService as any)._isConnected = true;
    expect(networkService.isConnected).toBe(true);
  });

  it('should expose isReconnecting getter', () => {
    expect(networkService.isReconnecting).toBe(false);
    (networkService as any)._isReconnecting = true;
    expect(networkService.isReconnecting).toBe(true);
  });

  it('should expose sessionId getter', () => {
    expect(networkService.sessionId).toBeNull();
    (networkService as any)._sessionId = 'test-session';
    expect(networkService.sessionId).toBe('test-session');
  });

  it('should expose rttMs getter', () => {
    (networkService as any)._rttMs = 0;
    expect(networkService.rttMs).toBe(0);
    (networkService as any)._rttMs = 42;
    expect(networkService.rttMs).toBe(42);
  });
});

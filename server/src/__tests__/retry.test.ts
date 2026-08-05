/**
 * server/src/__tests__/retry.test.ts
 *
 * Tests for the retry utility with exponential backoff.
 */

import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../services/retry';

describe('retry/withRetry', () => {
  it('should return result on first success', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient error and succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('network'), { code: 'unavailable' }))
      .mockResolvedValueOnce('success');

    const result = await withRetry(operation, { initialDelayMs: 10, maxDelayMs: 50 });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on permanent error (permission-denied)', async () => {
    const operation = vi.fn()
      .mockRejectedValue(Object.assign(new Error('forbidden'), { code: 'permission-denied' }));

    await expect(withRetry(operation)).rejects.toThrow('forbidden');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should not retry on permanent error (not-found)', async () => {
    const operation = vi.fn()
      .mockRejectedValue(Object.assign(new Error('missing'), { code: 'not-found' }));

    await expect(withRetry(operation)).rejects.toThrow('missing');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should exhaust retries on persistent transient error', async () => {
    const operation = vi.fn()
      .mockRejectedValue(Object.assign(new Error('timeout'), { code: 'deadline-exceeded' }));

    await expect(withRetry(operation, { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 50 }))
      .rejects.toThrow('timeout');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should retry on aborted (transaction conflict)', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'aborted' }))
      .mockResolvedValueOnce('success');

    const result = await withRetry(operation, { initialDelayMs: 10, maxDelayMs: 50 });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should retry on internal error', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('internal'), { code: 'internal' }))
      .mockResolvedValueOnce('success');

    const result = await withRetry(operation, { initialDelayMs: 10, maxDelayMs: 50 });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on unknown error codes', async () => {
    const operation = vi.fn()
      .mockRejectedValue(Object.assign(new Error('unknown'), { code: 'unknown-code' }));

    await expect(withRetry(operation)).rejects.toThrow('unknown');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should not retry on non-object errors', async () => {
    const operation = vi.fn().mockRejectedValue('string error');

    await expect(withRetry(operation)).rejects.toBe('string error');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

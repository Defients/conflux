/**
 * server/src/services/retry.ts
 *
 * Retry utility with exponential backoff for Firestore operations.
 * Transient errors (network, timeout, 503) are retried; permanent
 * errors (permission denied, not found) are not.
 */

/** Configuration for retry behavior. */
export interface RetryConfig {
  /** Maximum number of attempts (including the first). */
  maxAttempts: number;
  /** Initial delay in ms before the first retry. */
  initialDelayMs: number;
  /** Maximum delay in ms between retries. */
  maxDelayMs: number;
  /** Multiplier applied to delay after each attempt. */
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
};

/**
 * Check if an error is transient (worth retrying).
 * Firestore error codes: https://firebase.google.com/docs/reference/node/firebase.firestore.FirestoreError
 */
function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as any).code;
  // Retry on: unavailable (network), deadline-exceeded (timeout),
  // aborted (transaction conflict), internal (server error).
  // Do NOT retry on: permission-denied, not-found, already-exists, invalid-argument.
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    code === 'internal' ||
    code === 'resource-exhausted'
  );
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry and exponential backoff.
 *
 * @param operation - The async operation to execute.
 * @param config - Retry configuration (uses defaults if omitted).
 * @returns The result of the operation.
 * @throws The last error if all attempts fail.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Don't retry on permanent errors
      if (!isTransientError(err)) {
        throw err;
      }

      // Don't sleep after the last attempt
      if (attempt === cfg.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff + jitter
      const baseDelay = Math.min(
        cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, attempt - 1),
        cfg.maxDelayMs
      );
      const jitter = Math.random() * 0.3 * baseDelay;
      const delay = baseDelay + jitter;

      console.warn(`[Retry] Attempt ${attempt}/${cfg.maxAttempts} failed (transient), retrying in ${Math.round(delay)}ms:`, err);
      await sleep(delay);
    }
  }

  throw lastError;
}

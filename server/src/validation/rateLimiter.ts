/**
 * server/src/validation/rateLimiter.ts
 *
 * Token-bucket rate limiter for per-client message throttling.
 * Allows bursts up to `burstSize` messages, then refills at `refillRate` tokens/sec.
 */
import { ClientMessages } from '../../../shared/protocol';

export class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;

  constructor(
    private readonly burstSize: number,
    private readonly refillRate: number,
  ) {
    this.tokens = burstSize;
    this.lastRefillTime = Date.now();
  }

  /** Attempt to consume 1 token. Returns true if allowed, false if rate-limited. */
  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000;
    this.tokens = Math.min(this.burstSize, this.tokens + elapsed * this.refillRate);
    this.lastRefillTime = now;
  }

  /** Current token count (for debugging/monitoring). */
  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Per-client rate limiter registry.
 * Tracks a TokenBucket per message type per client.
 */
export class ClientRateLimiter {
  private buckets: Map<string, Map<string, TokenBucket>> = new Map();

  /**
   * Check if a message from a client is allowed.
   * Returns true if allowed, false if rate-limited.
   */
  isAllowed(
    sessionId: string,
    messageType: string,
    burstSize: number,
    refillRate: number,
  ): boolean {
    let clientBuckets = this.buckets.get(sessionId);
    if (!clientBuckets) {
      clientBuckets = new Map();
      this.buckets.set(sessionId, clientBuckets);
    }

    let bucket = clientBuckets.get(messageType);
    if (!bucket) {
      bucket = new TokenBucket(burstSize, refillRate);
      clientBuckets.set(messageType, bucket);
    }

    return bucket.consume();
  }

  /** Remove all rate limit state for a client (on disconnect). */
  removeClient(sessionId: string) {
    this.buckets.delete(sessionId);
  }
}

/** Rate limit configuration per message type. */
export const RATE_LIMITS = {
  [ClientMessages.SUBMIT_EVENT_RESULT]: { burst: 10, refill: 10 },
  [ClientMessages.USE_POWER_UP]: { burst: 5, refill: 3 },
  [ClientMessages.ACTIVATE_OVERDRIVE]: { burst: 5, refill: 3 },
  [ClientMessages.INTERVENTION_CHOICE]: { burst: 3, refill: 2 },
  [ClientMessages.PIT_STOP_ACTION]: { burst: 3, refill: 2 },
  [ClientMessages.READY]: { burst: 10, refill: 5 },
  [ClientMessages.UPDATE_SETTINGS]: { burst: 10, refill: 5 },
  [ClientMessages.START]: { burst: 3, refill: 1 },
  [ClientMessages.REQUEST_REMATCH]: { burst: 3, refill: 1 },
  [ClientMessages.TOGGLE_PRIVATE]: { burst: 5, refill: 2 },
  [ClientMessages.KICK_PLAYER]: { burst: 5, refill: 2 },
  [ClientMessages.BAN_PLAYER]: { burst: 5, refill: 2 },
} as const;

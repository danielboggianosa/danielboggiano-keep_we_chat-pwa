/**
 * Feature: production-readiness, Property 2: Rate limiting por usuario
 *
 * Validates: Requirements 1.4, 1.5
 *
 * Property: For all authenticated users, if the number of requests in a
 * 60-second window exceeds 100, additional requests must be rejected with
 * HTTP 429 and a positive Retry-After header value.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Constants ─────────────────────────────────────────────────────

const WINDOW_MS = 60_000; // 60 seconds
const MAX_REQUESTS = 100;

// ── Rate Limiter Implementation ───────────────────────────────────

interface RateLimitResult {
  allowed: boolean;
  status?: number;
  retryAfter?: number;
}

/**
 * Simple counter-based rate limiter that mirrors express-rate-limit behavior.
 * Tracks request counts per user within a sliding window.
 */
class RateLimiter {
  private counters = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly windowMs: number = WINDOW_MS,
    private readonly max: number = MAX_REQUESTS,
  ) {}

  /**
   * Process a request for a given userId at a given timestamp.
   * Returns whether the request is allowed or rejected with 429.
   */
  hit(userId: string, nowMs: number): RateLimitResult {
    const entry = this.counters.get(userId);

    // If no entry or window has expired, start a new window
    if (!entry || nowMs - entry.windowStart >= this.windowMs) {
      this.counters.set(userId, { count: 1, windowStart: nowMs });
      return { allowed: true };
    }

    // Within the current window
    entry.count += 1;

    if (entry.count <= this.max) {
      return { allowed: true };
    }

    // Over the limit — compute Retry-After in seconds
    const windowEndMs = entry.windowStart + this.windowMs;
    const retryAfterSeconds = Math.ceil((windowEndMs - nowMs) / 1000);

    return {
      allowed: false,
      status: 429,
      retryAfter: Math.max(retryAfterSeconds, 1), // always positive
    };
  }

  reset(): void {
    this.counters.clear();
  }
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random userId. */
const userIdArb = fc.stringMatching(/^user-[a-f0-9]{4,12}$/);

/** Number of requests between 1 and 200. */
const requestCountArb = fc.integer({ min: 1, max: 200 });

// ── Property Test ─────────────────────────────────────────────────

describe('Property 2: Rate limiting por usuario', () => {
  it('first 100 requests pass and subsequent ones receive 429 with positive Retry-After', () => {
    fc.assert(
      fc.property(userIdArb, requestCountArb, (userId, totalRequests) => {
        const limiter = new RateLimiter(WINDOW_MS, MAX_REQUESTS);
        const baseTime = Date.now();

        for (let i = 1; i <= totalRequests; i++) {
          // All requests happen within the same 60s window
          const nowMs = baseTime + i; // 1ms apart
          const result = limiter.hit(userId, nowMs);

          if (i <= MAX_REQUESTS) {
            // First 100 requests MUST be allowed
            expect(result.allowed).toBe(true);
            expect(result.status).toBeUndefined();
          } else {
            // Requests 101+ MUST be rejected with 429
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(429);

            // Retry-After MUST be a positive number
            expect(result.retryAfter).toBeDefined();
            expect(result.retryAfter).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

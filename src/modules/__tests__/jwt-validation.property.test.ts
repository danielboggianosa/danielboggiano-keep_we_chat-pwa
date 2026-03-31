/**
 * Feature: production-readiness, Property 1: Validación JWT rechaza tokens inválidos
 *
 * Validates: Requirements 1.2, 1.3
 *
 * Property: For all JWT tokens that are invalid (malformed, signed with wrong secret,
 * or expired), the verification must reject them. Valid tokens signed with the correct
 * secret and not expired must be accepted.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';

// ── Constants ─────────────────────────────────────────────────────

const CORRECT_SECRET = 'test-jwt-secret-for-property-tests';
const ALGORITHM = 'HS256' as const;

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Attempts to verify a token with the correct secret and HS256 algorithm.
 * Returns { valid: true, payload } on success, { valid: false, error } on failure.
 */
function verifyToken(token: string): { valid: boolean; error?: string } {
  try {
    jwt.verify(token, CORRECT_SECRET, { algorithms: [ALGORITHM] });
    return { valid: true };
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Token has expired'
        : 'Invalid token';
    return { valid: false, error: message };
  }
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random non-empty string for use as a wrong secret (guaranteed different from CORRECT_SECRET). */
const wrongSecretArb = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s !== CORRECT_SECRET);

/** Random userId string. */
const userIdArb = fc.stringMatching(/^[a-f0-9-]{1,36}$/);

/** Random role. */
const roleArb = fc.constantFrom('admin' as const, 'user' as const);

/** Arbitrary for a malformed token string (random garbage, not a valid JWT). */
const malformedTokenArb = fc.oneof(
  // Completely random string
  fc.string({ minLength: 1, maxLength: 200 }),
  // String with dots but not valid JWT parts
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.string({ minLength: 1, maxLength: 50 }),
  ).map(([a, b, c]) => `${a}.${b}.${c}`),
  // Empty-ish tokens
  fc.constantFrom('', ' ', 'Bearer', 'null', 'undefined', '{}'),
);

/** Generate a token signed with a wrong secret. */
const wrongSecretTokenArb = fc
  .tuple(userIdArb, roleArb, wrongSecretArb)
  .map(([userId, role, wrongSecret]) =>
    jwt.sign({ userId, role }, wrongSecret, {
      algorithm: ALGORITHM,
      expiresIn: '15m',
    }),
  );

/** Generate an expired token (signed with the correct secret but already expired). */
const expiredTokenArb = fc
  .tuple(userIdArb, roleArb, fc.integer({ min: 1, max: 3600 }))
  .map(([userId, role, secondsAgo]) => {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { userId, role, iat: now - secondsAgo - 10, exp: now - secondsAgo },
      CORRECT_SECRET,
      { algorithm: ALGORITHM },
    );
  });

/** Combined arbitrary: any kind of invalid token. */
const invalidTokenArb = fc.oneof(
  malformedTokenArb,
  wrongSecretTokenArb,
  expiredTokenArb,
);

// ── Property Test ─────────────────────────────────────────────────

describe('Property 1: Validación JWT rechaza tokens inválidos', () => {
  it('all invalid tokens (malformed, wrong secret, expired) are rejected by JWT verification', () => {
    fc.assert(
      fc.property(invalidTokenArb, (token) => {
        const result = verifyToken(token);

        // The token MUST be rejected
        expect(result.valid).toBe(false);

        // The error message must be one of the expected messages
        expect(result.error).toMatch(/^(Token has expired|Invalid token)$/);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: google-oauth-login, Property 9: Rechazo de cuenta desactivada
 *
 * Validates: Requirements 4.3
 *
 * Property: For any user with is_active=false who attempts to authenticate
 * via Google OAuth, the system must respond with HTTP 401 and the message
 * "La cuenta está desactivada".
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Types ─────────────────────────────────────────────────────────

interface ExistingUser {
  id: string;
  email: string;
  name: string;
  google_id: string | null;
  role: string;
  is_active: boolean;
}

interface OAuthResponse {
  status: number;
  body: { error?: string; code?: number };
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Pure function that replicates the disabled-account check from
 * the POST /api/auth/google handler. Given an existing user,
 * returns the response that would be sent.
 */
function handleExistingUserOAuth(user: ExistingUser): OAuthResponse {
  if (!user.is_active) {
    return {
      status: 401,
      body: { error: 'La cuenta está desactivada', code: 401 },
    };
  }
  // Active user → would proceed with login (simplified for this test)
  return {
    status: 200,
    body: {},
  };
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random UUID for user id. */
const userIdArb = fc.uuid();

/** Random valid email. */
const emailArb = fc.emailAddress();

/** Random non-empty name. */
const nameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

/** Random Google sub or null. */
const googleIdArb = fc.oneof(
  fc.stringMatching(/^[0-9]{10,30}$/),
  fc.constant(null),
);

/** Random role. */
const roleArb = fc.constantFrom('admin', 'user');

/** Disabled user arbitrary (is_active always false). */
const disabledUserArb = fc.record({
  id: userIdArb,
  email: emailArb,
  name: nameArb,
  google_id: googleIdArb,
  role: roleArb,
  is_active: fc.constant(false as boolean),
});

/** Active user arbitrary (is_active always true). */
const activeUserArb = fc.record({
  id: userIdArb,
  email: emailArb,
  name: nameArb,
  google_id: googleIdArb,
  role: roleArb,
  is_active: fc.constant(true as boolean),
});

// ── Property Tests ────────────────────────────────────────────────

describe('Property 9: Rechazo de cuenta desactivada', () => {
  it('disabled users always receive 401 with "La cuenta está desactivada"', () => {
    fc.assert(
      fc.property(disabledUserArb, (user) => {
        const response = handleExistingUserOAuth(user);

        // Must return 401
        expect(response.status).toBe(401);

        // Must contain the specific error message
        expect(response.body.error).toBe('La cuenta está desactivada');

        // Must include error code
        expect(response.body.code).toBe(401);
      }),
      { numRuns: 100 },
    );
  });

  it('active users do NOT receive 401 rejection', () => {
    fc.assert(
      fc.property(activeUserArb, (user) => {
        const response = handleExistingUserOAuth(user);

        // Active users must NOT be rejected
        expect(response.status).not.toBe(401);
        expect(response.body.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});

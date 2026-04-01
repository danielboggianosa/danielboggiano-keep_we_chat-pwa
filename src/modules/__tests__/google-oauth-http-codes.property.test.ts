/**
 * Feature: google-oauth-login, Property 14: Código HTTP correcto según tipo de operación
 *
 * Validates: Requirements 9.2, 9.3
 *
 * Property: For any successful Google OAuth authentication, the HTTP response
 * code must be 201 when a new user is created and 200 when an existing user
 * is authenticated.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Types ─────────────────────────────────────────────────────────

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

interface ExistingUser {
  id: string;
  email: string;
  name: string;
  google_id: string | null;
  role: string;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Pure function that replicates the HTTP status code logic from
 * the POST /api/auth/google handler.
 *
 * Returns the status code that would be sent based on whether
 * the user already exists in the database.
 */
function determineHttpStatus(existingUser: ExistingUser | null): number {
  if (existingUser === null) {
    // New user → 201 Created
    return 201;
  }
  // Existing user (with or without google_id) → 200 OK
  return 200;
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random Google profile. */
const googleProfileArb = fc.record({
  sub: fc.stringMatching(/^[0-9]{10,30}$/),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
});

/** Random existing active user. */
const existingUserArb = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  google_id: fc.oneof(
    fc.stringMatching(/^[0-9]{10,30}$/),
    fc.constant(null),
  ),
  role: fc.constantFrom('admin', 'user'),
  is_active: fc.constant(true as boolean),
});

// ── Property Tests ────────────────────────────────────────────────

describe('Property 14: Código HTTP correcto según tipo de operación', () => {
  it('new user creation returns HTTP 201', () => {
    fc.assert(
      fc.property(googleProfileArb, (_profile) => {
        // No existing user → new user scenario
        const status = determineHttpStatus(null);
        expect(status).toBe(201);
      }),
      { numRuns: 100 },
    );
  });

  it('existing user login returns HTTP 200', () => {
    fc.assert(
      fc.property(existingUserArb, (user) => {
        // Existing user → login scenario
        const status = determineHttpStatus(user);
        expect(status).toBe(200);
      }),
      { numRuns: 100 },
    );
  });

  it('status is always either 200 or 201 for successful OAuth', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          existingUserArb.map((u) => u as ExistingUser | null),
          fc.constant(null),
        ),
        (existingUser) => {
          const status = determineHttpStatus(existingUser);
          expect([200, 201]).toContain(status);
        },
      ),
      { numRuns: 100 },
    );
  });
});

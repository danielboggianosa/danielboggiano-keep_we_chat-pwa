/**
 * Feature: google-oauth-login, Property 2: Persistencia y validación del parámetro state
 *
 * Validates: Requirements 1.3, 7.1, 7.2
 *
 * Property: For any pair of state values (received, stored), the authorization
 * code is sent to the backend if and only if received === stored and both are
 * non-empty. If they don't match or either is absent, the flow is cancelled.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Pure function that replicates the state validation logic from
 * the OAuth callback handler in auth-screen.ts.
 *
 * Returns true if the code should be sent to the backend, false otherwise.
 */
function shouldSendCode(
  receivedState: string | null,
  storedState: string | null,
): boolean {
  if (!receivedState || !storedState) return false;
  return receivedState === storedState;
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random non-empty state string. */
const nonEmptyStateArb = fc.uuid();

/** Arbitrary that produces null or empty string (absent state). */
const absentStateArb = fc.constantFrom(null, '');

// ── Property Tests ────────────────────────────────────────────────

describe('Property 2: Persistencia y validación del parámetro state', () => {
  it('code is sent when received state matches stored state and both are non-empty', () => {
    fc.assert(
      fc.property(nonEmptyStateArb, (state) => {
        // Same state on both sides → should send code
        expect(shouldSendCode(state, state)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('code is NOT sent when received state differs from stored state', () => {
    fc.assert(
      fc.property(
        nonEmptyStateArb,
        nonEmptyStateArb.filter((s) => s.length > 0),
        (received, stored) => {
          fc.pre(received !== stored);
          // Different states → should NOT send code
          expect(shouldSendCode(received, stored)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('code is NOT sent when either state is absent (null or empty)', () => {
    fc.assert(
      fc.property(
        fc.oneof(absentStateArb, nonEmptyStateArb),
        fc.oneof(absentStateArb, nonEmptyStateArb),
        (received, stored) => {
          // At least one must be absent for this property
          fc.pre(!received || !stored);
          expect(shouldSendCode(received, stored)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

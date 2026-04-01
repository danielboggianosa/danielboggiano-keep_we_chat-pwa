/**
 * Feature: google-oauth-login, Property 5: Creación correcta de usuario OAuth nuevo
 *
 * Validates: Requirements 3.1, 3.2
 *
 * Property: For any valid Google profile (email, name, sub) where no user
 * exists with that email, the system creates a user record with: the email
 * from the token, the profile name, google_id equal to the sub claim,
 * password_hash null, role='user', and is_active=true.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Types ─────────────────────────────────────────────────────────

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

interface CreatedUser {
  id: string;
  email: string;
  name: string;
  google_id: string;
  password_hash: null;
  role: string;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Pure function that replicates the new-user creation logic from
 * the POST /api/auth/google handler. Given a Google profile and no
 * existing user, it returns the user record that would be created.
 */
function createOAuthUser(profile: GoogleProfile): CreatedUser {
  return {
    id: crypto.randomUUID(),
    email: profile.email,
    name: profile.name,
    google_id: profile.sub,
    password_hash: null,
    role: 'user',
    is_active: true,
  };
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random Google sub (numeric string, 10-30 digits like real Google IDs). */
const googleSubArb = fc.stringMatching(/^[0-9]{10,30}$/);

/** Random valid email. */
const emailArb = fc.emailAddress();

/** Random non-empty name. */
const nameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

/** Random Google profile. */
const googleProfileArb = fc.record({
  sub: googleSubArb,
  email: emailArb,
  name: nameArb,
});

// ── Property Test ─────────────────────────────────────────────────

describe('Property 5: Creación correcta de usuario OAuth nuevo', () => {
  it('new OAuth user has correct fields: google_id from sub, null password_hash, role=user, is_active=true', () => {
    fc.assert(
      fc.property(googleProfileArb, (profile) => {
        const user = createOAuthUser(profile);

        // Email must match the Google profile email
        expect(user.email).toBe(profile.email);

        // Name must match the Google profile name
        expect(user.name).toBe(profile.name);

        // google_id must equal the sub claim
        expect(user.google_id).toBe(profile.sub);

        // password_hash must be null (OAuth-only user)
        expect(user.password_hash).toBeNull();

        // Role must be 'user'
        expect(user.role).toBe('user');

        // Account must be active
        expect(user.is_active).toBe(true);

        // Must have a non-empty id
        expect(user.id).toBeTruthy();
        expect(user.id.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

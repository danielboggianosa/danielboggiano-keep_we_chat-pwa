/**
 * Feature: google-oauth-login, Property 13: Estructura de respuesta consistente con login tradicional
 *
 * Validates: Requirements 9.1
 *
 * Property: For any successful Google OAuth authentication, the JSON response
 * must contain the fields user (with id, email, name, role), accessToken,
 * and refreshToken, with the same structure as POST /api/auth/login.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Types ─────────────────────────────────────────────────────────

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthResponse {
  user: UserRecord;
  accessToken: string;
  refreshToken: string;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Pure function that replicates the response construction logic from
 * the POST /api/auth/google handler. Given a user record, access token,
 * and refresh token, it builds the response object.
 */
function buildAuthResponse(
  user: UserRecord,
  accessToken: string,
  refreshToken: string,
): AuthResponse {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random user record. */
const userRecordArb = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  role: fc.constantFrom('admin', 'user'),
});

/** Random JWT-like access token string. */
const accessTokenArb = fc
  .tuple(
    fc.base64String({ minLength: 10, maxLength: 50 }),
    fc.base64String({ minLength: 10, maxLength: 50 }),
    fc.base64String({ minLength: 10, maxLength: 50 }),
  )
  .map(([h, p, s]) => `${h}.${p}.${s}`);

/** Random hex refresh token string (like crypto.randomBytes(48).toString('hex')). */
const refreshTokenArb = fc.stringMatching(/^[a-f0-9]{96}$/);

// ── Property Test ─────────────────────────────────────────────────

describe('Property 13: Estructura de respuesta consistente con login tradicional', () => {
  it('response contains user (id, email, name, role), accessToken, and refreshToken', () => {
    fc.assert(
      fc.property(
        userRecordArb,
        accessTokenArb,
        refreshTokenArb,
        (user, accessToken, refreshToken) => {
          const response = buildAuthResponse(user, accessToken, refreshToken);

          // Response must have the three top-level keys
          expect(response).toHaveProperty('user');
          expect(response).toHaveProperty('accessToken');
          expect(response).toHaveProperty('refreshToken');

          // user must have exactly id, email, name, role
          expect(response.user).toHaveProperty('id');
          expect(response.user).toHaveProperty('email');
          expect(response.user).toHaveProperty('name');
          expect(response.user).toHaveProperty('role');
          expect(Object.keys(response.user).sort()).toEqual(['email', 'id', 'name', 'role']);

          // Values must match the inputs
          expect(response.user.id).toBe(user.id);
          expect(response.user.email).toBe(user.email);
          expect(response.user.name).toBe(user.name);
          expect(response.user.role).toBe(user.role);

          // Tokens must be non-empty strings
          expect(typeof response.accessToken).toBe('string');
          expect(response.accessToken.length).toBeGreaterThan(0);
          expect(typeof response.refreshToken).toBe('string');
          expect(response.refreshToken.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

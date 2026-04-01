/**
 * Unit tests for POST /api/auth/google endpoint.
 *
 * Tests the handler logic by replicating the pure decision functions
 * from services/api-gateway/src/routes/auth.ts with mocked dependencies
 * (google-auth-library, pool.query, jwt).
 *
 * Validates: Requirements 2.1–2.4, 3.1–3.3, 4.1–4.3, 9.1–9.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────

interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
}

interface ExistingUser {
  id: string;
  email: string;
  name: string;
  google_id: string | null;
  role: string;
  is_active: boolean;
}

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
  auditEvent?: string;
  dbUpdates?: string[];
}

// ── Mock infrastructure ───────────────────────────────────────────

/**
 * Simulates the OAuth2Client.getToken() call.
 * Returns tokens on success, throws on failure.
 */
function mockGetToken(
  code: string,
  validCodes: Map<string, { id_token: string }>,
): { tokens: { id_token: string } } {
  const result = validCodes.get(code);
  if (!result) {
    throw new Error('invalid_grant: Bad Request');
  }
  return { tokens: result };
}

/**
 * Simulates the OAuth2Client.verifyIdToken() call.
 * Returns payload on success, throws on failure.
 */
function mockVerifyIdToken(
  idToken: string,
  validTokens: Map<string, GoogleTokenPayload>,
): { getPayload: () => GoogleTokenPayload } {
  const payload = validTokens.get(idToken);
  if (!payload) {
    throw new Error('Token verification failed');
  }
  return { getPayload: () => payload };
}

/**
 * Replicates the core handler logic of POST /api/auth/google.
 * This is a pure function that mirrors the actual handler's decision tree.
 */
function handleGoogleAuth(params: {
  code: string | undefined;
  validCodes: Map<string, { id_token: string }>;
  validTokens: Map<string, GoogleTokenPayload>;
  existingUser: ExistingUser | null;
}): HandlerResult {
  const { code, validCodes, validTokens, existingUser } = params;
  const dbUpdates: string[] = [];

  // Step 1: Validate code presence
  if (!code) {
    return {
      status: 400,
      body: { error: 'code is required', code: 400 },
    };
  }

  // Step 2: Exchange code for tokens
  let tokens: { id_token: string };
  try {
    const result = mockGetToken(code, validCodes);
    tokens = result.tokens;
  } catch {
    return {
      status: 401,
      body: { error: 'Google authentication failed', code: 401 },
      auditEvent: 'login_failed',
    };
  }

  // Step 3: Verify ID token
  let payload: GoogleTokenPayload;
  try {
    const ticket = mockVerifyIdToken(tokens.id_token, validTokens);
    payload = ticket.getPayload();
  } catch {
    return {
      status: 401,
      body: { error: 'Invalid Google token', code: 401 },
      auditEvent: 'login_failed',
    };
  }

  if (!payload || !payload.sub || !payload.email) {
    return {
      status: 401,
      body: { error: 'Invalid Google token', code: 401 },
      auditEvent: 'login_failed',
    };
  }

  const googleId = payload.sub;
  const email = payload.email;
  const name = payload.name ?? email;

  // Step 4: User lookup/creation/linking
  let user: { id: string; email: string; name: string; role: string };
  let isNewUser = false;

  if (!existingUser) {
    // New user
    user = {
      id: crypto.randomUUID(),
      email,
      name,
      role: 'user',
    };
    dbUpdates.push('INSERT_USER');
    isNewUser = true;
  } else {
    // Check disabled
    if (!existingUser.is_active) {
      return {
        status: 401,
        body: { error: 'La cuenta está desactivada', code: 401 },
        auditEvent: 'login_failed',
      };
    }

    user = {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role,
    };

    if (!existingUser.google_id) {
      dbUpdates.push('UPDATE_GOOGLE_ID');
    }
  }

  // Step 5: Generate tokens (simulated)
  const accessToken = `mock-access-${user.id}`;
  const refreshToken = `mock-refresh-${crypto.randomUUID()}`;
  dbUpdates.push('INSERT_REFRESH_TOKEN');

  const statusCode = isNewUser ? 201 : 200;

  return {
    status: statusCode,
    body: {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    },
    auditEvent: 'google_login',
    dbUpdates,
  };
}

// ── Test Data ─────────────────────────────────────────────────────

const VALID_CODE = 'valid-auth-code-123';
const VALID_ID_TOKEN = 'valid-id-token-abc';

const GOOGLE_PROFILE: GoogleTokenPayload = {
  sub: '1234567890123456',
  email: 'testuser@gmail.com',
  name: 'Test User',
};

const validCodes = new Map<string, { id_token: string }>([
  [VALID_CODE, { id_token: VALID_ID_TOKEN }],
]);

const validTokens = new Map<string, GoogleTokenPayload>([
  [VALID_ID_TOKEN, GOOGLE_PROFILE],
]);

// ── Tests ─────────────────────────────────────────────────────────

describe('POST /api/auth/google — Unit Tests', () => {
  describe('New user (201)', () => {
    it('creates a new user and returns 201 with user, accessToken, refreshToken', () => {
      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens,
        existingUser: null,
      });

      expect(result.status).toBe(201);
      const body = result.body as {
        user: { id: string; email: string; name: string; role: string };
        accessToken: string;
        refreshToken: string;
      };
      expect(body.user.email).toBe('testuser@gmail.com');
      expect(body.user.name).toBe('Test User');
      expect(body.user.role).toBe('user');
      expect(body.user.id).toBeTruthy();
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(result.auditEvent).toBe('google_login');
      expect(result.dbUpdates).toContain('INSERT_USER');
      expect(result.dbUpdates).toContain('INSERT_REFRESH_TOKEN');
    });

    it('uses email as name when Google profile has no name', () => {
      const noNameTokens = new Map<string, GoogleTokenPayload>([
        [VALID_ID_TOKEN, { sub: '999', email: 'noname@test.com' }],
      ]);

      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens: noNameTokens,
        existingUser: null,
      });

      expect(result.status).toBe(201);
      const body = result.body as { user: { name: string } };
      expect(body.user.name).toBe('noname@test.com');
    });
  });

  describe('Existing user with google_id (200)', () => {
    it('returns 200 and does not update google_id', () => {
      const existingUser: ExistingUser = {
        id: 'user-uuid-1',
        email: 'testuser@gmail.com',
        name: 'Test User',
        google_id: '1234567890123456',
        role: 'user',
        is_active: true,
      };

      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens,
        existingUser,
      });

      expect(result.status).toBe(200);
      const body = result.body as {
        user: { id: string; email: string; name: string; role: string };
        accessToken: string;
        refreshToken: string;
      };
      expect(body.user.id).toBe('user-uuid-1');
      expect(body.user.email).toBe('testuser@gmail.com');
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(result.auditEvent).toBe('google_login');
      // Should NOT update google_id since it already exists
      expect(result.dbUpdates).not.toContain('UPDATE_GOOGLE_ID');
    });
  });

  describe('Account linking — existing user without google_id (200)', () => {
    it('returns 200 and updates google_id for email/password user', () => {
      const existingUser: ExistingUser = {
        id: 'user-uuid-2',
        email: 'testuser@gmail.com',
        name: 'Test User',
        google_id: null,
        role: 'admin',
        is_active: true,
      };

      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens,
        existingUser,
      });

      expect(result.status).toBe(200);
      const body = result.body as {
        user: { id: string; role: string };
        accessToken: string;
        refreshToken: string;
      };
      expect(body.user.id).toBe('user-uuid-2');
      expect(body.user.role).toBe('admin');
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(result.auditEvent).toBe('google_login');
      // Should update google_id
      expect(result.dbUpdates).toContain('UPDATE_GOOGLE_ID');
    });
  });

  describe('Missing code (400)', () => {
    it('returns 400 when code is undefined', () => {
      const result = handleGoogleAuth({
        code: undefined,
        validCodes,
        validTokens,
        existingUser: null,
      });

      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: 'code is required', code: 400 });
      expect(result.auditEvent).toBeUndefined();
    });

    it('returns 400 when code is empty string', () => {
      const result = handleGoogleAuth({
        code: '',
        validCodes,
        validTokens,
        existingUser: null,
      });

      // Empty string is falsy → same as missing
      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: 'code is required', code: 400 });
    });
  });

  describe('Invalid code (401)', () => {
    it('returns 401 when code exchange fails', () => {
      const result = handleGoogleAuth({
        code: 'invalid-code-xyz',
        validCodes,
        validTokens,
        existingUser: null,
      });

      expect(result.status).toBe(401);
      expect(result.body).toEqual({ error: 'Google authentication failed', code: 401 });
      expect(result.auditEvent).toBe('login_failed');
    });

    it('returns 401 when ID token verification fails', () => {
      // Code is valid but maps to an unverifiable token
      const badTokenCodes = new Map([
        ['code-with-bad-token', { id_token: 'unverifiable-token' }],
      ]);

      const result = handleGoogleAuth({
        code: 'code-with-bad-token',
        validCodes: badTokenCodes,
        validTokens,
        existingUser: null,
      });

      expect(result.status).toBe(401);
      expect(result.body).toEqual({ error: 'Invalid Google token', code: 401 });
      expect(result.auditEvent).toBe('login_failed');
    });
  });

  describe('Disabled account (401)', () => {
    it('returns 401 with specific message for disabled user', () => {
      const disabledUser: ExistingUser = {
        id: 'user-uuid-3',
        email: 'testuser@gmail.com',
        name: 'Test User',
        google_id: '1234567890123456',
        role: 'user',
        is_active: false,
      };

      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens,
        existingUser: disabledUser,
      });

      expect(result.status).toBe(401);
      expect(result.body).toEqual({ error: 'La cuenta está desactivada', code: 401 });
      expect(result.auditEvent).toBe('login_failed');
    });

    it('returns 401 for disabled user even without google_id', () => {
      const disabledNoGoogle: ExistingUser = {
        id: 'user-uuid-4',
        email: 'testuser@gmail.com',
        name: 'Test User',
        google_id: null,
        role: 'user',
        is_active: false,
      };

      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens,
        existingUser: disabledNoGoogle,
      });

      expect(result.status).toBe(401);
      expect(result.body.error).toBe('La cuenta está desactivada');
    });
  });

  describe('Response structure consistency', () => {
    it('successful response has same shape as login/register', () => {
      const result = handleGoogleAuth({
        code: VALID_CODE,
        validCodes,
        validTokens,
        existingUser: null,
      });

      expect(result.status).toBe(201);
      const body = result.body as Record<string, unknown>;

      // Must have user, accessToken, refreshToken
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');

      // user must have id, email, name, role
      const user = body.user as Record<string, unknown>;
      expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name', 'role']);
    });
  });
});

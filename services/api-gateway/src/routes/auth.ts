import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { logger } from '../logger.js';
import type { JWTPayload } from '../middleware/jwt-auth.js';

const router = Router();

const BCRYPT_COST = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Generates an access token (short-lived, 15 min).
 */
function generateAccessToken(userId: string, role: 'admin' | 'user'): string {
  return jwt.sign({ userId, role }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generates a random refresh token string and its SHA-256 hash.
 * The raw token is sent to the client; the hash is stored in the DB.
 */
function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

async function recordAuthEvent(
  userId: string | null,
  eventType: 'login_success' | 'login_failed' | 'token_refresh' | 'logout',
  ip: string,
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO auth_events (user_id, event_type, ip_address) VALUES ($1, $2, $3)',
      [userId, eventType, ip],
    );
  } catch (err) {
    logger.error('Failed to record auth event', {
      error: err instanceof Error ? err.message : String(err),
      eventType,
    });
  }
}

/**
 * POST /api/auth/register
 * Creates a new user with bcrypt-hashed password (cost 12).
 * Returns access + refresh tokens.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, and password are required', code: 400 });
      return;
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'A user with this email already exists', code: 409 });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, name, role`,
      [email, name, passwordHash],
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken(user.id, user.role);
    const refresh = generateRefreshToken();

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refresh.hash, expiresAt],
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken: refresh.raw,
    });
  } catch (err) {
    logger.error('Registration failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user with email + password.
 * Returns access + refresh tokens on success.
 * Records auth events (success/failure) with IP.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required', code: 400 });
      return;
    }

    const result = await pool.query(
      'SELECT id, email, name, password_hash, role, is_active FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      await recordAuthEvent(null, 'login_failed', ip);
      res.status(401).json({ error: 'Invalid email or password', code: 401 });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await recordAuthEvent(user.id, 'login_failed', ip);
      res.status(401).json({ error: 'Account is deactivated', code: 401 });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      await recordAuthEvent(user.id, 'login_failed', ip);
      res.status(401).json({ error: 'Invalid email or password', code: 401 });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refresh = generateRefreshToken();

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refresh.hash, expiresAt],
    );

    await recordAuthEvent(user.id, 'login_success', ip);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken: refresh.raw,
    });
  } catch (err) {
    logger.error('Login failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /api/auth/refresh
 * Rotates the refresh token: validates the current one, invalidates it,
 * and issues a new access + refresh token pair.
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required', code: 400 });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const result = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.is_revoked, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid refresh token', code: 401 });
      return;
    }

    const row = result.rows[0];

    if (row.is_revoked) {
      // Possible token reuse attack — revoke all tokens for this user
      await pool.query(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
        [row.user_id],
      );
      logger.warn('Refresh token reuse detected, revoking all tokens for user', {
        userId: row.user_id,
        ip,
      });
      res.status(401).json({ error: 'Refresh token has been revoked', code: 401 });
      return;
    }

    if (new Date(row.expires_at) < new Date()) {
      res.status(401).json({ error: 'Refresh token has expired', code: 401 });
      return;
    }

    if (!row.is_active) {
      res.status(401).json({ error: 'Account is deactivated', code: 401 });
      return;
    }

    // Invalidate the old refresh token
    await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE id = $1', [row.id]);

    // Issue new tokens
    const accessToken = generateAccessToken(row.user_id, row.role);
    const newRefresh = generateRefreshToken();

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [row.user_id, newRefresh.hash, expiresAt],
    );

    await recordAuthEvent(row.user_id, 'token_refresh', ip);

    res.json({
      accessToken,
      refreshToken: newRefresh.raw,
    });
  } catch (err) {
    logger.error('Token refresh failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the provided refresh token.
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required', code: 400 });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const result = await pool.query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1 AND is_revoked = false RETURNING user_id',
      [tokenHash],
    );

    if (result.rows.length > 0) {
      await recordAuthEvent(result.rows[0].user_id, 'logout', ip);
    }

    // Always return 200 even if token was not found (idempotent)
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export { router as authRouter };

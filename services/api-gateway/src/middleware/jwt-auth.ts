import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../logger.js';

export interface JWTPayload {
  userId: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/** Paths that do not require JWT authentication. */
const PUBLIC_PATHS = ['/health', '/metrics', '/api/auth/login', '/api/auth/register', '/api/auth/google'];

/**
 * Middleware that validates the JWT access token from the Authorization header.
 * Skips validation for public paths (health, login, register).
 * On success, attaches the decoded payload to `req.user`.
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.includes(req.path)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header', code: 401 });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('JWT_SECRET environment variable is not set');
    res.status(500).json({ error: 'Internal server error', code: 500 });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JWTPayload;
    req.user = decoded;
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Token has expired'
      : 'Invalid token';
    res.status(401).json({ error: message, code: 401 });
  }
}

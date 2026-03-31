import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware that assigns a unique request ID to each incoming request
 * and logs the request/response using winston in structured JSON format.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}

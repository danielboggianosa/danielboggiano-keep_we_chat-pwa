import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate limiter middleware: 100 requests per minute per authenticated userId.
 * Returns 429 with Retry-After header when limit is exceeded.
 * Unauthenticated requests fall back to IP-based limiting.
 */
export const rateLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 100,
  standardHeaders: true, // sends RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    if (req.user?.userId) return req.user.userId;
    return req.ip ?? 'unknown';
  },
  validate: { keyGeneratorIpFallback: false },
  handler: (_req: Request, res: Response): void => {
    const retryAfterSeconds = Math.ceil(60_000 / 1000); // window in seconds
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many requests, please try again later',
      code: 429,
      retryAfter: retryAfterSeconds,
    });
  },
});

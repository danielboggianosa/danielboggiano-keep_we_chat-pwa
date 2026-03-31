import cors from 'cors';
import type { RequestHandler } from 'express';

/**
 * CORS middleware configured from the ALLOWED_ORIGINS environment variable.
 * ALLOWED_ORIGINS is a comma-separated list of allowed origins.
 */
export function corsMiddleware(): RequestHandler {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  const allowedOrigins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });
}

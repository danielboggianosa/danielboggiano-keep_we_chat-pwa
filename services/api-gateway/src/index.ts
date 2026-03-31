import express, { Request, Response, NextFunction } from 'express';
import { runMigrations } from './migrate.js';
import { securityHeaders } from './middleware/security-headers.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestLogger } from './middleware/request-logger.js';
import { jwtAuth } from './middleware/jwt-auth.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { sanitize } from './middleware/sanitize.js';
import { authRouter } from './routes/auth.js';
import { transcriptionsRouter } from './routes/transcriptions.js';
import { proxyRouter } from './routes/proxy.js';
import { syncRouter } from './routes/sync.js';
import { exportRouter } from './routes/export.js';
import { searchRouter } from './routes/search.js';
import { calendarRouter } from './routes/calendar.js';
import { logger } from './logger.js';
import {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  httpRequestErrorsTotal,
} from './metrics.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

// --- Middleware stack (order matters) ---

// 1. Security headers (helmet)
app.use(securityHeaders());

// 2. CORS
app.use(corsMiddleware());

// 3. JSON body parser with 50mb limit for audio uploads
app.use(express.json({ limit: '50mb' }));

// 3.5 Prometheus metrics collection middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    end(labels);
    httpRequestsTotal.inc(labels);
    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc(labels);
    }
  });
  next();
});

// 4. Request ID + structured logging
app.use(requestLogger);

// 5. JWT auth (skips /health, /api/auth/login, /api/auth/register)
app.use(jwtAuth);

// 6. Rate limiting (keyed by userId, 100 req/min)
app.use(rateLimiter);

// 7. Input sanitization (SQL injection + XSS)
app.use(sanitize);

// --- Routes ---

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

// Auth routes
app.use('/api/auth', authRouter);

// Transcriptions CRUD + edit + share
app.use('/api/transcriptions', transcriptionsRouter);

// Proxy routes (STT + NLP)
app.use('/api', proxyRouter);

// Sync batch endpoint
app.use('/api/sync', syncRouter);

// Export endpoint
app.use('/api/export', exportRouter);

// Search proxy
app.use('/api/search', searchRouter);

// Calendar proxy
app.use('/api/calendar', calendarRouter);

// Prometheus metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    logger.error('Failed to collect metrics', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).end();
  }
});

// Unhandled error capture middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Process-level unhandled error capture
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

async function start(): Promise<void> {
  try {
    await runMigrations();
    logger.info('Migrations completed successfully.');
  } catch (err) {
    logger.error('Migration failed', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`API Gateway listening on port ${PORT}`);
  });
}

start();

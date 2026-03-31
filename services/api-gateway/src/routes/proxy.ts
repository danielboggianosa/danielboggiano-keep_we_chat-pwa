import { Router } from 'express';
import type { Request, Response } from 'express';
import { logger } from '../logger.js';

const router = Router();

const STT_SERVICE_URL = process.env.STT_SERVICE_URL ?? 'http://stt-cloud:8000';
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL ?? 'http://nlp-service:8000';

/**
 * Forward a JSON request to an internal service URL using fetch.
 */
async function forwardRequest(
  serviceUrl: string,
  path: string,
  req: Request,
  res: Response,
): Promise<void> {
  const url = `${serviceUrl}${path}`;
  try {
    const headers: Record<string, string> = {
      'content-type': req.headers['content-type'] ?? 'application/json',
    };
    // Forward user context
    if (req.user) {
      headers['x-user-id'] = req.user.userId;
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    res.status(response.status).json(body);
  } catch (err) {
    logger.error('Proxy request failed', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(502).json({ error: 'Upstream service unavailable', code: 502 });
  }
}

// ─── STT Proxy ───────────────────────────────────────────────────

/** POST /api/stt/transcribe → STT service */
router.post('/stt/transcribe', (req: Request, res: Response) => {
  void forwardRequest(STT_SERVICE_URL, '/transcribe', req, res);
});

// ─── NLP Proxy ───────────────────────────────────────────────────

/** POST /api/nlp/summary → NLP service */
router.post('/nlp/summary', (req: Request, res: Response) => {
  void forwardRequest(NLP_SERVICE_URL, '/summary', req, res);
});

/** POST /api/nlp/actions → NLP service */
router.post('/nlp/actions', (req: Request, res: Response) => {
  void forwardRequest(NLP_SERVICE_URL, '/actions', req, res);
});

/** POST /api/nlp/minutes → NLP service */
router.post('/nlp/minutes', (req: Request, res: Response) => {
  void forwardRequest(NLP_SERVICE_URL, '/minutes', req, res);
});

export { router as proxyRouter };

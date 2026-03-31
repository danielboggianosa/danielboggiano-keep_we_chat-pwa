import { Router } from 'express';
import type { Request, Response } from 'express';
import { logger } from '../logger.js';

const router = Router();

const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL ?? 'http://search-service:4002';

/**
 * GET /api/search
 * Proxies search queries to the search service, forwarding user context.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `${SEARCH_SERVICE_URL}/search?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-user-id': req.user!.userId,
      },
    });

    const body = await response.json();
    res.status(response.status).json(body);
  } catch (err) {
    logger.error('Search proxy failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(502).json({ error: 'Search service unavailable', code: 502 });
  }
});

/**
 * GET /api/search/suggestions
 * Proxies suggestion queries to the search service.
 */
router.get('/suggestions', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `${SEARCH_SERVICE_URL}/search/suggestions?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-user-id': req.user!.userId,
      },
    });

    const body = await response.json();
    res.status(response.status).json(body);
  } catch (err) {
    logger.error('Search suggestions proxy failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(502).json({ error: 'Search service unavailable', code: 502 });
  }
});

export { router as searchRouter };

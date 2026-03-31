import { Router } from 'express';
import type { Request, Response } from 'express';
import { logger } from '../logger.js';

const router = Router();

const CALENDAR_SERVICE_URL = process.env.CALENDAR_SERVICE_URL ?? 'http://calendar-service:4003';

/**
 * Forward a request to the calendar service.
 */
async function forwardToCalendar(
  path: string,
  method: string,
  req: Request,
  res: Response,
): Promise<void> {
  const url = `${CALENDAR_SERVICE_URL}${path}`;
  try {
    const headers: Record<string, string> = {
      'x-user-id': req.user!.userId,
    };
    if (method !== 'GET') {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      res.status(response.status).json(body);
    } else {
      // Handle redirects or text responses
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          res.redirect(response.status, location);
          return;
        }
      }
      const body = await response.text();
      res.status(response.status).send(body);
    }
  } catch (err) {
    logger.error('Calendar proxy failed', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(502).json({ error: 'Calendar service unavailable', code: 502 });
  }
}

/** GET /api/calendar/events */
router.get('/events', (req: Request, res: Response) => {
  void forwardToCalendar('/events', 'GET', req, res);
});

/** POST /api/calendar/connect */
router.post('/connect', (req: Request, res: Response) => {
  const provider = req.body?.provider;
  void forwardToCalendar(`/connect/${provider ?? 'google-calendar'}`, 'GET', req, res);
});

/** GET /api/calendar/callback */
router.get('/callback', (req: Request, res: Response) => {
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const provider = (req.query.provider as string) ?? 'google-calendar';
  void forwardToCalendar(`/callback/${provider}?${queryString}`, 'GET', req, res);
});

/** POST /api/calendar/reminders */
router.post('/reminders', (req: Request, res: Response) => {
  void forwardToCalendar('/reminders', 'POST', req, res);
});

export { router as calendarRouter };

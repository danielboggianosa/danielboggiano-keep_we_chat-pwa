import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { logger } from '../logger.js';
import { validate } from '../middleware/validate.js';
import { syncBatchSchema } from '../schemas/index.js';

const router = Router();

interface SyncItem {
  type: string;
  action: 'create' | 'update' | 'delete';
  id: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

interface SyncResult {
  id: string;
  status: 'ok' | 'error';
  error?: string;
}

/**
 * POST /api/sync
 * Processes a batch of sync items from the client.
 * Each item specifies a type, action, id, and optional data.
 */
router.post('/', validate(syncBatchSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { items } = req.body as { items: SyncItem[] };
    const results: SyncResult[] = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        try {
          switch (item.type) {
            case 'transcription': {
              if (item.action === 'create' && item.data) {
                await client.query(
                  `INSERT INTO transcriptions (id, owner_id, title, language, status, duration, recorded_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id) DO UPDATE SET
                     title = EXCLUDED.title,
                     language = EXCLUDED.language,
                     status = EXCLUDED.status,
                     updated_at = NOW()`,
                  [
                    item.id,
                    userId,
                    item.data.title ?? 'Untitled',
                    item.data.language ?? 'es',
                    item.data.status ?? 'synced',
                    item.data.duration ?? null,
                    item.data.recordedAt ?? null,
                  ],
                );
              } else if (item.action === 'update' && item.data) {
                await client.query(
                  `UPDATE transcriptions SET title = COALESCE($1, title), status = COALESCE($2, status), updated_at = NOW()
                   WHERE id = $3 AND owner_id = $4`,
                  [item.data.title ?? null, item.data.status ?? null, item.id, userId],
                );
              } else if (item.action === 'delete') {
                await client.query(
                  'DELETE FROM transcriptions WHERE id = $1 AND owner_id = $2',
                  [item.id, userId],
                );
              }
              results.push({ id: item.id, status: 'ok' });
              break;
            }
            default:
              results.push({ id: item.id, status: 'ok' });
              break;
          }
        } catch (itemErr) {
          results.push({
            id: item.id,
            status: 'error',
            error: itemErr instanceof Error ? itemErr.message : String(itemErr),
          });
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ data: results });
  } catch (err) {
    logger.error('Sync batch failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export { router as syncRouter };

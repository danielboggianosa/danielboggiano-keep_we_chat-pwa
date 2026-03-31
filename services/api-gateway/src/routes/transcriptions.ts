import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { logger } from '../logger.js';
import { validate } from '../middleware/validate.js';
import {
  createTranscriptionSchema,
  updateTranscriptionSchema,
  editSegmentSchema,
  shareTranscriptionSchema,
} from '../schemas/index.js';

const router = Router();

/**
 * Helper: check if the authenticated user owns or has shared access to a transcription.
 * Returns the transcription row if accessible, null otherwise.
 */
async function getAccessibleTranscription(
  transcriptionId: string,
  userId: string,
  requiredPermission?: 'read' | 'read-write',
): Promise<{ row: Record<string, unknown>; permission: string } | null> {
  // Check ownership first
  const own = await pool.query('SELECT * FROM transcriptions WHERE id = $1 AND owner_id = $2', [
    transcriptionId,
    userId,
  ]);
  if (own.rows.length > 0) {
    return { row: own.rows[0], permission: 'owner' };
  }

  // Check shared access
  const shared = await pool.query(
    'SELECT ts.permission, t.* FROM transcription_shares ts JOIN transcriptions t ON t.id = ts.transcription_id WHERE ts.transcription_id = $1 AND ts.shared_with_user_id = $2',
    [transcriptionId, userId],
  );
  if (shared.rows.length > 0) {
    const perm = shared.rows[0].permission as string;
    if (requiredPermission === 'read-write' && perm !== 'read-write') {
      return null;
    }
    return { row: shared.rows[0], permission: perm };
  }

  return null;
}

// ─── GET /api/transcriptions ─────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT t.* FROM transcriptions t
       WHERE t.owner_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM transcriptions WHERE owner_id = $1',
      [userId],
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count, 10),
      },
    });
  } catch (err) {
    logger.error('Failed to list transcriptions', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ─── POST /api/transcriptions ────────────────────────────────────
router.post('/', validate(createTranscriptionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { title, language, audioFileUrl, duration, recordedAt, segments, speakers } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tResult = await client.query(
        `INSERT INTO transcriptions (owner_id, title, language, audio_file_url, duration, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, title, language, audioFileUrl ?? null, duration ?? null, recordedAt ?? null],
      );
      const transcription = tResult.rows[0];

      // Insert speakers if provided
      const speakerMap = new Map<string, string>(); // clientId -> dbId
      if (speakers && speakers.length > 0) {
        for (const s of speakers) {
          const sResult = await client.query(
            'INSERT INTO speakers (transcription_id, label, identified_name) VALUES ($1, $2, $3) RETURNING id',
            [transcription.id, s.label, s.identifiedName ?? null],
          );
          if (s.id) {
            speakerMap.set(s.id, sResult.rows[0].id);
          }
        }
      }

      // Insert segments if provided
      if (segments && segments.length > 0) {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const speakerDbId = seg.speakerId ? (speakerMap.get(seg.speakerId) ?? null) : null;
          await client.query(
            `INSERT INTO segments (transcription_id, speaker_id, start_time, end_time, content, confidence, order_index)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [transcription.id, speakerDbId, seg.startTime, seg.endTime, seg.content, seg.confidence, i],
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ data: transcription });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Failed to create transcription', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ─── GET /api/transcriptions/:id ─────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const access = await getAccessibleTranscription(req.params.id, userId);
    if (!access) {
      res.status(404).json({ error: 'Transcription not found', code: 404 });
      return;
    }

    // Fetch segments and speakers
    const [segResult, spkResult] = await Promise.all([
      pool.query(
        'SELECT id, speaker_id, start_time, end_time, content, confidence, order_index FROM segments WHERE transcription_id = $1 ORDER BY order_index',
        [req.params.id],
      ),
      pool.query(
        'SELECT id, label, identified_name FROM speakers WHERE transcription_id = $1',
        [req.params.id],
      ),
    ]);

    res.json({
      data: {
        ...access.row,
        segments: segResult.rows,
        speakers: spkResult.rows,
      },
    });
  } catch (err) {
    logger.error('Failed to get transcription', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ─── PUT /api/transcriptions/:id ─────────────────────────────────
router.put('/:id', validate(updateTranscriptionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Only owner can update
    const own = await pool.query('SELECT id FROM transcriptions WHERE id = $1 AND owner_id = $2', [
      req.params.id,
      userId,
    ]);
    if (own.rows.length === 0) {
      res.status(404).json({ error: 'Transcription not found', code: 404 });
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of ['title', 'language', 'status'] as const) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update', code: 400 });
      return;
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE transcriptions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Failed to update transcription', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ─── DELETE /api/transcriptions/:id ──────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const result = await pool.query(
      'DELETE FROM transcriptions WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Transcription not found', code: 404 });
      return;
    }

    res.json({ message: 'Transcription deleted' });
  } catch (err) {
    logger.error('Failed to delete transcription', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ─── POST /api/transcriptions/:id/segments/:idx/edit ─────────────
router.post(
  '/:id/segments/:idx/edit',
  validate(editSegmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const transcriptionId = req.params.id;
      const segmentIdx = parseInt(req.params.idx, 10);

      if (isNaN(segmentIdx) || segmentIdx < 0) {
        res.status(400).json({ error: 'Invalid segment index', code: 400 });
        return;
      }

      // Check access — need owner or read-write permission
      const access = await getAccessibleTranscription(transcriptionId, userId, 'read-write');
      if (!access) {
        res.status(404).json({ error: 'Transcription not found or insufficient permissions', code: 404 });
        return;
      }

      // Find the segment by order_index
      const segResult = await pool.query(
        'SELECT id, content FROM segments WHERE transcription_id = $1 AND order_index = $2',
        [transcriptionId, segmentIdx],
      );

      if (segResult.rows.length === 0) {
        res.status(404).json({ error: 'Segment not found', code: 404 });
        return;
      }

      const segment = segResult.rows[0];
      const previousText = segment.content as string;
      const { newText } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update the segment content
        await client.query('UPDATE segments SET content = $1 WHERE id = $2', [newText, segment.id]);

        // Record the edit
        await client.query(
          `INSERT INTO edit_records (transcription_id, segment_index, previous_text, new_text, edited_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [transcriptionId, segmentIdx, previousText, newText, userId],
        );

        await client.query('COMMIT');

        res.json({
          data: {
            segmentIndex: segmentIdx,
            previousText,
            newText,
            editedBy: userId,
          },
        });
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error('Failed to edit segment', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  },
);

// ─── GET /api/transcriptions/:id/edits ───────────────────────────
router.get('/:id/edits', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const transcriptionId = req.params.id;

    const access = await getAccessibleTranscription(transcriptionId, userId);
    if (!access) {
      res.status(404).json({ error: 'Transcription not found', code: 404 });
      return;
    }

    const result = await pool.query(
      `SELECT er.id, er.segment_index, er.previous_text, er.new_text, er.edited_by, er.edited_at, u.name AS editor_name
       FROM edit_records er
       JOIN users u ON u.id = er.edited_by
       WHERE er.transcription_id = $1
       ORDER BY er.edited_at DESC`,
      [transcriptionId],
    );

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Failed to get edit history', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ─── POST /api/transcriptions/:id/share ──────────────────────────
router.post(
  '/:id/share',
  validate(shareTranscriptionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const transcriptionId = req.params.id;

      // Only owner can share
      const own = await pool.query('SELECT id FROM transcriptions WHERE id = $1 AND owner_id = $2', [
        transcriptionId,
        userId,
      ]);
      if (own.rows.length === 0) {
        res.status(404).json({ error: 'Transcription not found', code: 404 });
        return;
      }

      const { email, permission } = req.body;

      // Find the target user
      const targetUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (targetUser.rows.length === 0) {
        res.status(404).json({ error: 'User not found with that email', code: 404 });
        return;
      }

      const targetUserId = targetUser.rows[0].id;

      if (targetUserId === userId) {
        res.status(400).json({ error: 'Cannot share with yourself', code: 400 });
        return;
      }

      // Upsert share (update permission if already shared)
      const result = await pool.query(
        `INSERT INTO transcription_shares (transcription_id, shared_by_user_id, shared_with_user_id, permission)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (transcription_id, shared_with_user_id)
         DO UPDATE SET permission = EXCLUDED.permission, shared_at = NOW()
         RETURNING *`,
        [transcriptionId, userId, targetUserId, permission],
      );

      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      logger.error('Failed to share transcription', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  },
);

// ─── GET /api/transcriptions/:id/share ───────────────────────────
router.get('/:id/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const transcriptionId = req.params.id;

    // Only owner can see shares
    const own = await pool.query('SELECT id FROM transcriptions WHERE id = $1 AND owner_id = $2', [
      transcriptionId,
      userId,
    ]);
    if (own.rows.length === 0) {
      res.status(404).json({ error: 'Transcription not found', code: 404 });
      return;
    }

    const result = await pool.query(
      `SELECT ts.id, ts.permission, ts.shared_at, u.id AS user_id, u.email, u.name
       FROM transcription_shares ts
       JOIN users u ON u.id = ts.shared_with_user_id
       WHERE ts.transcription_id = $1`,
      [transcriptionId],
    );

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Failed to list shares', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export { router as transcriptionsRouter };

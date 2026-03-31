import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { logger } from '../logger.js';

const router = Router();

/**
 * Format segments as WebVTT.
 */
function toVTT(segments: Array<{ start_time: number; end_time: number; content: string; label?: string }>): string {
  let vtt = 'WEBVTT\n\n';
  for (const seg of segments) {
    const start = formatTimestamp(seg.start_time);
    const end = formatTimestamp(seg.end_time);
    const speaker = seg.label ? `<v ${seg.label}>` : '';
    vtt += `${start} --> ${end}\n${speaker}${seg.content}\n\n`;
  }
  return vtt;
}

/**
 * Format segments as plain text.
 */
function toTXT(segments: Array<{ start_time: number; content: string; label?: string }>): string {
  return segments
    .map((seg) => {
      const speaker = seg.label ? `[${seg.label}] ` : '';
      return `${speaker}${seg.content}`;
    })
    .join('\n');
}

/**
 * Format segments as Markdown.
 */
function toMarkdown(
  title: string,
  segments: Array<{ start_time: number; end_time: number; content: string; label?: string }>,
): string {
  let md = `# ${title}\n\n`;
  let currentSpeaker = '';
  for (const seg of segments) {
    const speaker = seg.label ?? 'Unknown';
    if (speaker !== currentSpeaker) {
      md += `\n**${speaker}:**\n\n`;
      currentSpeaker = speaker;
    }
    md += `${seg.content}\n\n`;
  }
  return md;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * GET /api/export/:id/:format
 * Exports a transcription in the specified format (vtt, txt, markdown).
 */
router.get('/:id/:format', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id, format } = req.params;

    if (!['vtt', 'txt', 'markdown'].includes(format)) {
      res.status(400).json({ error: 'Format must be "vtt", "txt", or "markdown"', code: 400 });
      return;
    }

    // Check access (owner or shared)
    const accessCheck = await pool.query(
      `SELECT t.id, t.title FROM transcriptions t
       WHERE t.id = $1 AND (
         t.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM transcription_shares ts
           WHERE ts.transcription_id = t.id AND ts.shared_with_user_id = $2
         )
       )`,
      [id, userId],
    );

    if (accessCheck.rows.length === 0) {
      res.status(404).json({ error: 'Transcription not found', code: 404 });
      return;
    }

    const title = accessCheck.rows[0].title as string;

    // Fetch segments with speaker labels
    const segResult = await pool.query(
      `SELECT s.start_time, s.end_time, s.content, sp.label
       FROM segments s
       LEFT JOIN speakers sp ON sp.id = s.speaker_id
       WHERE s.transcription_id = $1
       ORDER BY s.order_index`,
      [id],
    );

    const segments = segResult.rows;
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'vtt':
        content = toVTT(segments);
        contentType = 'text/vtt; charset=utf-8';
        filename = `${title}.vtt`;
        break;
      case 'txt':
        content = toTXT(segments);
        contentType = 'text/plain; charset=utf-8';
        filename = `${title}.txt`;
        break;
      case 'markdown':
        content = toMarkdown(title, segments);
        contentType = 'text/markdown; charset=utf-8';
        filename = `${title}.md`;
        break;
      default:
        res.status(400).json({ error: 'Unsupported format', code: 400 });
        return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    logger.error('Export failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export { router as exportRouter };

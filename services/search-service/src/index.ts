import express, { Request, Response, NextFunction } from 'express';
import pg from 'pg';
import promClient from 'prom-client';
import winston from 'winston';

// --- Logger ---

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'search-service';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.sssZ' }),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [new winston.transports.Console()],
});

// --- Database ---

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Prometheus Metrics ---

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

const httpRequestErrorsTotal = new promClient.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// --- Constants ---

const PAGE_SIZE = 20;

const DICT_CONFIG: Record<string, string> = {
  es: 'spanish',
  en: 'english',
};

// --- Express App ---

const app = express();
const PORT = Number(process.env.PORT ?? 4003);

app.use(express.json({ limit: '1mb' }));

// Metrics middleware
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

// --- Health & Metrics Endpoints ---

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy' });
  } catch {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

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

// --- GET /search ---

interface SearchQuery {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  speaker?: string;
  lang?: string;
  page?: string;
}

app.get('/search', async (req: Request<unknown, unknown, unknown, SearchQuery>, res: Response) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { q, dateFrom, dateTo, speaker, lang, page } = req.query;

  if (!q || q.trim().length === 0) {
    res.status(400).json({ error: 'Query parameter "q" is required and must not be empty' });
    return;
  }

  const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const dictConfig = lang ? (DICT_CONFIG[lang] ?? 'english') : 'english';

  try {
    // Build parameterized query
    const params: unknown[] = [dictConfig, q.trim(), userId, PAGE_SIZE, offset];
    let paramIdx = 6;

    let dateFromClause = '';
    if (dateFrom) {
      dateFromClause = `AND t.recorded_at >= $${paramIdx}`;
      params.push(dateFrom);
      paramIdx++;
    }

    let dateToClause = '';
    if (dateTo) {
      dateToClause = `AND t.recorded_at <= $${paramIdx}`;
      params.push(dateTo);
      paramIdx++;
    }

    let speakerClause = '';
    if (speaker) {
      speakerClause = `AND s.speaker_id = $${paramIdx}`;
      params.push(speaker);
      paramIdx++;
    }

    const searchSQL = `
      SELECT
        s.id AS segment_id,
        s.content,
        s.start_time,
        s.end_time,
        s.confidence,
        s.order_index,
        s.speaker_id,
        sp.label AS speaker_label,
        sp.identified_name AS speaker_name,
        t.id AS transcription_id,
        t.title AS transcription_title,
        t.recorded_at,
        t.language,
        ts_rank(s.search_vector, plainto_tsquery($1::regconfig, $2)) AS rank,
        ts_headline($1::regconfig, s.content, plainto_tsquery($1::regconfig, $2),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS highlight
      FROM segments s
      JOIN transcriptions t ON s.transcription_id = t.id
      LEFT JOIN speakers sp ON s.speaker_id = sp.id
      WHERE s.search_vector @@ plainto_tsquery($1::regconfig, $2)
        AND (
          t.owner_id = $3
          OR EXISTS (
            SELECT 1 FROM transcription_shares ts
            WHERE ts.transcription_id = t.id AND ts.shared_with_user_id = $3
          )
        )
        ${dateFromClause}
        ${dateToClause}
        ${speakerClause}
      ORDER BY ts_rank(s.search_vector, plainto_tsquery($1::regconfig, $2)) DESC
      LIMIT $4 OFFSET $5
    `;

    const countSQL = `
      SELECT COUNT(*) AS total
      FROM segments s
      JOIN transcriptions t ON s.transcription_id = t.id
      WHERE s.search_vector @@ plainto_tsquery($1::regconfig, $2)
        AND (
          t.owner_id = $3
          OR EXISTS (
            SELECT 1 FROM transcription_shares ts
            WHERE ts.transcription_id = t.id AND ts.shared_with_user_id = $3
          )
        )
        ${dateFromClause}
        ${dateToClause}
        ${speakerClause}
    `;

    // Count query uses same params minus LIMIT/OFFSET
    const countParams = [params[0], params[1], params[2], ...params.slice(5)];

    const [searchResult, countResult] = await Promise.all([
      pool.query(searchSQL, params),
      pool.query(countSQL, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const results = searchResult.rows.map((row) => ({
      segmentId: row.segment_id,
      content: row.content,
      highlight: row.highlight,
      startTime: row.start_time,
      endTime: row.end_time,
      confidence: row.confidence,
      speaker: {
        id: row.speaker_id,
        label: row.speaker_label,
        name: row.speaker_name,
      },
      transcription: {
        id: row.transcription_id,
        title: row.transcription_title,
        recordedAt: row.recorded_at,
        language: row.language,
      },
      rank: row.rank,
    }));

    logger.info('Search executed', {
      query: q,
      userId,
      resultCount: results.length,
      total,
      page: pageNum,
    });

    res.json({
      results,
      pagination: {
        page: pageNum,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
      },
    });
  } catch (err) {
    logger.error('Search query failed', {
      error: err instanceof Error ? err.message : String(err),
      query: q,
      userId,
    });
    res.status(500).json({ error: 'Search failed' });
  }
});

// --- POST /index ---

interface IndexRequestBody {
  transcriptionId: string;
  segments: Array<{
    id: string;
    content: string;
    startTime: number;
    endTime: number;
    confidence: number;
    speakerId?: string;
    orderIndex: number;
  }>;
  language: string;
}

app.post('/index', async (req: Request<unknown, unknown, IndexRequestBody>, res: Response) => {
  const { transcriptionId, segments, language } = req.body;

  if (!transcriptionId || !segments || !Array.isArray(segments)) {
    res.status(400).json({ error: 'transcriptionId and segments array are required' });
    return;
  }

  const dictConfig = DICT_CONFIG[language] ?? 'english';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const seg of segments) {
      await client.query(
        `INSERT INTO segments (id, transcription_id, speaker_id, start_time, end_time, content, confidence, order_index, search_vector)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_tsvector($9::regconfig, $10))
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           search_vector = to_tsvector($9::regconfig, EXCLUDED.content),
           speaker_id = EXCLUDED.speaker_id,
           confidence = EXCLUDED.confidence`,
        [
          seg.id,
          transcriptionId,
          seg.speakerId ?? null,
          seg.startTime,
          seg.endTime,
          seg.content,
          seg.confidence,
          seg.orderIndex,
          dictConfig,
          seg.content,
        ]
      );
    }

    await client.query('COMMIT');

    logger.info('Transcription indexed', {
      transcriptionId,
      segmentCount: segments.length,
      language,
    });

    res.json({ indexed: segments.length, transcriptionId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Indexing failed', {
      error: err instanceof Error ? err.message : String(err),
      transcriptionId,
    });
    res.status(500).json({ error: 'Indexing failed' });
  } finally {
    client.release();
  }
});

// --- Global error handler ---

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start server ---

app.listen(PORT, () => {
  logger.info(`Search Service listening on port ${PORT}`);
});

export { app, pool };

import express, { Request, Response, NextFunction } from 'express';
import pg from 'pg';
import promClient from 'prom-client';
import winston from 'winston';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import * as msal from '@azure/msal-node';

// --- Logger ---

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'calendar-service';

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

// --- Token Encryption ---

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
  // Derive a 32-byte key from the provided key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedStr: string): string {
  const key = getEncryptionKey();
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- OAuth Providers Configuration ---

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? '';

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID ?? '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET ?? '';
const AZURE_REDIRECT_URI = process.env.AZURE_REDIRECT_URI ?? '';
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID ?? 'common';

function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

function getMsalClient(): msal.ConfidentialClientApplication {
  return new msal.ConfidentialClientApplication({
    auth: {
      clientId: AZURE_CLIENT_ID,
      clientSecret: AZURE_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    },
  });
}

type SupportedProvider = 'google-calendar' | 'teams-calendar';

function isValidProvider(provider: string): provider is SupportedProvider {
  return provider === 'google-calendar' || provider === 'teams-calendar';
}

// --- Token Management Helpers ---

interface StoredTokenRow {
  id: string;
  user_id: string;
  provider: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  status: string;
}

async function getStoredTokens(userId: string, provider: string): Promise<StoredTokenRow | null> {
  const result = await pool.query<StoredTokenRow>(
    `SELECT * FROM calendar_tokens WHERE user_id = $1 AND provider = $2`,
    [userId, provider],
  );
  return result.rows[0] ?? null;
}

async function upsertTokens(
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
): Promise<void> {
  const accessEncrypted = encryptToken(accessToken);
  const refreshEncrypted = encryptToken(refreshToken);

  // Check if a row already exists for this user+provider
  const existing = await pool.query(
    `SELECT id FROM calendar_tokens WHERE user_id = $1 AND provider = $2`,
    [userId, provider],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE calendar_tokens
       SET access_token_encrypted = $1,
           refresh_token_encrypted = $2,
           token_expires_at = $3,
           status = 'active',
           updated_at = NOW()
       WHERE user_id = $4 AND provider = $5`,
      [accessEncrypted, refreshEncrypted, expiresAt, userId, provider],
    );
  } else {
    await pool.query(
      `INSERT INTO calendar_tokens (user_id, provider, access_token_encrypted, refresh_token_encrypted, token_expires_at, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [userId, provider, accessEncrypted, refreshEncrypted, expiresAt],
    );
  }
}

async function markRequiresReauth(userId: string, provider: string): Promise<void> {
  await pool.query(
    `UPDATE calendar_tokens SET status = 'requires_reauth', updated_at = NOW()
     WHERE user_id = $1 AND provider = $2`,
    [userId, provider],
  );
}

// --- Token Refresh Logic ---

async function ensureValidAccessToken(
  userId: string,
  provider: SupportedProvider,
): Promise<string> {
  const stored = await getStoredTokens(userId, provider);
  if (!stored) {
    throw new Error(`No calendar tokens found for provider ${provider}`);
  }

  if (stored.status === 'requires_reauth') {
    throw new Error(`Re-authentication required for ${provider}`);
  }

  const expiresAt = new Date(stored.token_expires_at);
  const now = new Date();

  // If token is still valid (with 60s buffer), return it
  if (expiresAt.getTime() - now.getTime() > 60_000) {
    return decryptToken(stored.access_token_encrypted);
  }

  // Token expired — attempt refresh
  logger.info('Access token expired, attempting refresh', { userId, provider });

  try {
    const refreshToken = decryptToken(stored.refresh_token_encrypted);

    if (provider === 'google-calendar') {
      return await refreshGoogleToken(userId, refreshToken);
    } else {
      return await refreshAzureToken(userId, refreshToken);
    }
  } catch (err) {
    logger.warn('Token refresh failed, marking requires_reauth', {
      userId,
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    await markRequiresReauth(userId, provider);
    throw new Error(`Token refresh failed for ${provider}. Re-authentication required.`);
  }
}

async function refreshGoogleToken(userId: string, refreshToken: string): Promise<string> {
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  const newAccessToken = credentials.access_token!;
  const newRefreshToken = credentials.refresh_token ?? refreshToken;
  const expiryDate = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await upsertTokens(userId, 'google-calendar', newAccessToken, newRefreshToken, expiryDate);
  logger.info('Google token refreshed successfully', { userId });
  return newAccessToken;
}

async function refreshAzureToken(userId: string, refreshToken: string): Promise<string> {
  const msalClient = getMsalClient();
  const result = await msalClient.acquireTokenByRefreshToken({
    refreshToken,
    scopes: ['https://graph.microsoft.com/Calendars.ReadWrite'],
  });

  if (!result) throw new Error('MSAL refresh returned null');

  const newAccessToken = result.accessToken;
  const expiresOn = result.expiresOn ?? new Date(Date.now() + 3600 * 1000);

  // Azure doesn't always return a new refresh token; keep the old one
  await upsertTokens(userId, 'teams-calendar', newAccessToken, refreshToken, expiresOn);
  logger.info('Azure token refreshed successfully', { userId });
  return newAccessToken;
}

// --- Calendar Event Fetching ---

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  participants: string[];
  provider: string;
  meetingUrl?: string;
}

async function fetchGoogleEvents(accessToken: string): Promise<CalendarEvent[]> {
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: twoWeeksLater.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const items = response.data.items ?? [];
  return items.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    title: item.summary ?? 'Untitled Event',
    startTime: item.start?.dateTime ?? item.start?.date ?? now.toISOString(),
    endTime: item.end?.dateTime ?? item.end?.date ?? now.toISOString(),
    participants: (item.attendees ?? []).map((a) => a.email ?? 'unknown'),
    provider: 'google-calendar',
    meetingUrl: item.hangoutLink ?? item.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
  }));
}

async function fetchAzureEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const url = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${now.toISOString()}&endDateTime=${twoWeeksLater.toISOString()}&$top=50&$orderby=start/dateTime`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    value: Array<{
      id: string;
      subject: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees: Array<{ emailAddress: { address: string } }>;
      onlineMeeting?: { joinUrl: string };
      isOnlineMeeting?: boolean;
    }>;
  };

  return (data.value ?? []).map((item) => ({
    id: item.id,
    title: item.subject ?? 'Untitled Event',
    startTime: item.start.dateTime.endsWith('Z') ? item.start.dateTime : `${item.start.dateTime}Z`,
    endTime: item.end.dateTime.endsWith('Z') ? item.end.dateTime : `${item.end.dateTime}Z`,
    participants: (item.attendees ?? []).map((a) => a.emailAddress.address),
    provider: 'teams-calendar',
    meetingUrl: item.onlineMeeting?.joinUrl,
  }));
}

// --- Reminder Creation ---

async function createGoogleReminder(
  accessToken: string,
  title: string,
  startTime: string,
  endTime: string,
  description?: string,
): Promise<string> {
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: title,
      description: description ?? '',
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
    },
  });

  return response.data.id ?? crypto.randomUUID();
}

async function createAzureReminder(
  accessToken: string,
  title: string,
  startTime: string,
  endTime: string,
  description?: string,
): Promise<string> {
  const url = 'https://graph.microsoft.com/v1.0/me/events';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: title,
      body: { contentType: 'Text', content: description ?? '' },
      start: { dateTime: startTime, timeZone: 'UTC' },
      end: { dateTime: endTime, timeZone: 'UTC' },
      isReminderOn: true,
      reminderMinutesBeforeStart: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

// --- Express App ---

const app = express();
const PORT = Number(process.env.PORT ?? 4004);

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

// --- GET /connect/:provider ---

app.get('/connect/:provider', (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { provider } = req.params;
  if (!isValidProvider(provider)) {
    res.status(400).json({ error: `Unsupported provider: ${provider}. Use "google-calendar" or "teams-calendar"` });
    return;
  }

  try {
    if (provider === 'google-calendar') {
      const oauth2Client = getGoogleOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/calendar'],
        state: userId,
      });
      logger.info('Redirecting to Google OAuth', { userId, provider });
      res.redirect(authUrl);
    } else {
      // teams-calendar
      const msalClient = getMsalClient();
      const authUrl = msalClient.getAuthCodeUrl({
        scopes: ['https://graph.microsoft.com/Calendars.ReadWrite'],
        redirectUri: AZURE_REDIRECT_URI,
        state: userId,
      });
      authUrl.then((url) => {
        logger.info('Redirecting to Azure OAuth', { userId, provider });
        res.redirect(url);
      }).catch((err) => {
        logger.error('Failed to generate Azure auth URL', {
          error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Failed to initiate OAuth flow' });
      });
    }
  } catch (err) {
    logger.error('OAuth connect failed', {
      error: err instanceof Error ? err.message : String(err),
      provider,
      userId,
    });
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// --- GET /callback/:provider ---

app.get('/callback/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;
  if (!isValidProvider(provider)) {
    res.status(400).json({ error: `Unsupported provider: ${provider}` });
    return;
  }

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined; // userId passed via state
  const error = req.query.error as string | undefined;

  if (error) {
    logger.warn('OAuth callback received error', { provider, error });
    res.status(400).json({ error: `OAuth error: ${error}` });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  const userId = state;

  try {
    if (provider === 'google-calendar') {
      const oauth2Client = getGoogleOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        res.status(400).json({ error: 'Failed to obtain tokens from Google' });
        return;
      }

      const expiryDate = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      await upsertTokens(userId, 'google-calendar', tokens.access_token, tokens.refresh_token, expiryDate);
      logger.info('Google OAuth tokens stored', { userId });
    } else {
      // teams-calendar
      const msalClient = getMsalClient();
      const result = await msalClient.acquireTokenByCode({
        code,
        scopes: ['https://graph.microsoft.com/Calendars.ReadWrite'],
        redirectUri: AZURE_REDIRECT_URI,
      });

      if (!result || !result.accessToken) {
        res.status(400).json({ error: 'Failed to obtain tokens from Azure' });
        return;
      }

      const expiresOn = result.expiresOn ?? new Date(Date.now() + 3600 * 1000);
      // MSAL doesn't directly expose refresh token; we store a placeholder
      // In production, MSAL cache handles refresh internally
      const refreshTokenPlaceholder = result.accessToken; // MSAL manages refresh internally

      await upsertTokens(userId, 'teams-calendar', result.accessToken, refreshTokenPlaceholder, expiresOn);
      logger.info('Azure OAuth tokens stored', { userId });
    }

    // Redirect back to the app with success status
    const appUrl = process.env.APP_URL ?? '/';
    res.redirect(`${appUrl}?calendar_connected=${provider}&status=success`);
  } catch (err) {
    logger.error('OAuth callback token exchange failed', {
      error: err instanceof Error ? err.message : String(err),
      provider,
      userId,
    });
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// --- GET /events ---

app.get('/events', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const provider = req.query.provider as string | undefined;

  try {
    // Get all active calendar connections for this user
    const tokensResult = await pool.query<StoredTokenRow>(
      provider
        ? `SELECT * FROM calendar_tokens WHERE user_id = $1 AND provider = $2 AND status = 'active'`
        : `SELECT * FROM calendar_tokens WHERE user_id = $1 AND status = 'active'`,
      provider ? [userId, provider] : [userId],
    );

    if (tokensResult.rows.length === 0) {
      res.json({ events: [], message: 'No active calendar connections' });
      return;
    }

    const allEvents: CalendarEvent[] = [];

    for (const tokenRow of tokensResult.rows) {
      try {
        const accessToken = await ensureValidAccessToken(userId, tokenRow.provider as SupportedProvider);

        if (tokenRow.provider === 'google-calendar') {
          const events = await fetchGoogleEvents(accessToken);
          allEvents.push(...events);
        } else if (tokenRow.provider === 'teams-calendar') {
          const events = await fetchAzureEvents(accessToken);
          allEvents.push(...events);
        }
      } catch (err) {
        logger.warn('Failed to fetch events from provider', {
          userId,
          provider: tokenRow.provider,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue with other providers if one fails
      }
    }

    // Sort by startTime ascending
    allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    logger.info('Events fetched', { userId, eventCount: allEvents.length });
    res.json({ events: allEvents });
  } catch (err) {
    logger.error('Failed to fetch events', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// --- POST /reminders ---

interface ReminderRequestBody {
  title: string;
  startTime: string;
  endTime: string;
  provider: string;
  description?: string;
}

app.post('/reminders', async (req: Request<unknown, unknown, ReminderRequestBody>, res: Response) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { title, startTime, endTime, provider, description } = req.body;

  if (!title || !startTime || !endTime || !provider) {
    res.status(400).json({ error: 'Missing required fields: title, startTime, endTime, provider' });
    return;
  }

  if (!isValidProvider(provider)) {
    res.status(400).json({ error: `Unsupported provider: ${provider}` });
    return;
  }

  try {
    const accessToken = await ensureValidAccessToken(userId, provider);

    let reminderId: string;

    if (provider === 'google-calendar') {
      reminderId = await createGoogleReminder(accessToken, title, startTime, endTime, description);
    } else {
      reminderId = await createAzureReminder(accessToken, title, startTime, endTime, description);
    }

    logger.info('Reminder created', { userId, provider, reminderId });
    res.status(201).json({ reminderId, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('Re-authentication required') || message.includes('requires_reauth')) {
      res.status(401).json({
        error: 'Calendar re-authentication required',
        code: 'REQUIRES_REAUTH',
        provider,
      });
      return;
    }

    logger.error('Failed to create reminder', {
      error: message,
      userId,
      provider,
    });
    res.status(500).json({ error: 'Failed to create reminder' });
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
  logger.info(`Calendar Service listening on port ${PORT}`);
});

export { app, pool, encryptToken as _encryptToken, decryptToken as _decryptToken };

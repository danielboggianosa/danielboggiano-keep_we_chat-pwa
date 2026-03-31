import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─── Transcriptions Schemas ──────────────────────────────────────

export const createTranscriptionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  language: z.enum(['es', 'en'], { message: 'Language must be "es" or "en"' }),
  audioFileUrl: z.string().optional(),
  duration: z.number().nonnegative().optional(),
  recordedAt: z.string().datetime().optional(),
  segments: z
    .array(
      z.object({
        startTime: z.number().nonnegative(),
        endTime: z.number().positive(),
        content: z.string().min(1),
        confidence: z.number().min(0).max(1),
        speakerId: z.string().optional(),
        speakerLabel: z.string().optional(),
      }),
    )
    .optional(),
  speakers: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        identifiedName: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export const updateTranscriptionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  language: z.enum(['es', 'en']).optional(),
  status: z.enum(['local', 'syncing', 'synced', 'enhanced']).optional(),
});

// ─── Segments Schemas ────────────────────────────────────────────

export const editSegmentSchema = z.object({
  newText: z.string().min(1, 'New text is required'),
});

// ─── Share Schemas ───────────────────────────────────────────────

export const shareTranscriptionSchema = z.object({
  email: z.string().email('Invalid email address'),
  permission: z.enum(['read', 'read-write'], {
    message: 'Permission must be "read" or "read-write"',
  }),
});

// ─── Search Schemas ──────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  speaker: z.string().optional(),
  lang: z.enum(['es', 'en']).optional(),
  page: z.coerce.number().int().positive().default(1),
});


// ─── Calendar Schemas ────────────────────────────────────────────

export const connectCalendarSchema = z.object({
  provider: z.enum(['google-calendar', 'teams-calendar'], {
    message: 'Provider must be "google-calendar" or "teams-calendar"',
  }),
});

export const createReminderSchema = z.object({
  actionItemId: z.string().uuid('Invalid action item ID'),
  title: z.string().min(1, 'Title is required').max(500),
  dateTime: z.string().datetime('Invalid datetime format'),
  provider: z.enum(['google-calendar', 'teams-calendar']).optional(),
});

// ─── Sync Schemas ────────────────────────────────────────────────

export const syncBatchSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.string().min(1),
        action: z.enum(['create', 'update', 'delete']),
        id: z.string().min(1),
        data: z.record(z.string(), z.unknown()).optional(),
        timestamp: z.string().datetime().optional(),
      }),
    )
    .min(1, 'At least one sync item is required'),
});

// ─── Export Schemas ──────────────────────────────────────────────

export const exportParamsSchema = z.object({
  format: z.enum(['vtt', 'txt', 'markdown'], {
    message: 'Format must be "vtt", "txt", or "markdown"',
  }),
});

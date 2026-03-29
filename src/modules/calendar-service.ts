/**
 * CalendarService — integrates with external calendars for auto-start
 * recording and action-item reminders.
 *
 * Uses a pluggable CalendarBackend interface so the real OAuth-based
 * backends can be swapped for a stub during testing.
 *
 * Covers Requirements: 11.1, 11.2, 11.3, 11.4, 5.4
 */

import type { CalendarProvider, CalendarEvent } from '../types/calendar';
import type { ActionItem } from '../types/nlp';
import type { RecordingConfig } from '../types/audio';

// ── Public types ────────────────────────────────────────────────

export type CaptureMode = 'direct' | 'ambient';

export interface CalendarNotification {
  eventId: string;
  eventTitle: string;
  startsIn: number; // minutes until start
  suggestedMode: CaptureMode;
}

export interface RecordingStartResult {
  sessionId: string;
  calendarEventId: string;
  eventTitle: string;
  participants: string[];
  captureMode: CaptureMode;
  recordingConfig: RecordingConfig;
}

export class CalendarServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TOKEN_EXPIRED'
      | 'EVENT_NOT_FOUND'
      | 'PROVIDER_UNAVAILABLE'
      | 'ALREADY_CONNECTED',
  ) {
    super(message);
    this.name = 'CalendarServiceError';
  }
}

// ── Backend interface ───────────────────────────────────────────

export interface CalendarBackend {
  /** Connect / authenticate with the calendar provider. */
  connect(provider: CalendarProvider): Promise<void>;

  /** Fetch upcoming events for a user. */
  fetchEvents(userId: string, provider: CalendarProvider): Promise<CalendarEvent[]>;

  /** Create a reminder entry in the calendar. */
  createReminder(
    provider: CalendarProvider,
    title: string,
    date: Date,
  ): Promise<string>; // returns reminder id

  /** Check whether the backend token is still valid. */
  isTokenValid(provider: CalendarProvider): boolean;
}

// ── Stub backend (for testing) ──────────────────────────────────

export class StubCalendarBackend implements CalendarBackend {
  private connected = new Set<CalendarProvider>();
  private events: CalendarEvent[] = [];
  private tokenValid = true;
  private nextReminderId = 1;

  /** Seed events for testing. */
  setEvents(events: CalendarEvent[]): void {
    this.events = events;
  }

  /** Simulate an expired token. */
  setTokenValid(valid: boolean): void {
    this.tokenValid = valid;
  }

  async connect(provider: CalendarProvider): Promise<void> {
    if (!this.tokenValid) {
      throw new CalendarServiceError(
        `Token expired for ${provider}`,
        'TOKEN_EXPIRED',
      );
    }
    this.connected.add(provider);
  }

  async fetchEvents(
    _userId: string,
    provider: CalendarProvider,
  ): Promise<CalendarEvent[]> {
    if (!this.tokenValid) {
      throw new CalendarServiceError(
        `Token expired for ${provider}`,
        'TOKEN_EXPIRED',
      );
    }
    return this.events.filter((e) => e.provider === provider);
  }

  async createReminder(
    _provider: CalendarProvider,
    _title: string,
    _date: Date,
  ): Promise<string> {
    if (!this.tokenValid) {
      throw new CalendarServiceError(
        'Token expired',
        'TOKEN_EXPIRED',
      );
    }
    const id = `reminder_${this.nextReminderId++}`;
    return id;
  }

  isTokenValid(_provider: CalendarProvider): boolean {
    return this.tokenValid;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Known video-conference host patterns for direct capture detection.
 */
const COMPATIBLE_HOST_PATTERNS = [
  'zoom.us',
  'zoom.com',
  'teams.microsoft.com',
  'meet.google.com',
];

/**
 * Determine capture mode from a meeting URL.
 * If the URL host matches a known platform → direct capture.
 * Otherwise → ambient.
 */
export function determineCaptureMode(meetingUrl?: string): CaptureMode {
  if (!meetingUrl) return 'ambient';
  const lower = meetingUrl.toLowerCase();
  return COMPATIBLE_HOST_PATTERNS.some((p) => lower.includes(p))
    ? 'direct'
    : 'ambient';
}

/**
 * Map a meeting URL to a RecordingConfig source.
 */
function meetingUrlToSource(
  meetingUrl?: string,
): RecordingConfig['source'] {
  if (!meetingUrl) return 'microphone';
  const lower = meetingUrl.toLowerCase();
  if (lower.includes('zoom.us') || lower.includes('zoom.com')) return 'zoom';
  if (lower.includes('teams.microsoft.com')) return 'teams';
  if (lower.includes('meet.google.com')) return 'google-meet';
  return 'microphone';
}

// ── CalendarService ─────────────────────────────────────────────

/** Default notification threshold in minutes. */
const DEFAULT_THRESHOLD_MINUTES = 5;

export class CalendarService {
  private backend: CalendarBackend;
  private connectedProviders = new Set<CalendarProvider>();
  private thresholdMinutes: number;

  constructor(
    backend?: CalendarBackend,
    thresholdMinutes?: number,
  ) {
    this.backend = backend ?? new StubCalendarBackend();
    this.thresholdMinutes = thresholdMinutes ?? DEFAULT_THRESHOLD_MINUTES;
  }

  // ── connect ─────────────────────────────────────────────────

  async connect(provider: CalendarProvider): Promise<void> {
    await this.backend.connect(provider);
    this.connectedProviders.add(provider);
  }

  // ── getUpcomingEvents ───────────────────────────────────────

  async getUpcomingEvents(
    userId: string,
    provider?: CalendarProvider,
  ): Promise<CalendarEvent[]> {
    const providers = provider
      ? [provider]
      : Array.from(this.connectedProviders);

    const results: CalendarEvent[] = [];
    for (const p of providers) {
      const events = await this.backend.fetchEvents(userId, p);
      results.push(...events);
    }
    // Sort by startTime ascending
    results.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );
    return results;
  }

  // ── checkAndNotify ──────────────────────────────────────────

  /**
   * Check upcoming events and return notifications for events
   * whose startTime is within the threshold.
   */
  checkAndNotify(
    events: CalendarEvent[],
    now: Date = new Date(),
  ): CalendarNotification[] {
    const notifications: CalendarNotification[] = [];
    const thresholdMs = this.thresholdMinutes * 60 * 1000;

    for (const event of events) {
      const diff = event.startTime.getTime() - now.getTime();
      if (diff >= 0 && diff <= thresholdMs) {
        notifications.push({
          eventId: event.id,
          eventTitle: event.title,
          startsIn: Math.round(diff / 60000),
          suggestedMode: determineCaptureMode(event.meetingUrl),
        });
      }
    }
    return notifications;
  }

  // ── startRecordingForEvent ──────────────────────────────────

  /**
   * Build a RecordingStartResult for a calendar event.
   * The caller is responsible for actually starting the audio capture
   * using the returned config.
   */
  startRecordingForEvent(event: CalendarEvent): RecordingStartResult {
    const mode = determineCaptureMode(event.meetingUrl);
    const source = meetingUrlToSource(event.meetingUrl);

    const config: RecordingConfig = {
      source,
      language: 'es', // default; caller may override
      calendarEventId: event.id,
    };

    return {
      sessionId: `cal_${event.id}_${Date.now()}`,
      calendarEventId: event.id,
      eventTitle: event.title,
      participants: event.participants,
      captureMode: mode,
      recordingConfig: config,
    };
  }

  // ── createReminder ──────────────────────────────────────────

  /**
   * Create a calendar reminder for an action item.
   * Returns the updated ActionItem with reminderCalendarId set.
   */
  async createReminder(
    actionItem: ActionItem,
    provider: CalendarProvider,
    reminderDate: Date,
  ): Promise<ActionItem> {
    const reminderId = await this.backend.createReminder(
      provider,
      actionItem.description,
      reminderDate,
    );
    return { ...actionItem, reminderCalendarId: reminderId };
  }

  // ── findEventById ───────────────────────────────────────────

  /**
   * Find a specific event by ID from the upcoming events.
   * Throws EVENT_NOT_FOUND if not present.
   */
  async findEventById(
    userId: string,
    eventId: string,
  ): Promise<CalendarEvent> {
    const allEvents = await this.getUpcomingEvents(userId);
    const event = allEvents.find((e) => e.id === eventId);
    if (!event) {
      throw new CalendarServiceError(
        `Calendar event ${eventId} not found`,
        'EVENT_NOT_FOUND',
      );
    }
    return event;
  }
}

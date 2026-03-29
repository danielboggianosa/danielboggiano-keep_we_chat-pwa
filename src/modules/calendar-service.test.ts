/**
 * Unit tests for CalendarService.
 *
 * Covers:
 * - Task 14.4: Token de calendario expirado (Req 11.1)
 * - Task 14.1: connect, getUpcomingEvents, checkAndNotify,
 *   startRecordingForEvent, createReminder, findEventById
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CalendarService,
  CalendarServiceError,
  StubCalendarBackend,
  determineCaptureMode,
} from './calendar-service';
import type { CalendarEvent } from '../types/calendar';
import type { ActionItem } from '../types/nlp';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt_1',
    title: 'Standup',
    startTime: new Date('2025-01-15T10:00:00Z'),
    endTime: new Date('2025-01-15T10:30:00Z'),
    participants: ['alice', 'bob'],
    provider: 'google-calendar',
    ...overrides,
  };
}

describe('CalendarService', () => {
  let backend: StubCalendarBackend;
  let service: CalendarService;

  beforeEach(() => {
    backend = new StubCalendarBackend();
    service = new CalendarService(backend, 5);
  });

  // ── Task 14.4: Token expired error (Req 11.1) ──────────────

  describe('expired token handling', () => {
    it('throws TOKEN_EXPIRED when connecting with expired token', async () => {
      backend.setTokenValid(false);
      await expect(service.connect('google-calendar')).rejects.toThrow(
        CalendarServiceError,
      );
      try {
        await service.connect('google-calendar');
      } catch (err) {
        expect((err as CalendarServiceError).code).toBe('TOKEN_EXPIRED');
      }
    });

    it('throws TOKEN_EXPIRED when fetching events with expired token', async () => {
      // Connect first with valid token
      await service.connect('google-calendar');
      // Then expire it
      backend.setTokenValid(false);
      await expect(
        service.getUpcomingEvents('user1', 'google-calendar'),
      ).rejects.toThrow(CalendarServiceError);
    });

    it('throws TOKEN_EXPIRED when creating reminder with expired token', async () => {
      backend.setTokenValid(false);
      const action: ActionItem = {
        id: 'a1',
        description: 'Follow up',
        assignedTo: 'speaker_1',
        assignedToLabel: 'Alice',
      };
      await expect(
        service.createReminder(action, 'google-calendar', new Date()),
      ).rejects.toThrow(CalendarServiceError);
    });
  });

  // ── connect ─────────────────────────────────────────────────

  describe('connect()', () => {
    it('connects to a calendar provider', async () => {
      await expect(service.connect('google-calendar')).resolves.toBeUndefined();
    });

    it('connects to multiple providers', async () => {
      await service.connect('google-calendar');
      await service.connect('teams-calendar');
      // Both should work — no error
    });
  });

  // ── getUpcomingEvents ───────────────────────────────────────

  describe('getUpcomingEvents()', () => {
    it('returns events sorted by startTime', async () => {
      const late = makeEvent({
        id: 'evt_late',
        startTime: new Date('2025-01-15T14:00:00Z'),
      });
      const early = makeEvent({
        id: 'evt_early',
        startTime: new Date('2025-01-15T09:00:00Z'),
      });
      backend.setEvents([late, early]);
      await service.connect('google-calendar');

      const events = await service.getUpcomingEvents('user1', 'google-calendar');
      expect(events[0].id).toBe('evt_early');
      expect(events[1].id).toBe('evt_late');
    });

    it('returns empty array when no events', async () => {
      backend.setEvents([]);
      await service.connect('google-calendar');
      const events = await service.getUpcomingEvents('user1', 'google-calendar');
      expect(events).toEqual([]);
    });
  });

  // ── checkAndNotify ──────────────────────────────────────────

  describe('checkAndNotify()', () => {
    it('generates notification for event within threshold', () => {
      const now = new Date('2025-01-15T09:57:00Z');
      const event = makeEvent({
        startTime: new Date('2025-01-15T10:00:00Z'),
      });
      const notifications = service.checkAndNotify([event], now);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].eventId).toBe('evt_1');
      expect(notifications[0].startsIn).toBe(3);
    });

    it('does not notify for events beyond threshold', () => {
      const now = new Date('2025-01-15T09:00:00Z');
      const event = makeEvent({
        startTime: new Date('2025-01-15T10:00:00Z'),
      });
      const notifications = service.checkAndNotify([event], now);
      expect(notifications).toHaveLength(0);
    });

    it('does not notify for past events', () => {
      const now = new Date('2025-01-15T11:00:00Z');
      const event = makeEvent({
        startTime: new Date('2025-01-15T10:00:00Z'),
      });
      const notifications = service.checkAndNotify([event], now);
      expect(notifications).toHaveLength(0);
    });

    it('suggests direct mode for Zoom meeting URL', () => {
      const now = new Date('2025-01-15T09:58:00Z');
      const event = makeEvent({
        startTime: new Date('2025-01-15T10:00:00Z'),
        meetingUrl: 'https://zoom.us/j/123456',
      });
      const [n] = service.checkAndNotify([event], now);
      expect(n.suggestedMode).toBe('direct');
    });

    it('suggests ambient mode when no meeting URL', () => {
      const now = new Date('2025-01-15T09:58:00Z');
      const event = makeEvent({
        startTime: new Date('2025-01-15T10:00:00Z'),
        meetingUrl: undefined,
      });
      const [n] = service.checkAndNotify([event], now);
      expect(n.suggestedMode).toBe('ambient');
    });
  });

  // ── startRecordingForEvent ──────────────────────────────────

  describe('startRecordingForEvent()', () => {
    it('returns direct mode for Teams meeting', () => {
      const event = makeEvent({
        meetingUrl: 'https://teams.microsoft.com/l/meetup/123',
      });
      const result = service.startRecordingForEvent(event);
      expect(result.captureMode).toBe('direct');
      expect(result.calendarEventId).toBe(event.id);
      expect(result.eventTitle).toBe(event.title);
      expect(result.participants).toEqual(event.participants);
      expect(result.recordingConfig.source).toBe('teams');
      expect(result.recordingConfig.calendarEventId).toBe(event.id);
    });

    it('returns ambient mode for event without URL', () => {
      const event = makeEvent({ meetingUrl: undefined });
      const result = service.startRecordingForEvent(event);
      expect(result.captureMode).toBe('ambient');
      expect(result.recordingConfig.source).toBe('microphone');
    });

    it('returns direct mode for Google Meet URL', () => {
      const event = makeEvent({
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      });
      const result = service.startRecordingForEvent(event);
      expect(result.captureMode).toBe('direct');
      expect(result.recordingConfig.source).toBe('google-meet');
    });
  });

  // ── createReminder ──────────────────────────────────────────

  describe('createReminder()', () => {
    it('returns action item with reminderCalendarId set', async () => {
      const action: ActionItem = {
        id: 'a1',
        description: 'Send report',
        assignedTo: 'speaker_1',
        assignedToLabel: 'Alice',
      };
      const updated = await service.createReminder(
        action,
        'google-calendar',
        new Date('2025-01-16T09:00:00Z'),
      );
      expect(updated.reminderCalendarId).toBeDefined();
      expect(updated.reminderCalendarId).toMatch(/^reminder_/);
      expect(updated.description).toBe(action.description);
    });
  });

  // ── findEventById ───────────────────────────────────────────

  describe('findEventById()', () => {
    it('returns the matching event', async () => {
      backend.setEvents([makeEvent({ id: 'evt_42' })]);
      await service.connect('google-calendar');
      const event = await service.findEventById('user1', 'evt_42');
      expect(event.id).toBe('evt_42');
    });

    it('throws EVENT_NOT_FOUND for missing event', async () => {
      backend.setEvents([]);
      await service.connect('google-calendar');
      await expect(
        service.findEventById('user1', 'nonexistent'),
      ).rejects.toThrow(CalendarServiceError);
      try {
        await service.findEventById('user1', 'nonexistent');
      } catch (err) {
        expect((err as CalendarServiceError).code).toBe('EVENT_NOT_FOUND');
      }
    });
  });

  // ── determineCaptureMode helper ─────────────────────────────

  describe('determineCaptureMode()', () => {
    it('returns direct for zoom URL', () => {
      expect(determineCaptureMode('https://zoom.us/j/123')).toBe('direct');
    });
    it('returns direct for teams URL', () => {
      expect(determineCaptureMode('https://teams.microsoft.com/l/123')).toBe('direct');
    });
    it('returns direct for meet URL', () => {
      expect(determineCaptureMode('https://meet.google.com/abc')).toBe('direct');
    });
    it('returns ambient for unknown URL', () => {
      expect(determineCaptureMode('https://example.com/meeting')).toBe('ambient');
    });
    it('returns ambient for undefined', () => {
      expect(determineCaptureMode(undefined)).toBe('ambient');
    });
  });
});

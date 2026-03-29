/**
 * Feature: meeting-transcription, Property 15: Asociación transcripción-evento de calendario
 *
 * **Validates: Requisito 11.4**
 *
 * Property: For every transcription created via auto-start from a
 * calendar event, the transcription must have a `calendarEventId`
 * referencing the original event, and the meeting title and invited
 * participants must be associated.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  CalendarService,
  StubCalendarBackend,
} from '../calendar-service';
import type { CalendarEvent, CalendarProvider } from '../../types/calendar';

// ── Arbitraries ─────────────────────────────────────────────────

const providerArb: fc.Arbitrary<CalendarProvider> = fc.constantFrom(
  'google-calendar',
  'teams-calendar',
  'other',
);

const meetingUrlArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant('https://zoom.us/j/123456'),
  fc.constant('https://teams.microsoft.com/l/meetup/abc'),
  fc.constant('https://meet.google.com/abc-defg-hij'),
  fc.constant('https://example.com/call'),
  fc.constant(undefined as string | undefined),
);

const calendarEventArb: fc.Arbitrary<CalendarEvent> = fc
  .record({
    id: fc.stringMatching(/^evt_[a-z0-9]{4,8}$/),
    title: fc.string({ minLength: 1, maxLength: 80 }),
    startOffset: fc.integer({ min: 0, max: 3600 }),
    durationMinutes: fc.integer({ min: 15, max: 180 }),
    participants: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      minLength: 1,
      maxLength: 8,
    }),
    meetingUrl: meetingUrlArb,
    provider: providerArb,
  })
  .map(({ id, title, startOffset, durationMinutes, participants, meetingUrl, provider }) => {
    const base = new Date('2025-06-01T08:00:00Z');
    const startTime = new Date(base.getTime() + startOffset * 1000);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    return { id, title, startTime, endTime, participants, meetingUrl, provider };
  });

// ── Property test ───────────────────────────────────────────────

describe('Property 15: Asociación transcripción-evento de calendario', () => {
  it('recording started from calendar event carries calendarEventId, title, and participants', () => {
    fc.assert(
      fc.property(calendarEventArb, (event) => {
        const backend = new StubCalendarBackend();
        const service = new CalendarService(backend);

        // Simulate starting a recording from this calendar event
        const result = service.startRecordingForEvent(event);

        // ── calendarEventId must reference the original event ──
        expect(result.calendarEventId).toBe(event.id);

        // ── The recording config must also carry the event id ──
        expect(result.recordingConfig.calendarEventId).toBe(event.id);

        // ── Event title must be associated ─────────────────────
        expect(result.eventTitle).toBe(event.title);

        // ── Participants must be associated ────────────────────
        expect(result.participants).toEqual(event.participants);
        expect(result.participants.length).toBe(event.participants.length);

        // ── Session ID must be non-empty ───────────────────────
        expect(result.sessionId.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

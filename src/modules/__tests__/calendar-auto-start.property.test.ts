/**
 * Feature: meeting-transcription, Property 14: Auto-inicio de grabación por calendario
 *
 * **Validates: Requirements 11.2, 11.3**
 *
 * Property: For every calendar event whose startTime is within the
 * notification threshold, the system must generate a notification.
 * If the user accepts, recording starts in "direct" mode when the
 * meeting has a compatible video-conference URL (zoom/teams/meet),
 * or in "ambient" mode otherwise.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  CalendarService,
  StubCalendarBackend,
  determineCaptureMode,
} from '../calendar-service';
import type { CalendarEvent, CalendarProvider } from '../../types/calendar';

// ── Arbitraries ─────────────────────────────────────────────────

const providerArb: fc.Arbitrary<CalendarProvider> = fc.constantFrom(
  'google-calendar',
  'teams-calendar',
  'other',
);

const compatibleUrlArb: fc.Arbitrary<string> = fc.constantFrom(
  'https://zoom.us/j/123456',
  'https://teams.microsoft.com/l/meetup/abc',
  'https://meet.google.com/abc-defg-hij',
);

const incompatibleUrlArb: fc.Arbitrary<string> = fc.constantFrom(
  'https://example.com/call',
  'https://webex.com/room/xyz',
  'https://custom-platform.io/call/99',
);

const meetingUrlArb: fc.Arbitrary<string | undefined> = fc.oneof(
  compatibleUrlArb,
  incompatibleUrlArb,
  fc.constant(undefined as string | undefined),
);

/**
 * Generate a calendar event with a startTime offset from `now` by
 * `offsetMinutes` minutes. Positive = future, negative = past.
 */
function eventArb(
  now: Date,
): fc.Arbitrary<{ event: CalendarEvent; offsetMinutes: number }> {
  return fc
    .record({
      id: fc.stringMatching(/^evt_[a-z0-9]{4,8}$/),
      title: fc.string({ minLength: 1, maxLength: 50 }),
      offsetMinutes: fc.integer({ min: -10, max: 30 }),
      durationMinutes: fc.integer({ min: 15, max: 120 }),
      participants: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
        minLength: 0,
        maxLength: 5,
      }),
      meetingUrl: meetingUrlArb,
      provider: providerArb,
    })
    .map(({ id, title, offsetMinutes, durationMinutes, participants, meetingUrl, provider }) => {
      const startTime = new Date(now.getTime() + offsetMinutes * 60_000);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
      return {
        event: { id, title, startTime, endTime, participants, meetingUrl, provider },
        offsetMinutes,
      };
    });
}

// ── Property test ───────────────────────────────────────────────

describe('Property 14: Auto-inicio de grabación por calendario', () => {
  const THRESHOLD = 5; // minutes
  const NOW = new Date('2025-06-01T12:00:00Z');

  it('generates notification iff event is within threshold, and starts recording in correct mode', () => {
    fc.assert(
      fc.property(
        fc.array(eventArb(NOW), { minLength: 1, maxLength: 10 }),
        (entries) => {
          const backend = new StubCalendarBackend();
          const service = new CalendarService(backend, THRESHOLD);

          const events = entries.map((e) => e.event);
          const notifications = service.checkAndNotify(events, NOW);

          // ── Verify notification generation ──────────────────
          for (const { event, offsetMinutes } of entries) {
            const withinThreshold =
              offsetMinutes >= 0 && offsetMinutes <= THRESHOLD;
            const hasNotification = notifications.some(
              (n) => n.eventId === event.id,
            );

            if (withinThreshold) {
              expect(hasNotification).toBe(true);
            } else {
              expect(hasNotification).toBe(false);
            }
          }

          // ── Verify capture mode for notified events ─────────
          for (const notification of notifications) {
            const event = events.find((e) => e.id === notification.eventId)!;
            const expectedMode = determineCaptureMode(event.meetingUrl);
            expect(notification.suggestedMode).toBe(expectedMode);

            // Simulate user accepting auto-start
            const result = service.startRecordingForEvent(event);
            expect(result.captureMode).toBe(expectedMode);
            expect(result.calendarEventId).toBe(event.id);
            expect(result.eventTitle).toBe(event.title);
            expect(result.participants).toEqual(event.participants);

            // Verify recording config has calendarEventId
            expect(result.recordingConfig.calendarEventId).toBe(event.id);

            // Verify source mapping
            if (expectedMode === 'direct') {
              expect(result.recordingConfig.source).not.toBe('microphone');
            } else {
              expect(result.recordingConfig.source).toBe('microphone');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

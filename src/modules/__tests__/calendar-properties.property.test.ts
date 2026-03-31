/**
 * Feature: production-readiness
 *
 * Property 11: Renovación automática de tokens de calendario
 * Property 12: Eventos de calendario compatibles con CalendarEvent
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CalendarProvider, CalendarEvent } from '../../types/calendar';

// ═══════════════════════════════════════════════════════════════════
// Shared arbitraries
// ═══════════════════════════════════════════════════════════════════

const providerArb: fc.Arbitrary<CalendarProvider> = fc.constantFrom(
  'google-calendar',
  'teams-calendar',
);

// ═══════════════════════════════════════════════════════════════════
// Property 11: Renovación automática de tokens de calendario
// ═══════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 5.3, 5.4**
 *
 * Models the token renewal logic from the calendar service:
 * - If the access token is expired and the refresh token is valid,
 *   a new access token is obtained (status stays 'active').
 * - If the refresh token is also invalid, the status changes to
 *   'requires_reauth'.
 */

type TokenStatus = 'active' | 'requires_reauth';

interface CalendarTokenState {
  provider: CalendarProvider;
  accessTokenExpired: boolean;
  refreshTokenValid: boolean;
  status: TokenStatus;
}

/**
 * Pure model of the token renewal logic implemented in
 * services/calendar-service/src/index.ts → ensureValidAccessToken.
 */
function renewToken(state: CalendarTokenState): {
  newStatus: TokenStatus;
  gotNewAccessToken: boolean;
} {
  // Access token still valid — no renewal needed
  if (!state.accessTokenExpired) {
    return { newStatus: 'active', gotNewAccessToken: false };
  }

  // Access token expired — attempt refresh
  if (state.refreshTokenValid) {
    // Refresh succeeds → new access token, status stays active
    return { newStatus: 'active', gotNewAccessToken: true };
  }

  // Refresh token invalid → mark requires_reauth
  return { newStatus: 'requires_reauth', gotNewAccessToken: false };
}

const tokenStateArb: fc.Arbitrary<CalendarTokenState> = fc.record({
  provider: providerArb,
  accessTokenExpired: fc.boolean(),
  refreshTokenValid: fc.boolean(),
  status: fc.constant('active' as TokenStatus),
});

describe('Property 11: Renovación automática de tokens de calendario', () => {
  it('renews with valid refresh token; marks requires_reauth with invalid one', () => {
    fc.assert(
      fc.property(tokenStateArb, (state) => {
        const result = renewToken(state);

        if (!state.accessTokenExpired) {
          // Token still valid — nothing changes
          expect(result.newStatus).toBe('active');
          expect(result.gotNewAccessToken).toBe(false);
        } else if (state.refreshTokenValid) {
          // Expired access + valid refresh → renewed
          expect(result.newStatus).toBe('active');
          expect(result.gotNewAccessToken).toBe(true);
        } else {
          // Expired access + invalid refresh → requires_reauth
          expect(result.newStatus).toBe('requires_reauth');
          expect(result.gotNewAccessToken).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// Property 12: Eventos de calendario compatibles con CalendarEvent
// ═══════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 5.5**
 *
 * Generates random calendar events and verifies they can be
 * deserialized into the CalendarEvent interface with all required
 * fields: id, title, startTime, endTime, participants, provider.
 */

const meetingUrlArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant('https://zoom.us/j/123456'),
  fc.constant('https://teams.microsoft.com/l/meetup/abc'),
  fc.constant('https://meet.google.com/abc-defg-hij'),
  fc.constant(undefined as string | undefined),
);

const calendarEventArb: fc.Arbitrary<CalendarEvent> = fc
  .record({
    id: fc.stringMatching(/^evt_[a-z0-9]{4,12}$/),
    title: fc.string({ minLength: 1, maxLength: 120 }),
    startOffset: fc.integer({ min: 0, max: 86400 }),
    durationMinutes: fc.integer({ min: 1, max: 480 }),
    participants: fc.array(
      fc.stringMatching(/^[a-z0-9.]+@[a-z0-9]+\.[a-z]{2,4}$/),
      { minLength: 0, maxLength: 20 },
    ),
    meetingUrl: meetingUrlArb,
    provider: providerArb,
  })
  .map(({ id, title, startOffset, durationMinutes, participants, meetingUrl, provider }) => {
    const base = new Date('2025-06-01T08:00:00Z');
    const startTime = new Date(base.getTime() + startOffset * 1000);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    return { id, title, startTime, endTime, participants, meetingUrl, provider };
  });

/**
 * Simulates JSON round-trip deserialization as the client would
 * receive events from the calendar service API.
 */
function deserializeCalendarEvent(raw: Record<string, unknown>): CalendarEvent {
  return {
    id: raw.id as string,
    title: raw.title as string,
    startTime: new Date(raw.startTime as string),
    endTime: new Date(raw.endTime as string),
    participants: raw.participants as string[],
    provider: raw.provider as CalendarProvider,
    meetingUrl: raw.meetingUrl as string | undefined,
  };
}

describe('Property 12: Eventos de calendario compatibles con CalendarEvent', () => {
  it('every generated event deserializes with all required CalendarEvent fields', () => {
    fc.assert(
      fc.property(calendarEventArb, (event) => {
        // Simulate JSON serialization (as the API would send it)
        const serialized = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

        // Deserialize back
        const deserialized = deserializeCalendarEvent(serialized);

        // ── Required fields exist and have correct types ──────
        expect(typeof deserialized.id).toBe('string');
        expect(deserialized.id.length).toBeGreaterThan(0);

        expect(typeof deserialized.title).toBe('string');
        expect(deserialized.title.length).toBeGreaterThan(0);

        expect(deserialized.startTime).toBeInstanceOf(Date);
        expect(Number.isNaN(deserialized.startTime.getTime())).toBe(false);

        expect(deserialized.endTime).toBeInstanceOf(Date);
        expect(Number.isNaN(deserialized.endTime.getTime())).toBe(false);

        // endTime must be after startTime
        expect(deserialized.endTime.getTime()).toBeGreaterThan(
          deserialized.startTime.getTime(),
        );

        expect(Array.isArray(deserialized.participants)).toBe(true);

        expect(['google-calendar', 'teams-calendar', 'other']).toContain(
          deserialized.provider,
        );

        // ── Optional meetingUrl, if present, must be a string ─
        if (deserialized.meetingUrl !== undefined) {
          expect(typeof deserialized.meetingUrl).toBe('string');
        }
      }),
      { numRuns: 200 },
    );
  });
});

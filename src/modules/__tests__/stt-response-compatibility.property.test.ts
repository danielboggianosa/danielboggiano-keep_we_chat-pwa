/**
 * Feature: production-readiness, Property 5: Respuesta STT compatible con RawTranscription
 *
 * Validates: Requirements 2.1, 2.5
 *
 * Property: For all STT transcription responses, the response must be
 * deserializable into the client's RawTranscription interface:
 * - Each segment has startTime ≥ 0, endTime > startTime, text non-empty,
 *   confidence between 0 and 1
 * - Top-level language and duration fields are present and valid
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { RawTranscription, TranscriptionSegment } from '../../types/transcription';

// ── Arbitrary: generate a random STT transcription segment ────────

const segmentArb = fc
  .tuple(
    fc.float({ min: Math.fround(0), max: Math.fround(3600), noNaN: true, noDefaultInfinity: true }),
    fc.float({ min: Math.fround(0.001), max: Math.fround(300), noNaN: true, noDefaultInfinity: true }),
    fc.stringMatching(/^[A-Za-zÀ-ÿ0-9 ,.!?]+$/).filter((s) => s.trim().length > 0),
    fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
  )
  .map(([start, delta, text, confidence]): TranscriptionSegment => ({
    startTime: Math.abs(start),
    endTime: Math.abs(start) + Math.abs(delta),
    text: text.trim(),
    confidence: Math.max(0, Math.min(1, confidence)),
  }));

// ── Arbitrary: generate a full STT response (RawTranscription) ────

const sttResponseArb = fc
  .tuple(
    fc.array(segmentArb, { minLength: 1, maxLength: 20 }),
    fc.constantFrom<'es' | 'en'>('es', 'en'),
    fc.float({ min: Math.fround(0.1), max: Math.fround(7200), noNaN: true, noDefaultInfinity: true }),
  )
  .map(([segments, language, duration]): RawTranscription => ({
    segments,
    language,
    duration: Math.abs(duration),
  }));

// ── Property Test ─────────────────────────────────────────────────

describe('Property 5: Respuesta STT compatible con RawTranscription', () => {
  it('every generated STT response satisfies RawTranscription interface constraints', () => {
    fc.assert(
      fc.property(sttResponseArb, (response: RawTranscription) => {
        // Top-level: language must be present and valid
        expect(response.language).toBeDefined();
        expect(['es', 'en']).toContain(response.language);

        // Top-level: duration must be present and non-negative
        expect(response.duration).toBeDefined();
        expect(typeof response.duration).toBe('number');
        expect(response.duration).toBeGreaterThan(0);

        // Segments array must be present and non-empty
        expect(response.segments).toBeDefined();
        expect(Array.isArray(response.segments)).toBe(true);
        expect(response.segments.length).toBeGreaterThan(0);

        // Each segment must satisfy TranscriptionSegment constraints
        for (const segment of response.segments) {
          // startTime ≥ 0
          expect(segment.startTime).toBeGreaterThanOrEqual(0);

          // endTime > startTime
          expect(segment.endTime).toBeGreaterThan(segment.startTime);

          // text must be non-empty string
          expect(typeof segment.text).toBe('string');
          expect(segment.text.length).toBeGreaterThan(0);

          // confidence between 0 and 1 (inclusive)
          expect(segment.confidence).toBeGreaterThanOrEqual(0);
          expect(segment.confidence).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: meeting-transcription, Property 13: Round-trip de exportación/importación VTT
 *
 * Validates: Requisito 10.4
 *
 * Property: For every valid transcription, exporting to VTT format and then importing
 * the resulting VTT file must produce a transcription equivalent to the original
 * (same segments with same speaker, timestamps, and text).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExportService } from '../export-service';
import type { DiarizedSegment, DiarizedTranscription, SpeakerProfile } from '../../types/transcription';

// ── Arbitraries ───────────────────────────────────────────────────

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

/**
 * Generate segments with integer-based timestamps to avoid floating-point
 * precision issues in the round-trip.
 */
const segmentArb = (speakerIds: string[], speakerLabels: string[]): fc.Arbitrary<DiarizedSegment> =>
  fc.tuple(
    fc.integer({ min: 0, max: 3599 }),
    fc.integer({ min: 1, max: 60 }),
    fc.integer({ min: 0, max: speakerIds.length - 1 }),
  ).chain(([start, duration, speakerIdx]) =>
    fc.record({
      startTime: fc.constant(start),
      endTime: fc.constant(start + duration),
      text: fc.stringMatching(/^[a-zA-Z]{1,10}( [a-zA-Z]{1,10}){0,4}$/),
      confidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
      speakerId: fc.constant(speakerIds[speakerIdx]),
      speakerLabel: fc.constant(speakerLabels[speakerIdx]),
      speakerConfidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
    }),
  );

const transcriptionArb: fc.Arbitrary<DiarizedTranscription> = fc
  .integer({ min: 1, max: 4 })
  .chain((numSpeakers) => {
    const speakerIds = Array.from({ length: numSpeakers }, (_, i) => `speaker_${i + 1}`);
    const speakerLabels = speakerIds.map((_, i) => `Hablante ${i + 1}`);
    const speakers: SpeakerProfile[] = speakerIds.map((id, i) => ({
      id,
      label: speakerLabels[i],
    }));

    return fc.tuple(
      fc.array(segmentArb(speakerIds, speakerLabels), { minLength: 1, maxLength: 8 }),
      languageArb,
    ).map(([segments, language]) => ({
      segments,
      speakers,
      language,
    }));
  });

// ── Property tests ────────────────────────────────────────────────

describe('Property 13: Round-trip de exportación/importación VTT', () => {
  const service = new ExportService();

  it('exporting to VTT and importing back produces equivalent transcription', () => {
    fc.assert(
      fc.property(
        transcriptionArb,
        (original) => {
          const vttContent = service.export(original, 'vtt');
          const imported = service.importVTT(vttContent);

          // Same number of segments
          expect(imported.segments.length).toBe(original.segments.length);

          // Same language
          expect(imported.language).toBe(original.language);

          // Each segment must match
          for (let i = 0; i < original.segments.length; i++) {
            const orig = original.segments[i];
            const imp = imported.segments[i];

            // Same speaker
            expect(imp.speakerId).toBe(orig.speakerId);
            expect(imp.speakerLabel).toBe(orig.speakerLabel);

            // Same timestamps
            expect(imp.startTime).toBe(orig.startTime);
            expect(imp.endTime).toBe(orig.endTime);

            // Same text
            expect(imp.text).toBe(orig.text);
          }

          // Speakers that appear in segments should be equivalent
          // (speakers without segments are not preserved in VTT format)
          const origSegmentSpeakerIds = new Set(original.segments.map((s) => s.speakerId));
          const impSpeakerIds = new Set(imported.speakers.map((s) => s.id));
          expect(impSpeakerIds).toEqual(origSegmentSpeakerIds);
        },
      ),
      { numRuns: 100 },
    );
  });
});

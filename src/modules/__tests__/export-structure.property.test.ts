/**
 * Feature: meeting-transcription, Property 12: Preservación de estructura en exportación
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 *
 * Property: For every transcription exported in any format (VTT, TXT, Markdown),
 * the resulting file must contain the speaker labels, timestamps, and text of each
 * segment, preserving the structure of the original transcription.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExportService } from '../export-service';
import type { DiarizedSegment, DiarizedTranscription, SpeakerProfile } from '../../types/transcription';
import type { ExportFormat } from '../../types/export';

// ── Arbitraries ───────────────────────────────────────────────────

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

const speakerIdArb = (max: number) =>
  fc.integer({ min: 1, max }).map((n) => `speaker_${n}`);

const segmentArb = (speakerIds: string[]): fc.Arbitrary<DiarizedSegment> =>
  fc.tuple(
    fc.integer({ min: 0, max: 3599 }),
    fc.integer({ min: 1, max: 60 }),
  ).chain(([start, duration]) =>
    fc.record({
      startTime: fc.constant(start),
      endTime: fc.constant(start + duration),
      text: fc.stringMatching(/^[a-zA-Z]{1,10}( [a-zA-Z]{1,10}){0,4}$/),
      confidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
      speakerId: fc.constantFrom(...speakerIds),
      speakerLabel: fc.constantFrom(...speakerIds.map((_, i) => `Hablante ${i + 1}`)),
      speakerConfidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
    }),
  );

const transcriptionArb: fc.Arbitrary<DiarizedTranscription> = fc
  .integer({ min: 1, max: 4 })
  .chain((numSpeakers) => {
    const speakerIds = Array.from({ length: numSpeakers }, (_, i) => `speaker_${i + 1}`);
    const speakers: SpeakerProfile[] = speakerIds.map((id, i) => ({
      id,
      label: `Hablante ${i + 1}`,
    }));

    return fc.tuple(
      fc.array(segmentArb(speakerIds), { minLength: 1, maxLength: 8 }),
      languageArb,
    ).map(([segments, language]) => ({
      segments,
      speakers,
      language,
    }));
  });

const formatArb = fc.constantFrom<ExportFormat>('vtt', 'txt', 'md');

// ── Property tests ────────────────────────────────────────────────

describe('Property 12: Preservación de estructura en exportación', () => {
  const service = new ExportService();

  it('exported file contains speaker labels, timestamps, and text of each segment for every format', () => {
    fc.assert(
      fc.property(
        transcriptionArb,
        formatArb,
        (transcription, format) => {
          const output = service.export(transcription, format);

          for (const seg of transcription.segments) {
            // Text must be present
            expect(output).toContain(seg.text);

            // Speaker label must be present
            expect(output).toContain(seg.speakerLabel);

            // Timestamps must be present in some form
            // For VTT: HH:MM:SS.mmm, for TXT/MD: HH:MM:SS
            const h = Math.floor(seg.startTime / 3600);
            const m = Math.floor((seg.startTime % 3600) / 60);
            const s = Math.floor(seg.startTime % 60);
            const timestampHHMMSS =
              String(h).padStart(2, '0') +
              ':' +
              String(m).padStart(2, '0') +
              ':' +
              String(s).padStart(2, '0');

            expect(output).toContain(timestampHHMMSS);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

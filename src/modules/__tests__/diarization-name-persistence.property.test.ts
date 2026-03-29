/**
 * Feature: meeting-transcription, Property 4: Persistencia de nombre de hablante identificado
 *
 * Validates: Requirements 3.2
 *
 * Property: For every speaker who verbally identifies themselves by name in a segment,
 * all subsequent segments of that same speakerId must use the identified name as speakerLabel.
 * The speaker's profile must also have the identifiedName set.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  DiarizationEngine,
  type DiarizationBackend,
} from '../diarization-engine';
import type { AudioFile } from '../../types/audio';
import type { TranscriptionSegment } from '../../types/transcription';

// ── Custom backend: all segments → same speaker, high confidence ──

class SingleSpeakerBackend implements DiarizationBackend {
  constructor(private speakerId: string, private confidence: number) {}

  async assignSpeakers(
    _audio: AudioFile,
    segments: TranscriptionSegment[],
  ): Promise<Array<{ speakerId: string; confidence: number }>> {
    return segments.map(() => ({
      speakerId: this.speakerId,
      confidence: this.confidence,
    }));
  }
}

// ── Arbitraries ───────────────────────────────────────────────────

const audioFileArb: fc.Arbitrary<AudioFile> = fc.record({
  id: fc.uuid(),
  blob: fc.constant(new Blob(['audio'], { type: 'audio/webm' })),
  duration: fc.integer({ min: 1, max: 7200 }),
  recordedAt: fc.date(),
  source: fc.constantFrom(
    'microphone' as const,
    'zoom' as const,
    'teams' as const,
    'google-meet' as const,
  ),
  language: fc.constantFrom('es' as const, 'en' as const),
  syncStatus: fc.constantFrom('pending' as const, 'synced' as const),
});

/**
 * Generate a name: uppercase letter followed by 2-10 lowercase letters.
 * Matches the capture groups in the engine's NAME_PATTERNS.
 */
const nameArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(
      'A','B','C','D','E','F','G','H','I','J','K','L','M',
      'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    ),
    fc.stringOf(
      fc.constantFrom(
        'a','b','c','d','e','f','g','h','i','j','k','l','m',
        'n','o','p','q','r','s','t','u','v','w','x','y','z',
      ),
      { minLength: 2, maxLength: 10 },
    ),
  )
  .map(([first, rest]) => first + rest);

/**
 * Generate a verbal identification phrase containing the given name.
 */
function identificationTextArb(name: string): fc.Arbitrary<string> {
  return fc.constantFrom(
    `Hola, soy ${name}`,
    `Buenos días, soy ${name}`,
    `Mi nombre es ${name}`,
    `Me llamo ${name}`,
  );
}

/**
 * Plain text that does NOT match any verbal name identification pattern.
 */
const plainTextArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      'de acuerdo',
      'entendido',
      'perfecto',
      'vamos a ver',
      'siguiente punto',
      'ok',
      'bien',
      'claro',
      'exacto',
      'correcto',
    ),
    { minLength: 1, maxLength: 3 },
  )
  .map((words) => words.join(' '));

/**
 * Build a TranscriptionSegment with the given text.
 */
function makeSegment(text: string, index: number): TranscriptionSegment {
  return {
    startTime: index * 5,
    endTime: index * 5 + 4,
    text,
    confidence: 0.9,
  };
}

/**
 * Generate a complete scenario: audio, a name, a list of segments where
 * exactly one segment (at a random index) contains a verbal identification,
 * and all others contain plain text.
 */
const scenarioArb = fc
  .integer({ min: 2, max: 25 })
  .chain((segmentCount) =>
    fc.tuple(
      audioFileArb,
      nameArb,
      fc.integer({ min: 0, max: segmentCount - 1 }),
      // Generate plain texts for all non-identification segments
      fc.array(plainTextArb, {
        minLength: segmentCount,
        maxLength: segmentCount,
      }),
      fc.constant(segmentCount),
    ),
  )
  .chain(([audio, name, idIndex, plainTexts, segmentCount]) =>
    identificationTextArb(name).map((idText) => ({
      audio,
      name,
      idIndex,
      segmentCount,
      segments: Array.from({ length: segmentCount }, (_, i) =>
        makeSegment(i === idIndex ? idText : plainTexts[i], i),
      ),
    })),
  );

// ── Property test ─────────────────────────────────────────────────

describe('Property 4: Persistencia de nombre de hablante identificado', () => {
  it('all segments after verbal identification use the identified name as speakerLabel', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ audio, name, idIndex, segments }) => {
        const speakerId = 'speaker_1';
        const backend = new SingleSpeakerBackend(speakerId, 0.95);
        const engine = new DiarizationEngine(backend);

        const result = await engine.diarize(audio, segments);

        // The identification segment itself should use the identified name
        expect(
          result.segments[idIndex].speakerLabel,
          `Identification segment at index ${idIndex} should use name "${name}"`,
        ).toBe(name);

        // All segments AFTER the identification index must use the identified name
        for (let i = idIndex + 1; i < result.segments.length; i++) {
          expect(
            result.segments[i].speakerLabel,
            `Segment ${i} (after identification at ${idIndex}) should use "${name}"`,
          ).toBe(name);
        }

        // The speaker profile must have identifiedName set
        const profile = result.speakers.find((s) => s.id === speakerId);
        expect(profile).toBeDefined();
        expect(profile!.identifiedName).toBe(name);
        expect(profile!.label).toBe(name);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: meeting-transcription, Property 3: Consistencia de identificación de hablantes
 *
 * Validates: Requirements 3.1, 3.3, 3.4
 *
 * Property: For every diarized transcription, each speakerId maps to exactly one
 * speakerLabel throughout the entire transcription, and every segment with speaker
 * confidence below the LOW_CONFIDENCE_THRESHOLD has speakerId = "speaker_unknown"
 * and speakerLabel = "Hablante no identificado".
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  DiarizationEngine,
  LOW_CONFIDENCE_THRESHOLD,
  UNKNOWN_SPEAKER_ID,
  UNKNOWN_SPEAKER_LABEL,
  type DiarizationBackend,
} from '../diarization-engine';
import type { AudioFile } from '../../types/audio';
import type { TranscriptionSegment } from '../../types/transcription';

// ── Custom backend that uses pre-generated speaker assignments ────

interface GeneratedAssignment {
  speakerId: string;
  confidence: number;
}

/**
 * A DiarizationBackend that returns pre-generated speaker assignments.
 * This lets fast-check control the speaker IDs and confidence values,
 * ensuring the property test exercises the engine's labeling logic
 * with truly random inputs.
 */
class GeneratedDataBackend implements DiarizationBackend {
  constructor(private assignments: GeneratedAssignment[]) {}

  async assignSpeakers(
    _audio: AudioFile,
    _segments: TranscriptionSegment[],
  ): Promise<GeneratedAssignment[]> {
    return this.assignments;
  }
}

// ── Arbitraries ───────────────────────────────────────────────────

const audioFileArb: fc.Arbitrary<AudioFile> = fc.record({
  id: fc.uuid(),
  blob: fc.constant(new Blob(['audio'], { type: 'audio/webm' })),
  duration: fc.integer({ min: 1, max: 7200 }),
  recordedAt: fc.date(),
  source: fc.constantFrom('microphone' as const, 'zoom' as const, 'teams' as const, 'google-meet' as const),
  language: fc.constantFrom('es' as const, 'en' as const),
  syncStatus: fc.constantFrom('pending' as const, 'synced' as const),
});

/**
 * Generate a segment with plain text (no verbal name patterns)
 * to isolate the speaker consistency property from name detection.
 */
const segmentArb: fc.Arbitrary<TranscriptionSegment> = fc.record({
  startTime: fc.float({ min: 0, max: 3600, noNaN: true }),
  endTime: fc.float({ min: 0, max: 3600, noNaN: true }),
  text: fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', ' ', '.', ','), { minLength: 1, maxLength: 50 }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
});

/**
 * Generate a speaker assignment with a speaker ID from a pool of N speakers
 * and a confidence value between 0 and 1.
 */
function assignmentArb(speakerCount: number): fc.Arbitrary<GeneratedAssignment> {
  return fc.record({
    speakerId: fc.integer({ min: 1, max: speakerCount }).map(n => `speaker_${n}`),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  });
}

/**
 * Generate a complete test scenario: audio file, segments, and
 * parallel speaker assignments for a random number of speakers.
 */
const scenarioArb = fc.integer({ min: 1, max: 10 }).chain(speakerCount =>
  fc.integer({ min: 1, max: 30 }).chain(segmentCount =>
    fc.record({
      audio: audioFileArb,
      segments: fc.array(segmentArb, { minLength: segmentCount, maxLength: segmentCount }),
      assignments: fc.array(assignmentArb(speakerCount), { minLength: segmentCount, maxLength: segmentCount }),
    }),
  ),
);

// ── Property test ─────────────────────────────────────────────────

describe('Property 3: Consistencia de identificación de hablantes', () => {
  it('each speakerId maps to exactly one speakerLabel, and low-confidence segments use unknown speaker', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ audio, segments, assignments }) => {
        const backend = new GeneratedDataBackend(assignments);
        const engine = new DiarizationEngine(backend);

        const result = await engine.diarize(audio, segments);

        // Build a map of speakerId → Set<speakerLabel> across all segments
        const speakerLabelMap = new Map<string, Set<string>>();

        for (let i = 0; i < result.segments.length; i++) {
          const seg = result.segments[i];
          const originalConfidence = assignments[i].confidence;

          // Requirement 3.4: Low confidence segments must be marked as unknown
          if (originalConfidence < LOW_CONFIDENCE_THRESHOLD) {
            expect(seg.speakerId).toBe(UNKNOWN_SPEAKER_ID);
            expect(seg.speakerLabel).toBe(UNKNOWN_SPEAKER_LABEL);
          }

          // Track all labels seen for each speakerId
          if (!speakerLabelMap.has(seg.speakerId)) {
            speakerLabelMap.set(seg.speakerId, new Set());
          }
          speakerLabelMap.get(seg.speakerId)!.add(seg.speakerLabel);
        }

        // Requirement 3.1, 3.3: Each speakerId maps to exactly one speakerLabel
        for (const [speakerId, labels] of speakerLabelMap) {
          expect(
            labels.size,
            `speakerId "${speakerId}" mapped to ${labels.size} labels: ${[...labels].join(', ')}`,
          ).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });
});

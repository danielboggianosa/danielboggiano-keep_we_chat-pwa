/**
 * Feature: meeting-transcription, Property 5: Generación de resumen y accionables post-transcripción
 *
 * Validates: Requirements 5.1, 5.2
 *
 * Property: For every complete transcription, the system must generate a
 * MeetingSummary with at least one topic and an ActionItem[] (which may be empty).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { NLPService, resetActionIdCounter } from '../nlp-service';
import type { DiarizedTranscription, DiarizedSegment, SpeakerProfile } from '../../types/transcription';

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

const speakerArb: fc.Arbitrary<SpeakerProfile> = fc
  .integer({ min: 1, max: 9 })
  .map((n) => ({
    id: `speaker_${n}`,
    label: `Hablante ${n}`,
  }));

function segmentArb(speakerIds: string[]): fc.Arbitrary<DiarizedSegment> {
  return fc.record({
    startTime: fc.integer({ min: 0, max: 3600 }),
    endTime: fc.integer({ min: 1, max: 7200 }),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    confidence: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
    speakerId: fc.constantFrom(...speakerIds),
    speakerLabel: fc.string({ minLength: 1, maxLength: 20 }),
    speakerConfidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
  });
}

const transcriptionArb: fc.Arbitrary<DiarizedTranscription> = fc
  .array(speakerArb, { minLength: 1, maxLength: 5 })
  .chain((speakers) => {
    const ids = speakers.map((s) => s.id);
    return fc
      .array(segmentArb(ids), { minLength: 1, maxLength: 15 })
      .chain((segments) =>
        languageArb.map((language) => ({ segments, speakers, language })),
      );
  });

describe('Property 5: Generación de resumen y accionables post-transcripción', () => {
  beforeEach(() => resetActionIdCounter());

  it('generates MeetingSummary with at least one topic and ActionItem[] for every transcription', async () => {
    await fc.assert(
      fc.asyncProperty(transcriptionArb, async (transcription) => {
        resetActionIdCounter();
        const service = new NLPService();

        const summary = await service.generateSummary(transcription);
        const actions = await service.extractActionItems(transcription);

        // Must have at least one topic
        expect(summary.topics.length).toBeGreaterThanOrEqual(1);
        // Language must match
        expect(summary.language).toBe(transcription.language);
        // Actions is an array (may be empty)
        expect(Array.isArray(actions)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

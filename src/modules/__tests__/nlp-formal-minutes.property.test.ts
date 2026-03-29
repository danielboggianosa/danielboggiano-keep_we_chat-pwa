/**
 * Feature: meeting-transcription, Property 7: Completitud y coherencia de actas formales
 *
 * Validates: Requirements 6.1, 6.2
 *
 * Property: For every formal minutes generated, the document must contain the
 * four required sections (attendees, topics, decisions, action items), attendees
 * must correspond to transcription speakers, and language must match.
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

describe('Property 7: Completitud y coherencia de actas formales', () => {
  beforeEach(() => resetActionIdCounter());

  it('formal minutes contain 4 required sections, attendees match speakers, and language matches', async () => {
    await fc.assert(
      fc.asyncProperty(transcriptionArb, async (transcription) => {
        resetActionIdCounter();
        const service = new NLPService();

        const summary = await service.generateSummary(transcription);
        const actions = await service.extractActionItems(transcription);
        const minutes = await service.generateMinutes(transcription, summary, actions);

        // Section 1: attendees exist and correspond to speakers
        expect(Array.isArray(minutes.attendees)).toBe(true);
        expect(minutes.attendees).toEqual(transcription.speakers);

        // Section 2: topics discussed
        expect(Array.isArray(minutes.topicsDiscussed)).toBe(true);
        expect(minutes.topicsDiscussed.length).toBeGreaterThanOrEqual(1);

        // Section 3: decisions (may be empty)
        expect(Array.isArray(minutes.decisions)).toBe(true);

        // Section 4: action items
        expect(Array.isArray(minutes.actionItems)).toBe(true);

        // Language must match transcription
        expect(minutes.language).toBe(transcription.language);

        // Title and date must exist
        expect(minutes.title.length).toBeGreaterThan(0);
        expect(minutes.date).toBeInstanceOf(Date);
      }),
      { numRuns: 100 },
    );
  });
});

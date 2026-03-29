/**
 * Feature: meeting-transcription, Property 6: Asignación de accionables a hablantes
 *
 * Validates: Requirements 5.3, 5.5
 *
 * Property: For every action item extracted, assignedTo must reference a valid
 * speakerId from the transcription, or be "unassigned" with assignedToLabel "Sin asignar".
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  NLPService,
  UNASSIGNED_SPEAKER_ID,
  UNASSIGNED_SPEAKER_LABEL,
  resetActionIdCounter,
} from '../nlp-service';
import type { DiarizedTranscription, DiarizedSegment, SpeakerProfile } from '../../types/transcription';

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

const speakerArb: fc.Arbitrary<SpeakerProfile> = fc
  .integer({ min: 1, max: 9 })
  .map((n) => ({
    id: `speaker_${n}`,
    label: `Hablante ${n}`,
  }));

// Include some action-triggering text patterns to ensure we get action items
const actionTextsEs = [
  'Necesitamos revisar el documento',
  'Hay que preparar la presentación',
  'Debemos actualizar el sistema',
  'Me comprometo a enviar el reporte',
];
const actionTextsEn = [
  'We need to review the document',
  'We should prepare the presentation',
  "I'll send the report tomorrow",
  "Let's schedule a follow-up",
];

function segmentWithActionsArb(speakerIds: string[], language: 'es' | 'en'): fc.Arbitrary<DiarizedSegment> {
  const texts = language === 'es' ? actionTextsEs : actionTextsEn;
  return fc.record({
    startTime: fc.integer({ min: 0, max: 3600 }),
    endTime: fc.integer({ min: 1, max: 7200 }),
    text: fc.constantFrom(...texts),
    confidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
    speakerId: fc.constantFrom(...speakerIds),
    speakerLabel: fc.string({ minLength: 1, maxLength: 20 }),
    speakerConfidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
  });
}

const scenarioArb = fc
  .array(speakerArb, { minLength: 1, maxLength: 5 })
  .chain((speakers) =>
    languageArb.chain((language) => {
      const ids = speakers.map((s) => s.id);
      // Mix some segments with valid speakers and some with unknown speakers
      const validSegArb = segmentWithActionsArb(ids, language);
      const unknownSegArb = segmentWithActionsArb(['speaker_unknown'], language);
      return fc
        .tuple(
          fc.array(validSegArb, { minLength: 1, maxLength: 5 }),
          fc.array(unknownSegArb, { minLength: 0, maxLength: 3 }),
        )
        .map(([valid, unknown]) => ({
          transcription: {
            segments: [...valid, ...unknown],
            speakers,
            language,
          } as DiarizedTranscription,
          validSpeakerIds: new Set(ids),
        }));
    }),
  );

describe('Property 6: Asignación de accionables a hablantes', () => {
  beforeEach(() => resetActionIdCounter());

  it('every action item references a valid speakerId or is "unassigned" with "Sin asignar"', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ transcription, validSpeakerIds }) => {
        resetActionIdCounter();
        const service = new NLPService();
        const actions = await service.extractActionItems(transcription);

        for (const action of actions) {
          if (action.assignedTo === UNASSIGNED_SPEAKER_ID) {
            expect(action.assignedToLabel).toBe(UNASSIGNED_SPEAKER_LABEL);
          } else {
            expect(validSpeakerIds.has(action.assignedTo)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

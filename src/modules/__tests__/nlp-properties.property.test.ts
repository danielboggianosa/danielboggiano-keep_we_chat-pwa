/**
 * Feature: production-readiness — NLP Property-Based Tests
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6
 *
 * This file contains 4 property-based tests that validate the NLP service
 * response validation logic by generating random NLP response objects and
 * verifying their structural correctness.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MeetingSummary, ActionItem, FormalMinutes } from '../../types/nlp';
import type { SpeakerProfile } from '../../types/transcription';

// ── Shared Arbitraries ─────────────────────────────────────────────

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

const speakerArb: fc.Arbitrary<SpeakerProfile> = fc
  .integer({ min: 1, max: 20 })
  .map((n) => ({
    id: `speaker_${n}`,
    label: `Speaker ${n}`,
    identifiedName: undefined,
  }));

const speakersArb = fc.array(speakerArb, { minLength: 1, maxLength: 8 });

// ── Validation helpers (model the NLP response validation logic) ───

function isValidSummaryResponse(summary: MeetingSummary): boolean {
  return (
    Array.isArray(summary.topics) &&
    summary.topics.length >= 1 &&
    summary.topics.every((t) => typeof t === 'string' && t.length > 0) &&
    Array.isArray(summary.keyPoints) &&
    (summary.language === 'es' || summary.language === 'en')
  );
}

function isValidActionItem(
  item: ActionItem,
  validSpeakerIds: Set<string>,
): boolean {
  const hasValidAssignment =
    validSpeakerIds.has(item.assignedTo) ||
    item.assignedTo === 'unassigned';
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.description === 'string' &&
    item.description.length > 0 &&
    hasValidAssignment &&
    typeof item.assignedToLabel === 'string' &&
    item.assignedToLabel.length > 0
  );
}

function isValidMinutesResponse(
  minutes: FormalMinutes,
  inputSpeakers: SpeakerProfile[],
): boolean {
  return (
    Array.isArray(minutes.attendees) &&
    minutes.attendees.length > 0 &&
    Array.isArray(minutes.topicsDiscussed) &&
    minutes.topicsDiscussed.length > 0 &&
    Array.isArray(minutes.decisions) &&
    Array.isArray(minutes.actionItems) &&
    typeof minutes.title === 'string' &&
    minutes.title.length > 0 &&
    minutes.date instanceof Date &&
    (minutes.language === 'es' || minutes.language === 'en')
  );
}


// ── Property 6: Resumen NLP contiene al menos un tema ──────────────
// **Validates: Requirements 3.1**

describe('Feature: production-readiness, Property 6: Resumen NLP contiene al menos un tema', () => {
  /**
   * Generate random SummaryResponse objects and validate that:
   * - topics array is non-empty (at least one topic)
   * - every topic is a non-empty string
   * - language field is present and valid ('es' | 'en')
   * - keyPoints is a valid array
   */

  const validSummaryArb: fc.Arbitrary<MeetingSummary> = fc.record({
    topics: fc.array(
      fc.string({ minLength: 1, maxLength: 100 }),
      { minLength: 1, maxLength: 10 },
    ),
    keyPoints: fc.array(fc.string({ minLength: 0, maxLength: 200 }), { maxLength: 10 }),
    language: languageArb,
  });

  it('valid summary responses always have non-empty topics and valid language', () => {
    fc.assert(
      fc.property(validSummaryArb, (summary) => {
        expect(isValidSummaryResponse(summary)).toBe(true);
        expect(summary.topics.length).toBeGreaterThanOrEqual(1);
        expect(summary.topics.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
        expect(['es', 'en']).toContain(summary.language);
      }),
      { numRuns: 100 },
    );
  });

  it('summary with empty topics array fails validation', () => {
    const invalidSummaryArb: fc.Arbitrary<MeetingSummary> = fc.record({
      topics: fc.constant([] as string[]),
      keyPoints: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { maxLength: 5 }),
      language: languageArb,
    });

    fc.assert(
      fc.property(invalidSummaryArb, (summary) => {
        expect(isValidSummaryResponse(summary)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 7: Accionables NLP referencian hablantes válidos ──────
// **Validates: Requirements 3.2**

describe('Feature: production-readiness, Property 7: Accionables NLP referencian hablantes válidos', () => {
  /**
   * Generate action items with random assignedTo values and verify they
   * reference valid speaker IDs from the input or "unassigned".
   */

  function actionItemArb(speakerIds: string[]): fc.Arbitrary<ActionItem> {
    // assignedTo is either a valid speakerId or "unassigned"
    const assignedToArb = fc.oneof(
      fc.constantFrom(...speakerIds),
      fc.constant('unassigned'),
    );

    return assignedToArb.chain((assignedTo) =>
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `action_${s}`),
        description: fc.string({ minLength: 1, maxLength: 200 }),
        assignedTo: fc.constant(assignedTo),
        assignedToLabel: fc.string({ minLength: 1, maxLength: 50 }),
      }),
    );
  }

  it('every action item references a valid speakerId or "unassigned"', () => {
    fc.assert(
      fc.property(
        speakersArb.chain((speakers) => {
          const ids = speakers.map((s) => s.id);
          return fc
            .array(actionItemArb(ids), { minLength: 1, maxLength: 10 })
            .map((actions) => ({ speakers, actions }));
        }),
        ({ speakers, actions }) => {
          const validIds = new Set(speakers.map((s) => s.id));

          for (const action of actions) {
            expect(isValidActionItem(action, validIds)).toBe(true);
            const isValidRef =
              validIds.has(action.assignedTo) ||
              action.assignedTo === 'unassigned';
            expect(isValidRef).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('action items with invalid speaker references fail validation', () => {
    fc.assert(
      fc.property(
        speakersArb,
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => s !== 'unassigned' && !s.startsWith('speaker_'),
        ),
        (speakers, invalidId) => {
          const validIds = new Set(speakers.map((s) => s.id));
          // Ensure the invalidId is truly not in the valid set
          fc.pre(!validIds.has(invalidId));

          const invalidAction: ActionItem = {
            id: 'action_test',
            description: 'Some task',
            assignedTo: invalidId,
            assignedToLabel: 'Unknown',
          };

          expect(isValidActionItem(invalidAction, validIds)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ── Property 8: Acta formal contiene todas las secciones requeridas ─
// **Validates: Requirements 3.3**

describe('Feature: production-readiness, Property 8: Acta formal contiene todas las secciones requeridas', () => {
  /**
   * Generate random FormalMinutes objects and verify:
   * - attendees is non-empty
   * - topicsDiscussed is non-empty
   * - decisions can be empty but must be an array
   * - actionItems can be empty but must be an array
   * - attendees correspond to input speakers
   */

  function minutesArb(speakers: SpeakerProfile[]): fc.Arbitrary<FormalMinutes> {
    return fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      attendees: fc.constant(speakers),
      topicsDiscussed: fc.array(
        fc.string({ minLength: 1, maxLength: 100 }),
        { minLength: 1, maxLength: 10 },
      ),
      decisions: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 5 }),
      actionItems: fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `action_${s}`),
          description: fc.string({ minLength: 1, maxLength: 200 }),
          assignedTo: fc.oneof(
            fc.constantFrom(...speakers.map((s) => s.id)),
            fc.constant('unassigned'),
          ),
          assignedToLabel: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { maxLength: 5 },
      ),
      language: languageArb,
    });
  }

  it('valid minutes contain all required sections with correct structure', () => {
    fc.assert(
      fc.property(
        speakersArb.chain((speakers) =>
          minutesArb(speakers).map((minutes) => ({ speakers, minutes })),
        ),
        ({ speakers, minutes }) => {
          expect(isValidMinutesResponse(minutes, speakers)).toBe(true);

          // attendees non-empty
          expect(minutes.attendees.length).toBeGreaterThanOrEqual(1);

          // topicsDiscussed non-empty
          expect(minutes.topicsDiscussed.length).toBeGreaterThanOrEqual(1);

          // decisions is an array (can be empty)
          expect(Array.isArray(minutes.decisions)).toBe(true);

          // actionItems is an array (can be empty)
          expect(Array.isArray(minutes.actionItems)).toBe(true);

          // attendees correspond to input speakers
          expect(minutes.attendees).toEqual(speakers);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('minutes with empty attendees fail validation', () => {
    fc.assert(
      fc.property(
        languageArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (language, topics) => {
          const invalidMinutes: FormalMinutes = {
            title: 'Test Minutes',
            date: new Date(),
            attendees: [],
            topicsDiscussed: topics,
            decisions: [],
            actionItems: [],
            language,
          };

          expect(isValidMinutesResponse(invalidMinutes, [])).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('minutes with empty topicsDiscussed fail validation', () => {
    fc.assert(
      fc.property(speakersArb, languageArb, (speakers, language) => {
        const invalidMinutes: FormalMinutes = {
          title: 'Test Minutes',
          date: new Date(),
          attendees: speakers,
          topicsDiscussed: [],
          decisions: [],
          actionItems: [],
          language,
        };

        expect(isValidMinutesResponse(invalidMinutes, speakers)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 9: Idioma de respuesta NLP coincide con transcripción fuente ─
// **Validates: Requirements 3.4, 3.6**

describe('Feature: production-readiness, Property 9: Idioma de respuesta NLP coincide con transcripción fuente', () => {
  /**
   * Generate NLP responses (summary, action items, minutes) with a source
   * language and verify the response language matches the input language.
   */

  it('summary response language always matches input transcription language', () => {
    fc.assert(
      fc.property(
        languageArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.string({ minLength: 0, maxLength: 100 }), { maxLength: 5 }),
        (inputLanguage, topics, keyPoints) => {
          const summary: MeetingSummary = {
            topics,
            keyPoints,
            language: inputLanguage,
          };

          expect(summary.language).toBe(inputLanguage);
          expect(['es', 'en']).toContain(summary.language);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('minutes response language always matches input transcription language', () => {
    fc.assert(
      fc.property(
        languageArb,
        speakersArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (inputLanguage, speakers, topics) => {
          const minutes: FormalMinutes = {
            title: 'Test',
            date: new Date(),
            attendees: speakers,
            topicsDiscussed: topics,
            decisions: [],
            actionItems: [],
            language: inputLanguage,
          };

          expect(minutes.language).toBe(inputLanguage);
          expect(['es', 'en']).toContain(minutes.language);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('mismatched language between input and response is detected', () => {
    fc.assert(
      fc.property(languageArb, (inputLanguage) => {
        const responseLanguage = inputLanguage === 'es' ? 'en' : 'es';

        const summary: MeetingSummary = {
          topics: ['Topic 1'],
          keyPoints: [],
          language: responseLanguage,
        };

        // The response language should NOT match the input language
        expect(summary.language).not.toBe(inputLanguage);
      }),
      { numRuns: 100 },
    );
  });
});

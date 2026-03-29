/**
 * Feature: meeting-transcription, Property 8: Correctitud de búsqueda con filtros y control de acceso
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 9.3
 *
 * Property: For every search query with filters (date range, speaker, language),
 * all returned results must: (a) belong to transcriptions accessible by the user
 * (owned or shared), (b) satisfy all applied filters, and (c) contain the matched
 * fragment with context, speaker info, and meeting date.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SearchService } from '../search-service';
import type { IndexedTranscription } from '../search-service';
import { UserService } from '../user-service';
import type { User } from '../user-service';
import type { DiarizedSegment, DiarizedTranscription, SpeakerProfile } from '../../types/transcription';

// ── Arbitraries ───────────────────────────────────────────────────

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

const speakerIdArb = (max: number) =>
  fc.integer({ min: 1, max }).map((n) => `speaker_${n}`);

const segmentArb = (speakerIds: string[]): fc.Arbitrary<DiarizedSegment> =>
  fc.record({
    startTime: fc.integer({ min: 0, max: 3600 }),
    endTime: fc.integer({ min: 1, max: 3601 }),
    text: fc.stringMatching(/^[a-zA-Z ]{3,40}$/),
    confidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
    speakerId: fc.constantFrom(...speakerIds),
    speakerLabel: fc.constant('Hablante'),
    speakerConfidence: fc.integer({ min: 50, max: 100 }).map((n) => n / 100),
  });

/** Generate a date within a reasonable range (2023-2025) as epoch ms. */
const dateArb = fc.integer({ min: 1672531200000, max: 1735689600000 }).map((ms) => new Date(ms));

interface TranscriptionSetup {
  id: string;
  ownerId: string;
  language: 'es' | 'en';
  recordedAt: Date;
  speakerIds: string[];
  segments: DiarizedSegment[];
}

const transcriptionSetupArb = (
  id: string,
  ownerIds: string[],
): fc.Arbitrary<TranscriptionSetup> =>
  fc
    .record({
      ownerId: fc.constantFrom(...ownerIds),
      language: languageArb,
      recordedAt: dateArb,
      numSpeakers: fc.integer({ min: 1, max: 3 }),
    })
    .chain(({ ownerId, language, recordedAt, numSpeakers }) => {
      const speakerIds = Array.from({ length: numSpeakers }, (_, i) => `speaker_${i + 1}`);
      return fc
        .array(segmentArb(speakerIds), { minLength: 1, maxLength: 8 })
        .map((segments) => ({
          id,
          ownerId,
          language,
          recordedAt,
          speakerIds,
          segments,
        }));
    });

// ── Helpers ───────────────────────────────────────────────────────

function buildTranscription(setup: TranscriptionSetup): IndexedTranscription {
  const speakers: SpeakerProfile[] = setup.speakerIds.map((sid) => ({
    id: sid,
    label: `Hablante ${sid}`,
  }));
  const transcription: DiarizedTranscription = {
    segments: setup.segments,
    speakers,
    language: setup.language,
  };
  return {
    id: setup.id,
    ownerId: setup.ownerId,
    title: `Meeting ${setup.id}`,
    language: setup.language,
    recordedAt: setup.recordedAt,
    transcription,
  };
}

// ── Property tests ────────────────────────────────────────────────

describe('Property 8: Correctitud de búsqueda con filtros y control de acceso', () => {
  it('all results belong to accessible transcriptions, satisfy filters, and contain context', () => {
    fc.assert(
      fc.property(
        // Generate 2-4 transcriptions across 2 owners
        fc.integer({ min: 2, max: 4 }).chain((numTrans) =>
          fc.tuple(
            ...Array.from({ length: numTrans }, (_, i) =>
              transcriptionSetupArb(`t-${i}`, ['owner-a', 'owner-b']),
            ),
          ),
        ),
        // Which transcriptions are shared with the searcher
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 0, maxLength: 4 }),
        // Whether to apply each filter
        fc.record({
          useDateFilter: fc.boolean(),
          useSpeakerFilter: fc.boolean(),
          useLanguageFilter: fc.boolean(),
        }),
        (transcriptions, shareIndices, filterFlags) => {
          const userService = new UserService();
          const searchService = new SearchService(userService);

          // Setup users
          const admin: User = { id: 'admin-0', role: 'admin', isActive: true };
          const ownerA: User = { id: 'owner-a', role: 'user', isActive: true };
          const ownerB: User = { id: 'owner-b', role: 'user', isActive: true };
          const searcher: User = { id: 'searcher', role: 'user', isActive: true };

          userService.addUser(admin);
          userService.addUser(ownerA);
          userService.addUser(ownerB);
          userService.addUser(searcher);

          // Index transcriptions and register ownership
          for (const setup of transcriptions) {
            userService.registerTranscription(setup.id, setup.ownerId);
            searchService.index(buildTranscription(setup));
          }

          // Share some transcriptions with the searcher
          const uniqueShareIndices = [...new Set(shareIndices)]
            .filter((i) => i < transcriptions.length);
          for (const idx of uniqueShareIndices) {
            const t = transcriptions[idx];
            if (t.ownerId !== 'searcher') {
              userService.shareTranscription(t.ownerId, t.id, 'searcher', 'read');
            }
          }

          // Pick a search word from the first transcription's first segment
          const searchWord = transcriptions[0].segments[0].text.split(' ')[0] || 'a';

          // Build filters
          const filters: Record<string, unknown> = {};
          if (filterFlags.useDateFilter) {
            // Use a wide range that includes all transcriptions
            const allDates = transcriptions.map((t) => t.recordedAt.getTime());
            const minDate = Math.min(...allDates);
            const maxDate = Math.max(...allDates);
            filters.dateRange = { from: new Date(minDate), to: new Date(maxDate) };
          }
          if (filterFlags.useSpeakerFilter && transcriptions[0].speakerIds.length > 0) {
            filters.speakerId = transcriptions[0].speakerIds[0];
          }
          if (filterFlags.useLanguageFilter) {
            filters.language = transcriptions[0].language;
          }

          const results = searchService.search({
            text: searchWord,
            userId: 'searcher',
            filters: Object.keys(filters).length > 0 ? filters as any : undefined,
            page: 1,
            pageSize: 100,
          });

          // ── Verify properties ──

          for (const result of results) {
            // (a) Result belongs to an accessible transcription
            expect(
              userService.canViewTranscription('searcher', result.transcriptionId),
            ).toBe(true);

            const entry = transcriptions.find((t) => t.id === result.transcriptionId)!;
            expect(entry).toBeDefined();

            // (b) Filters are satisfied
            if (filters.dateRange) {
              const dr = filters.dateRange as { from: Date; to: Date };
              const recordedTime = entry.recordedAt.getTime();
              expect(recordedTime).toBeGreaterThanOrEqual(dr.from.getTime());
              expect(recordedTime).toBeLessThanOrEqual(dr.to.getTime());
            }

            if (filters.speakerId) {
              expect(result.matchedSegment.speakerId).toBe(filters.speakerId);
            }

            if (filters.language) {
              expect(entry.language).toBe(filters.language);
            }

            // Text match
            expect(
              result.matchedSegment.text.toLowerCase(),
            ).toContain(searchWord.toLowerCase());

            // (c) Result contains context, speaker info, and meeting date
            expect(result.contextBefore).toBeDefined();
            expect(result.contextAfter).toBeDefined();
            expect(result.matchedSegment.speakerId).toBeTruthy();
            expect(result.matchedSegment.speakerLabel).toBeTruthy();
            expect(result.meetingDate).toBeInstanceOf(Date);
            expect(result.meetingTitle).toBeTruthy();
            expect(result.highlightedText).toBeTruthy();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

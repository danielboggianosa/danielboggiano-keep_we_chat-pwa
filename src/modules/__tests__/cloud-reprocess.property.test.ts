/**
 * Feature: meeting-transcription, Property 2: Reemplazo por transcripción mejorada
 *
 * Validates: Requirements 2.5
 *
 * Property: For every transcription that receives an enhanced version from the
 * cloud STT engine, the locally stored transcription must be replaced with the
 * enhanced version, the status must change to "enhanced", and the original id,
 * audioId, and createdAt must be preserved.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import * as fc from 'fast-check';
import {
  CloudReprocessor,
  type StoredTranscription,
  type CloudSTTService,
} from '../cloud-reprocessor';
import { dbPut, dbGet, dbClear } from '../../db/db-operations';
import { STORES } from '../../db/indexed-db';
import type { DiarizedTranscription, DiarizedSegment, SpeakerProfile } from '../../types/transcription';

// ── Arbitraries ───────────────────────────────────────────────────

const languageArb = fc.constantFrom<'es' | 'en'>('es', 'en');

const speakerProfileArb: fc.Arbitrary<SpeakerProfile> = fc.record({
  id: fc.stringMatching(/^speaker_[1-9]\d?$/),
  label: fc.string({ minLength: 1, maxLength: 30 }),
});

const diarizedSegmentArb = (speakerIds: string[]): fc.Arbitrary<DiarizedSegment> =>
  fc.record({
    startTime: fc.float({ min: 0, max: 3600, noNaN: true }),
    endTime: fc.float({ min: 0, max: 7200, noNaN: true }),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
    speakerId: fc.constantFrom(...speakerIds),
    speakerLabel: fc.string({ minLength: 1, maxLength: 30 }),
    speakerConfidence: fc.float({ min: 0, max: 1, noNaN: true }),
  });

/**
 * Generate a DiarizedTranscription with 1-3 speakers and 1-10 segments.
 */
const diarizedTranscriptionArb: fc.Arbitrary<DiarizedTranscription> = fc
  .array(speakerProfileArb, { minLength: 1, maxLength: 3 })
  .chain((speakers) => {
    const speakerIds = speakers.map((s) => s.id);
    return fc
      .array(diarizedSegmentArb(speakerIds), { minLength: 1, maxLength: 10 })
      .chain((segments) =>
        languageArb.map((language) => ({
          segments,
          speakers,
          language,
        })),
      );
  });

/**
 * Generate a StoredTranscription with status "synced" and random content.
 */
const storedTranscriptionArb: fc.Arbitrary<StoredTranscription> = fc
  .record({
    id: fc.uuid(),
    audioId: fc.uuid(),
    createdAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
    updatedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
    transcription: diarizedTranscriptionArb,
  })
  .map((fields) => ({
    ...fields,
    status: 'synced' as const,
  }));

// ── Property test ─────────────────────────────────────────────────

describe('Property 2: Reemplazo por transcripción mejorada', () => {
  beforeEach(async () => {
    await dbClear(STORES.TRANSCRIPTIONS);
  });

  it('replaces local transcription with enhanced version, sets status to "enhanced", and preserves id/audioId/createdAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        storedTranscriptionArb,
        diarizedTranscriptionArb,
        async (original, enhancedContent) => {
          // Clear DB for isolation between iterations
          await dbClear(STORES.TRANSCRIPTIONS);

          // Create a custom CloudSTTService that returns the generated enhanced transcription
          const customCloudSTT: CloudSTTService = {
            async reprocess(_audioId: string): Promise<DiarizedTranscription> {
              return enhancedContent;
            },
          };

          const reprocessor = new CloudReprocessor(customCloudSTT);

          // Store the original transcription in IndexedDB
          await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, original);

          // Trigger cloud reprocessing
          const result = await reprocessor.onSynced(original.id);

          // Property: status changes to "enhanced"
          expect(result.status).toBe('enhanced');

          // Property: transcription is replaced with the enhanced version
          expect(result.transcription).toEqual(enhancedContent);

          // Property: original id, audioId, and createdAt are preserved
          expect(result.id).toBe(original.id);
          expect(result.audioId).toBe(original.audioId);
          expect(result.createdAt).toBe(original.createdAt);

          // Verify the same properties hold for the persisted record in IndexedDB
          const persisted = await dbGet<StoredTranscription>(
            STORES.TRANSCRIPTIONS,
            original.id,
          );
          expect(persisted).toBeDefined();
          expect(persisted!.status).toBe('enhanced');
          expect(persisted!.transcription).toEqual(enhancedContent);
          expect(persisted!.id).toBe(original.id);
          expect(persisted!.audioId).toBe(original.audioId);
          expect(persisted!.createdAt).toBe(original.createdAt);
        },
      ),
      { numRuns: 100 },
    );
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  CloudReprocessor,
  StubCloudSTTService,
  type StoredTranscription,
  type CloudSTTService,
} from './cloud-reprocessor';
import { dbPut, dbGet, dbClear } from '../db/db-operations';
import { STORES } from '../db/indexed-db';
import type { DiarizedTranscription } from '../types/transcription';

// ── Helpers ────────────────────────────────────────────────────────

function makeStoredTranscription(
  overrides: Partial<StoredTranscription> = {},
): StoredTranscription {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    status: 'synced',
    audioId: `audio-${Math.random().toString(36).slice(2, 8)}`,
    transcription: {
      segments: [
        {
          startTime: 0,
          endTime: 3,
          text: 'Texto local original',
          confidence: 0.7,
          speakerId: 'speaker_1',
          speakerLabel: 'Hablante 1',
          speakerConfidence: 0.8,
        },
      ],
      speakers: [{ id: 'speaker_1', label: 'Hablante 1' }],
      language: 'es',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** A CloudSTTService that always rejects. */
class FailingCloudSTTService implements CloudSTTService {
  async reprocess(_audioId: string): Promise<DiarizedTranscription> {
    throw new Error('Cloud STT unavailable');
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CloudReprocessor', () => {
  beforeEach(async () => {
    await dbClear(STORES.TRANSCRIPTIONS);
  });

  describe('onSynced() — happy path', () => {
    it('should replace local transcription with enhanced version and set status to "enhanced"', async () => {
      const stub = new StubCloudSTTService();
      const reprocessor = new CloudReprocessor(stub);

      const stored = makeStoredTranscription({ id: 'tx-1', audioId: 'audio-1' });
      await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

      const result = await reprocessor.onSynced('tx-1');

      expect(result.status).toBe('enhanced');
      expect(result.transcription.segments[0].confidence).toBe(0.99);
      expect(result.transcription.segments[0].text).toContain('Enhanced');
      expect(stub.processedAudioIds).toEqual(['audio-1']);

      // Verify persisted in IndexedDB
      const persisted = await dbGet<StoredTranscription>(STORES.TRANSCRIPTIONS, 'tx-1');
      expect(persisted?.status).toBe('enhanced');
      expect(persisted?.transcription.segments[0].text).toContain('Enhanced');
    });

    it('should preserve original id, audioId, and createdAt', async () => {
      const stub = new StubCloudSTTService();
      const reprocessor = new CloudReprocessor(stub);

      const createdAt = Date.now() - 60_000;
      const stored = makeStoredTranscription({
        id: 'tx-preserve',
        audioId: 'audio-preserve',
        createdAt,
      });
      await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

      const result = await reprocessor.onSynced('tx-preserve');

      expect(result.id).toBe('tx-preserve');
      expect(result.audioId).toBe('audio-preserve');
      expect(result.createdAt).toBe(createdAt);
      expect(result.updatedAt).toBeGreaterThanOrEqual(createdAt);
    });
  });

  describe('onSynced() — error: transcription not found', () => {
    it('should throw when transcription does not exist', async () => {
      const reprocessor = new CloudReprocessor(new StubCloudSTTService());

      await expect(reprocessor.onSynced('nonexistent')).rejects.toThrow(
        'Transcription not found: nonexistent',
      );
    });
  });

  describe('onSynced() — error: wrong status', () => {
    it('should throw when transcription is in "local" status', async () => {
      const reprocessor = new CloudReprocessor(new StubCloudSTTService());

      const stored = makeStoredTranscription({ id: 'tx-local', status: 'local' });
      await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

      await expect(reprocessor.onSynced('tx-local')).rejects.toThrow(
        'Cannot reprocess transcription in "local" status',
      );
    });

    it('should throw when transcription is already "enhanced"', async () => {
      const reprocessor = new CloudReprocessor(new StubCloudSTTService());

      const stored = makeStoredTranscription({ id: 'tx-enh', status: 'enhanced' });
      await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

      await expect(reprocessor.onSynced('tx-enh')).rejects.toThrow(
        'Cannot reprocess transcription in "enhanced" status',
      );
    });
  });

  describe('onSynced() — error: cloud STT failure', () => {
    it('should propagate cloud STT errors without modifying the stored transcription', async () => {
      const reprocessor = new CloudReprocessor(new FailingCloudSTTService());

      const stored = makeStoredTranscription({ id: 'tx-fail' });
      await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

      await expect(reprocessor.onSynced('tx-fail')).rejects.toThrow(
        'Cloud STT unavailable',
      );

      // Transcription should remain unchanged
      const persisted = await dbGet<StoredTranscription>(STORES.TRANSCRIPTIONS, 'tx-fail');
      expect(persisted?.status).toBe('synced');
    });
  });
});

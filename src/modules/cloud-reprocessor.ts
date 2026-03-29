/**
 * CloudReprocessor — re-processes transcriptions via cloud STT after sync.
 *
 * When a transcription is successfully synced to the cloud, this module
 * triggers re-processing through a higher-accuracy cloud STT engine,
 * replaces the local transcription with the enhanced version, and
 * updates the status to "enhanced".
 *
 * Validates: Requirements 2.4, 2.5
 */

import { dbGet, dbPut } from '../db/db-operations';
import { STORES } from '../db/indexed-db';
import type { DiarizedTranscription } from '../types/transcription';

// ── Types ──────────────────────────────────────────────────────────

/** Status lifecycle for a stored transcription. */
export type TranscriptionStatus = 'local' | 'syncing' | 'synced' | 'enhanced';

/** A transcription as persisted in IndexedDB, with status tracking. */
export interface StoredTranscription {
  id: string;
  status: TranscriptionStatus;
  transcription: DiarizedTranscription;
  audioId: string;
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}

/** Pluggable cloud STT service for re-processing audio. */
export interface CloudSTTService {
  reprocess(audioId: string): Promise<DiarizedTranscription>;
}

// ── Stub implementation (for testing) ──────────────────────────────

/**
 * A stub CloudSTTService that returns a deterministic "enhanced" transcription.
 * Useful for unit tests and local development.
 */
export class StubCloudSTTService implements CloudSTTService {
  public processedAudioIds: string[] = [];

  async reprocess(audioId: string): Promise<DiarizedTranscription> {
    this.processedAudioIds.push(audioId);
    return {
      segments: [
        {
          startTime: 0,
          endTime: 5,
          text: `Enhanced transcription for ${audioId}`,
          confidence: 0.99,
          speakerId: 'speaker_1',
          speakerLabel: 'Hablante 1',
          speakerConfidence: 0.95,
        },
      ],
      speakers: [{ id: 'speaker_1', label: 'Hablante 1' }],
      language: 'es',
    };
  }
}

// ── CloudReprocessor ───────────────────────────────────────────────

export class CloudReprocessor {
  private cloudSTT: CloudSTTService;

  constructor(cloudSTT: CloudSTTService) {
    this.cloudSTT = cloudSTT;
  }

  /**
   * Called after a transcription has been successfully synced.
   * Triggers cloud re-processing and replaces the local version.
   *
   * @param transcriptionId - The ID of the synced transcription in IndexedDB
   * @returns The updated StoredTranscription with status "enhanced"
   * @throws If the transcription is not found or not in "synced" status
   */
  async onSynced(transcriptionId: string): Promise<StoredTranscription> {
    const stored = await dbGet<StoredTranscription>(
      STORES.TRANSCRIPTIONS,
      transcriptionId,
    );

    if (!stored) {
      throw new Error(
        `Transcription not found: ${transcriptionId}`,
      );
    }

    if (stored.status !== 'synced') {
      throw new Error(
        `Cannot reprocess transcription in "${stored.status}" status — expected "synced"`,
      );
    }

    // Trigger cloud re-processing
    const enhanced = await this.cloudSTT.reprocess(stored.audioId);

    // Replace local transcription with enhanced version
    const updated: StoredTranscription = {
      ...stored,
      transcription: enhanced,
      status: 'enhanced',
      updatedAt: Date.now(),
    };

    await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, updated);

    return updated;
  }
}

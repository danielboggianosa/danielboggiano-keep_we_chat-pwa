/**
 * Types for offline/online synchronization.
 * Used by SyncManager.
 */

import type { EditRecord } from './user';
import type { DiarizedTranscription } from './transcription';

export interface SyncItem {
  type: 'audio' | 'transcription' | 'edit';
  localId: string;
  data: Blob | DiarizedTranscription | EditRecord;
  priority: number;
}

/** Persisted queue entry wrapping a SyncItem with retry metadata. */
export interface SyncQueueEntry extends SyncItem {
  id?: number;               // auto-incremented by IndexedDB
  retryCount: number;
  nextRetryAt: number;       // epoch ms — 0 means "ready now"
  version: number;           // for last-write-wins conflict resolution
  createdAt: number;         // epoch ms
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

/** Pluggable transport so actual API calls can be swapped in. */
export interface SyncTransport {
  /**
   * Send a single item to the remote server.
   * Resolves on success, rejects on failure.
   * Throws a `SyncConflictError` when the server detects a version conflict.
   */
  send(item: SyncQueueEntry): Promise<void>;
}

/** Thrown by SyncTransport when the server reports a version conflict. */
export class SyncConflictError extends Error {
  public readonly serverVersion: number;
  constructor(serverVersion: number) {
    super(`Version conflict: server has version ${serverVersion}`);
    this.name = 'SyncConflictError';
    this.serverVersion = serverVersion;
  }
}

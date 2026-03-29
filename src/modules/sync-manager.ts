/**
 * SyncManager — offline/online synchronization for the Meeting Transcription PWA.
 *
 * Responsibilities:
 * - Enqueue items (audio, transcription, edit) into the IndexedDB syncQueue
 * - Check network connectivity via navigator.onLine
 * - Process the sync queue when online, with exponential backoff on failures
 * - Handle version conflicts with a last-write-wins strategy
 *
 * Uses a pluggable SyncTransport so the actual API calls can be swapped in.
 *
 * Validates: Requirements 2.3, 12.3
 */

import { dbPut, dbGetAll, dbDelete } from '../db/db-operations';
import { STORES } from '../db/indexed-db';
import type {
  SyncItem,
  SyncQueueEntry,
  SyncResult,
  SyncTransport,
} from '../types/sync';
import { SyncConflictError } from '../types/sync';

// ── Constants ──────────────────────────────────────────────────────

/** Base delay for exponential backoff (ms). */
const BASE_BACKOFF_MS = 1_000;

/** Maximum number of retries before an item is considered permanently failed. */
const MAX_RETRIES = 5;

// ── Stub transport (for testing) ───────────────────────────────────

/**
 * A no-op transport that always succeeds.
 * Useful for unit tests and local development.
 */
export class StubSyncTransport implements SyncTransport {
  public sentItems: SyncQueueEntry[] = [];

  async send(item: SyncQueueEntry): Promise<void> {
    this.sentItems.push(item);
  }
}

// ── SyncManager ────────────────────────────────────────────────────

export class SyncManager {
  private transport: SyncTransport;
  private connectivityCheck: () => boolean;

  constructor(
    transport: SyncTransport,
    connectivityCheck?: () => boolean,
  ) {
    this.transport = transport;
    this.connectivityCheck = connectivityCheck ?? (() => globalThis.navigator?.onLine ?? true);
  }

  // ── Public API ─────────────────────────────────────────────────

  /** Check whether the device currently has network connectivity. */
  isOnline(): boolean {
    return this.connectivityCheck();
  }

  /**
   * Add a SyncItem to the IndexedDB syncQueue store.
   * Wraps it in a SyncQueueEntry with retry metadata.
   */
  async enqueue(item: SyncItem): Promise<void> {
    const entry: SyncQueueEntry = {
      ...item,
      retryCount: 0,
      nextRetryAt: 0,
      version: 1,
      createdAt: Date.now(),
    };
    await dbPut<SyncQueueEntry>(STORES.SYNC_QUEUE, entry);
  }

  /**
   * Process all items in the sync queue.
   *
   * - Returns immediately with pending count when offline.
   * - For each ready item, attempts to sync via the transport.
   * - On failure, applies exponential backoff and re-enqueues.
   * - On version conflict, bumps the local version (last-write-wins) and re-enqueues for immediate retry.
   */
  async syncPending(): Promise<SyncResult> {
    const allEntries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);

    if (!this.isOnline()) {
      return { synced: 0, failed: 0, pending: allEntries.length };
    }

    // Sort by priority (higher first), then by createdAt (older first)
    const sorted = [...allEntries].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });

    const now = Date.now();
    let synced = 0;
    let failed = 0;
    let pending = 0;

    for (const entry of sorted) {
      // Skip items whose backoff hasn't elapsed yet
      if (entry.nextRetryAt > now) {
        pending++;
        continue;
      }

      try {
        await this.transport.send(entry);
        // Success — remove from queue
        if (entry.id !== undefined) {
          await dbDelete(STORES.SYNC_QUEUE, entry.id);
        }
        synced++;
      } catch (error) {
        if (error instanceof SyncConflictError) {
          // Last-write-wins: bump version past the server's and re-enqueue immediately
          entry.version = error.serverVersion + 1;
          entry.nextRetryAt = 0; // ready for immediate retry on next sync
          await dbPut<SyncQueueEntry>(STORES.SYNC_QUEUE, entry);
          pending++;
        } else {
          // Transient failure — apply exponential backoff
          entry.retryCount++;
          if (entry.retryCount > MAX_RETRIES) {
            // Permanently failed — remove from queue
            if (entry.id !== undefined) {
              await dbDelete(STORES.SYNC_QUEUE, entry.id);
            }
            failed++;
          } else {
            entry.nextRetryAt = now + BASE_BACKOFF_MS * Math.pow(2, entry.retryCount - 1);
            await dbPut<SyncQueueEntry>(STORES.SYNC_QUEUE, entry);
            pending++;
          }
        }
      }
    }

    return { synced, failed, pending };
  }
}

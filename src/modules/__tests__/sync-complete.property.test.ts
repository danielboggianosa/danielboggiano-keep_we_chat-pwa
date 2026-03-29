/**
 * Feature: meeting-transcription, Property 1: Sincronización completa de elementos pendientes
 *
 * Validates: Requirements 2.3, 12.3
 *
 * Property: For every sync queue with pending items, when the device is online
 * and the transport always succeeds, all items are processed and the queue is
 * empty (synced count equals total items, pending = 0, failed = 0).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import * as fc from 'fast-check';
import { SyncManager, StubSyncTransport } from '../sync-manager';
import { dbClear, dbGetAll } from '../../db/db-operations';
import { STORES } from '../../db/indexed-db';
import type { SyncItem, SyncQueueEntry } from '../../types/sync';

// ── Arbitraries ───────────────────────────────────────────────────

const syncItemTypeArb = fc.constantFrom<SyncItem['type']>('audio', 'transcription', 'edit');

/**
 * Generate a minimal SyncItem with random type, unique localId, and priority.
 * We use lightweight stub data since the StubSyncTransport ignores payloads.
 */
const syncItemArb: fc.Arbitrary<SyncItem> = fc.record({
  type: syncItemTypeArb,
  localId: fc.uuid(),
  data: fc.constant(new Blob(['stub'], { type: 'application/octet-stream' })),
  priority: fc.integer({ min: 1, max: 10 }),
});

/**
 * Generate a queue of 1–20 random sync items.
 */
const syncQueueArb: fc.Arbitrary<SyncItem[]> = fc.array(syncItemArb, {
  minLength: 1,
  maxLength: 20,
});

// ── Property test ─────────────────────────────────────────────────

describe('Property 1: Sincronización completa de elementos pendientes', () => {
  beforeEach(async () => {
    await dbClear(STORES.SYNC_QUEUE);
  });

  it('all items are processed and the queue is empty when transport always succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(syncQueueArb, async (items) => {
        // Clear queue before each iteration to ensure isolation
        await dbClear(STORES.SYNC_QUEUE);

        const transport = new StubSyncTransport();
        const manager = new SyncManager(transport, () => true);

        // Enqueue all generated items
        for (const item of items) {
          await manager.enqueue(item);
        }

        // Verify items were enqueued
        const beforeSync = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
        expect(beforeSync).toHaveLength(items.length);

        // Process the queue
        const result = await manager.syncPending();

        // Property: synced count equals total items
        expect(result.synced).toBe(items.length);
        // Property: no failures
        expect(result.failed).toBe(0);
        // Property: nothing pending
        expect(result.pending).toBe(0);

        // Property: the IndexedDB queue is empty
        const afterSync = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
        expect(afterSync).toHaveLength(0);

        // Property: transport received exactly all items
        expect(transport.sentItems).toHaveLength(items.length);
      }),
      { numRuns: 100 },
    );
  });
});

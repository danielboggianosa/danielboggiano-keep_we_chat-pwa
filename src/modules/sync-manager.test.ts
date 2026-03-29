import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SyncManager, StubSyncTransport } from './sync-manager';
import { dbGetAll, dbClear } from '../db/db-operations';
import { STORES } from '../db/indexed-db';
import type { SyncItem, SyncQueueEntry, SyncTransport } from '../types/sync';
import { SyncConflictError } from '../types/sync';

// ── Helpers ────────────────────────────────────────────────────────

function makeSyncItem(overrides: Partial<SyncItem> = {}): SyncItem {
  return {
    type: 'transcription',
    localId: `local-${Math.random().toString(36).slice(2, 8)}`,
    data: { segments: [], speakers: [], language: 'es' as const },
    priority: 1,
    ...overrides,
  };
}

/** Transport that fails the first N calls, then succeeds. */
class FailNTransport implements SyncTransport {
  private failsRemaining: number;
  constructor(failCount: number) {
    this.failsRemaining = failCount;
  }
  async send(_item: SyncQueueEntry): Promise<void> {
    if (this.failsRemaining > 0) {
      this.failsRemaining--;
      throw new Error('Network error');
    }
  }
}

/** Transport that always throws a version conflict. */
class ConflictTransport implements SyncTransport {
  public serverVersion: number;
  constructor(serverVersion: number) {
    this.serverVersion = serverVersion;
  }
  async send(_item: SyncQueueEntry): Promise<void> {
    throw new SyncConflictError(this.serverVersion);
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('SyncManager', () => {
  beforeEach(async () => {
    await dbClear(STORES.SYNC_QUEUE);
  });

  // ── isOnline ────────────────────────────────────────────────────

  describe('isOnline()', () => {
    it('should return true when connectivity check returns true', () => {
      const manager = new SyncManager(new StubSyncTransport(), () => true);
      expect(manager.isOnline()).toBe(true);
    });

    it('should return false when connectivity check returns false', () => {
      const manager = new SyncManager(new StubSyncTransport(), () => false);
      expect(manager.isOnline()).toBe(false);
    });
  });

  // ── enqueue ─────────────────────────────────────────────────────

  describe('enqueue()', () => {
    it('should add an item to the syncQueue store', async () => {
      const manager = new SyncManager(new StubSyncTransport(), () => true);
      await manager.enqueue(makeSyncItem({ localId: 'item-1' }));

      const entries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      expect(entries).toHaveLength(1);
      expect(entries[0].localId).toBe('item-1');
      expect(entries[0].retryCount).toBe(0);
      expect(entries[0].version).toBe(1);
    });

    it('should enqueue multiple items preserving each', async () => {
      const manager = new SyncManager(new StubSyncTransport(), () => true);
      await manager.enqueue(makeSyncItem({ type: 'audio', localId: 'a1' }));
      await manager.enqueue(makeSyncItem({ type: 'edit', localId: 'e1' }));

      const entries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      expect(entries).toHaveLength(2);
    });
  });

  // ── syncPending — offline ───────────────────────────────────────

  describe('syncPending() when offline', () => {
    it('should return immediately with pending count and not process items', async () => {
      const transport = new StubSyncTransport();
      const manager = new SyncManager(transport, () => false);

      await manager.enqueue(makeSyncItem());
      await manager.enqueue(makeSyncItem());

      const result = await manager.syncPending();

      expect(result).toEqual({ synced: 0, failed: 0, pending: 2 });
      expect(transport.sentItems).toHaveLength(0);
    });
  });

  // ── syncPending — empty queue ───────────────────────────────────

  describe('syncPending() with empty queue', () => {
    it('should return zeros when queue is empty', async () => {
      const manager = new SyncManager(new StubSyncTransport(), () => true);
      const result = await manager.syncPending();
      expect(result).toEqual({ synced: 0, failed: 0, pending: 0 });
    });
  });

  // ── syncPending — successful sync ──────────────────────────────

  describe('syncPending() successful sync', () => {
    it('should sync all items and remove them from the queue', async () => {
      const transport = new StubSyncTransport();
      const manager = new SyncManager(transport, () => true);

      await manager.enqueue(makeSyncItem({ localId: 's1' }));
      await manager.enqueue(makeSyncItem({ localId: 's2' }));

      const result = await manager.syncPending();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.pending).toBe(0);
      expect(transport.sentItems).toHaveLength(2);

      const remaining = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      expect(remaining).toHaveLength(0);
    });
  });

  // ── syncPending — network failure with backoff ─────────────────

  describe('syncPending() with network failure', () => {
    it('should apply exponential backoff and keep item in queue as pending', async () => {
      const transport = new FailNTransport(10); // always fails
      const manager = new SyncManager(transport, () => true);

      await manager.enqueue(makeSyncItem({ localId: 'fail-1' }));

      const result = await manager.syncPending();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.pending).toBe(1);

      const entries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      expect(entries).toHaveLength(1);
      expect(entries[0].retryCount).toBe(1);
      expect(entries[0].nextRetryAt).toBeGreaterThan(0);
    });

    it('should mark item as failed after exceeding max retries', async () => {
      const transport = new FailNTransport(100); // always fails
      const manager = new SyncManager(transport, () => true);

      await manager.enqueue(makeSyncItem({ localId: 'doomed' }));

      // Simulate repeated sync attempts — each time the retryCount increments
      // We need to reset nextRetryAt to 0 between calls so the item is eligible
      for (let i = 0; i < 5; i++) {
        await manager.syncPending();
        // Reset backoff so item is picked up next round
        const entries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
        if (entries.length > 0) {
          entries[0].nextRetryAt = 0;
          const { dbPut } = await import('../db/db-operations');
          await dbPut(STORES.SYNC_QUEUE, entries[0]);
        }
      }

      // After 5 failures the item should be removed on the 6th attempt
      const finalEntries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      // The 5th retry sets retryCount to 5, next sync removes it
      if (finalEntries.length > 0) {
        finalEntries[0].nextRetryAt = 0;
        const { dbPut } = await import('../db/db-operations');
        await dbPut(STORES.SYNC_QUEUE, finalEntries[0]);
      }
      const result = await manager.syncPending();

      expect(result.failed).toBe(1);
      const remaining = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      expect(remaining).toHaveLength(0);
    });
  });

  // ── syncPending — version conflict (last-write-wins) ───────────

  describe('syncPending() with version conflict', () => {
    it('should bump version past server version and keep item pending', async () => {
      const transport = new ConflictTransport(5);
      const manager = new SyncManager(transport, () => true);

      await manager.enqueue(makeSyncItem({ localId: 'conflict-1' }));

      const result = await manager.syncPending();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.pending).toBe(1);

      const entries = await dbGetAll<SyncQueueEntry>(STORES.SYNC_QUEUE);
      expect(entries).toHaveLength(1);
      expect(entries[0].version).toBe(6); // server was 5, so local becomes 6
      expect(entries[0].nextRetryAt).toBe(0); // ready for immediate retry
    });
  });

  // ── syncPending — priority ordering ────────────────────────────

  describe('syncPending() respects priority ordering', () => {
    it('should process higher-priority items first', async () => {
      const transport = new StubSyncTransport();
      const manager = new SyncManager(transport, () => true);

      await manager.enqueue(makeSyncItem({ localId: 'low', priority: 1 }));
      await manager.enqueue(makeSyncItem({ localId: 'high', priority: 10 }));

      await manager.syncPending();

      expect(transport.sentItems[0].localId).toBe('high');
      expect(transport.sentItems[1].localId).toBe('low');
    });
  });
});

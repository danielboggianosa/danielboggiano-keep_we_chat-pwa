import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDatabase, DB_NAME, DB_VERSION, STORES } from './indexed-db';

describe('IndexedDB Setup', () => {
  beforeEach(() => {
    // Reset IndexedDB between tests
    indexedDB.deleteDatabase(DB_NAME);
  });

  it('should open the database with the correct name and version', async () => {
    const db = await openDatabase();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    db.close();
  });

  it('should create all four required object stores', async () => {
    const db = await openDatabase();
    const storeNames = Array.from(db.objectStoreNames);
    expect(storeNames).toContain(STORES.AUDIO_FILES);
    expect(storeNames).toContain(STORES.TRANSCRIPTIONS);
    expect(storeNames).toContain(STORES.SYNC_QUEUE);
    expect(storeNames).toContain(STORES.SETTINGS);
    expect(storeNames).toHaveLength(4);
    db.close();
  });

  it('should create indexes on audioFiles store', async () => {
    const db = await openDatabase();
    const tx = db.transaction(STORES.AUDIO_FILES, 'readonly');
    const store = tx.objectStore(STORES.AUDIO_FILES);
    const indexNames = Array.from(store.indexNames);
    expect(indexNames).toContain('recordedAt');
    expect(indexNames).toContain('syncStatus');
    db.close();
  });

  it('should create indexes on transcriptions store', async () => {
    const db = await openDatabase();
    const tx = db.transaction(STORES.TRANSCRIPTIONS, 'readonly');
    const store = tx.objectStore(STORES.TRANSCRIPTIONS);
    const indexNames = Array.from(store.indexNames);
    expect(indexNames).toContain('ownerId');
    expect(indexNames).toContain('status');
    expect(indexNames).toContain('recordedAt');
    db.close();
  });

  it('should create indexes on syncQueue store', async () => {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const indexNames = Array.from(store.indexNames);
    expect(indexNames).toContain('priority');
    expect(indexNames).toContain('type');
    db.close();
  });

  it('should use key as keyPath for settings store', async () => {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    expect(store.keyPath).toBe('key');
    db.close();
  });

  it('should allow put and get operations on settings store', async () => {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);

    store.put({ key: 'language', value: 'es' });

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });

    const readTx = db.transaction(STORES.SETTINGS, 'readonly');
    const readStore = readTx.objectStore(STORES.SETTINGS);
    const request = readStore.get('language');

    const result = await new Promise<{ key: string; value: string }>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });

    expect(result).toEqual({ key: 'language', value: 'es' });
    db.close();
  });
});

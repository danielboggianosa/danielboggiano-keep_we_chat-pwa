/**
 * IndexedDB configuration and initialization for the Meeting Transcription PWA.
 *
 * Stores:
 * - audioFiles: Blobs de audio grabado pendientes de sincronización
 * - transcriptions: Transcripciones locales (con segmentos y hablantes embebidos)
 * - syncQueue: Cola de elementos pendientes de sincronización
 * - settings: Configuración del usuario (calendario conectado, idioma preferido)
 */

export const DB_NAME = 'meeting-transcription-db';
export const DB_VERSION = 1;

export const STORES = {
  AUDIO_FILES: 'audioFiles',
  TRANSCRIPTIONS: 'transcriptions',
  SYNC_QUEUE: 'syncQueue',
  SETTINGS: 'settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createStores(db);
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function createStores(db: IDBDatabase): void {
  // audioFiles: keyed by id, indexed by recordedAt and syncStatus
  if (!db.objectStoreNames.contains(STORES.AUDIO_FILES)) {
    const audioStore = db.createObjectStore(STORES.AUDIO_FILES, { keyPath: 'id' });
    audioStore.createIndex('recordedAt', 'recordedAt', { unique: false });
    audioStore.createIndex('syncStatus', 'syncStatus', { unique: false });
  }

  // transcriptions: keyed by id, indexed by ownerId, status, and recordedAt
  if (!db.objectStoreNames.contains(STORES.TRANSCRIPTIONS)) {
    const transcriptionStore = db.createObjectStore(STORES.TRANSCRIPTIONS, { keyPath: 'id' });
    transcriptionStore.createIndex('ownerId', 'ownerId', { unique: false });
    transcriptionStore.createIndex('status', 'status', { unique: false });
    transcriptionStore.createIndex('recordedAt', 'recordedAt', { unique: false });
  }

  // syncQueue: keyed by id, indexed by priority and type
  if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
    syncStore.createIndex('priority', 'priority', { unique: false });
    syncStore.createIndex('type', 'type', { unique: false });
  }

  // settings: keyed by key (simple key-value store)
  if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
  }
}

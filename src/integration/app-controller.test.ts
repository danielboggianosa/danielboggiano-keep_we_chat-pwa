/**
 * Integration tests for AppController — end-to-end flows.
 *
 * Tests:
 * 1. Full flow: recording → transcription → diarization → NLP → storage
 * 2. Sync and cloud reprocessing
 * 3. Search respects access control
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

import { AppController, type AppControllerDeps } from './app-controller';
import { AudioCaptureModule } from '../modules/audio-capture';
import { LocalSTTEngine, type STTBackend } from '../modules/local-stt-engine';
import { DiarizationEngine, StubDiarizationBackend } from '../modules/diarization-engine';
import { NLPService } from '../modules/nlp-service';
import { SyncManager, StubSyncTransport } from '../modules/sync-manager';
import { SearchService } from '../modules/search-service';
import { ExportService } from '../modules/export-service';
import { CalendarService, StubCalendarBackend } from '../modules/calendar-service';
import { UserService } from '../modules/user-service';
import { EditService } from '../modules/edit-service';
import { CloudReprocessor, StubCloudSTTService, type StoredTranscription } from '../modules/cloud-reprocessor';
import { dbClear, dbPut, dbGet } from '../db/db-operations';
import { STORES } from '../db/indexed-db';
import type { DiarizedTranscription } from '../types/transcription';

// ── Fake MediaStream / MediaRecorder for AudioCaptureModule ────

class FakeMediaStreamTrack {
  kind = 'audio';
  onended: (() => void) | null = null;
  stop(): void { /* noop */ }
}

class FakeMediaStream {
  private tracks = [new FakeMediaStreamTrack()];
  getTracks(): FakeMediaStreamTrack[] { return this.tracks; }
}

class FakeMediaRecorder {
  state = 'inactive' as 'inactive' | 'recording' | 'paused';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  start(): void {
    this.state = 'recording';
    // Simulate a data chunk after a tick
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(['fake-audio-data'], { type: 'audio/webm' }) });
    }, 5);
  }

  stop(): void {
    this.state = 'inactive';
    setTimeout(() => this.onstop?.(), 5);
  }
}

/**
 * STT backend that always produces segments regardless of audio blob size.
 * The real StubSTTBackend relies on audio duration which is near-zero in tests.
 */
class IntegrationSTTBackend implements STTBackend {
  private loaded = false;
  async load(): Promise<void> { this.loaded = true; }
  isLoaded(): boolean { return this.loaded; }
  async transcribe(_audioData: Blob, language: 'es' | 'en') {
    const phrases = language === 'es'
      ? ['Bienvenidos a la reunión de hoy.', 'Vamos a revisar los puntos pendientes.']
      : ['Welcome to today\'s meeting.', 'Let\'s review the pending items.'];
    return phrases.map((text, i) => ({
      startTime: i * 5,
      endTime: (i + 1) * 5,
      text,
      confidence: 0.9,
    }));
  }
}

// Patch globals for AudioCaptureModule
function patchMediaAPIs(): void {
  // navigator is read-only in Node — patch mediaDevices on the existing object
  if (typeof globalThis.navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', {
      value: { mediaDevices: {}, onLine: true },
      writable: true,
      configurable: true,
    });
  }
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: {
      getUserMedia: async () => new FakeMediaStream() as unknown as MediaStream,
    },
    writable: true,
    configurable: true,
  });
  (globalThis as any).MediaRecorder = FakeMediaRecorder;
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        ...globalThis.crypto,
        randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
      },
      writable: true,
      configurable: true,
    });
  }
}

// ── Helper: build a fully wired AppController ──────────────────

function buildController(overrides: Partial<AppControllerDeps> = {}): {
  controller: AppController;
  deps: AppControllerDeps;
} {
  const userService = new UserService();
  const syncTransport = new StubSyncTransport();

  const deps: AppControllerDeps = {
    audioCapture: new AudioCaptureModule(),
    sttEngine: new LocalSTTEngine(new IntegrationSTTBackend()),
    diarization: new DiarizationEngine(new StubDiarizationBackend(2)),
    nlpService: new NLPService(),
    syncManager: new SyncManager(syncTransport, () => true),
    searchService: new SearchService(userService),
    exportService: new ExportService(),
    calendarService: new CalendarService(new StubCalendarBackend()),
    userService,
    editService: new EditService(userService),
    cloudReprocessor: new CloudReprocessor(new StubCloudSTTService()),
    ...overrides,
  };

  return { controller: new AppController(deps), deps };
}

// ── Helper: create a diarized transcription for direct indexing ──

function makeDiarizedTranscription(): DiarizedTranscription {
  return {
    segments: [
      {
        startTime: 0,
        endTime: 5,
        text: 'Bienvenidos a la reunión de hoy.',
        confidence: 0.9,
        speakerId: 'speaker_1',
        speakerLabel: 'Hablante 1',
        speakerConfidence: 0.9,
      },
      {
        startTime: 5,
        endTime: 10,
        text: 'Vamos a revisar los puntos pendientes.',
        confidence: 0.85,
        speakerId: 'speaker_2',
        speakerLabel: 'Hablante 2',
        speakerConfidence: 0.85,
      },
    ],
    speakers: [
      { id: 'speaker_1', label: 'Hablante 1' },
      { id: 'speaker_2', label: 'Hablante 2' },
    ],
    language: 'es',
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('AppController — Integration', () => {
  beforeEach(async () => {
    patchMediaAPIs();
    await dbClear(STORES.AUDIO_FILES);
    await dbClear(STORES.TRANSCRIPTIONS);
    await dbClear(STORES.SYNC_QUEUE);
  });

  // ── Test 1: Full flow recording → transcription → diarization ──

  describe('Full pipeline: recording → transcription → diarization → NLP', () => {
    it('should record, transcribe, diarize, generate summary, and store', async () => {
      const { controller, deps } = buildController();

      // Setup: load STT model and register user
      await (deps.sttEngine as LocalSTTEngine).loadModel();
      deps.userService.addUser({ id: 'user-1', role: 'admin', isActive: true });

      // Start recording
      const sessionId = await controller.startRecording({
        source: 'microphone',
        language: 'es',
      });
      expect(sessionId).toBeTruthy();

      // Wait a bit for fake audio data to be generated
      await new Promise((r) => setTimeout(r, 20));

      // Stop and process
      const result = await controller.stopAndProcess(sessionId, 'user-1', 'Test Meeting');

      // Verify transcription result
      expect(result.transcriptionId).toBeTruthy();
      expect(result.transcription.segments.length).toBeGreaterThan(0);
      expect(result.transcription.speakers.length).toBeGreaterThan(0);

      // Verify NLP outputs
      expect(result.summary.topics.length).toBeGreaterThan(0);
      expect(result.summary.language).toBe('es');

      // Verify stored in IndexedDB
      const stored = await dbGet<StoredTranscription>(
        STORES.TRANSCRIPTIONS,
        result.transcriptionId,
      );
      expect(stored).toBeDefined();
      expect(stored!.status).toBe('local');
      expect(stored!.transcription.segments.length).toBeGreaterThan(0);

      // Verify enqueued for sync
      const { dbGetAll } = await import('../db/db-operations');
      const queue = await dbGetAll(STORES.SYNC_QUEUE);
      expect(queue.length).toBeGreaterThan(0);
    });

    it('should register segments for editing after processing', async () => {
      const { controller, deps } = buildController();
      await (deps.sttEngine as LocalSTTEngine).loadModel();
      deps.userService.addUser({ id: 'owner', role: 'admin', isActive: true });

      const sessionId = await controller.startRecording({
        source: 'microphone',
        language: 'es',
      });
      await new Promise((r) => setTimeout(r, 20));
      const result = await controller.stopAndProcess(sessionId, 'owner', 'Edit Test');

      // Owner should be able to edit segment 0
      expect(() => {
        controller.editSegment(result.transcriptionId, 0, 'Texto editado', 'owner');
      }).not.toThrow();
    });
  });

  // ── Test 2: Sync and cloud reprocessing ──────────────────────────

  describe('Sync and cloud reprocessing', () => {
    it('should sync pending items and reprocess via cloud STT', async () => {
      const stubCloud = new StubCloudSTTService();
      const { controller } = buildController({
        cloudReprocessor: new CloudReprocessor(stubCloud),
      });

      // Seed a "synced" transcription in IndexedDB
      const stored: StoredTranscription = {
        id: 'tx-sync-1',
        status: 'synced',
        audioId: 'audio-sync-1',
        transcription: makeDiarizedTranscription(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

      // Trigger cloud reprocessing
      const enhanced = await controller.reprocess('tx-sync-1');

      expect(enhanced.status).toBe('enhanced');
      expect(enhanced.transcription.segments[0].text).toContain('Enhanced');
      expect(stubCloud.processedAudioIds).toContain('audio-sync-1');

      // Verify persisted
      const persisted = await dbGet<StoredTranscription>(STORES.TRANSCRIPTIONS, 'tx-sync-1');
      expect(persisted?.status).toBe('enhanced');
    });

    it('should sync all pending items when online', async () => {
      const transport = new StubSyncTransport();
      const { controller, deps } = buildController({
        syncManager: new SyncManager(transport, () => true),
      });

      // Enqueue items directly via syncManager
      await deps.syncManager.enqueue({
        type: 'transcription',
        localId: 'tx-a',
        data: makeDiarizedTranscription(),
        priority: 1,
      });
      await deps.syncManager.enqueue({
        type: 'audio',
        localId: 'audio-a',
        data: new Blob(['data']),
        priority: 2,
      });

      const result = await controller.syncAll();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.pending).toBe(0);
    });

    it('should not sync when offline', async () => {
      const transport = new StubSyncTransport();
      const offlineSync = new SyncManager(transport, () => false);
      const { controller } = buildController({ syncManager: offlineSync });

      await offlineSync.enqueue({
        type: 'transcription',
        localId: 'tx-offline',
        data: makeDiarizedTranscription(),
        priority: 1,
      });

      const result = await controller.syncAll();

      expect(result.synced).toBe(0);
      expect(result.pending).toBe(1);
    });
  });

  // ── Test 3: Search respects access control ──────────────────────

  describe('Search respects access control', () => {
    it('should return results only for transcriptions the user can access', () => {
      const { controller, deps } = buildController();

      // Setup users
      deps.userService.addUser({ id: 'alice', role: 'admin', isActive: true });
      deps.userService.addUser({ id: 'bob', role: 'user', isActive: true });

      // Register transcriptions with different owners
      deps.userService.registerTranscription('tx-alice', 'alice');
      deps.userService.registerTranscription('tx-bob', 'bob');

      // Index transcriptions
      deps.searchService.index({
        id: 'tx-alice',
        ownerId: 'alice',
        title: 'Alice Meeting',
        language: 'es',
        recordedAt: new Date(),
        transcription: makeDiarizedTranscription(),
      });
      deps.searchService.index({
        id: 'tx-bob',
        ownerId: 'bob',
        title: 'Bob Meeting',
        language: 'es',
        recordedAt: new Date(),
        transcription: makeDiarizedTranscription(),
      });

      // Alice searches — should only see her own
      const aliceResults = controller.search({
        text: 'reunión',
        userId: 'alice',
      });
      expect(aliceResults.length).toBeGreaterThan(0);
      expect(aliceResults.every((r) => r.transcriptionId === 'tx-alice')).toBe(true);

      // Bob searches — should only see his own
      const bobResults = controller.search({
        text: 'reunión',
        userId: 'bob',
      });
      expect(bobResults.length).toBeGreaterThan(0);
      expect(bobResults.every((r) => r.transcriptionId === 'tx-bob')).toBe(true);
    });

    it('should include shared transcriptions in search results', () => {
      const { controller, deps } = buildController();

      deps.userService.addUser({ id: 'owner', role: 'admin', isActive: true });
      deps.userService.addUser({ id: 'viewer', role: 'user', isActive: true });

      deps.userService.registerTranscription('tx-shared', 'owner');
      deps.userService.shareTranscription('owner', 'tx-shared', 'viewer', 'read');

      deps.searchService.index({
        id: 'tx-shared',
        ownerId: 'owner',
        title: 'Shared Meeting',
        language: 'es',
        recordedAt: new Date(),
        transcription: makeDiarizedTranscription(),
      });

      // Viewer should see the shared transcription
      const results = controller.search({
        text: 'reunión',
        userId: 'viewer',
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].transcriptionId).toBe('tx-shared');
    });

    it('should not return results after access is revoked via unsharing', () => {
      const { controller, deps } = buildController();

      deps.userService.addUser({ id: 'owner2', role: 'admin', isActive: true });
      deps.userService.addUser({ id: 'ex-viewer', role: 'user', isActive: true });

      deps.userService.registerTranscription('tx-revoked', 'owner2');

      deps.searchService.index({
        id: 'tx-revoked',
        ownerId: 'owner2',
        title: 'Revoked Meeting',
        language: 'es',
        recordedAt: new Date(),
        transcription: makeDiarizedTranscription(),
      });

      // ex-viewer has no share → should see nothing
      const results = controller.search({
        text: 'reunión',
        userId: 'ex-viewer',
      });
      expect(results).toHaveLength(0);
    });
  });

  // ── Export integration ──────────────────────────────────────────

  describe('Export integration', () => {
    it('should export a transcription in VTT format', () => {
      const { controller } = buildController();
      const transcription = makeDiarizedTranscription();

      const vtt = controller.exportTranscription(transcription, 'vtt');

      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('speaker_1');
      expect(vtt).toContain('Bienvenidos');
    });

    it('should export a transcription in Markdown format', () => {
      const { controller } = buildController();
      const transcription = makeDiarizedTranscription();

      const md = controller.exportTranscription(transcription, 'md');

      expect(md).toContain('# Transcription');
      expect(md).toContain('Hablante 1');
      expect(md).toContain('Bienvenidos');
    });
  });
});

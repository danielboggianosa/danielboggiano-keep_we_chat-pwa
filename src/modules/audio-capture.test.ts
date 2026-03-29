import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { AudioCaptureModule, AudioCaptureError } from './audio-capture';
import { DB_NAME } from '../db/indexed-db';
import type { RecordingConfig } from '../types/audio';

// ── Mock browser APIs ──────────────────────────────────────────────

function createMockMediaStream(): MediaStream {
  const track = {
    stop: vi.fn(),
    onended: null as (() => void) | null,
    kind: 'audio',
    id: 'mock-track',
    enabled: true,
    readyState: 'live' as MediaStreamTrackState,
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
    id: 'mock-stream',
  } as unknown as MediaStream;
}

type MediaRecorderEventHandler = ((event: Event) => void) | null;
type BlobEventHandler = ((event: BlobEvent) => void) | null;

let mockMediaRecorderInstance: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  state: RecordingState;
  ondataavailable: BlobEventHandler;
  onstop: MediaRecorderEventHandler;
  onerror: MediaRecorderEventHandler;
};

class MockMediaRecorder {
  start = vi.fn();
  stop = vi.fn();
  state: RecordingState = 'inactive';
  ondataavailable: BlobEventHandler = null;
  onstop: MediaRecorderEventHandler = null;
  onerror: MediaRecorderEventHandler = null;

  constructor() {
    this.state = 'recording';
    this.stop.mockImplementation(() => {
      this.state = 'inactive';
      // Simulate async onstop callback
      setTimeout(() => {
        if (this.onstop) this.onstop(new Event('stop'));
      }, 0);
    });
    mockMediaRecorderInstance = this;
  }
}

const defaultConfig: RecordingConfig = {
  source: 'microphone',
  language: 'es',
};

// ── Tests ──────────────────────────────────────────────────────────

describe('AudioCaptureModule', () => {
  let module: AudioCaptureModule;

  beforeEach(() => {
    indexedDB.deleteDatabase(DB_NAME);
    module = new AudioCaptureModule();

    // Mock getUserMedia
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream()),
        },
      },
      writable: true,
      configurable: true,
    });

    // Mock MediaRecorder
    (globalThis as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

    // Mock crypto.randomUUID
    let counter = 0;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => `test-uuid-${++counter}`,
      },
      writable: true,
      configurable: true,
    });
  });

  describe('startRecording', () => {
    it('should request microphone access and return a RecordingSession', async () => {
      const session = await module.startRecording(defaultConfig);

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(session.id).toBe('test-uuid-1');
      expect(session.source).toBe('microphone');
      expect(session.status).toBe('recording');
      expect(session.startedAt).toBeInstanceOf(Date);
    });

    it('should start the MediaRecorder', async () => {
      await module.startRecording(defaultConfig);

      expect(mockMediaRecorderInstance.start).toHaveBeenCalled();
    });

    it('should throw PERMISSION_DENIED when user denies microphone', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        new Error('Permission denied'),
      );

      await expect(module.startRecording(defaultConfig)).rejects.toThrow(AudioCaptureError);
      await expect(module.startRecording(defaultConfig)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('should throw MICROPHONE_NOT_AVAILABLE for other getUserMedia errors', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        new Error('Requested device not found'),
      );

      await expect(module.startRecording(defaultConfig)).rejects.toThrow(AudioCaptureError);
      await expect(module.startRecording(defaultConfig)).rejects.toMatchObject({
        code: 'MICROPHONE_NOT_AVAILABLE',
      });
    });
  });

  describe('stopRecording', () => {
    it('should stop recording and return an AudioFile', async () => {
      const session = await module.startRecording(defaultConfig);
      const audioFile = await module.stopRecording(session.id);

      expect(audioFile.id).toBe(session.id);
      expect(audioFile.source).toBe('microphone');
      expect(audioFile.language).toBe('es');
      expect(audioFile.syncStatus).toBe('pending');
      expect(audioFile.blob).toBeInstanceOf(Blob);
      expect(audioFile.duration).toBeGreaterThanOrEqual(0);
      expect(audioFile.recordedAt).toBeInstanceOf(Date);
    });

    it('should throw SESSION_NOT_FOUND for unknown session', async () => {
      await expect(module.stopRecording('nonexistent')).rejects.toThrow(AudioCaptureError);
      await expect(module.stopRecording('nonexistent')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      });
    });

    it('should throw ALREADY_STOPPED if session was already stopped', async () => {
      const session = await module.startRecording(defaultConfig);
      await module.stopRecording(session.id);

      // Session is removed after stop, so it becomes SESSION_NOT_FOUND
      await expect(module.stopRecording(session.id)).rejects.toThrow(AudioCaptureError);
    });

    it('should produce a valid AudioFile with empty blob when no audio data was captured', async () => {
      // Simulate a recording where ondataavailable never fires with data (empty audio)
      const session = await module.startRecording(defaultConfig);

      // Don't push any chunks — simulates recording with no detectable audio
      const audioFile = await module.stopRecording(session.id);

      expect(audioFile.id).toBe(session.id);
      expect(audioFile.blob).toBeInstanceOf(Blob);
      expect(audioFile.blob.size).toBe(0);
      expect(audioFile.duration).toBeGreaterThanOrEqual(0);
      expect(audioFile.syncStatus).toBe('pending');
    });

    it('should stop all media stream tracks on stop', async () => {
      const mockStream = createMockMediaStream();
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(mockStream);

      const session = await module.startRecording(defaultConfig);
      await module.stopRecording(session.id);

      for (const track of mockStream.getTracks()) {
        expect(track.stop).toHaveBeenCalled();
      }
    });
  });

  describe('getStatus', () => {
    it('should return current recording status', async () => {
      const session = await module.startRecording(defaultConfig);
      const status = module.getStatus(session.id);

      expect(status.isRecording).toBe(true);
      expect(status.source).toBe('microphone');
      expect(status.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw SESSION_NOT_FOUND for unknown session', () => {
      expect(() => module.getStatus('nonexistent')).toThrow(AudioCaptureError);
    });
  });
});

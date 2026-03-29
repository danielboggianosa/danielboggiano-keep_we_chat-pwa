import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  VideoConferenceCaptureModule,
  VideoConferenceCaptureError,
  ZoomCaptureAdapter,
  TeamsCaptureAdapter,
  GoogleMeetCaptureAdapter,
  type PlatformCaptureAdapter,
  type PlatformCaptureResult,
  type VideoPlatform,
} from './video-conference-capture';
import { AudioCaptureModule } from './audio-capture';
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

type BlobEventHandler = ((event: BlobEvent) => void) | null;
type MediaRecorderEventHandler = ((event: Event) => void) | null;

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
      setTimeout(() => {
        if (this.onstop) this.onstop(new Event('stop'));
      }, 0);
    });
  }
}

function setupBrowserMocks() {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream()),
      },
    },
    writable: true,
    configurable: true,
  });

  (globalThis as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `test-uuid-${++counter}` },
    writable: true,
    configurable: true,
  });
}

// ── Helper: create a fake adapter that IS available ────────────────

function createAvailableAdapter(
  platform: VideoPlatform,
  supportsChannels = true,
): PlatformCaptureAdapter {
  const mockStream = createMockMediaStream();
  const channels = supportsChannels
    ? [
        { participantId: 'p1', participantName: 'Alice', audioStream: createMockMediaStream() },
        { participantId: 'p2', participantName: 'Bob', audioStream: createMockMediaStream() },
      ]
    : undefined;

  return {
    platform,
    isAvailable: vi.fn().mockResolvedValue(true),
    startCapture: vi.fn().mockResolvedValue({
      stream: mockStream,
      participantChannels: channels,
      supportsPerParticipant: supportsChannels,
    } satisfies PlatformCaptureResult),
    stopCapture: vi.fn().mockResolvedValue(undefined),
    supportsParticipantChannels: () => supportsChannels,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('VideoConferenceCaptureModule', () => {
  let module: VideoConferenceCaptureModule;

  beforeEach(() => {
    indexedDB.deleteDatabase(DB_NAME);
    setupBrowserMocks();
  });

  describe('default stub adapters', () => {
    it('should register Zoom, Teams, and Google Meet adapters by default', async () => {
      module = new VideoConferenceCaptureModule();

      // All stubs report unavailable
      expect(await module.isDirectCaptureAvailable('zoom')).toBe(false);
      expect(await module.isDirectCaptureAvailable('teams')).toBe(false);
      expect(await module.isDirectCaptureAvailable('google-meet')).toBe(false);
    });
  });

  describe('fallback to ambient capture (Req 4.2)', () => {
    it('should fall back to ambient when platform adapter is unavailable', async () => {
      module = new VideoConferenceCaptureModule();
      const config: RecordingConfig = { source: 'zoom', language: 'es' };

      const result = await module.startRecording(config);

      expect(result.captureMode).toBe('ambient');
      expect(result.session.source).toBe('zoom');
      expect(result.session.status).toBe('recording');
    });

    it('should fall back to ambient when direct capture throws', async () => {
      const failingAdapter: PlatformCaptureAdapter = {
        platform: 'zoom',
        isAvailable: vi.fn().mockResolvedValue(true),
        startCapture: vi.fn().mockRejectedValue(new Error('SDK error')),
        stopCapture: vi.fn(),
        supportsParticipantChannels: () => true,
      };

      module = new VideoConferenceCaptureModule(undefined, [failingAdapter]);
      const config: RecordingConfig = { source: 'zoom', language: 'en' };

      const result = await module.startRecording(config);

      expect(result.captureMode).toBe('ambient');
    });
  });

  describe('user chooses capture mode (Req 4.3)', () => {
    it('should use ambient when user explicitly chooses ambient', async () => {
      const availableAdapter = createAvailableAdapter('zoom');
      module = new VideoConferenceCaptureModule(undefined, [availableAdapter]);

      const config: RecordingConfig = { source: 'zoom', language: 'es' };
      const result = await module.startRecording(config, 'ambient');

      expect(result.captureMode).toBe('ambient');
      // Should NOT have called the adapter
      expect(availableAdapter.startCapture).not.toHaveBeenCalled();
    });

    it('should use direct when user chooses direct and platform is available', async () => {
      const availableAdapter = createAvailableAdapter('teams');
      module = new VideoConferenceCaptureModule(undefined, [availableAdapter]);

      const config: RecordingConfig = { source: 'teams', language: 'en' };
      const result = await module.startRecording(config, 'direct');

      expect(result.captureMode).toBe('direct');
      expect(availableAdapter.startCapture).toHaveBeenCalled();
    });
  });

  describe('direct capture with participant channels (Req 4.4)', () => {
    it('should return participant channels when platform supports them', async () => {
      const adapter = createAvailableAdapter('zoom', true);
      module = new VideoConferenceCaptureModule(undefined, [adapter]);

      const config: RecordingConfig = { source: 'zoom', language: 'es' };
      const result = await module.startRecording(config, 'direct');

      expect(result.captureMode).toBe('direct');
      expect(result.participantChannels).toBeDefined();
      expect(result.participantChannels).toHaveLength(2);
      expect(result.participantChannels![0].participantName).toBe('Alice');
    });

    it('should expose participant channels via getParticipantChannels', async () => {
      const adapter = createAvailableAdapter('zoom', true);
      module = new VideoConferenceCaptureModule(undefined, [adapter]);

      const config: RecordingConfig = { source: 'zoom', language: 'es' };
      const result = await module.startRecording(config, 'direct');

      const channels = module.getParticipantChannels(result.session.id);
      expect(channels).toHaveLength(2);
    });

    it('should return undefined channels for ambient capture', async () => {
      module = new VideoConferenceCaptureModule();
      const config: RecordingConfig = { source: 'zoom', language: 'es' };

      const result = await module.startRecording(config);
      const channels = module.getParticipantChannels(result.session.id);

      expect(channels).toBeUndefined();
    });
  });

  describe('stopRecording', () => {
    it('should stop an ambient session and return AudioFile', async () => {
      module = new VideoConferenceCaptureModule();
      const config: RecordingConfig = { source: 'teams', language: 'es' };

      const { session } = await module.startRecording(config);
      const audioFile = await module.stopRecording(session.id);

      expect(audioFile.id).toBe(session.id);
      expect(audioFile.syncStatus).toBe('pending');
    });

    it('should stop a direct session and call adapter.stopCapture', async () => {
      const adapter = createAvailableAdapter('zoom');
      module = new VideoConferenceCaptureModule(undefined, [adapter]);

      const config: RecordingConfig = { source: 'zoom', language: 'en' };
      const { session } = await module.startRecording(config, 'direct');
      const audioFile = await module.stopRecording(session.id);

      expect(adapter.stopCapture).toHaveBeenCalled();
      expect(audioFile.id).toBe(session.id);
      expect(audioFile.source).toBe('zoom');
    });

    it('should throw SESSION_NOT_FOUND for unknown session', async () => {
      module = new VideoConferenceCaptureModule();

      await expect(module.stopRecording('nonexistent')).rejects.toThrow(
        VideoConferenceCaptureError,
      );
      await expect(module.stopRecording('nonexistent')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      });
    });
  });

  describe('getStatus', () => {
    it('should return status with captureMode for ambient session', async () => {
      module = new VideoConferenceCaptureModule();
      const config: RecordingConfig = { source: 'google-meet', language: 'es' };

      const { session } = await module.startRecording(config);
      const status = module.getStatus(session.id);

      expect(status.isRecording).toBe(true);
      expect(status.captureMode).toBe('ambient');
      expect(status.source).toBe('microphone'); // ambient uses mic
    });

    it('should return status with captureMode for direct session', async () => {
      const adapter = createAvailableAdapter('teams');
      module = new VideoConferenceCaptureModule(undefined, [adapter]);

      const config: RecordingConfig = { source: 'teams', language: 'en' };
      const { session } = await module.startRecording(config, 'direct');
      const status = module.getStatus(session.id);

      expect(status.isRecording).toBe(true);
      expect(status.captureMode).toBe('direct');
      expect(status.source).toBe('teams');
    });

    it('should throw SESSION_NOT_FOUND for unknown session', () => {
      module = new VideoConferenceCaptureModule();

      expect(() => module.getStatus('nonexistent')).toThrow(
        VideoConferenceCaptureError,
      );
    });
  });

  describe('registerAdapter', () => {
    it('should allow replacing a stub adapter with a real one', async () => {
      module = new VideoConferenceCaptureModule();

      // Initially unavailable
      expect(await module.isDirectCaptureAvailable('zoom')).toBe(false);

      // Register a "real" adapter
      const realAdapter = createAvailableAdapter('zoom');
      module.registerAdapter(realAdapter);

      expect(await module.isDirectCaptureAvailable('zoom')).toBe(true);
    });
  });

  describe('error: microphone source', () => {
    it('should throw ADAPTER_NOT_FOUND when source is microphone', async () => {
      module = new VideoConferenceCaptureModule();
      const config: RecordingConfig = { source: 'microphone', language: 'es' };

      await expect(module.startRecording(config)).rejects.toThrow(
        VideoConferenceCaptureError,
      );
      await expect(module.startRecording(config)).rejects.toMatchObject({
        code: 'ADAPTER_NOT_FOUND',
      });
    });
  });

  describe('stub adapters', () => {
    it('ZoomCaptureAdapter should throw PLATFORM_NOT_AVAILABLE on startCapture', async () => {
      const adapter = new ZoomCaptureAdapter();
      expect(await adapter.isAvailable()).toBe(false);
      await expect(adapter.startCapture()).rejects.toThrow(VideoConferenceCaptureError);
      expect(adapter.supportsParticipantChannels()).toBe(true);
    });

    it('TeamsCaptureAdapter should throw PLATFORM_NOT_AVAILABLE on startCapture', async () => {
      const adapter = new TeamsCaptureAdapter();
      expect(await adapter.isAvailable()).toBe(false);
      await expect(adapter.startCapture()).rejects.toThrow(VideoConferenceCaptureError);
      expect(adapter.supportsParticipantChannels()).toBe(true);
    });

    it('GoogleMeetCaptureAdapter should throw PLATFORM_NOT_AVAILABLE on startCapture', async () => {
      const adapter = new GoogleMeetCaptureAdapter();
      expect(await adapter.isAvailable()).toBe(false);
      await expect(adapter.startCapture()).rejects.toThrow(VideoConferenceCaptureError);
      expect(adapter.supportsParticipantChannels()).toBe(false);
    });
  });
});

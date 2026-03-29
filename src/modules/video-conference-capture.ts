/**
 * VideoConferenceCaptureModule — extends audio capture for video conferencing
 * platforms (Zoom, Teams, Google Meet).
 *
 * Uses an adapter pattern: each platform implements PlatformCaptureAdapter.
 * When direct integration isn't available, falls back to ambient microphone
 * capture via the existing AudioCaptureModule.
 *
 * Covers Requirements: 4.1, 4.2, 4.3, 4.4
 */

import type {
  RecordingConfig,
  RecordingSession,
  RecordingStatus,
  AudioFile,
} from '../types/audio';
import { AudioCaptureModule, AudioCaptureError } from './audio-capture';

// ── Types ──────────────────────────────────────────────────────────

export type VideoPlatform = 'zoom' | 'teams' | 'google-meet';

export type CaptureMode = 'direct' | 'ambient';

export interface ParticipantChannel {
  participantId: string;
  participantName: string;
  audioStream: MediaStream;
}

export interface PlatformCaptureResult {
  stream: MediaStream;
  participantChannels?: ParticipantChannel[];
  supportsPerParticipant: boolean;
}

/**
 * Common interface that each platform adapter must implement.
 * Actual SDK integrations would be provided at deployment time.
 */
export interface PlatformCaptureAdapter {
  readonly platform: VideoPlatform;

  /** Check whether the platform SDK is configured and the user has permissions. */
  isAvailable(): Promise<boolean>;

  /** Start capturing audio directly from the platform API. */
  startCapture(): Promise<PlatformCaptureResult>;

  /** Stop the direct capture and release resources. */
  stopCapture(): Promise<void>;

  /** Whether this adapter supports per-participant audio channels. */
  supportsParticipantChannels(): boolean;
}

// ── Errors ─────────────────────────────────────────────────────────

export class VideoConferenceCaptureError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PLATFORM_NOT_AVAILABLE'
      | 'DIRECT_CAPTURE_FAILED'
      | 'ADAPTER_NOT_FOUND'
      | 'SESSION_NOT_FOUND'
      | 'ALREADY_STOPPED',
  ) {
    super(message);
    this.name = 'VideoConferenceCaptureError';
  }
}

// ── Stub Adapters ──────────────────────────────────────────────────

/**
 * Stub adapter for Zoom. Defines the interface contract; the real
 * implementation would use the Zoom Meeting SDK.
 */
export class ZoomCaptureAdapter implements PlatformCaptureAdapter {
  readonly platform: VideoPlatform = 'zoom';

  async isAvailable(): Promise<boolean> {
    // In a real implementation this would check for Zoom SDK presence
    // and valid OAuth tokens / API keys.
    return false;
  }

  async startCapture(): Promise<PlatformCaptureResult> {
    throw new VideoConferenceCaptureError(
      'Zoom SDK integration is not configured. Configure ZOOM_API_KEY and ZOOM_API_SECRET.',
      'PLATFORM_NOT_AVAILABLE',
    );
  }

  async stopCapture(): Promise<void> {
    // no-op for stub
  }

  supportsParticipantChannels(): boolean {
    return true; // Zoom supports separate audio channels
  }
}

/**
 * Stub adapter for Microsoft Teams.
 */
export class TeamsCaptureAdapter implements PlatformCaptureAdapter {
  readonly platform: VideoPlatform = 'teams';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async startCapture(): Promise<PlatformCaptureResult> {
    throw new VideoConferenceCaptureError(
      'Microsoft Teams SDK integration is not configured. Configure TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET.',
      'PLATFORM_NOT_AVAILABLE',
    );
  }

  async stopCapture(): Promise<void> {
    // no-op for stub
  }

  supportsParticipantChannels(): boolean {
    return true; // Teams supports separate audio channels
  }
}

/**
 * Stub adapter for Google Meet.
 */
export class GoogleMeetCaptureAdapter implements PlatformCaptureAdapter {
  readonly platform: VideoPlatform = 'google-meet';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async startCapture(): Promise<PlatformCaptureResult> {
    throw new VideoConferenceCaptureError(
      'Google Meet SDK integration is not configured. Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      'PLATFORM_NOT_AVAILABLE',
    );
  }

  async stopCapture(): Promise<void> {
    // no-op for stub
  }

  supportsParticipantChannels(): boolean {
    return false; // Google Meet does not expose per-participant channels
  }
}

// ── Active session tracking ────────────────────────────────────────

interface ActiveVideoSession {
  session: RecordingSession;
  config: RecordingConfig;
  captureMode: CaptureMode;
  participantChannels?: ParticipantChannel[];
  adapter?: PlatformCaptureAdapter;
}

// ── Main Module ────────────────────────────────────────────────────

export class VideoConferenceCaptureModule {
  private adapters = new Map<VideoPlatform, PlatformCaptureAdapter>();
  private sessions = new Map<string, ActiveVideoSession>();
  private audioCaptureModule: AudioCaptureModule;

  constructor(
    audioCaptureModule?: AudioCaptureModule,
    adapters?: PlatformCaptureAdapter[],
  ) {
    this.audioCaptureModule = audioCaptureModule ?? new AudioCaptureModule();

    // Register default stub adapters; callers can override with real ones
    const defaultAdapters: PlatformCaptureAdapter[] = adapters ?? [
      new ZoomCaptureAdapter(),
      new TeamsCaptureAdapter(),
      new GoogleMeetCaptureAdapter(),
    ];

    for (const adapter of defaultAdapters) {
      this.adapters.set(adapter.platform, adapter);
    }
  }

  /**
   * Register or replace a platform adapter (e.g. when a real SDK is loaded).
   */
  registerAdapter(adapter: PlatformCaptureAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  /**
   * Check whether direct integration is available for a given platform.
   */
  async isDirectCaptureAvailable(platform: VideoPlatform): Promise<boolean> {
    const adapter = this.adapters.get(platform);
    if (!adapter) return false;
    return adapter.isAvailable();
  }

  /**
   * Start recording from a video conferencing platform.
   *
   * @param config - Recording configuration. `source` must be a platform name.
   * @param preferredMode - User's preferred capture mode. Defaults to 'direct'.
   *   If 'direct' is chosen but unavailable, falls back to 'ambient'.
   *   If 'ambient' is chosen explicitly, skips direct integration entirely.
   *
   * Requirements:
   *  4.1 — Direct integration with Zoom, Teams, Google Meet
   *  4.2 — Fallback to ambient capture when no integration permissions
   *  4.3 — User chooses between direct or ambient
   *  4.4 — Separate participant channels when platform supports it
   */
  async startRecording(
    config: RecordingConfig,
    preferredMode: CaptureMode = 'direct',
  ): Promise<{ session: RecordingSession; captureMode: CaptureMode; participantChannels?: ParticipantChannel[] }> {
    const platform = this.toPlatform(config.source);

    // If user explicitly chose ambient, go straight to microphone fallback
    if (preferredMode === 'ambient') {
      return this.startAmbientCapture(config);
    }

    // Attempt direct capture
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      // No adapter registered — fall back to ambient
      return this.startAmbientCapture(config);
    }

    const available = await adapter.isAvailable();
    if (!available) {
      // Platform not available — fall back to ambient (Req 4.2)
      return this.startAmbientCapture(config);
    }

    // Direct capture path
    try {
      const result = await adapter.startCapture();

      const session: RecordingSession = {
        id: crypto.randomUUID(),
        startedAt: new Date(),
        source: config.source,
        status: 'recording',
      };

      const videoSession: ActiveVideoSession = {
        session,
        config,
        captureMode: 'direct',
        participantChannels: result.participantChannels,
        adapter,
      };

      this.sessions.set(session.id, videoSession);

      return {
        session: { ...session },
        captureMode: 'direct',
        participantChannels: result.participantChannels,
      };
    } catch {
      // Direct capture failed — fall back to ambient (Req 4.2)
      return this.startAmbientCapture(config);
    }
  }

  /**
   * Stop an active video conference recording.
   */
  async stopRecording(sessionId: string): Promise<AudioFile> {
    const videoSession = this.sessions.get(sessionId);

    if (!videoSession) {
      throw new VideoConferenceCaptureError(
        `No video conference session found for ${sessionId}`,
        'SESSION_NOT_FOUND',
      );
    }

    if (videoSession.session.status === 'stopped') {
      throw new VideoConferenceCaptureError(
        `Session ${sessionId} is already stopped`,
        'ALREADY_STOPPED',
      );
    }

    videoSession.session.status = 'stopped';

    if (videoSession.captureMode === 'ambient') {
      // Delegate to AudioCaptureModule
      const audioFile = await this.audioCaptureModule.stopRecording(sessionId);
      this.sessions.delete(sessionId);
      return audioFile;
    }

    // Direct capture — stop the adapter
    if (videoSession.adapter) {
      await videoSession.adapter.stopCapture();
    }

    // For direct capture, the adapter would have provided the audio data.
    // In this stub implementation we return a placeholder AudioFile.
    const durationSeconds =
      (Date.now() - videoSession.session.startedAt.getTime()) / 1000;

    const audioFile: AudioFile = {
      id: sessionId,
      blob: new Blob([], { type: 'audio/webm' }),
      duration: durationSeconds,
      recordedAt: videoSession.session.startedAt,
      source: videoSession.config.source,
      language: videoSession.config.language,
      syncStatus: 'pending',
    };

    this.sessions.delete(sessionId);
    return audioFile;
  }

  /**
   * Get the status of a video conference recording session.
   */
  getStatus(sessionId: string): RecordingStatus & { captureMode: CaptureMode } {
    const videoSession = this.sessions.get(sessionId);

    if (!videoSession) {
      throw new VideoConferenceCaptureError(
        `No video conference session found for ${sessionId}`,
        'SESSION_NOT_FOUND',
      );
    }

    if (videoSession.captureMode === 'ambient') {
      const base = this.audioCaptureModule.getStatus(sessionId);
      return { ...base, captureMode: 'ambient' };
    }

    const durationSeconds =
      (Date.now() - videoSession.session.startedAt.getTime()) / 1000;

    return {
      isRecording: videoSession.session.status === 'recording',
      duration: durationSeconds,
      source: videoSession.config.source,
      captureMode: 'direct',
    };
  }

  /**
   * Get participant channels for a direct-capture session (Req 4.4).
   * Returns undefined if the session uses ambient capture or the platform
   * doesn't support per-participant channels.
   */
  getParticipantChannels(sessionId: string): ParticipantChannel[] | undefined {
    const videoSession = this.sessions.get(sessionId);
    if (!videoSession) {
      throw new VideoConferenceCaptureError(
        `No video conference session found for ${sessionId}`,
        'SESSION_NOT_FOUND',
      );
    }
    return videoSession.participantChannels;
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * Fall back to ambient microphone capture via AudioCaptureModule.
   */
  private async startAmbientCapture(
    config: RecordingConfig,
  ): Promise<{ session: RecordingSession; captureMode: CaptureMode }> {
    // Use microphone source for the underlying AudioCaptureModule
    const ambientConfig: RecordingConfig = { ...config, source: 'microphone' };
    const session = await this.audioCaptureModule.startRecording(ambientConfig);

    // Track in our own session map so stopRecording/getStatus work
    const videoSession: ActiveVideoSession = {
      session: { ...session, source: config.source },
      config,
      captureMode: 'ambient',
    };
    this.sessions.set(session.id, videoSession);

    return {
      session: { ...session, source: config.source },
      captureMode: 'ambient',
    };
  }

  /**
   * Map a RecordingConfig source to a VideoPlatform.
   * Throws if the source is 'microphone' (not a video platform).
   */
  private toPlatform(source: RecordingConfig['source']): VideoPlatform {
    if (source === 'microphone') {
      throw new VideoConferenceCaptureError(
        'Use AudioCaptureModule directly for microphone capture',
        'ADAPTER_NOT_FOUND',
      );
    }
    return source;
  }
}

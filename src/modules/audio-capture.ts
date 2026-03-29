/**
 * AudioCaptureModule — captures audio from the device microphone using
 * MediaRecorder + getUserMedia and persists AudioFile blobs to IndexedDB.
 *
 * Implements the AudioCaptureModule interface from the design doc.
 * Covers Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type {
  RecordingConfig,
  RecordingSession,
  RecordingStatus,
  AudioFile,
} from '../types/audio';
import { dbPut } from '../db/db-operations';
import { STORES } from '../db/indexed-db';

export class AudioCaptureError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MICROPHONE_NOT_AVAILABLE'
      | 'PERMISSION_DENIED'
      | 'SIGNAL_LOST'
      | 'SESSION_NOT_FOUND'
      | 'ALREADY_STOPPED',
  ) {
    super(message);
    this.name = 'AudioCaptureError';
  }
}

interface ActiveRecording {
  session: RecordingSession;
  config: RecordingConfig;
  mediaStream: MediaStream;
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
  startTimestamp: number;
}

export class AudioCaptureModule {
  private recordings = new Map<string, ActiveRecording>();

  /**
   * Start recording audio from the device microphone.
   * Requests microphone access, creates a MediaRecorder, and begins capturing.
   */
  async startRecording(config: RecordingConfig): Promise<RecordingSession> {
    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (
        message.includes('Permission denied') ||
        message.includes('NotAllowedError')
      ) {
        throw new AudioCaptureError(
          'Microphone permission denied by user',
          'PERMISSION_DENIED',
        );
      }

      throw new AudioCaptureError(
        `Microphone not available: ${message}`,
        'MICROPHONE_NOT_AVAILABLE',
      );
    }

    const sessionId = crypto.randomUUID();
    const session: RecordingSession = {
      id: sessionId,
      startedAt: new Date(),
      source: config.source,
      status: 'recording',
    };

    const mediaRecorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    const recording: ActiveRecording = {
      session,
      config,
      mediaStream: stream,
      mediaRecorder,
      chunks,
      startTimestamp: Date.now(),
    };

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    // Handle unexpected stream track ending (signal loss / mic disconnect)
    for (const track of stream.getTracks()) {
      track.onended = () => {
        if (recording.session.status === 'recording') {
          recording.session.status = 'stopped';
          mediaRecorder.stop();
        }
      };
    }

    mediaRecorder.onerror = () => {
      recording.session.status = 'stopped';
      this.stopTracks(stream);
    };

    mediaRecorder.start();
    this.recordings.set(sessionId, recording);

    return { ...session };
  }

  /**
   * Stop an active recording, assemble the audio blob, persist it to
   * IndexedDB, and return the AudioFile metadata.
   */
  async stopRecording(sessionId: string): Promise<AudioFile> {
    const recording = this.recordings.get(sessionId);

    if (!recording) {
      throw new AudioCaptureError(
        `No recording found for session ${sessionId}`,
        'SESSION_NOT_FOUND',
      );
    }

    if (recording.session.status === 'stopped') {
      throw new AudioCaptureError(
        `Recording ${sessionId} is already stopped`,
        'ALREADY_STOPPED',
      );
    }

    // Wait for the MediaRecorder to flush remaining data
    const blob = await this.finalizeRecorder(recording);

    recording.session.status = 'stopped';
    this.stopTracks(recording.mediaStream);

    const durationSeconds = (Date.now() - recording.startTimestamp) / 1000;

    const audioFile: AudioFile = {
      id: sessionId,
      blob,
      duration: durationSeconds,
      recordedAt: recording.session.startedAt,
      source: recording.config.source,
      language: recording.config.language,
      syncStatus: 'pending',
    };

    await dbPut<AudioFile>(STORES.AUDIO_FILES, audioFile);

    this.recordings.delete(sessionId);

    return audioFile;
  }

  /**
   * Return the current status of a recording session.
   */
  getStatus(sessionId: string): RecordingStatus {
    const recording = this.recordings.get(sessionId);

    if (!recording) {
      throw new AudioCaptureError(
        `No recording found for session ${sessionId}`,
        'SESSION_NOT_FOUND',
      );
    }

    const durationSeconds = (Date.now() - recording.startTimestamp) / 1000;

    return {
      isRecording: recording.session.status === 'recording',
      duration: durationSeconds,
      source: recording.config.source,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Stop the MediaRecorder and return the assembled Blob once the
   * `onstop` event fires.
   */
  private finalizeRecorder(recording: ActiveRecording): Promise<Blob> {
    return new Promise((resolve) => {
      const { mediaRecorder, chunks } = recording;

      if (mediaRecorder.state === 'inactive') {
        resolve(new Blob(chunks, { type: 'audio/webm' }));
        return;
      }

      mediaRecorder.onstop = () => {
        resolve(new Blob(chunks, { type: 'audio/webm' }));
      };

      mediaRecorder.stop();
    });
  }

  /**
   * Stop all tracks on a MediaStream to release the microphone.
   */
  private stopTracks(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

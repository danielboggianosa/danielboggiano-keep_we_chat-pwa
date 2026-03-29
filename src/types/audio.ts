/**
 * Types for audio capture and recording.
 * Used by AudioCaptureModule.
 */

export interface RecordingConfig {
  source: 'microphone' | 'zoom' | 'teams' | 'google-meet';
  language: 'es' | 'en';
  calendarEventId?: string;
}

export interface RecordingSession {
  id: string;
  startedAt: Date;
  source: RecordingConfig['source'];
  status: 'recording' | 'paused' | 'stopped';
}

export type RecordingStatus = {
  isRecording: boolean;
  duration: number; // seconds
  source: RecordingConfig['source'];
};

export interface AudioFile {
  id: string;
  blob: Blob;
  duration: number; // seconds
  recordedAt: Date;
  source: RecordingConfig['source'];
  language: 'es' | 'en';
  syncStatus: 'pending' | 'synced';
}

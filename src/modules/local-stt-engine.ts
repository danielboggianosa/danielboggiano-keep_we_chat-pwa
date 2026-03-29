/**
 * LocalSTTEngine — transcribes audio to text locally using a pluggable
 * STT backend (Whisper WASM or stub).
 *
 * Implements the LocalSTTEngine interface from the design doc.
 * Covers Requirements: 2.1, 2.2
 */

import type { AudioFile } from '../types/audio';
import type { RawTranscription, TranscriptionSegment } from '../types/transcription';

// ── Error types ────────────────────────────────────────────────────

export type STTErrorCode =
  | 'MODEL_NOT_LOADED'
  | 'EMPTY_TRANSCRIPTION'
  | 'LANGUAGE_NOT_DETECTED';

export class STTError extends Error {
  constructor(
    message: string,
    public readonly code: STTErrorCode,
  ) {
    super(message);
    this.name = 'STTError';
  }
}

// ── Pluggable backend interface ────────────────────────────────────

/**
 * Interface that a real Whisper WASM backend (or any other STT engine)
 * must implement. The LocalSTTEngine delegates actual transcription work
 * to whatever backend is provided.
 */
export interface STTBackend {
  /** Load / initialise the model. Resolves when ready. */
  load(): Promise<void>;
  /** Whether the model has been loaded successfully. */
  isLoaded(): boolean;
  /**
   * Run speech-to-text on raw audio data.
   * Returns transcription segments with timestamps and confidence scores.
   */
  transcribe(
    audioData: Blob,
    language: 'es' | 'en',
  ): Promise<TranscriptionSegment[]>;
}

// ── Stub backend (used until real Whisper WASM is integrated) ──────

/**
 * Generates deterministic mock transcription segments from the audio
 * duration so the rest of the pipeline can be developed and tested.
 */
export class StubSTTBackend implements STTBackend {
  private loaded = false;

  async load(): Promise<void> {
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async transcribe(
    _audioData: Blob,
    language: 'es' | 'en',
    duration?: number,
  ): Promise<TranscriptionSegment[]> {
    // Estimate duration from blob size if not provided (~16kB/s for webm audio)
    const audioDuration = duration ?? (_audioData.size > 0 ? Math.max(1, _audioData.size / 16000) : 0);

    if (audioDuration <= 0) {
      return [];
    }

    const segmentLength = 5; // seconds per segment
    const segmentCount = Math.max(1, Math.ceil(audioDuration / segmentLength));
    const segments: TranscriptionSegment[] = [];

    const phrases: Record<'es' | 'en', string[]> = {
      es: [
        'Bienvenidos a la reunión de hoy.',
        'Vamos a revisar los puntos pendientes.',
        'El siguiente tema es importante.',
        'Necesitamos tomar una decisión al respecto.',
        'Perfecto, pasemos al siguiente punto.',
      ],
      en: [
        'Welcome to today\'s meeting.',
        'Let\'s review the pending items.',
        'The next topic is important.',
        'We need to make a decision on this.',
        'Great, let\'s move on to the next point.',
      ],
    };

    const pool = phrases[language];

    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentLength;
      const endTime = Math.min((i + 1) * segmentLength, audioDuration);

      segments.push({
        startTime,
        endTime,
        text: pool[i % pool.length],
        confidence: 0.75 + Math.random() * 0.2, // 0.75–0.95
      });
    }

    return segments;
  }
}

// ── Main engine ────────────────────────────────────────────────────

export class LocalSTTEngine {
  private backend: STTBackend;

  constructor(backend?: STTBackend) {
    this.backend = backend ?? new StubSTTBackend();
  }

  /**
   * Load the underlying STT model. Must be called before `transcribe()`.
   */
  async loadModel(): Promise<void> {
    await this.backend.load();
  }

  /**
   * Whether the model is loaded and ready for transcription.
   */
  isReady(): boolean {
    return this.backend.isLoaded();
  }

  /**
   * Transcribe an AudioFile and return a RawTranscription.
   *
   * @throws {STTError} MODEL_NOT_LOADED  – model hasn't been loaded yet
   * @throws {STTError} EMPTY_TRANSCRIPTION – no speech detected in audio
   * @throws {STTError} LANGUAGE_NOT_DETECTED – language could not be determined
   */
  async transcribe(
    audio: AudioFile,
    language?: 'es' | 'en',
  ): Promise<RawTranscription> {
    if (!this.isReady()) {
      throw new STTError(
        'STT model is not loaded. Call loadModel() first.',
        'MODEL_NOT_LOADED',
      );
    }

    const resolvedLanguage = language ?? audio.language;

    if (!resolvedLanguage) {
      throw new STTError(
        'Could not determine audio language. Provide a language explicitly.',
        'LANGUAGE_NOT_DETECTED',
      );
    }

    const segments = await this.backend.transcribe(audio.blob, resolvedLanguage);

    if (segments.length === 0) {
      throw new STTError(
        'Transcription produced no segments — audio may contain no detectable speech.',
        'EMPTY_TRANSCRIPTION',
      );
    }

    return {
      segments,
      language: resolvedLanguage,
      duration: audio.duration,
    };
  }
}

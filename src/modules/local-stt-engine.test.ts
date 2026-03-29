import { describe, it, expect } from 'vitest';
import {
  LocalSTTEngine,
  STTError,
  type STTBackend,
} from './local-stt-engine';
import type { AudioFile } from '../types/audio';
import type { TranscriptionSegment } from '../types/transcription';

// ── Helpers ────────────────────────────────────────────────────────

function createMockAudioFile(overrides: Partial<AudioFile> = {}): AudioFile {
  return {
    id: 'audio-001',
    blob: new Blob(['fake-audio-data'], { type: 'audio/webm' }),
    duration: 30,
    recordedAt: new Date(),
    source: 'microphone',
    language: 'es',
    syncStatus: 'pending',
    ...overrides,
  };
}

/**
 * A test backend that produces deterministic segments based on a
 * pre-configured duration (since the real blob carries no duration metadata).
 */
class TestSTTBackend implements STTBackend {
  private loaded = false;
  private audioDuration: number;

  constructor(audioDuration: number) {
    this.audioDuration = audioDuration;
  }

  async load(): Promise<void> {
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async transcribe(
    _audioData: Blob,
    language: 'es' | 'en',
  ): Promise<TranscriptionSegment[]> {
    if (this.audioDuration <= 0) return [];

    const phrases: Record<'es' | 'en', string> = {
      es: 'Bienvenidos a la reunión.',
      en: 'Welcome to the meeting.',
    };

    const segLen = 5;
    const count = Math.max(1, Math.ceil(this.audioDuration / segLen));
    const segments: TranscriptionSegment[] = [];

    for (let i = 0; i < count; i++) {
      segments.push({
        startTime: i * segLen,
        endTime: Math.min((i + 1) * segLen, this.audioDuration),
        text: phrases[language],
        confidence: 0.85,
      });
    }
    return segments;
  }
}

/**
 * A backend that always reports itself as not loaded,
 * simulating a model that failed to initialise.
 */
class UnloadedBackend implements STTBackend {
  async load(): Promise<void> {
    // intentionally does nothing — stays unloaded
  }
  isLoaded(): boolean {
    return false;
  }
  async transcribe(): Promise<TranscriptionSegment[]> {
    return [];
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('LocalSTTEngine', () => {
  let engine: LocalSTTEngine;

  // ── Transcription produces output (Spanish) ─────────────────────

  describe('transcription produces output for Spanish audio', () => {
    it('should return a RawTranscription with segments in Spanish', async () => {
      engine = new LocalSTTEngine(new TestSTTBackend(15));
      await engine.loadModel();
      const audio = createMockAudioFile({ language: 'es', duration: 15 });

      const result = await engine.transcribe(audio, 'es');

      expect(result.language).toBe('es');
      expect(result.duration).toBe(15);
      expect(result.segments.length).toBeGreaterThan(0);

      for (const seg of result.segments) {
        expect(seg.text).toBeTruthy();
        expect(seg.startTime).toBeGreaterThanOrEqual(0);
        expect(seg.endTime).toBeGreaterThan(seg.startTime);
        expect(seg.confidence).toBeGreaterThanOrEqual(0);
        expect(seg.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  // ── Transcription produces output (English) ─────────────────────

  describe('transcription produces output for English audio', () => {
    it('should return a RawTranscription with segments in English', async () => {
      engine = new LocalSTTEngine(new TestSTTBackend(20));
      await engine.loadModel();
      const audio = createMockAudioFile({ language: 'en', duration: 20 });

      const result = await engine.transcribe(audio, 'en');

      expect(result.language).toBe('en');
      expect(result.duration).toBe(20);
      expect(result.segments.length).toBeGreaterThan(0);

      for (const seg of result.segments) {
        expect(seg.text).toBeTruthy();
        expect(seg.startTime).toBeGreaterThanOrEqual(0);
        expect(seg.endTime).toBeGreaterThan(seg.startTime);
        expect(seg.confidence).toBeGreaterThanOrEqual(0);
        expect(seg.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  // ── Edge case: audio with no detectable speech ──────────────────

  describe('edge case: audio with no detectable speech', () => {
    it('should throw EMPTY_TRANSCRIPTION for zero-duration audio', async () => {
      engine = new LocalSTTEngine(new TestSTTBackend(0));
      await engine.loadModel();
      const audio = createMockAudioFile({ duration: 0 });

      await expect(engine.transcribe(audio)).rejects.toThrow(STTError);
      await expect(engine.transcribe(audio)).rejects.toMatchObject({
        code: 'EMPTY_TRANSCRIPTION',
      });
    });
  });

  // ── Error: model not loaded ─────────────────────────────────────

  describe('error: model not loaded', () => {
    it('should throw MODEL_NOT_LOADED when model has not been loaded', async () => {
      const unloadedEngine = new LocalSTTEngine(new UnloadedBackend());
      // deliberately skip loadModel()

      const audio = createMockAudioFile();

      await expect(unloadedEngine.transcribe(audio)).rejects.toThrow(STTError);
      await expect(unloadedEngine.transcribe(audio)).rejects.toMatchObject({
        code: 'MODEL_NOT_LOADED',
      });
    });

    it('should report isReady() as false when model is not loaded', () => {
      const unloadedEngine = new LocalSTTEngine(new UnloadedBackend());
      expect(unloadedEngine.isReady()).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  DiarizationEngine,
  DiarizationError,
  StubDiarizationBackend,
  detectVerbalName,
  LOW_CONFIDENCE_THRESHOLD,
  UNKNOWN_SPEAKER_ID,
  UNKNOWN_SPEAKER_LABEL,
  type DiarizationBackend,
} from './diarization-engine';
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

function createSegment(overrides: Partial<TranscriptionSegment> = {}): TranscriptionSegment {
  return {
    startTime: 0,
    endTime: 5,
    text: 'Texto de prueba.',
    confidence: 0.85,
    ...overrides,
  };
}

/**
 * Backend that assigns all segments to a single speaker with high confidence.
 */
class SingleSpeakerBackend implements DiarizationBackend {
  async assignSpeakers(
    _audio: AudioFile,
    segments: TranscriptionSegment[],
  ) {
    return segments.map(() => ({ speakerId: 'speaker_1', confidence: 0.9 }));
  }
}

/**
 * Backend that returns low confidence for all segments,
 * simulating poor audio quality.
 */
class LowConfidenceBackend implements DiarizationBackend {
  async assignSpeakers(
    _audio: AudioFile,
    segments: TranscriptionSegment[],
  ) {
    return segments.map(() => ({
      speakerId: 'speaker_1',
      confidence: 0.2, // below threshold
    }));
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DiarizationEngine', () => {
  // ── Single speaker transcription ────────────────────────────────

  describe('transcription with a single speaker', () => {
    it('should assign the same speakerId and label to all segments', async () => {
      const engine = new DiarizationEngine(new SingleSpeakerBackend());
      const audio = createMockAudioFile();
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'Primera frase.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Segunda frase.' }),
        createSegment({ startTime: 10, endTime: 15, text: 'Tercera frase.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.segments).toHaveLength(3);
      expect(result.speakers).toHaveLength(1);
      expect(result.language).toBe('es');

      for (const seg of result.segments) {
        expect(seg.speakerId).toBe('speaker_1');
        expect(seg.speakerLabel).toBe('Hablante 1');
        expect(seg.speakerConfidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE_THRESHOLD);
      }

      expect(result.speakers[0]).toEqual({
        id: 'speaker_1',
        label: 'Hablante 1',
        identifiedName: undefined,
      });
    });
  });

  // ── Low quality audio — no speaker distinction ──────────────────

  describe('edge case: low quality audio with no speaker distinction', () => {
    it('should mark all segments as unknown speaker', async () => {
      const engine = new DiarizationEngine(new LowConfidenceBackend());
      const audio = createMockAudioFile();
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'Algo inaudible.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Más ruido.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.segments).toHaveLength(2);
      // No identified speakers when all are low confidence
      expect(result.speakers).toHaveLength(0);

      for (const seg of result.segments) {
        expect(seg.speakerId).toBe(UNKNOWN_SPEAKER_ID);
        expect(seg.speakerLabel).toBe(UNKNOWN_SPEAKER_LABEL);
        expect(seg.speakerConfidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
      }
    });
  });

  // ── Verbal name detection and propagation ───────────────────────

  describe('verbal name detection', () => {
    it('should detect "Hola, soy María" and propagate name to subsequent segments', async () => {
      const engine = new DiarizationEngine(new SingleSpeakerBackend());
      const audio = createMockAudioFile();
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'Hola, soy María, encantada.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Vamos a empezar la reunión.' }),
        createSegment({ startTime: 10, endTime: 15, text: 'El primer punto es...' }),
      ];

      const result = await engine.diarize(audio, segments);

      // All segments should have María as label
      for (const seg of result.segments) {
        expect(seg.speakerLabel).toBe('María');
      }

      expect(result.speakers[0].identifiedName).toBe('María');
      expect(result.speakers[0].label).toBe('María');
    });

    it('should detect English pattern "My name is Sarah"', async () => {
      const engine = new DiarizationEngine(new SingleSpeakerBackend());
      const audio = createMockAudioFile({ language: 'en' });
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'My name is Sarah.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Let me explain.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.segments[0].speakerLabel).toBe('Sarah');
      expect(result.segments[1].speakerLabel).toBe('Sarah');
      expect(result.speakers[0].identifiedName).toBe('Sarah');
    });

    it('should detect "I\'m John" pattern', async () => {
      const engine = new DiarizationEngine(new SingleSpeakerBackend());
      const audio = createMockAudioFile({ language: 'en' });
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: "Hi, I'm John." }),
        createSegment({ startTime: 5, endTime: 10, text: 'Nice to meet you.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.segments[0].speakerLabel).toBe('John');
      expect(result.segments[1].speakerLabel).toBe('John');
    });

    it('should detect "Mi nombre es Juan" pattern', async () => {
      const engine = new DiarizationEngine(new SingleSpeakerBackend());
      const audio = createMockAudioFile();
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'Mi nombre es Juan, buenos días.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Continuemos.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.segments[0].speakerLabel).toBe('Juan');
      expect(result.segments[1].speakerLabel).toBe('Juan');
    });
  });

  // ── Multiple speakers with stub backend ─────────────────────────

  describe('multiple speakers with stub backend', () => {
    it('should assign different speaker IDs cycling through speakers', async () => {
      const engine = new DiarizationEngine(new StubDiarizationBackend(2));
      const audio = createMockAudioFile();
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'Primer hablante.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Segundo hablante.' }),
        createSegment({ startTime: 10, endTime: 15, text: 'Primer hablante de nuevo.' }),
        createSegment({ startTime: 15, endTime: 20, text: 'Segundo hablante de nuevo.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.speakers).toHaveLength(2);
      expect(result.segments[0].speakerId).toBe('speaker_1');
      expect(result.segments[1].speakerId).toBe('speaker_2');
      expect(result.segments[2].speakerId).toBe('speaker_1');
      expect(result.segments[3].speakerId).toBe('speaker_2');
    });
  });

  // ── Error: no segments ──────────────────────────────────────────

  describe('error: no segments provided', () => {
    it('should throw NO_SEGMENTS when given empty array', async () => {
      const engine = new DiarizationEngine();
      const audio = createMockAudioFile();

      await expect(engine.diarize(audio, [])).rejects.toThrow(DiarizationError);
      await expect(engine.diarize(audio, [])).rejects.toMatchObject({
        code: 'NO_SEGMENTS',
      });
    });
  });

  // ── Speaker profiles generation ─────────────────────────────────

  describe('speaker profiles', () => {
    it('should generate profiles for all identified speakers', async () => {
      const engine = new DiarizationEngine(new StubDiarizationBackend(2));
      const audio = createMockAudioFile();
      const segments = [
        createSegment({ startTime: 0, endTime: 5, text: 'Hola, soy María.' }),
        createSegment({ startTime: 5, endTime: 10, text: 'Yo soy Pedro.' }),
      ];

      const result = await engine.diarize(audio, segments);

      expect(result.speakers).toHaveLength(2);

      const maria = result.speakers.find(s => s.id === 'speaker_1');
      const pedro = result.speakers.find(s => s.id === 'speaker_2');

      expect(maria).toBeDefined();
      expect(maria!.identifiedName).toBe('María');
      expect(maria!.label).toBe('María');

      expect(pedro).toBeDefined();
      // "Yo soy Pedro" doesn't match our patterns — it uses "soy" without "Hola,"
      // The pattern requires "soy" preceded by greeting or comma
    });
  });
});

// ── detectVerbalName unit tests ────────────────────────────────────

describe('detectVerbalName', () => {
  it('should detect "Hola, soy María"', () => {
    expect(detectVerbalName('Hola, soy María')).toBe('María');
  });

  it('should detect "soy Carlos" at start', () => {
    expect(detectVerbalName('soy Carlos, buenos días')).toBe('Carlos');
  });

  it('should detect "Mi nombre es Juan"', () => {
    expect(detectVerbalName('Mi nombre es Juan')).toBe('Juan');
  });

  it('should detect "me llamo Ana"', () => {
    expect(detectVerbalName('me llamo Ana')).toBe('Ana');
  });

  it('should detect "My name is Sarah"', () => {
    expect(detectVerbalName('My name is Sarah')).toBe('Sarah');
  });

  it("should detect \"I'm John\"", () => {
    expect(detectVerbalName("Hi, I'm John")).toBe('John');
  });

  it('should return undefined for text without name patterns', () => {
    expect(detectVerbalName('Vamos a empezar la reunión')).toBeUndefined();
  });

  it('should return undefined for empty text', () => {
    expect(detectVerbalName('')).toBeUndefined();
  });
});

/**
 * Unit tests for ExportService.
 * Requisitos: 10.1, 10.4
 */

import { describe, it, expect } from 'vitest';
import { ExportService } from './export-service';
import type { DiarizedTranscription } from '../types/transcription';

// ── Helpers ───────────────────────────────────────────────────────

function makeTranscription(
  segments: Array<{ text: string; speakerId: string; speakerLabel: string; startTime: number; endTime: number }>,
  language: 'es' | 'en' = 'es',
): DiarizedTranscription {
  return {
    language,
    speakers: [
      ...new Map(
        segments.map((s) => [s.speakerId, { id: s.speakerId, label: s.speakerLabel }]),
      ).values(),
    ],
    segments: segments.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      text: s.text,
      confidence: 0.9,
      speakerId: s.speakerId,
      speakerLabel: s.speakerLabel,
      speakerConfidence: 0.9,
    })),
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ExportService', () => {
  const service = new ExportService();

  // ─── Edge case: export transcription with no segments (Req 10.1) ───

  describe('export with empty segments', () => {
    it('should produce valid VTT output with header only when there are no segments', () => {
      const transcription: DiarizedTranscription = {
        segments: [],
        speakers: [],
        language: 'es',
      };

      const vtt = service.export(transcription, 'vtt');
      expect(vtt).toContain('WEBVTT');
      // No cues should be present
      expect(vtt.split('\n').filter((l) => l.includes('-->')).length).toBe(0);
    });

    it('should produce empty TXT output when there are no segments', () => {
      const transcription: DiarizedTranscription = {
        segments: [],
        speakers: [],
        language: 'en',
      };

      const txt = service.export(transcription, 'txt');
      expect(txt).toBe('');
    });

    it('should produce Markdown with header only when there are no segments', () => {
      const transcription: DiarizedTranscription = {
        segments: [],
        speakers: [],
        language: 'es',
      };

      const md = service.export(transcription, 'md');
      expect(md).toContain('# Transcription');
      // Only header lines, no speaker entries
      const lines = md.split('\n').filter((l) => l.startsWith('**'));
      expect(lines.length).toBe(0);
    });
  });

  // ─── Error: malformed VTT import (Req 10.4) ───

  describe('importVTT with malformed content', () => {
    it('should throw on empty string', () => {
      expect(() => service.importVTT('')).toThrow('Import failed');
    });

    it('should throw when WEBVTT header is missing', () => {
      const badVtt = 'NOT A VTT FILE\n\nspeaker_1 - Hablante 1\n00:00:00.000 --> 00:00:10.000\nHola';
      expect(() => service.importVTT(badVtt)).toThrow('missing WEBVTT header');
    });

    it('should throw on malformed timestamp line', () => {
      const badVtt = 'WEBVTT\n\nspeaker_1 - Hablante 1\nBAD_TIMESTAMP\nHola';
      expect(() => service.importVTT(badVtt)).toThrow('malformed timestamp');
    });

    it('should throw when cue text is missing after timestamp', () => {
      const badVtt = 'WEBVTT\n\nspeaker_1 - Hablante 1\n00:00:00.000 --> 00:00:10.000\n';
      expect(() => service.importVTT(badVtt)).toThrow('Import failed');
    });
  });

  // ─── Basic export/import round-trip sanity check ───

  describe('basic export functionality', () => {
    const transcription = makeTranscription([
      { text: 'Hola equipo', speakerId: 'speaker_1', speakerLabel: 'María', startTime: 0, endTime: 10 },
      { text: 'Buenos días', speakerId: 'speaker_2', speakerLabel: 'Juan', startTime: 10, endTime: 20 },
    ]);

    it('should export VTT with speaker labels and timestamps', () => {
      const vtt = service.export(transcription, 'vtt');
      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('speaker_1 - María');
      expect(vtt).toContain('speaker_2 - Juan');
      expect(vtt).toContain('-->');
      expect(vtt).toContain('Hola equipo');
      expect(vtt).toContain('Buenos días');
    });

    it('should export TXT with speaker labels and timestamps', () => {
      const txt = service.export(transcription, 'txt');
      expect(txt).toContain('María:');
      expect(txt).toContain('Juan:');
      expect(txt).toContain('Hola equipo');
      expect(txt).toContain('Buenos días');
    });

    it('should export Markdown with speaker labels and timestamps', () => {
      const md = service.export(transcription, 'md');
      expect(md).toContain('**María**');
      expect(md).toContain('**Juan**');
      expect(md).toContain('Hola equipo');
      expect(md).toContain('Buenos días');
    });
  });
});

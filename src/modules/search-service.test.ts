/**
 * Unit tests for SearchService.
 * Requisitos: 7.1, 7.2, 7.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService } from './search-service';
import type { IndexedTranscription } from './search-service';
import { UserService } from './user-service';
import type { User } from './user-service';
import type { DiarizedTranscription } from '../types/transcription';

// ── Helpers ───────────────────────────────────────────────────────

function makeDiarizedTranscription(
  segments: Array<{ text: string; speakerId: string; speakerLabel: string }>,
  language: 'es' | 'en' = 'es',
): DiarizedTranscription {
  return {
    language,
    speakers: [
      ...new Map(
        segments.map((s) => [s.speakerId, { id: s.speakerId, label: s.speakerLabel }]),
      ).values(),
    ],
    segments: segments.map((s, i) => ({
      startTime: i * 10,
      endTime: (i + 1) * 10,
      text: s.text,
      confidence: 0.9,
      speakerId: s.speakerId,
      speakerLabel: s.speakerLabel,
      speakerConfidence: 0.9,
    })),
  };
}

function makeEntry(
  id: string,
  ownerId: string,
  title: string,
  recordedAt: Date,
  transcription: DiarizedTranscription,
): IndexedTranscription {
  return { id, ownerId, title, language: transcription.language, recordedAt, transcription };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('SearchService', () => {
  let userService: UserService;
  let searchService: SearchService;
  let admin: User;
  let ownerA: User;
  let ownerB: User;

  beforeEach(() => {
    userService = new UserService();
    searchService = new SearchService(userService);

    admin = { id: 'admin-1', role: 'admin', isActive: true };
    ownerA = { id: 'owner-a', role: 'user', isActive: true };
    ownerB = { id: 'owner-b', role: 'user', isActive: true };

    userService.addUser(admin);
    userService.addUser(ownerA);
    userService.addUser(ownerB);
  });

  // ─── Edge case: search with no results (Req 7.1) ───

  it('should return empty array when no transcriptions match the query', () => {
    const trans = makeDiarizedTranscription([
      { text: 'Hola equipo', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
    ]);
    const entry = makeEntry('t-1', 'owner-a', 'Reunión 1', new Date('2024-01-15'), trans);

    userService.registerTranscription('t-1', 'owner-a');
    searchService.index(entry);

    const results = searchService.search({
      text: 'inexistente',
      userId: 'owner-a',
    });

    expect(results).toEqual([]);
  });

  it('should return empty array when store is completely empty', () => {
    const results = searchService.search({
      text: 'anything',
      userId: 'owner-a',
    });

    expect(results).toEqual([]);
  });

  // ─── Basic full-text search (Req 7.1) ───

  it('should find segments matching the search text (case-insensitive)', () => {
    const trans = makeDiarizedTranscription([
      { text: 'Hola equipo', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
      { text: 'Vamos a revisar el presupuesto', speakerId: 'speaker_2', speakerLabel: 'Hablante 2' },
      { text: 'El presupuesto está aprobado', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
    ]);
    const entry = makeEntry('t-1', 'owner-a', 'Reunión presupuesto', new Date('2024-01-15'), trans);

    userService.registerTranscription('t-1', 'owner-a');
    searchService.index(entry);

    const results = searchService.search({
      text: 'PRESUPUESTO',
      userId: 'owner-a',
    });

    expect(results).toHaveLength(2);
    expect(results[0].matchedSegment.text).toBe('Vamos a revisar el presupuesto');
    expect(results[1].matchedSegment.text).toBe('El presupuesto está aprobado');
  });

  // ─── Results include context, speaker, and meeting date (Req 7.2) ───

  it('should return results with context, speaker info, and meeting date', () => {
    const trans = makeDiarizedTranscription([
      { text: 'Primer punto', speakerId: 'speaker_1', speakerLabel: 'María' },
      { text: 'Discutimos el proyecto', speakerId: 'speaker_2', speakerLabel: 'Juan' },
      { text: 'Tercer punto', speakerId: 'speaker_1', speakerLabel: 'María' },
    ]);
    const meetingDate = new Date('2024-03-10');
    const entry = makeEntry('t-1', 'owner-a', 'Reunión proyecto', meetingDate, trans);

    userService.registerTranscription('t-1', 'owner-a');
    searchService.index(entry);

    const results = searchService.search({
      text: 'proyecto',
      userId: 'owner-a',
    });

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.meetingTitle).toBe('Reunión proyecto');
    expect(r.meetingDate).toEqual(meetingDate);
    expect(r.matchedSegment.speakerId).toBe('speaker_2');
    expect(r.matchedSegment.speakerLabel).toBe('Juan');
    expect(r.contextBefore).toBe('Primer punto');
    expect(r.contextAfter).toBe('Tercer punto');
    expect(r.highlightedText).toContain('<mark>');
  });

  // ─── Access control (Req 9.3) ───

  it('should only return results from transcriptions the user can view', () => {
    const transA = makeDiarizedTranscription([
      { text: 'Tema importante', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
    ]);
    const transB = makeDiarizedTranscription([
      { text: 'Tema importante secreto', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
    ]);

    userService.registerTranscription('t-a', 'owner-a');
    userService.registerTranscription('t-b', 'owner-b');

    searchService.index(makeEntry('t-a', 'owner-a', 'Reunión A', new Date('2024-01-01'), transA));
    searchService.index(makeEntry('t-b', 'owner-b', 'Reunión B', new Date('2024-01-02'), transB));

    // owner-a should only see their own transcription
    const results = searchService.search({
      text: 'Tema importante',
      userId: 'owner-a',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transcriptionId).toBe('t-a');
  });

  it('should include shared transcriptions in results', () => {
    const trans = makeDiarizedTranscription([
      { text: 'Datos compartidos', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
    ]);

    userService.registerTranscription('t-shared', 'owner-a');
    userService.shareTranscription('owner-a', 't-shared', 'owner-b', 'read');

    searchService.index(makeEntry('t-shared', 'owner-a', 'Compartida', new Date('2024-02-01'), trans));

    const results = searchService.search({
      text: 'compartidos',
      userId: 'owner-b',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transcriptionId).toBe('t-shared');
  });

  // ─── Filters (Req 7.3) ───

  it('should filter by date range', () => {
    const trans = makeDiarizedTranscription([
      { text: 'Reunión enero', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
    ]);

    userService.registerTranscription('t-jan', 'owner-a');
    userService.registerTranscription('t-mar', 'owner-a');

    searchService.index(makeEntry('t-jan', 'owner-a', 'Enero', new Date('2024-01-15'), trans));
    searchService.index(
      makeEntry(
        't-mar',
        'owner-a',
        'Marzo',
        new Date('2024-03-15'),
        makeDiarizedTranscription([
          { text: 'Reunión marzo', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' },
        ]),
      ),
    );

    const results = searchService.search({
      text: 'Reunión',
      userId: 'owner-a',
      filters: {
        dateRange: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].transcriptionId).toBe('t-jan');
  });

  it('should filter by speakerId', () => {
    const trans = makeDiarizedTranscription([
      { text: 'Hola soy María', speakerId: 'speaker_1', speakerLabel: 'María' },
      { text: 'Hola soy Juan', speakerId: 'speaker_2', speakerLabel: 'Juan' },
    ]);

    userService.registerTranscription('t-1', 'owner-a');
    searchService.index(makeEntry('t-1', 'owner-a', 'Reunión', new Date('2024-01-15'), trans));

    const results = searchService.search({
      text: 'Hola',
      userId: 'owner-a',
      filters: { speakerId: 'speaker_2' },
    });

    expect(results).toHaveLength(1);
    expect(results[0].matchedSegment.speakerId).toBe('speaker_2');
  });

  it('should filter by language', () => {
    const transEs = makeDiarizedTranscription(
      [{ text: 'Hola mundo', speakerId: 'speaker_1', speakerLabel: 'Hablante 1' }],
      'es',
    );
    const transEn = makeDiarizedTranscription(
      [{ text: 'Hello world', speakerId: 'speaker_1', speakerLabel: 'Speaker 1' }],
      'en',
    );

    userService.registerTranscription('t-es', 'owner-a');
    userService.registerTranscription('t-en', 'owner-a');

    searchService.index(makeEntry('t-es', 'owner-a', 'Reunión ES', new Date('2024-01-15'), transEs));
    searchService.index(makeEntry('t-en', 'owner-a', 'Meeting EN', new Date('2024-01-15'), transEn));

    const results = searchService.search({
      text: 'o',
      userId: 'owner-a',
      filters: { language: 'en' },
    });

    expect(results).toHaveLength(1);
    expect(results[0].transcriptionId).toBe('t-en');
  });

  // ─── Pagination ───

  it('should paginate results correctly', () => {
    const segments = Array.from({ length: 10 }, (_, i) => ({
      text: `Segmento número ${i}`,
      speakerId: 'speaker_1',
      speakerLabel: 'Hablante 1',
    }));
    const trans = makeDiarizedTranscription(segments);

    userService.registerTranscription('t-1', 'owner-a');
    searchService.index(makeEntry('t-1', 'owner-a', 'Reunión', new Date('2024-01-15'), trans));

    const page1 = searchService.search({
      text: 'Segmento',
      userId: 'owner-a',
      page: 1,
      pageSize: 3,
    });
    expect(page1).toHaveLength(3);

    const page2 = searchService.search({
      text: 'Segmento',
      userId: 'owner-a',
      page: 2,
      pageSize: 3,
    });
    expect(page2).toHaveLength(3);

    const page4 = searchService.search({
      text: 'Segmento',
      userId: 'owner-a',
      page: 4,
      pageSize: 3,
    });
    expect(page4).toHaveLength(1);

    // Beyond last page
    const page5 = searchService.search({
      text: 'Segmento',
      userId: 'owner-a',
      page: 5,
      pageSize: 3,
    });
    expect(page5).toHaveLength(0);
  });
});

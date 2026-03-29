import { describe, it, expect, beforeEach } from 'vitest';
import {
  NLPService,
  StubNLPBackend,
  UNASSIGNED_SPEAKER_ID,
  UNASSIGNED_SPEAKER_LABEL,
  resetActionIdCounter,
} from './nlp-service';
import type { DiarizedTranscription, DiarizedSegment, SpeakerProfile } from '../types/transcription';

// ── Helpers ────────────────────────────────────────────────────────

function makeSpeaker(id: string, label: string, identifiedName?: string): SpeakerProfile {
  return { id, label, identifiedName };
}

function makeSegment(
  overrides: Partial<DiarizedSegment> & { text: string; speakerId: string },
): DiarizedSegment {
  return {
    startTime: 0,
    endTime: 5,
    confidence: 0.9,
    speakerLabel: 'Hablante 1',
    speakerConfidence: 0.9,
    ...overrides,
  };
}

function makeTranscription(
  segments: DiarizedSegment[],
  speakers: SpeakerProfile[],
  language: 'es' | 'en' = 'es',
): DiarizedTranscription {
  return { segments, speakers, language };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('NLPService', () => {
  let service: NLPService;

  beforeEach(() => {
    service = new NLPService();
    resetActionIdCounter();
  });

  describe('generateSummary()', () => {
    it('extracts topics from Spanish transcription with keyword matches', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Hablemos del presupuesto del proyecto', speakerId: 'speaker_1' }),
          makeSegment({ text: 'Los costos están por encima del límite', speakerId: 'speaker_2' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1'), makeSpeaker('speaker_2', 'Hablante 2')],
        'es',
      );

      const summary = await service.generateSummary(transcription);

      expect(summary.language).toBe('es');
      expect(summary.topics.length).toBeGreaterThanOrEqual(1);
      expect(summary.topics).toContain('Presupuesto');
    });

    it('extracts topics from English transcription', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Let us discuss the budget and timeline', speakerId: 'speaker_1' }),
        ],
        [makeSpeaker('speaker_1', 'Speaker 1')],
        'en',
      );

      const summary = await service.generateSummary(transcription);

      expect(summary.language).toBe('en');
      expect(summary.topics).toContain('Budget');
      expect(summary.topics).toContain('Deadlines');
    });

    it('returns a fallback topic when no keywords match (Spanish)', async () => {
      const transcription = makeTranscription(
        [makeSegment({ text: 'Hola a todos, bienvenidos', speakerId: 'speaker_1' })],
        [makeSpeaker('speaker_1', 'Hablante 1')],
        'es',
      );

      const summary = await service.generateSummary(transcription);

      expect(summary.topics.length).toBeGreaterThanOrEqual(1);
      expect(summary.topics).toContain('Discusión general');
    });

    it('returns a fallback topic when no keywords match (English)', async () => {
      const transcription = makeTranscription(
        [makeSegment({ text: 'Hello everyone, welcome', speakerId: 'speaker_1' })],
        [makeSpeaker('speaker_1', 'Speaker 1')],
        'en',
      );

      const summary = await service.generateSummary(transcription);

      expect(summary.topics).toContain('General discussion');
    });

    it('extracts key points from segments containing key phrases', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Esto es muy importante para el equipo', speakerId: 'speaker_1' }),
          makeSegment({ text: 'Nada relevante aquí', speakerId: 'speaker_2' }),
          makeSegment({ text: 'La decisión final fue aprobada', speakerId: 'speaker_1' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1'), makeSpeaker('speaker_2', 'Hablante 2')],
        'es',
      );

      const summary = await service.generateSummary(transcription);

      expect(summary.keyPoints.length).toBe(2);
      expect(summary.keyPoints[0]).toContain('importante');
      expect(summary.keyPoints[1]).toContain('decisión');
    });
  });

  describe('extractActionItems()', () => {
    it('extracts action items from Spanish text patterns', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Necesitamos revisar el documento antes del viernes', speakerId: 'speaker_1' }),
          makeSegment({ text: 'Esto no tiene acción', speakerId: 'speaker_2' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1'), makeSpeaker('speaker_2', 'Hablante 2')],
        'es',
      );

      const items = await service.extractActionItems(transcription);

      expect(items.length).toBe(1);
      expect(items[0].description).toContain('revisar el documento');
      expect(items[0].assignedTo).toBe('speaker_1');
      expect(items[0].assignedToLabel).toBe('Hablante 1');
    });

    it('extracts action items from English text patterns', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'We need to update the roadmap by Monday', speakerId: 'speaker_1' }),
        ],
        [makeSpeaker('speaker_1', 'Speaker 1')],
        'en',
      );

      const items = await service.extractActionItems(transcription);

      expect(items.length).toBe(1);
      expect(items[0].description).toContain('update the roadmap');
      expect(items[0].assignedTo).toBe('speaker_1');
    });

    it('assigns action to speaker with identified name when available', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Me comprometo a enviar el reporte', speakerId: 'speaker_1' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1', 'María')],
        'es',
      );

      const items = await service.extractActionItems(transcription);

      expect(items.length).toBe(1);
      expect(items[0].assignedTo).toBe('speaker_1');
      expect(items[0].assignedToLabel).toBe('María');
    });

    it('marks action as "Sin asignar" when speaker is not in speakers list', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Hay que preparar la presentación', speakerId: 'speaker_unknown' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1')], // speaker_unknown not in list
        'es',
      );

      const items = await service.extractActionItems(transcription);

      expect(items.length).toBe(1);
      expect(items[0].assignedTo).toBe(UNASSIGNED_SPEAKER_ID);
      expect(items[0].assignedToLabel).toBe(UNASSIGNED_SPEAKER_LABEL);
    });

    it('returns empty array when no action patterns match', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Hola a todos', speakerId: 'speaker_1' }),
          makeSegment({ text: 'Bienvenidos a la reunión', speakerId: 'speaker_2' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1'), makeSpeaker('speaker_2', 'Hablante 2')],
        'es',
      );

      const items = await service.extractActionItems(transcription);

      expect(items).toEqual([]);
    });

    it('generates unique IDs for each action item', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Necesitamos hacer A', speakerId: 'speaker_1' }),
          makeSegment({ text: 'Debemos hacer B', speakerId: 'speaker_2' }),
          makeSegment({ text: 'Hay que hacer C', speakerId: 'speaker_1' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1'), makeSpeaker('speaker_2', 'Hablante 2')],
        'es',
      );

      const items = await service.extractActionItems(transcription);

      expect(items.length).toBe(3);
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('StubNLPBackend', () => {
    it('detects multiple Spanish action patterns', () => {
      const backend = new StubNLPBackend();
      const segments: DiarizedSegment[] = [
        makeSegment({ text: 'Por favor enviar el informe', speakerId: 'speaker_1' }),
        makeSegment({ text: 'Queda pendiente la revisión', speakerId: 'speaker_2' }),
        makeSegment({ text: 'Voy a preparar la agenda', speakerId: 'speaker_1' }),
      ];

      const items = backend.detectActionItems(segments, 'es');

      expect(items.length).toBe(3);
    });

    it('detects multiple English action patterns', () => {
      const backend = new StubNLPBackend();
      const segments: DiarizedSegment[] = [
        makeSegment({ text: "I'll send the report tomorrow", speakerId: 'speaker_1' }),
        makeSegment({ text: "Let's schedule a follow-up", speakerId: 'speaker_2' }),
      ];

      const items = backend.detectActionItems(segments, 'en');

      expect(items.length).toBe(2);
    });
  });

  describe('generateMinutes()', () => {
    it('generates formal minutes with all four required sections in Spanish', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Hablemos del presupuesto del proyecto', speakerId: 'speaker_1' }),
          makeSegment({ text: 'Se decidió aprobar el presupuesto', speakerId: 'speaker_2' }),
          makeSegment({ text: 'Necesitamos enviar el reporte', speakerId: 'speaker_1' }),
        ],
        [makeSpeaker('speaker_1', 'Hablante 1'), makeSpeaker('speaker_2', 'Hablante 2')],
        'es',
      );

      const summary = await service.generateSummary(transcription);
      const actions = await service.extractActionItems(transcription);
      const minutes = await service.generateMinutes(transcription, summary, actions);

      expect(minutes.language).toBe('es');
      expect(minutes.attendees).toHaveLength(2);
      expect(minutes.topicsDiscussed.length).toBeGreaterThanOrEqual(1);
      expect(minutes.decisions.length).toBeGreaterThanOrEqual(1);
      expect(minutes.decisions[0]).toContain('aprobar el presupuesto');
      expect(minutes.actionItems).toEqual(actions);
      expect(minutes.title).toContain('Acta');
      expect(minutes.date).toBeInstanceOf(Date);
    });

    it('generates formal minutes in English matching transcription language', async () => {
      const transcription = makeTranscription(
        [
          makeSegment({ text: 'Let us discuss the budget', speakerId: 'speaker_1' }),
          makeSegment({ text: 'We decided to increase the budget', speakerId: 'speaker_2' }),
        ],
        [makeSpeaker('speaker_1', 'Speaker 1'), makeSpeaker('speaker_2', 'Speaker 2')],
        'en',
      );

      const summary = await service.generateSummary(transcription);
      const actions = await service.extractActionItems(transcription);
      const minutes = await service.generateMinutes(transcription, summary, actions);

      expect(minutes.language).toBe('en');
      expect(minutes.title).toContain('Minutes');
      expect(minutes.attendees).toHaveLength(2);
      expect(minutes.decisions.length).toBeGreaterThanOrEqual(1);
    });

    it('attendees correspond to transcription speakers', async () => {
      const speakers = [
        makeSpeaker('speaker_1', 'María', 'María'),
        makeSpeaker('speaker_2', 'Juan', 'Juan'),
      ];
      const transcription = makeTranscription(
        [makeSegment({ text: 'Hola a todos', speakerId: 'speaker_1' })],
        speakers,
        'es',
      );

      const summary = await service.generateSummary(transcription);
      const minutes = await service.generateMinutes(transcription, summary, []);

      expect(minutes.attendees).toEqual(speakers);
    });
  });

  describe('pluggable backend', () => {
    it('uses a custom backend when provided', async () => {
      const customBackend: import('./nlp-service').NLPBackend = {
        extractTopics: () => ['Custom Topic'],
        extractKeyPoints: () => ['Custom Key Point'],
        detectActionItems: () => [{ description: 'Custom action', segmentIndex: 0 }],
        detectDecisions: () => ['Custom decision'],
      };

      const customService = new NLPService(customBackend);
      const transcription = makeTranscription(
        [makeSegment({ text: 'anything', speakerId: 'speaker_1' })],
        [makeSpeaker('speaker_1', 'Speaker 1')],
        'en',
      );

      const summary = await customService.generateSummary(transcription);
      expect(summary.topics).toEqual(['Custom Topic']);
      expect(summary.keyPoints).toEqual(['Custom Key Point']);

      const items = await customService.extractActionItems(transcription);
      expect(items.length).toBe(1);
      expect(items[0].description).toBe('Custom action');
    });
  });
});

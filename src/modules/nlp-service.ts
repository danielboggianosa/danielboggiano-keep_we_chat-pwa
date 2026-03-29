/**
 * NLPService — generates meeting summaries, extracts action items,
 * and produces formal minutes from diarized transcriptions.
 *
 * Uses a pluggable NLPBackend interface so real NLP models can be
 * swapped in. Ships with a StubNLPBackend that uses keyword/pattern
 * matching for topic extraction and action item detection.
 *
 * Implements the NLPService interface from the design doc.
 * Covers Requirements: 5.1, 5.2, 5.3, 5.5
 */

import type {
  DiarizedTranscription,
  DiarizedSegment,
  SpeakerProfile,
} from '../types/transcription';
import type { MeetingSummary, ActionItem, FormalMinutes } from '../types/nlp';

// ── Constants ──────────────────────────────────────────────────────

export const UNASSIGNED_SPEAKER_ID = 'unassigned';
export const UNASSIGNED_SPEAKER_LABEL = 'Sin asignar';

// ── Pluggable backend interface ────────────────────────────────────

/**
 * Interface that a real NLP backend must implement.
 * The NLPService delegates text analysis to whatever backend is provided.
 */
export interface NLPBackend {
  /** Extract topic strings from the full text of a transcription. */
  extractTopics(segments: DiarizedSegment[], language: 'es' | 'en'): string[];

  /** Extract key discussion points from the transcription. */
  extractKeyPoints(segments: DiarizedSegment[], language: 'es' | 'en'): string[];

  /**
   * Detect action items from segments.
   * Returns raw detections with the segment index where each was found.
   */
  detectActionItems(
    segments: DiarizedSegment[],
    language: 'es' | 'en',
  ): Array<{ description: string; segmentIndex: number }>;

  /** Extract decision strings from the transcription segments. */
  detectDecisions(segments: DiarizedSegment[], language: 'es' | 'en'): string[];
}

// ── Stub backend (keyword / pattern matching) ──────────────────────

/**
 * Topic keyword dictionaries for Spanish and English.
 * Maps keywords found in text to canonical topic labels.
 */
const TOPIC_KEYWORDS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    presupuesto: 'Presupuesto',
    costo: 'Costos',
    costos: 'Costos',
    gasto: 'Costos',
    proyecto: 'Proyecto',
    plazo: 'Plazos',
    plazos: 'Plazos',
    fecha: 'Plazos',
    deadline: 'Plazos',
    diseño: 'Diseño',
    cliente: 'Cliente',
    clientes: 'Cliente',
    equipo: 'Equipo',
    estrategia: 'Estrategia',
    marketing: 'Marketing',
    ventas: 'Ventas',
    producto: 'Producto',
    desarrollo: 'Desarrollo',
    tecnología: 'Tecnología',
    problema: 'Problemas',
    riesgo: 'Riesgos',
    contrato: 'Contratos',
  },
  en: {
    budget: 'Budget',
    cost: 'Costs',
    costs: 'Costs',
    expense: 'Costs',
    project: 'Project',
    deadline: 'Deadlines',
    timeline: 'Deadlines',
    schedule: 'Deadlines',
    design: 'Design',
    client: 'Client',
    clients: 'Client',
    team: 'Team',
    strategy: 'Strategy',
    marketing: 'Marketing',
    sales: 'Sales',
    product: 'Product',
    development: 'Development',
    technology: 'Technology',
    issue: 'Issues',
    risk: 'Risks',
    contract: 'Contracts',
  },
};

/**
 * Patterns that detect action items in segment text.
 * Each pattern captures the action description.
 */
const ACTION_PATTERNS: Record<'es' | 'en', RegExp[]> = {
  es: [
    /\b(?:hay que|necesitamos|debemos|tenemos que|se debe|se necesita)\s+(.+)/i,
    /\b(?:me comprometo a|voy a|me encargo de)\s+(.+)/i,
    /\b(?:por favor|favor)\s+(.+)/i,
    /\b(?:tarea|acción|pendiente|accionable):\s*(.+)/i,
    /\b(?:queda pendiente)\s+(.+)/i,
  ],
  en: [
    /\b(?:we need to|we should|we must|we have to|need to)\s+(.+)/i,
    /\b(?:I will|I'll|I'm going to|I am going to)\s+(.+)/i,
    /\b(?:please)\s+(.+)/i,
    /\b(?:action item|task|todo|to-do):\s*(.+)/i,
    /\b(?:let's)\s+(.+)/i,
  ],
};

/**
 * Patterns that detect decisions in segment text.
 */
const DECISION_PATTERNS: Record<'es' | 'en', RegExp[]> = {
  es: [
    /\b(?:se decidió|decidimos|se acordó|acordamos|se aprobó|aprobamos)\s+(.+)/i,
    /\b(?:la decisión es|la decisión fue)\s+(.+)/i,
    /\b(?:queda aprobado|queda decidido)\s+(.+)/i,
    /\b(?:se resolvió|resolvimos)\s+(.+)/i,
  ],
  en: [
    /\b(?:we decided|it was decided|we agreed|it was agreed)\s+(.+)/i,
    /\b(?:the decision is|the decision was)\s+(.+)/i,
    /\b(?:we resolved|it was resolved|we approved)\s+(.+)/i,
    /\b(?:let's go with|we'll go with)\s+(.+)/i,
  ],
};

/**
 * Stub NLP backend that uses keyword matching for topics and
 * regex patterns for action item detection.
 */
export class StubNLPBackend implements NLPBackend {
  extractTopics(segments: DiarizedSegment[], language: 'es' | 'en'): string[] {
    const keywords = TOPIC_KEYWORDS[language];
    const foundTopics = new Set<string>();

    for (const segment of segments) {
      const words = segment.text.toLowerCase().split(/\s+/);
      for (const word of words) {
        // Strip common punctuation for matching
        const clean = word.replace(/[.,;:!?()]/g, '');
        if (keywords[clean]) {
          foundTopics.add(keywords[clean]);
        }
      }
    }

    return Array.from(foundTopics);
  }

  extractKeyPoints(segments: DiarizedSegment[], language: 'es' | 'en'): string[] {
    const keyPoints: string[] = [];
    const keyPhrases =
      language === 'es'
        ? ['importante', 'clave', 'decisión', 'acordamos', 'conclusión', 'resumen']
        : ['important', 'key', 'decision', 'agreed', 'conclusion', 'summary'];

    for (const segment of segments) {
      const lower = segment.text.toLowerCase();
      if (keyPhrases.some((phrase) => lower.includes(phrase))) {
        keyPoints.push(segment.text.trim());
      }
    }

    return keyPoints;
  }

  detectActionItems(
    segments: DiarizedSegment[],
    language: 'es' | 'en',
  ): Array<{ description: string; segmentIndex: number }> {
    const patterns = ACTION_PATTERNS[language];
    const items: Array<{ description: string; segmentIndex: number }> = [];

    for (let i = 0; i < segments.length; i++) {
      const text = segments[i].text;
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
          items.push({
            description: match[1].trim(),
            segmentIndex: i,
          });
          break; // one action per segment
        }
      }
    }

    return items;
  }

  detectDecisions(segments: DiarizedSegment[], language: 'es' | 'en'): string[] {
    const patterns = DECISION_PATTERNS[language];
    const decisions: string[] = [];

    for (const segment of segments) {
      for (const pattern of patterns) {
        const match = segment.text.match(pattern);
        if (match?.[1]) {
          decisions.push(match[1].trim());
          break;
        }
      }
    }

    return decisions;
  }
}

// ── Main service ───────────────────────────────────────────────────

let nextActionId = 1;

/** Generate a unique action item ID. */
function generateActionId(): string {
  return `action_${nextActionId++}`;
}

/** Reset the action ID counter (useful for testing). */
export function resetActionIdCounter(): void {
  nextActionId = 1;
}

export class NLPService {
  private backend: NLPBackend;

  constructor(backend?: NLPBackend) {
    this.backend = backend ?? new StubNLPBackend();
  }

  /**
   * Generate a meeting summary with topics and key points.
   *
   * Always returns at least one topic — if the backend finds none,
   * a generic "General discussion" / "Discusión general" topic is added.
   *
   * Validates: Requirements 5.1
   */
  async generateSummary(transcription: DiarizedTranscription): Promise<MeetingSummary> {
    const { segments, language } = transcription;

    const topics = this.backend.extractTopics(segments, language);
    const keyPoints = this.backend.extractKeyPoints(segments, language);

    // Guarantee at least one topic (Property 5 requirement)
    if (topics.length === 0) {
      topics.push(language === 'es' ? 'Discusión general' : 'General discussion');
    }

    return { topics, keyPoints, language };
  }

  /**
   * Extract action items from the transcription and assign each to
   * the speaker of the segment where it was detected.
   *
   * When the speaker cannot be determined (speakerId is unknown or
   * the segment has no clear speaker), the action is marked as
   * `assignedTo: "unassigned"` with `assignedToLabel: "Sin asignar"`.
   *
   * Validates: Requirements 5.2, 5.3, 5.5
   */
  /**
   * Generate formal minutes from a transcription, summary, and action items.
   * The minutes language matches the transcription's language.
   *
   * Validates: Requirements 6.1, 6.2
   */
  async generateMinutes(
    transcription: DiarizedTranscription,
    summary: MeetingSummary,
    actions: ActionItem[],
  ): Promise<FormalMinutes> {
    const { segments, speakers, language } = transcription;

    const decisions = this.backend.detectDecisions(segments, language);

    const title = summary.topics.length > 0
      ? (language === 'es' ? `Acta: ${summary.topics[0]}` : `Minutes: ${summary.topics[0]}`)
      : (language === 'es' ? 'Acta de reunión' : 'Meeting Minutes');

    return {
      title,
      date: new Date(),
      attendees: speakers,
      topicsDiscussed: summary.topics,
      decisions,
      actionItems: actions,
      language,
    };
  }

  async extractActionItems(transcription: DiarizedTranscription): Promise<ActionItem[]> {
    const { segments, speakers, language } = transcription;

    const rawItems = this.backend.detectActionItems(segments, language);

    // Build a quick lookup: speakerId → SpeakerProfile
    const speakerMap = new Map<string, SpeakerProfile>();
    for (const sp of speakers) {
      speakerMap.set(sp.id, sp);
    }

    return rawItems.map((raw) => {
      const segment = segments[raw.segmentIndex];
      const speaker = segment ? speakerMap.get(segment.speakerId) : undefined;

      const isAssignable = speaker !== undefined;

      return {
        id: generateActionId(),
        description: raw.description,
        assignedTo: isAssignable ? speaker.id : UNASSIGNED_SPEAKER_ID,
        assignedToLabel: isAssignable
          ? (speaker.identifiedName ?? speaker.label)
          : UNASSIGNED_SPEAKER_LABEL,
        sourceSegmentId: segment?.speakerId,
      };
    });
  }
}

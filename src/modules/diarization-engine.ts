/**
 * DiarizationEngine — assigns speaker identities to transcription segments
 * using a pluggable diarization backend.
 *
 * Implements the DiarizationEngine interface from the design doc.
 * Covers Requirements: 3.1, 3.2, 3.3, 3.4
 */

import type { AudioFile } from '../types/audio';
import type {
  TranscriptionSegment,
  DiarizedSegment,
  DiarizedTranscription,
  SpeakerProfile,
} from '../types/transcription';

// ── Error types ────────────────────────────────────────────────────

export type DiarizationErrorCode =
  | 'NO_SEGMENTS'
  | 'DIARIZATION_FAILED';

export class DiarizationError extends Error {
  constructor(
    message: string,
    public readonly code: DiarizationErrorCode,
  ) {
    super(message);
    this.name = 'DiarizationError';
  }
}

// ── Constants ──────────────────────────────────────────────────────

export const LOW_CONFIDENCE_THRESHOLD = 0.5;
export const UNKNOWN_SPEAKER_ID = 'speaker_unknown';
export const UNKNOWN_SPEAKER_LABEL = 'Hablante no identificado';

// ── Pluggable backend interface ────────────────────────────────────

/**
 * Interface that a real diarization backend must implement.
 * The DiarizationEngine delegates speaker assignment to whatever
 * backend is provided.
 */
export interface DiarizationBackend {
  /**
   * Assign a speaker ID and confidence to each segment.
   * Returns an array parallel to the input segments with speaker info.
   */
  assignSpeakers(
    audio: AudioFile,
    segments: TranscriptionSegment[],
  ): Promise<Array<{ speakerId: string; confidence: number }>>;
}

// ── Stub backend ───────────────────────────────────────────────────

/**
 * Simulates speaker assignment based on segment index patterns.
 * Cycles through a configurable number of speakers so the rest of
 * the pipeline can be developed and tested.
 */
export class StubDiarizationBackend implements DiarizationBackend {
  constructor(private speakerCount: number = 3) {}

  async assignSpeakers(
    _audio: AudioFile,
    segments: TranscriptionSegment[],
  ): Promise<Array<{ speakerId: string; confidence: number }>> {
    return segments.map((seg, index) => ({
      speakerId: `speaker_${(index % this.speakerCount) + 1}`,
      confidence: seg.confidence, // mirror segment confidence as speaker confidence
    }));
  }
}

// ── Verbal name detection ──────────────────────────────────────────

/**
 * Patterns that detect verbal self-identification in segment text.
 * Supports Spanish and English common patterns.
 */
const NAME_PATTERNS: RegExp[] = [
  // Spanish patterns
  /\b(?:hola|buenos días|buenas tardes|buenas noches)?\s*,?\s*soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
  /\bmi nombre es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
  /\bme llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
  // English patterns
  /\b(?:hi|hello|hey)?\s*,?\s*I'?m\s+([A-Z][a-z]+)/i,
  /\bmy name is\s+([A-Z][a-z]+)/i,
];

/**
 * Attempts to extract a speaker name from segment text.
 * Returns the name if found, undefined otherwise.
 */
export function detectVerbalName(text: string): string | undefined {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

// ── Main engine ────────────────────────────────────────────────────

export class DiarizationEngine {
  private backend: DiarizationBackend;

  constructor(backend?: DiarizationBackend) {
    this.backend = backend ?? new StubDiarizationBackend();
  }

  /**
   * Diarize transcription segments: assign speaker IDs, labels,
   * detect verbal names, and handle low-confidence segments.
   *
   * @throws {DiarizationError} NO_SEGMENTS – input has no segments
   */
  async diarize(
    audio: AudioFile,
    segments: TranscriptionSegment[],
  ): Promise<DiarizedTranscription> {
    if (segments.length === 0) {
      throw new DiarizationError(
        'Cannot diarize: no transcription segments provided.',
        'NO_SEGMENTS',
      );
    }

    // Step 1: Get raw speaker assignments from backend
    const assignments = await this.backend.assignSpeakers(audio, segments);

    // Step 2: Build initial diarized segments with default labels
    const speakerIndexMap = new Map<string, number>(); // speakerId → display number
    let nextSpeakerNumber = 1;

    const diarizedSegments: DiarizedSegment[] = segments.map((seg, i) => {
      const assignment = assignments[i];
      const isLowConfidence = assignment.confidence < LOW_CONFIDENCE_THRESHOLD;

      const speakerId = isLowConfidence ? UNKNOWN_SPEAKER_ID : assignment.speakerId;
      const speakerConfidence = assignment.confidence;

      // Assign a display number to each unique speaker
      if (!isLowConfidence && !speakerIndexMap.has(speakerId)) {
        speakerIndexMap.set(speakerId, nextSpeakerNumber++);
      }

      const displayNumber = speakerIndexMap.get(speakerId);
      const speakerLabel = isLowConfidence
        ? UNKNOWN_SPEAKER_LABEL
        : `Hablante ${displayNumber}`;

      return {
        ...seg,
        speakerId,
        speakerLabel,
        speakerConfidence,
      };
    });

    // Step 3: Detect verbal names and propagate forward
    const identifiedNames = new Map<string, string>(); // speakerId → name

    for (const segment of diarizedSegments) {
      if (segment.speakerId === UNKNOWN_SPEAKER_ID) continue;

      // Check if this segment contains a verbal name identification
      const name = detectVerbalName(segment.text);
      if (name && !identifiedNames.has(segment.speakerId)) {
        identifiedNames.set(segment.speakerId, name);
      }

      // Apply identified name if available
      const knownName = identifiedNames.get(segment.speakerId);
      if (knownName) {
        segment.speakerLabel = knownName;
      }
    }

    // Step 4: Build speaker profiles
    const speakers: SpeakerProfile[] = [];

    for (const [speakerId, displayNumber] of speakerIndexMap) {
      const identifiedName = identifiedNames.get(speakerId);
      speakers.push({
        id: speakerId,
        label: identifiedName ?? `Hablante ${displayNumber}`,
        identifiedName,
      });
    }

    return {
      segments: diarizedSegments,
      speakers,
      language: audio.language,
    };
  }
}

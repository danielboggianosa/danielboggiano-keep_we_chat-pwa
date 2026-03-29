/**
 * Types for speech-to-text transcription and speaker diarization.
 * Used by LocalSTTEngine and DiarizationEngine.
 */

export interface TranscriptionSegment {
  startTime: number;  // seconds
  endTime: number;    // seconds
  text: string;
  confidence: number; // 0-1
}

export interface RawTranscription {
  segments: TranscriptionSegment[];
  language: 'es' | 'en';
  duration: number;
}

export interface DiarizedSegment extends TranscriptionSegment {
  speakerId: string;        // "speaker_1", "speaker_2", etc.
  speakerLabel: string;     // Name if identified, or "Hablante 1"
  speakerConfidence: number;
}

export interface DiarizedTranscription {
  segments: DiarizedSegment[];
  speakers: SpeakerProfile[];
  language: 'es' | 'en';
}

export interface SpeakerProfile {
  id: string;
  label: string;            // "Hablante 1" or identified name
  identifiedName?: string;  // Name extracted from audio ("Hola, soy María")
}

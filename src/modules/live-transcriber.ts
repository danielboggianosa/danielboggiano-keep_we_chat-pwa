/**
 * LiveTranscriber — Real-time speech-to-text using the Web Speech API.
 *
 * Uses SpeechRecognition (available in Chrome, Edge, Safari) to provide
 * live transcription during recording. Collects finalized segments with
 * timestamps that can be fed into the diarization/NLP pipeline.
 */

import type { TranscriptionSegment } from '../types/transcription';

export interface LiveSegment {
  text: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface LiveTranscriberCallbacks {
  onInterim: (text: string) => void;
  onSegment: (segment: LiveSegment) => void;
  onError: (error: string) => void;
}

// Extend Window for vendor-prefixed SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export class LiveTranscriber {
  private recognition: any = null;
  private isRunning = false;
  private startTimestamp = 0;
  private segments: TranscriptionSegment[] = [];
  private segmentStartTime = 0;
  private callbacks: LiveTranscriberCallbacks;
  private language: string;

  constructor(language: 'es' | 'en', callbacks: LiveTranscriberCallbacks) {
    this.language = language === 'es' ? 'es-ES' : 'en-US';
    this.callbacks = callbacks;
  }

  /** Check if Web Speech API is available in this browser. */
  static isSupported(): boolean {
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  /** Start live transcription. */
  start(): void {
    if (this.isRunning) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.callbacks.onError('Web Speech API no disponible en este navegador');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;
    this.recognition.maxAlternatives = 1;

    this.startTimestamp = Date.now();
    this.segmentStartTime = 0;
    this.segments = [];
    this.isRunning = true;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = (Date.now() - this.startTimestamp) / 1000;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        if (!text) continue;

        if (result.isFinal) {
          const segment: TranscriptionSegment = {
            startTime: this.segmentStartTime,
            endTime: now,
            text,
            confidence: result[0].confidence || 0.85,
          };
          this.segments.push(segment);
          this.segmentStartTime = now;

          this.callbacks.onSegment({
            text,
            startTime: segment.startTime,
            endTime: segment.endTime,
            isFinal: true,
          });
        } else {
          this.callbacks.onInterim(text);
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      // 'no-speech' is normal, don't treat as error
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      this.callbacks.onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onend = () => {
      // Auto-restart if still supposed to be running
      if (this.isRunning) {
        try {
          this.recognition.start();
        } catch {
          // Already started or disposed
        }
      }
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.callbacks.onError(`No se pudo iniciar el reconocimiento de voz: ${err}`);
    }
  }

  /** Stop live transcription and return all collected segments. */
  stop(): TranscriptionSegment[] {
    this.isRunning = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Already stopped
      }
      this.recognition = null;
    }
    return [...this.segments];
  }

  /** Get segments collected so far without stopping. */
  getSegments(): TranscriptionSegment[] {
    return [...this.segments];
  }
}

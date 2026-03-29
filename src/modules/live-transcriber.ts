/**
 * LiveTranscriber — Real-time speech-to-text using the Web Speech API.
 *
 * Uses SpeechRecognition (Chrome/Edge/Safari) for live transcription.
 * Falls back gracefully when the API is unavailable or network fails.
 *
 * NOTE: Chrome's Web Speech API sends audio to Google servers.
 * It requires internet access and works on localhost or HTTPS origins.
 * If running through Docker/nginx proxy, use `npm run dev` (Vite) instead.
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

export class LiveTranscriber {
  private recognition: any = null;
  private isRunning = false;
  private startTimestamp = 0;
  private segments: TranscriptionSegment[] = [];
  private segmentStartTime = 0;
  private callbacks: LiveTranscriberCallbacks;
  private language: string;
  private consecutiveErrors = 0;
  private static readonly MAX_CONSECUTIVE_ERRORS = 3;

  constructor(language: 'es' | 'en', callbacks: LiveTranscriberCallbacks) {
    this.language = language === 'es' ? 'es-ES' : 'en-US';
    this.callbacks = callbacks;
  }

  static isSupported(): boolean {
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  start(): void {
    if (this.isRunning) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.callbacks.onError('Web Speech API no disponible');
      return;
    }

    this.startTimestamp = Date.now();
    this.segmentStartTime = 0;
    this.segments = [];
    this.consecutiveErrors = 0;
    this.isRunning = true;

    this.createAndStartRecognition(SpeechRecognition);
  }

  private createAndStartRecognition(SpeechRecognition: any): void {
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.language;
    rec.maxAlternatives = 1;
    this.recognition = rec;

    rec.onresult = (event: any) => {
      // Reset error counter on successful result
      this.consecutiveErrors = 0;
      const now = (Date.now() - this.startTimestamp) / 1000;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          const segment: TranscriptionSegment = {
            startTime: this.segmentStartTime,
            endTime: now,
            text: transcript,
            confidence: result[0].confidence || 0.85,
          };
          this.segments.push(segment);
          this.segmentStartTime = now;
          this.callbacks.onSegment({
            text: transcript,
            startTime: segment.startTime,
            endTime: segment.endTime,
            isFinal: true,
          });
        } else {
          this.callbacks.onInterim(transcript);
        }
      }
    };

    rec.onerror = (event: any) => {
      const err = event.error;
      if (err === 'aborted') return;

      if (err === 'no-speech') {
        // Normal — no speech detected, will auto-restart via onend
        return;
      }

      this.consecutiveErrors++;
      console.warn(`[LiveTranscriber] Error (${this.consecutiveErrors}/${LiveTranscriber.MAX_CONSECUTIVE_ERRORS}):`, err);

      if (err === 'network' || err === 'service-not-allowed' || err === 'not-allowed') {
        // Fatal errors — stop trying
        this.isRunning = false;
        this.callbacks.onError(
          err === 'network'
            ? 'Sin conexión al servicio de voz. La transcripción en vivo no está disponible.'
            : `Permiso denegado: ${err}`
        );
        return;
      }

      // For other errors, stop if too many consecutive
      if (this.consecutiveErrors >= LiveTranscriber.MAX_CONSECUTIVE_ERRORS) {
        this.isRunning = false;
        this.callbacks.onError(`Demasiados errores consecutivos: ${err}`);
      }
    };

    rec.onend = () => {
      if (this.isRunning) {
        // Auto-restart (Chrome stops after silence or after each result batch)
        try {
          setTimeout(() => {
            if (this.isRunning) {
              this.createAndStartRecognition(SpeechRecognition);
            }
          }, 300);
        } catch { /* ok */ }
      }
    };

    try {
      rec.start();
    } catch (err) {
      this.isRunning = false;
      this.callbacks.onError(`No se pudo iniciar: ${err}`);
    }
  }

  stop(): TranscriptionSegment[] {
    this.isRunning = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ok */ }
      this.recognition = null;
    }
    return [...this.segments];
  }

  getSegments(): TranscriptionSegment[] {
    return [...this.segments];
  }
}

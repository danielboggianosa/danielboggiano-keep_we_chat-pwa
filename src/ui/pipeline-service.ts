/**
 * PipelineService — Orchestrates the full recording → processing → storage pipeline.
 *
 * Uses LiveTranscriber (Web Speech API) for real-time transcription during recording.
 * On stop: takes the live segments → Diarization → NLP → IndexedDB.
 * Falls back to stub STT if Web Speech API is not available.
 */

import type { AudioFile } from '../types/audio';
import type { TranscriptionSegment, DiarizedTranscription } from '../types/transcription';
import type { MeetingSummary, ActionItem, FormalMinutes } from '../types/nlp';

import { AudioCaptureModule } from '../modules/audio-capture';
import { LocalSTTEngine } from '../modules/local-stt-engine';
import { DiarizationEngine } from '../modules/diarization-engine';
import { NLPService } from '../modules/nlp-service';
import { ExportService } from '../modules/export-service';
import { LiveTranscriber, type LiveSegment } from '../modules/live-transcriber';
import { dbPut, dbGetAll } from '../db/db-operations';
import { STORES } from '../db/indexed-db';
import type { StoredTranscription } from '../modules/cloud-reprocessor';

export interface ProcessingResult {
  transcriptionId: string;
  audioFile: AudioFile;
  transcription: DiarizedTranscription;
  summary: MeetingSummary;
  actionItems: ActionItem[];
  minutes: FormalMinutes;
}

export interface MeetingRecord {
  id: string;
  title: string;
  date: Date;
  duration: number;
  status: 'transcribed' | 'processing';
  transcription: DiarizedTranscription;
  summary: MeetingSummary;
  actionItems: ActionItem[];
  minutes: FormalMinutes;
}

export interface LiveTranscriptCallbacks {
  onInterim: (text: string) => void;
  onSegment: (segment: LiveSegment) => void;
}

export class PipelineService {
  readonly audioCapture = new AudioCaptureModule();
  private sttEngine: LocalSTTEngine;
  private diarization: DiarizationEngine;
  private nlpService: NLPService;
  readonly exportService = new ExportService();

  private meetings: MeetingRecord[] = [];
  private currentSessionId: string | null = null;
  private liveTranscriber: LiveTranscriber | null = null;
  private currentLanguage: 'es' | 'en' = 'es';

  constructor() {
    this.sttEngine = new LocalSTTEngine();
    this.diarization = new DiarizationEngine();
    this.nlpService = new NLPService();
  }

  async init(): Promise<void> {
    await this.sttEngine.loadModel();
    await this.loadMeetingsFromDB();
  }

  /**
   * Start recording + live transcription.
   * Returns session ID. Calls liveCallbacks with real-time transcript updates.
   */
  async startRecording(
    language: 'es' | 'en' = 'es',
    liveCallbacks?: LiveTranscriptCallbacks,
  ): Promise<string> {
    this.currentLanguage = language;

    const session = await this.audioCapture.startRecording({
      source: 'microphone',
      language,
    });
    this.currentSessionId = session.id;

    // Start live transcription if Web Speech API is available
    if (LiveTranscriber.isSupported()) {
      this.liveTranscriber = new LiveTranscriber(language, {
        onInterim: (text) => liveCallbacks?.onInterim(text),
        onSegment: (seg) => liveCallbacks?.onSegment(seg),
        onError: (err) => console.warn('LiveTranscriber:', err),
      });
      this.liveTranscriber.start();
    }

    return session.id;
  }

  get activeSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Stop recording and process.
   * Uses live transcription segments if available, falls back to stub STT.
   */
  async stopAndProcess(title?: string): Promise<ProcessingResult> {
    if (!this.currentSessionId) {
      throw new Error('No active recording session');
    }

    const sessionId = this.currentSessionId;
    this.currentSessionId = null;

    // 1. Collect live segments before stopping
    let liveSegments: TranscriptionSegment[] = [];
    if (this.liveTranscriber) {
      liveSegments = this.liveTranscriber.stop();
      this.liveTranscriber = null;
    }

    // 2. Stop audio recording → get AudioFile
    const audioFile = await this.audioCapture.stopRecording(sessionId);

    // 3. Get transcription segments: prefer live, fallback to stub STT
    let segments: TranscriptionSegment[];
    if (liveSegments.length > 0) {
      segments = liveSegments;
    } else {
      // Fallback: use stub STT engine
      const rawTranscription = await this.sttEngine.transcribe(audioFile);
      segments = rawTranscription.segments;
    }

    // 4. Diarization
    const transcription = await this.diarization.diarize(audioFile, segments);

    // 5. NLP
    const summary = await this.nlpService.generateSummary(transcription);
    const actionItems = await this.nlpService.extractActionItems(transcription);
    const minutes = await this.nlpService.generateMinutes(transcription, summary, actionItems);

    // 6. Persist to IndexedDB
    const stored: StoredTranscription = {
      id: audioFile.id,
      status: 'local',
      transcription,
      audioId: audioFile.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

    // 7. Add to in-memory meeting list
    const meetingTitle = title ?? `Reunión ${new Date().toLocaleString('es')}`;
    const record: MeetingRecord = {
      id: audioFile.id,
      title: meetingTitle,
      date: audioFile.recordedAt,
      duration: audioFile.duration,
      status: 'transcribed',
      transcription,
      summary,
      actionItems,
      minutes,
    };
    this.meetings.unshift(record);

    return {
      transcriptionId: audioFile.id,
      audioFile,
      transcription,
      summary,
      actionItems,
      minutes,
    };
  }

  getMeetings(): MeetingRecord[] {
    return this.meetings;
  }

  getMeeting(id: string): MeetingRecord | undefined {
    return this.meetings.find(m => m.id === id);
  }

  private async loadMeetingsFromDB(): Promise<void> {
    try {
      const stored = await dbGetAll<StoredTranscription>(STORES.TRANSCRIPTIONS);
      for (const s of stored) {
        const summary = await this.nlpService.generateSummary(s.transcription);
        const actionItems = await this.nlpService.extractActionItems(s.transcription);
        const minutes = await this.nlpService.generateMinutes(s.transcription, summary, actionItems);

        this.meetings.push({
          id: s.id,
          title: `Reunión ${new Date(s.createdAt).toLocaleString('es')}`,
          date: new Date(s.createdAt),
          duration: s.transcription.segments.length > 0
            ? s.transcription.segments[s.transcription.segments.length - 1].endTime
            : 0,
          status: 'transcribed',
          transcription: s.transcription,
          summary,
          actionItems,
          minutes,
        });
      }
      this.meetings.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch {
      // DB might not be available yet
    }
  }
}

/**
 * PipelineService — Orchestrates the full recording → processing → storage pipeline.
 * Audio → STT → Diarization → NLP → IndexedDB
 *
 * Initializes all modules with stub backends for local/offline operation.
 */

import type { AudioFile } from '../types/audio';
import type { DiarizedTranscription } from '../types/transcription';
import type { MeetingSummary, ActionItem, FormalMinutes } from '../types/nlp';

import { AudioCaptureModule } from '../modules/audio-capture';
import { LocalSTTEngine } from '../modules/local-stt-engine';
import { DiarizationEngine } from '../modules/diarization-engine';
import { NLPService } from '../modules/nlp-service';
import { ExportService } from '../modules/export-service';
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

export class PipelineService {
  readonly audioCapture = new AudioCaptureModule();
  private sttEngine: LocalSTTEngine;
  private diarization: DiarizationEngine;
  private nlpService: NLPService;
  readonly exportService = new ExportService();

  /** In-memory meeting records for quick UI access */
  private meetings: MeetingRecord[] = [];

  private currentSessionId: string | null = null;
  private recordingStartTime = 0;

  constructor() {
    this.sttEngine = new LocalSTTEngine();
    this.diarization = new DiarizationEngine();
    this.nlpService = new NLPService();
  }

  async init(): Promise<void> {
    await this.sttEngine.loadModel();
    await this.loadMeetingsFromDB();
  }

  /** Start a recording session. Returns session ID. */
  async startRecording(language: 'es' | 'en' = 'es'): Promise<string> {
    const session = await this.audioCapture.startRecording({
      source: 'microphone',
      language,
    });
    this.currentSessionId = session.id;
    this.recordingStartTime = Date.now();
    return session.id;
  }

  get activeSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Stop recording and run the full pipeline:
   * STT → Diarization → NLP Summary → Action Items → Minutes → IndexedDB
   */
  async stopAndProcess(title?: string): Promise<ProcessingResult> {
    if (!this.currentSessionId) {
      throw new Error('No active recording session');
    }

    const sessionId = this.currentSessionId;
    this.currentSessionId = null;

    // 1. Stop recording → get AudioFile
    const audioFile = await this.audioCapture.stopRecording(sessionId);

    // 2. STT → RawTranscription
    const rawTranscription = await this.sttEngine.transcribe(audioFile);

    // 3. Diarization → DiarizedTranscription
    const transcription = await this.diarization.diarize(audioFile, rawTranscription.segments);

    // 4. NLP → Summary + Action Items
    const summary = await this.nlpService.generateSummary(transcription);
    const actionItems = await this.nlpService.extractActionItems(transcription);

    // 5. NLP → Formal Minutes
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

  /** Get all meeting records (most recent first). */
  getMeetings(): MeetingRecord[] {
    return this.meetings;
  }

  /** Get a specific meeting by ID. */
  getMeeting(id: string): MeetingRecord | undefined {
    return this.meetings.find(m => m.id === id);
  }

  /** Load previously saved meetings from IndexedDB on startup. */
  private async loadMeetingsFromDB(): Promise<void> {
    try {
      const stored = await dbGetAll<StoredTranscription>(STORES.TRANSCRIPTIONS);
      for (const s of stored) {
        // Reconstruct meeting records from stored transcriptions
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
      // Sort most recent first
      this.meetings.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch {
      // DB might not be available yet, that's ok
    }
  }
}

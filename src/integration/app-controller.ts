/**
 * AppController — Central orchestrator that wires all modules together.
 *
 * Pipeline: AudioCapture → LocalSTT → Diarization → NLP → IndexedDB
 * Plus: SyncManager, CalendarService, SearchService, ExportService, EditService
 *
 * Requisitos: Todos
 */

import type { RecordingConfig, AudioFile } from '../types/audio';
import type { DiarizedTranscription } from '../types/transcription';
import type { MeetingSummary, ActionItem, FormalMinutes } from '../types/nlp';
import type { SearchQuery, SearchResult } from '../types/search';
import type { ExportFormat } from '../types/export';
import type { SyncResult } from '../types/sync';
import type { CalendarEvent } from '../types/calendar';

import { AudioCaptureModule } from '../modules/audio-capture';
import { LocalSTTEngine } from '../modules/local-stt-engine';
import { DiarizationEngine } from '../modules/diarization-engine';
import { NLPService } from '../modules/nlp-service';
import { SyncManager } from '../modules/sync-manager';
import { SearchService, type IndexedTranscription } from '../modules/search-service';
import { ExportService } from '../modules/export-service';
import { CalendarService, type RecordingStartResult } from '../modules/calendar-service';
import { UserService } from '../modules/user-service';
import { EditService } from '../modules/edit-service';
import { CloudReprocessor, type StoredTranscription } from '../modules/cloud-reprocessor';
import { dbPut } from '../db/db-operations';
import { STORES } from '../db/indexed-db';

// ── Result types ───────────────────────────────────────────────

export interface TranscriptionResult {
  transcriptionId: string;
  audioFile: AudioFile;
  transcription: DiarizedTranscription;
  summary: MeetingSummary;
  actionItems: ActionItem[];
}

export interface AppControllerDeps {
  audioCapture: AudioCaptureModule;
  sttEngine: LocalSTTEngine;
  diarization: DiarizationEngine;
  nlpService: NLPService;
  syncManager: SyncManager;
  searchService: SearchService;
  exportService: ExportService;
  calendarService: CalendarService;
  userService: UserService;
  editService: EditService;
  cloudReprocessor: CloudReprocessor;
}

// ── AppController ──────────────────────────────────────────────

export class AppController {
  private audioCapture: AudioCaptureModule;
  private sttEngine: LocalSTTEngine;
  private diarization: DiarizationEngine;
  private nlpService: NLPService;
  private syncManager: SyncManager;
  private searchService: SearchService;
  private exportService: ExportService;
  private calendarService: CalendarService;
  private userService: UserService;
  private editService: EditService;
  private cloudReprocessor: CloudReprocessor;

  /** Currently active recording session ID, if any. */
  private activeSessionId: string | null = null;

  constructor(deps: AppControllerDeps) {
    this.audioCapture = deps.audioCapture;
    this.sttEngine = deps.sttEngine;
    this.diarization = deps.diarization;
    this.nlpService = deps.nlpService;
    this.syncManager = deps.syncManager;
    this.searchService = deps.searchService;
    this.exportService = deps.exportService;
    this.calendarService = deps.calendarService;
    this.userService = deps.userService;
    this.editService = deps.editService;
    this.cloudReprocessor = deps.cloudReprocessor;
  }

  // ── Full pipeline: record → transcribe → diarize → NLP → store ──

  /**
   * Start a recording session. Returns the session ID.
   */
  async startRecording(config: RecordingConfig): Promise<string> {
    const session = await this.audioCapture.startRecording(config);
    this.activeSessionId = session.id;
    return session.id;
  }

  /**
   * Stop the active recording and run the full processing pipeline:
   * transcription → diarization → NLP summary + action items → IndexedDB storage.
   */
  async stopAndProcess(
    sessionId: string,
    ownerId: string,
    title?: string,
  ): Promise<TranscriptionResult> {
    const audioFile = await this.audioCapture.stopRecording(sessionId);
    this.activeSessionId = null;

    // STT
    const rawTranscription = await this.sttEngine.transcribe(audioFile);

    // Diarization
    const diarized = await this.diarization.diarize(audioFile, rawTranscription.segments);

    // NLP
    const summary = await this.nlpService.generateSummary(diarized);
    const actionItems = await this.nlpService.extractActionItems(diarized);

    // Persist to IndexedDB
    const transcriptionId = audioFile.id;
    const stored: StoredTranscription = {
      id: transcriptionId,
      status: 'local',
      transcription: diarized,
      audioId: audioFile.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await dbPut<StoredTranscription>(STORES.TRANSCRIPTIONS, stored);

    // Register ownership
    this.userService.registerTranscription(transcriptionId, ownerId);

    // Register segments for editing
    this.editService.registerSegments(
      transcriptionId,
      diarized.segments.map((s) => s.text),
    );

    // Index for search
    const meetingTitle = title ?? `Meeting ${new Date().toISOString()}`;
    const indexed: IndexedTranscription = {
      id: transcriptionId,
      ownerId,
      title: meetingTitle,
      language: diarized.language,
      recordedAt: audioFile.recordedAt,
      transcription: diarized,
    };
    this.searchService.index(indexed);

    // Enqueue for sync
    await this.syncManager.enqueue({
      type: 'transcription',
      localId: transcriptionId,
      data: diarized,
      priority: 1,
    });

    return {
      transcriptionId,
      audioFile,
      transcription: diarized,
      summary,
      actionItems,
    };
  }

  // ── Sync ─────────────────────────────────────────────────────

  /**
   * Trigger synchronization of all pending items.
   */
  async syncAll(): Promise<SyncResult> {
    return this.syncManager.syncPending();
  }

  /**
   * Trigger cloud reprocessing for a synced transcription.
   */
  async reprocess(transcriptionId: string): Promise<StoredTranscription> {
    return this.cloudReprocessor.onSynced(transcriptionId);
  }

  // ── Calendar auto-start ──────────────────────────────────────

  /**
   * Check upcoming calendar events and return auto-start suggestions.
   */
  async checkCalendarAutoStart(
    userId: string,
    now?: Date,
  ): Promise<RecordingStartResult[]> {
    const events = await this.calendarService.getUpcomingEvents(userId);
    const notifications = this.calendarService.checkAndNotify(events, now);

    return notifications.map((n) => {
      const event = events.find((e) => e.id === n.eventId)!;
      return this.calendarService.startRecordingForEvent(event);
    });
  }

  // ── Search ───────────────────────────────────────────────────

  /**
   * Search transcriptions with access control.
   */
  search(query: SearchQuery): SearchResult[] {
    return this.searchService.search(query);
  }

  // ── Export ───────────────────────────────────────────────────

  /**
   * Export a transcription in the specified format.
   */
  exportTranscription(
    transcription: DiarizedTranscription,
    format: ExportFormat,
  ): string {
    return this.exportService.export(transcription, format);
  }

  // ── Edit ─────────────────────────────────────────────────────

  /**
   * Edit a segment of a transcription (with permission enforcement).
   */
  editSegment(
    transcriptionId: string,
    segmentIndex: number,
    newText: string,
    userId: string,
  ): void {
    this.editService.editSegment(transcriptionId, segmentIndex, newText, userId);
  }

  // ── Minutes ──────────────────────────────────────────────────

  /**
   * Generate formal minutes for a transcription.
   */
  async generateMinutes(
    transcription: DiarizedTranscription,
    summary: MeetingSummary,
    actionItems: ActionItem[],
  ): Promise<FormalMinutes> {
    return this.nlpService.generateMinutes(transcription, summary, actionItems);
  }
}

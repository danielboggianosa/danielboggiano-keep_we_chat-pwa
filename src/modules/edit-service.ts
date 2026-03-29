/**
 * EditService — Edición de transcripciones con historial y enforcement de permisos.
 * Almacenamiento in-memory.
 *
 * Requisitos: 8.1, 8.2, 8.3
 */

import type { EditRecord } from '../types/user';
import type { UserService } from './user-service';

/** In-memory segment storage: transcriptionId → segment texts */
export type SegmentStore = Map<string, string[]>;

export class EditService {
  private userService: UserService;
  /** transcriptionId → EditRecord[] */
  private editHistory: Map<string, EditRecord[]> = new Map();
  /** transcriptionId → segment texts (mutable) */
  private segments: SegmentStore;
  private editCounter = 0;

  constructor(userService: UserService, segments?: SegmentStore) {
    this.userService = userService;
    this.segments = segments ?? new Map();
  }

  /**
   * Register segments for a transcription so they can be edited.
   */
  registerSegments(transcriptionId: string, texts: string[]): void {
    this.segments.set(transcriptionId, [...texts]);
  }

  /**
   * Edit a segment's text. Creates an EditRecord in the history.
   * Only the owner or users with 'read-write' permission can edit (Req 8.1).
   * Each edit is logged with editedBy and editedAt (Req 8.2).
   */
  editSegment(
    transcriptionId: string,
    segmentIndex: number,
    newText: string,
    userId: string,
  ): void {
    // Enforce permissions (Req 8.1)
    const permission = this.userService.getPermission(userId, transcriptionId);
    if (permission !== 'read-write') {
      throw new Error(
        `User "${userId}" does not have edit permission for transcription "${transcriptionId}"`,
      );
    }

    const segmentTexts = this.segments.get(transcriptionId);
    if (!segmentTexts) {
      throw new Error(`Transcription "${transcriptionId}" has no registered segments`);
    }
    if (segmentIndex < 0 || segmentIndex >= segmentTexts.length) {
      throw new Error(
        `Segment index ${segmentIndex} is out of bounds for transcription "${transcriptionId}"`,
      );
    }

    const previousText = segmentTexts[segmentIndex];

    // Create EditRecord (Req 8.2)
    const record: EditRecord = {
      id: `edit-${++this.editCounter}`,
      transcriptionId,
      segmentIndex,
      previousText,
      newText,
      editedBy: userId,
      editedAt: new Date(),
    };

    // Apply the edit
    segmentTexts[segmentIndex] = newText;

    // Store in history
    if (!this.editHistory.has(transcriptionId)) {
      this.editHistory.set(transcriptionId, []);
    }
    this.editHistory.get(transcriptionId)!.push(record);
  }

  /**
   * Get the full edit history for a transcription (Req 8.3).
   */
  getEditHistory(transcriptionId: string): EditRecord[] {
    return this.editHistory.get(transcriptionId) ?? [];
  }
}

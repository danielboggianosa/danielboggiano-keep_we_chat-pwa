/**
 * SearchService — Full-text search over transcriptions with filters and access control.
 * In-memory implementation using an indexed store of transcriptions.
 *
 * Requisitos: 7.1, 7.2, 7.3, 9.3
 */

import type { SearchQuery, SearchResult } from '../types/search';
import type { DiarizedSegment, DiarizedTranscription } from '../types/transcription';
import type { UserService } from './user-service';

/** Indexed transcription stored in the search service. */
export interface IndexedTranscription {
  id: string;
  ownerId: string;
  title: string;
  language: 'es' | 'en';
  recordedAt: Date;
  transcription: DiarizedTranscription;
}

export class SearchService {
  private store: Map<string, IndexedTranscription> = new Map();

  constructor(private userService: UserService) {}

  /** Add or update a transcription in the search index. */
  index(entry: IndexedTranscription): void {
    this.store.set(entry.id, entry);
  }

  /** Remove a transcription from the search index. */
  remove(transcriptionId: string): void {
    this.store.delete(transcriptionId);
  }

  /**
   * Full-text search with filters and access control.
   *
   * - Only returns results from transcriptions the user can view (owner or shared).
   * - Applies optional filters: dateRange, speakerId, language.
   * - Returns paginated results with context, speaker info, and meeting date.
   */
  search(query: SearchQuery): SearchResult[] {
    const { text, filters, userId, page = 1, pageSize = 20 } = query;
    const searchText = text.toLowerCase();
    const results: SearchResult[] = [];

    for (const entry of this.store.values()) {
      // Access control: only transcriptions the user can view (Req 9.3)
      if (!this.userService.canViewTranscription(userId, entry.id)) {
        continue;
      }

      // Filter by language
      if (filters?.language && entry.language !== filters.language) {
        continue;
      }

      // Filter by date range
      if (filters?.dateRange) {
        const recordedTime = entry.recordedAt.getTime();
        if (
          recordedTime < filters.dateRange.from.getTime() ||
          recordedTime > filters.dateRange.to.getTime()
        ) {
          continue;
        }
      }

      const segments = entry.transcription.segments;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        // Filter by speakerId
        if (filters?.speakerId && segment.speakerId !== filters.speakerId) {
          continue;
        }

        // Full-text match (case-insensitive)
        if (!segment.text.toLowerCase().includes(searchText)) {
          continue;
        }

        const contextBefore = i > 0 ? segments[i - 1].text : '';
        const contextAfter = i < segments.length - 1 ? segments[i + 1].text : '';

        results.push({
          transcriptionId: entry.id,
          meetingTitle: entry.title,
          meetingDate: entry.recordedAt,
          matchedSegment: { ...segment },
          contextBefore,
          contextAfter,
          highlightedText: this.highlight(segment.text, text),
        });
      }
    }

    // Pagination
    const start = (page - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }

  /** Highlight matched text by wrapping it with <mark> tags. */
  private highlight(fullText: string, query: string): string {
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return fullText.replace(regex, '<mark>$1</mark>');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

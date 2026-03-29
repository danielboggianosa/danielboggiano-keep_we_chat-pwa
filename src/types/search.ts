/**
 * Types for full-text search over transcriptions.
 * Used by SearchService.
 */

import type { DiarizedSegment } from './transcription';

export interface SearchQuery {
  text: string;
  filters?: {
    dateRange?: { from: Date; to: Date };
    speakerId?: string;
    language?: 'es' | 'en';
  };
  userId: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  transcriptionId: string;
  meetingTitle: string;
  meetingDate: Date;
  matchedSegment: DiarizedSegment;
  contextBefore: string;
  contextAfter: string;
  highlightedText: string;
}

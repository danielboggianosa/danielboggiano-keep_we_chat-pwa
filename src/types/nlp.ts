/**
 * Types for NLP processing: summaries, action items, and formal minutes.
 * Used by NLPService.
 */

import type { SpeakerProfile } from './transcription';

export interface MeetingSummary {
  topics: string[];
  keyPoints: string[];
  language: 'es' | 'en';
}

export interface ActionItem {
  id: string;
  description: string;
  assignedTo: string;        // speakerId or "unassigned"
  assignedToLabel: string;   // Speaker name or "Sin asignar"
  sourceSegmentId?: string;
  reminderCalendarId?: string;
}

export interface FormalMinutes {
  title: string;
  date: Date;
  attendees: SpeakerProfile[];
  topicsDiscussed: string[];
  decisions: string[];
  actionItems: ActionItem[];
  language: 'es' | 'en';
}

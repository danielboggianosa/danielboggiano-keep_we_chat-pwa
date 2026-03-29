/**
 * Types for calendar integration and auto-start.
 * Used by CalendarService.
 */

export type CalendarProvider = 'google-calendar' | 'teams-calendar' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  participants: string[];
  meetingUrl?: string;
  provider: CalendarProvider;
}

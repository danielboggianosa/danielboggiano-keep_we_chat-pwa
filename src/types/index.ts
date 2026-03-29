/**
 * Barrel export for all system types.
 */

export type {
  RecordingConfig,
  RecordingSession,
  RecordingStatus,
  AudioFile,
} from './audio';

export type {
  TranscriptionSegment,
  RawTranscription,
  DiarizedSegment,
  DiarizedTranscription,
  SpeakerProfile,
} from './transcription';

export type {
  SyncItem,
  SyncQueueEntry,
  SyncResult,
  SyncTransport,
} from './sync';

export { SyncConflictError } from './sync';

export type {
  MeetingSummary,
  ActionItem,
  FormalMinutes,
} from './nlp';

export type {
  SearchQuery,
  SearchResult,
} from './search';

export type {
  ExportFormat,
} from './export';

export type {
  CalendarProvider,
  CalendarEvent,
} from './calendar';

export type {
  Permission,
  EditRecord,
  TranscriptionShare,
} from './user';

/**
 * API Client — Wraps fetch with automatic JWT token injection and refresh.
 *
 * Tokens are stored in module-level variables (memory only, not localStorage).
 * The base URL defaults to window.location.origin or can be set via
 * the global __API_BASE_URL__ (injected by build/env).
 *
 * Requirements: 7.1–7.8, 9.1, 9.6
 */

import type { DiarizedTranscription, DiarizedSegment, SpeakerProfile } from '../types/transcription';
import type { MeetingSummary, ActionItem, FormalMinutes } from '../types/nlp';
import type { EditHistoryEntry } from './edit-history';
import type { MeetingRecord } from './pipeline-service';

// ── Token storage (in-memory only) ──────────────────────────────

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}

export function hasTokens(): boolean {
  return accessToken !== null;
}

// ── Base URL ─────────────────────────────────────────────────────

declare const __API_BASE_URL__: string | undefined;

function getBaseUrl(): string {
  if (typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__) {
    return __API_BASE_URL__;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

// ── Auth state listener ──────────────────────────────────────────

type AuthListener = (loggedIn: boolean) => void;
const authListeners: AuthListener[] = [];

export function onAuthChange(fn: AuthListener): void {
  authListeners.push(fn);
}

function notifyAuth(loggedIn: boolean): void {
  authListeners.forEach(fn => fn(loggedIn));
}

// ── Core fetch wrapper ───────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      notifyAuth(false);
      return false;
    }
    const data = await res.json();
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    return true;
  } catch {
    clearTokens();
    notifyAuth(false);
    return false;
  }
}

async function ensureRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = tryRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

export interface ApiError {
  status: number;
  error: string;
  details?: { field: string; message: string }[];
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshed = await ensureRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err: ApiError = { status: res.status, error: body.error ?? res.statusText, details: body.details };
    throw err;
  }

  return res.json() as Promise<T>;
}

// ── Auth endpoints ───────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function apiRegister(email: string, name: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, name, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  notifyAuth(true);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  notifyAuth(true);
  return data;
}

export async function apiGoogleLogin(code: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  setTokens(data.accessToken, data.refreshToken);
  notifyAuth(true);
  return data;
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    clearTokens();
    notifyAuth(false);
  }
}

// ── Transcription endpoints ──────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

export interface ApiTranscription {
  id: string;
  owner_id: string;
  title: string;
  language: string;
  audio_file_url: string | null;
  status: string;
  duration: number | null;
  recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiTranscriptionDetail extends ApiTranscription {
  segments: {
    id: string;
    speaker_id: string | null;
    start_time: number;
    end_time: number;
    content: string;
    confidence: number;
    order_index: number;
  }[];
  speakers: {
    id: string;
    label: string;
    identified_name: string | null;
  }[];
}

export async function apiGetTranscriptions(page = 1): Promise<PaginatedResponse<ApiTranscription>> {
  return apiFetch(`/api/transcriptions?page=${page}`);
}

export async function apiGetTranscription(id: string): Promise<{ data: ApiTranscriptionDetail }> {
  return apiFetch(`/api/transcriptions/${id}`);
}

export async function apiUpdateTranscription(id: string, fields: { title?: string; language?: string; status?: string }): Promise<{ data: ApiTranscription }> {
  return apiFetch(`/api/transcriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export async function apiDeleteTranscription(id: string): Promise<void> {
  await apiFetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
}

// ── Segment editing ──────────────────────────────────────────────

export async function apiEditSegment(
  transcriptionId: string,
  segmentIndex: number,
  newText: string,
): Promise<{ data: { segmentIndex: number; previousText: string; newText: string; editedBy: string } }> {
  return apiFetch(`/api/transcriptions/${transcriptionId}/segments/${segmentIndex}/edit`, {
    method: 'POST',
    body: JSON.stringify({ newText }),
  });
}

// ── Edit history ─────────────────────────────────────────────────

export interface ApiEditRecord {
  id: string;
  segment_index: number;
  previous_text: string;
  new_text: string;
  edited_by: string;
  edited_at: string;
  editor_name: string;
}

export async function apiGetEditHistory(transcriptionId: string): Promise<{ data: ApiEditRecord[] }> {
  return apiFetch(`/api/transcriptions/${transcriptionId}/edits`);
}

// ── Sharing ──────────────────────────────────────────────────────

export async function apiShareTranscription(
  transcriptionId: string,
  email: string,
  permission: 'read' | 'read-write',
): Promise<void> {
  await apiFetch(`/api/transcriptions/${transcriptionId}/share`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  });
}

export async function apiGetShares(transcriptionId: string): Promise<{ data: { user_id: string; email: string; name: string; permission: string; shared_at: string }[] }> {
  return apiFetch(`/api/transcriptions/${transcriptionId}/share`);
}

// ── Search ───────────────────────────────────────────────────────

export interface SearchParams {
  q: string;
  dateFrom?: string;
  dateTo?: string;
  speaker?: string;
  lang?: string;
  page?: number;
}

export interface SearchResult {
  segment_id: string;
  transcription_id: string;
  title: string;
  content: string;
  speaker_label: string;
  start_time: number;
  end_time: number;
  recorded_at: string;
  rank: number;
}

export async function apiSearch(params: SearchParams): Promise<{ data: SearchResult[]; pagination?: { page: number; total: number } }> {
  const qs = new URLSearchParams();
  qs.set('q', params.q);
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo) qs.set('dateTo', params.dateTo);
  if (params.speaker) qs.set('speaker', params.speaker);
  if (params.lang) qs.set('lang', params.lang);
  if (params.page) qs.set('page', String(params.page));
  return apiFetch(`/api/search?${qs.toString()}`);
}

// ── NLP endpoints ────────────────────────────────────────────────

export async function apiGenerateMinutes(transcription: DiarizedTranscription): Promise<FormalMinutes> {
  const body = {
    segments: transcription.segments.map(s => ({
      startTime: s.startTime,
      endTime: s.endTime,
      text: s.text,
      confidence: s.confidence,
      speakerId: s.speakerId,
      speakerLabel: s.speakerLabel,
      speakerConfidence: s.speakerConfidence,
    })),
    speakers: transcription.speakers.map(sp => ({
      id: sp.id,
      label: sp.label,
      identifiedName: sp.identifiedName ?? null,
    })),
    language: transcription.language,
  };
  return apiFetch<FormalMinutes>('/api/nlp/minutes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiGenerateSummary(transcription: DiarizedTranscription): Promise<MeetingSummary> {
  const body = {
    segments: transcription.segments.map(s => ({
      startTime: s.startTime,
      endTime: s.endTime,
      text: s.text,
      confidence: s.confidence,
      speakerId: s.speakerId,
      speakerLabel: s.speakerLabel,
      speakerConfidence: s.speakerConfidence,
    })),
    speakers: transcription.speakers.map(sp => ({
      id: sp.id,
      label: sp.label,
      identifiedName: sp.identifiedName ?? null,
    })),
    language: transcription.language,
  };
  return apiFetch<MeetingSummary>('/api/nlp/summary', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiExtractActions(transcription: DiarizedTranscription): Promise<ActionItem[]> {
  const body = {
    segments: transcription.segments.map(s => ({
      startTime: s.startTime,
      endTime: s.endTime,
      text: s.text,
      confidence: s.confidence,
      speakerId: s.speakerId,
      speakerLabel: s.speakerLabel,
      speakerConfidence: s.speakerConfidence,
    })),
    speakers: transcription.speakers.map(sp => ({
      id: sp.id,
      label: sp.label,
      identifiedName: sp.identifiedName ?? null,
    })),
    language: transcription.language,
  };
  return apiFetch<ActionItem[]>('/api/nlp/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Helpers: convert API shapes to UI shapes ─────────────────────

export function apiTranscriptionToMeetingRecord(
  t: ApiTranscriptionDetail,
): MeetingRecord {
  const speakers: SpeakerProfile[] = t.speakers.map(s => ({
    id: s.id,
    label: s.label,
    identifiedName: s.identified_name ?? undefined,
  }));

  const speakerMap = new Map(t.speakers.map(s => [s.id, s]));

  const segments: DiarizedSegment[] = t.segments.map(seg => {
    const spk = seg.speaker_id ? speakerMap.get(seg.speaker_id) : null;
    return {
      startTime: seg.start_time,
      endTime: seg.end_time,
      text: seg.content,
      confidence: seg.confidence,
      speakerId: seg.speaker_id ?? 'unknown',
      speakerLabel: spk?.label ?? 'Desconocido',
      speakerConfidence: 1,
    };
  });

  const transcription: DiarizedTranscription = {
    segments,
    speakers,
    language: (t.language as 'es' | 'en') ?? 'es',
  };

  return {
    id: t.id,
    title: t.title,
    date: new Date(t.recorded_at ?? t.created_at),
    duration: t.duration ?? 0,
    status: t.status === 'processing' ? 'processing' : 'transcribed',
    transcription,
    summary: { topics: [], keyPoints: [], language: (t.language as 'es' | 'en') ?? 'es' },
    actionItems: [],
    minutes: {
      title: t.title,
      date: new Date(t.recorded_at ?? t.created_at),
      attendees: speakers,
      topicsDiscussed: [],
      decisions: [],
      actionItems: [],
      language: (t.language as 'es' | 'en') ?? 'es',
    },
  };
}

export function apiEditRecordToEntry(r: ApiEditRecord): EditHistoryEntry {
  return {
    editedBy: r.editor_name,
    editedAt: new Date(r.edited_at).toLocaleString('es'),
    segmentIndex: r.segment_index,
    previousText: r.previous_text,
    newText: r.new_text,
  };
}

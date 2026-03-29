/**
 * Dashboard / Home screen matching the Pencil design "Dashboard - Mis Reuniones".
 * Shows real meeting data from the pipeline service.
 */

import { icons } from './icons';
import { APP_VERSION } from '../version';
import type { MeetingRecord } from './pipeline-service';

interface DashboardCallbacks {
  onRecordClick: () => void;
  onSearchClick: () => void;
  onMeetingClick: (id: string) => void;
  getMeetings: () => MeetingRecord[];
}

export function createDashboardScreen(cb: DashboardCallbacks): {
  element: HTMLElement;
  refresh: () => void;
} {
  const el = document.createElement('div');
  el.className = 'screen active';

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  }

  function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const dayMs = 86400000;
    if (diff < dayMs && now.getDate() === date.getDate()) {
      return `Hoy, ${date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diff < 2 * dayMs) {
      return `Ayer, ${date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('es', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function render(): void {
    const meetings = cb.getMeetings();
    const totalMeetings = meetings.length;
    const totalHours = meetings.reduce((sum, m) => sum + m.duration, 0) / 3600;
    const pending = meetings.filter(m => m.status === 'processing').length;

    const meetingCards = meetings.length > 0
      ? meetings.slice(0, 10).map(m => `
          <button class="meeting-card" type="button" data-meeting-id="${m.id}">
            <div class="meeting-card-left">
              <span class="meeting-card-title">${esc(m.title)}</span>
              <div class="meeting-card-meta">
                <span>${formatDate(m.date)}</span><span>${formatDuration(m.duration)}</span>
              </div>
              <span class="meeting-card-badge ${m.status === 'transcribed' ? 'badge-green' : 'badge-yellow'}">
                ${m.status === 'transcribed' ? '✓ Transcrita' : '⟳ Procesando'}
              </span>
            </div>
            <span class="meeting-card-arrow">${icons.chevronRight}</span>
          </button>
        `).join('')
      : `<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:14px;">
           No hay reuniones aún. Graba tu primera reunión.
         </div>`;

    el.innerHTML = `
      <!-- Header -->
      <div class="header">
        <div class="header-title-wrap">
          <span class="header-greeting">${getGreeting()}</span>
          <span class="header-app-title">KeepWeChat</span>
        </div>
        <div class="header-icons">
          <button type="button" aria-label="Notificaciones">${icons.bell}</button>
          <button type="button" aria-label="Perfil">${icons.user}</button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="search-bar">
        <button class="search-inner" type="button" aria-label="Buscar en transcripciones">
          ${icons.search}
          <span>Buscar en transcripciones...</span>
        </button>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value" style="color:var(--text-primary)">${totalMeetings}</span>
          <span class="stat-label">Reuniones</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" style="color:var(--accent-indigo)">${totalHours.toFixed(1)}h</span>
          <span class="stat-label">Transcritas</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" style="color:var(--accent-coral)">${pending}</span>
          <span class="stat-label">Pendientes</span>
        </div>
      </div>

      <!-- Section header -->
      <div class="section-header">
        <span class="section-title">Reuniones recientes</span>
        <button class="section-link" type="button">Ver todas</button>
      </div>

      <!-- Meeting list -->
      <div class="meeting-list">${meetingCards}</div>

      <div class="spacer"></div>

      <!-- FAB -->
      <div class="fab-wrap">
        <button class="fab" type="button" id="record-fab">
          ${icons.mic}
          <span>Grabar reunión</span>
        </button>
      </div>

      <!-- Version -->
      <div style="text-align:center;padding:4px 0 8px 0;font-size:11px;color:var(--text-disabled);">
        KeepWeChat v${APP_VERSION}
      </div>
    `;

    // Wire events
    el.querySelector('#record-fab')!.addEventListener('click', cb.onRecordClick);
    el.querySelector('.search-inner')!.addEventListener('click', cb.onSearchClick);

    // Meeting card clicks
    el.querySelectorAll('.meeting-card[data-meeting-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.meetingId!;
        cb.onMeetingClick(id);
      });
    });
  }

  render();

  return {
    element: el,
    refresh: render,
  };
}

function esc(text: string): string {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

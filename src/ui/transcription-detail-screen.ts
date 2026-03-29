/**
 * Transcription detail screen matching the Pencil design "Transcripción" + "Resumen y Accionables".
 * Shows transcription segments, summary, action items, and export options.
 */

import { icons } from './icons';
import type { MeetingRecord } from './pipeline-service';
import type { ExportService } from '../modules/export-service';
import type { ExportFormat } from '../types/export';

const SPEAKER_COLORS = [
  'var(--accent-coral)',
  'var(--accent-indigo)',
  'var(--accent-green)',
  'var(--accent-orange)',
];

interface DetailCallbacks {
  onBack: () => void;
  exportService: ExportService;
}

export interface TranscriptionDetailAPI {
  element: HTMLElement;
  show: (meeting: MeetingRecord) => void;
}

export function createTranscriptionDetailScreen(cb: DetailCallbacks): TranscriptionDetailAPI {
  const el = document.createElement('div');
  el.className = 'screen';
  el.style.cssText = 'padding-bottom:0;';

  el.innerHTML = `
    <div class="trans-header">
      <button class="trans-back" type="button" id="detail-back">
        ${icons.arrowLeft} <span>Atrás</span>
      </button>
      <div class="trans-actions">
        <button type="button" id="detail-share" aria-label="Compartir">${icons.share}</button>
        <button type="button" id="detail-export" aria-label="Exportar">${icons.download}</button>
      </div>
    </div>
    <div class="trans-title-area">
      <div class="trans-title" id="detail-title"></div>
      <div class="trans-meta" id="detail-meta"></div>
    </div>
    <div class="trans-speakers" id="detail-speakers"></div>
    <div class="trans-divider"></div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;padding:0 24px;margin-top:8px;">
      <button class="filter-chip active" type="button" data-tab="transcript">Transcripción</button>
      <button class="filter-chip" type="button" data-tab="summary">Resumen</button>
      <button class="filter-chip" type="button" data-tab="actions">Accionables</button>
    </div>

    <!-- Tab content -->
    <div class="trans-content" id="detail-content"></div>

    <!-- Export modal (hidden) -->
    <div id="export-modal" class="hidden" style="
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.4);z-index:200;
      display:flex;align-items:flex-end;justify-content:center;">
      <div style="
        background:var(--bg-primary);border-radius:24px 24px 0 0;
        padding:24px;width:100%;max-width:430px;">
        <div style="font-family:var(--font-display);font-size:18px;font-weight:700;margin-bottom:16px;">
          Exportar transcripción
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;" id="export-options"></div>
        <button type="button" id="export-cancel" style="
          margin-top:16px;width:100%;padding:14px;border:none;
          border-radius:16px;background:var(--bg-surface);
          font-family:var(--font-body);font-size:15px;font-weight:600;
          cursor:pointer;color:var(--text-secondary);">
          Cancelar
        </button>
      </div>
    </div>
  `;

  const titleEl = el.querySelector('#detail-title') as HTMLElement;
  const metaEl = el.querySelector('#detail-meta') as HTMLElement;
  const speakersEl = el.querySelector('#detail-speakers') as HTMLElement;
  const contentEl = el.querySelector('#detail-content') as HTMLElement;
  const exportModal = el.querySelector('#export-modal') as HTMLElement;
  const exportOptions = el.querySelector('#export-options') as HTMLElement;
  const tabs = el.querySelectorAll('[data-tab]') as NodeListOf<HTMLButtonElement>;

  let currentMeeting: MeetingRecord | null = null;
  let activeTab = 'transcript';

  el.querySelector('#detail-back')!.addEventListener('click', cb.onBack);

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab!;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      if (currentMeeting) renderContent(currentMeeting);
    });
  });

  // Export button
  el.querySelector('#detail-export')!.addEventListener('click', () => {
    exportModal.classList.remove('hidden');
    exportModal.style.display = 'flex';
  });
  el.querySelector('#export-cancel')!.addEventListener('click', () => {
    exportModal.classList.add('hidden');
  });
  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.classList.add('hidden');
  });

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function getSpeakerColor(index: number): string {
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
  }

  function getSpeakerBgColor(index: number): string {
    const bgs = ['var(--accent-coral-light)', 'var(--badge-indigo-bg)', 'var(--badge-green-bg)', 'var(--badge-yellow-bg)'];
    return bgs[index % bgs.length];
  }

  function renderContent(meeting: MeetingRecord): void {
    if (activeTab === 'transcript') {
      renderTranscript(meeting);
    } else if (activeTab === 'summary') {
      renderSummary(meeting);
    } else {
      renderActions(meeting);
    }
  }

  function renderTranscript(meeting: MeetingRecord): void {
    const speakerMap = new Map<string, number>();
    meeting.transcription.speakers.forEach((s, i) => speakerMap.set(s.id, i));

    contentEl.innerHTML = meeting.transcription.segments.map(seg => {
      const idx = speakerMap.get(seg.speakerId) ?? 0;
      const color = getSpeakerColor(idx);
      return `
        <div class="trans-segment">
          <span class="trans-seg-time">${formatTime(seg.startTime)} — ${formatTime(seg.endTime)}</span>
          <span class="trans-seg-speaker" style="color:${color}">${esc(seg.speakerLabel)}</span>
          <span class="trans-seg-text">${esc(seg.text)}</span>
        </div>`;
    }).join('');
  }

  function renderSummary(meeting: MeetingRecord): void {
    const { summary, minutes } = meeting;
    let html = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Temas tratados
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${summary.topics.map(t => `<li style="font-size:14px;color:var(--text-primary)">${esc(t)}</li>`).join('')}
          </ul>
        </div>`;

    if (summary.keyPoints.length > 0) {
      html += `
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Puntos clave
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${summary.keyPoints.map(p => `<li style="font-size:14px;color:var(--text-primary)">${esc(p)}</li>`).join('')}
          </ul>
        </div>`;
    }

    if (minutes.decisions.length > 0) {
      html += `
        <div style="background:var(--bg-surface);border-radius:16px;padding:16px;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">
            Decisiones
          </div>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            ${minutes.decisions.map(d => `<li style="font-size:14px;color:var(--text-primary)">${esc(d)}</li>`).join('')}
          </ul>
        </div>`;
    }

    html += '</div>';
    contentEl.innerHTML = html;
  }

  function renderActions(meeting: MeetingRecord): void {
    if (meeting.actionItems.length === 0) {
      contentEl.innerHTML = `
        <div style="text-align:center;padding:32px;color:var(--text-tertiary);font-size:14px;">
          No se detectaron accionables en esta reunión.
        </div>`;
      return;
    }

    contentEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${meeting.actionItems.map(a => `
          <div style="background:var(--bg-surface);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:14px;font-weight:500;color:var(--text-primary)">${esc(a.description)}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Asignado a: ${esc(a.assignedToLabel)}</div>
          </div>
        `).join('')}
      </div>`;
  }

  function doExport(format: ExportFormat): void {
    if (!currentMeeting) return;
    const content = cb.exportService.export(currentMeeting.transcription, format);
    const ext = format === 'md' ? 'md' : format;
    const mime = format === 'md' ? 'text/markdown' : format === 'vtt' ? 'text/vtt' : 'text/plain';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMeeting.title.replace(/\s+/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    exportModal.classList.add('hidden');
  }

  function show(meeting: MeetingRecord): void {
    currentMeeting = meeting;
    activeTab = 'transcript';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'transcript'));

    titleEl.textContent = meeting.title;
    metaEl.innerHTML = `
      <span>${meeting.date.toLocaleDateString('es')}</span>
      <span>·</span>
      <span>${formatDuration(meeting.duration)}</span>
      <span>·</span>
      <span>${meeting.transcription.segments.length} segmentos</span>
    `;

    // Speaker badges
    speakersEl.innerHTML = meeting.transcription.speakers.map((s, i) => `
      <span class="speaker-badge" style="background:${getSpeakerBgColor(i)};color:${getSpeakerColor(i)}">
        ${esc(s.label)}
      </span>
    `).join('');

    // Export options
    const formats: { format: ExportFormat; label: string; desc: string }[] = [
      { format: 'vtt', label: 'VTT', desc: 'Subtítulos WebVTT' },
      { format: 'txt', label: 'TXT', desc: 'Texto plano' },
      { format: 'md', label: 'Markdown', desc: 'Formato Markdown' },
    ];
    exportOptions.innerHTML = formats.map(f => `
      <button type="button" data-format="${f.format}" style="
        display:flex;flex-direction:column;gap:2px;padding:14px 16px;
        background:var(--bg-surface);border-radius:16px;border:none;
        cursor:pointer;text-align:left;font-family:var(--font-body);">
        <span style="font-size:15px;font-weight:600;color:var(--text-primary)">${f.label}</span>
        <span style="font-size:12px;color:var(--text-secondary)">${f.desc}</span>
      </button>
    `).join('');
    exportOptions.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => doExport(btn.dataset.format as ExportFormat));
    });

    renderContent(meeting);
  }

  return { element: el, show };
}

function esc(text: string): string {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

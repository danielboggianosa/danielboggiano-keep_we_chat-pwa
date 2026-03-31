/**
 * Search screen connected to GET /api/search with real filters.
 * Requirements: 7.4
 */

import { icons } from './icons';
import { apiSearch, type SearchResult } from './api-client';

export function createSearchScreen(): { element: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'screen';

  let activeFilter: 'all' | 'date' | 'speaker' | 'language' = 'all';
  let results: SearchResult[] = [];
  let currentQuery = '';
  let dateFrom = '';
  let dateTo = '';
  let speaker = '';
  let lang = '';
  let searchPage = 1;
  let totalResults = 0;
  let isLoading = false;

  function render(): void {
    const resultCards = results.length > 0
      ? results.map(r => `
          <div class="search-result-card" data-tid="${r.transcription_id}">
            <span class="search-result-title">${esc(r.title)}</span>
            <span class="search-result-meta">${new Date(r.recorded_at).toLocaleDateString('es')} · ${esc(r.speaker_label)}</span>
            <div class="search-result-text">${esc(r.content)}</div>
          </div>
        `).join('')
      : currentQuery
        ? `<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:14px;">
             ${isLoading ? 'Buscando...' : 'No se encontraron resultados.'}
           </div>`
        : `<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:14px;">
             Escribe para buscar en tus transcripciones.
           </div>`;

    el.innerHTML = `
      <div class="search-screen-header">
        <div class="search-screen-title">Buscar</div>
      </div>

      <div class="search-input-wrap">
        <div class="search-input-inner">
          ${icons.search}
          <input type="search" id="search-input" placeholder="Buscar en transcripciones..." aria-label="Buscar" value="${esc(currentQuery)}" />
        </div>
      </div>

      <div class="search-filters">
        <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" type="button" data-filter="all">Todas</button>
        <button class="filter-chip ${activeFilter === 'date' ? 'active' : ''}" type="button" data-filter="date">${icons.calendar} Fecha</button>
        <button class="filter-chip ${activeFilter === 'speaker' ? 'active' : ''}" type="button" data-filter="speaker">${icons.user} Hablante</button>
        <button class="filter-chip ${activeFilter === 'language' ? 'active' : ''}" type="button" data-filter="language">Idioma</button>
      </div>

      <!-- Filter inputs (shown conditionally) -->
      <div id="filter-inputs" style="padding:0 24px;display:flex;flex-direction:column;gap:8px;">
        ${activeFilter === 'date' ? `
          <div style="display:flex;gap:8px;">
            <input type="date" id="filter-date-from" value="${dateFrom}" placeholder="Desde" style="flex:1;padding:8px;border:1px solid var(--border-color,#e0e0e0);border-radius:8px;font-family:inherit;font-size:13px;" />
            <input type="date" id="filter-date-to" value="${dateTo}" placeholder="Hasta" style="flex:1;padding:8px;border:1px solid var(--border-color,#e0e0e0);border-radius:8px;font-family:inherit;font-size:13px;" />
          </div>
        ` : ''}
        ${activeFilter === 'speaker' ? `
          <input type="text" id="filter-speaker" value="${esc(speaker)}" placeholder="Nombre del hablante" style="padding:8px;border:1px solid var(--border-color,#e0e0e0);border-radius:8px;font-family:inherit;font-size:13px;" />
        ` : ''}
        ${activeFilter === 'language' ? `
          <select id="filter-lang" style="padding:8px;border:1px solid var(--border-color,#e0e0e0);border-radius:8px;font-family:inherit;font-size:13px;">
            <option value="">Todos</option>
            <option value="es" ${lang === 'es' ? 'selected' : ''}>Español</option>
            <option value="en" ${lang === 'en' ? 'selected' : ''}>Inglés</option>
          </select>
        ` : ''}
      </div>

      <div class="search-result-count">${totalResults > 0 ? `${totalResults} resultado${totalResults !== 1 ? 's' : ''} encontrado${totalResults !== 1 ? 's' : ''}` : ''}</div>

      <div class="search-results">${resultCards}</div>
    `;

    wireEvents();
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function doSearch(): Promise<void> {
    if (!currentQuery.trim()) {
      results = [];
      totalResults = 0;
      render();
      return;
    }
    isLoading = true;
    render();
    try {
      const res = await apiSearch({
        q: currentQuery,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        speaker: speaker || undefined,
        lang: lang || undefined,
        page: searchPage,
      });
      results = res.data ?? [];
      totalResults = res.pagination?.total ?? results.length;
    } catch {
      results = [];
      totalResults = 0;
    }
    isLoading = false;
    render();
  }

  function wireEvents(): void {
    const input = el.querySelector('#search-input') as HTMLInputElement | null;
    if (input) {
      input.addEventListener('input', () => {
        currentQuery = input.value;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { searchPage = 1; doSearch(); }, 400);
      });
    }

    el.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        activeFilter = (chip as HTMLElement).dataset.filter as typeof activeFilter;
        render();
      });
    });

    const dateFromEl = el.querySelector('#filter-date-from') as HTMLInputElement | null;
    const dateToEl = el.querySelector('#filter-date-to') as HTMLInputElement | null;
    const speakerEl = el.querySelector('#filter-speaker') as HTMLInputElement | null;
    const langEl = el.querySelector('#filter-lang') as HTMLSelectElement | null;

    if (dateFromEl) dateFromEl.addEventListener('change', () => { dateFrom = dateFromEl.value; doSearch(); });
    if (dateToEl) dateToEl.addEventListener('change', () => { dateTo = dateToEl.value; doSearch(); });
    if (speakerEl) speakerEl.addEventListener('input', () => { speaker = speakerEl.value; if (debounceTimer) clearTimeout(debounceTimer); debounceTimer = setTimeout(() => doSearch(), 400); });
    if (langEl) langEl.addEventListener('change', () => { lang = langEl.value; doSearch(); });
  }

  render();
  return { element: el };
}

function esc(text: string): string {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

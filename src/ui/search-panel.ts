/**
 * Search panel component.
 * Provides full-text search with filters for date range, speaker, and language.
 * Requirement 7.1, 7.2, 7.3
 */

export interface SearchFilters {
  text: string;
  dateFrom?: string;
  dateTo?: string;
  speakerId?: string;
  language?: string;
}

export interface SearchResultData {
  meetingTitle: string;
  meetingDate: string;
  speakerLabel: string;
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
}

export function createSearchPanel(
  onSearch: (filters: SearchFilters) => void
): { element: HTMLElement; showResults: (results: SearchResultData[]) => void } {
  const el = document.createElement('div');
  el.className = 'panel';
  el.setAttribute('role', 'search');
  el.setAttribute('aria-label', 'Buscar en transcripciones');

  el.innerHTML = `
    <h2>Búsqueda</h2>
    <input class="search-input" type="search" placeholder="Buscar en transcripciones..." aria-label="Texto de búsqueda" />
    <div class="filters">
      <input type="date" class="filter-from" aria-label="Fecha desde" />
      <input type="date" class="filter-to" aria-label="Fecha hasta" />
      <select class="filter-speaker" aria-label="Filtrar por hablante">
        <option value="">Todos los hablantes</option>
      </select>
      <select class="filter-lang" aria-label="Filtrar por idioma">
        <option value="">Todos los idiomas</option>
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <button class="btn btn-primary search-btn" type="button">Buscar</button>
    </div>
    <div class="search-results" style="margin-top:12px;"></div>
  `;

  const input = el.querySelector('.search-input') as HTMLInputElement;
  const fromInput = el.querySelector('.filter-from') as HTMLInputElement;
  const toInput = el.querySelector('.filter-to') as HTMLInputElement;
  const speakerSelect = el.querySelector('.filter-speaker') as HTMLSelectElement;
  const langSelect = el.querySelector('.filter-lang') as HTMLSelectElement;
  const searchBtn = el.querySelector('.search-btn') as HTMLButtonElement;
  const resultsEl = el.querySelector('.search-results') as HTMLElement;

  function getFilters(): SearchFilters {
    return {
      text: input.value.trim(),
      dateFrom: fromInput.value || undefined,
      dateTo: toInput.value || undefined,
      speakerId: speakerSelect.value || undefined,
      language: langSelect.value || undefined,
    };
  }

  searchBtn.addEventListener('click', () => onSearch(getFilters()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch(getFilters());
  });

  function showResults(results: SearchResultData[]): void {
    if (results.length === 0) {
      resultsEl.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;">Sin resultados.</p>';
      return;
    }
    resultsEl.innerHTML = results.map(r => `
      <div class="segment">
        <div>
          <span class="segment-speaker">${escapeHtml(r.speakerLabel)}</span>
          <span class="segment-time">${escapeHtml(r.meetingTitle)} — ${escapeHtml(r.meetingDate)}</span>
        </div>
        <div class="segment-text">
          <span style="color:var(--color-text-secondary)">${escapeHtml(r.contextBefore)}</span>
          <mark>${escapeHtml(r.highlightedText)}</mark>
          <span style="color:var(--color-text-secondary)">${escapeHtml(r.contextAfter)}</span>
        </div>
      </div>
    `).join('');
  }

  return { element: el, showResults };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Search screen matching the Pencil design "Búsqueda".
 */

import { icons } from './icons';

export function createSearchScreen(): { element: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'screen';

  el.innerHTML = `
    <div class="search-screen-header">
      <div class="search-screen-title">Buscar</div>
    </div>

    <div class="search-input-wrap">
      <div class="search-input-inner">
        ${icons.search}
        <input type="search" placeholder="Buscar en transcripciones..." aria-label="Buscar" />
      </div>
    </div>

    <div class="search-filters">
      <button class="filter-chip active" type="button">Todas</button>
      <button class="filter-chip" type="button">${icons.calendar} Fecha</button>
      <button class="filter-chip" type="button">${icons.user} Hablante</button>
    </div>

    <div class="search-result-count">3 resultados encontrados</div>

    <div class="search-results">
      <div class="search-result-card">
        <span class="search-result-title">Sprint Planning Q1</span>
        <span class="search-result-meta">Hoy, 10:00 AM · María</span>
        <div class="search-result-text">...necesitamos <mark>cerrar el sprint</mark> antes del viernes...</div>
      </div>
      <div class="search-result-card">
        <span class="search-result-title">Revisión de Diseño</span>
        <span class="search-result-meta">Ayer, 3:30 PM · Carlos</span>
        <div class="search-result-text">...el <mark>diseño</mark> del dashboard necesita ajustes...</div>
      </div>
      <div class="search-result-card">
        <span class="search-result-title">Standup Diario</span>
        <span class="search-result-meta">Lun, 9:00 AM · Ana</span>
        <div class="search-result-text">...voy a <mark>terminar</mark> la integración hoy...</div>
      </div>
    </div>
  `;

  // Filter chip toggle
  const chips = el.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  return { element: el };
}

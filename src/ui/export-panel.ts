/**
 * Export panel component.
 * Allows selecting export format (VTT, TXT, Markdown) and triggering export.
 * Requirement 10.1
 */

export type ExportFormatOption = 'vtt' | 'txt' | 'md';

export function createExportPanel(
  onExport: (format: ExportFormatOption) => void
): { element: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'panel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Exportar transcripción');

  const formats: { value: ExportFormatOption; name: string; desc: string }[] = [
    { value: 'vtt', name: 'VTT', desc: 'WebVTT subtítulos' },
    { value: 'txt', name: 'TXT', desc: 'Texto plano' },
    { value: 'md', name: 'Markdown', desc: 'Formato Markdown' },
  ];

  let selected: ExportFormatOption = 'vtt';

  el.innerHTML = `
    <h2>Exportar</h2>
    <div class="export-options" role="radiogroup" aria-label="Formato de exportación">
      ${formats.map(f => `
        <div class="export-option ${f.value === selected ? 'selected' : ''}"
             role="radio" aria-checked="${f.value === selected}" tabindex="0"
             data-format="${f.value}">
          <div class="format-name">${f.name}</div>
          <div class="format-desc">${f.desc}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:12px;">
      <button class="btn btn-primary export-btn" type="button">Exportar</button>
    </div>
  `;

  const options = el.querySelectorAll('.export-option');
  const exportBtn = el.querySelector('.export-btn') as HTMLButtonElement;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      selected = (opt as HTMLElement).dataset.format as ExportFormatOption;
      options.forEach(o => {
        o.classList.remove('selected');
        o.setAttribute('aria-checked', 'false');
      });
      opt.classList.add('selected');
      opt.setAttribute('aria-checked', 'true');
    });

    opt.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        (opt as HTMLElement).click();
      }
    });
  });

  exportBtn.addEventListener('click', () => onExport(selected));

  return { element: el };
}

/**
 * Edit history view component.
 * Displays the log of edits made to a transcription.
 * Requirement 8.3: Show edit history to users with access.
 */

export interface EditHistoryEntry {
  editedBy: string;
  editedAt: string;
  segmentIndex: number;
  previousText: string;
  newText: string;
}

export function createEditHistory(): {
  element: HTMLElement;
  update: (entries: EditHistoryEntry[]) => void;
} {
  const el = document.createElement('div');
  el.className = 'panel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Historial de ediciones');

  el.innerHTML = `
    <h2>Historial de ediciones</h2>
    <div class="history-container"></div>
    <p class="empty-msg" style="color:var(--color-text-secondary);font-size:14px;">
      No hay ediciones registradas.
    </p>
  `;

  const container = el.querySelector('.history-container') as HTMLElement;
  const emptyMsg = el.querySelector('.empty-msg') as HTMLElement;

  function update(entries: EditHistoryEntry[]): void {
    container.innerHTML = '';
    if (entries.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');

    entries.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'edit-history-item';
      item.innerHTML = `
        <div><strong>${escapeHtml(entry.editedBy)}</strong> — ${escapeHtml(entry.editedAt)}</div>
        <div>Segmento ${entry.segmentIndex + 1}</div>
        <div style="margin-top:4px;">
          <del style="color:var(--color-danger);font-size:13px;">${escapeHtml(entry.previousText)}</del>
        </div>
        <div>
          <ins style="color:var(--color-success);font-size:13px;text-decoration:none;">${escapeHtml(entry.newText)}</ins>
        </div>
      `;
      container.appendChild(item);
    });
  }

  return { element: el, update };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

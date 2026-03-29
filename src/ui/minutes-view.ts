/**
 * Formal minutes view component.
 * Displays structured meeting minutes with edit-before-finalize option.
 * Requirement 6.3: Allow user to review and edit minutes before finalizing.
 */

export interface MinutesData {
  title: string;
  date: string;
  attendees: string[];
  topicsDiscussed: string[];
  decisions: string[];
  actionItems: { description: string; assignedToLabel: string }[];
  language: string;
  finalized: boolean;
}

export function createMinutesView(
  onFinalize: (editedContent: string) => void
): { element: HTMLElement; update: (data: MinutesData | null) => void } {
  const el = document.createElement('div');
  el.className = 'panel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Acta formal');

  el.innerHTML = `
    <h2>Acta Formal</h2>
    <div class="minutes-display"></div>
    <div class="minutes-edit hidden">
      <textarea class="minutes-editor" aria-label="Editar acta formal"></textarea>
      <div style="margin-top:8px;display:flex;gap:8px;">
        <button class="btn btn-primary finalize-btn" type="button">Finalizar acta</button>
        <button class="btn btn-outline cancel-edit-btn" type="button">Cancelar</button>
      </div>
    </div>
    <div class="minutes-actions" style="margin-top:12px;"></div>
    <p class="empty-msg" style="color:var(--color-text-secondary);font-size:14px;">
      No hay acta generada. Genere una desde una transcripción completa.
    </p>
  `;

  const display = el.querySelector('.minutes-display') as HTMLElement;
  const editSection = el.querySelector('.minutes-edit') as HTMLElement;
  const textarea = el.querySelector('.minutes-editor') as HTMLTextAreaElement;
  const finalizeBtn = el.querySelector('.finalize-btn') as HTMLButtonElement;
  const cancelBtn = el.querySelector('.cancel-edit-btn') as HTMLButtonElement;
  const actionsEl = el.querySelector('.minutes-actions') as HTMLElement;
  const emptyMsg = el.querySelector('.empty-msg') as HTMLElement;

  let currentData: MinutesData | null = null;

  function renderDisplay(data: MinutesData): string {
    return `
      <div class="minutes-section">
        <h3>${escapeHtml(data.title)}</h3>
        <p style="font-size:13px;color:var(--color-text-secondary);">${escapeHtml(data.date)}</p>
      </div>
      <div class="minutes-section">
        <h3>Asistentes</h3>
        <ul>${data.attendees.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      </div>
      <div class="minutes-section">
        <h3>Temas tratados</h3>
        <ul>${data.topicsDiscussed.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </div>
      <div class="minutes-section">
        <h3>Decisiones</h3>
        <ul>${data.decisions.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
      </div>
      <div class="minutes-section">
        <h3>Accionables</h3>
        <ul>${data.actionItems.map(a =>
          `<li>${escapeHtml(a.description)} — <em>${escapeHtml(a.assignedToLabel)}</em></li>`
        ).join('')}</ul>
      </div>
    `;
  }

  function toPlainText(data: MinutesData): string {
    let text = `${data.title}\n${data.date}\n\n`;
    text += `Asistentes:\n${data.attendees.map(a => `- ${a}`).join('\n')}\n\n`;
    text += `Temas tratados:\n${data.topicsDiscussed.map(t => `- ${t}`).join('\n')}\n\n`;
    text += `Decisiones:\n${data.decisions.map(d => `- ${d}`).join('\n')}\n\n`;
    text += `Accionables:\n${data.actionItems.map(a => `- ${a.description} (${a.assignedToLabel})`).join('\n')}`;
    return text;
  }

  finalizeBtn.addEventListener('click', () => {
    onFinalize(textarea.value);
    editSection.classList.add('hidden');
    display.classList.remove('hidden');
    actionsEl.classList.add('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    editSection.classList.add('hidden');
    display.classList.remove('hidden');
    actionsEl.classList.remove('hidden');
  });

  function update(data: MinutesData | null): void {
    currentData = data;
    editSection.classList.add('hidden');

    if (!data) {
      display.innerHTML = '';
      actionsEl.innerHTML = '';
      emptyMsg.classList.remove('hidden');
      return;
    }

    emptyMsg.classList.add('hidden');
    display.innerHTML = renderDisplay(data);

    if (!data.finalized) {
      actionsEl.innerHTML = '';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline';
      editBtn.textContent = 'Editar antes de finalizar';
      editBtn.type = 'button';
      editBtn.addEventListener('click', () => {
        if (currentData) {
          textarea.value = toPlainText(currentData);
          display.classList.add('hidden');
          editSection.classList.remove('hidden');
          actionsEl.classList.add('hidden');
        }
      });
      actionsEl.appendChild(editBtn);
      actionsEl.classList.remove('hidden');
    } else {
      actionsEl.innerHTML = '<span style="color:var(--color-success);font-size:13px;">✓ Acta finalizada</span>';
      actionsEl.classList.remove('hidden');
    }
  }

  return { element: el, update };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

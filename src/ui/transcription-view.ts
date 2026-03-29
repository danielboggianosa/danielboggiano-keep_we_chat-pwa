/**
 * Transcription view component.
 * Displays transcription segments with speaker labels and timestamps.
 * Supports inline editing of segment text.
 * Requirements: 1.3, 8.3
 */

export interface TranscriptionSegmentData {
  speakerLabel: string;
  startTime: number;
  endTime: number;
  text: string;
}

export function createTranscriptionView(
  onEditSegment?: (index: number, newText: string) => void
): { element: HTMLElement; update: (segments: TranscriptionSegmentData[]) => void } {
  const el = document.createElement('div');
  el.className = 'panel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Transcripción');

  el.innerHTML = `
    <h2>Transcripción</h2>
    <div class="segments-container"></div>
    <p class="empty-msg" style="color:var(--color-text-secondary);font-size:14px;">
      No hay transcripción disponible. Inicie una grabación.
    </p>
  `;

  const container = el.querySelector('.segments-container') as HTMLElement;
  const emptyMsg = el.querySelector('.empty-msg') as HTMLElement;

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function update(segments: TranscriptionSegmentData[]): void {
    container.innerHTML = '';
    if (segments.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');

    segments.forEach((seg, i) => {
      const div = document.createElement('div');
      div.className = 'segment';

      const header = document.createElement('div');
      header.innerHTML = `
        <span class="segment-speaker">${escapeHtml(seg.speakerLabel)}</span>
        <span class="segment-time">${formatTime(seg.startTime)} — ${formatTime(seg.endTime)}</span>
      `;

      const textEl = document.createElement('div');
      textEl.className = 'segment-text';
      textEl.textContent = seg.text;

      if (onEditSegment) {
        textEl.contentEditable = 'true';
        textEl.setAttribute('role', 'textbox');
        textEl.setAttribute('aria-label', `Editar segmento de ${seg.speakerLabel}`);
        textEl.addEventListener('blur', () => {
          const newText = textEl.textContent?.trim() ?? '';
          if (newText !== seg.text) {
            onEditSegment(i, newText);
          }
        });
      }

      div.appendChild(header);
      div.appendChild(textEl);
      container.appendChild(div);
    });
  }

  return { element: el, update };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

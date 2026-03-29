/**
 * Recording panel component.
 * Provides recording controls with an active recording indicator.
 * Requirement 1.3: Visual indicator of active recording.
 */

export interface RecordingPanelState {
  isRecording: boolean;
  duration: number;
  source: 'microphone' | 'zoom' | 'teams' | 'google-meet';
}

export function createRecordingPanel(
  onStart: (source: string, language: string) => void,
  onStop: () => void
): { element: HTMLElement; update: (state: RecordingPanelState) => void } {
  const el = document.createElement('div');
  el.className = 'panel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Controles de grabación');

  el.innerHTML = `
    <h2>Grabación</h2>
    <div class="recording-status" aria-live="polite"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <select class="source-select" aria-label="Fuente de audio">
        <option value="microphone">Micrófono</option>
        <option value="zoom">Zoom</option>
        <option value="teams">Microsoft Teams</option>
        <option value="google-meet">Google Meet</option>
      </select>
      <select class="lang-select" aria-label="Idioma">
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <button class="btn btn-primary start-btn" type="button">Iniciar grabación</button>
      <button class="btn btn-danger stop-btn hidden" type="button">Detener</button>
    </div>
  `;

  const statusEl = el.querySelector('.recording-status') as HTMLElement;
  const startBtn = el.querySelector('.start-btn') as HTMLButtonElement;
  const stopBtn = el.querySelector('.stop-btn') as HTMLButtonElement;
  const sourceSelect = el.querySelector('.source-select') as HTMLSelectElement;
  const langSelect = el.querySelector('.lang-select') as HTMLSelectElement;

  startBtn.addEventListener('click', () => {
    onStart(sourceSelect.value, langSelect.value);
  });

  stopBtn.addEventListener('click', () => {
    onStop();
  });

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function update(state: RecordingPanelState): void {
    if (state.isRecording) {
      statusEl.innerHTML = `
        <div class="recording-indicator">
          <span class="dot" aria-hidden="true"></span>
          Grabando — ${formatDuration(state.duration)}
        </div>
      `;
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      sourceSelect.disabled = true;
      langSelect.disabled = true;
    } else {
      statusEl.innerHTML = '';
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      sourceSelect.disabled = false;
      langSelect.disabled = false;
    }
  }

  return { element: el, update };
}

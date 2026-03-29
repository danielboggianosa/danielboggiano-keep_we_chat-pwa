/**
 * Main app shell matching the KeepWeChat Pencil design.
 * Connects the full pipeline: Record → Live STT → Diarization → NLP → IndexedDB → UI.
 */

import { injectStyles } from './styles';
import { icons } from './icons';
import { createDashboardScreen } from './dashboard-screen';
import { createRecordingScreen } from './recording-screen';
import { createSearchScreen } from './search-screen';
import { createTranscriptionDetailScreen } from './transcription-detail-screen';
import { PipelineService } from './pipeline-service';
import { LiveTranscriber } from '../modules/live-transcriber';

export type ScreenId = 'home' | 'search' | 'calendar' | 'settings' | 'recording' | 'processing' | 'detail';

export interface AppUI {
  root: HTMLElement;
  navigateTo: (screen: ScreenId) => void;
}

const NAV_ITEMS: { id: ScreenId; icon: string; label: string }[] = [
  { id: 'home', icon: icons.house, label: 'Inicio' },
  { id: 'search', icon: icons.search, label: 'Buscar' },
  { id: 'calendar', icon: icons.calendar, label: 'Calendario' },
  { id: 'settings', icon: icons.settings, label: 'Ajustes' },
];

const SPEAKER_COLORS = ['var(--accent-coral)', 'var(--accent-indigo)', 'var(--accent-green)', 'var(--accent-orange)'];

export function createApp(): AppUI {
  injectStyles();

  const pipeline = new PipelineService();
  pipeline.init().catch(console.error);

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let liveSegmentCount = 0;

  const root = document.createElement('div');
  root.id = 'app-shell';
  root.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';

  // --- Screens ---
  const dashboard = createDashboardScreen({
    onRecordClick: () => startRecording(),
    onSearchClick: () => navigateTo('search'),
    onMeetingClick: (id: string) => showMeetingDetail(id),
    getMeetings: () => pipeline.getMeetings(),
  });

  const recording = createRecordingScreen({
    onBack: () => stopAndProcess(),
    onStop: () => stopAndProcess(),
    onPause: () => { /* future */ },
    onFlag: () => { /* future */ },
  });

  const searchScreen = createSearchScreen();

  const detail = createTranscriptionDetailScreen({
    onBack: () => {
      dashboard.refresh();
      navigateTo('home');
    },
    exportService: pipeline.exportService,
  });

  // Processing screen
  const processingScreen = document.createElement('div');
  processingScreen.className = 'screen';
  processingScreen.style.cssText = 'padding-bottom:0;';
  processingScreen.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-coral-light);
        display:flex;align-items:center;justify-content:center;">
        <div style="width:32px;height:32px;border:3px solid var(--accent-coral);
          border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
      </div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700;text-align:center;">
        Procesando grabación...
      </div>
      <div style="font-size:14px;color:var(--text-secondary);text-align:center;">
        Identificando hablantes y generando resumen.
      </div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;

  // Calendar placeholder
  const calendarScreen = document.createElement('div');
  calendarScreen.className = 'screen';
  calendarScreen.innerHTML = `
    <div class="settings-screen">
      <div class="settings-title">Calendario</div>
      <p style="color:var(--text-secondary);font-size:14px;">Próximamente: integración con Google Calendar y Microsoft Teams.</p>
    </div>`;

  // Settings placeholder
  const settingsScreen = document.createElement('div');
  settingsScreen.className = 'screen';
  settingsScreen.innerHTML = `
    <div class="settings-screen">
      <div class="settings-title">Ajustes</div>
      <p style="color:var(--text-secondary);font-size:14px;">Configuración de cuenta, idioma y preferencias.</p>
    </div>`;

  const screens = new Map<ScreenId, HTMLElement>([
    ['home', dashboard.element],
    ['search', searchScreen.element],
    ['calendar', calendarScreen],
    ['settings', settingsScreen],
    ['recording', recording.element],
    ['processing', processingScreen],
    ['detail', detail.element],
  ]);

  screens.forEach(s => root.appendChild(s));

  // --- Bottom nav ---
  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Navegación principal');

  const navButtons = new Map<ScreenId, HTMLButtonElement>();
  NAV_ITEMS.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.type = 'button';
    btn.innerHTML = `${item.icon}<span>${item.label}</span>`;
    btn.setAttribute('aria-label', item.label);
    btn.addEventListener('click', () => navigateTo(item.id));
    navButtons.set(item.id, btn);
    nav.appendChild(btn);
  });
  root.appendChild(nav);

  const fullscreenScreens: ScreenId[] = ['recording', 'processing', 'detail'];

  function navigateTo(screen: ScreenId): void {
    screens.forEach((el, id) => {
      el.classList.toggle('active', id === screen);
    });
    nav.style.display = fullscreenScreens.includes(screen) ? 'none' : 'flex';
    navButtons.forEach((btn, id) => {
      btn.classList.toggle('active', id === screen);
    });
  }

  async function startRecording(): Promise<void> {
    try {
      liveSegmentCount = 0;

      // Show speech API status
      const hasSpeechAPI = LiveTranscriber.isSupported();
      if (!hasSpeechAPI) {
        recording.updateSpeakerInfo('Sin reconocimiento de voz (navegador no compatible)');
      }

      await pipeline.startRecording('es', {
        onInterim: (text) => {
          // Show interim (partial) text in the live transcript area
          recording.updateInterim(text);
        },
        onSegment: (segment) => {
          // Show finalized segment in the live transcript
          liveSegmentCount++;
          const speakerIdx = (liveSegmentCount - 1) % SPEAKER_COLORS.length;
          const speakerLabel = `Hablante ${speakerIdx + 1}`;
          const color = SPEAKER_COLORS[speakerIdx];
          recording.addTranscriptLine(speakerLabel, segment.text, color);
          recording.updateSpeakerInfo(`${speakerLabel} detectado`);
        },
      });

      navigateTo('recording');
      recording.reset();
      if (hasSpeechAPI) {
        recording.updateSpeakerInfo('Escuchando...');
      }

      let elapsed = 0;
      timerInterval = setInterval(() => {
        elapsed++;
        recording.updateTimer(elapsed);
        recording.animateWaveform();
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`No se pudo iniciar la grabación: ${msg}`);
    }
  }

  async function stopAndProcess(): Promise<void> {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (!pipeline.activeSessionId) {
      navigateTo('home');
      return;
    }

    navigateTo('processing');

    try {
      const result = await pipeline.stopAndProcess();
      const meeting = pipeline.getMeeting(result.transcriptionId);
      if (meeting) {
        detail.show(meeting);
        navigateTo('detail');
      } else {
        dashboard.refresh();
        navigateTo('home');
      }
    } catch (err) {
      console.error('Processing failed:', err);
      alert(`Error al procesar: ${err instanceof Error ? err.message : String(err)}`);
      dashboard.refresh();
      navigateTo('home');
    }
  }

  function showMeetingDetail(meetingId: string): void {
    const meeting = pipeline.getMeeting(meetingId);
    if (meeting) {
      detail.show(meeting);
      navigateTo('detail');
    }
  }

  navigateTo('home');

  return { root, navigateTo };
}

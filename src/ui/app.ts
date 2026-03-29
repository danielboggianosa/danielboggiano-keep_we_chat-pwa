/**
 * Main app shell with tab-based navigation.
 * Wires together all UI panels into a single-page application.
 * Requirement 12.1: Responsive web app compatible with desktop, tablet, and mobile.
 */

import { injectStyles } from './styles';
import { createRecordingPanel, RecordingPanelState } from './recording-panel';
import { createTranscriptionView, TranscriptionSegmentData } from './transcription-view';
import { createSearchPanel, SearchFilters, SearchResultData } from './search-panel';
import { createExportPanel, ExportFormatOption } from './export-panel';
import { createEditHistory, EditHistoryEntry } from './edit-history';
import { createMinutesView, MinutesData } from './minutes-view';

export type TabId = 'recording' | 'transcription' | 'search' | 'export' | 'history' | 'minutes';

export interface AppCallbacks {
  onStartRecording: (source: string, language: string) => void;
  onStopRecording: () => void;
  onEditSegment: (index: number, newText: string) => void;
  onSearch: (filters: SearchFilters) => void;
  onExport: (format: ExportFormatOption) => void;
  onFinalizeMinutes: (content: string) => void;
}

export interface AppUI {
  root: HTMLElement;
  navigateTo: (tab: TabId) => void;
  updateRecording: (state: RecordingPanelState) => void;
  updateTranscription: (segments: TranscriptionSegmentData[]) => void;
  updateSearchResults: (results: SearchResultData[]) => void;
  updateEditHistory: (entries: EditHistoryEntry[]) => void;
  updateMinutes: (data: MinutesData | null) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'recording', label: 'Grabar' },
  { id: 'transcription', label: 'Transcripción' },
  { id: 'search', label: 'Buscar' },
  { id: 'export', label: 'Exportar' },
  { id: 'history', label: 'Historial' },
  { id: 'minutes', label: 'Acta' },
];

export function createApp(callbacks: AppCallbacks): AppUI {
  injectStyles();

  const root = document.createElement('div');
  root.id = 'app-shell';

  // Navigation
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Navegación principal');

  const title = document.createElement('span');
  title.className = 'nav-title';
  title.textContent = 'Transcripción';
  nav.appendChild(title);

  const tabButtons = new Map<TabId, HTMLButtonElement>();
  TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    btn.setAttribute('aria-label', `Ir a ${tab.label}`);
    tabButtons.set(tab.id, btn);
    nav.appendChild(btn);
  });

  root.appendChild(nav);

  // Content area
  const content = document.createElement('main');
  content.className = 'app-content';
  content.setAttribute('role', 'main');
  root.appendChild(content);

  // Create panels
  const recording = createRecordingPanel(callbacks.onStartRecording, callbacks.onStopRecording);
  const transcription = createTranscriptionView(callbacks.onEditSegment);
  const search = createSearchPanel(callbacks.onSearch);
  const exportPanel = createExportPanel(callbacks.onExport);
  const editHistory = createEditHistory();
  const minutesView = createMinutesView(callbacks.onFinalizeMinutes);

  const panels = new Map<TabId, HTMLElement>([
    ['recording', recording.element],
    ['transcription', transcription.element],
    ['search', search.element],
    ['export', exportPanel.element],
    ['history', editHistory.element],
    ['minutes', minutesView.element],
  ]);

  let activeTab: TabId = 'recording';

  function navigateTo(tab: TabId): void {
    activeTab = tab;
    tabButtons.forEach((btn, id) => {
      btn.classList.toggle('active', id === tab);
      btn.setAttribute('aria-current', id === tab ? 'page' : 'false');
    });
    content.innerHTML = '';
    const panel = panels.get(tab);
    if (panel) content.appendChild(panel);
  }

  // Wire tab clicks
  tabButtons.forEach((btn, id) => {
    btn.addEventListener('click', () => navigateTo(id));
  });

  // Start on recording tab
  navigateTo('recording');

  return {
    root,
    navigateTo,
    updateRecording: recording.update,
    updateTranscription: transcription.update,
    updateSearchResults: search.showResults,
    updateEditHistory: editHistory.update,
    updateMinutes: minutesView.update,
  };
}

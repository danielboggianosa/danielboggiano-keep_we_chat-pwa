/**
 * Application entry point.
 * Registers the Service Worker, initializes IndexedDB, and mounts the UI.
 */

import { registerServiceWorker } from './sw-register';
import { openDatabase } from './db/indexed-db';
import { createApp } from './ui/app';

async function init(): Promise<void> {
  // Initialize IndexedDB (creates stores on first run)
  await openDatabase();

  // Register Service Worker for offline support
  await registerServiceWorker();

  // Mount UI
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const app = createApp({
    onStartRecording: (source, language) => {
      console.log('Start recording:', source, language);
      app.updateRecording({ isRecording: true, duration: 0, source: source as 'microphone' });
    },
    onStopRecording: () => {
      console.log('Stop recording');
      app.updateRecording({ isRecording: false, duration: 0, source: 'microphone' });
    },
    onEditSegment: (index, newText) => {
      console.log('Edit segment:', index, newText);
    },
    onSearch: (filters) => {
      console.log('Search:', filters);
      app.updateSearchResults([]);
    },
    onExport: (format) => {
      console.log('Export:', format);
    },
    onFinalizeMinutes: (content) => {
      console.log('Finalize minutes:', content);
    },
  });

  appEl.appendChild(app.root);
}

init().catch(console.error);

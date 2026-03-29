/**
 * Application entry point.
 * Registers the Service Worker, initializes IndexedDB, and mounts the UI.
 */

import { registerServiceWorker } from './sw-register';
import { openDatabase } from './db/indexed-db';
import { createApp } from './ui/app';

async function init(): Promise<void> {
  await openDatabase();
  await registerServiceWorker();

  const appEl = document.getElementById('app');
  if (!appEl) return;

  const app = createApp();
  appEl.appendChild(app.root);
}

init().catch(console.error);

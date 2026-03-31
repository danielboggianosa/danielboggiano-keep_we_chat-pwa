/**
 * Service Worker registration utility with update notification handling.
 */

export interface SWUpdateCallback {
  /** Called when a new SW version is available and ready to activate */
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  /** Called when a background sync permanently fails */
  onSyncFailed?: (url: string, method: string) => void;
}

/**
 * Registers the Service Worker and sets up update notification handling.
 *
 * When a new SW version is detected, the `onUpdateAvailable` callback is invoked
 * so the UI can show an "Update available" banner.
 *
 * The user can trigger the update by calling `applyUpdate(registration)`.
 */
export async function registerServiceWorker(
  callbacks?: SWUpdateCallback
): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported in this browser.');
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service Worker registered with scope:', registration.scope);

    // Listen for new SW versions waiting to activate
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // A new SW is installed and waiting — notify the UI
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW Register] New Service Worker version available.');
          callbacks?.onUpdateAvailable?.(registration);
        }
      });
    });

    // Listen for messages from the SW (update notifications, sync failures)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (!event.data) return;

      if (event.data.type === 'SW_UPDATED') {
        console.log(`[SW Register] SW updated to version ${event.data.version}`);
        callbacks?.onUpdateAvailable?.(registration);
      }

      if (event.data.type === 'SYNC_FAILED') {
        console.warn(`[SW Register] Sync failed for ${event.data.method} ${event.data.url}`);
        callbacks?.onSyncFailed?.(event.data.url, event.data.method);
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return undefined;
  }
}

/**
 * Tells the waiting Service Worker to skip waiting and take control.
 * Call this when the user clicks "Update" in the update banner.
 */
export function applyUpdate(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  // Reload the page to use the new SW
  window.location.reload();
}

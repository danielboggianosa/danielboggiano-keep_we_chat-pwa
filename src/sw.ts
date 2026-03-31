/**
 * Service Worker for KeepWeChat PWA.
 *
 * Caching strategies:
 * - Static assets (JS, CSS, HTML, images, fonts): Cache-first with versioned cache
 * - API requests (/api/*): Network-first with 5s timeout and cache fallback
 * - Offline fallback: /offline.html for uncached navigation routes
 *
 * Background sync:
 * - Queues failed sync requests with tag 'sync-pending'
 * - Retries with exponential backoff (max 5 retries)
 *
 * Update notification:
 * - Sends message to clients when new SW version activates
 */

declare const self: ServiceWorkerGlobalScope;

// --- Cache Configuration ---

const CACHE_VERSION = '1';
const STATIC_CACHE = `static-v${CACHE_VERSION}`;
const API_CACHE = 'api-cache';
const OFFLINE_CACHE = 'offline-fallback';

const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  OFFLINE_URL,
];

const STATIC_ASSET_REGEX = /\.(js|css|html|svg|woff2?|png|jpg|jpeg|gif|webp|ico)(\?.*)?$/;
const API_REGEX = /\/api\//;

const NETWORK_TIMEOUT_MS = 5000;

// --- Background Sync Configuration ---

const SYNC_TAG = 'sync-pending';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

interface QueuedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
  retryCount: number;
}

/** In-memory queue for failed sync requests (persisted via IDB in production, simplified here) */
let syncQueue: QueuedRequest[] = [];

// --- Install Event ---

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);

      // Also cache offline page in its own cache for reliability
      const offlineCache = await caches.open(OFFLINE_CACHE);
      await offlineCache.add(OFFLINE_URL);

      // Activate immediately without waiting for existing clients to close
      await self.skipWaiting();
    })()
  );
});

// --- Activate Event ---

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old static caches (different version)
            if (name.startsWith('static-v') && name !== STATIC_CACHE) return true;
            // Keep api-cache and offline-fallback
            if (name === API_CACHE || name === OFFLINE_CACHE) return false;
            // Delete any other unknown caches from previous SW versions
            if (name !== STATIC_CACHE) return true;
            return false;
          })
          .map((name) => caches.delete(name))
      );

      // Take control of all clients immediately
      await self.clients.claim();

      // Notify all clients that a new version is available
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'SW_UPDATED',
          version: CACHE_VERSION,
        });
      }
    })()
  );
});

// --- Fetch Event ---

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API requests: network-first with timeout
  if (API_REGEX.test(url.pathname)) {
    event.respondWith(networkFirstWithTimeout(request));
    return;
  }

  // Static assets: cache-first
  if (STATIC_ASSET_REGEX.test(url.pathname) || request.mode === 'navigate') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default: cache-first for everything else same-origin
  event.respondWith(cacheFirstStrategy(request));
});

// --- Sync Event (Background Sync) ---

// The 'sync' event is part of the Background Sync API, not yet in standard TS lib types.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

self.addEventListener('sync' as keyof ServiceWorkerGlobalScopeEventMap, ((event: SyncEvent) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncQueue());
  }
}) as EventListener);

// --- Message Event ---

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'QUEUE_SYNC') {
    const queuedRequest: QueuedRequest = event.data.request;
    syncQueue.push(queuedRequest);
    // Try to register for background sync
    registerBackgroundSync();
  }
});

// --- Cache Strategies ---

/**
 * Cache-first strategy for static assets.
 * Serves from cache if available, otherwise fetches from network and caches the response.
 * Falls back to offline page for navigation requests.
 */
async function cacheFirstStrategy(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // For navigation requests, serve the offline fallback page
    if (request.mode === 'navigate') {
      return serveOfflineFallback();
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network-first strategy with timeout for API requests.
 * Tries network with a 5s timeout, falls back to cache, then returns offline error.
 */
async function networkFirstWithTimeout(request: Request): Promise<Response> {
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed or timed out — try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // If this was a sync-type request, queue it for background sync
    if (isSyncableRequest(request)) {
      await queueFailedRequest(request);
    }

    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No hay conexión a internet' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Fetch with a timeout. Rejects if the network doesn't respond within the given ms.
 */
function fetchWithTimeout(request: Request, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

// --- Offline Fallback ---

async function serveOfflineFallback(): Promise<Response> {
  const offlineCached = await caches.match(OFFLINE_URL);
  if (offlineCached) {
    return offlineCached;
  }
  // Last resort: inline offline response
  return new Response(
    '<html><body><h1>Sin conexión</h1><p>No hay conexión a internet.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// --- Background Sync ---

/**
 * Determines if a failed request should be queued for background sync.
 * Only sync-related API requests (POST/PUT to sync, transcriptions, edits) are queued.
 */
function isSyncableRequest(request: Request): boolean {
  if (request.method !== 'POST' && request.method !== 'PUT') return false;
  const url = new URL(request.url);
  const syncPaths = ['/api/sync', '/api/transcriptions', '/api/nlp/', '/api/stt/'];
  return syncPaths.some((path) => url.pathname.startsWith(path));
}

/**
 * Queues a failed request for later retry via background sync.
 */
async function queueFailedRequest(request: Request): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: string | null = null;
    try {
      body = await request.clone().text();
    } catch {
      // Body may not be readable
    }

    const queuedRequest: QueuedRequest = {
      url: request.url,
      method: request.method,
      headers,
      body,
      timestamp: Date.now(),
      retryCount: 0,
    };

    syncQueue.push(queuedRequest);
    await registerBackgroundSync();
  } catch (err) {
    console.error('[SW] Failed to queue request for sync:', err);
  }
}

/**
 * Registers for background sync if the API is available.
 */
async function registerBackgroundSync(): Promise<void> {
  try {
    const registration = self.registration;
    if ('sync' in registration) {
      await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(SYNC_TAG);
    }
  } catch (err) {
    console.warn('[SW] Background sync registration failed:', err);
  }
}

/**
 * Processes the sync queue: retries each queued request with exponential backoff.
 */
async function processSyncQueue(): Promise<void> {
  const pending = [...syncQueue];
  syncQueue = [];

  for (const item of pending) {
    const success = await retryWithBackoff(item);
    if (!success) {
      // Re-queue if not exhausted
      if (item.retryCount < MAX_RETRIES) {
        syncQueue.push(item);
      } else {
        console.warn('[SW] Dropping request after max retries:', item.url);
        // Notify client about permanently failed sync
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({
            type: 'SYNC_FAILED',
            url: item.url,
            method: item.method,
          });
        }
      }
    }
  }

  // If there are still items in the queue, re-register sync
  if (syncQueue.length > 0) {
    await registerBackgroundSync();
  }
}

/**
 * Retries a queued request with exponential backoff.
 * Returns true if the request succeeded, false otherwise.
 */
async function retryWithBackoff(item: QueuedRequest): Promise<boolean> {
  const delay = BASE_DELAY_MS * Math.pow(2, item.retryCount);

  // Wait for the backoff delay
  await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    const init: RequestInit = {
      method: item.method,
      headers: item.headers,
    };
    if (item.body && item.method !== 'GET' && item.method !== 'HEAD') {
      init.body = item.body;
    }

    const response = await fetch(item.url, init);
    if (response.ok) {
      return true;
    }

    // Server error — increment retry count
    item.retryCount++;
    return false;
  } catch {
    // Network error — increment retry count
    item.retryCount++;
    return false;
  }
}

export {};

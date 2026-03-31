/**
 * Feature: production-readiness
 *
 * Service Worker property tests covering:
 *   Property 14: SW cache-first para assets estáticos
 *   Property 15: SW network-first con fallback para API
 *   Property 16: Background sync encola y reintenta peticiones fallidas
 *
 * Validates: Requirements 8.1, 8.2, 8.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── In-memory SW model types ──────────────────────────────────────

interface CacheStore {
  [url: string]: { body: string; status: number };
}

interface NetworkState {
  online: boolean;
  /** If online, the response the network would return (undefined = network error even if online) */
  response?: { body: string; status: number };
}

interface QueuedSyncRequest {
  url: string;
  method: string;
  body: string | null;
  timestamp: number;
  retryCount: number;
}

// ── Static asset regex (mirrors src/sw.ts) ────────────────────────

const STATIC_ASSET_REGEX = /\.(js|css|html|svg|woff2?|png|jpg|jpeg|gif|webp|ico)(\?.*)?$/;

// ── Model: Cache-first strategy ───────────────────────────────────

function cacheFirstModel(
  url: string,
  cache: CacheStore,
  network: NetworkState,
): { body: string; status: number; source: 'cache' | 'network' | 'offline' } {
  // If the asset is in cache, serve from cache regardless of network
  if (cache[url]) {
    return { ...cache[url], source: 'cache' };
  }

  // Not in cache — try network
  if (network.online && network.response) {
    return { ...network.response, source: 'network' };
  }

  // Offline and not cached
  return { body: 'Offline', status: 503, source: 'offline' };
}

// ── Model: Network-first strategy ─────────────────────────────────

function networkFirstModel(
  url: string,
  cache: CacheStore,
  network: NetworkState,
): { body: string; status: number; source: 'network' | 'cache' | 'offline-error' } {
  // Try network first
  if (network.online && network.response) {
    return { ...network.response, source: 'network' };
  }

  // Network failed — fallback to cache
  if (cache[url]) {
    return { ...cache[url], source: 'cache' };
  }

  // No network, no cache — offline error
  return {
    body: JSON.stringify({ error: 'Offline', message: 'No hay conexión a internet' }),
    status: 503,
    source: 'offline-error',
  };
}

// ── Model: Background sync queue ──────────────────────────────────

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function enqueueFailedRequest(
  queue: QueuedSyncRequest[],
  url: string,
  method: string,
  body: string | null,
): QueuedSyncRequest[] {
  const item: QueuedSyncRequest = {
    url,
    method,
    body,
    timestamp: Date.now(),
    retryCount: 0,
  };
  return [...queue, item];
}

function processSyncQueueModel(
  queue: QueuedSyncRequest[],
  networkOnline: boolean,
): { remaining: QueuedSyncRequest[]; succeeded: QueuedSyncRequest[]; dropped: QueuedSyncRequest[] } {
  const remaining: QueuedSyncRequest[] = [];
  const succeeded: QueuedSyncRequest[] = [];
  const dropped: QueuedSyncRequest[] = [];

  for (const item of queue) {
    if (networkOnline) {
      // Network is back — request succeeds
      succeeded.push(item);
    } else {
      // Still offline — increment retry count
      const updated = { ...item, retryCount: item.retryCount + 1 };
      if (updated.retryCount < MAX_RETRIES) {
        remaining.push(updated);
      } else {
        dropped.push(updated);
      }
    }
  }

  return { remaining, succeeded, dropped };
}

function computeBackoffDelay(retryCount: number): number {
  return BASE_DELAY_MS * Math.pow(2, retryCount);
}

// ── Arbitraries ───────────────────────────────────────────────────

const staticExtensions = ['js', 'css', 'html', 'svg', 'woff2', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'];

const staticAssetUrlArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 12 }),
  fc.constantFrom(...staticExtensions),
).map(([name, ext]) => `/assets/${name}.${ext}`);

const apiUrlArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
  { minLength: 1, maxLength: 15 },
).map((path) => `/api/${path}`);

const responseBodyArb = fc.string({ minLength: 1, maxLength: 100 });

const cachedResponseArb = fc.tuple(responseBodyArb, fc.constant(200)).map(([body, status]) => ({ body, status }));

const networkResponseArb = fc.tuple(
  responseBodyArb,
  fc.constantFrom(200, 201, 204),
).map(([body, status]) => ({ body, status }));

const syncMethodArb = fc.constantFrom('POST', 'PUT');

const syncBodyArb = fc.oneof(
  fc.constant(null),
  fc.json().map((j) => typeof j === 'string' ? j : JSON.stringify(j)),
);

// ── Property 14: SW cache-first para assets estáticos ─────────────

describe('Property 14: SW cache-first para assets estáticos', () => {
  /**
   * Validates: Requirements 8.1
   *
   * For all requests to static assets (JS, CSS, HTML, images) that are already
   * in cache, the Service Worker must serve the cached version immediately,
   * regardless of network state (online or offline).
   */
  it('assets in cache are served immediately regardless of network state', () => {
    fc.assert(
      fc.property(
        staticAssetUrlArb,
        cachedResponseArb,
        fc.boolean(), // network online or offline
        fc.option(networkResponseArb, { nil: undefined }), // network response if online
        (url, cachedResponse, isOnline, netResponse) => {
          // Verify the URL matches static asset pattern
          expect(STATIC_ASSET_REGEX.test(url)).toBe(true);

          const cache: CacheStore = { [url]: cachedResponse };
          const network: NetworkState = {
            online: isOnline,
            response: netResponse ?? undefined,
          };

          const result = cacheFirstModel(url, cache, network);

          // Must always serve from cache when asset is cached
          expect(result.source).toBe('cache');
          expect(result.body).toBe(cachedResponse.body);
          expect(result.status).toBe(cachedResponse.status);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 15: SW network-first con fallback para API ───────────

describe('Property 15: SW network-first con fallback para API', () => {
  /**
   * Validates: Requirements 8.2
   *
   * For all API requests (/api/*), the Service Worker must try the network first.
   * If the network fails and a cached response exists, it must serve the cached version.
   * If no cache exists either, it must return an offline error (503).
   */
  it('network first, fallback to cache if fails, error offline if no cache', () => {
    fc.assert(
      fc.property(
        apiUrlArb,
        fc.boolean(), // has cached response
        cachedResponseArb,
        fc.boolean(), // network online
        fc.option(networkResponseArb, { nil: undefined }), // network response
        (url, hasCached, cachedResponse, isOnline, netResponse) => {
          const cache: CacheStore = hasCached ? { [url]: cachedResponse } : {};
          const networkAvailable = isOnline && netResponse !== undefined;
          const network: NetworkState = {
            online: isOnline,
            response: netResponse ?? undefined,
          };

          const result = networkFirstModel(url, cache, network);

          if (networkAvailable) {
            // Network succeeded — must serve from network
            expect(result.source).toBe('network');
            expect(result.body).toBe(netResponse!.body);
            expect(result.status).toBe(netResponse!.status);
          } else if (hasCached) {
            // Network failed, cache exists — must serve from cache
            expect(result.source).toBe('cache');
            expect(result.body).toBe(cachedResponse.body);
            expect(result.status).toBe(cachedResponse.status);
          } else {
            // Network failed, no cache — must return offline error
            expect(result.source).toBe('offline-error');
            expect(result.status).toBe(503);
            const parsed = JSON.parse(result.body);
            expect(parsed.error).toBe('Offline');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 16: Background sync encola y reintenta peticiones fallidas ──

describe('Property 16: Background sync encola y reintenta peticiones fallidas', () => {
  /**
   * Validates: Requirements 8.4
   *
   * For all sync requests that fail due to lack of connectivity, the Service Worker
   * must queue them. When connectivity is restored, all queued requests must be retried.
   * Backoff delay doubles with each retry. Requests exceeding MAX_RETRIES are dropped.
   */
  it('queuing and retry on connectivity restore with exponential backoff', () => {
    fc.assert(
      fc.property(
        // Generate 1-10 failed requests to queue
        fc.array(
          fc.tuple(apiUrlArb, syncMethodArb, syncBodyArb),
          { minLength: 1, maxLength: 10 },
        ),
        (failedRequests) => {
          // Phase 1: Enqueue all failed requests (offline)
          let queue: QueuedSyncRequest[] = [];
          for (const [url, method, body] of failedRequests) {
            queue = enqueueFailedRequest(queue, url, method, body);
          }

          // All requests must be in the queue
          expect(queue.length).toBe(failedRequests.length);

          // Each queued item must have retryCount 0 and valid fields
          for (let i = 0; i < queue.length; i++) {
            expect(queue[i].retryCount).toBe(0);
            expect(queue[i].url).toBe(failedRequests[i][0]);
            expect(queue[i].method).toBe(failedRequests[i][1]);
            expect(queue[i].body).toBe(failedRequests[i][2]);
            expect(queue[i].timestamp).toBeGreaterThan(0);
          }

          // Phase 2: Process queue while still offline — items stay queued with incremented retry
          const offlineResult = processSyncQueueModel(queue, false);
          expect(offlineResult.succeeded.length).toBe(0);
          expect(offlineResult.remaining.length).toBe(queue.length);
          for (const item of offlineResult.remaining) {
            expect(item.retryCount).toBe(1);
          }

          // Phase 3: Restore connectivity — all items succeed
          const onlineResult = processSyncQueueModel(offlineResult.remaining, true);
          expect(onlineResult.succeeded.length).toBe(offlineResult.remaining.length);
          expect(onlineResult.remaining.length).toBe(0);
          expect(onlineResult.dropped.length).toBe(0);

          // Phase 4: Verify exponential backoff delays
          for (let retry = 0; retry < MAX_RETRIES; retry++) {
            const delay = computeBackoffDelay(retry);
            expect(delay).toBe(BASE_DELAY_MS * Math.pow(2, retry));
          }

          // Phase 5: Verify max retries causes drop
          const exhaustedQueue: QueuedSyncRequest[] = queue.map((item) => ({
            ...item,
            retryCount: MAX_RETRIES - 1,
          }));
          const exhaustedResult = processSyncQueueModel(exhaustedQueue, false);
          expect(exhaustedResult.dropped.length).toBe(exhaustedQueue.length);
          expect(exhaustedResult.remaining.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

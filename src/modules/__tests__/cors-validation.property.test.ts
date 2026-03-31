/**
 * Feature: production-readiness, Property 4: CORS rechaza orígenes no autorizados
 *
 * Validates: Requirements 1.8
 *
 * Property: For all HTTP requests with an Origin header that is NOT in the
 * list of authorized origins (defined in environment variables), the API
 * Gateway must NOT include the Access-Control-Allow-Origin header in the
 * response. Requests with an allowed origin receive the header. Requests
 * with no origin (server-to-server) are allowed.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── CORS Logic (mirrors services/api-gateway/src/middleware/cors.ts) ──

interface CorsResult {
  allowed: boolean;
  accessControlAllowOrigin?: string;
}

/**
 * Evaluates whether a request origin should be allowed based on the
 * configured list of allowed origins. Mirrors the cors middleware callback.
 */
function evaluateCors(
  allowedOrigins: string[],
  requestOrigin: string | undefined,
): CorsResult {
  // No origin header → server-to-server / curl / health checks → allow
  if (!requestOrigin) {
    return { allowed: true };
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return { allowed: true, accessControlAllowOrigin: requestOrigin };
  }

  // Origin not in allowed list → reject (no ACAO header)
  return { allowed: false };
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Generate a plausible origin URL like https://sub.domain.tld or http://localhost:PORT */
const originArb = fc.oneof(
  fc
    .record({
      protocol: fc.constantFrom('https', 'http'),
      subdomain: fc.stringMatching(/^[a-z]{2,8}$/),
      domain: fc.stringMatching(/^[a-z]{3,10}$/),
      tld: fc.constantFrom('com', 'org', 'net', 'io', 'dev', 'app'),
    })
    .map(({ protocol, subdomain, domain, tld }) => `${protocol}://${subdomain}.${domain}.${tld}`),
  fc
    .record({
      protocol: fc.constantFrom('https', 'http'),
      domain: fc.stringMatching(/^[a-z]{3,12}$/),
      tld: fc.constantFrom('com', 'org', 'net', 'io', 'dev'),
    })
    .map(({ protocol, domain, tld }) => `${protocol}://${domain}.${tld}`),
  fc
    .integer({ min: 1024, max: 65535 })
    .map((port) => `http://localhost:${port}`),
);

/** Generate a non-empty list of allowed origins (1-5 entries). */
const allowedOriginsArb = fc
  .array(originArb, { minLength: 1, maxLength: 5 })
  .map((origins) => [...new Set(origins)]); // deduplicate

// ── Property Test ─────────────────────────────────────────────────

describe('Property 4: CORS rechaza orígenes no autorizados', () => {
  it('unauthorized origins do not receive Access-Control-Allow-Origin; allowed origins and no-origin requests are permitted', () => {
    fc.assert(
      fc.property(
        allowedOriginsArb,
        originArb,
        (allowedOrigins, randomOrigin) => {
          const isAllowed = allowedOrigins.includes(randomOrigin);

          // ── Case 1: Request with the random origin ──
          const result = evaluateCors(allowedOrigins, randomOrigin);

          if (isAllowed) {
            // Allowed origin → must include ACAO header with the origin
            expect(result.allowed).toBe(true);
            expect(result.accessControlAllowOrigin).toBe(randomOrigin);
          } else {
            // Unauthorized origin → must NOT include ACAO header
            expect(result.allowed).toBe(false);
            expect(result.accessControlAllowOrigin).toBeUndefined();
          }

          // ── Case 2: No origin (server-to-server) → always allowed ──
          const noOriginResult = evaluateCors(allowedOrigins, undefined);
          expect(noOriginResult.allowed).toBe(true);

          // ── Case 3: A known allowed origin always passes ──
          const knownAllowed = allowedOrigins[0];
          const knownResult = evaluateCors(allowedOrigins, knownAllowed);
          expect(knownResult.allowed).toBe(true);
          expect(knownResult.accessControlAllowOrigin).toBe(knownAllowed);
        },
      ),
      { numRuns: 100 },
    );
  });
});

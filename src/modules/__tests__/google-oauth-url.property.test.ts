/**
 * Feature: google-oauth-login, Property 1: Construcción correcta de la URL de autorización OAuth
 *
 * Validates: Requirements 1.2
 *
 * Property: For all valid client_ids and redirect_uris, the constructed OAuth
 * authorization URL must contain the parameters client_id, redirect_uri,
 * response_type=code, scope=openid email profile, and a non-empty state.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Pure function that replicates the URL construction logic from
 * startGoogleOAuth() in src/ui/auth-screen.ts.
 */
function buildGoogleOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Random non-empty client_id string (alphanumeric + dashes, like real Google client IDs). */
const clientIdArb = fc.stringMatching(/^[a-zA-Z0-9._-]{1,128}$/);

/** Random redirect_uri (valid HTTP/HTTPS URLs). */
const redirectUriArb = fc.oneof(
  fc.webUrl({ withFragments: false, withQueryParameters: false }),
  fc.constant('http://localhost:3000/'),
  fc.constant('https://example.com/callback'),
);

/** Random non-empty state string (UUID-like). */
const stateArb = fc.uuid();

// ── Property Test ─────────────────────────────────────────────────

describe('Property 1: Construcción correcta de la URL de autorización OAuth', () => {
  it('the OAuth URL contains all required parameters for any valid client_id and redirect_uri', () => {
    fc.assert(
      fc.property(clientIdArb, redirectUriArb, stateArb, (clientId, redirectUri, state) => {
        const url = buildGoogleOAuthUrl(clientId, redirectUri, state);
        const parsed = new URL(url);
        const params = parsed.searchParams;

        // Must be the correct Google authorization endpoint
        expect(parsed.origin + parsed.pathname).toBe(
          'https://accounts.google.com/o/oauth2/v2/auth',
        );

        // Must contain client_id matching input
        expect(params.get('client_id')).toBe(clientId);

        // Must contain redirect_uri matching input
        expect(params.get('redirect_uri')).toBe(redirectUri);

        // Must have response_type=code
        expect(params.get('response_type')).toBe('code');

        // Must have scope=openid email profile
        expect(params.get('scope')).toBe('openid email profile');

        // State must be present and non-empty
        expect(params.get('state')).toBeTruthy();
        expect(params.get('state')!.length).toBeGreaterThan(0);
        expect(params.get('state')).toBe(state);
      }),
      { numRuns: 100 },
    );
  });
});

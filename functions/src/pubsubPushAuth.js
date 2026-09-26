/**
 * Verifies the OIDC token Pub/Sub attaches to authenticated push requests.
 *
 * With authentication enabled on a push subscription, Pub/Sub sends
 * `Authorization: Bearer <JWT>` signed by Google for a service account you
 * choose. Checking that token (signature, audience, issuer, and that it was
 * minted for *our* service account) proves the request came from our
 * subscription — unlike a `?token=` query secret, which ends up in request
 * logs and anywhere the URL is copied.
 *
 * Configuration (functions/.env, not secrets — both values are public):
 *   GMAIL_PUSH_OIDC_AUDIENCE     the audience set on the subscription
 *                                (defaults to the push endpoint URL)
 *   GMAIL_PUSH_SERVICE_ACCOUNT   the service account email it signs as
 *   GMAIL_PUSH_REQUIRE_OIDC=true once the subscription sends OIDC tokens,
 *                                stop accepting the legacy query token
 */

import { OAuth2Client } from 'google-auth-library';

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * @param {{ audience?: string, serviceAccountEmail?: string, client?: { verifyIdToken: Function } }} config
 * @returns {((authorizationHeader: unknown) => Promise<boolean>) | null}
 *   null when OIDC is not configured, so callers can tell "not set up"
 *   apart from "set up, and this request failed".
 */
export function createPubSubOidcVerifier({ audience, serviceAccountEmail, client = new OAuth2Client() } = {}) {
  if (!audience || !serviceAccountEmail) return null;

  return async function verify(authorizationHeader) {
    if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) return false;
    const idToken = authorizationHeader.slice('Bearer '.length).trim();
    if (!idToken) return false;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload() || {};
      return (
        GOOGLE_ISSUERS.has(payload.iss) &&
        payload.email === serviceAccountEmail &&
        payload.email_verified === true
      );
    } catch {
      return false;
    }
  };
}

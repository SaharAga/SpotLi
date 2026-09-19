/**
 * Gmail OAuth start + callback (onRequest handlers — a browser redirect
 * flow, not a callable API).
 *
 * Flow:
 *  1. Client calls a small onCall (createGmailOAuthStartHandler is exposed
 *     as an onCall too, see index.js) to mint a short-lived signed state
 *     token for its own uid (verified via Firebase Auth context, not a
 *     bare query param), then navigates the browser to the returned
 *     consent URL — OR the client redirects straight to `gmailOAuthStart`
 *     with its Firebase ID token in a POST body; either shape works, this
 *     app uses the onCall-mint-then-redirect shape so the ID token is never
 *     placed in a URL that ends up in server logs.
 *  2. Google redirects back to `gmailOAuthCallback` with `code` + `state`.
 *  3. The callback verifies `state`, exchanges `code` for tokens, stores
 *     the refresh token, registers `users.watch()`, and redirects the
 *     browser back to the app with `?gmail=connected` or `?gmail=error`.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { google } from 'googleapis';
import { createOAuth2Client, GMAIL_SCOPES, setGmailConnection } from './gmailAuth.js';
import { createStateToken, verifyStateToken } from './gmailStateToken.js';

/**
 * The app is reachable from more than one origin (production Hosting, the
 * `staging` Hosting channel), and the whole OAuth round trip is a full-page
 * navigation away from whichever one the user started on. Google's
 * `state` param is the only thing that survives that round trip, so the
 * origin the user should be sent back to is carried there (see
 * gmailStateToken.js) rather than assumed to always be APP_BASE_URL.
 *
 * Only accept an origin that's actually a Firebase Hosting origin for this
 * project — production, the default `web.app`/`firebaseapp.com` domains, or
 * a named preview/staging channel of them — never an arbitrary client-
 * supplied URL, which would otherwise turn this into an open redirect.
 * @param {string} appBaseUrl the trusted default (production) origin
 * @param {string} candidate the client-supplied origin to validate
 * @returns {string|null}
 */
export function validateReturnOrigin(appBaseUrl, candidate) {
  if (typeof candidate !== 'string' || !candidate) return null;
  let appHost;
  try {
    appHost = new URL(appBaseUrl).hostname;
  } catch {
    return null;
  }
  const projectId = appHost.split('.')[0].split('--')[0];
  if (!projectId) return null;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const allowedHostPattern = new RegExp(`^${projectId}(--[a-z0-9-]+)?\\.(web\\.app|firebaseapp\\.com)$`, 'i');
  if (!allowedHostPattern.test(url.hostname)) return null;

  return url.origin;
}

/**
 * onCall: mints a short-lived state token for the signed-in caller and
 * returns the Google consent URL to redirect to. Requires a verified
 * Firebase Auth context (request.auth), never a client-supplied uid.
 * @param {{ clientSecret: string }} deps
 */
export function createGmailOAuthStartHandler({ clientSecret }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const appBaseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const returnOrigin = validateReturnOrigin(appBaseUrl, request.data?.origin) || appBaseUrl;

    const state = createStateToken({ uid, secret: clientSecret, returnOrigin });
    const oauth2Client = createOAuth2Client({ clientSecret });
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      // Force showing the consent screen (and thus re-issuing a refresh
      // token) even for a user who has already granted this app access, and
      // prompt account selection so users can easily link additional Gmail inboxes.
      prompt: 'consent select_account',
      scope: GMAIL_SCOPES,
      state
    });

    return { url };
  };
}

/**
 * onRequest: Google redirects here with ?code=...&state=...
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string, runBackfill?: Function }} deps
 */
export function createGmailOAuthCallbackHandler({ db, clientSecret, runBackfill }) {
  return async function handler(req, res) {
    const appBaseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const { code, state, error } = req.query;

    let returnBaseUrl = appBaseUrl;
    let statePayload = null;

    if (state) {
      statePayload = verifyStateToken({ token: String(state), secret: clientSecret });
      if (statePayload?.returnOrigin) {
        // Re-validate rather than trust the token's returnOrigin blindly —
        // it's HMAC-signed so it can't have been tampered with, but this
        // keeps the allowlist logic in one place and covers an APP_BASE_URL
        // rotation between the start and callback requests.
        returnBaseUrl = validateReturnOrigin(appBaseUrl, statePayload.returnOrigin) || appBaseUrl;
      }
    }

    const redirectError = () => res.redirect(`${returnBaseUrl}/?gmail=error`);
    const redirectConnected = () => res.redirect(`${returnBaseUrl}/?gmail=connected`);

    try {
      if (error) {
        console.warn('[gmailOAuthCallback] Google returned an error:', error);
        return redirectError();
      }
      if (!code || !state) {
        return redirectError();
      }

      if (!statePayload) {
        console.warn('[gmailOAuthCallback] Invalid or expired state token');
        return redirectError();
      }
      const { uid } = statePayload;

      const oauth2Client = createOAuth2Client({ clientSecret });
      const { tokens } = await oauth2Client.getToken(String(code));
      if (!tokens.refresh_token) {
        // No refresh token means we can't sync in the background — this
        // shouldn't happen with prompt=consent+access_type=offline, but
        // fail loudly rather than silently storing an unusable connection.
        console.error('[gmailOAuthCallback] No refresh_token returned for uid', uid);
        return redirectError();
      }
      oauth2Client.setCredentials(tokens);

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const emailAddress = profile.data.emailAddress;

      const topicName = process.env.GMAIL_PUBSUB_TOPIC;
      let historyId = profile.data.historyId;
      let watchExpiration = null;

      if (topicName) {
        const watchRes = await gmail.users.watch({
          userId: 'me',
          requestBody: { topicName, labelIds: ['INBOX'], labelFilterAction: 'include' }
        });
        historyId = watchRes.data.historyId || historyId;
        watchExpiration = watchRes.data.expiration || null;
      } else {
        console.warn('[gmailOAuthCallback] GMAIL_PUBSUB_TOPIC not set — skipping watch registration');
      }

      const connectionId = await setGmailConnection({
        db,
        uid,
        data: {
          refreshToken: tokens.refresh_token,
          emailAddress,
          historyId: historyId ? String(historyId) : null,
          watchExpiration,
          connectedAt: new Date().toISOString(),
          status: 'active',
          lastRenewalError: null
        }
      });

      if (typeof runBackfill === 'function') {
        // Fire-and-forget: don't hold up the redirect on the backfill scan.
        // The client also triggers gmailBackfill itself after redirect-back
        // as a belt-and-suspenders retry in case this in-process call is
        // killed by the function's own response/timeout.
        runBackfill({ uid, connectionId, refreshToken: tokens.refresh_token, emailAddress }).catch((err) =>
          console.error('[gmailOAuthCallback] Background backfill failed:', err)
        );
      }

      return redirectConnected();
    } catch (err) {
      console.error('[gmailOAuthCallback] Error handling callback:', err);
      return redirectError();
    }
  };
}

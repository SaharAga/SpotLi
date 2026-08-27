import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createParseWithAiHandler } from './handler.js';
import { createInboundEmailHandler } from './inboundEmailHandler.js';
import { gmailOAuthClientSecret } from './gmailAuth.js';
import { createGmailOAuthStartHandler, createGmailOAuthCallbackHandler } from './gmailOAuthCallback.js';
import { createGmailPushHandler } from './gmailPushHandler.js';
import { createGmailBackfillHandler, runBackfillForUser } from './gmailBackfill.js';
import { createGmailWatchRenewalHandler } from './gmailWatchRenewal.js';
import { createGmailDisconnectHandler } from './gmailDisconnect.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
// Shared-secret query param that authorizes calls to the Pub/Sub push
// endpoint — see gmailPushHandler.js for why. Set on the Pub/Sub push
// subscription's endpoint URL as `?token=<value>`.
const gmailPushToken = defineSecret('GMAIL_PUSH_TOKEN');

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Structured extraction of package tracking details, either as a fallback
 * when the client-side regex parser (parseSmartText) finds nothing in
 * pasted text, or for a screenshot the client can't read at all. See
 * README.md "AI-assisted import" for the full design and cost guards.
 *
 * enforceAppCheck rejects requests that don't come from the real app build;
 * requiring sign-in (checked inside the handler) rules out anonymous
 * scripted abuse. Both are cheap, high-leverage guards against runaway
 * cost — see also the per-user/global daily caps in guards.js.
 */
export const parseWithAi = onCall(
  {
    enforceAppCheck: true,
    secrets: [geminiApiKey],
    // Structured extraction on a single message or image is fast; this
    // leaves headroom without letting a stuck call run indefinitely.
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (request) =>
    createParseWithAiHandler({
      db: getFirestore(),
      apiKey: geminiApiKey.value()
    })(request)
);

/**
 * Inbound Email Webhook.
 *
 * Ingests forwarded shipping emails sent to the manual/no-OAuth CloudMailin
 * fallback address (getIngestionEmailAddress in emailSyncService.js). Gmail
 * auto-sync no longer sends mail here — see gmailPushHandler below.
 */
export const inboundEmailWebhook = onRequest(
  {
    cors: false,
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  createInboundEmailHandler({
    db: getFirestore()
  })
);

/**
 * Gmail OAuth: onCall that mints a short-lived signed state token for the
 * signed-in caller and returns the Google consent URL to redirect to.
 */
export const gmailOAuthStart = onCall(
  {
    enforceAppCheck: true,
    secrets: [gmailOAuthClientSecret],
    timeoutSeconds: 15,
    memory: '128MiB'
  },
  (request) =>
    createGmailOAuthStartHandler({
      clientSecret: gmailOAuthClientSecret.value()
    })(request)
);

/**
 * Gmail OAuth: browser-redirect callback Google sends the user back to
 * with `?code=&state=`. Exchanges the code, stores the refresh token,
 * registers push notifications (users.watch), kicks off the 30-day
 * backfill, and redirects to the app with `?gmail=connected|error`.
 */
export const gmailOAuthCallback = onRequest(
  {
    cors: false,
    secrets: [gmailOAuthClientSecret],
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (req, res) =>
    createGmailOAuthCallbackHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value(),
      runBackfill: ({ uid }) =>
        getFirestore()
          .collection('gmailConnections')
          .doc(uid)
          .get()
          .then((snap) =>
            runBackfillForUser({
              db: getFirestore(),
              uid,
              refreshToken: snap.data()?.refreshToken,
              clientSecret: gmailOAuthClientSecret.value()
            })
          )
    })(req, res)
);

/**
 * Pub/Sub push endpoint for Gmail `users.watch()` notifications — real-time
 * delivery of newly arrived mail for connected accounts. See
 * gmailPushHandler.js for the auth model (shared-secret query token).
 */
export const gmailPushNotification = onRequest(
  {
    cors: false,
    secrets: [gmailOAuthClientSecret, gmailPushToken],
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  (req, res) =>
    createGmailPushHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value(),
      pushToken: gmailPushToken.value()
    })(req, res)
);

/**
 * One-time 30-day historical backfill, callable by the client right after
 * the OAuth redirect-back completes (in addition to the best-effort
 * fire-and-forget run already kicked off by gmailOAuthCallback).
 */
export const gmailBackfill = onCall(
  {
    enforceAppCheck: true,
    secrets: [gmailOAuthClientSecret],
    // Scanning up to 100 messages one-by-one can take a while.
    timeoutSeconds: 180,
    memory: '256MiB'
  },
  (request) =>
    createGmailBackfillHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value()
    })(request)
);

/**
 * Weekly renewal of Gmail watch subscriptions (they expire after 7 days).
 * Requires a Cloud Scheduler job to actually invoke it — see deployment
 * checklist.
 */
export const gmailWatchRenewal = onSchedule(
  {
    schedule: 'every monday 03:00',
    timeZone: 'Etc/UTC',
    secrets: [gmailOAuthClientSecret],
    timeoutSeconds: 300,
    memory: '256MiB'
  },
  (event) =>
    createGmailWatchRenewalHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value()
    })(event)
);

/**
 * Disconnects a user's Gmail account: revokes the refresh token, cancels
 * the watch, deletes the stored gmailConnections/{uid} doc.
 */
export const gmailDisconnect = onCall(
  {
    enforceAppCheck: true,
    secrets: [gmailOAuthClientSecret],
    timeoutSeconds: 30,
    memory: '128MiB'
  },
  (request) =>
    createGmailDisconnectHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value()
    })(request)
);

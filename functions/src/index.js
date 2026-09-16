import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { createParseWithAiHandler } from './handler.js';
import { createInboundEmailHandler } from './inboundEmailHandler.js';
import { gmailOAuthClientSecret } from './gmailAuth.js';
import { createGmailOAuthStartHandler, createGmailOAuthCallbackHandler } from './gmailOAuthCallback.js';
import { createGmailPushHandler } from './gmailPushHandler.js';
import { createGmailBackfillHandler, runBackfillForUser } from './gmailBackfill.js';
import { createGmailWatchRenewalHandler } from './gmailWatchRenewal.js';
import { createGmailDisconnectHandler } from './gmailDisconnect.js';
import { createGmailConnectionStatusHandler } from './gmailConnectionStatus.js';
import { createFeatureAdoptionRollupHandler } from './featureAdoptionRollup.js';
import { createNewPackagePushHandler } from './newPackagePush.js';
import { createUpdatePackagePushHandler } from './updatePackagePush.js';
import { createCarrierTrackingHandler } from './carrierProxy.js';
import { createScheduledTrackingRefreshHandler } from './scheduledTrackingRefresh.js';
import { TRACKING_REFRESH_LIMITS } from './config.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const track17ApiKey = defineSecret('TRACK17_API_KEY');
// Shared-secret query param that authorizes calls to the Pub/Sub push
// endpoint — see gmailPushHandler.js for why. Set on the Pub/Sub push
// subscription's endpoint URL as `?token=<value>`.
const gmailPushToken = defineSecret('GMAIL_PUSH_TOKEN');
// Shared secret that authorizes the inbound-email forwarding webhook
// (CloudMailin/SendGrid/Mailgun/Postmark). Configured as `?token=<value>`
// on the provider's webhook URL and checked in inboundEmailHandler.js.
const inboundEmailToken = defineSecret('INBOUND_EMAIL_TOKEN');
// Web Push VAPID keypair — generate once with `npx web-push generate-vapid-keys`,
// store the private half as a secret, the public half also goes in the
// client's VITE_VAPID_PUBLIC_KEY (it's not sensitive, just an EC public key).
const vapidPrivateKey = defineSecret('VAPID_PRIVATE_KEY');
const vapidPublicKey = defineSecret('VAPID_PUBLIC_KEY');

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Structured extraction of package tracking details, either as a fallback
 * when the client-side regex parser (parseSmartText) finds nothing in
 * pasted text, or for a screenshot the client can't read at all. See
 * README.md "AI-assisted import" for the full design and cost guards.
 *
 * Requiring sign-in (checked inside the handler) rules out anonymous scripted
 * abuse, and the per-user/global daily caps in guards.js are the actual spend
 * ceiling. App Check would add proof the caller is the genuine app build; it
 * is currently off, for the reason recorded on the option below.
 */
export const parseWithAi = onCall(
  {
    // App Check is disabled here, deliberately and temporarily.
    //
    // The reCAPTCHA Enterprise provider never mints a token in production:
    // grecaptcha.enterprise.execute() does not resolve, so no assessment is
    // ever created (zero in 90 days across both keys) and no request ever
    // reached this function. With enforcement on and no token obtainable, it
    // rejects every call — AI text parsing and screenshot parsing both dead.
    //
    // The guards that actually carry the abuse case are unaffected:
    // assertAuthenticated (sign-in required), the per-user and global daily
    // call caps in guards.js (the real spend ceiling), and the payload size
    // limits. App Check adds proof the caller is the genuine app build, which
    // is worth having but not worth keeping the feature offline for.
    //
    // Restore to true only after App Check is re-registered AND its metrics
    // show assessments arriving. Enforcing before observing is what caused
    // this outage — see README "Abuse protection".
    enforceAppCheck: false,
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
    secrets: [inboundEmailToken],
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (req, res) =>
    createInboundEmailHandler({
      db: getFirestore(),
      webhookToken: inboundEmailToken.value()
    })(req, res)
);

/**
 * Gmail OAuth: onCall that mints a short-lived signed state token for the
 * signed-in caller and returns the Google consent URL to redirect to.
 */
export const gmailOAuthStart = onCall(
  {
    secrets: [gmailOAuthClientSecret],
    timeoutSeconds: 15,
    memory: '256MiB'
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
    secrets: [gmailOAuthClientSecret, geminiApiKey],
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
              clientSecret: gmailOAuthClientSecret.value(),
              geminiApiKey: geminiApiKey.value()
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
    secrets: [gmailOAuthClientSecret, gmailPushToken, geminiApiKey],
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  (req, res) =>
    createGmailPushHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value(),
      pushToken: gmailPushToken.value(),
      // Optional: the Gemini fallback (gmailAiFallback.js) simply doesn't
      // run without it, same as parseWithAi's own secret dependency.
      geminiApiKey: geminiApiKey.value()
    })(req, res)
);

/**
 * One-time 30-day historical backfill, callable by the client right after
 * the OAuth redirect-back completes (in addition to the best-effort
 * fire-and-forget run already kicked off by gmailOAuthCallback).
 */
export const gmailBackfill = onCall(
  {
    secrets: [gmailOAuthClientSecret, geminiApiKey],
    // Scanning up to 100 messages one-by-one can take a while.
    timeoutSeconds: 180,
    memory: '256MiB'
  },
  (request) =>
    createGmailBackfillHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value(),
      geminiApiKey: geminiApiKey.value()
    })(request)
);

/**
 * Daily renewal of Gmail watch subscriptions (they expire after 7 days from
 * whenever the user connected — not aligned to any fixed weekday). A weekly
 * schedule can miss a watch entirely depending on connect day, since a watch
 * expiring shortly after one run's 2-day lookahead window may have already
 * lapsed before the next run 7 days later. Daily closes that gap. Requires a
 * Cloud Scheduler job to actually invoke it — see deployment checklist.
 */
export const gmailWatchRenewal = onSchedule(
  {
    schedule: 'every day 03:00',
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
    secrets: [gmailOAuthClientSecret],
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (request) =>
    createGmailDisconnectHandler({
      db: getFirestore(),
      clientSecret: gmailOAuthClientSecret.value()
    })(request)
);

/**
 * Reports whether the signed-in caller has an active Gmail connection —
 * the client can't read gmailConnections/{uid} directly (refresh tokens
 * must never reach the browser), so this is the sanctioned way the UI
 * learns "is Gmail actually connected" after the OAuth redirect-back.
 */
export const gmailConnectionStatus = onCall(
  {
    timeoutSeconds: 15,
    // 128MiB was too tight for a Node 22 2nd-gen function pulling in the
    // Firebase Admin SDK — its first-ever deploy failed the Cloud Run
    // container healthcheck (never bound to the port within the startup
    // timeout). 256MiB matches every sibling onCall handler in this file.
    memory: '256MiB'
  },
  (request) =>
    createGmailConnectionStatusHandler({
      db: getFirestore()
    })(request)
);

/**
 * Daily rollup of the previous UTC day's featureUsage rows into
 * featureAdoptionStats (unique-user counts per feature), then deletes the
 * rolled-up raw rows — see featureAdoptionRollup.js for why "the day
 * after" and the actual privacy guarantee this provides. Scheduled after
 * gmailWatchRenewal so the two don't contend, though neither touches the
 * other's data.
 */
export const featureAdoptionRollup = onSchedule(
  {
    schedule: 'every day 04:00',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 300,
    memory: '256MiB'
  },
  () => createFeatureAdoptionRollupHandler({ db: getFirestore() })()
);

/**
 * Fires a Web Push notification whenever an automated ingestion source
 * (Gmail sync/backfill, forwarded-email webhook — see newPackagePush.js
 * for the exact source list) creates a new package doc, so the user finds
 * out in real time without having to open the app. Scoped to this single
 * Firestore path rather than hooked into each ingestion function
 * individually, since every one of them already writes here.
 */
export const notifyOnNewPackage = onDocumentCreated(
  {
    document: 'users/{uid}/packages/{packageId}',
    secrets: [vapidPrivateKey, vapidPublicKey],
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (event) =>
    createNewPackagePushHandler({
      db: getFirestore(),
      webpush,
      vapidPublicKey: vapidPublicKey.value(),
      vapidPrivateKey: vapidPrivateKey.value(),
      vapidSubject: 'mailto:support@spotliapp.com'
    })(event)
);

/**
 * Fires a Web Push notification whenever an existing package document is updated
 * with an advanced delivery status (out for delivery, ready for pickup, delivered),
 * an assigned locker PIN, or a rerouted pickup point.
 */
export const notifyOnPackageUpdated = onDocumentUpdated(
  {
    document: 'users/{uid}/packages/{packageId}',
    secrets: [vapidPrivateKey, vapidPublicKey],
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (event) =>
    createUpdatePackagePushHandler({
      db: getFirestore(),
      webpush,
      vapidPublicKey: vapidPublicKey.value(),
      vapidPrivateKey: vapidPrivateKey.value(),
      vapidSubject: 'mailto:support@spotliapp.com'
    })(event)
);

/**
 * Background tracking refresh.
 *
 * The counterpart to `queryCarrierTracking`: that one answers a user who is
 * looking at the app, this one runs when nobody is. It is the only path that
 * can notice a parcel was delivered when the courier's SMS carried no tracking
 * number to match on — and because it writes server-side with
 * `lastUpdateSource: 'live_tracking'`, `updatePackagePush` turns what it finds
 * into an actual notification.
 *
 * Cadence comes from TRACKING_REFRESH_LIMITS.INTERVAL_HOURS so it moves with
 * the budget it is paced against, rather than drifting from it.
 */
export const scheduledTrackingRefresh = onSchedule(
  {
    schedule: `every ${TRACKING_REFRESH_LIMITS.INTERVAL_HOURS} hours`,
    timeZone: 'Etc/UTC',
    secrets: [track17ApiKey],
    timeoutSeconds: 540,
    memory: '256MiB'
  },
  () =>
    createScheduledTrackingRefreshHandler({
      db: getFirestore(),
      track17ApiKey: track17ApiKey.value() || process.env.TRACK17_API_KEY || ''
    })()
);

/**
 * Live Carrier Tracking Proxy:
 * Queries live parcel checkpoints, customs status, and delivery milestones.
 *
 * 1. GAASH Worldwide is fully active ($0, direct WordPress REST API via gaashAdapter.js).
 * 2. Israel Post, GCX, and 30+ couriers are routed to 17TRACK API (v2.2) via `TRACK17_API_KEY`.
 */
export const queryCarrierTracking = onCall(
  {
    secrets: [track17ApiKey],
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (request) =>
    createCarrierTrackingHandler({
      db: getFirestore(),
      track17ApiKey: track17ApiKey.value() || process.env.TRACK17_API_KEY || ''
    })(request)
);


/**
 * Daily scheduled renewal of Gmail `users.watch()` subscriptions — Gmail
 * watches expire after 7 days regardless of activity, so anything nearing
 * expiration needs to be re-registered or push notifications silently stop.
 */

import { getGmailClientForUser, setGmailConnection, GMAIL_CONNECTIONS_COLLECTION } from './gmailAuth.js';
import { logUsageEvent } from './analyticsEvents.js';

const RENEW_WITHIN_MS = 2 * 24 * 60 * 60 * 1000; // renew anything expiring within 2 days

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string }} deps
 */
export function createGmailWatchRenewalHandler({ db, clientSecret }) {
  return async function handler() {
    const topicName = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topicName) {
      console.warn('[gmailWatchRenewal] GMAIL_PUBSUB_TOPIC not set — skipping run');
      return;
    }

    const snap = await db
      .collection(GMAIL_CONNECTIONS_COLLECTION)
      .where('status', '==', 'active')
      .get();

    const now = Date.now();
    let renewed = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const conn = doc.data();
      const expiration = conn.watchExpiration ? Number(conn.watchExpiration) : 0;
      if (expiration && expiration - now > RENEW_WITHIN_MS) continue; // not due yet

      try {
        const { gmail } = getGmailClientForUser({ clientSecret, refreshToken: conn.refreshToken });
        const watchRes = await gmail.users.watch({
          userId: 'me',
          requestBody: { topicName, labelIds: ['INBOX'], labelFilterAction: 'include' }
        });
        await setGmailConnection({
          db,
          uid: doc.id,
          data: {
            historyId: watchRes.data.historyId ? String(watchRes.data.historyId) : conn.historyId,
            watchExpiration: watchRes.data.expiration || null,
            lastRenewalError: null
          }
        });
        renewed += 1;
      } catch (err) {
        console.error(`[gmailWatchRenewal] Failed to renew watch for uid ${doc.id}:`, err);
        failed += 1;
        // Surface on the connection doc so a persistently failing renewal is
        // visible to the app (e.g. IngestionGuideModal) instead of only
        // living in Cloud Function logs — a lapsed watch otherwise fails
        // silently from the user's point of view.
        await setGmailConnection({
          db,
          uid: doc.id,
          data: { lastRenewalError: String(err?.message || err) }
        }).catch(() => {});
      }
    }

    console.log(`[gmailWatchRenewal] renewed=${renewed} failed=${failed} total=${snap.size}`);
    await logUsageEvent(db, {
      feature: 'gmail_sync',
      type: 'watch_renewal',
      renewed,
      failed,
      total: snap.size
    });
  };
}

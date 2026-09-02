/**
 * Server-side Web Push sending, backing the client's already-built
 * PushManager subscription flow (src/services/notificationService.js) and
 * service worker `push` handler (public/sw.js) — those two pieces existed
 * with nothing on the server ever calling them.
 *
 * Subscriptions are stored per-device at
 * `pushSubscriptions/{uid}/tokens/{tokenId}` (tokenId derived from the
 * subscription endpoint, so re-subscribing the same device overwrites
 * rather than duplicates) — never readable by the client SDK (see
 * firestore.rules), only written by the owning user and read here via the
 * Admin SDK.
 */

import { createHash } from 'node:crypto';

export const PUSH_SUBSCRIPTIONS_COLLECTION = 'pushSubscriptions';

/**
 * Deterministic doc id for a subscription, derived from its endpoint (the
 * part of a PushSubscription that uniquely identifies a device+browser
 * registration) so re-subscribing overwrites the same doc instead of
 * accumulating duplicates.
 * @param {string} endpoint
 */
export function subscriptionDocId(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 40);
}

/**
 * Sends a Web Push notification to every device the user has subscribed
 * from. A subscription that the push service reports as gone (410/404 — the
 * user uninstalled the PWA, cleared site data, etc.) is deleted so it stops
 * being retried on every future notification.
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   uid: string,
 *   payload: object,
 *   webpush: { sendNotification: Function, setVapidDetails: Function },
 *   vapidPublicKey: string,
 *   vapidPrivateKey: string,
 *   vapidSubject: string
 * }} params
 * @returns {Promise<{ sent: number, removed: number }>}
 */
export async function sendPushToUser({ db, uid, payload, webpush, vapidPublicKey, vapidPrivateKey, vapidSubject }) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[pushNotifications] VAPID keys not configured — skipping push');
    return { sent: 0, removed: 0 };
  }

  const tokensSnap = await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(uid).collection('tokens').get();
  if (tokensSnap.empty) return { sent: 0, removed: 0 };

  webpush.setVapidDetails(vapidSubject || 'mailto:support@deliveree.app', vapidPublicKey, vapidPrivateKey);

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    tokensSnap.docs.map(async (doc) => {
      const subscription = doc.data();
      try {
        await webpush.sendNotification(subscription, body);
        sent += 1;
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await doc.ref.delete();
          removed += 1;
        } else {
          console.error('[pushNotifications] Send failed for', uid, statusCode, err?.message);
        }
      }
    })
  );

  return { sent, removed };
}

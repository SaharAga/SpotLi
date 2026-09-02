/**
 * Fires a Web Push notification when a package is created by an automated
 * ingestion source (Gmail sync/backfill, forwarded-email webhook) — the
 * whole reason those pipelines are unattended is so the user doesn't have
 * to open the app to find out about a new shipment; without this they had
 * no way to actually learn that in real time.
 *
 * Deliberately scoped by `source` rather than firing for every new package
 * doc: a package the user just typed in themselves (manual add / Smart
 * Import) was created by an action they're already looking at, so a push
 * about it would just be redundant noise.
 */

import { sendPushToUser } from './pushNotifications.js';
import { formatPushTitleAndBody } from './pushPayload.js';

const AUTOMATED_SOURCES = new Set(['gmail_sync', 'gmail_sync_order_status', 'gmail_sync_ai', 'email_forwarding']);

/**
 * @param {{ db: FirebaseFirestore.Firestore, webpush: object, vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string }} deps
 */
export function createNewPackagePushHandler({ db, webpush, vapidPublicKey, vapidPrivateKey, vapidSubject }) {
  return async function handler(event) {
    const pkg = event.data?.data();
    if (!pkg || !AUTOMATED_SOURCES.has(pkg.source)) return;

    const uid = event.params?.uid;
    if (!uid) return;

    const { title, body } = formatPushTitleAndBody(pkg);
    const payload = {
      title,
      body,
      packageId: pkg.id,
      trackingNumber: pkg.trackingNumber || null,
      url: pkg.id ? `/?packageId=${encodeURIComponent(pkg.id)}` : '/'
    };

    try {
      await sendPushToUser({ db, uid, payload, webpush, vapidPublicKey, vapidPrivateKey, vapidSubject });
    } catch (err) {
      // A push failure must never fail the write that created the package.
      console.error('[newPackagePush] Failed to send push for', uid, err?.message);
    }
  };
}

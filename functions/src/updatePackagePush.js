/**
 * Fires a Web Push notification when an *automated* ingestion source updates an
 * existing package with a meaningful lifecycle progression (status advance,
 * locker PIN, pickup location, or reroute).
 *
 * Scoped by `lastUpdateSource` for the same reason `newPackagePush` is scoped by
 * `source`: a change the user made themselves — editing a status, correcting a
 * pickup point, tapping refresh — happened on a screen they are already looking
 * at, so notifying them about it is redundant noise. Until this guard existed,
 * every manual status change pushed a notification back at the person who had
 * just made it.
 *
 * A Firestore trigger cannot see who wrote the document, so provenance has to
 * ride along on it. `source` is the wrong field: it records how a package was
 * *created* and survives every later merge, so a manual edit to a Gmail-created
 * package would still look automated. `lastUpdateSource` is per-write instead —
 * stamped by the server-side pipelines, and forced back to `null` by the
 * client's schema on every write it makes.
 */

import { sendPushToUser } from './pushNotifications.js';
import { formatUpdatePushTitleAndBody, getUserLanguage } from './pushPayload.js';
import { isAutomatedSource } from './automatedSources.js';

/**
 * Determines whether the difference between before and after warrants a push notification.
 * @param {object} before
 * @param {object} after
 * @returns {boolean}
 */
export function hasMeaningfulPackageUpdate(before, after) {
  if (!before || !after) return false;
  if (before.isArchived || after.isArchived) return false;

  // 1. Status advanced
  if (after.status && after.status !== before.status) {
    return true;
  }

  // 2. Locker PIN or pickup code arrived or changed
  const afterPin = after.lockerPin || after.pickupCode;
  const beforePin = before.lockerPin || before.pickupCode;
  if (afterPin && afterPin !== beforePin) {
    return true;
  }

  // 3. Rerouted
  if (after.isRedirected && !before.isRedirected) {
    return true;
  }

  // 4. Pickup location updated
  if (after.pickupLocation && after.pickupLocation !== before.pickupLocation) {
    return true;
  }

  return false;
}

/**
 * @param {{ db: FirebaseFirestore.Firestore, webpush: object, vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string }} deps
 */
export function createUpdatePackagePushHandler({ db, webpush, vapidPublicKey, vapidPrivateKey, vapidSubject }) {
  return async function handler(event) {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Fail closed: an unmarked write is treated as the user's own.
    if (!isAutomatedSource(after.lastUpdateSource)) return;
    if (!hasMeaningfulPackageUpdate(before, after)) return;

    const uid = event.params?.uid;
    if (!uid) return;

    const { title, body } = formatUpdatePushTitleAndBody(before, after, await getUserLanguage(db, uid));
    const payload = {
      title,
      body,
      packageId: after.id,
      trackingNumber: after.trackingNumber || null,
      status: after.status,
      url: after.id ? `/?packageId=${encodeURIComponent(after.id)}` : '/'
    };

    try {
      await sendPushToUser({ db, uid, payload, webpush, vapidPublicKey, vapidPrivateKey, vapidSubject });
    } catch (err) {
      // A push failure must never fail the Firestore write
      console.error('[updatePackagePush] Failed to send push for', uid, err?.message);
    }
  };
}

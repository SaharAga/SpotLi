/**
 * Fires a Web Push notification when an existing package is updated with
 * a meaningful lifecycle progression (status advance, locker PIN, pickup location, or reroute).
 */

import { sendPushToUser } from './pushNotifications.js';
import { formatUpdatePushTitleAndBody, getUserLanguage } from './pushPayload.js';

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

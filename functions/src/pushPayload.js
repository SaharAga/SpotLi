/**
 * Push notification copy, in the user's language.
 *
 * Kept server-side (not imported from the client's notificationService.js,
 * which is browser-only code) but deliberately mirrors its tone.
 *
 * Every string used to be emitted as `Hebrew | English` in one notification —
 * both halves, always, whichever language the person had chosen. Reported from
 * a real device. A notification is a one-line interruption on a lock screen;
 * spending half of it on a language the reader did not pick is the worst place
 * in the app to be bilingual.
 *
 * The language comes from `users/{uid}.preferences.language`, which the account
 * screen already writes. Anything unrecognised falls back to Hebrew: this is an
 * Israeli app, and a Hebrew notification to an English reader is a smaller
 * failure than a blank one.
 */

/** @param {string|null|undefined} language @returns {'he'|'en'} */
function resolveLanguage(language) {
  return language === 'en' ? 'en' : 'he';
}

/**
 * The language a user's notifications should be written in.
 *
 * Reads `users/{uid}.preferences.language`, which the account screen already
 * writes. Never throws and never blocks a notification: a lookup failure falls
 * back to Hebrew, because a push in the wrong language still tells someone
 * their package moved, and a push that never sends does not.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @returns {Promise<'he'|'en'>}
 */
export async function getUserLanguage(db, uid) {
  if (!db || !uid) return 'he';
  try {
    const snap = await db.collection('users').doc(uid).get();
    return resolveLanguage(snap.exists ? snap.data()?.preferences?.language : null);
  } catch (err) {
    console.warn('[pushPayload] Could not read language for', uid, err?.message);
    return 'he';
  }
}

/**
 * Copy for a newly-detected package.
 *
 * @param {object} pkg
 * @param {string} [language] 'he' | 'en'
 * @returns {{ title: string, body: string }}
 */
export function formatPushTitleAndBody(pkg, language) {
  const lang = resolveLanguage(language);
  const carrierLabel = pkg.carrier && pkg.carrier !== 'other' ? pkg.carrier.toUpperCase() : '';
  const suffix = carrierLabel ? ` (${carrierLabel})` : '';

  if (lang === 'en') {
    return {
      title: 'New Package Detected!',
      body: pkg.trackingNumber
        ? `${pkg.title || 'Shipment'} — ${pkg.trackingNumber}${suffix}`
        : pkg.title || 'A new order update arrived'
    };
  }

  return {
    title: 'חבילה חדשה זוהתה!',
    body: pkg.trackingNumber
      ? `${pkg.title || 'משלוח'} — ${pkg.trackingNumber}${suffix}`
      : pkg.title || 'התקבל עדכון חדש על הזמנה'
  };
}

/**
 * Copy for a package status or pickup update.
 *
 * The branch order is the priority order, and it is unchanged: a reroute
 * outranks a pickup code, which outranks a plain status change.
 *
 * @param {object} before
 * @param {object} after
 * @param {string} [language] 'he' | 'en'
 * @returns {{ title: string, body: string }}
 */
export function formatUpdatePushTitleAndBody(before = {}, after = {}, language) {
  const lang = resolveLanguage(language);
  const en = lang === 'en';
  const name = after.title || after.trackingNumber || (en ? 'Your package' : 'החבילה שלך');

  // 1. Rerouted to alternate pickup location
  if (after.isRedirected && !before.isRedirected) {
    const loc = after.pickupLocation ? `: ${after.pickupLocation}` : '';
    return en
      ? { title: 'Package Rerouted!', body: `${name} was rerouted to an alternate pickup point${loc}` }
      : { title: 'החבילה הועברה למיקום חדש!', body: `${name} הועברה לנקודת איסוף חלופית${loc}` };
  }

  // 2. Ready for pickup or new locker PIN arrived
  const pinArrived = (after.lockerPin && !before.lockerPin) || (after.pickupCode && !before.pickupCode);
  if (after.status === 'ready_for_pickup' || pinArrived) {
    const code = after.lockerPin || after.pickupCode || '';
    if (en) {
      const pin = after.lockerPin ? ` (PIN: ${code})` : (code ? ` (Code: ${code})` : '');
      const at = after.pickupLocation ? ` at ${after.pickupLocation}` : '';
      return { title: 'Ready for Pickup! 📍', body: `${name} is ready for pickup${at}${pin}` };
    }
    const pin = code ? ` (קוד: ${code})` : '';
    const at = after.pickupLocation ? ` ב-${after.pickupLocation}` : '';
    return { title: 'מוכן לאיסוף! 📍', body: `${name} ממתינה לאיסוף${at}${pin}` };
  }

  // 3. Out for delivery
  if (after.status === 'out_for_delivery' && before.status !== 'out_for_delivery') {
    return en
      ? { title: 'Out for Delivery Today! 🚚', body: `${name} is on its way to you today with courier` }
      : { title: 'יצא לחלוקה היום! 🚚', body: `${name} בדרך אליך עם שליח` };
  }

  // 4. Delivered
  if (after.status === 'delivered' && before.status !== 'delivered') {
    return en
      ? { title: 'Package Delivered! ✅', body: `${name} was successfully delivered` }
      : { title: 'החבילה נמסרה! ✅', body: `${name} נמסרה בהצלחה` };
  }

  // 5. Exception / Delay
  if (after.status === 'exception' && before.status !== 'exception') {
    return en
      ? { title: 'Important Shipment Update ⚠️', body: `${name} is delayed or requires attention` }
      : { title: 'עדכון חשוב על המשלוח ⚠️', body: `${name} מעוכבת או דורשת תשומת לב` };
  }

  // 6. Generic status change or pickup info update
  if (after.status && after.status !== before.status) {
    return en
      ? { title: 'Shipment Status Update', body: `${name}: status updated to ${after.status}` }
      : { title: 'עדכון סטטוס משלוח', body: `${name}: סטטוס עודכן ל-${after.status}` };
  }

  if (after.pickupLocation && after.pickupLocation !== before.pickupLocation) {
    return en
      ? { title: 'Pickup Location Updated', body: `${name}: pickup location updated to ${after.pickupLocation}` }
      : { title: 'עדכון מיקום איסוף', body: `${name}: מיקום מעודכן ל-${after.pickupLocation}` };
  }

  return en
    ? { title: 'Delivery Update', body: `${name}: a new update was received` }
    : { title: 'עדכון משלוח', body: `${name}: התקבל עדכון חדש` };
}

/**
 * Bilingual push notification copy for a newly-detected package. Kept
 * server-side (not imported from the client's notificationService.js,
 * which is browser-only code) but deliberately mirrors its tone.
 */
export function formatPushTitleAndBody(pkg) {
  const carrierLabel = pkg.carrier && pkg.carrier !== 'other' ? pkg.carrier.toUpperCase() : '';
  const title = 'חבילה חדשה זוהתה! | New Package Detected!';
  const bodyHe = pkg.trackingNumber
    ? `${pkg.title || 'משלוח'} — ${pkg.trackingNumber}${carrierLabel ? ` (${carrierLabel})` : ''}`
    : pkg.title || 'התקבל עדכון חדש על הזמנה';
  const bodyEn = pkg.trackingNumber
    ? `${pkg.title || 'Shipment'} — ${pkg.trackingNumber}${carrierLabel ? ` (${carrierLabel})` : ''}`
    : pkg.title || 'A new order update arrived';
  return { title, body: `${bodyHe} | ${bodyEn}` };
}

/**
 * Bilingual push notification copy for a package status or pickup update.
 * @param {object} before
 * @param {object} after
 * @returns {{ title: string, body: string }}
 */
export function formatUpdatePushTitleAndBody(before = {}, after = {}) {
  const pkgTitle = after.title || after.trackingNumber || 'החבילה שלך';
  const pkgTitleEn = after.title || after.trackingNumber || 'Your package';

  // 1. Rerouted to alternate pickup location
  if (after.isRedirected && !before.isRedirected) {
    const loc = after.pickupLocation ? `: ${after.pickupLocation}` : '';
    const title = 'החבילה הועברה למיקום חדש! | Package Rerouted!';
    const body = `${pkgTitle} הועברה לנקודת איסוף חלופית${loc} | ${pkgTitleEn} was rerouted to an alternate pickup point${loc}`;
    return { title, body };
  }

  // 2. Ready for pickup or new locker PIN arrived
  const pinArrived = (after.lockerPin && !before.lockerPin) || (after.pickupCode && !before.pickupCode);
  if (after.status === 'ready_for_pickup' || pinArrived) {
    const pinPartHe = after.lockerPin ? ` (קוד: ${after.lockerPin})` : (after.pickupCode ? ` (קוד: ${after.pickupCode})` : '');
    const pinPartEn = after.lockerPin ? ` (PIN: ${after.lockerPin})` : (after.pickupCode ? ` (Code: ${after.pickupCode})` : '');
    const locPartHe = after.pickupLocation ? ` ב-${after.pickupLocation}` : '';
    const locPartEn = after.pickupLocation ? ` at ${after.pickupLocation}` : '';

    const title = 'מוכן לאיסוף! 📍 | Ready for Pickup! 📍';
    const body = `${pkgTitle} ממתינה לאיסוף${locPartHe}${pinPartHe} | ${pkgTitleEn} is ready for pickup${locPartEn}${pinPartEn}`;
    return { title, body };
  }

  // 3. Out for delivery
  if (after.status === 'out_for_delivery' && before.status !== 'out_for_delivery') {
    const title = 'יצא לחלוקה היום! 🚚 | Out for Delivery Today! 🚚';
    const body = `${pkgTitle} בדרך אליך עם שליח | ${pkgTitleEn} is on its way to you today with courier`;
    return { title, body };
  }

  // 4. Delivered
  if (after.status === 'delivered' && before.status !== 'delivered') {
    const title = 'החבילה נמסרה! ✅ | Package Delivered! ✅';
    const body = `${pkgTitle} נמסרה בהצלחה | ${pkgTitleEn} was successfully delivered`;
    return { title, body };
  }

  // 5. Exception / Delay
  if (after.status === 'exception' && before.status !== 'exception') {
    const title = 'עדכון חשוב על המשלוח ⚠️ | Important Shipment Update ⚠️';
    const body = `${pkgTitle} מעוכבת או דורשת תשומת לב | ${pkgTitleEn} is delayed or requires attention`;
    return { title, body };
  }

  // 6. Generic status change or pickup info update
  if (after.status && after.status !== before.status) {
    const title = 'עדכון סטטוס משלוח | Shipment Status Update';
    const body = `${pkgTitle}: סטטוס עודכן ל-${after.status} | ${pkgTitleEn}: status updated to ${after.status}`;
    return { title, body };
  }

  if (after.pickupLocation && after.pickupLocation !== before.pickupLocation) {
    const title = 'עדכון מיקום איסוף | Pickup Location Updated';
    const body = `${pkgTitle}: מיקום מעודכן ל-${after.pickupLocation} | ${pkgTitleEn}: pickup location updated to ${after.pickupLocation}`;
    return { title, body };
  }

  const title = 'עדכון משלוח | Delivery Update';
  const body = `${pkgTitle}: התקבל עדכון חדש | ${pkgTitleEn}: a new update was received`;
  return { title, body };
}

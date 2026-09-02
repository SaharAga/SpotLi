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

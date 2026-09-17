/**
 * Enrols a parcel with 17TRACK the moment it is added.
 *
 * 17TRACK only watches numbers that have been registered with it. Until this
 * existed, `registerWith17Track` had exactly one caller — inside
 * `query17TrackApi`, and only when a query came back `-18019902` — and the only
 * thing that issued a query was the user tapping "refresh all". So a parcel
 * added and never manually refreshed was never registered at all: 17TRACK had
 * never heard of it and never started watching, which meant there was nothing
 * for any later poll to find either.
 *
 * Registering at creation makes live tracking the source of truth rather than
 * an afterthought, which matters most exactly where SMS fails: a courier's
 * final "delivered" message routinely carries no tracking number, so nothing
 * can match it to a package. Only a parcel 17TRACK is already watching can
 * close that gap.
 *
 * If registration is what 17TRACK meters — their usual model — this costs
 * nothing extra over the long run: the number would have been registered on its
 * first poll anyway. It only moves the same spend earlier, and buys the whole
 * delivery history in between.
 */

import { registerWith17Track, TRACK17_CARRIER_MAP } from './carrierProxy.js';
import { POLL_STATE_COLLECTION, normalizeNumber } from './scheduledTrackingRefresh.js';

/**
 * Parcels worth enrolling. Deliberately narrow: registration is the unit
 * 17TRACK most likely bills, so a demo row or a blank number must never spend
 * it.
 *
 * @param {object} pkg
 * @returns {boolean}
 */
export function isRegisterablePackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return false;
  if (pkg.isDemo) return false;
  if (pkg.isArchived) return false;

  const number = normalizeNumber(pkg.trackingNumber);
  // Short enough to be an order line or a PIN, or long enough to be junk:
  // either way not something to spend an enrolment on.
  if (number.length < 6 || number.length > 40) return false;
  // A real tracking number carries at least one digit.
  if (!/\d/.test(number)) return false;

  // QUOTA GUARD: 17TRACK free tier provides 200 registered packages lifetime.
  // Domestic couriers without 17TRACK integration (Tapuz, Buzzr, Baldar,
  // Cargo Express, ZigZag) will never succeed in 17TRACK and must not burn quota attempts.
  const isCarrierSupported = Boolean(pkg.carrier && TRACK17_CARRIER_MAP[pkg.carrier]);
  const isGlobalFormat = /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(number) || /^1Z[A-Z0-9]{16}$/i.test(number);

  return isCarrierSupported || isGlobalFormat;
}

/**
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   track17ApiKey?: string,
 *   register?: Function,
 *   now?: () => number
 * }} deps
 */
export function createRegisterTrackingNumberHandler({
  db,
  track17ApiKey = '',
  register = registerWith17Track,
  now = () => Date.now()
} = {}) {
  return async function handler(event) {
    const pkg = event?.data?.data();
    if (!isRegisterablePackage(pkg)) return;

    if (!track17ApiKey) {
      console.warn('[registerTrackingNumber] No 17TRACK API key — skipping enrolment');
      return;
    }

    const number = normalizeNumber(pkg.trackingNumber);
    const stateRef = db.collection(POLL_STATE_COLLECTION).doc(number);

    // Poll state doubles as the enrolment ledger, keyed by number rather than
    // by user for the same reason the poller is: two people tracking one parcel
    // is one registration, and re-registering it would spend quota to learn
    // nothing.
    try {
      const snap = await stateRef.get();
      if (snap.exists && snap.data()?.registeredAt) return;
    } catch (err) {
      // A ledger read that fails is not a reason to skip enrolment — the worst
      // case is one redundant registration, against a parcel that otherwise
      // goes untracked entirely.
      console.warn('[registerTrackingNumber] Could not read poll state for', number, err?.message);
    }

    const carrierCode = TRACK17_CARRIER_MAP[pkg.carrier] || undefined;
    const registered = await register(number, carrierCode, track17ApiKey);

    console.log(
      `[registerTrackingNumber] ${registered ? 'registered' : 'registration failed'} ` +
      `number=${number} carrier=${pkg.carrier || 'auto-detect'}`
    );

    if (!registered) return;

    try {
      // `nextEligibleAt: 0` deliberately leaves it due immediately, so the next
      // scheduled run picks up whatever history 17TRACK already holds rather
      // than waiting a full interval for a parcel that may already be moving.
      await stateRef.set({
        registeredAt: now(),
        nextEligibleAt: 0,
        consecutiveQuiet: 0
      }, { merge: true });
    } catch (err) {
      console.warn('[registerTrackingNumber] Could not record enrolment for', number, err?.message);
    }
  };
}

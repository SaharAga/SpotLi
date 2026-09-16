/**
 * Scheduled background tracking refresh.
 *
 * Until this existed, "live tracking" meant the user opening the app and
 * tapping refresh — so a parcel could be delivered, sit at `in_transit` for
 * days, and nobody would know. Worse, that refresh ran in the browser, so even
 * when it did find something the write came from the client and correctly did
 * not notify: the user was already looking at the screen it happened on.
 *
 * This is the other half. It runs server-side, so a status it discovers is
 * genuinely news, and it stamps `lastUpdateSource: 'live_tracking'` so
 * `updatePackagePush` sends the notification. That is the whole point: the
 * courier SMS that says "delivered" and carries no tracking number can never be
 * matched to a package, and only a poll can close it.
 *
 * Quota discipline is the design constraint. What 17TRACK meters is not
 * confirmed (see TRACKING_REFRESH_LIMITS), so this assumes every lookup costs:
 * it never looks up a delivered or archived parcel, never looks up the same
 * number twice in one run however many users hold it, backs off numbers that
 * keep coming back empty, stops at a hard per-run ceiling, and reports what it
 * spent so the assumption can be checked against the real counter.
 */

import { resolveLiveTracking } from './carrierProxy.js';
import { TRACKING_REFRESH_LIMITS } from './config.js';

/** Poll bookkeeping lives here, keyed by normalized tracking number. */
export const POLL_STATE_COLLECTION = 'trackingPollState';

/**
 * Statuses that end a parcel's life. Polling one again can only ever spend
 * quota to be told what we already know.
 */
const TERMINAL_STATUSES = new Set(['delivered', 'returned_to_sender', 'archived']);

/** Same normalization the client matches on, so both sides agree what "same number" means. */
export function normalizeNumber(value) {
  return typeof value === 'string' ? value.replace(/[\s-]+/g, '').toUpperCase() : '';
}

/**
 * Whether a package is worth a lookup at all, before any quota is spent.
 * @param {object} pkg
 * @returns {boolean}
 */
export function isRefreshablePackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return false;
  if (!normalizeNumber(pkg.trackingNumber)) return false;
  if (pkg.isArchived) return false;
  if (pkg.isDemo) return false;
  return !TERMINAL_STATUSES.has(pkg.status);
}

/**
 * Whether enough time has passed since this number's last lookup.
 *
 * @param {object|null} state stored poll state, or null when never polled
 * @param {number} now epoch ms
 * @returns {boolean}
 */
export function isDueForLookup(state, now) {
  if (!state) return true;
  const nextEligibleAt = Number(state.nextEligibleAt);
  if (!Number.isFinite(nextEligibleAt)) return true;
  return now >= nextEligibleAt;
}

/**
 * Next poll state after a lookup.
 *
 * A productive lookup resets to the base interval; an unproductive one doubles
 * the wait, bounded. "Unproductive" deliberately includes a successful lookup
 * that simply had nothing new — a parcel sitting in a warehouse for a week
 * should not be asked about as often as one moving.
 *
 * @param {object|null} state
 * @param {{ productive: boolean }} outcome
 * @param {number} now epoch ms
 * @returns {object} state to persist
 */
export function nextPollState(state, outcome, now) {
  const {
    MIN_INTERVAL_MS, MAX_INTERVAL_MS, BACKOFF_FACTOR, MAX_CONSECUTIVE_FAILURES
  } = TRACKING_REFRESH_LIMITS;

  if (outcome.productive) {
    return {
      lastPolledAt: now,
      nextEligibleAt: now + MIN_INTERVAL_MS,
      consecutiveQuiet: 0
    };
  }

  const consecutiveQuiet = Math.min(
    Number(state?.consecutiveQuiet) > 0 ? Number(state.consecutiveQuiet) + 1 : 1,
    MAX_CONSECUTIVE_FAILURES
  );
  const backoff = MIN_INTERVAL_MS * Math.pow(BACKOFF_FACTOR, consecutiveQuiet - 1);

  return {
    lastPolledAt: now,
    nextEligibleAt: now + Math.min(backoff, MAX_INTERVAL_MS),
    consecutiveQuiet
  };
}

/**
 * The patch a tracking result implies, or null when it implies nothing.
 *
 * Returning null on "no change" is load-bearing twice over: it keeps Firestore
 * writes proportional to real events, and it stops `updatePackagePush` being
 * handed a no-op update to reason about.
 *
 * @param {object} pkg the stored package
 * @param {object} result a resolveLiveTracking record
 * @returns {object|null}
 */
export function buildTrackingPatch(pkg, result) {
  if (!result || result.tracked !== true) return null;

  const patch = {};

  // A status the carrier reports beats what we inferred from an SMS, except
  // that nothing may walk a parcel backwards out of a terminal state — a stale
  // upstream record must not un-deliver a package the user has already seen
  // delivered.
  if (result.status && result.status !== pkg.status && !TERMINAL_STATUSES.has(pkg.status)) {
    patch.status = result.status;
  }

  const existing = Array.isArray(pkg.checkpoints) ? pkg.checkpoints : [];
  const existingIds = new Set(existing.map((cp) => cp && cp.id).filter(Boolean));
  const fresh = (Array.isArray(result.checkpoints) ? result.checkpoints : [])
    .filter((cp) => cp && cp.id && !existingIds.has(cp.id));
  if (fresh.length > 0) {
    patch.checkpoints = [...fresh, ...existing].slice(0, 50);
  }

  if (result.estimatedDelivery && result.estimatedDelivery !== pkg.expectedDeliveryDate) {
    patch.expectedDeliveryDate = result.estimatedDelivery;
  }

  // 17TRACK auto-detects the courier when we cannot name one. Recording it is
  // how a package stops being "Other / Universal" forever, but it may only fill
  // a gap — never overwrite a carrier the parser positively identified.
  if (result.detectedCarrier && (!pkg.carrier || pkg.carrier === 'other')) {
    patch.carrier = result.detectedCarrier;
  }
  if (result.detectedCarrierName && (!pkg.carrierName || pkg.carrier === 'other')) {
    patch.carrierName = result.detectedCarrierName;
  }

  if (Object.keys(patch).length === 0) return null;

  patch.updatedAt = new Date(Date.now()).toISOString();
  patch.lastUpdateSource = 'live_tracking';
  return patch;
}

/**
 * Collects the refreshable packages across users, grouped by tracking number.
 *
 * Grouping is what makes the dedupe real: two users tracking the same parcel,
 * or one user holding it twice, is one lookup and two writes — quota is spent
 * per number, not per row.
 */
async function collectCandidates(db) {
  const { MAX_USERS_PER_RUN, MAX_PACKAGES_PER_USER } = TRACKING_REFRESH_LIMITS;
  const byNumber = new Map();

  const usersSnap = await db.collection('users').limit(MAX_USERS_PER_RUN).get();

  for (const userDoc of usersSnap.docs) {
    // eslint-disable-next-line no-await-in-loop
    const pkgSnap = await userDoc.ref.collection('packages').limit(MAX_PACKAGES_PER_USER).get();

    for (const pkgDoc of pkgSnap.docs) {
      const pkg = pkgDoc.data();
      if (!isRefreshablePackage(pkg)) continue;

      const number = normalizeNumber(pkg.trackingNumber);
      if (!byNumber.has(number)) byNumber.set(number, []);
      byNumber.get(number).push({ uid: userDoc.id, ref: pkgDoc.ref, pkg });
    }
  }

  return byNumber;
}

/**
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   track17ApiKey?: string,
 *   resolve?: Function,
 *   now?: () => number
 * }} deps
 */
export function createScheduledTrackingRefreshHandler({
  db,
  track17ApiKey = '',
  resolve = resolveLiveTracking,
  now = () => Date.now()
} = {}) {
  return async function handler() {
    const { MAX_LOOKUPS_PER_RUN, CONCURRENCY } = TRACKING_REFRESH_LIMITS;
    const startedAt = now();
    const stats = { scanned: 0, lookups: 0, updated: 0, skippedNotDue: 0, errors: 0 };

    const byNumber = await collectCandidates(db);
    stats.scanned = byNumber.size;

    // Read poll state first so the budget is spent on numbers that are actually
    // due, rather than burned on the first N in map order.
    const due = [];
    for (const [number, holders] of byNumber) {
      const stateRef = db.collection(POLL_STATE_COLLECTION).doc(number);
      // eslint-disable-next-line no-await-in-loop
      const stateSnap = await stateRef.get();
      const state = stateSnap.exists ? stateSnap.data() : null;

      if (!isDueForLookup(state, startedAt)) {
        stats.skippedNotDue += 1;
        continue;
      }
      due.push({ number, holders, state, stateRef });
    }

    // Oldest-polled first. Without this the per-run ceiling would always serve
    // the same head of the map — insertion order, so the same users and the
    // same packages — and anything past the cap would never be looked up at
    // all. Sorting by last poll makes the ceiling a delay for everyone rather
    // than a permanent exclusion for the tail.
    due.sort((a, b) => (Number(a.state?.lastPolledAt) || 0) - (Number(b.state?.lastPolledAt) || 0));
    due.length = Math.min(due.length, MAX_LOOKUPS_PER_RUN);

    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const chunk = due.slice(i, i + CONCURRENCY);

      // eslint-disable-next-line no-await-in-loop
      await Promise.all(chunk.map(async ({ number, holders, state, stateRef }) => {
        // Any carrier id among the holders will do — they share a number, and
        // the resolver treats the id as a hint, falling back to auto-detect.
        const carrierId = holders.find((h) => h.pkg.carrier && h.pkg.carrier !== 'other')?.pkg.carrier
          || holders[0].pkg.carrier
          || '';

        let result;
        try {
          stats.lookups += 1;
          result = await resolve({ trackingNumber: number, carrierId, track17ApiKey });
        } catch (err) {
          stats.errors += 1;
          console.warn('[scheduledTrackingRefresh] lookup failed for', number, err?.message);
          result = null;
        }

        let productive = false;
        for (const holder of holders) {
          const patch = result && buildTrackingPatch(holder.pkg, result);
          if (!patch) continue;
          productive = true;
          try {
            await holder.ref.set(patch, { merge: true });
            stats.updated += 1;
          } catch (err) {
            stats.errors += 1;
            console.warn('[scheduledTrackingRefresh] write failed for', holder.uid, err?.message);
          }
        }

        try {
          await stateRef.set(nextPollState(state, { productive }, startedAt), { merge: true });
        } catch (err) {
          // Losing the bookkeeping costs one extra lookup next run, nothing more.
          console.warn('[scheduledTrackingRefresh] poll state write failed for', number, err?.message);
        }
      }));
    }

    // The line to compare against 17TRACK's own counter — the only way to find
    // out what it actually meters without guessing.
    console.log(
      `[scheduledTrackingRefresh] numbers=${stats.scanned} due=${due.length} ` +
      `lookups=${stats.lookups} updated=${stats.updated} ` +
      `notDue=${stats.skippedNotDue} errors=${stats.errors} ` +
      `ms=${now() - startedAt}`
    );

    return stats;
  };
}

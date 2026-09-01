import { db, isFirebaseConfigured } from './firebase';
import { getOrCreateAnonymousId } from '../utils/anonymousId';
import { FEATURE_ID_LIST } from '../constants/featureIds';

/**
 * Records that a feature was touched today, for adoption-rate purposes —
 * "what % of active users ever open X" — without ever tracking *who*.
 *
 * The identity (uid, or an anonymous per-browser id for guests) is used
 * only as part of the document ID (`{feature}_{identity}_{date}`,
 * `setDoc` with `merge: true`), never written as document *content* — the
 * stored fields are just `{ feature, date }`. That dedupes a user opening
 * the same feature 50 times in a day down to one row, which is what makes
 * counting *rows* for a (feature, date) pair equivalent to counting
 * *unique users*, without this service or its caller ever needing to know
 * who any of them are.
 *
 * The raw rows are only ever read by the scheduled Cloud Function
 * (featureAdoptionRollup.js) that aggregates them into
 * featureAdoptionStats and deletes them immediately after — see
 * firestore.rules, which denies read to every client including admin, so
 * that raw per-identity data never accumulates or becomes browsable.
 *
 * Best-effort and silent — a failed telemetry write must never affect the
 * feature the caller is actually using.
 *
 * @param {string} feature One of FEATURE_IDS (featureIds.js)
 * @param {{ uid?: string | null }} [options]
 */
export async function recordFeatureUse(feature, { uid } = {}) {
  if (!FEATURE_ID_LIST.includes(feature)) return;
  if (!isFirebaseConfigured || !db) return;

  const identity = uid || getOrCreateAnonymousId();
  if (!identity) return;

  const date = new Date().toISOString().slice(0, 10);

  try {
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'featureUsage', `${feature}_${identity}_${date}`),
      { feature, date },
      { merge: true }
    );
  } catch (err) {
    console.debug?.('[featureUsageService] Failed to record feature use:', err?.message);
  }
}

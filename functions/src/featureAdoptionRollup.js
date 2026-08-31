/**
 * Daily rollup of featureUsage rows into featureAdoptionStats — the other
 * half of the privacy-preserving feature-adoption pipeline (see
 * src/services/featureUsageService.js and firestore.rules for the client
 * side and the "why" of the design).
 *
 * Rolls up the *previous* UTC day, not the current one, so a day's data is
 * complete (no more writes coming for it) before it's aggregated and its
 * raw rows deleted — running against "today" would risk deleting a row
 * moments before a legitimate write for it lands.
 */

const FIRESTORE_BATCH_LIMIT = 500;

function yesterdayUtcDateString(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * @param {{ db: FirebaseFirestore.Firestore }} deps
 */
export function createFeatureAdoptionRollupHandler({ db }) {
  return async function handler() {
    const date = yesterdayUtcDateString();
    const result = await rollupFeatureUsageForDate({ db, date });
    console.log(
      `[featureAdoptionRollup] date=${date} features=${result.featuresRolledUp} rowsDeleted=${result.rowsDeleted}`
    );
    return result;
  };
}

/**
 * Pure-ish core, split out so it can be invoked with an arbitrary date
 * (tests, or a manual backfill) without going through the scheduled
 * handler's "always yesterday" framing.
 *
 * @param {{ db: FirebaseFirestore.Firestore, date: string }} params
 * @returns {Promise<{ featuresRolledUp: number, rowsDeleted: number }>}
 */
export async function rollupFeatureUsageForDate({ db, date }) {
  const snap = await db.collection('featureUsage').where('date', '==', date).get();

  const countByFeature = new Map();
  for (const doc of snap.docs) {
    const feature = doc.data()?.feature;
    if (!feature) continue;
    countByFeature.set(feature, (countByFeature.get(feature) || 0) + 1);
  }

  for (const [feature, uniqueUsers] of countByFeature) {
    // merge: true so a re-run of the same date (e.g. a retried scheduled
    // invocation) overwrites with the same value rather than erroring or
    // double-counting — this whole function is safe to run more than once
    // for the same date.
    await db
      .collection('featureAdoptionStats')
      .doc(`${feature}_${date}`)
      .set({ feature, date, uniqueUsers }, { merge: true });
  }

  // Delete the raw rows in batches — this is the actual privacy guarantee
  // (see firestore.rules' comment on featureUsage): identity-shaped data
  // does not outlive its own aggregation.
  let rowsDeleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
    rowsDeleted += chunk.length;
  }

  return { featuresRolledUp: countByFeature.size, rowsDeleted };
}

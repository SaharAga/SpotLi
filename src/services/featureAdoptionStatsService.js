import { db, isFirebaseConfigured } from './firebase';
import { FEATURE_IDS } from '../constants/featureIds';

/**
 * Fetches featureAdoptionStats rows from the last `days` days. Only
 * succeeds for allowlisted admins (firestore.rules enforces isAdmin()) —
 * this is the aggregate (feature, date, uniqueUsers) data the scheduled
 * rollup produces, never the raw per-identity rows (those are unreadable
 * by anyone, see featureUsageService.js).
 *
 * @param {number} [days=30]
 * @returns {Promise<{ ok: boolean, items: Array<object>, error: string|null }>}
 */
export async function fetchFeatureAdoptionStats(days = 30) {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, items: [], error: 'not-configured' };
  }
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const q = query(collection(db, 'featureAdoptionStats'), where('date', '>=', cutoffDate));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
    return { ok: true, items, error: null };
  } catch (err) {
    console.warn('[featureAdoptionStatsService] Failed to fetch stats:', err);
    return { ok: false, items: [], error: err?.code || 'unknown' };
  }
}

/**
 * Summarizes featureAdoptionStats rows into a per-feature adoption
 * estimate: sum of daily unique-user counts for that feature over the
 * period, divided by the same sum for the '_app_active' baseline.
 *
 * This is an approximation, not a true period-unique count — a user
 * active on 5 different days contributes 5 to both sums, so it answers
 * "of the app-visits that happened, what fraction also touched this
 * feature," not "what fraction of distinct people ever touched it." That
 * is a deliberate tradeoff: a true period-unique count would require
 * keeping raw per-identity rows for the whole period before aggregating,
 * which is exactly what the daily rollup-and-delete design (see
 * featureAdoptionRollup.js) avoids for privacy. Good enough to answer
 * "is this feature at 1% or 90%," the actual question this was built for.
 *
 * @param {Array<object>} stats
 * @returns {Record<string, { featureTotal: number, appActiveTotal: number, adoptionRate: number }>}
 */
export function computeAdoptionSummary(stats) {
  const items = Array.isArray(stats) ? stats : [];
  const totalsByFeature = {};

  for (const item of items) {
    if (!item?.feature || typeof item.uniqueUsers !== 'number') continue;
    totalsByFeature[item.feature] = (totalsByFeature[item.feature] || 0) + item.uniqueUsers;
  }

  const appActiveTotal = totalsByFeature[FEATURE_IDS.APP_ACTIVE] || 0;
  const summary = {};

  for (const [feature, featureTotal] of Object.entries(totalsByFeature)) {
    if (feature === FEATURE_IDS.APP_ACTIVE) continue;
    summary[feature] = {
      featureTotal,
      appActiveTotal,
      adoptionRate: appActiveTotal > 0 ? featureTotal / appActiveTotal : 0
    };
  }

  return summary;
}

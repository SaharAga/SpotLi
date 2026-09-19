import { db, isFirebaseConfigured } from './firebase';

/**
 * Records that a Smart Import auto-fill was saved — whether or not the
 * user corrected it — as the missing denominator for parseCorrections.
 * parseCorrections only ever logs a *correction* (an edited field before
 * save); on its own it can answer "which fields get corrected most" but
 * not "what fraction of Smart Import saves needed a correction at all",
 * since a clean, uncorrected save leaves no record anywhere. This closes
 * that gap with one write per save, so miss-rate (overall and per-carrier)
 * can be computed as corrected / total.
 *
 * Same anonymization bar as parseCorrections: source, confidence, carrier,
 * and whether it was corrected — never the tracking number, title, or any
 * other free text/value.
 *
 * Best-effort and silent — a failed telemetry write must never block
 * saving a package.
 *
 * @param {{ source: 'regex' | 'ai', confidence: string | null, carrier: string | null, corrected: boolean }} attempt
 */
let isTestAttemptReportingEnabled = false;

/**
 * Test-only hook to enable recording in unit tests.
 * @param {boolean} val
 */
export function _enableTestAttemptReporting(val = true) {
  isTestAttemptReportingEnabled = val;
}

export async function recordSmartImportAttempt({ source, confidence, carrier, corrected }) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test' && !isTestAttemptReportingEnabled) {
    return;
  }
  if (!isFirebaseConfigured || !db) return;

  try {
    const { collection, addDoc } = await import('firebase/firestore');
    await addDoc(collection(db, 'smartImportAttempts'), {
      source: source || 'regex',
      confidence: confidence || null,
      carrier: carrier || 'other',
      corrected: Boolean(corrected),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.debug?.('[smartImportAttemptService] Failed to record attempt:', err?.message);
  }
}

/**
 * Fetches all Smart Import attempts from Cloud Firestore, newest first.
 * Only succeeds for allowlisted admins (firestore.rules enforces isAdmin()).
 *
 * @param {number} [limitCount=1000]
 * @returns {Promise<{ ok: boolean, items: Array<object>, error: string|null }>}
 */
export async function fetchAllSmartImportAttempts(limitCount = 1000) {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, items: [], error: 'not-configured' };
  }
  try {
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const q = query(
      collection(db, 'smartImportAttempts'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
    return { ok: true, items, error: null };
  } catch (err) {
    console.warn('[smartImportAttemptService] Failed to fetch attempts:', err);
    return { ok: false, items: [], error: err?.code || 'unknown' };
  }
}

/**
 * Computes miss-rate statistics from an array of Smart Import attempt
 * telemetry items — overall and per-carrier, so a low-adoption or
 * high-miss carrier is visible at a glance instead of only in aggregate.
 *
 * @param {Array<object>} attempts
 * @returns {{
 *   total: number,
 *   corrected: number,
 *   missRate: number,
 *   sourceBreakdown: { regex: number, ai: number },
 *   perCarrier: Record<string, { total: number, corrected: number, missRate: number }>
 * }}
 */
export function computeSmartImportMissRateStats(attempts) {
  const items = Array.isArray(attempts) ? attempts : [];
  const total = items.length;

  let corrected = 0;
  const sourceBreakdown = { regex: 0, ai: 0 };
  const perCarrierRaw = {};

  for (const item of items) {
    if (!item) continue;
    const source = item.source === 'ai' ? 'ai' : 'regex';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

    if (item.corrected) corrected += 1;

    const carrier = item.carrier || 'other';
    if (!perCarrierRaw[carrier]) perCarrierRaw[carrier] = { total: 0, corrected: 0 };
    perCarrierRaw[carrier].total += 1;
    if (item.corrected) perCarrierRaw[carrier].corrected += 1;
  }

  const perCarrier = {};
  for (const [carrier, counts] of Object.entries(perCarrierRaw)) {
    perCarrier[carrier] = { ...counts, missRate: counts.total > 0 ? counts.corrected / counts.total : 0 };
  }

  return {
    total,
    corrected,
    missRate: total > 0 ? corrected / total : 0,
    sourceBreakdown,
    perCarrier
  };
}

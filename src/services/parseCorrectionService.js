import { db, isFirebaseConfigured } from './firebase';

/**
 * Records that a Smart Import auto-fill was corrected before saving — the
 * implicit half of the mis-parse detection signal (the explicit half is a
 * user-initiated feedback report, see feedbackService.submitFeedback).
 *
 * Deliberately field-name-only, never field values: which fields the parser
 * (regex or AI) got wrong is useful telemetry; the tracking number, carrier
 * name, or pasted text the user typed to fix it is not something this
 * should be collecting.
 *
 * Best-effort and silent — a failed telemetry write must never block saving
 * a package.
 *
 * @param {{ source: 'regex' | 'ai', confidence: string | null, editedFields: string[] }} correction
 */
export async function recordParseCorrection({ source, confidence, editedFields }) {
  if (!editedFields || editedFields.length === 0) return;
  if (!isFirebaseConfigured || !db) return;

  try {
    const { collection, addDoc } = await import('firebase/firestore');
    await addDoc(collection(db, 'parseCorrections'), {
      source: source || 'regex',
      confidence: confidence || null,
      editedFields,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.debug?.('[parseCorrectionService] Failed to record correction:', err?.message);
  }
}

/**
 * Fetches all parse corrections from Cloud Firestore, newest first.
 * Only succeeds for allowlisted admins (firestore.rules enforces isAdmin()).
 *
 * @param {number} [limitCount=500]
 * @returns {Promise<{ ok: boolean, items: Array<object>, error: string|null }>}
 */
export async function fetchAllParseCorrections(limitCount = 500) {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, items: [], error: 'not-configured' };
  }
  try {
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const q = query(
      collection(db, 'parseCorrections'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
    return { ok: true, items, error: null };
  } catch (err) {
    console.warn('[parseCorrectionService] Failed to fetch parse corrections:', err);
    return { ok: false, items: [], error: err?.code || 'unknown' };
  }
}

/**
 * Computes statistics from an array of parse correction telemetry items.
 *
 * @param {Array<object>} corrections
 * @returns {{
 *   total: number,
 *   sourceBreakdown: { regex: number, ai: number },
 *   fieldBreakdown: Record<string, number>,
 *   confidenceBreakdown: Record<string, number>
 * }}
 */
export function computeParseCorrectionStats(corrections) {
  const items = Array.isArray(corrections) ? corrections : [];
  const total = items.length;

  const sourceBreakdown = { regex: 0, ai: 0 };
  const fieldBreakdown = {};
  const confidenceBreakdown = { high: 0, medium: 0, low: 0, none: 0 };

  for (const item of items) {
    if (!item) continue;
    const source = item.source === 'ai' ? 'ai' : 'regex';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

    const conf = item.confidence && confidenceBreakdown[item.confidence] !== undefined ? item.confidence : 'none';
    confidenceBreakdown[conf] = (confidenceBreakdown[conf] || 0) + 1;

    if (Array.isArray(item.editedFields)) {
      for (const field of item.editedFields) {
        if (typeof field === 'string' && field) {
          fieldBreakdown[field] = (fieldBreakdown[field] || 0) + 1;
        }
      }
    }
  }

  return {
    total,
    sourceBreakdown,
    fieldBreakdown,
    confidenceBreakdown
  };
}

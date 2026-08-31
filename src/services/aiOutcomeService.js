import { db, isFirebaseConfigured } from './firebase';

/**
 * How long after an AI-resolved Gmail-sync package is created that a
 * delete or a carrier/trackingNumber edit still counts as a false-positive
 * signal. Long enough to catch "I looked at my dashboard and this is
 * garbage," short enough that it doesn't pick up ordinary lifecycle
 * cleanup of an old, unrelated package.
 */
export const AI_OUTCOME_WINDOW_MS = 72 * 60 * 60 * 1000;

const TRACKED_FIELDS = ['trackingNumber', 'carrier'];

/**
 * Records an implicit false-positive signal for a Gmail-sync package that
 * the AI fallback (gmailAiFallback.js, source `gmail_sync_ai`) resolved —
 * the missing half of that pipeline's telemetry. gmailParseInsights already
 * logs what Gemini *said* (confidence, selected candidate); this is the
 * only place that captures whether it was *right*, using the same implicit
 * behavioral signal parseCorrectionService.js already relies on for Smart
 * Import (a user editing/discarding what was auto-filled), rather than an
 * explicit "was this wrong?" prompt nothing else in this flow has either.
 *
 * Deliberately anonymized the same way: carrier + confidence band + which
 * fields changed, never the tracking number or any free text.
 *
 * Best-effort and silent — a failed telemetry write must never block the
 * user's actual delete/edit.
 *
 * @param {{ outcome: 'deleted' | 'edited', carrier: string, confidence: string | null, editedFields?: string[] }} entry
 */
export async function recordAiOutcome({ outcome, carrier, confidence, editedFields = [] }) {
  if (outcome === 'edited' && editedFields.length === 0) return;
  if (!isFirebaseConfigured || !db) return;

  try {
    const { collection, addDoc } = await import('firebase/firestore');
    await addDoc(collection(db, 'gmailAiOutcomes'), {
      outcome,
      carrier: carrier || 'other',
      confidence: confidence || null,
      editedFields: outcome === 'edited' ? editedFields : [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.debug?.('[aiOutcomeService] Failed to record AI outcome:', err?.message);
  }
}

/**
 * Decides whether a package mutation about to happen (delete, or an update
 * that changes carrier/trackingNumber) is worth recording as an implicit
 * false-positive signal, and if so returns the entry to log — the caller
 * (usePackages' commit()) still has to actually call recordAiOutcome, kept
 * separate so this stays a pure, easily-testable decision function.
 *
 * @param {{ type: 'ADD'|'UPDATE'|'DELETE'|'UPDATE_ALL'|'STATUS_CHANGE', payload: object }} mutation
 * @param {object | undefined} previousPkg The package as it stood before this mutation, if known
 * @param {number} [now]
 * @returns {{ outcome: 'deleted' | 'edited', carrier: string, confidence: string | null, editedFields: string[] } | null}
 */
export function detectAiOutcome(mutation, previousPkg, now = Date.now()) {
  if (!previousPkg || previousPkg.source !== 'gmail_sync_ai') return null;

  const createdAt = Date.parse(previousPkg.createdAt || '');
  if (!Number.isFinite(createdAt) || now - createdAt > AI_OUTCOME_WINDOW_MS) return null;

  if (mutation.type === 'DELETE') {
    return { outcome: 'deleted', carrier: previousPkg.carrier, confidence: previousPkg.confidence || null, editedFields: [] };
  }

  if (mutation.type === 'UPDATE') {
    const editedFields = TRACKED_FIELDS.filter((field) => mutation.payload?.[field] !== undefined && mutation.payload[field] !== previousPkg[field]);
    if (editedFields.length === 0) return null;
    return { outcome: 'edited', carrier: previousPkg.carrier, confidence: previousPkg.confidence || null, editedFields };
  }

  return null;
}

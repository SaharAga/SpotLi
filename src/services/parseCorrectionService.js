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

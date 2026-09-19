import { db, isFirebaseConfigured } from './firebase';
import { redactPII } from '../utils/privacySanitizer';

// `status` is the parser's delivery-stage guess. It is captured for the same
// reason the others are — the parser produces it and the user corrects it —
// and it is not redacted below because it is a fixed enum, never free text.
const TRACKED_FIELDS = ['title', 'trackingNumber', 'carrier', 'origin', 'notes', 'status'];
// trackingNumber/carrier are excluded from redaction: they're pseudonymous
// identifiers, not PII, and a tracking number is exactly the value this
// dataset needs to stay correct — redactPII's credit-card pattern would
// otherwise clobber any all-digit 13-19 char tracking number.
const REDACTABLE_FIELDS = new Set(['title', 'origin', 'notes']);
const MAX_INPUT_TEXT_LENGTH = 5000;

// `notes` in particular is freeform and can carry a recipient's phone
// number or "leave with ___" instruction — the same third-party-PII
// concern as the pasted text below, see redactPII.
function pickTrackedFields(values) {
  const out = {};
  for (const field of TRACKED_FIELDS) {
    if (values && typeof values[field] === 'string' && values[field]) {
      out[field] = REDACTABLE_FIELDS.has(field) ? redactPII(values[field]) : values[field];
    }
  }
  return out;
}

/**
 * Records a real training example — the pasted text and the before/after
 * field values of a Smart Import correction — for the small subset of
 * signed-in users who explicitly opted in (AccountModal / LegalConsentGate).
 *
 * Unlike parseCorrectionService.recordParseCorrection (field names only,
 * always fires), this stores actual values and is gated both client-side
 * (only ever called when `user.aiTrainingOptIn` is true — see
 * AddEditPackageModal.jsx) and server-side (firestore.rules re-checks the
 * same flag on the user's own profile doc before allowing the write).
 *
 * Best-effort and silent — a failed write must never block saving a package.
 *
 * @param {{ userId: string, source: 'regex'|'ai', confidence: string|null, inputText: string, initialValues: object, correctedValues: object }} example
 */
let isTestTrainingReportingEnabled = false;

/**
 * Test-only hook to enable recording in unit tests.
 * @param {boolean} val
 */
export function _enableTestTrainingReporting(val = true) {
  isTestTrainingReportingEnabled = val;
}

export async function recordTrainingExample({ userId, source, confidence, inputText, initialValues, correctedValues }) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test' && !isTestTrainingReportingEnabled) {
    return;
  }
  if (!userId) return;
  if (!isFirebaseConfigured || !db) return;

  try {
    const { collection, addDoc } = await import('firebase/firestore');
    await addDoc(collection(db, 'trainingExamples'), {
      userId,
      source: source || 'regex',
      confidence: confidence || null,
      inputText: typeof inputText === 'string' ? redactPII(inputText.slice(0, MAX_INPUT_TEXT_LENGTH)) : '',
      initialValues: pickTrackedFields(initialValues),
      correctedValues: pickTrackedFields(correctedValues),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.debug?.('[trainingDataService] Failed to record training example:', err?.message);
  }
}

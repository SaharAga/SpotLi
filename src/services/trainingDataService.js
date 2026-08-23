import { db, isFirebaseConfigured } from './firebase';

const TRACKED_FIELDS = ['title', 'trackingNumber', 'carrier', 'origin', 'notes'];
const MAX_INPUT_TEXT_LENGTH = 5000;

function pickTrackedFields(values) {
  const out = {};
  for (const field of TRACKED_FIELDS) {
    if (values && typeof values[field] === 'string' && values[field]) {
      out[field] = values[field];
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
export async function recordTrainingExample({ userId, source, confidence, inputText, initialValues, correctedValues }) {
  if (!userId) return;
  if (!isFirebaseConfigured || !db) return;

  try {
    const { collection, addDoc } = await import('firebase/firestore');
    await addDoc(collection(db, 'trainingExamples'), {
      userId,
      source: source || 'regex',
      confidence: confidence || null,
      inputText: typeof inputText === 'string' ? inputText.slice(0, MAX_INPUT_TEXT_LENGTH) : '',
      initialValues: pickTrackedFields(initialValues),
      correctedValues: pickTrackedFields(correctedValues),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.debug?.('[trainingDataService] Failed to record training example:', err?.message);
  }
}

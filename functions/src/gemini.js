import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_MODEL } from './config.js';

const CARRIER_IDS = [
  'israel-post', 'chita', 'hfd', 'boxit', 'tapuz', 'cargo', 'getpackage',
  'flying-cargo', 'orian', 'bar', 'zigzag', 'cainiao', 'yunexpress', 'dhl',
  'fedex', 'ups', 'usps', 'royal-mail', 'aramex', 'yanwen', 'other'
];

// Matches the shape parseSmartText() already returns, so the client treats
// a Gemini result identically to a regex-parser result — one code path,
// not two. `confidence` has no regex-parser equivalent; it's new, and used
// to decide whether to show a "double-check this" hint in the UI.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    trackingNumber: { type: Type.STRING },
    carrier: { type: Type.STRING, enum: CARRIER_IDS },
    title: { type: Type.STRING },
    pickupLocation: { type: Type.STRING },
    origin: { type: Type.STRING },
    notes: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low', 'none'] }
  },
  required: ['trackingNumber', 'carrier', 'confidence'],
  propertyOrdering: ['trackingNumber', 'carrier', 'title', 'pickupLocation', 'origin', 'notes', 'confidence']
};

const SYSTEM_INSTRUCTION = `You extract package tracking details from a short message or a screenshot for a bilingual (Hebrew/English) package-tracking app. The user has already tried a deterministic parser that found nothing usable, or the input is an image only a vision model can read.

Rules:
- trackingNumber: the shipment tracking/AWB number if present, else an empty string. Never invent one.
- carrier: your best guess from the given list; "other" if unclear.
- confidence: "none" if you found no real tracking number, "low"/"medium"/"high" based on how sure you are of the whole result.
- title: a short human label (e.g. "AliExpress Order", "Israel Post Package"), empty string if you can't tell.
- pickupLocation: a locker/branch/pickup point name if mentioned, else empty string.
- origin: the shipping origin country/city if evident, else empty string.
- notes: a short (<300 char) plain-text summary of anything else relevant. Never copy long raw text verbatim.
- Text may be Hebrew, English, or mixed. Read Hebrew normally (right-to-left) — do not transliterate or translate it.
- If a screenshot shows personal data (phone number, address, payment info) unrelated to tracking, ignore it — do not repeat it into any field.`;

function emptyResult() {
  return {
    trackingNumber: '',
    carrier: 'other',
    title: '',
    pickupLocation: '',
    origin: '',
    notes: '',
    confidence: 'none'
  };
}

/**
 * @param {{ mode: 'text-fallback' | 'image', text?: string, imageBase64?: string }} payload
 * @param {string} apiKey - passed explicitly (from Secret Manager via the
 *   caller) rather than read from process.env here, so this module has no
 *   hidden global state and is easy to unit test with a fake key.
 * @returns {Promise<ReturnType<typeof emptyResult>>}
 */
export async function parseWithGemini(payload, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required.');
  }
  const ai = new GoogleGenAI({ apiKey });

  const contentParts =
    payload.mode === 'text-fallback'
      ? [{ text: payload.text }]
      : [{ inlineData: { mimeType: 'image/jpeg', data: stripDataUrlPrefix(payload.imageBase64) } }];

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: contentParts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0
    }
  });

  const text = response.text;
  if (!text) {
    return emptyResult();
  }

  try {
    const parsed = JSON.parse(text);
    return { ...emptyResult(), ...parsed };
  } catch {
    // A malformed response is a Gemini-side anomaly, not a caller error —
    // fail closed to "nothing found" rather than surfacing a 500.
    return emptyResult();
  }
}

function stripDataUrlPrefix(imageBase64) {
  const commaIndex = imageBase64.indexOf(',');
  return imageBase64.startsWith('data:') && commaIndex !== -1
    ? imageBase64.slice(commaIndex + 1)
    : imageBase64;
}

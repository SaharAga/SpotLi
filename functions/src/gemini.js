import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_MODEL } from './config.js';
import carrierSpecs from './carrierSpecs.generated.json' with { type: 'json' };
import { validateUPUS10Mod11, extractTrackingDetails, isFalsePositive } from './trackingExtraction.js';

const CARRIER_IDS = [
  'israel-post', 'chita', 'hfd', 'boxit', 'tapuz', 'cargo', 'getpackage',
  'flying-cargo', 'orian', 'bar', 'zigzag', 'cainiao', 'yunexpress', 'dhl',
  'fedex', 'ups', 'usps', 'royal-mail', 'aramex', 'yanwen', 'other'
];
const CANDIDATE_ID_RE = /^cand_[A-Za-z0-9_-]{1,32}$/;
const MAX_CANDIDATES = 10;
const MAX_CANDIDATE_VALUE_LENGTH = 35;
const MAX_CANDIDATE_PROMPT_BYTES = 512;
const COMPILED_RULES = (carrierSpecs.rules || []).map((rule) => ({
  ...rule,
  re: new RegExp(rule.source, rule.flags)
}));

// Matches the shape parseSmartText() already returns, so the client treats
// a Gemini result identically to a regex-parser result — one code path,
// not two. `confidence` has no regex-parser equivalent; it's new, and used
// to decide whether to show a "double-check this" hint in the UI.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    selectedCandidateId: { type: Type.STRING },
    carrier: { type: Type.STRING, enum: CARRIER_IDS },
    title: { type: Type.STRING },
    pickupLocation: { type: Type.STRING },
    origin: { type: Type.STRING },
    notes: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low', 'none'] }
  },
  required: ['selectedCandidateId', 'confidence'],
  propertyOrdering: ['selectedCandidateId', 'title', 'pickupLocation', 'origin', 'notes', 'confidence']
};

const IMAGE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcribedText: { type: Type.STRING },
    trackingNumber: { type: Type.STRING },
    carrier: { type: Type.STRING, enum: CARRIER_IDS },
    title: { type: Type.STRING },
    pickupLocation: { type: Type.STRING },
    origin: { type: Type.STRING },
    notes: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low', 'none'] }
  },
  required: ['transcribedText', 'confidence'],
  propertyOrdering: ['transcribedText', 'trackingNumber', 'carrier', 'title', 'pickupLocation', 'origin', 'notes', 'confidence']
};

const SYSTEM_INSTRUCTION = `You extract package tracking details from a short message for a bilingual (Hebrew/English) package-tracking app. The user has already tried a deterministic parser that found nothing usable.

Rules:
- selectedCandidateId: choose exactly one ID from the deterministic candidate list supplied in the user message, or "" if none is a shipment tracking number. Never output a tracking number or an ID that was not supplied.
- confidence: "none" if you found no real tracking number, "low"/"medium"/"high" based on how sure you are of the whole result.
- title: a short human label (e.g. "AliExpress Order", "Israel Post Package"), empty string if you can't tell.
- pickupLocation: a locker/branch/pickup point name if mentioned, else empty string.
- origin: the shipping origin country/city if evident, else empty string.
- notes: a short (<300 char) plain-text summary of anything else relevant. Never copy long raw text verbatim.
- Text may be Hebrew, English, or mixed. Read Hebrew normally (right-to-left) — do not transliterate or translate it.
- If the text shows personal data (phone number, address, payment info) unrelated to tracking, ignore it — do not repeat it into any field.`;

const IMAGE_SYSTEM_INSTRUCTION = `You transcribe and extract package tracking details from a shipping label or notification screenshot for a bilingual (Hebrew/English) package-tracking app.

Rules:
- transcribedText: faithfully transcribe all visible text, barcodes, tracking labels, courier names, SMS text, addresses, pickup notices, or locker codes visible in the image.
- trackingNumber: the primary shipment tracking number visible on the label or screenshot (empty string if none). Never invent or hallucinate a number.
- carrier: the courier service name if evident from logos or text, or 'other'.
- title: a short human label (e.g. "AliExpress Order", "Israel Post Package", "Zara Delivery"), empty string if you can't tell.
- pickupLocation: a locker/branch/pickup point name if mentioned, else empty string.
- origin: the shipping origin country/city if evident, else empty string.
- notes: a short (<300 char) plain-text summary of anything else relevant. Never copy long raw text verbatim.
- Read Hebrew normally (right-to-left).
- If a screenshot shows personal data (phone number, address, payment info) unrelated to tracking, ignore it — do not repeat it into any field.`;

function emptyResult() {
  return {
    trackingNumber: '',
    carrier: 'other',
    title: '',
    pickupLocation: '',
    origin: '',
    notes: '',
    confidence: 'none',
    isGroundedCandidate: false
  };
}

/**
 * Two-stage deterministic grounding for image OCR results:
 * 1. Derives candidates from transcribedText and tests model-extracted tracking against carrierSpecs and checksums.
 * 2. Ensures no invented tracking numbers can pass — fails closed if candidate fails checksum or isn't grounded.
 *
 * @param {object} parsed
 * @returns {ReturnType<typeof emptyResult>}
 */
function groundImageParseResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return emptyResult();

  const transcribed = (typeof parsed.transcribedText === 'string' ? parsed.transcribedText : '').trim();
  const rawModelTracking = (typeof parsed.trackingNumber === 'string' ? parsed.trackingNumber : '')
    .trim()
    .toUpperCase();

  // Run server-side deterministic candidate extraction on transcribed text
  const deterministicResult = transcribed ? extractTrackingDetails('', transcribed, '') : null;
  const verifiedDeterministicCandidates = (deterministicResult?.candidates || []).filter(
    (c) => (c.score >= 0.60 && c.checksum !== 'fail')
  );

  let verifiedTracking = '';
  let verifiedCarrier = 'other';

  // 1. Direct Model Candidate Grounding:
  // Must match carrierSpecs, pass checksum (UPU S10 / Mod10), not be a false positive,
  // and be visibly grounded in transcribedText. Normalize out OCR spaces and hyphens first.
  const cleanTracking = rawModelTracking.replace(/[\s-]/g, '');
  if (cleanTracking && cleanTracking.length >= 6 && cleanTracking.length <= MAX_CANDIDATE_VALUE_LENGTH) {
    const carrierCandidates = deriveCarrierCandidates(cleanTracking);
    const passesChecksum = carrierCandidates.length > 0 && passesChecksumPolicy(cleanTracking, carrierCandidates);
    const notFalsePositive = !isFalsePositive(cleanTracking, transcribed);
    const cleanTranscribed = transcribed.toUpperCase().replace(/[\s-]/g, '');
    const isTranscribedInText = cleanTranscribed.includes(cleanTracking);

    if (passesChecksum && notFalsePositive && isTranscribedInText) {
      verifiedTracking = cleanTracking;
      verifiedCarrier = (carrierCandidates.includes(parsed.carrier) ? parsed.carrier : carrierCandidates[0]) || 'other';
    }
  }

  // 2. Deterministic Candidates Fallback from Transcribed Text:
  // If the model didn't cleanly isolate the tracking number, pick up verified candidates extracted from the text.
  if (!verifiedTracking && verifiedDeterministicCandidates.length > 0) {
    const topCandidate = verifiedDeterministicCandidates[0];
    const carrierCandidates = deriveCarrierCandidates(topCandidate.value);
    if (carrierCandidates.length > 0 && passesChecksumPolicy(topCandidate.value, carrierCandidates)) {
      verifiedTracking = topCandidate.value;
      verifiedCarrier = (carrierCandidates.includes(parsed.carrier) ? parsed.carrier : carrierCandidates[0])
        || topCandidate.carrierCandidates?.[0]
        || deterministicResult?.carrier
        || 'other';
    }
  } else if (!verifiedTracking && deterministicResult?.trackingNumber && deterministicResult.status === 'verified') {
    const carrierCandidates = deriveCarrierCandidates(deterministicResult.trackingNumber);
    if (carrierCandidates.length > 0 && passesChecksumPolicy(deterministicResult.trackingNumber, carrierCandidates)) {
      verifiedTracking = deterministicResult.trackingNumber;
      verifiedCarrier = (carrierCandidates.includes(parsed.carrier) ? parsed.carrier : carrierCandidates[0])
        || deterministicResult.carrier
        || 'other';
    }
  }

  // If no tracking number passed carrier verification, fail closed
  if (!verifiedTracking) {
    return emptyResult();
  }

  const pickupLocation = deterministicResult?.pickupLocation
    || (typeof parsed.pickupLocation === 'string' ? parsed.pickupLocation.trim() : '');

  const title = (typeof parsed.title === 'string' && parsed.title.trim())
    ? parsed.title.trim()
    : (deterministicResult?.store ? `${deterministicResult.store} Package` : '');

  const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) && parsed.confidence !== 'none'
    ? parsed.confidence
    : 'high';

  return {
    ...emptyResult(),
    trackingNumber: verifiedTracking,
    carrier: verifiedCarrier,
    title,
    pickupLocation,
    lockerPin: deterministicResult?.lockerPin || '',
    pickupHours: deterministicResult?.pickupHours || '',
    pickupPhone: deterministicResult?.pickupPhone || '',
    origin: typeof parsed.origin === 'string' ? parsed.origin.trim() : '',
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
    confidence,
    isGroundedCandidate: true
  };
}

/**
 * @param {{ mode: 'text-fallback' | 'image', text?: string, imageBase64?: string, candidates?: Array<{id: string, value: string, carrierCandidates?: string[]}> }} payload
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

  if (payload.mode === 'image') {
    const rawImage = payload.imageBase64;
    if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
      return emptyResult();
    }

    const stripped = stripDataUrlPrefix(rawImage);
    const contentParts = [
      { inlineData: { mimeType: 'image/jpeg', data: stripped } },
      { text: 'Transcribe all visible shipping text and extract tracking details from this screenshot or shipping label.' }
    ];

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: contentParts }],
      config: {
        systemInstruction: IMAGE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: IMAGE_RESPONSE_SCHEMA,
        temperature: 0
      }
    });

    const text = response.text;
    if (!text) return emptyResult();

    try {
      const parsed = JSON.parse(text);
      return groundImageParseResult(parsed);
    } catch {
      return emptyResult();
    }
  }

  // mode === 'text-fallback'
  const candidates = normalizeCandidates(payload.candidates);
  if (candidates.length === 0) return emptyResult();

  const candidatePrompt = JSON.stringify(candidates);
  if (Buffer.byteLength(candidatePrompt, 'utf8') > MAX_CANDIDATE_PROMPT_BYTES) return emptyResult();

  const contentParts = [
    { text: `${payload.text}\n\nDeterministic candidates (select an ID or none):\n${candidatePrompt}` }
  ];

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
    const selected = candidates.find((candidate) => candidate.id === parsed.selectedCandidateId);
    if (!selected) return emptyResult();
    return {
      ...emptyResult(),
      trackingNumber: selected.value,
      carrier: selected.carrierCandidates[0] || 'other',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      pickupLocation: typeof parsed.pickupLocation === 'string' ? parsed.pickupLocation : '',
      origin: typeof parsed.origin === 'string' ? parsed.origin : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'none',
      isGroundedCandidate: true
    };
  } catch {
    // A malformed response is a Gemini-side anomaly, not a caller error —
    // fail closed to "nothing found" rather than surfacing a 500.
    return emptyResult();
  }
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];
  const suppliedIds = new Set();
  for (const candidate of candidates) {
    if (candidate && typeof candidate.id === 'string' && CANDIDATE_ID_RE.test(candidate.id)) {
      if (suppliedIds.has(candidate.id)) return [];
      suppliedIds.add(candidate.id);
    }
  }
  const ids = new Set();
  const normalized = [];
  for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
    if (!candidate || typeof candidate.id !== 'string' || typeof candidate.value !== 'string') continue;
    if (!CANDIDATE_ID_RE.test(candidate.id) || ids.has(candidate.id)) continue;
    const value = candidate.value.trim().toUpperCase();
    if (value.length < 6 || value.length > MAX_CANDIDATE_VALUE_LENGTH) continue;
    const carrierCandidates = deriveCarrierCandidates(value);
    if (carrierCandidates.length === 0 || !passesChecksumPolicy(value, carrierCandidates)) continue;
    ids.add(candidate.id);
    normalized.push({
      id: candidate.id,
      value,
      // Carrier hints arrive from an untrusted callable payload. Derive the
      // carrier from the generated server-side spec instead of accepting the
      // candidate's first claimed carrier.
      carrierCandidates
    });
  }
  return normalized;
}

function deriveCarrierCandidates(value) {
  const matches = [];
  for (const rule of COMPILED_RULES) {
    if (rule.re.test(value) && CARRIER_IDS.includes(rule.carrierId) && !matches.includes(rule.carrierId)) {
      matches.push(rule.carrierId);
    }
  }
  return matches;
}

function passesChecksumPolicy(value, carrierIds) {
  if (!Array.isArray(carrierIds) || carrierIds.length === 0) return false;
  const matchingRules = COMPILED_RULES.filter((rule) => (
    carrierIds.includes(rule.carrierId) && rule.re.test(value)
  ));
  if (matchingRules.length === 0) return false;
  // A matching checksum rule must pass. Rules without a checksum remain
  // legitimate deterministic candidates.
  return !matchingRules.some((rule) => {
    if (rule.checksum === 'upu-s10') return !validateUPUS10Mod11(value);
    if (rule.checksum === 'mod10-31') return !validateMod10(value);
    return false;
  });
}

function validateMod10(value) {
  if (!/^\d+$/.test(value)) return false;
  let sum = 0;
  let weight = 3;
  for (let index = value.length - 2; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === Number(value[value.length - 1]);
}

function stripDataUrlPrefix(imageBase64) {
  const commaIndex = imageBase64.indexOf(',');
  return imageBase64.startsWith('data:') && commaIndex !== -1
    ? imageBase64.slice(commaIndex + 1)
    : imageBase64;
}

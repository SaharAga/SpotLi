/**
 * AI fallback for the Gmail auto-sync pipeline — the missing half of the
 * two-stage design the deterministic parser (trackingExtraction.js)
 * already sets up but nothing used to consume: extractTrackingDetails()
 * always returns a ranked `candidates` list with scores, but
 * buildPackageFromGmailMessage only ever acted on a `verified` (score
 * >= 0.80) top candidate — a `probable`/`uncertain` candidate (0.40-0.79)
 * was silently discarded, even though the deterministic layer had already
 * found *something* plausible. This module is what tries Gemini on that
 * left-over case, reusing the same parseWithGemini() Smart Import already
 * relies on (see gemini.js) — Gemini only ever *selects* one of the
 * already-found candidates or declines, it never invents a tracking
 * number, so this can't hallucinate a package out of nothing.
 *
 * Deliberately NOT invoked for the zero-candidate case: parseWithGemini
 * itself short-circuits to an empty result when given no candidates (see
 * gemini.js), so there would be nothing for it to do — and
 * looksLikeShippingCandidate() below exists precisely to keep messages
 * that aren't remotely shipping-shaped from reaching even that point.
 */

import { checkAndIncrementUsage } from './guards.js';
import { GMAIL_AI_LIMITS } from './config.js';
import { looksLikeShippingCandidate } from './emailFilterQuery.js';
import { parseWithGemini } from './gemini.js';

const GMAIL_AI_USAGE_COLLECTION = 'gmailAiUsage';
const INSIGHTS_COLLECTION = 'gmailParseInsights';

/**
 * Truncates and strips a subject to a safe, non-identifying label for the
 * insights log — enough to spot a pattern (a whole subject line shape,
 * not free text) without storing arbitrary email content.
 * @param {string} subject
 */
function subjectShape(subject = '') {
  return subject.slice(0, 120);
}

/**
 * Best-effort write to gmailParseInsights — the free signal the product
 * conversation asked for: which senders/patterns the regex misses, and
 * whether AI could or couldn't resolve them, so a human can turn the
 * recurring ones into new regex rules (see trackingExtraction.js) instead
 * of leaving Gemini to carry them forever. Anonymized: sender domain and a
 * truncated subject only, never the email body.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} entry
 */
async function logInsight(db, entry) {
  try {
    await db.collection(INSIGHTS_COLLECTION).add({ ...entry, timestamp: new Date().toISOString() });
  } catch (err) {
    console.warn('[gmailAiFallback] Failed to log parse insight:', err?.message || err);
  }
}

function senderDomain(from = '') {
  const match = from.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Attempts to resolve an unverified (probable/uncertain) deterministic
 * extraction via Gemini, subject to Gmail-sync-specific rate limits and the
 * cheap sender/keyword gate. Returns null whenever AI shouldn't be or
 * wasn't able to resolve anything — the caller falls back to whatever it
 * would have done anyway (order-status extraction, or drop).
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   apiKey: string,
 *   uid: string,
 *   subject: string,
 *   body: string,
 *   from: string,
 *   extraction: ReturnType<typeof import('./trackingExtraction.js').extractTrackingDetails>,
 *   runBudget?: { used: number, max: number },
 *   parseFn?: typeof parseWithGemini
 * }} params
 * @returns {Promise<{ trackingNumber: string, carrier: string, title: string, confidence: string } | null>}
 */
export async function resolveUnverifiedCandidateWithAi({
  db,
  apiKey,
  uid,
  subject,
  body,
  from,
  extraction,
  runBudget,
  parseFn = parseWithGemini
}) {
  if (!apiKey) return null;
  if (!extraction || extraction.candidates.length === 0) return null;
  if (extraction.status !== 'probable' && extraction.status !== 'uncertain') return null;
  if (!looksLikeShippingCandidate(subject, from)) return null;
  if (runBudget && runBudget.used >= runBudget.max) return null;

  const usage = await checkAndIncrementUsage(db, uid, {
    collection: GMAIL_AI_USAGE_COLLECTION,
    userLimit: GMAIL_AI_LIMITS.PER_USER_DAILY_CALLS,
    globalLimit: GMAIL_AI_LIMITS.GLOBAL_DAILY_CALLS
  });
  if (!usage.allowed) {
    await logInsight(db, {
      outcome: 'ai-capped',
      reason: usage.reason,
      regexStatus: extraction.status,
      senderDomain: senderDomain(from),
      subjectShape: subjectShape(subject)
    });
    return null;
  }
  if (runBudget) runBudget.used += 1;

  let result;
  try {
    result = await parseFn(
      { mode: 'text-fallback', text: `${subject}\n\n${body}`.slice(0, 5000), candidates: extraction.candidates },
      apiKey
    );
  } catch (err) {
    console.warn('[gmailAiFallback] Gemini call failed:', err?.message || err);
    await logInsight(db, {
      outcome: 'ai-error',
      regexStatus: extraction.status,
      senderDomain: senderDomain(from),
      subjectShape: subjectShape(subject)
    });
    return null;
  }

  const resolved = result?.confidence === 'high' || result?.confidence === 'medium';
  await logInsight(db, {
    outcome: resolved ? 'ai-resolved' : 'ai-declined',
    regexStatus: extraction.status,
    regexTopCandidate: extraction.selectedCandidate?.value || null,
    regexTopScore: extraction.selectedCandidate?.score ?? null,
    aiConfidence: result?.confidence || 'none',
    aiCarrier: resolved ? result.carrier : null,
    senderDomain: senderDomain(from),
    subjectShape: subjectShape(subject)
  });

  if (!resolved || !result.trackingNumber) return null;

  return {
    trackingNumber: result.trackingNumber,
    carrier: result.carrier || 'other',
    title: result.title || '',
    confidence: result.confidence
  };
}

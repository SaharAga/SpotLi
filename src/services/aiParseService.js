import { httpsCallable } from 'firebase/functions';
import { functionsInstance, auth } from './firebase';
import { redactPII } from '../utils/privacySanitizer';

/**
 * Client for the `parseWithAi` Cloud Function — a fallback for the
 * deterministic parser (smartParser.js) when it finds nothing in pasted
 * text, and the only way to read a pasted screenshot at all.
 *
 * Requires sign-in and, once configured, App Check (see firebase.js) — the
 * function itself enforces both server-side; this client fails gracefully
 * to "unavailable" rather than throwing when either isn't met, so a guest
 * user or a build without the function deployed just falls through to the
 * existing manual-entry path instead of crashing Smart Import.
 */

/**
 * @param {{ mode: 'text-fallback', text: string } | { mode: 'image', imageBase64: string }} payload
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { trackingNumber: string, carrier: string, title: string, pickupLocation: string, origin: string, notes: string, confidence: 'high'|'medium'|'low'|'none' },
 *   unavailable?: boolean,
 *   rateLimited?: boolean,
 *   error?: string
 * }>}
 */
/**
 * How long the client waits before giving up on the callable.
 *
 * The function itself is capped at 30s server-side, so anything past this is
 * the request never having been sent — most often App Check unable to mint a
 * token, which leaves `httpsCallable` awaiting the token rather than failing.
 * Without a client-side bound that state is indistinguishable from a slow
 * parse, and the user watches a spinner indefinitely.
 */
export const AI_PARSE_TIMEOUT_MS = 35000;

export async function parseWithAi(payload) {
  if (!functionsInstance || !auth?.currentUser) {
    return { success: false, unavailable: true, error: 'AI parsing is not available right now.' };
  }

  try {
    // Redact obvious third-party PII (emails, phone numbers, "recipient:"/
    // "c/o:"-style note prefixes) before it leaves the device for Google's
    // API — the pasted text is often a courier message about someone else's
    // delivery, not just the signed-in user's own data. Best-effort: a
    // tracking number that happens to be a 13-19 digit string can get
    // caught by the same credit-card pattern and redacted too, which just
    // means this call comes back empty rather than leaking anything.
    const outgoingPayload = payload?.mode === 'text-fallback' && typeof payload.text === 'string'
      ? { ...payload, text: redactPII(payload.text) }
      : payload;

    const callable = httpsCallable(functionsInstance, 'parseWithAi');

    const result = await Promise.race([
      callable(outgoingPayload),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('ai-parse-timeout')), AI_PARSE_TIMEOUT_MS);
      })
    ]);

    return { success: true, data: result.data };
  } catch (err) {
    if (err?.code === 'functions/resource-exhausted') {
      return { success: false, rateLimited: true, error: err.message || 'Daily AI-parse limit reached.' };
    }
    if (err?.code === 'functions/unauthenticated') {
      return { success: false, unavailable: true, error: 'Sign in to use AI-assisted parsing.' };
    }
    if (err?.message === 'ai-parse-timeout') {
      console.warn('[aiParseService] parseWithAi timed out after', AI_PARSE_TIMEOUT_MS, 'ms');
      return { success: false, unavailable: true, error: 'AI parsing timed out. You can still enter details manually.' };
    }
    console.warn('[aiParseService] parseWithAi failed:', err);
    return { success: false, error: err?.message || 'AI parsing failed.' };
  }
}

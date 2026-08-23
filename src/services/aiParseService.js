import { httpsCallable } from 'firebase/functions';
import { functionsInstance, auth } from './firebase';

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
export async function parseWithAi(payload) {
  if (!functionsInstance || !auth?.currentUser) {
    return { success: false, unavailable: true, error: 'AI parsing is not available right now.' };
  }

  try {
    const callable = httpsCallable(functionsInstance, 'parseWithAi');
    const result = await callable(payload);
    return { success: true, data: result.data };
  } catch (err) {
    if (err?.code === 'functions/resource-exhausted') {
      return { success: false, rateLimited: true, error: err.message || 'Daily AI-parse limit reached.' };
    }
    if (err?.code === 'functions/unauthenticated') {
      return { success: false, unavailable: true, error: 'Sign in to use AI-assisted parsing.' };
    }
    console.warn('[aiParseService] parseWithAi failed:', err);
    return { success: false, error: err?.message || 'AI parsing failed.' };
  }
}

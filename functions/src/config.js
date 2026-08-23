/**
 * Tunable limits and the Gemini model id in one place, so cost guards can be
 * adjusted without hunting through the handler.
 *
 * GEMINI_MODEL is deliberately a specific version, not a "-latest" alias:
 * Google has deprecated "-latest" aliases before (gemini-flash-latest) and
 * retires model versions on a real lifecycle (Gemini 2.0 Flash shut down
 * June 2026) — pinning to a version we've verified works, and reviewing it
 * periodically against https://ai.google.dev/gemini-api/docs/models, is
 * safer than an alias that can change or vanish under us without notice.
 * "flash-lite" tier is intentional: this is narrow structured extraction,
 * not agentic/coding work, so the cheapest capable tier is the right fit.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

export const LIMITS = Object.freeze({
  // Per authenticated user, per UTC day. Generous for real usage, low
  // enough to bound damage from one runaway client or bad-faith user.
  PER_USER_DAILY_CALLS: 30,
  // Hard ceiling across all users, per UTC day — the actual backstop
  // regardless of how per-user limits are bypassed or misconfigured.
  GLOBAL_DAILY_CALLS: 500,
  // Bounds cost-per-call and rules out pathological inputs.
  MAX_TEXT_LENGTH: 5000,
  // Base64-encoded, so this is the encoded size cap, not the raw image
  // size. Mirrors the 750KB screenshot cap already used for feedback.
  MAX_IMAGE_BASE64_BYTES: 1_000_000
});

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

/**
 * Separate, tighter budget for the Gmail-sync AI fallback
 * (gmailAiFallback.js) — deliberately its own counters (see
 * checkAndIncrementUsage's `collection` option), not a share of LIMITS
 * above, because Gmail sync is unattended and can see much higher message
 * volume than a human pasting one email at a time into Smart Import: a
 * single busy inbox must never be able to exhaust the interactive-use
 * budget for every user of the app.
 */
export const GMAIL_AI_LIMITS = Object.freeze({
  PER_USER_DAILY_CALLS: 15,
  GLOBAL_DAILY_CALLS: 200,
  // Extra ceiling scoped to one backfill run (on connect, or a manual
  // re-scan) — the 30-day historical scan is the single biggest burst this
  // pipeline ever sees, so it gets its own cap on top of the daily ones
  // instead of relying on the daily cap alone to absorb it.
  MAX_AI_CALLS_PER_BACKFILL_RUN: 15
});

/**
 * Separate budget for the `gmailBackfill` callable itself (gmailBackfill.js)
 * — distinct from GMAIL_AI_LIMITS, which only bounds the AI-fallback calls
 * *within* a run. A signed-in user can call this callable directly (it's
 * not reachable only through the UI's connect button, which is a UX
 * convenience, not an access control), and each call re-scans up to 100
 * Gmail messages regardless of whether any of them use AI fallback — so
 * the call itself needs its own low daily ceiling to bound Gmail API quota
 * and prevent a user from repeatedly re-triggering their own 30-day scan.
 * Real usage only ever calls this once per connect (plus an occasional
 * legitimate reconnect), so this stays deliberately tight.
 */
export const GMAIL_BACKFILL_LIMITS = Object.freeze({
  PER_USER_DAILY_CALLS: 5,
  GLOBAL_DAILY_CALLS: 500
});

/**
 * Budget for carrier tracking live proxy calls (carrierProxy.js).
 * Bounds external API credits (17TRACK paid quota) and prevents
 * automated abuse or scraping of courier endpoints.
 */
export const CARRIER_TRACKING_LIMITS = Object.freeze({
  PER_USER_DAILY_CALLS: 50,
  GLOBAL_DAILY_CALLS: 2000
});


/**
 * Budget and pacing for the scheduled background tracking refresh
 * (scheduledTrackingRefresh.js).
 *
 * Deliberately conservative, because what 17TRACK actually meters is not
 * confirmed. Their usual model bills per registered tracking number, which
 * would make re-querying an already-registered parcel nearly free — if that
 * holds, `INTERVAL_HOURS` can drop to 1 and only `MAX_LOOKUPS_PER_RUN` needs
 * raising with it. Until it is confirmed from the dashboard, every knob here
 * assumes a query costs something, and each run logs what it actually spent so
 * the guess can be checked against the real counter.
 */
export const TRACKING_REFRESH_LIMITS = Object.freeze({
  /** How often the scheduler fires. The one knob to change on new quota facts. */
  INTERVAL_HOURS: 6,
  /** Hard ceiling on upstream lookups in a single run. */
  MAX_LOOKUPS_PER_RUN: 60,
  /** Users scanned per run; a cap, not a target. */
  MAX_USERS_PER_RUN: 500,
  /** Packages read per user per run. */
  MAX_PACKAGES_PER_USER: 100,
  /** Concurrent upstream lookups. Small: 17TRACK is not ours to hammer. */
  CONCURRENCY: 4,
  /** Shortest gap between two lookups of the same number. */
  MIN_INTERVAL_MS: 6 * 60 * 60 * 1000,
  /**
   * Longest gap a repeatedly-unproductive number backs off to. A number the
   * network has never heard of costs the same as a real one, so without a
   * ceiling-bounded backoff a handful of dead numbers would quietly eat the
   * whole budget forever.
   */
  MAX_INTERVAL_MS: 4 * 24 * 60 * 60 * 1000,
  /** Backoff multiplier applied per consecutive unproductive lookup. */
  BACKOFF_FACTOR: 2,
  /** After this many consecutive failures a number is parked at MAX_INTERVAL_MS. */
  MAX_CONSECUTIVE_FAILURES: 8
});

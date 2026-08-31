/**
 * Minimal, best-effort feature-usage event log — the server-side half of
 * the analytics foundation. Purpose: give the product a free, ongoing
 * signal on how each automated feature actually performs in the wild
 * (Gmail sync hit/miss/AI-assist rates today; any other Cloud Function can
 * adopt the same `logUsageEvent` call for its own feature going forward),
 * instead of only ever finding out something's broken when a user reports
 * it days later.
 *
 * Deliberately NOT a generic analytics SDK: one flat collection, one
 * append-only write, no PII, no free-text bodies — same anonymization bar
 * as crashReportService.js and parseCorrectionService.js. Never let a
 * logging failure break the caller's actual work.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ feature: string, type: string, uid?: string, [key: string]: unknown }} event
 */
export async function logUsageEvent(db, event) {
  try {
    await db.collection('usageEvents').add({ ...event, timestamp: new Date().toISOString() });
  } catch (err) {
    console.warn('[analyticsEvents] Failed to log usage event:', err?.message || err);
  }
}

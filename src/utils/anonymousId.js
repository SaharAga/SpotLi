/**
 * A stable, random, non-identifying ID for a signed-out browser — exists
 * purely so a guest's feature-usage rows (featureUsageService.js) can be
 * deduplicated per day (one row per identity per feature per day, not one
 * per click) the same way a signed-in user's `uid` already does. It is
 * never tied to an account, never sent to any endpoint that also carries
 * PII, and never itself readable back once written — see
 * featureUsageService.js and firestore.rules for the collection this
 * feeds, which nobody (including admin) can read raw rows from.
 */

const STORAGE_KEY = 'deliveree_anon_id';

export function getOrCreateAnonymousId() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const fresh =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Storage unavailable (private mode, quota, etc.) — feature-usage
    // recording just no-ops for this session rather than throwing.
    return null;
  }
}

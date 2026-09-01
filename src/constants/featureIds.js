/**
 * Canonical feature identifiers for featureUsageService.js /
 * featureAdoptionRollup.js. Deliberately a fixed, small allowlist (not any
 * arbitrary string a caller supplies) — firestore.rules validates writes
 * against the same list by hand (functions/ can't import from src/), so
 * keep the two in sync when adding a feature, same dual-maintenance
 * tradeoff as src/constants/emailFilters.js / functions/src/
 * emailFilterQuery.js.
 *
 * APP_ACTIVE is the baseline every other feature's adoption % is computed
 * against — "unique users who touched X that day" ÷ "unique users active
 * in the app at all that day" — recorded once per session, not tied to
 * any particular screen.
 */
export const FEATURE_IDS = Object.freeze({
  APP_ACTIVE: '_app_active',
  ANALYTICS_MODAL: 'analytics_modal',
  EXPORT: 'export',
  SMART_IMPORT: 'smart_import',
  GMAIL_SYNC: 'gmail_sync',
  PWA_INSTALL: 'pwa_install',
  SHARE_TARGET_IMPORT: 'share_target_import'
});

export const FEATURE_ID_LIST = Object.freeze(Object.values(FEATURE_IDS));

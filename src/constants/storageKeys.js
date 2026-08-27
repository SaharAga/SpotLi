/**
 * Centralized registry of localStorage and sessionStorage keys used by Deliveree.
 * Single source of truth to avoid partition collisions and key fragmentation.
 */

export const STORAGE_KEYS = Object.freeze({
  AUTH_USER: 'deliveree_auth_user_v1',
  PACKAGES_GUEST: 'deliveree_packages_guest',
  PACKAGES_USER_PREFIX: 'deliveree_packages_',
  TOMBSTONES_PREFIX: 'deliveree_deleted_tombstones_',
  TOMBSTONES_GUEST: 'deliveree_deleted_tombstones_guest',
  THEME: 'deliveree_theme',
  APP_BUILD_VERSION: 'deliveree_app_build_version',
  AUTO_ARCHIVE_DELIVERED: 'deliveree_auto_archive_delivered',
  AUTO_ARCHIVE_PROMPTED: 'deliveree_auto_archive_prompted',
  PWA_BANNER_DISMISSED: 'deliveree_pwa_banner_dismissed',
  OFFLINE_SYNC_QUEUE: 'deliveree_offline_sync_queue',
  OFFLINE_FEEDBACK_QUEUE: 'deliveree_offline_feedback_queue',
  OFFLINE_CRASH_QUEUE: 'deliveree_offline_crash_queue',
  CRASH_SEEN: 'deliveree_crash_seen_v1',
  LOCAL_FEEDBACK_HISTORY: 'deliveree_tester_feedback',
  NOTIFICATION_PREFS: 'deliveree_notification_prefs',
  PUSH_SUBSCRIPTION: 'deliveree_push_subscription',
  EMAIL_INTEGRATIONS: 'deliveree_email_integrations_v1',
  LIVE_TRACK_PREFIX: 'deliveree_live_track_'
});

/**
 * Validates whether a given key string belongs to the Deliveree storage domain.
 *
 * @param {unknown} key
 * @returns {boolean}
 */
export function isAppStorageKey(key) {
  return typeof key === 'string' && key.startsWith('deliveree_');
}

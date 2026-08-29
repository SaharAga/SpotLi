import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS, isAppStorageKey } from './storageKeys.js';

describe('Storage Keys Constants', () => {
  it('exports frozen STORAGE_KEYS object with expected keys and values', () => {
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true);
    expect(STORAGE_KEYS.AUTH_USER).toBe('deliveree_auth_user_v1');
    expect(STORAGE_KEYS.PACKAGES_GUEST).toBe('deliveree_packages_guest');
    expect(STORAGE_KEYS.PACKAGES_USER_PREFIX).toBe('deliveree_packages_');
    expect(STORAGE_KEYS.TOMBSTONES_PREFIX).toBe('deliveree_deleted_tombstones_');
    expect(STORAGE_KEYS.TOMBSTONES_GUEST).toBe('deliveree_deleted_tombstones_guest');
    expect(STORAGE_KEYS.THEME).toBe('deliveree_theme');
    expect(STORAGE_KEYS.APP_BUILD_VERSION).toBe('deliveree_app_build_version');
    expect(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED).toBe('deliveree_auto_archive_delivered');
    expect(STORAGE_KEYS.AUTO_ARCHIVE_PROMPTED).toBe('deliveree_auto_archive_prompted');
    expect(STORAGE_KEYS.PWA_BANNER_DISMISSED).toBe('deliveree_pwa_banner_dismissed');
    expect(STORAGE_KEYS.OFFLINE_SYNC_QUEUE).toBe('deliveree_offline_sync_queue');
    expect(STORAGE_KEYS.OFFLINE_FEEDBACK_QUEUE).toBe('deliveree_offline_feedback_queue');
    expect(STORAGE_KEYS.OFFLINE_CRASH_QUEUE).toBe('deliveree_offline_crash_queue');
    expect(STORAGE_KEYS.CRASH_SEEN).toBe('deliveree_crash_seen_v1');
    expect(STORAGE_KEYS.LOCAL_FEEDBACK_HISTORY).toBe('deliveree_tester_feedback');
    expect(STORAGE_KEYS.NOTIFICATION_PREFS).toBe('deliveree_notification_prefs');
    expect(STORAGE_KEYS.PUSH_SUBSCRIPTION).toBe('deliveree_push_subscription');
    expect(STORAGE_KEYS.EMAIL_INTEGRATIONS).toBe('deliveree_email_integrations_v1');
    expect(STORAGE_KEYS.LIVE_TRACK_PREFIX).toBe('deliveree_live_track_');
    expect(STORAGE_KEYS.PREFERRED_NAV_APP).toBe('deliveree_preferred_nav_app');
  });

  describe('isAppStorageKey', () => {
    it('returns true for keys starting with deliveree_', () => {
      expect(isAppStorageKey('deliveree_auth_user_v1')).toBe(true);
      expect(isAppStorageKey('deliveree_custom_key')).toBe(true);
    });

    it('returns false for keys not starting with deliveree_', () => {
      expect(isAppStorageKey('other_key')).toBe(false);
      expect(isAppStorageKey('random')).toBe(false);
      expect(isAppStorageKey('')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isAppStorageKey(null)).toBe(false);
      expect(isAppStorageKey(undefined)).toBe(false);
      expect(isAppStorageKey(123)).toBe(false);
      expect(isAppStorageKey({})).toBe(false);
    });
  });
});

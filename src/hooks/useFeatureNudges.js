import { useState, useEffect, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { getConnectedServices } from '../services/emailSyncService';

/**
 * Registry of contextual feature adoption nudges.
 * Evaluates user activity to provide timely, non-spammy prompts.
 * Enforces:
 * 1. Strictly at most 1 nudge per session.
 * 2. Permanent suppression if "Don't show again" is clicked.
 */
const NUDGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14-day re-prompt cooldown for temporary dismissal

export function useFeatureNudges({ packages = [], user = null }) {
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [storageNudges, setStorageNudges] = useState(() => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.FEATURE_NUDGES);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const isPermanentlyDismissed = useCallback((id) => {
    if (storageNudges[id]?.permanent) return true;
    if (storageNudges[id]?.dismissedAt) {
      return (Date.now() - storageNudges[id].dismissedAt) < NUDGE_COOLDOWN_MS;
    }
    return false;
  }, [storageNudges]);

  const activeNudge = useMemo(() => {
    if (sessionDismissed) return null;

    // 1. Push Notifications Nudge (High Intent: user has at least 1 package being tracked)
    if (!isPermanentlyDismissed('push_notifications') && packages.length >= 1) {
      const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
      if (hasNotificationApi && window.Notification.permission === 'default') {
        return {
          id: 'push_notifications',
          type: 'push'
        };
      }
    }

    // 2. Gmail Sync Nudge (User is signed in and tracking manually, but Gmail not connected)
    if (!isPermanentlyDismissed('gmail_sync') && user && packages.length >= 1) {
      const services = getConnectedServices(user);
      if (!services.gmail) {
        return {
          id: 'gmail_sync',
          type: 'gmail'
        };
      }
    }

    // 3. Locker Mode Nudge (Package is ready for pickup or at locker)
    if (!isPermanentlyDismissed('locker_mode')) {
      const hasLockerPkg = packages.some(
        (p) => (p.pickupCode && p.status === 'ready_for_pickup') || p.locationType === 'locker'
      );
      if (hasLockerPkg) {
        return {
          id: 'locker_mode',
          type: 'locker'
        };
      }
    }

    return null;
  }, [packages, user, sessionDismissed, isPermanentlyDismissed]);

  const dismissNudge = useCallback((id) => {
    setSessionDismissed(true);
    try {
      const updated = {
        ...storageNudges,
        [id]: { dismissedAt: Date.now(), permanent: false }
      };
      setStorageNudges(updated);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.FEATURE_NUDGES, JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('[useFeatureNudges] Failed to save dismissal:', err);
    }
  }, [storageNudges]);

  const suppressPermanently = useCallback((id) => {
    setSessionDismissed(true);
    try {
      const updated = {
        ...storageNudges,
        [id]: { dismissedAt: Date.now(), permanent: true }
      };
      setStorageNudges(updated);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.FEATURE_NUDGES, JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('[useFeatureNudges] Failed to save permanent suppression:', err);
    }
  }, [storageNudges]);

  return {
    activeNudge,
    dismissNudge,
    suppressPermanently
  };
}

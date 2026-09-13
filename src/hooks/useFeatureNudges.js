import { useState, useEffect, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { getConnectedServices, getGmailConnectionStatus } from '../services/emailSyncService';

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

  const [isGmailConnected, setIsGmailConnected] = useState(() => {
    return Boolean(getConnectedServices(user).gmail);
  });

  // Verify server-side Gmail connection status if user is signed in
  useEffect(() => {
    if (!user) {
      setIsGmailConnected(false);
      return;
    }
    const local = getConnectedServices(user);
    if (local.gmail) {
      setIsGmailConnected(true);
      return;
    }
    let isMounted = true;
    getGmailConnectionStatus().then((status) => {
      if (isMounted && status?.connected) {
        setIsGmailConnected(true);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [user]);

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
    // isGmailConnected is in this memo's dependency list deliberately: the
    // server confirmation below resolves *after* first paint, and without the
    // dependency the memo kept the value it was built with, so an already
    // connected user was still nudged to connect Gmail.
    if (!isPermanentlyDismissed('gmail_sync') && user && packages.length >= 1) {
      const services = getConnectedServices(user);
      if (!services.gmail && !isGmailConnected) {
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
  }, [packages, user, sessionDismissed, isPermanentlyDismissed, isGmailConnected]);

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
    suppressPermanently,
    // Exposed because the empty-state onboarding gate needs the same answer.
    // Resolving it here once — rather than letting each consumer call
    // getGmailConnectionStatus itself — keeps it to one callable per session.
    isGmailConnected
  };
}

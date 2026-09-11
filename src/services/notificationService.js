import { readJSON, writeJSON } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export const NOTIFICATION_PREFS_KEY = STORAGE_KEYS.NOTIFICATION_PREFS;
export const PUSH_SUBSCRIPTION_KEY = STORAGE_KEYS.PUSH_SUBSCRIPTION;

/**
 * Default notification preferences schema
 */
export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  pushEnabled: false,
  notifyOnStatusChange: true,
  notifyOnException: true,
  notifyOnDelivered: true,
  notifyOnCustoms: true
});

/**
 * Stage labels and bilingual descriptions for notifications
 */
export const STATUS_NOTIFICATION_INFO = {
  ordered: {
    emoji: '📝',
    he: 'ההזמנה נקלטה',
    en: 'Order Placed'
  },
  shipped: {
    emoji: '📦',
    he: 'נשלח מהמוכר',
    en: 'Shipped from Seller'
  },
  in_transit: {
    emoji: '✈️',
    he: 'בדרך לישראל',
    en: 'In Transit'
  },
  customs: {
    emoji: '🛃',
    he: 'בבדיקת מכס / דורש שחרור',
    en: 'Customs Clearance Required'
  },
  out_for_delivery: {
    emoji: '🚚',
    he: 'נמסר לחלוקה / ממתין לאיסוף',
    en: 'Out for Delivery / Ready for Pickup'
  },
  delivered: {
    emoji: '✅',
    he: 'החבילה נמסרה בהצלחה!',
    en: 'Package Delivered Successfully!'
  },
  exception: {
    emoji: '⚠️',
    he: 'עיכוב או חריגה במשלוח',
    en: 'Delivery Exception / Delay'
  },
  returned_to_sender: {
    emoji: '↩️',
    he: 'החבילה הוחזרה לשולח',
    en: 'Package Returned to Sender'
  },
  archived: {
    emoji: '📁',
    he: 'הועבר לארכיון',
    en: 'Archived'
  }
};

/**
 * Utility: Convert URL safe base64 to Uint8Array for PushManager subscription
 */
export function urlBase64ToUint8Array(base64String) {
  if (!base64String) return new Uint8Array(0);
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  
  const rawData = (typeof window !== 'undefined' && typeof window.atob === 'function')
    ? window.atob(base64)
    : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('binary') : '');

  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Deterministic Firestore doc id for a PushSubscription, derived from its
 * endpoint via SHA-256 — must match functions/src/pushNotifications.js's
 * `subscriptionDocId` exactly (same algorithm, same 40-char slice) since
 * the client writes this doc directly rather than asking the server to
 * mint an id, and re-subscribing the same device must overwrite the same
 * doc rather than accumulate duplicates.
 * @param {string} endpoint
 * @returns {Promise<string>}
 */
export async function subscriptionEndpointToDocId(endpoint) {
  const data = new TextEncoder().encode(endpoint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 40);
}

/**
 * Utility: Format push payload for service worker / FCM
 */
export function formatPushPayload({ title, body, packageId, trackingNumber, actions }) {
  return {
    title: title || 'SpotLi Update | עדכון משלוח',
    body: body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: packageId ? `pkg-${packageId}` : (trackingNumber ? `pkg-${trackingNumber}` : 'spotli-update'),
    url: packageId ? `/?packageId=${encodeURIComponent(packageId)}` : '/',
    packageId: packageId || null,
    data: {
      packageId: packageId || null,
      trackingNumber: trackingNumber || null,
      timestamp: Date.now()
    },
    actions: actions || [
      { action: 'view', title: 'View Tracking | צפה במשלוח' },
      { action: 'dismiss', title: 'Dismiss | סגור' }
    ]
  };
}

export const notificationService = {
  /**
   * Retrieves user notification preferences from localStorage
   * @returns {typeof DEFAULT_NOTIFICATION_PREFS}
   */
  getPreferences: () => {
    const stored = readJSON(NOTIFICATION_PREFS_KEY, null);
    if (stored && typeof stored === 'object') {
      return {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...stored
      };
    }
    return { ...DEFAULT_NOTIFICATION_PREFS };
  },

  /**
   * Saves updated user notification preferences to localStorage
   * Returns the merged preferences only. Callers that need to know whether the
   * write actually landed should use `savePreferencesWithStatus`.
   *
   * @param {Partial<typeof DEFAULT_NOTIFICATION_PREFS>} prefs
   * @returns {typeof DEFAULT_NOTIFICATION_PREFS}
   */
  savePreferences: (prefs) => notificationService.savePreferencesWithStatus(prefs).preferences,

  /**
   * Saves preferences and reports whether they reached storage.
   *
   * `writeJSON` catches storage failures internally and signals them by
   * returning false. Ignoring that return made a quota-exceeded write
   * indistinguishable from a successful one: the caller got the merged object
   * back and rendered a preference that was never persisted. The status is a
   * plain field on a plain object deliberately - a flag hidden on the returned
   * preferences would not survive spread, `.map`, or a JSON round trip.
   *
   * @param {Partial<typeof DEFAULT_NOTIFICATION_PREFS>} prefs
   * @returns {{ ok: boolean, preferences: typeof DEFAULT_NOTIFICATION_PREFS, error: Error|null }}
   */
  savePreferencesWithStatus: (prefs) => {
    try {
      const current = notificationService.getPreferences();
      const updated = { ...current, ...prefs };
      const persisted = writeJSON(NOTIFICATION_PREFS_KEY, updated);
      if (!persisted) {
        console.error(
          '[NotificationService] Failed to persist notification preferences (storage write rejected)'
        );
        return {
          ok: false,
          preferences: updated,
          error: new Error('Notification preferences could not be written to storage')
        };
      }
      return { ok: true, preferences: updated, error: null };
    } catch (e) {
      console.error('[NotificationService] Failed to save preferences to storage:', e);
      return { ok: false, preferences: { ...DEFAULT_NOTIFICATION_PREFS, ...prefs }, error: e };
    }
  },

  /**
   * Gets current Web Notification permission status
   * @returns {'default' | 'granted' | 'denied' | 'unsupported'}
   */
  getNotificationPermission: () => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root || !('Notification' in root) || typeof root.Notification === 'undefined') {
      return 'unsupported';
    }
    return root.Notification.permission || 'unsupported';
  },

  /**
   * Requests permission to send Web Notifications
   * @param {string} [uid] signed-in user's uid, to persist the resulting subscription for
   * @returns {Promise<'default' | 'granted' | 'denied' | 'unsupported'>}
   */
  requestNotificationPermission: async (uid) => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root || !('Notification' in root) || typeof root.Notification === 'undefined') {
      return 'unsupported';
    }
    try {
      const permission = await root.Notification.requestPermission();
      if (permission === 'granted') {
        // `pushEnabled: true` is only written once a subscription actually
        // exists AND (when signed in) has been persisted server-side. Setting
        // it on permission alone produced the failure this whole path exists
        // to prevent: a green "notifications are on" state in front of an
        // empty `pushSubscriptions/{uid}/tokens`, where every Cloud Function
        // send resolves to `{ sent: 0 }` and nothing is ever delivered.
        const result = await notificationService.subscribeToPush(import.meta.env.VITE_VAPID_PUBLIC_KEY, uid);
        notificationService.savePreferences({ pushEnabled: result.serverRegistered || (!uid && result.subscribed) });
      } else if (permission === 'denied') {
        notificationService.savePreferences({ pushEnabled: false });
      }
      return permission;
    } catch (e) {
      console.error('[NotificationService] Permission request failed:', e);
      return 'denied';
    }
  },

  /**
   * Subscribes the client to Web Push via Service Worker PushManager, and —
   * when signed in — persists the subscription server-side so Cloud
   * Functions can actually send to it (functions/src/pushNotifications.js).
   * Without that second step this only ever wrote to localStorage, which no
   * server-side code can read; a subscription nobody can reach is not a
   * subscription.
   *
   * Returns a status object rather than the bare subscription because the two
   * halves fail independently and the caller has to be able to tell them
   * apart: a browser subscription that was never persisted server-side looks
   * identical to a working one from the device's point of view, and is
   * useless. `reason` names the first step that failed, for the diagnostics
   * panel in AccountModal.
   *
   * @param {string} [vapidPublicKey]
   * @param {string} [uid] signed-in user's uid, to persist the subscription for
   * @returns {Promise<PushSubscriptionStatus>}
   */
  subscribeToPush: async (vapidPublicKey, uid) => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root || !root.navigator || !('serviceWorker' in root.navigator)) {
      return { subscribed: false, serverRegistered: false, subscription: null, reason: 'unsupported' };
    }

    try {
      const registration = await root.navigator.serviceWorker.ready;
      if (!registration || !registration.pushManager) {
        return { subscribed: false, serverRegistered: false, subscription: null, reason: 'no-push-manager' };
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        if (!vapidPublicKey) {
          // No VAPID public key in the build means PushManager.subscribe()
          // cannot be called at all, so no amount of granted permission will
          // ever produce a deliverable subscription. Surfaced rather than
          // swallowed: this is a deployment/config fault, not a user one.
          return { subscribed: false, serverRegistered: false, subscription: null, reason: 'no-vapid-key' };
        }
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (!subscription) {
        return { subscribed: false, serverRegistered: false, subscription: null, reason: 'subscribe-failed' };
      }

      writeJSON(PUSH_SUBSCRIPTION_KEY, subscription);

      if (!uid) {
        // Guest: a local subscription is all there is to have. Cloud Functions
        // send per-uid, so a guest never receives automatic pushes anyway.
        return { subscribed: true, serverRegistered: false, subscription, reason: 'signed-out' };
      }

      const serverRegistered = await notificationService.savePushSubscriptionToServer(uid, subscription);
      return {
        subscribed: true,
        serverRegistered,
        subscription,
        reason: serverRegistered ? null : 'server-write-failed'
      };
    } catch (e) {
      console.warn('[NotificationService] Push subscription failed or not supported:', e);
      return { subscribed: false, serverRegistered: false, subscription: null, reason: 'error' };
    }
  },

  /**
   * Re-establishes the server-side push subscription for an already-permitted
   * device. Safe and cheap to call on every sign-in and every time the
   * notification settings are opened.
   *
   * This exists because `subscribeToPush` used to be reachable from exactly
   * one place — the "enable notifications" button — which AccountModal only
   * renders while `Notification.permission !== 'granted'`. Any user who had
   * already granted permission (including everyone who granted it before
   * server-side push shipped), or whose browser rotated or dropped its
   * subscription, could therefore never create one again: the button was gone,
   * the UI said notifications were on, and `pushSubscriptions/{uid}/tokens`
   * stayed empty forever.
   *
   * A no-op unless permission is already granted — it never prompts.
   *
   * @param {string} [uid]
   * @returns {Promise<PushSubscriptionStatus>}
   */
  ensurePushSubscription: async (uid) => {
    if (notificationService.getNotificationPermission() !== 'granted') {
      return { subscribed: false, serverRegistered: false, subscription: null, reason: 'permission-not-granted' };
    }
    if (!notificationService.getPreferences().pushEnabled && !uid) {
      return { subscribed: false, serverRegistered: false, subscription: null, reason: 'disabled' };
    }

    const result = await notificationService.subscribeToPush(import.meta.env.VITE_VAPID_PUBLIC_KEY, uid);

    // Keep the stored preference honest in both directions: a device that now
    // has a reachable subscription is genuinely enabled, and one that lost it
    // must stop claiming to be. Only ever narrowed for a signed-in user —
    // a guest has no server side to be registered with.
    if (uid) {
      if (result.serverRegistered) {
        notificationService.savePreferences({ pushEnabled: true });
      } else if (result.reason === 'permission-not-granted') {
        notificationService.savePreferences({ pushEnabled: false });
      }
    }
    return result;
  },

  /**
   * Reports each independently-failing stage of the push pipeline, so a
   * non-arriving notification can be attributed instead of guessed at. The
   * in-app test notification deliberately does NOT appear here: it calls
   * `sendWebNotification` (a local `registration.showNotification`) and
   * proves only that the OS will display a notification — it never touches
   * VAPID, the server, or the service worker's `push` handler, so a passing
   * test is not evidence that Web Push works.
   *
   * @param {string} [uid]
   * @returns {Promise<{ permission: string, vapidConfigured: boolean, browserSubscription: boolean, serverRegistered: boolean|null, pushEnabled: boolean }>}
   */
  getPushDiagnostics: async (uid) => {
    const permission = notificationService.getNotificationPermission();
    const vapidConfigured = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);
    const pushEnabled = Boolean(notificationService.getPreferences().pushEnabled);

    let browserSubscription = false;
    let endpoint = null;
    const root = typeof window !== 'undefined' ? window : globalThis;
    try {
      if (root?.navigator && 'serviceWorker' in root.navigator) {
        const registration = await root.navigator.serviceWorker.ready;
        const subscription = await registration?.pushManager?.getSubscription();
        browserSubscription = Boolean(subscription);
        endpoint = subscription?.endpoint || null;
      }
    } catch {
      browserSubscription = false;
    }

    // `pushSubscriptions` is write-only from the client (firestore.rules) —
    // the Admin SDK is the only reader — so the client genuinely cannot read
    // back whether its own token doc exists. Re-writing it is the only
    // available proof, and it is idempotent (doc id is the endpoint hash).
    let serverRegistered = null;
    if (uid && browserSubscription) {
      const registration = await root.navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      serverRegistered = await notificationService.savePushSubscriptionToServer(uid, subscription);
    }

    return { permission, vapidConfigured, browserSubscription, serverRegistered, pushEnabled, endpoint };
  },

  /**
   * Persists a PushSubscription to `pushSubscriptions/{uid}/tokens/{tokenId}`
   * (see firestore.rules — write-only from the client, read only by the
   * Admin SDK) so a Cloud Function can send to this device later. Doc id is
   * derived from the endpoint so re-subscribing the same device overwrites
   * rather than accumulates duplicates.
   * @param {string} uid
   * @param {PushSubscription} subscription
   * @returns {Promise<boolean>} whether the write succeeded
   */
  savePushSubscriptionToServer: async (uid, subscription) => {
    if (!uid || !subscription?.endpoint) return false;
    try {
      const [{ doc, setDoc, serverTimestamp }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('./firebase')
      ]);
      if (!db) return false;
      const json = subscription.toJSON ? subscription.toJSON() : subscription;
      const tokenId = await subscriptionEndpointToDocId(subscription.endpoint);
      const ref = doc(db, 'pushSubscriptions', uid, 'tokens', tokenId);
      await setDoc(ref, {
        endpoint: json.endpoint,
        keys: json.keys || {},
        createdAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      console.warn('[NotificationService] Failed to persist push subscription server-side:', e);
      return false;
    }
  },

  /**
   * Unsubscribes the current device from Web Push both locally and
   * server-side — called when the user turns the push toggle off, so a
   * disabled device stops receiving (and Cloud Functions stops paying to
   * send to) notifications for it.
   * @param {string} [uid]
   * @returns {Promise<void>}
   */
  unsubscribeFromPush: async (uid) => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    try {
      if (root?.navigator && 'serviceWorker' in root.navigator) {
        const registration = await root.navigator.serviceWorker.ready;
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
          if (uid) {
            try {
              const [{ doc, deleteDoc }, { db }] = await Promise.all([
                import('firebase/firestore'),
                import('./firebase')
              ]);
              if (db) {
                const tokenId = await subscriptionEndpointToDocId(subscription.endpoint);
                await deleteDoc(doc(db, 'pushSubscriptions', uid, 'tokens', tokenId));
              }
            } catch (e) {
              console.warn('[NotificationService] Failed to remove server-side push subscription:', e);
            }
          }
          await subscription.unsubscribe();
        }
      }
    } catch (e) {
      console.warn('[NotificationService] Failed to unsubscribe from push:', e);
    }
    writeJSON(PUSH_SUBSCRIPTION_KEY, null);
  },

  /**
   * Sends a native Web Push/Browser Notification via Service Worker registration if available, fallback to Notification constructor
   * @param {string} title
   * @param {NotificationOptions} [options]
   * @returns {Promise<Notification|boolean|null>}
   */
  sendWebNotification: async (title, options = {}) => {
    if (notificationService.getNotificationPermission() !== 'granted') {
      return null;
    }
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      const defaultOptions = {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        ...options
      };

      // Try ServiceWorker showNotification first
      if (root.navigator && 'serviceWorker' in root.navigator) {
        try {
          const registration = await root.navigator.serviceWorker.ready;
          if (registration && typeof registration.showNotification === 'function') {
            await registration.showNotification(title, defaultOptions);
            return true;
          }
        } catch {
          // Fallback to Window Notification
        }
      }

      if (typeof root.Notification === 'function') {
        return new root.Notification(title, defaultOptions);
      }
      return true;
    } catch (e) {
      console.warn('[NotificationService] Failed to send web notification:', e);
      return null;
    }
  },

  /**
   * Triggers notifications across configured channels based on user preferences and status change
   * @param {import('../types/deliveree').Package} pkg
   * @param {string} previousStatus
   * @param {string} newStatus
   * @param {string} [language='he']
   * @returns {Promise<{ pushSent: boolean }>}
   */
  notifyStatusChange: async (pkg, previousStatus, newStatus, language = 'he') => {
    if (!pkg || !newStatus || previousStatus === newStatus) {
      return { pushSent: false };
    }

    const prefs = notificationService.getPreferences();

    // Check if notification is enabled for this type of event
    if (!prefs.notifyOnStatusChange) {
      return { pushSent: false };
    }

    if (newStatus === 'exception' && prefs.notifyOnException === false) {
      return { pushSent: false };
    }

    if (newStatus === 'delivered' && prefs.notifyOnDelivered === false) {
      return { pushSent: false };
    }

    if (newStatus === 'customs' && prefs.notifyOnCustoms === false) {
      return { pushSent: false };
    }

    const meta = STATUS_NOTIFICATION_INFO[newStatus] || {
      emoji: '📦',
      he: newStatus,
      en: newStatus
    };

    const pkgTitle = pkg.title || pkg.titleHe || (language === 'he' ? 'חבילה' : 'Package');
    
    // Construct bilingual notification content
    const title = language === 'he' 
      ? `${meta.emoji} עדכון סטטוס: ${pkgTitle}`
      : `${meta.emoji} Status Update: ${pkgTitle}`;
    
    const body = language === 'he'
      ? `החבילה שלך (${pkg.trackingNumber || ''}) עברה לסטטוס: ${meta.he}`
      : `Your package (${pkg.trackingNumber || ''}) is now: ${meta.en}`;

    let pushSent = false;

    // Send Browser Web Notification
    if (prefs.pushEnabled && notificationService.getNotificationPermission() === 'granted') {
      const notif = await notificationService.sendWebNotification(title, {
        body,
        tag: `pkg-${pkg.id || pkg.trackingNumber}`,
        data: { packageId: pkg.id, trackingNumber: pkg.trackingNumber }
      });
      pushSent = !!notif;
    }

    return { pushSent };
  },

  /**
   * Sets the PWA application icon badge count
   * @param {number} count
   * @returns {Promise<boolean>}
   */
  updateAppBadge: async (count) => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (root.navigator && typeof root.navigator.setAppBadge === 'function') {
      try {
        if (typeof count === 'number' && count > 0) {
          await root.navigator.setAppBadge(count);
        } else {
          await root.navigator.clearAppBadge();
        }
        return true;
      } catch (e) {
        console.warn('[NotificationService] Failed to update app badge:', e);
        return false;
      }
    }
    return false;
  },

  /**
   * Clears the PWA application icon badge
   * @returns {Promise<boolean>}
   */
  clearAppBadge: async () => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (root.navigator && typeof root.navigator.clearAppBadge === 'function') {
      try {
        await root.navigator.clearAppBadge();
        return true;
      } catch (e) {
        console.warn('[NotificationService] Failed to clear app badge:', e);
        return false;
      }
    }
    return false;
  },

  /**
   * Sends a test notification to verify push / notification capabilities
   * @param {string} [language='he']
   * @returns {Promise<Notification|boolean|null>}
   */
  sendTestNotification: async (language = 'he') => {
    const title = language === 'he'
      ? '📦 SpotLi | התראת בדיקה'
      : '📦 SpotLi | Test Notification';
    const body = language === 'he'
      ? 'התראות Web Push פועלות בהצלחה במכשיר שלך!'
      : 'Web Push Notifications are working successfully on your device!';

    return notificationService.sendWebNotification(title, {
      body,
      tag: 'spotli-test-notification',
      data: { url: '/', test: true }
    });
  }
};

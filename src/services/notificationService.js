import { readJSON, writeJSON } from '../utils/storage';

export const NOTIFICATION_PREFS_KEY = 'deliveree_notification_prefs';
export const PUSH_SUBSCRIPTION_KEY = 'deliveree_push_subscription';

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
 * Utility: Format push payload for service worker / FCM
 */
export function formatPushPayload({ title, body, packageId, trackingNumber, actions }) {
  return {
    title: title || 'Deliveree Update | עדכון משלוח',
    body: body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: packageId ? `pkg-${packageId}` : (trackingNumber ? `pkg-${trackingNumber}` : 'deliveree-update'),
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
   * @returns {Promise<'default' | 'granted' | 'denied' | 'unsupported'>}
   */
  requestNotificationPermission: async () => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root || !('Notification' in root) || typeof root.Notification === 'undefined') {
      return 'unsupported';
    }
    try {
      const permission = await root.Notification.requestPermission();
      if (permission === 'granted') {
        notificationService.savePreferences({ pushEnabled: true });
        // Attempt to subscribe to push manager if service worker is active
        await notificationService.subscribeToPush();
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
   * Subscribes the client to Web Push via Service Worker PushManager
   * @param {string} [vapidPublicKey]
   * @returns {Promise<PushSubscription|null>}
   */
  subscribeToPush: async (vapidPublicKey) => {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root || !('serviceWorker' in root.navigator)) {
      return null;
    }

    try {
      const registration = await root.navigator.serviceWorker.ready;
      if (!registration || !registration.pushManager) {
        return null;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription && vapidPublicKey) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (subscription) {
        writeJSON(PUSH_SUBSCRIPTION_KEY, subscription);
      }
      return subscription;
    } catch (e) {
      console.warn('[NotificationService] Push subscription failed or not supported:', e);
      return null;
    }
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
  }
};

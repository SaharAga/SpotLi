import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import {
  notificationService,
  NOTIFICATION_PREFS_KEY,
  PUSH_SUBSCRIPTION_KEY,
  DEFAULT_NOTIFICATION_PREFS,
  urlBase64ToUint8Array,
  formatPushPayload
} from './notificationService';

describe('notificationService', () => {
  let mockStore = {};

  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (key) => mockStore[key] || null,
      setItem: (key, value) => { mockStore[key] = String(value); },
      removeItem: (key) => { delete mockStore[key]; },
      clear: () => { mockStore = {}; }
    };
  });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Preferences Management', () => {
    it('returns default preferences when nothing stored', () => {
      const prefs = notificationService.getPreferences();
      expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
    });

    it('saves and retrieves updated preferences', () => {
      const updated = notificationService.savePreferences({
        pushEnabled: true
      });

      expect(updated.pushEnabled).toBe(true);

      const retrieved = notificationService.getPreferences();
      expect(retrieved.pushEnabled).toBe(true);
      expect(retrieved.notifyOnStatusChange).toBe(true);
    });

    it('handles malformed localStorage JSON gracefully', () => {
      localStorage.setItem(NOTIFICATION_PREFS_KEY, 'invalid-json{');
      const prefs = notificationService.getPreferences();
      expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
    });
  });

  describe('Web Notification & Push Helpers', () => {
    it('converts url safe base64 to Uint8Array', () => {
      const dummyBase64 = 'BMx_abcdef1234567890';
      const arr = urlBase64ToUint8Array(dummyBase64);
      expect(arr).toBeInstanceOf(Uint8Array);
      expect(arr.length).toBeGreaterThan(0);
    });

    it('returns empty array when base64 string is empty', () => {
      const arr = urlBase64ToUint8Array('');
      expect(arr).toEqual(new Uint8Array(0));
    });

    it('formats push notification payload properly with actions and tag', () => {
      const payload = formatPushPayload({
        title: 'Delivered',
        body: 'Package arrived in Tel Aviv',
        packageId: 'pkg-999',
        trackingNumber: 'IL123456'
      });

      expect(payload.title).toBe('Delivered');
      expect(payload.body).toBe('Package arrived in Tel Aviv');
      expect(payload.tag).toBe('pkg-pkg-999');
      expect(payload.url).toBe('/?packageId=pkg-999');
      expect(payload.actions).toHaveLength(2);
      expect(payload.actions[0].action).toBe('view');
      expect(payload.actions[1].action).toBe('dismiss');
    });

    it('returns unsupported when Notification API is missing', () => {
      const originalNotification = globalThis.Notification;
      // @ts-expect-error test cleanup
      delete globalThis.Notification;

      expect(notificationService.getNotificationPermission()).toBe('unsupported');

      globalThis.Notification = originalNotification;
    });

    it('returns current permission state if Notification exists', () => {
      globalThis.Notification = {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted')
      };

      expect(notificationService.getNotificationPermission()).toBe('granted');
    });

    it('requests permission and saves preference if granted', async () => {
      const requestMock = vi.fn().mockResolvedValue('granted');
      globalThis.Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      const result = await notificationService.requestNotificationPermission();
      expect(result).toBe('granted');
      expect(requestMock).toHaveBeenCalled();
      expect(notificationService.getPreferences().pushEnabled).toBe(true);
    });

    it('requests permission and disables push if denied', async () => {
      const requestMock = vi.fn().mockResolvedValue('denied');
      globalThis.Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      const result = await notificationService.requestNotificationPermission();
      expect(result).toBe('denied');
      expect(notificationService.getPreferences().pushEnabled).toBe(false);
    });

    it('subscribes to push manager when available and stores subscription', async () => {
      const mockPushSubscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/123' };
      const getSubscriptionMock = vi.fn().mockResolvedValue(null);
      const subscribeMock = vi.fn().mockResolvedValue(mockPushSubscription);

      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: getSubscriptionMock,
              subscribe: subscribeMock
            }
          })
        }
      });

      const sub = await notificationService.subscribeToPush('BMx_mock_vapid_key');
      expect(sub).toEqual(mockPushSubscription);
      expect(subscribeMock).toHaveBeenCalled();
      expect(localStorage.getItem(PUSH_SUBSCRIPTION_KEY)).toContain('fcm.googleapis.com');
    });

    it('sends notification via ServiceWorker registration if present', async () => {
      const showNotificationMock = vi.fn().mockResolvedValue(undefined);
      globalThis.Notification = {
        permission: 'granted'
      };
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            showNotification: showNotificationMock
          })
        }
      });

      const res = await notificationService.sendWebNotification('Package Arrived', { body: 'In Modiin' });
      expect(res).toBe(true);
      expect(showNotificationMock).toHaveBeenCalledWith(
        'Package Arrived',
        expect.objectContaining({ body: 'In Modiin' })
      );
    });

    it('falls back to Window Notification constructor if SW showNotification fails', async () => {
      const notificationConstructor = vi.fn();
      globalThis.Notification = Object.assign(notificationConstructor, {
        permission: 'granted'
      });
      vi.stubGlobal('navigator', {});

      await notificationService.sendWebNotification('Package Arrived', { body: 'In Modiin' });
      expect(notificationConstructor).toHaveBeenCalledWith(
        'Package Arrived',
        expect.objectContaining({ body: 'In Modiin' })
      );
    });

    it('does not send notification if permission is not granted', async () => {
      const notificationConstructor = vi.fn();
      globalThis.Notification = Object.assign(notificationConstructor, {
        permission: 'denied'
      });

      const res = await notificationService.sendWebNotification('Package Arrived');
      expect(res).toBeNull();
      expect(notificationConstructor).not.toHaveBeenCalled();
    });
  });

  describe('notifyStatusChange Orchestrator', () => {
    it('skips dispatch if previous and new status are the same', async () => {
      const result = await notificationService.notifyStatusChange(
        { id: '1', status: 'in_transit' },
        'in_transit',
        'in_transit'
      );
      expect(result).toEqual({ pushSent: false });
    });

    it('dispatches to enabled channels when status changes', async () => {
      notificationService.savePreferences({
        pushEnabled: true,
        notifyOnStatusChange: true
      });

      const notificationConstructor = vi.fn();
      globalThis.Notification = Object.assign(notificationConstructor, {
        permission: 'granted'
      });

      const mockPkg = {
        id: 'pkg-1',
        title: 'Sony Headphones',
        trackingNumber: 'RS999IL',
        carrier: 'israel_post'
      };

      const res = await notificationService.notifyStatusChange(mockPkg, 'in_transit', 'delivered', 'he');
      expect(res.pushSent).toBe(true);
      expect(notificationConstructor).toHaveBeenCalled();
    });

    it('respects notifyOnException preference toggle', async () => {
      notificationService.savePreferences({
        pushEnabled: true,
        notifyOnStatusChange: true,
        notifyOnException: false
      });

      const notificationConstructor = vi.fn();
      globalThis.Notification = Object.assign(notificationConstructor, {
        permission: 'granted'
      });

      const mockPkg = { id: '1', title: 'Delayed item' };
      const res = await notificationService.notifyStatusChange(mockPkg, 'in_transit', 'exception');
      expect(res.pushSent).toBe(false);
      expect(notificationConstructor).not.toHaveBeenCalled();
    });
  });
});

describe('savePreferences — failed writes are reported', () => {
  it('returns ok:false and an error when the storage write is rejected', () => {
    const originalSetItem = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => {
      throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = notificationService.savePreferencesWithStatus({ pushEnabled: true });

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    // The merged preferences still come back so the caller can keep the
    // in-memory value while telling the user it was not persisted.
    expect(result.preferences.pushEnabled).toBe(true);
    expect(errorSpy).toHaveBeenCalled();

    globalThis.localStorage.setItem = originalSetItem;
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('returns ok:true and no error on a successful write', () => {
    const result = notificationService.savePreferencesWithStatus({ pushEnabled: true });
    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(notificationService.getPreferences().pushEnabled).toBe(true);
  });

  it('savePreferences keeps returning just the merged preferences object', () => {
    const prefs = notificationService.savePreferences({ notifyOnException: false });
    expect(prefs.notifyOnException).toBe(false);
    expect(prefs.ok).toBeUndefined();
  });
});

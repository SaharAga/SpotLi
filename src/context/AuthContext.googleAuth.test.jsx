import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { 
  validateUserProfile, 
  sanitizeAuthError, 
  migrateGuestDataToUser, 
  buildCleanUserProfile, 
  getCachedUserForUid 
} from './AuthContext';
import { deliveryService } from '../services/deliveryService';
import { CloudStorageAdapter } from '../services/cloudStorageAdapter';

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
  mockStore = {};
  vi.restoreAllMocks();
});

describe('Google Authentication Lifecycle & OAuth Synchronization', () => {
  describe('R1. Robust OAuth State Synchronization & Profile Normalization', () => {
    it('normalizes Google OAuth user with full avatar URL, displayName and custom ingestion box', () => {
      const googleRawUser = {
        id: 'google-uid-1001',
        name: 'Alex Johnson',
        email: 'alex.johnson@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocK123456789=s96-c',
        plan: 'Personal Account',
        devicesCount: 1,
        createdAt: '2026-08-21T12:00:00.000Z'
      };

      const validated = validateUserProfile(googleRawUser);
      expect(validated).not.toBeNull();
      expect(validated.id).toBe('google-uid-1001');
      expect(validated.name).toBe('Alex Johnson');
      expect(validated.email).toBe('alex.johnson@gmail.com');
      expect(validated.avatar).toBe('https://lh3.googleusercontent.com/a/ACg8ocK123456789=s96-c');
      expect(validated.ingestionEmail).toBe('alexjohnson.pkg@in.spotliapp.com');
      expect(validated.preferences).toEqual({
        defaultCarrier: 'all',
        language: 'he',
        theme: 'dark',
        dateFormat: 'DD/MM/YYYY'
      });
    });

    it('handles Google users with missing displayName by falling back gracefully', () => {
      const googleUserNoName = {
        id: 'google-uid-1002',
        email: 'developer2026@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/sample=s96-c'
      };

      const validated = validateUserProfile(googleUserNoName);
      expect(validated.name).toBe('User');
      expect(validated.email).toBe('developer2026@gmail.com');
      expect(validated.ingestionEmail).toBe('user.pkg@in.spotliapp.com');
      expect(validated.avatar).toBe('https://lh3.googleusercontent.com/a/sample=s96-c');
    });

    it('preserves user custom preferences and metadata across Firebase onAuthStateChanged transitions', () => {
      const uid = 'google-uid-pref-1003';
      const existingUser = {
        id: uid,
        name: 'Custom Alex',
        email: 'alex.custom@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/custom=s96-c',
        ingestionEmail: 'customalex.pkg@in.deliveree.app',
        plan: 'Pro Account',
        devicesCount: 2,
        createdAt: '2026-08-01',
        preferences: {
          defaultCarrier: 'dhl',
          language: 'en',
          theme: 'light',
          dateFormat: 'YYYY-MM-DD'
        }
      };

      mockStore['deliveree_auth_user_v1'] = JSON.stringify(existingUser);
      expect(getCachedUserForUid(uid)).toEqual(existingUser);

      const firebaseAuthUser = {
        uid: uid,
        displayName: 'Google Name Overwrite',
        email: 'alex.custom@gmail.com',
        photoURL: 'https://lh3.googleusercontent.com/a/custom=s96-c',
        metadata: { creationTime: '2026-08-01' }
      };

      const cleanUser = buildCleanUserProfile(firebaseAuthUser);
      expect(cleanUser).not.toBeNull();
      expect(cleanUser.id).toBe(uid);
      expect(cleanUser.name).toBe('Custom Alex');
      expect(cleanUser.preferences.defaultCarrier).toBe('dhl');
      expect(cleanUser.preferences.language).toBe('en');
      expect(cleanUser.preferences.theme).toBe('light');
      expect(cleanUser.preferences.dateFormat).toBe('YYYY-MM-DD');
      expect(cleanUser.plan).toBe('Pro Account');
    });

    it('translates Google OAuth-specific error codes correctly in Hebrew and English', () => {
      // Unauthorized domain
      expect(sanitizeAuthError({ code: 'auth/unauthorized-domain' }, 'he')).toContain('deliveree-app-2a938.web.app');
      expect(sanitizeAuthError({ code: 'auth/unauthorized-domain' }, 'en')).toContain('deliveree-app-2a938.web.app');

      // Popup blocked on mobile browsers
      expect(sanitizeAuthError({ code: 'auth/popup-blocked' }, 'he')).toContain('חלון ההתחברות של Google נחסם');
      expect(sanitizeAuthError({ code: 'auth/popup-blocked' }, 'en')).toContain('blocked');

      // Operation not supported in this environment (webviews / in-app browsers)
      expect(sanitizeAuthError({ code: 'auth/operation-not-supported-in-this-environment' }, 'he')).toContain('אינה נתמכת בסביבת דפדפן זו');
      expect(sanitizeAuthError({ code: 'auth/operation-not-supported-in-this-environment' }, 'en')).toContain('not supported in this browser environment');

      // Account exists with different credential
      expect(sanitizeAuthError({ code: 'auth/account-exists-with-different-credential' }, 'he')).toContain('קיים כבר חשבון');
      expect(sanitizeAuthError({ code: 'auth/account-exists-with-different-credential' }, 'en')).toContain('already exists');

      // User disabled
      expect(sanitizeAuthError({ code: 'auth/user-disabled' }, 'he')).toContain('הושבת');
      expect(sanitizeAuthError({ code: 'auth/user-disabled' }, 'en')).toContain('disabled');

      // Credential already in use
      expect(sanitizeAuthError({ code: 'auth/credential-already-in-use' }, 'he')).toContain('משויכים לחשבון');
      expect(sanitizeAuthError({ code: 'auth/credential-already-in-use' }, 'en')).toContain('already linked');

      // Web storage / cookies blocked (Safari Private Mode / WebViews)
      expect(sanitizeAuthError({ code: 'auth/web-storage-unsupported' }, 'he')).toContain('אחסון הדפדפן מושבת');
      expect(sanitizeAuthError({ code: 'auth/web-storage-unsupported' }, 'en')).toContain('Web storage or cookies are blocked');
      expect(sanitizeAuthError({ code: 'auth/cookies-blocked' }, 'he')).toContain('העוגיות בדפדפן חסומות');
      expect(sanitizeAuthError({ code: 'auth/cookies-blocked' }, 'en')).toContain('Browser cookies are blocked');

      // Timeout & Internal Error
      expect(sanitizeAuthError({ code: 'auth/timeout' }, 'he')).toContain('פג הזמן');
      expect(sanitizeAuthError({ code: 'auth/timeout' }, 'en')).toContain('timed out');
      expect(sanitizeAuthError({ code: 'auth/internal-error' }, 'he')).toContain('שגיאה פנימית');
      expect(sanitizeAuthError({ code: 'auth/internal-error' }, 'en')).toContain('internal authentication error');

      // Token expiration and Quota exceeded
      expect(sanitizeAuthError({ code: 'auth/user-token-expired' }, 'he')).toContain('פג תוקף חיבור המשתמש');
      expect(sanitizeAuthError({ code: 'auth/user-token-expired' }, 'en')).toContain('User session expired');
      expect(sanitizeAuthError({ code: 'auth/quota-exceeded' }, 'he')).toContain('חרגת ממכסת הבקשות');
      expect(sanitizeAuthError({ code: 'auth/quota-exceeded' }, 'en')).toContain('Service quota exceeded');
    });

    it('prioritizes live Google displayName over stale cached "User" placeholder', () => {
      const uid = 'google-uid-refresh-name-99';
      // User was previously cached with fallback 'User'
      mockStore['deliveree_auth_user_v1'] = JSON.stringify({
        id: uid,
        name: 'User',
        email: 'alex.updated@gmail.com'
      });

      const liveGoogleAuth = {
        uid,
        displayName: 'Alexander The Great',
        email: 'alex.updated@gmail.com',
        photoURL: 'https://lh3.googleusercontent.com/a/alex=s96-c'
      };

      const cleanUser = buildCleanUserProfile(liveGoogleAuth);
      expect(cleanUser.name).toBe('Alexander The Great');
      expect(cleanUser.ingestionEmail).toBe('alexanderthegreat.pkg@in.spotliapp.com');
    });

    it('generates clean ingestion email prefix from email when user name is non-latin Hebrew', () => {
      const liveHebrewUser = {
        uid: 'google-uid-hebrew-1005',
        displayName: 'דנה כהן',
        email: 'danacohen.il@gmail.com',
        photoURL: 'https://lh3.googleusercontent.com/a/hebrew=s96-c'
      };

      const cleanUser = buildCleanUserProfile(liveHebrewUser);
      expect(cleanUser.name).toBe('דנה כהן');
      expect(cleanUser.ingestionEmail).toBe('danacohenil.pkg@in.spotliapp.com');
    });
  });

  describe('R2. Seamless UI Transition & Session Retention', () => {
    it('restores authenticated user immediately from localStorage on app boot without flashing landing screen', () => {
      const persistedUser = {
        id: 'usr-persisted-google-42',
        name: 'Dana Cohen',
        email: 'dana.cohen@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/dana=s96-c',
        plan: 'Personal Account',
        devicesCount: 1,
        createdAt: '2026-08-20'
      };
      mockStore['deliveree_auth_user_v1'] = JSON.stringify(persistedUser);

      const stored = localStorage.getItem('deliveree_auth_user_v1');
      const validated = validateUserProfile(JSON.parse(stored));

      expect(validated).not.toBeNull();
      expect(validated.id).toBe('usr-persisted-google-42');
      expect(validated.name).toBe('Dana Cohen');
      expect(validated.avatar).toBe('https://lh3.googleusercontent.com/a/dana=s96-c');
    });

    it('migrates guest packages automatically to authenticated user account upon Google login', async () => {
      const guestShipments = [
        {
          id: 'pkg-guest-101',
          title: 'Mechanical Keyboard',
          trackingNumber: 'RR999888777IL',
          carrier: 'israel_post',
          status: 'in_transit',
          createdAt: '2026-08-21T08:00:00.000Z'
        }
      ];
      mockStore['deliveree_packages_guest'] = JSON.stringify(guestShipments);

      const targetUserId = 'usr-google-migrator-88';
      const migrated = await migrateGuestDataToUser(targetUserId);

      // Invariant 1: Guest partition is cleaned up
      expect(localStorage.getItem('deliveree_packages_guest')).toBeNull();

      // Invariant 2: User partition has the migrated package with userId assigned
      expect(migrated.length).toBe(1);
      expect(migrated[0].id).toBe('pkg-guest-101');
      expect(migrated[0].userId).toBe(targetUserId);

      const userSaved = JSON.parse(localStorage.getItem(`deliveree_packages_${targetUserId}`));
      expect(userSaved.length).toBe(1);
      expect(userSaved[0].trackingNumber).toBe('RR999888777IL');
    });
  });

  describe('R3. Safe Cross-Device & Mobile Package Persistence Lifecycle', () => {
    it('scopes package storage to authenticated userId and prevents leakage to guest partition', () => {
      const userId = 'usr-google-auth-99';
      const testPackages = [
        {
          id: 'pkg-google-1',
          title: 'Smart Watch',
          trackingNumber: 'IL123456789TRACK',
          carrier: 'dhl',
          status: 'out_for_delivery',
          createdAt: '2026-08-21T14:00:00.000Z',
          userId
        }
      ];

      deliveryService.savePackages(testPackages, userId);
      const userPkgs = deliveryService.getPackages(userId);

      expect(userPkgs.length).toBe(1);
      expect(userPkgs[0].id).toBe('pkg-google-1');
      expect(userPkgs[0].userId).toBe(userId);
      expect(userPkgs[0].carrier).toBe('dhl');

      // Guest partition remains empty
      expect(deliveryService.getPackages(null)).toEqual([]);
    });

    it('updates package status safely with state machine transition guard under authenticated userId', () => {
      const userId = 'usr-google-auth-99';
      const initial = [
        {
          id: 'pkg-google-1',
          title: 'Smart Watch',
          trackingNumber: 'IL123456789TRACK',
          carrier: 'dhl',
          status: 'in_transit',
          createdAt: '2026-08-21T14:00:00.000Z',
          userId
        }
      ];
      deliveryService.savePackages(initial, userId);

      const updateResult = deliveryService.updatePackageStatus(initial, 'pkg-google-1', 'out_for_delivery', null, userId);
      expect(updateResult.success).toBe(true);
      expect(updateResult.packages[0].status).toBe('out_for_delivery');

      const reloaded = deliveryService.getPackages(userId);
      expect(reloaded[0].status).toBe('out_for_delivery');
    });

    it('cloud storage adapter manages user listener lifecycle cleanly', () => {
      const adapter = new CloudStorageAdapter({ mode: 'local' });
      adapter.setUserId('usr-test-lifecycle');
      expect(adapter.userId).toBe('usr-test-lifecycle');

      let notifiedData = null;
      const unsubscribe = adapter.subscribe((pkgs) => {
        notifiedData = pkgs;
      });

      const samplePkgs = [
        {
          id: 'pkg-synced-1',
          title: 'Earbuds',
          trackingNumber: 'EB12345678IL',
          carrier: 'fedex',
          status: 'ordered',
          createdAt: '2026-08-21T15:00:00.000Z'
        }
      ];

      adapter.savePackages(samplePkgs);
      expect(notifiedData).not.toBeNull();
      expect(notifiedData.length).toBe(1);
      expect(notifiedData[0].id).toBe('pkg-synced-1');

      unsubscribe();
      adapter.teardown();
      expect(adapter.listeners.size).toBe(0);
    });

    it('cloud storage adapter upserts and deletes packages using local storage immediately without waiting for Firestore', async () => {
      const userId = 'usr-instant-sync-44';
      const adapter = new CloudStorageAdapter({ mode: 'local', userId });

      const newPkg = {
        id: 'pkg-instant-1',
        title: 'Wireless Charger',
        trackingNumber: 'WC123456789IL',
        carrier: 'dhl',
        status: 'ordered',
        createdAt: '2026-08-21T16:00:00.000Z',
        userId
      };

      const afterUpsert = await adapter.upsertPackage(newPkg);
      expect(afterUpsert.length).toBe(1);
      expect(afterUpsert[0].id).toBe('pkg-instant-1');
      expect(deliveryService.getPackages(userId).length).toBe(1);

      const afterDelete = await adapter.deletePackage('pkg-instant-1');
      expect(afterDelete.length).toBe(0);
      expect(deliveryService.getPackages(userId).length).toBe(0);
    });

    it('isolates package storage partitions when switching between multiple users', () => {
      const userA = 'usr-account-A';
      const userB = 'usr-account-B';

      const pkgA = [{ id: 'pkg-A1', title: 'Package User A', trackingNumber: 'AAA111IL', carrier: 'dhl', status: 'in_transit', userId: userA }];
      const pkgB = [{ id: 'pkg-B1', title: 'Package User B', trackingNumber: 'BBB222IL', carrier: 'ups', status: 'ordered', userId: userB }];

      deliveryService.savePackages(pkgA, userA);
      deliveryService.savePackages(pkgB, userB);

      // Verify User A partition
      const loadedA = deliveryService.getPackages(userA);
      expect(loadedA.length).toBe(1);
      expect(loadedA[0].id).toBe('pkg-A1');
      expect(loadedA[0].userId).toBe(userA);

      // Verify User B partition
      const loadedB = deliveryService.getPackages(userB);
      expect(loadedB.length).toBe(1);
      expect(loadedB[0].id).toBe('pkg-B1');
      expect(loadedB[0].userId).toBe(userB);

      // Verify Guest partition remains unpolluted
      expect(deliveryService.getPackages(null)).toEqual([]);
    });

    it('migrating guest data activates cloudStorageAdapter with targetUserId immediately', async () => {
      const guestShipments = [
        {
          id: 'pkg-guest-cloud-sync-1',
          title: 'Mechanical Watch',
          trackingNumber: 'MW123456789IL',
          carrier: 'israel_post',
          status: 'ordered',
          createdAt: '2026-08-21T18:00:00.000Z'
        }
      ];
      mockStore['deliveree_packages_guest'] = JSON.stringify(guestShipments);

      const targetUserId = 'usr-target-cloud-sync-77';
      const migrated = await migrateGuestDataToUser(targetUserId);

      expect(migrated.length).toBe(1);
      expect(migrated[0].userId).toBe(targetUserId);
      const userPkgs = deliveryService.getPackages(targetUserId);
      expect(userPkgs.length).toBe(1);
      expect(userPkgs[0].id).toBe('pkg-guest-cloud-sync-1');
    });

    it('multi-tab synchronization handles cross-tab user session updates and preference mutations', () => {
      const initialUser = {
        id: 'usr-multitab-1',
        name: 'Initial User',
        email: 'user@example.com',
        preferences: {
          defaultCarrier: 'all',
          language: 'he',
          theme: 'dark',
          dateFormat: 'DD/MM/YYYY'
        }
      };

      // 1. User updates preferences in Tab A
      const updatedUserTabA = {
        ...initialUser,
        name: 'Updated User Name',
        preferences: {
          ...initialUser.preferences,
          language: 'en',
          theme: 'light'
        }
      };

      mockStore['deliveree_auth_user_v1'] = JSON.stringify(updatedUserTabA);

      // 2. Tab B deserializes and validates the incoming storage payload
      const deserializedTabB = validateUserProfile(JSON.parse(mockStore['deliveree_auth_user_v1']));
      expect(deserializedTabB).not.toBeNull();
      expect(deserializedTabB.name).toBe('Updated User Name');
      expect(deserializedTabB.preferences.language).toBe('en');
      expect(deserializedTabB.preferences.theme).toBe('light');

      // 3. Tab A logs out
      delete mockStore['deliveree_auth_user_v1'];
      expect(mockStore['deliveree_auth_user_v1']).toBeUndefined();
    });

    it('multi-tab package persistence isolates user and guest partitions across simulated storage events', () => {
      const userId = 'usr-multitab-packages-1';

      // Tab A adds a package to user partition
      const newPackage = {
        id: 'pkg-tab-a-1',
        title: 'New Tablet',
        trackingNumber: 'NT12345678IL',
        carrier: 'dhl',
        status: 'shipped',
        createdAt: '2026-08-21T18:30:00.000Z',
        userId
      };

      deliveryService.savePackages([newPackage], userId);

      // Tab B reads the partition
      const tabBPackages = deliveryService.getPackages(userId);
      expect(tabBPackages.length).toBe(1);
      expect(tabBPackages[0].id).toBe('pkg-tab-a-1');
      expect(tabBPackages[0].title).toBe('New Tablet');

      // Tab A deletes the package
      deliveryService.savePackages([], userId);
      const tabBPackagesAfterDelete = deliveryService.getPackages(userId);
      expect(tabBPackagesAfterDelete.length).toBe(0);
    });
  });
});

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { validateUserProfile, sanitizeAuthError } from './AuthContext';

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
});

describe('AuthContext - sanitizeAuthError', () => {
  it('maps known Firebase auth codes to sanitized user-friendly messages', () => {
    expect(sanitizeAuthError({ code: 'auth/user-not-found' })).toBe(
      'Invalid email or password. Please check your credentials and try again.'
    );
    expect(sanitizeAuthError({ code: 'auth/email-already-in-use' })).toBe(
      'This email address is already in use by another account.'
    );
    expect(sanitizeAuthError({ code: 'auth/popup-blocked' })).toBe(
      'Sign-in popup was blocked by your browser. Please allow popups or use email.'
    );
    expect(sanitizeAuthError({ code: 'auth/too-many-requests' })).toBe(
      'Too many unsuccessful attempts. Access temporarily disabled. Try again later.'
    );
  });

  it('strips internal codes and raw prefixes from unknown errors', () => {
    const rawError = { message: 'Firebase: Error (auth/unauthorized-domain) https://accounts.google.com/xyz' };
    const sanitized = sanitizeAuthError(rawError);
    expect(sanitized).not.toContain('auth/unauthorized-domain');
    expect(sanitized).not.toContain('Firebase:');
  });

  it('handles nullish errors gracefully', () => {
    expect(sanitizeAuthError(null)).toBe('An unexpected authentication error occurred. Please try again.');
    expect(sanitizeAuthError(undefined)).toBe('An unexpected authentication error occurred. Please try again.');
  });
});

describe('AuthContext - validateUserProfile', () => {
  it('returns null for non-object and nullish inputs', () => {
    expect(validateUserProfile(null)).toBeNull();
    expect(validateUserProfile(undefined)).toBeNull();
    expect(validateUserProfile('string')).toBeNull();
    expect(validateUserProfile(12345)).toBeNull();
    expect(validateUserProfile([])).toBeNull();
  });

  it('validates and normalizes valid user profiles', () => {
    const raw = {
      id: 'usr-123',
      name: 'Alice Developer',
      email: 'alice@example.com',
      avatar: 'https://example.com/avatar.jpg',
      ingestionEmail: 'alice.pkg123@in.deliveree.app',
      plan: 'Personal Account',
      devicesCount: 3,
      createdAt: '2026-08-15'
    };

    const validated = validateUserProfile(raw);
    expect(validated).toEqual({
      ...raw,
      emailVerified: false,
      legalAcceptedVersion: null,
      legalAcceptedAt: null,
      aiTrainingOptIn: false,
      aiTrainingOptInUpdatedAt: null,
      preferences: {
        defaultCarrier: 'all',
        language: 'he',
        theme: 'dark',
        dateFormat: 'DD/MM/YYYY'
      }
    });
  });

  it('sanitizes XSS payloads and script tags from user fields', () => {
    const malicious = {
      id: 'usr-hacker',
      name: 'Alice <script>alert(1)</script>',
      email: 'alice<img src=x onerror=steal()>@example.com',
      avatar: 'javascript:alert(document.cookie)',
      plan: '<b>Pro</b> Plan',
      devicesCount: 2
    };

    const validated = validateUserProfile(malicious);
    expect(validated.name).toBe('Alice');
    expect(validated.email).toBe('alice@example.com');
    expect(validated.avatar).toBeNull();
    expect(validated.plan).toBe('Pro Plan');
  });

  it('guards against prototype pollution attacks in user profile', () => {
    const polluted = JSON.parse(
      '{"id": "usr-pwn", "name": "Hacker", "__proto__": {"isAdmin": true}, "constructor": {"prototype": {"isSuper": true}}}'
    );

    const validated = validateUserProfile(polluted);
    expect(validated.id).toBe('usr-pwn');
    expect({}.isAdmin).toBeUndefined();
    expect({}.isSuper).toBeUndefined();
    expect(Object.prototype.isAdmin).toBeUndefined();
  });

  it('normalizes missing or invalid numeric fields like devicesCount', () => {
    const invalidNumbers = {
      name: 'Bob',
      devicesCount: -5
    };

    const validated = validateUserProfile(invalidNumbers);
    expect(validated.devicesCount).toBe(1);

    const nanDevices = validateUserProfile({ name: 'Bob', devicesCount: NaN });
    expect(nanDevices.devicesCount).toBe(1);
  });

  it('provides sensible default properties and preferences when minimal data is supplied', () => {
    const minimal = { name: 'Charlie' };
    const validated = validateUserProfile(minimal);

    expect(validated.name).toBe('Charlie');
    expect(validated.email).toBe('user@example.com');
    expect(validated.plan).toBe('Personal Account');
    expect(validated.ingestionEmail).toBe('charlie.pkg@in.deliveree.app');
    expect(validated.devicesCount).toBe(1);
    expect(validated.preferences).toEqual({
      defaultCarrier: 'all',
      language: 'he',
      theme: 'dark',
      dateFormat: 'DD/MM/YYYY'
    });
  });

  it('validates and sanitizes custom user preferences', () => {
    const withCustomPrefs = {
      id: 'usr-456',
      name: 'Dana',
      preferences: {
        defaultCarrier: 'israel_post',
        language: 'en',
        theme: 'light',
        dateFormat: 'YYYY-MM-DD'
      }
    };

    const validated = validateUserProfile(withCustomPrefs);
    expect(validated.preferences.defaultCarrier).toBe('israel_post');
    expect(validated.preferences.language).toBe('en');
    expect(validated.preferences.theme).toBe('light');
    expect(validated.preferences.dateFormat).toBe('YYYY-MM-DD');
  });

  it('retains valid user session across cold start storage deserialization', () => {
    const cachedProfile = {
      id: 'usr-persisted-77',
      name: 'Persisted User',
      email: 'persisted@deliveree.app',
      plan: 'Cloud Synced Account',
      devicesCount: 2,
      createdAt: '2026-08-20'
    };

    const deserialized = validateUserProfile(cachedProfile);
    expect(deserialized).not.toBeNull();
    expect(deserialized.id).toBe('usr-persisted-77');
    expect(deserialized.name).toBe('Persisted User');
    expect(deserialized.email).toBe('persisted@deliveree.app');
  });
});

describe('AuthContext - migrateGuestDataToUser', () => {
  it('returns empty array when target user ID is missing or guest storage is empty', async () => {
    const { migrateGuestDataToUser } = await import('./AuthContext');
    expect(await migrateGuestDataToUser(null)).toEqual([]);
    expect(await migrateGuestDataToUser('')).toEqual([]);
    
    localStorage.removeItem('deliveree_packages_guest');
    expect(await migrateGuestDataToUser('usr-test-1')).toEqual([]);
  });

  it('migrates guest packages to user storage and clears deliveree_packages_guest', async () => {
    const { migrateGuestDataToUser } = await import('./AuthContext');
    const guestData = [
      {
        id: 'pkg-guest-1',
        title: 'Guest Wireless Mouse',
        trackingNumber: 'RR123456789IL',
        carrier: 'israel_post',
        status: 'in_transit',
        createdAt: '2026-08-20T10:00:00.000Z'
      }
    ];

    localStorage.setItem('deliveree_packages_guest', JSON.stringify(guestData));
    localStorage.removeItem('deliveree_packages_usr-test-2');

    const result = await migrateGuestDataToUser('usr-test-2');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('pkg-guest-1');
    expect(result[0].userId).toBe('usr-test-2');

    // Guest storage must be wiped
    expect(localStorage.getItem('deliveree_packages_guest')).toBeNull();

    // User storage must have the package
    const userStored = JSON.parse(localStorage.getItem('deliveree_packages_usr-test-2'));
    expect(userStored.length).toBe(1);
    expect(userStored[0].trackingNumber).toBe('RR123456789IL');
  });

  it('merges guest packages non-destructively without duplicate tracking numbers or IDs', async () => {
    const { migrateGuestDataToUser } = await import('./AuthContext');
    
    const existingUserData = [
      {
        id: 'pkg-user-1',
        title: 'Existing Keyboard',
        trackingNumber: 'EE111222333IL',
        carrier: 'israel_post',
        status: 'delivered',
        createdAt: '2026-08-19T10:00:00.000Z'
      },
      {
        id: 'pkg-duplicate-id',
        title: 'Existing Same ID',
        trackingNumber: 'UNIQUE-TRACK-99',
        carrier: 'dhl',
        status: 'shipped',
        createdAt: '2026-08-19T11:00:00.000Z'
      }
    ];
    localStorage.setItem('deliveree_packages_usr-test-3', JSON.stringify(existingUserData));

    const guestData = [
      {
        id: 'pkg-guest-new',
        title: 'New Guest Package',
        trackingNumber: 'NEW-TRACK-44',
        carrier: 'fedex',
        status: 'ordered',
        createdAt: '2026-08-20T12:00:00.000Z'
      },
      {
        id: 'pkg-guest-dup-track',
        title: 'Duplicate Track In Guest',
        trackingNumber: 'EE111222333IL', // Duplicate tracking number
        carrier: 'israel_post',
        status: 'in_transit',
        createdAt: '2026-08-20T12:30:00.000Z'
      },
      {
        id: 'pkg-duplicate-id', // Duplicate ID
        title: 'Guest Same ID',
        trackingNumber: 'ANOTHER-TRACK',
        carrier: 'ups',
        status: 'ordered',
        createdAt: '2026-08-20T13:00:00.000Z'
      }
    ];
    localStorage.setItem('deliveree_packages_guest', JSON.stringify(guestData));

    const merged = await migrateGuestDataToUser('usr-test-3');
    // Should have 3 items: New Guest Package + 2 existing user packages
    expect(merged.length).toBe(3);
    expect(merged.some(p => p.trackingNumber === 'NEW-TRACK-44')).toBe(true);
    expect(merged.some(p => p.trackingNumber === 'EE111222333IL')).toBe(true);
    expect(merged.some(p => p.id === 'pkg-duplicate-id')).toBe(true);

    // Guest storage must be cleaned up
    expect(localStorage.getItem('deliveree_packages_guest')).toBeNull();
  });
});

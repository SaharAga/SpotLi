/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

// End-to-end for issue #56: a restore by a signed-in user must land in that
// user's storage partition, not the guest key.
//
// A service-level test is NOT sufficient here, and that is the whole point:
// `deliveryService.importData(json, 'user-42')` passed while `App.jsx` still
// called `importData(jsonString)` with one argument, so `userId` defaulted to
// null and every real restore went to the guest partition. The service half
// was correct and the app was broken. This drives the real file-input path.
const authMocks = vi.hoisted(() => ({
  triggerCloudSync: vi.fn(),
  logout: vi.fn(),
  updateUserPreferences: vi.fn(),
  updateAiTrainingOptIn: vi.fn(),
  deleteUserAccountAndData: vi.fn()
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    // The dashboard renders a marketing landing page for guests; a signed-in
    // user is required to reach the package list.
    user: { id: 'user-import', email: 'u@example.com', preferences: {} },
    loading: false,
    triggerCloudSync: authMocks.triggerCloudSync,
    logout: authMocks.logout,
    updateUserPreferences: authMocks.updateUserPreferences,
    updateAiTrainingOptIn: authMocks.updateAiTrainingOptIn,
    deleteUserAccountAndData: authMocks.deleteUserAccountAndData,
    syncStatus: 'idle',
    lastSyncTime: null
  }),
  AuthProvider: ({ children }) => children
}));

vi.mock('./context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, theme: 'light', setTheme: vi.fn() }),
  ThemeProvider: ({ children }) => children
}));

// Firestore is unconfigured in tests; the dashboard only needs the adapter to
// stay inert for a guest session.
// Marking a package delivered fires confetti, which needs a real canvas.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('./services/cloudStorageAdapter', () => ({
  cloudAdapter: {
    subscribe: () => () => {},
    isFirestoreActive: () => false,
    savePackages: vi.fn()
  }
}));

// A single stored package renders one PackageCard, whose "mark delivered"
// button drives handleStatusChange -> upsertSinglePackage -> a real
// deliveryService write. One click, no nested menus.
const STORED_PACKAGE = {
  id: 'pkg-quota-1',
  title: 'Quota Test Parcel',
  titleHe: 'Quota Test Parcel',
  trackingNumber: 'RR123456789IL',
  carrier: 'israel-post',
  status: 'in_transit',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

function seedOnePackage() {
  localStorage.setItem(
    deliveryService.getStorageKey('user-quota'),
    JSON.stringify([STORED_PACKAGE])
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  // jsdom implements neither of these; InstallPwaBanner and the service-worker
  // registration both reach for them on mount.
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const GUEST_PACKAGE = {
  id: 'guest-existing',
  title: 'Guest Parcel',
  trackingNumber: 'GUEST0001',
  carrier: 'other',
  status: 'in_transit',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

const IMPORTED_PACKAGE = {
  id: 'imported-1',
  title: 'Imported Parcel',
  trackingNumber: 'IMPORT0001',
  carrier: 'other',
  status: 'in_transit',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

describe('App - importing a backup while signed in', () => {
  it('restores into the signed-in user partition, not the guest key', async () => {
    // Seed the guest partition so a write to the wrong key is visible.
    localStorage.setItem(
      deliveryService.getStorageKey(null),
      JSON.stringify([GUEST_PACKAGE])
    );

    const user = userEvent.setup();
    renderWithLanguage(<DashboardContent />);

    // The file input lives in the side drawer.
    await user.click(await screen.findByLabelText(/menu|תפריט/i));

    const input = document.querySelector('input[type="file"][accept=".json"]');
    expect(input).toBeTruthy();

    const file = new File([JSON.stringify([IMPORTED_PACKAGE])], 'backup.json', {
      type: 'application/json'
    });
    await user.upload(input, file);

    await waitFor(() => {
      const restored = deliveryService.getPackages('user-import');
      expect(restored.map((p) => p.id)).toContain('imported-1');
    });

    // The guest partition must be untouched — this is the assertion that fails
    // when the call site drops userId.
    const guest = deliveryService.getPackages(null);
    expect(guest.map((p) => p.id)).toEqual(['guest-existing']);
  });
});

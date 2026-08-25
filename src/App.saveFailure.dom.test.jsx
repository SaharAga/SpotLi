/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

// End-to-end for issue #43: a rejected localStorage write must produce a
// toast the user can actually see. Asserting that usePackages fired its
// callback is NOT sufficient — that passed while App.jsx consumed neither
// `saveError` nor `onSaveError` and nothing reached the screen. This test
// renders the real dashboard and reads the rendered alert.
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
    user: { id: 'user-quota', email: 'u@example.com', preferences: {} },
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

async function markDelivered() {
  const button = await screen.findByTitle(/delivered/i);
  await userEvent.click(button);
}

describe('App - a local save failure is visible to the user (#43)', () => {
  it('renders an error toast when the localStorage write is rejected', async () => {
    seedOnePackage();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Quota Test Parcel')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    // Installed after render so the language preference write above succeeds
    // and the dashboard mounts normally.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    });

    await markDelivered();

    // role="alert" is what Toast renders for an error - this asserts the
    // message is on screen, not merely that a callback fired.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/storage is full/i);
    expect(alert).toHaveTextContent(/not saved/i);
  });

  it('shows no failure toast when the write succeeds', async () => {
    seedOnePackage();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Quota Test Parcel')).toBeInTheDocument();
    await markDelivered();

    await waitFor(() => {
      expect(deliveryService.getPackages('user-quota')[0].status).toBe('delivered');
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

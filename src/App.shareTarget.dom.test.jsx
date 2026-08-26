/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

// The Web Share Target / app-shortcut handler is a startup-only effect: it
// reads the query string once and then scrubs it from the URL. Its dependency
// array said `[packages]`, so every package mutation re-parsed the URL and
// re-read six params for nothing. This test pins it to one run by counting
// the query-param reads across a mutation.
const authMocks = vi.hoisted(() => ({
  triggerCloudSync: vi.fn(),
  logout: vi.fn(),
  updateUserPreferences: vi.fn(),
  updateAiTrainingOptIn: vi.fn(),
  deleteUserAccountAndData: vi.fn()
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-share', email: 'u@example.com', preferences: {} },
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

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('./services/cloudStorageAdapter', () => ({
  cloudAdapter: {
    subscribe: () => () => {},
    isFirestoreActive: () => false,
    savePackages: vi.fn()
  }
}));

const STORED_PACKAGE = {
  id: 'pkg-share-1',
  title: 'Share Target Parcel',
  titleHe: 'Share Target Parcel',
  trackingNumber: 'RR987654321IL',
  carrier: 'israel-post',
  status: 'in_transit',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

function seedOnePackage() {
  localStorage.setItem(
    deliveryService.getStorageKey('user-share'),
    JSON.stringify([STORED_PACKAGE])
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
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
  window.history.replaceState({}, '', '/');
});

async function markDelivered() {
  const button = await screen.findByTitle(/delivered/i);
  await userEvent.click(button);
}

describe('App - the share-target / shortcut handler is a startup-only effect', () => {
  it('does not re-read the query string when a package changes', async () => {
    seedOnePackage();
    window.history.replaceState({}, '', '/?packageId=not-a-real-id');

    const getSpy = vi.spyOn(URLSearchParams.prototype, 'get');

    renderWithLanguage(<DashboardContent />);
    expect(await screen.findByText('Share Target Parcel')).toBeInTheDocument();

    // The effect ran on mount and read its params.
    expect(getSpy.mock.calls.length).toBeGreaterThan(0);
    const readsAfterMount = getSpy.mock.calls.length;

    await markDelivered();
    await waitFor(() => {
      expect(deliveryService.getPackages('user-share')[0].status).toBe('delivered');
    });

    // A mutation re-renders the dashboard, but must not re-run the startup
    // effect. With the old `[packages]` dependency this grew by six.
    expect(getSpy.mock.calls.length).toBe(readsAfterMount);
  });

  it('still applies the share-target params on mount', async () => {
    seedOnePackage();
    window.history.replaceState({}, '', '/?title=Nike%20Order&text=Tracking%20LZ123456789US');

    renderWithLanguage(<DashboardContent />);

    // Smart Import opens pre-filled with the shared text.
    const field = await screen.findByDisplayValue(/Nike Order Tracking LZ123456789US/);
    expect(field).toBeInTheDocument();

    // ...and the params are scrubbed from the URL.
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
  });

  it('opens the package named by ?packageId on mount', async () => {
    seedOnePackage();
    window.history.replaceState({}, '', '/?packageId=pkg-share-1');

    renderWithLanguage(<DashboardContent />);

    // The detail modal renders the package's title alongside the card's, so
    // a second occurrence is the modal having opened. (Other dialogs — the
    // legal consent gate — may also be on screen; hence not findByRole.)
    await waitFor(() => {
      expect(screen.getAllByText('Share Target Parcel').length).toBeGreaterThan(1);
    });
  });
});

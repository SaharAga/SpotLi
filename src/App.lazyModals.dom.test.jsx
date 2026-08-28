/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';
import { LEGAL_VERSION } from './constants/legalVersion';

// P3.3: every dialog is now behind `React.lazy`, so opening one is an async
// module fetch rather than a state flip on an already-mounted component.
//
// Two things have to be true and neither is visible in the diff:
//   1. A dialog that is never opened is never rendered — otherwise mounting
//      it would fire its `import()` and the split would save nothing.
//   2. A dialog that *is* opened still ends up on screen with its real
//      content, and a chunk that fails to arrive still lands in the
//      ErrorBoundary #66 put around each modal rather than blanking the app.
//
// A build-output assertion cannot check either: the chunks exist either way.
const authMocks = vi.hoisted(() => ({
  triggerCloudSync: vi.fn(),
  logout: vi.fn(),
  updateUserPreferences: vi.fn(),
  updateAiTrainingOptIn: vi.fn(),
  deleteUserAccountAndData: vi.fn()
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    // `legalAcceptedVersion` matters here: without it LegalConsentGate
    // renders its own blocking dialog, and "no dialog is on screen" would be
    // false for a reason that has nothing to do with lazy loading.
    user: {
      id: 'user-lazy',
      email: 'u@example.com',
      preferences: {},
      legalAcceptedVersion: LEGAL_VERSION
    },
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
  id: 'pkg-lazy-1',
  title: 'Lazy Loaded Parcel',
  titleHe: 'Lazy Loaded Parcel',
  trackingNumber: 'RR555555555IL',
  carrier: 'israel-post',
  status: 'in_transit',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

function seedOnePackage() {
  localStorage.setItem(
    deliveryService.getStorageKey('user-lazy'),
    JSON.stringify([STORED_PACKAGE])
  );
}

// Navbar's "+" opens an action sheet; "Manual Form Entry" is the button that
// actually reaches MODAL.ADD_EDIT.
async function openAddPackageModal(user) {
  await user.click(await screen.findByTitle(/Add Shipment/i));
  await user.click(await screen.findByText('Manual Form Entry'));
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
});

describe('App - lazily loaded modals', () => {
  it('renders no dialog at all until one is opened', async () => {
    seedOnePackage();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Lazy Loaded Parcel')).toBeInTheDocument();

    // Before P3.3 all fourteen were mounted here with isOpen={false}. If any
    // of them mounts now, its chunk is being fetched on load.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('modal-loading-fallback')).toBeNull();
  });

  it('opens AddEditPackageModal and renders its real content', async () => {
    const user = userEvent.setup();
    seedOnePackage();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Lazy Loaded Parcel')).toBeInTheDocument();
    await openAddPackageModal(user);

    // A field from inside the lazily-loaded module, not just its shell.
    const titleField = await screen.findByPlaceholderText(
      /Mechanical Keyboard, Coffee Grinder/i
    );
    expect(titleField).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/RS948219481IL or LP00582910482CN/i)
    ).toBeInTheDocument();

    // The spinner is transient — it must not still be on screen once the
    // dialog has rendered.
    expect(screen.queryByTestId('modal-loading-fallback')).toBeNull();
  });

  it('keeps typed form state when the chunk has already resolved', async () => {
    const user = userEvent.setup();
    seedOnePackage();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Lazy Loaded Parcel')).toBeInTheDocument();
    await openAddPackageModal(user);

    const titleField = await screen.findByPlaceholderText(
      /Mechanical Keyboard, Coffee Grinder/i
    );
    await user.type(titleField, 'Half-typed entry');
    expect(titleField).toHaveValue('Half-typed entry');

    // A re-render of the dashboard must not re-suspend this dialog. If the
    // Suspense boundary sat where it re-triggered (or if the modal were
    // unmounted and remounted), the input would be blown away here.
    await user.click(screen.getByLabelText('Table'));
    expect(await screen.findByRole('table')).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Mechanical Keyboard, Coffee Grinder/i)
    ).toHaveValue('Half-typed entry');
    expect(screen.queryByTestId('modal-loading-fallback')).toBeNull();
  });

  it('catches a chunk that fails to load in the modal ErrorBoundary', async () => {
    const user = userEvent.setup();
    // A dynamic import that rejects is what an offline load, or a hashed
    // filename gone stale after a deploy, looks like at runtime.
    vi.doMock('./components/AboutModal', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    seedOnePackage();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Lazy Loaded Parcel')).toBeInTheDocument();

    await user.click(await screen.findByLabelText('Open Navigation Menu'));
    await user.click(await screen.findByText('About & System Info'));

    // The compact ErrorBoundary fallback, not a blank screen — and the rest
    // of the dashboard is still rendered underneath it.
    await waitFor(() => {
      expect(screen.getByText(/AboutModal failed to render/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Lazy Loaded Parcel')).toBeInTheDocument();

    vi.doUnmock('./components/AboutModal');
  });
});

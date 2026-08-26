/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

// A keystroke in the search box re-renders DashboardContent. Every PackageCard
// used to re-render with it, because App handed each card four freshly
// allocated arrow functions. Asserting that the handlers are referentially
// stable would be the weaker test — it passed while `usePackages` still
// returned new mutator identities every render, which invalidated App's
// useCallbacks and re-rendered every card anyway. So count actual renders.
const authMocks = vi.hoisted(() => ({
  triggerCloudSync: vi.fn(),
  logout: vi.fn(),
  updateUserPreferences: vi.fn(),
  updateAiTrainingOptIn: vi.fn(),
  deleteUserAccountAndData: vi.fn()
}));

const renderCounts = vi.hoisted(() => ({ card: 0, table: 0 }));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-memo', email: 'u@example.com', preferences: {} },
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

// The real components, wrapped so each render is counted. React.memo is
// applied by the modules themselves; this only observes it.
vi.mock('./components/PackageCard', async (importOriginal) => {
  const actual = await importOriginal();
  const React = await import('react');
  const Counting = (props) => {
    renderCounts.card += 1;
    return React.createElement(actual.PackageCard, props);
  };
  return { PackageCard: React.memo(Counting) };
});

vi.mock('./components/PackageTable', async (importOriginal) => {
  const actual = await importOriginal();
  const React = await import('react');
  const Counting = (props) => {
    renderCounts.table += 1;
    return React.createElement(actual.PackageTable, props);
  };
  return { PackageTable: React.memo(Counting) };
});

const PACKAGES = [
  {
    id: 'pkg-memo-1',
    title: 'Memo Parcel One',
    titleHe: 'Memo Parcel One',
    trackingNumber: 'RR111111111IL',
    carrier: 'israel-post',
    status: 'in_transit',
    category: 'other',
    isPinned: false,
    isArchived: false,
    checkpoints: []
  },
  {
    id: 'pkg-memo-2',
    title: 'Memo Parcel Two',
    titleHe: 'Memo Parcel Two',
    trackingNumber: 'RR222222222IL',
    carrier: 'israel-post',
    status: 'customs',
    category: 'other',
    isPinned: false,
    isArchived: false,
    checkpoints: []
  }
];

function seedPackages() {
  localStorage.setItem(
    deliveryService.getStorageKey('user-memo'),
    JSON.stringify(PACKAGES)
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  renderCounts.card = 0;
  renderCounts.table = 0;
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

describe('App - typing in the search box does not re-render the package list', () => {
  it('leaves PackageCard render counts untouched while the query still matches', async () => {
    seedPackages();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Memo Parcel One')).toBeInTheDocument();
    expect(await screen.findByText('Memo Parcel Two')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/search/i);
    const rendersAfterMount = renderCounts.card;
    expect(rendersAfterMount).toBeGreaterThan(0);

    // "Memo" matches both packages, so the rendered list is unchanged: same
    // package objects, same handlers, nothing for the cards to re-render for.
    await userEvent.type(input, 'Memo');

    expect(await screen.findByText('Memo Parcel One')).toBeInTheDocument();
    expect(screen.getByText('Memo Parcel Two')).toBeInTheDocument();
    expect(input).toHaveValue('Memo');

    // Four keystrokes; before the memo + stable handlers this was
    // rendersAfterMount + 8 (two cards each, once per keystroke).
    expect(renderCounts.card).toBe(rendersAfterMount);
  });

  it('leaves the PackageTable render count untouched in table view', async () => {
    seedPackages();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Memo Parcel One')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Table'));
    expect(await screen.findByRole('table')).toBeInTheDocument();

    const rendersAfterSwitch = renderCounts.table;
    expect(rendersAfterSwitch).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Memo');

    expect(screen.getByPlaceholderText(/search/i)).toHaveValue('Memo');
    expect(renderCounts.table).toBe(rendersAfterSwitch);
  });

  it('still re-renders the list when the query actually narrows it', async () => {
    seedPackages();
    renderWithLanguage(<DashboardContent />);

    expect(await screen.findByText('Memo Parcel Two')).toBeInTheDocument();
    const rendersAfterMount = renderCounts.card;

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Parcel One');

    // Memoization must not stop a real filter change from reaching the UI.
    expect(screen.queryByText('Memo Parcel Two')).toBeNull();
    expect(screen.getByText('Memo Parcel One')).toBeInTheDocument();
    expect(renderCounts.card).toBeGreaterThanOrEqual(rendersAfterMount);
  });
});

/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { STORAGE_KEYS } from './constants/storageKeys';
import { LEGAL_VERSION } from './constants/legal';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-sort',
      email: 'u@example.com',
      legalAcceptedVersion: LEGAL_VERSION,
      preferences: {}
    },
    loading: false,
    triggerCloudSync: vi.fn(),
    logout: vi.fn(),
    updateUserPreferences: vi.fn(),
    updateAiTrainingOptIn: vi.fn(),
    deleteUserAccountAndData: vi.fn(),
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

describe('App sortBy persistence (#133)', () => {
  beforeEach(() => {
    localStorage.clear();
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
    localStorage.clear();
  });

  it('restores saved sortBy preference from localStorage', async () => {
    localStorage.setItem(STORAGE_KEYS.SORT_BY, 'expected');
    renderWithLanguage(<DashboardContent />);

    const filterButton = screen.getByRole('button', { name: /סטטוס|Status/i });
    await userEvent.click(filterButton);

    const sortSelects = screen.getAllByRole('combobox');
    const sortSelect = sortSelects[sortSelects.length - 1];
    expect(sortSelect).toHaveValue('expected');
  });

  it('persists updated sortBy preference to localStorage when changed', async () => {
    renderWithLanguage(<DashboardContent />);

    const filterButton = screen.getByRole('button', { name: /סטטוס|Status/i });
    await userEvent.click(filterButton);

    const sortSelects = screen.getAllByRole('combobox');
    const sortSelect = sortSelects[sortSelects.length - 1];
    expect(sortSelect).toHaveValue('newest');

    await userEvent.selectOptions(sortSelect, 'title');
    expect(sortSelect).toHaveValue('title');
    expect(localStorage.getItem(STORAGE_KEYS.SORT_BY)).toBe('title');
  });
});

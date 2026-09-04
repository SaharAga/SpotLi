/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSheet } from './AccountSheet';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({
  // The sheet now renders the settings sections inline, so this stands in for
  // everything they read too — an incomplete mock makes them throw into the
  // ErrorBoundary and vanish silently.
  useAuth: () => ({
    user: null,
    logout: vi.fn(),
    updateUserPreferences: vi.fn(),
    updateAiTrainingOptIn: vi.fn(),
    deleteUserAccountAndData: vi.fn(),
    syncStatus: 'idle',
    lastSyncTime: null
  })
}));
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: true, theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() })
}));

const renderSheet = (props = {}) => {
  localStorage.setItem('deliveree_lang', 'en');
  return render(
    <LanguageProvider>
      <AccountSheet isOpen onClose={vi.fn()} {...props} />
    </LanguageProvider>
  );
};

beforeEach(() => {
  localStorage.clear();
});

describe('AccountSheet', () => {
  it('groups the destinations instead of listing them flat', () => {
    renderSheet();
    // The drawer this replaces showed thirteen items at one weight. The
    // grouping is the point of the screen, so it is worth asserting.
    for (const label of ['Adding packages', 'Your packages', 'More']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('stays open underneath an inner page, so its back arrow returns here', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenAbout = vi.fn();
    renderSheet({ onClose, onOpenAbout });

    await user.click(screen.getByText('About'));

    // Account is one level up from About, so it must remain on the stack —
    // closing it here is what previously sent the back arrow to Status.
    expect(onOpenAbout).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not offer Smart paste, which is the bottom bar\'s + button', () => {
    renderSheet();
    expect(screen.queryByText(/Smart Paste/i)).toBeNull();
  });

  it('carries the settings inline rather than a Settings row', () => {
    // The row used to open a second screen with its own six-item rail — a
    // settings menu inside a settings menu.
    renderSheet();
    expect(screen.queryByText(/^Settings$/)).toBeNull();
    expect(screen.getAllByText(/Notifications/i).length).toBeGreaterThan(0);
  });

  it('does not duplicate Insights, which has its own tab', () => {
    renderSheet({ onOpenAnalytics: vi.fn() });
    expect(screen.queryByText(/Delivery Insights/i)).toBeNull();
  });

  it('offers sign-in rather than a profile when signed out', () => {
    renderSheet();
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('hides the admin entry unless the handler is supplied', () => {
    const { unmount } = renderSheet();
    expect(screen.queryByText('Admin')).toBeNull();
    unmount();

    renderSheet({ onOpenAdminFeedback: vi.fn() });
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('hides destructive actions for a signed-out, non-demo visitor', () => {
    renderSheet();
    const rows = document.querySelector('[data-account-rows]');
    expect(within(rows).queryByText(/Clear|Delete all/i)).toBeNull();
    expect(within(rows).queryByText('Sign out')).toBeNull();
  });

  it('keeps every row at the 48px touch minimum', () => {
    renderSheet();
    // Modal renders through a portal, so the rows are not under `container`.
    const rows = document.querySelectorAll('[data-account-rows] button, [data-account-rows] label');
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) {
      const cls = row.className;
      const ok = /min-h-\[(4[89]|5[0-9]|6[0-9])px\]/.test(cls)
        || cls.includes('min-h-[48px]')
        || cls.includes('min-h-[52px]')
        || cls.includes('p-4');
      expect(ok).toBe(true);
    }
  });
});

/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSheet } from './AccountSheet';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() })
}));
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: true, toggleTheme: vi.fn() })
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
    for (const label of ['Adding packages', 'Your packages', 'Preferences', 'More']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('closes before opening a destination, so the sheet is never left underneath', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenAnalytics = vi.fn();
    renderSheet({ onClose, onOpenAnalytics });

    await user.click(screen.getByText(/Delivery Insights/i));

    expect(onClose).toHaveBeenCalled();
    expect(onOpenAnalytics).toHaveBeenCalled();
    expect(onClose.mock.invocationCallOrder[0])
      .toBeLessThan(onOpenAnalytics.mock.invocationCallOrder[0]);
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
    expect(screen.queryByText(/Clear|Delete all/i)).toBeNull();
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it('keeps every row at the 48px touch minimum', () => {
    renderSheet();
    // Modal renders through a portal, so the rows are not under `container`.
    const rows = document.querySelectorAll('[role="dialog"] button, [role="dialog"] label');
    expect(rows.length).toBeGreaterThan(5);
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

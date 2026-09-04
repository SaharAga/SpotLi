/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomNav } from './BottomNav';
import { LanguageProvider } from '../context/LanguageContext';

const renderNav = (props = {}) => {
  // Pinned to Hebrew: the labels below are Hebrew, and the provider now
  // detects from navigator rather than defaulting, so an unpinned render
  // would follow whatever locale jsdom reports.
  localStorage.setItem('deliveree_lang', 'he');
  return render(
    <LanguageProvider>
      <BottomNav {...props} />
    </LanguageProvider>
  );
};

describe('BottomNav', () => {
  it('renders four destinations plus the add button', () => {
    renderNav();
    expect(screen.getByRole('navigation')).toBeTruthy();
    // Four tabs + the FAB.
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('routes each tab to its own handler', async () => {
    const user = userEvent.setup();
    const handlers = {
      onOpenStatus: vi.fn(),
      onOpenInsights: vi.fn(),
      onOpenAdd: vi.fn(),
      onOpenLockers: vi.fn(),
      onOpenAccount: vi.fn()
    };
    renderNav(handlers);

    // The provider defaults to Hebrew — the app is Hebrew-first.
    await user.click(screen.getByText('תובנות'));
    expect(handlers.onOpenInsights).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('לוקרים'));
    expect(handlers.onOpenLockers).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('חשבון'));
    expect(handlers.onOpenAccount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('הוסף חבילה'));
    expect(handlers.onOpenAdd).toHaveBeenCalledTimes(1);

    expect(handlers.onOpenStatus).not.toHaveBeenCalled();
  });

  it('marks only the active tab with aria-current', () => {
    renderNav({ activeTab: 'lockers' });
    const current = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('לוקרים');
  });

  it('uses no direction-specific classes, so RTL mirrors on its own', () => {
    const { container } = renderNav();
    const html = container.innerHTML;
    // The bilingual rule: physical left/right utilities would pin the bar's
    // order in one direction. Logical properties and plain flex do not.
    expect(html).not.toMatch(/\b(left|right)-\d/);
    expect(html).not.toMatch(/\b(pl|pr|ml|mr)-\d/);
  });

  it('keeps every touch target at or above the 48px floor', () => {
    const { container } = renderNav();
    const tabs = container.querySelectorAll('button');
    for (const tab of tabs) {
      const cls = tab.className;
      // Tabs declare min-h-[48px]; the FAB is a fixed 56px circle.
      expect(cls.includes('min-h-[48px]') || cls.includes('h-14')).toBe(true);
    }
  });
});

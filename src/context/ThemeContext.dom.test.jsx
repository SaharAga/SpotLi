/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';
import { renderWithTheme, mockColorScheme } from '../test-utils/renderWithProviders';
import { render } from '@testing-library/react';

/**
 * ThemeContext had no tests at all, which is how the entire light theme shipped
 * broken: the `.light` class it puts on <html> is what swaps index.css's
 * inverted slate palette in, so every light-mode bug in the app traces back
 * through this file, and nothing exercised it.
 *
 * These assert the mechanism — the class on the document element, persistence,
 * and following the OS — not colours, which jsdom cannot resolve (it loads no
 * stylesheets). Colour correctness is enforced by themeClassContract.test.js.
 */

function Probe() {
  const { theme, isDark, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="isDark">{String(isDark)}</span>
      <button type="button" onClick={toggleTheme}>toggle</button>
      <button type="button" onClick={() => setTheme('system')}>use system</button>
    </div>
  );
}

const rootClasses = () => [...document.documentElement.classList];

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  document.documentElement.className = '';
});

describe('ThemeProvider', () => {
  it('puts .light on the document element for an explicit light preference', () => {
    renderWithTheme(<Probe />, { theme: 'light' });
    expect(rootClasses()).toContain('light');
    expect(rootClasses()).not.toContain('dark');
    expect(screen.getByTestId('isDark')).toHaveTextContent('false');
  });

  it('puts .dark on the document element for an explicit dark preference', () => {
    renderWithTheme(<Probe />, { theme: 'dark' });
    expect(rootClasses()).toContain('dark');
    expect(rootClasses()).not.toContain('light');
    expect(screen.getByTestId('isDark')).toHaveTextContent('true');
  });

  it('never carries both classes at once', async () => {
    renderWithTheme(<Probe />, { theme: 'light' });
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    // A stale class would leave `.light .dark` on <html>, and the inverted
    // palette in index.css is keyed on `.light` — both present means the
    // cascade decides the theme, not the user.
    expect(rootClasses().filter((c) => c === 'light' || c === 'dark')).toHaveLength(1);
    expect(rootClasses()).toContain('dark');
  });

  describe('with no stored preference (the default: system)', () => {
    it('follows an OS set to dark', () => {
      mockColorScheme(true);
      render(<ThemeProvider><Probe /></ThemeProvider>);
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('isDark')).toHaveTextContent('true');
      expect(rootClasses()).toContain('dark');
    });

    it('follows an OS set to light', () => {
      mockColorScheme(false);
      render(<ThemeProvider><Probe /></ThemeProvider>);
      expect(screen.getByTestId('isDark')).toHaveTextContent('false');
      expect(rootClasses()).toContain('light');
    });

    it('follows the OS flipping theme while the app is open', () => {
      const mql = mockColorScheme(false);
      render(<ThemeProvider><Probe /></ThemeProvider>);
      expect(rootClasses()).toContain('light');

      act(() => mql.emit(true));

      expect(screen.getByTestId('isDark')).toHaveTextContent('true');
      expect(rootClasses()).toContain('dark');
      // Still 'system' — following the OS is not the same as choosing a theme.
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });
  });

  describe('toggling', () => {
    it('pins the opposite of what the OS was showing, from system', async () => {
      mockColorScheme(true);
      render(<ThemeProvider><Probe /></ThemeProvider>);
      expect(screen.getByTestId('theme')).toHaveTextContent('system');

      await userEvent.click(screen.getByRole('button', { name: 'toggle' }));

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(rootClasses()).toContain('light');
    });

    it('stops following the OS once a theme is pinned', async () => {
      const mql = mockColorScheme(true);
      render(<ThemeProvider><Probe /></ThemeProvider>);
      await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
      expect(screen.getByTestId('theme')).toHaveTextContent('light');

      act(() => mql.emit(false));
      act(() => mql.emit(true));

      // An explicit choice outranks the OS; otherwise picking light and then
      // unlocking your phone at night would silently undo the choice.
      expect(screen.getByTestId('isDark')).toHaveTextContent('false');
      expect(rootClasses()).toContain('light');
    });

    it('persists the choice so it survives a reload', async () => {
      renderWithTheme(<Probe />, { theme: 'light' });
      await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
      expect(localStorage.getItem('deliveree_theme')).toBe('dark');
    });

    it('restores a stored preference over the OS setting', () => {
      localStorage.setItem('deliveree_theme', 'light');
      mockColorScheme(true);
      render(<ThemeProvider><Probe /></ThemeProvider>);
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(rootClasses()).toContain('light');
    });
  });

  it('throws a useful error when useTheme is used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/useTheme must be used within a ThemeProvider/);
  });
});

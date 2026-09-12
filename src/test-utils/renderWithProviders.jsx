import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';

/**
 * Renders a component wrapped in LanguageProvider, pinned to a language so
 * assertions match stable translation strings.
 *
 * Pinning matters more than it used to: with no stored `deliveree_lang`,
 * LanguageProvider now detects from `navigator.languages` rather than always
 * falling back to Hebrew, so an unpinned test would assert against whatever
 * locale the machine (or jsdom) happens to report.
 */
export function renderWithLanguage(ui, { language = 'en' } = {}) {
  try {
    localStorage.setItem('deliveree_lang', language);
  } catch {
    // jsdom always provides localStorage; this mirrors the app's own guard.
  }
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

/**
 * Pins the OS colour-scheme preference for a test.
 *
 * ThemeProvider defaults to `'system'` and reads `prefers-color-scheme`, so an
 * unpinned test renders in whatever jsdom's stub reports — and jsdom's default
 * `matchMedia` is missing entirely, which is why this installs one.
 *
 * Call it BEFORE rendering. Returns the MediaQueryList stub so a test can fire
 * a `change` event and assert the app follows the OS flipping theme mid-session.
 */
export function mockColorScheme(prefersDark) {
  const listeners = new Set();
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_event, cb) => listeners.add(cb),
    removeEventListener: (_event, cb) => listeners.delete(cb),
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
    dispatchEvent: () => true,
    onchange: null,
    /** Simulates the OS switching theme while the app is open. */
    emit(nextMatches) {
      mql.matches = nextMatches;
      listeners.forEach((cb) => cb({ matches: nextMatches }));
    }
  };
  window.matchMedia = (query) =>
    query === '(prefers-color-scheme: dark)' ? mql : { ...mql, matches: false, media: query };
  return mql;
}

/**
 * Renders inside ThemeProvider (and LanguageProvider), pinned to a theme.
 *
 * The counterpart to `renderWithLanguage`, and added for the same reason: the
 * app shipped with its entire light theme broken — headings rendered
 * white-on-white on the first screen a new user sees — because every DOM test
 * pinned a language and none pinned a theme, so nothing ever rendered light.
 *
 * NOTE ON WHAT THIS CAN AND CANNOT ASSERT. jsdom loads no stylesheets
 * (`document.styleSheets.length === 0`), so `getComputedStyle` returns defaults
 * and a *colour* assertion here is meaningless — `text-white` computes to
 * rgb(0,0,0), not white. Use this for behaviour that depends on the theme
 * (which classes get applied, what a toggle does, what is rendered). Actual
 * colour correctness is enforced statically by
 * `src/tests/integration/themeClassContract.test.js`.
 *
 * @param {'light'|'dark'|'system'} [theme]
 * @param {boolean} [systemPrefersDark] Only meaningful when theme is 'system'.
 */
export function renderWithTheme(ui, { theme = 'light', language = 'en', systemPrefersDark = false } = {}) {
  mockColorScheme(systemPrefersDark);
  try {
    localStorage.setItem('deliveree_lang', language);
    localStorage.setItem('deliveree_theme', theme);
  } catch {
    // jsdom always provides localStorage; this mirrors the app's own guard.
  }
  return render(
    <LanguageProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </LanguageProvider>
  );
}

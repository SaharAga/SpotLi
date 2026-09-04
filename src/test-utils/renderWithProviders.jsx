import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { LanguageProvider } from '../context/LanguageContext';

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

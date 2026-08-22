import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { LanguageProvider } from '../context/LanguageContext';

/**
 * Renders a component wrapped in LanguageProvider, forced to English so
 * assertions can match on stable translation strings instead of Hebrew
 * (the default language when no `deliveree_lang` is in localStorage).
 */
export function renderWithLanguage(ui, { language = 'en' } = {}) {
  try {
    localStorage.setItem('deliveree_lang', language);
  } catch {
    // jsdom always provides localStorage; this mirrors the app's own guard.
  }
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

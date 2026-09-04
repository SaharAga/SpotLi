import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

/**
 * First-run language, from the browser/OS rather than a hardcoded default.
 *
 * This used to be `localStorage.getItem(...) || 'he'`, which meant an English
 * speaker's first visit was Hebrew RTL regardless of their system settings —
 * inconsistent with ThemeContext, which has always honoured
 * `prefers-color-scheme`.
 *
 * Unlike theme there is no stored `'system'` value that keeps tracking the OS:
 * the stored preference stays a concrete 'he' | 'en'. Detection decides the
 * FIRST run only, and any explicit toggle pins it from then on. That is the
 * right trade for language — people change OS colour scheme on a daily
 * schedule, but almost never change OS language mid-session, and silently
 * flipping a reading direction under someone would be far more disruptive
 * than flipping a palette.
 *
 * Matches Hebrew via the `he` primary subtag (plus the legacy `iw` code some
 * platforms still emit), so `he`, `he-IL` and `iw-IL` all resolve to Hebrew.
 */
export function detectSystemLanguage() {
  if (typeof navigator === 'undefined') return 'he';

  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  for (const tag of candidates) {
    if (typeof tag !== 'string') continue;
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'he' || primary === 'iw') return 'he';
    if (primary === 'en') return 'en';
  }

  // Neither Hebrew nor English: Hebrew stays the fallback — this is an
  // Israel-first product, and its carrier coverage is Israeli.
  return 'he';
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // `?lang=he|en` wins over everything. It makes the language deep-linkable
    // (useful for sharing a bug report in the language it happens in), and it
    // is what lets devtools/preview.html run a Hebrew and an English frame
    // side by side: the two iframes share an origin, so localStorage alone
    // cannot keep them apart — whichever mounts last would win both.
    // Deliberately not persisted: the param overrides the stored preference
    // for that view without silently rewriting it.
    try {
      const param = new URLSearchParams(window.location.search).get('lang');
      if (param === 'he' || param === 'en') return param;
    } catch {
      // No window/location (Node test env) — fall through.
    }

    try {
      const stored = localStorage.getItem('deliveree_lang');
      if (stored === 'he' || stored === 'en') return stored;
    } catch {
      // Private mode — fall through to detection.
    }
    return detectSystemLanguage();
  });

  const isRTL = language === 'he';

  useEffect(() => {
    try {
      localStorage.setItem('deliveree_lang', language);
    } catch {
      // Ignore in strict private mode
    }
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      if (isRTL) {
        document.body.classList.add('rtl-layout');
        document.body.classList.remove('ltr-layout');
      } else {
        document.body.classList.add('ltr-layout');
        document.body.classList.remove('rtl-layout');
      }
    }
  }, [language, isRTL]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => (prev === 'en' ? 'he' : 'en'));
  }, []);

  /**
   * Helper to look up translation key safely
   */
  const t = useCallback((path) => {
    if (!path || typeof path !== 'string') return '';
    const keys = path.split('.');

    // Try selected language
    let current = translations[language] || translations['en'];
    let found = true;
    for (const key of keys) {
      if (current && typeof current === 'object' && current[key] !== undefined) {
        current = current[key];
      } else {
        found = false;
        break;
      }
    }
    if (found && current !== undefined && typeof current !== 'object') {
      return current;
    }

    // Fallback to English
    let fallback = translations['en'];
    let foundFb = true;
    for (const key of keys) {
      if (fallback && typeof fallback === 'object' && fallback[key] !== undefined) {
        fallback = fallback[key];
      } else {
        foundFb = false;
        break;
      }
    }
    if (foundFb && fallback !== undefined && typeof fallback !== 'object') {
      return fallback;
    }

    return path;
  }, [language]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage,
    isRTL,
    t
  }), [language, toggleLanguage, isRTL, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

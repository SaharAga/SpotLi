/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectSystemLanguage } from './LanguageContext';

const setLanguages = (languages, language) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language ?? languages?.[0]);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectSystemLanguage', () => {
  it('picks Hebrew for he and he-IL', () => {
    setLanguages(['he-IL', 'he']);
    expect(detectSystemLanguage()).toBe('he');
  });

  it('picks Hebrew for the legacy iw tag some platforms still emit', () => {
    setLanguages(['iw-IL']);
    expect(detectSystemLanguage()).toBe('he');
  });

  it('picks English for en-US', () => {
    setLanguages(['en-US', 'en']);
    expect(detectSystemLanguage()).toBe('en');
  });

  it('honours preference order when both are present', () => {
    setLanguages(['en-GB', 'he-IL']);
    expect(detectSystemLanguage()).toBe('en');
    vi.restoreAllMocks();
    setLanguages(['he-IL', 'en-GB']);
    expect(detectSystemLanguage()).toBe('he');
  });

  it('skips languages it does not support and keeps looking', () => {
    setLanguages(['fr-FR', 'de-DE', 'en-US']);
    expect(detectSystemLanguage()).toBe('en');
  });

  it('falls back to Hebrew when nothing matches — this is an Israel-first product', () => {
    setLanguages(['fr-FR', 'de-DE']);
    expect(detectSystemLanguage()).toBe('he');
  });

  it('falls back to navigator.language when languages is empty', () => {
    setLanguages([], 'en-US');
    expect(detectSystemLanguage()).toBe('en');
  });

  it('ignores non-string entries without throwing', () => {
    setLanguages([null, undefined, 'en'], 'en');
    expect(detectSystemLanguage()).toBe('en');
  });
});

describe('?lang= URL override', () => {
  const withSearch = async (search) => {
    window.history.replaceState({}, '', search ? `/?${search}` : '/');
    vi.resetModules();
    const { LanguageProvider } = await import('./LanguageContext');
    const { render } = await import('@testing-library/react');
    render(<LanguageProvider><span>x</span></LanguageProvider>);
    return document.documentElement.lang;
  };

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
  });

  it('wins over a stored preference', async () => {
    localStorage.setItem('deliveree_lang', 'en');
    expect(await withSearch('lang=he')).toBe('he');
  });

  it('works in the other direction too', async () => {
    localStorage.setItem('deliveree_lang', 'he');
    expect(await withSearch('lang=en')).toBe('en');
  });

  it('ignores an unsupported value and falls back to the stored preference', async () => {
    localStorage.setItem('deliveree_lang', 'he');
    expect(await withSearch('lang=fr')).toBe('he');
  });

  it('falls through to the stored preference when absent', async () => {
    localStorage.setItem('deliveree_lang', 'he');
    expect(await withSearch('')).toBe('he');
  });
});

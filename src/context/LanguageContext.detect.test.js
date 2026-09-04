/** @vitest-environment jsdom */
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

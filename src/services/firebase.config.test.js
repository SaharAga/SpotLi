import { describe, it, expect } from 'vitest';
import { cleanConfigValue } from './firebase';

describe('cleanConfigValue', () => {
  it('strips the trailing CRLF that broke Google sign-in in production', () => {
    // The real failure: a stray newline in the VITE_FIREBASE_AUTH_DOMAIN
    // repo variable ended up inside the OAuth iframe URL as %0D%0A, and
    // Firebase rejected it with "Illegal url for new iframe".
    expect(cleanConfigValue('deliveree-app-2a938.firebaseapp.com\r\n'))
      .toBe('deliveree-app-2a938.firebaseapp.com');
  });

  it('strips a bare trailing newline and leading/trailing spaces', () => {
    expect(cleanConfigValue('example.firebaseapp.com\n')).toBe('example.firebaseapp.com');
    expect(cleanConfigValue('  example.firebaseapp.com  ')).toBe('example.firebaseapp.com');
  });

  it('produces a URL that is parseable once cleaned', () => {
    const dirty = 'deliveree-app-2a938.firebaseapp.com\r\n';
    // Concatenated the same way Firebase builds the iframe URL.
    expect(() => new URL(`https://${cleanConfigValue(dirty)}/__/auth/iframe`)).not.toThrow();
    expect(new URL(`https://${cleanConfigValue(dirty)}/__/auth/iframe`).hostname)
      .toBe('deliveree-app-2a938.firebaseapp.com');
  });

  it('leaves an already-clean value untouched', () => {
    expect(cleanConfigValue('deliveree-app-2a938.firebaseapp.com'))
      .toBe('deliveree-app-2a938.firebaseapp.com');
  });

  it('passes through undefined so the unconfigured check still works', () => {
    expect(cleanConfigValue(undefined)).toBeUndefined();
  });

  it('does not turn a whitespace-only value into something truthy', () => {
    // Guards isFirebaseConfigured: "   " must not read as a configured value.
    expect(cleanConfigValue('   ')).toBe('');
    expect(Boolean(cleanConfigValue('   '))).toBe(false);
  });
});

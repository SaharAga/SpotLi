import { describe, it, expect } from 'vitest';
import { cleanConfigValue, resolveAuthDomain } from './firebase';

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

describe('cleanConfigValue on the App Check site key', () => {
  it('strips whitespace a pasted reCAPTCHA key carries', () => {
    // Same failure mode as the authDomain CRLF above: the key is pasted into a
    // GitHub repository variable, and a trailing newline survives the build.
    // ReCaptchaEnterpriseProvider does not reject it synchronously — reCAPTCHA
    // just never returns a token, so App Check fails invisibly.
    expect(cleanConfigValue('6Labcdefghijklmnopqrstuvwxyz012345678\r\n'))
      .toBe('6Labcdefghijklmnopqrstuvwxyz012345678');
  });

  it('reads a whitespace-only key as unset rather than as configured', () => {
    // The gate is `app && recaptchaSiteKey`. Without cleaning, "  " is truthy,
    // so App Check would initialize with a blank key and the "not configured"
    // warning that explains the problem would never print.
    expect(Boolean(cleanConfigValue('  \n'))).toBe(false);
  });
});

describe('resolveAuthDomain', () => {
  const configuredDomain = 'deliveree-app-2a938.firebaseapp.com';
  const projectId = 'deliveree-app-2a938';

  it('uses window hostname on Firebase Hosting staging preview channels', () => {
    const stagingHost = 'deliveree-app-2a938--staging-puww5giq.web.app';
    expect(resolveAuthDomain(configuredDomain, stagingHost, projectId)).toBe(stagingHost);
  });

  it('uses window hostname on production Firebase Hosting web.app domain', () => {
    const prodHost = 'deliveree-app-2a938.web.app';
    expect(resolveAuthDomain(configuredDomain, prodHost, projectId)).toBe(prodHost);
  });

  it('uses window hostname on production Firebase Hosting firebaseapp.com domain', () => {
    const prodHost = 'deliveree-app-2a938.firebaseapp.com';
    expect(resolveAuthDomain(configuredDomain, prodHost, projectId)).toBe(prodHost);
  });

  it('uses window hostname on known custom domains', () => {
    expect(resolveAuthDomain(configuredDomain, 'spotliapp.com', projectId)).toBe('spotliapp.com');
    expect(resolveAuthDomain(configuredDomain, 'www.spotliapp.com', projectId)).toBe('www.spotliapp.com');
    expect(resolveAuthDomain(configuredDomain, 'deliveree.app', projectId)).toBe('deliveree.app');
  });

  it('falls back to configured domain for localhost development', () => {
    expect(resolveAuthDomain(configuredDomain, 'localhost', projectId)).toBe(configuredDomain);
    expect(resolveAuthDomain(configuredDomain, '127.0.0.1', projectId)).toBe(configuredDomain);
  });

  it('falls back to configured domain for unrelated external hostnames', () => {
    expect(resolveAuthDomain(configuredDomain, 'malicious-site.com', projectId)).toBe(configuredDomain);
    expect(resolveAuthDomain(configuredDomain, 'other-project.web.app', projectId)).toBe(configuredDomain);
  });

  it('falls back to configured domain when window/hostname is undefined', () => {
    expect(resolveAuthDomain(configuredDomain, undefined, projectId)).toBe(configuredDomain);
    expect(resolveAuthDomain(configuredDomain, '', projectId)).toBe(configuredDomain);
  });

  it('cleans whitespace from configuredDomain if fallback is used', () => {
    expect(resolveAuthDomain('  deliveree-app-2a938.firebaseapp.com \n', 'localhost', projectId))
      .toBe('deliveree-app-2a938.firebaseapp.com');
  });
});

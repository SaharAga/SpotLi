import { describe, it, expect } from 'vitest';
import { resolveAuthDomain } from './firebase';

const CONFIGURED = 'deliveree-app-2a938.firebaseapp.com';

describe('resolveAuthDomain', () => {
  it('uses the page origin when served from a Firebase Hosting web.app domain', () => {
    // The whole point: same-origin authDomain keeps the /__/auth/iframe
    // helper first-party, so third-party storage blocking can't break it.
    expect(resolveAuthDomain('deliveree-app-2a938.web.app', CONFIGURED))
      .toBe('deliveree-app-2a938.web.app');
  });

  it('uses the page origin when already on a firebaseapp.com domain', () => {
    expect(resolveAuthDomain('deliveree-app-2a938.firebaseapp.com', CONFIGURED))
      .toBe('deliveree-app-2a938.firebaseapp.com');
  });

  it('falls back to the configured domain on a custom domain', () => {
    expect(resolveAuthDomain('track.deliveree.app', CONFIGURED)).toBe(CONFIGURED);
  });

  it('falls back to the configured domain on localhost', () => {
    expect(resolveAuthDomain('localhost', CONFIGURED)).toBe(CONFIGURED);
  });

  it('falls back when there is no window (SSR / tests)', () => {
    expect(resolveAuthDomain(undefined, CONFIGURED)).toBe(CONFIGURED);
  });

  it('does not match a lookalike domain that merely ends in the same text', () => {
    // "notweb.app" ends with "web.app" as a substring but is a different
    // registrable domain — the leading dot in the check is what prevents an
    // attacker-controlled lookalike from being treated as our own origin.
    expect(resolveAuthDomain('notweb.app', CONFIGURED)).toBe(CONFIGURED);
    expect(resolveAuthDomain('evil-firebaseapp.com', CONFIGURED)).toBe(CONFIGURED);
  });
});

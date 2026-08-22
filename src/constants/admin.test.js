import { describe, it, expect } from 'vitest';
import { ADMIN_EMAILS, isAdminUser } from './admin';

describe('Admin allowlist', () => {
  it('exposes a non-empty allowlist of lowercase emails', () => {
    expect(Array.isArray(ADMIN_EMAILS)).toBe(true);
    expect(ADMIN_EMAILS.length).toBeGreaterThan(0);
    for (const email of ADMIN_EMAILS) {
      expect(email).toBe(email.toLowerCase());
      expect(email).toContain('@');
    }
  });

  it('accepts an allowlisted user with a verified email', () => {
    expect(isAdminUser({ email: ADMIN_EMAILS[0], emailVerified: true })).toBe(true);
  });

  it('normalizes case and surrounding whitespace before matching', () => {
    const upper = ADMIN_EMAILS[0].toUpperCase();
    expect(isAdminUser({ email: `  ${upper}  `, emailVerified: true })).toBe(true);
  });

  it('rejects an allowlisted email that is not verified', () => {
    expect(isAdminUser({ email: ADMIN_EMAILS[0], emailVerified: false })).toBe(false);
    expect(isAdminUser({ email: ADMIN_EMAILS[0] })).toBe(false);
  });

  it('rejects non-allowlisted users even when verified', () => {
    expect(isAdminUser({ email: 'someone-else@example.com', emailVerified: true })).toBe(false);
  });

  it('rejects missing, malformed, or anonymous users', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser({})).toBe(false);
    expect(isAdminUser({ email: '', emailVerified: true })).toBe(false);
    expect(isAdminUser({ email: 123, emailVerified: true })).toBe(false);
  });

  it('does not match on a lookalike address that merely contains an admin email', () => {
    const target = ADMIN_EMAILS[0];
    expect(isAdminUser({ email: `x${target}`, emailVerified: true })).toBe(false);
    expect(isAdminUser({ email: `${target}.attacker.com`, emailVerified: true })).toBe(false);
  });
});

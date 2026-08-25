import { describe, it, expect } from 'vitest';
import { APP_VERSION, RELEASE_DATE, BUILD_CHANNEL, FIREBASE_SCHEMA_VERSION } from './version';

describe('Version Constants Baseline', () => {
  it('should export correct APP_VERSION semver format', () => {
    expect(APP_VERSION).toBe('0.15.10');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/);
  });


  it('should export valid ISO RELEASE_DATE', () => {
    expect(RELEASE_DATE).toBe('2026-08-23');
    expect(RELEASE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(RELEASE_DATE))).toBe(false);
  });

  it('should export valid BUILD_CHANNEL', () => {
    expect(BUILD_CHANNEL).toBe('alpha');
    expect(['alpha', 'beta', 'rc', 'production']).toContain(BUILD_CHANNEL);
  });

  it('should export valid FIREBASE_SCHEMA_VERSION', () => {
    expect(FIREBASE_SCHEMA_VERSION).toBe('1.0.0');
    expect(FIREBASE_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

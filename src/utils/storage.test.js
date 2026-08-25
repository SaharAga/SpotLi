/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readJSON, writeJSON, readString, writeString } from './storage';

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips JSON values', () => {
    expect(writeJSON('k', { a: 1, b: ['x'] })).toBe(true);
    expect(readJSON('k', null)).toEqual({ a: 1, b: ['x'] });
  });

  it('returns the fallback for a missing key', () => {
    expect(readJSON('missing', { def: true })).toEqual({ def: true });
    expect(readJSON('missing')).toBe(null);
  });

  it('warns and falls back on malformed JSON instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('broken', '{not json');
    expect(() => readJSON('broken', 'fb')).not.toThrow();
    expect(readJSON('broken', 'fb')).toBe('fb');
    expect(warn).toHaveBeenCalled();
  });

  it('surfaces write failure as false rather than swallowing it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(writeJSON('k', { a: 1 })).toBe(false);
    expect(warn).toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('round-trips raw string values without JSON encoding', () => {
    expect(writeString('theme', 'dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(readString('theme')).toBe('dark');
    expect(readString('nope', 'system')).toBe('system');
  });
});

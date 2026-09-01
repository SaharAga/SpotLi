/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateAnonymousId } from './anonymousId';

describe('getOrCreateAnonymousId', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates and persists an id on first call', () => {
    const id = getOrCreateAnonymousId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(window.localStorage.getItem('deliveree_anon_id')).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const first = getOrCreateAnonymousId();
    const second = getOrCreateAnonymousId();
    expect(second).toBe(first);
  });

  it('returns null when localStorage throws (private mode / quota)', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem() {
          throw new Error('blocked');
        }
      }
    });
    try {
      expect(getOrCreateAnonymousId()).toBeNull();
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  });
});

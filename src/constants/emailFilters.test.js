import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_STORE_DOMAINS,
  SHIPPING_KEYWORD_TERMS,
  DEFAULT_FORWARDING_FILTER_QUERY
} from './emailFilters';

describe('emailFilters constants test suite', () => {
  it('defines frozen arrays for stores and keywords', () => {
    expect(Array.isArray(SUPPORTED_STORE_DOMAINS)).toBe(true);
    expect(SUPPORTED_STORE_DOMAINS.length).toBeGreaterThan(5);
    expect(Object.isFrozen(SUPPORTED_STORE_DOMAINS)).toBe(true);

    expect(Array.isArray(SHIPPING_KEYWORD_TERMS)).toBe(true);
    expect(SHIPPING_KEYWORD_TERMS.length).toBeGreaterThan(3);
    expect(Object.isFrozen(SHIPPING_KEYWORD_TERMS)).toBe(true);
  });

  it('constructs a valid non-empty Gmail query string', () => {
    expect(typeof DEFAULT_FORWARDING_FILTER_QUERY).toBe('string');
    expect(DEFAULT_FORWARDING_FILTER_QUERY).toContain('subject:');
    expect(DEFAULT_FORWARDING_FILTER_QUERY).toContain('from:');
    expect(DEFAULT_FORWARDING_FILTER_QUERY).toContain('aliexpress.com');
    expect(DEFAULT_FORWARDING_FILTER_QUERY).toContain('amazon.com');
    expect(DEFAULT_FORWARDING_FILTER_QUERY).toContain('shipped');
  });
});

import { describe, it, expect } from 'vitest';
import {
  isShortenedUrl,
  extractCarrierFromShortUrl,
  extractIdentifierFromShortUrl,
  resolveShortUrl,
  SHORT_DOMAINS,
  CARRIER_SHORT_DOMAINS
} from './urlUnshortenerService';

describe('urlUnshortenerService', () => {
  describe('isShortenedUrl', () => {
    it('identifies known short domains', () => {
      expect(isShortenedUrl('https://chtr.co.il/AbCd12')).toBe(true);
      expect(isShortenedUrl('http://slnk.to/pkg-123')).toBe(true);
      expect(isShortenedUrl('https://is.gd/xyz890')).toBe(true);
      expect(isShortenedUrl('https://bit.ly/3xyz789')).toBe(true);
      expect(isShortenedUrl('https://tinyurl.com/abc123')).toBe(true);
      expect(isShortenedUrl('https://t.ly/qwerty')).toBe(true);
    });

    it('returns false for standard non-short URLs or invalid inputs', () => {
      expect(isShortenedUrl('https://www.google.com')).toBe(false);
      expect(isShortenedUrl('https://amazon.com/dp/B08N5WRWNW')).toBe(false);
      expect(isShortenedUrl('')).toBe(false);
      expect(isShortenedUrl(null)).toBe(false);
      expect(isShortenedUrl(undefined)).toBe(false);
    });
  });

  describe('extractCarrierFromShortUrl', () => {
    it('extracts carrier hint from courier specific domains', () => {
      expect(extractCarrierFromShortUrl('https://chtr.co.il/t/12345')).toBe('chita');
      expect(extractCarrierFromShortUrl('https://buzzr.co.il/track/998877')).toBe('buzzr');
      expect(extractCarrierFromShortUrl('https://link.buzzr.co.il/b/123')).toBe('buzzr');
      expect(extractCarrierFromShortUrl('https://epost.co.il/t/EP12345678')).toBe('hfd');
      expect(extractCarrierFromShortUrl('https://boxit.co.il/b/BOX123')).toBe('boxit');
      expect(extractCarrierFromShortUrl('https://bardistribution.co.il/track?track=BAR123')).toBe('bar-distribution');
      expect(extractCarrierFromShortUrl('https://tracking.lionwheel.com/orders/LW123')).toBe('lionwheel');
      expect(extractCarrierFromShortUrl('https://tapuzdelivery.co.il/tracking/TPZ123')).toBe('tapuz');
    });

    it('returns null for generic domains', () => {
      expect(extractCarrierFromShortUrl('https://bit.ly/12345')).toBe(null);
      expect(extractCarrierFromShortUrl('https://is.gd/xyz')).toBe(null);
    });
  });

  describe('extractIdentifierFromShortUrl', () => {
    it('extracts tracking identifier from query parameters', () => {
      expect(extractIdentifierFromShortUrl('https://chtr.co.il/?num=CH10849201')).toBe('CH10849201');
      expect(extractIdentifierFromShortUrl('https://bardistribution.co.il/track?track=BAR1094821')).toBe('BAR1094821');
      expect(extractIdentifierFromShortUrl('https://epost.co.il/tracking?t=HFD90481029')).toBe('HFD90481029');
    });

    it('extracts tracking identifier from path segments', () => {
      expect(extractIdentifierFromShortUrl('https://chtr.co.il/t/CH10849201')).toBe('CH10849201');
      expect(extractIdentifierFromShortUrl('https://boxit.co.il/b/BOX920194')).toBe('BOX920194');
    });
  });

  describe('resolveShortUrl', () => {
    it('resolves safely when given a short URL with sync fallback', async () => {
      const res = await resolveShortUrl('https://chtr.co.il/t/CH10849201');
      expect(res.carrierId).toBe('chita');
      expect(res.trackingNumber).toBe('CH10849201');
    });
  });

  describe('configuration constants', () => {
    it('exports defined SHORT_DOMAINS and CARRIER_SHORT_DOMAINS', () => {
      expect(Array.isArray(SHORT_DOMAINS)).toBe(true);
      expect(SHORT_DOMAINS.length).toBeGreaterThan(5);
      expect(typeof CARRIER_SHORT_DOMAINS).toBe('object');
    });
  });
});

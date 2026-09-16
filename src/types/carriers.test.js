import { describe, it, expect } from 'vitest';
import { CARRIERS, CARRIER_LIST, DETECTION_RULES, GENERIC_RULE_PRIORITY, getCarrier } from './carriers';
import { detectCarrier } from '../utils/carrierDetector';

describe('getCarrier', () => {
  it('returns the requested carrier', () => {
    expect(getCarrier('israel-post')).toBe(CARRIERS['israel-post']);
    expect(getCarrier('dhl').id).toBe('dhl');
  });

  it('falls back to the universal carrier for unknown, empty or missing ids', () => {
    expect(getCarrier('no-such-carrier')).toBe(CARRIERS['other']);
    expect(getCarrier('')).toBe(CARRIERS['other']);
    expect(getCarrier(undefined)).toBe(CARRIERS['other']);
    expect(getCarrier(null)).toBe(CARRIERS['other']);
  });

  it('does not leak prototype properties as carriers', () => {
    expect(getCarrier('constructor')).toBe(CARRIERS['other']);
    expect(getCarrier('toString')).toBe(CARRIERS['other']);
  });
});

describe('carrier detection rule table', () => {
  it('gives every rule a regex, a confidence, and a usable test()', () => {
    for (const carrier of CARRIER_LIST) {
      for (const r of carrier.patterns) {
        expect(r.re).toBeInstanceOf(RegExp);
        expect(['high', 'medium']).toContain(r.confidence);
        expect(typeof r.test).toBe('function');
        expect(r.test(carrier.sample)).toBe(r.re.test(carrier.sample));
      }
    }
  });

  it('matches every carrier sample to a rule of that same carrier', () => {
    for (const carrier of CARRIER_LIST) {
      if (carrier.id === 'other') continue;
      // A carrier may legitimately have no number rules: some couriers are only
      // ever identified by a phrase or a host, because every number shape they
      // use is also somebody else's. Claiming a shape on one observed sample
      // routes other carriers' parcels to them, which is the failure this rule
      // table exists to prevent — so an empty list is a deliberate statement,
      // not a gap. Its `sample` still documents a real number for the corpus.
      if (carrier.patterns.length === 0) continue;
      expect(carrier.patterns.some((r) => r.test(carrier.sample.toUpperCase()))).toBe(true);
    }
  });

  it('keeps a phrase-only carrier out of the number rule table entirely', () => {
    // The corollary of the exemption above: an empty pattern list must actually
    // contribute nothing to detection, so a phrase-only carrier can never win a
    // number it has no claim to.
    const phraseOnly = CARRIER_LIST.filter((c) => c.id !== 'other' && c.patterns.length === 0);
    expect(phraseOnly.length).toBeGreaterThan(0);
    for (const carrier of phraseOnly) {
      expect(DETECTION_RULES.some((r) => r.carrierId === carrier.id)).toBe(false);
      expect(detectCarrier(carrier.sample).carrierId).not.toBe(carrier.id);
    }
  });

  it('orders DETECTION_RULES by ascending priority', () => {
    const priorities = DETECTION_RULES.map((r) => r.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it('defaults unprioritised rules to the generic tier, after every explicit rule', () => {
    const explicit = DETECTION_RULES.filter((r) => r.priority !== GENERIC_RULE_PRIORITY);
    expect(explicit.length).toBeGreaterThan(0);
    for (const r of explicit) expect(r.confidence).toBe('high');
    for (const r of DETECTION_RULES.filter((x) => x.priority === GENERIC_RULE_PRIORITY)) {
      expect(r.confidence).toBe('medium');
    }
  });

  it('excludes the catch-all carrier from detection', () => {
    expect(DETECTION_RULES.some((r) => r.carrier.id === 'other')).toBe(false);
  });

  it('only names checksums the detector knows about', async () => {
    const { CHECKSUM_VALIDATORS } = await import('../utils/carrierDetector');
    for (const r of DETECTION_RULES) {
      if (r.checksum) expect(Object.keys(CHECKSUM_VALIDATORS)).toContain(r.checksum);
    }
  });
});

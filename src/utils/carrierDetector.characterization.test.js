/**
 * Characterization test for carrier detection.
 *
 * `__fixtures__/carrierDetection.snapshot.json` was generated from the
 * pre-refactor branch-based `detectCarrier` and is byte-identical for the
 * table-driven implementation. Carrier detection decides where a real user's
 * package is routed, so ANY diff here is a behaviour change: investigate it,
 * don't regenerate the fixture to make the test pass.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { detectCarrier } from './carrierDetector';
import { DETECTION_CORPUS } from './carrierDetectorCorpus';

const SNAPSHOT_URL = new URL('./__fixtures__/carrierDetection.snapshot.json', import.meta.url);

/** Normalised detection result: id, confidence, and checksum outcome (null when absent). */
function characterize(trackingNumber) {
  const result = detectCarrier(trackingNumber);
  return {
    carrierId: result.carrierId,
    confidence: result.confidence,
    isValidChecksum: Object.prototype.hasOwnProperty.call(result, 'isValidChecksum')
      ? result.isValidChecksum
      : null
  };
}

describe('detectCarrier characterization snapshot', () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_URL, 'utf8'));

  it('covers the whole corpus with no drift in keys', () => {
    expect(DETECTION_CORPUS.length).toBeGreaterThan(700);
    expect(Object.keys(snapshot).sort()).toEqual([...DETECTION_CORPUS].sort());
  });

  it('produces byte-identical carrier id, confidence and checksum for every entry', () => {
    const actual = {};
    for (const trackingNumber of DETECTION_CORPUS) {
      actual[trackingNumber] = characterize(trackingNumber);
    }
    expect(actual).toEqual(snapshot);
  });

  it('preserves cross-carrier priority: Aramex 11 digits beats FedEx 12 digits', () => {
    expect(detectCarrier('12345678901').carrierId).toBe('aramex');
    expect(detectCarrier('123456789012').carrierId).toBe('fedex');
  });

  it('preserves per-pattern checksum selection', () => {
    // UPU S10 mod-11 for IL / GB / US / CN registered mail
    expect(detectCarrier('RS948219483IL').isValidChecksum).toBe(true);
    expect(detectCarrier('RS948219481IL').isValidChecksum).toBe(false);
    expect(detectCarrier('RN123456789GB')).toHaveProperty('isValidChecksum');
    // USPS IMpb uses weighted mod-10, not mod-11
    expect(detectCarrier('9400100000000000000000')).toHaveProperty('isValidChecksum');
    // Formats with no verifiable check digit still report a passing checksum
    expect(detectCarrier('LP00582910482CN').isValidChecksum).toBe(true);
    // Carriers without a checksum rule expose no checksum field at all
    expect(detectCarrier('CH10849201')).not.toHaveProperty('isValidChecksum');
  });

  it('preserves confidence tiers', () => {
    expect(detectCarrier('HFD90481029').confidence).toBe('high');
    expect(detectCarrier('512345678').confidence).toBe('medium');
    expect(detectCarrier('NON_EXISTENT').confidence).toBe('none');
  });
});

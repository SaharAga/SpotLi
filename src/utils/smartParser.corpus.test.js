import { describe, it, expect } from 'vitest';
import { parseSmartText } from './smartParser.js';
import { SMS_CORPUS } from '../tests/fixtures/smsCorpus.js';

describe('smartParser - SMS Corpus Precision Characterization Suite', () => {
  it('contains at least 35 diverse courier and merchant SMS fixtures', () => {
    expect(SMS_CORPUS.length).toBeGreaterThanOrEqual(35);
  });

  SMS_CORPUS.forEach((sample) => {
    it(`correctly parses [${sample.id}]: "${sample.rawText.slice(0, 40)}..."`, () => {
      const parsed = parseSmartText(sample.rawText);

      // Verify tracking number extraction
      if (sample.expected.trackingNumber !== undefined) {
        expect(parsed.trackingNumber).toBe(sample.expected.trackingNumber);
      }

      // Verify carrier detection
      if (sample.expected.carrier !== undefined) {
        expect(parsed.carrier).toBe(sample.expected.carrier);
      }

      // Verify store detection
      if (sample.expected.store !== undefined) {
        expect(parsed.store).toBe(sample.expected.store);
      }

      // Verify pickup location
      if (sample.expected.pickupLocation !== undefined) {
        expect(parsed.pickupLocation).toContain(sample.expected.pickupLocation);
      }

      // Verify locker PIN
      if (sample.expected.lockerPin !== undefined) {
        expect(parsed.lockerPin).toBe(sample.expected.lockerPin);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import { parseSmartText } from './smartParser.js';
import { SMS_CORPUS } from '../tests/fixtures/smsCorpus.js';
import { generateCorpus } from '../../scripts/generate-synthetic-training-data.mjs';

describe('Autonomous Synthetic Benchmark & Carrier Detection Suite', () => {
  const syntheticCorpus = generateCorpus({ count: 64, includeNegatives: true });

  it('generates at least 60 verified ground-truth samples across domestic and global couriers', () => {
    expect(syntheticCorpus.length).toBeGreaterThanOrEqual(60);
  });

  describe('Negative Controls (Zero False Positives)', () => {
    const negativeSamples = syntheticCorpus.filter((s) => !s.expected.trackingNumber);

    it('contains at least 5 distinct negative control vectors (OTP, bank, loan spam, chat)', () => {
      expect(negativeSamples.length).toBeGreaterThanOrEqual(5);
    });

    negativeSamples.forEach((sample) => {
      it(`does not hallucinate a tracking number for [${sample.id}]`, () => {
        const parsed = parseSmartText(sample.rawText);
        expect(parsed.trackingNumber).toBe('');
      });
    });
  });

  describe('Positive Carrier Extraction Accuracy', () => {
    const positiveSamples = syntheticCorpus.filter((s) => Boolean(s.expected.trackingNumber));

    positiveSamples.forEach((sample) => {
      it(`accurately extracts [${sample.id}]: tracking=${sample.expected.trackingNumber}, carrier=${sample.expected.carrier}`, () => {
        const parsed = parseSmartText(sample.rawText);

        // 1. Verbatim tracking number extraction
        expect(parsed.trackingNumber).toBe(sample.expected.trackingNumber);

        // 2. Carrier identification
        expect(parsed.carrier).toBe(sample.expected.carrier);

        // 3. Locker PIN extraction if present in ground truth
        if (sample.expected.lockerPin) {
          expect(parsed.lockerPin).toBe(sample.expected.lockerPin);
        }

        // 4. Pickup location if present in ground truth
        if (sample.expected.pickupLocation) {
          expect(parsed.pickupLocation).toContain(sample.expected.pickupLocation);
        }

        // 5. Redirected locker flag
        if (sample.expected.isRedirected) {
          expect(parsed.isRedirected).toBe(true);
        }
      });
    });
  });

  describe('Benchmark Scorecard Invariants', () => {
    it('achieves >= 98% tracking precision and 0% false positives across combined corpus', () => {
      const allSamples = [...SMS_CORPUS, ...syntheticCorpus];
      let truePositives = 0;
      let falsePositives = 0;
      let totalPositives = 0;
      let falseNegativeCount = 0;

      const startTime = performance.now();

      for (const sample of allSamples) {
        const exp = sample.expected || {};
        const parsed = parseSmartText(sample.rawText);

        if (exp.trackingNumber) {
          totalPositives++;
          if (parsed.trackingNumber === exp.trackingNumber) {
            truePositives++;
          } else if (parsed.trackingNumber) {
            falsePositives++;
          } else {
            falseNegativeCount++;
          }
        } else {
          // Negative control
          if (parsed.trackingNumber) {
            falsePositives++;
          }
        }
      }

      const totalDuration = performance.now() - startTime;
      const avgLatencyMs = totalDuration / allSamples.length;

      const precision = (truePositives / (truePositives + falsePositives)) * 100;
      const recall = (truePositives / totalPositives) * 100;

      // Latency budget: < 2ms per parse
      expect(avgLatencyMs).toBeLessThan(2.0);

      // Quality invariants
      expect(precision).toBeGreaterThanOrEqual(98.0);
      expect(recall).toBeGreaterThanOrEqual(95.0);
      expect(falsePositives).toBe(0);
    });
  });
});

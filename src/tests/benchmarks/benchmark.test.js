import { describe, it, expect } from 'vitest';
import devCorpus from './dev/benchmarkCorpus.json';
import valCorpus from './validation/frozenValidationCorpus.json';
import { extractAndScoreCandidates, classifyConfidenceTier } from '../../utils/candidateScorer.js';

describe('Candidate Detection & Grounding Benchmark Suite', () => {
  describe('Development Partition (dev/)', () => {
    it('evaluates all dev benchmark cases with zero false positive packages', () => {
      for (const sample of devCorpus) {
        const candidates = extractAndScoreCandidates(sample.rawText);
        const top = candidates.length > 0 ? candidates[0] : null;
        const score = top ? top.score : 0;
        const tier = top ? classifyConfidenceTier(score, top) : 'none';

        if (sample.expectedTracking === null) {
          // Negative sample: should produce 'none' or 'uncertain', NEVER 'verified'
          expect(tier).not.toBe('verified');
          if (top) {
            expect(top.score).toBeLessThan(0.65);
          }
        } else {
          // Positive sample
          expect(top).not.toBeNull();
          expect(top.value).toBe(sample.expectedTracking);
          expect(top.carrierCandidates).toContain(sample.expectedCarrier);
          expect(top.score).toBeGreaterThanOrEqual(0.65);
        }
      }
    });
  });

  describe('Frozen Validation Partition (validation/)', () => {
    it('achieves 100% precision on frozen validation benchmarks', () => {
      for (const sample of valCorpus) {
        const candidates = extractAndScoreCandidates(sample.rawText);
        const top = candidates.length > 0 ? candidates[0] : null;
        const score = top ? top.score : 0;
        const tier = top ? classifyConfidenceTier(score, top) : 'none';

        if (sample.expectedTracking === null) {
          expect(tier).not.toBe('verified');
          if (top) {
            expect(top.score).toBeLessThan(0.65);
          }
        } else {
          expect(top).not.toBeNull();
          expect(top.value).toBe(sample.expectedTracking);
          expect(top.carrierCandidates).toContain(sample.expectedCarrier);
        }
      }
    });
  });
});

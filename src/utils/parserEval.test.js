import { describe, it, expect } from 'vitest';
import { parseSmartText } from './smartParser.js';
import { evaluateCorpus, scoreCase, summarize } from './parserEval.js';
import { PARSER_EVAL_CORPUS, POSITIVE_CASES, NEGATIVE_CASES } from '../tests/fixtures/parserEvalCorpus.js';

/**
 * Accuracy thresholds, deliberately set BELOW current measured accuracy.
 *
 * These are a ratchet against regression, not a target. When accuracy improves,
 * raise them; never lower one to make a change pass. `npm run eval:parser`
 * prints the current numbers and the per-case failures behind them.
 */
const THRESHOLDS = {
  precision: 0.94,
  recall: 0.97,
  specificity: 0.93,
  carrierAccuracy: 0.95,
  // Delivery stage and merchant were not scored at all until a real Seestarz
  // SMS came back with the right tracking number, the wrong stage and no
  // merchant — and the harness called it green. These floors are set below the
  // measured 81% / 75%, and the seven stage misses behind that 81% are left
  // failing on purpose: they span five carriers, so they are a gap in the
  // parser, not a Tapuz quirk, and fixing them by editing regexes until this
  // held-out corpus goes quiet is the one thing its header forbids.
  deliveryStatusAccuracy: 0.78,
  storeAccuracy: 0.70
};

describe('parserEval — scoring primitives', () => {
  it('scores an exact match as correct', () => {
    const sample = { id: 'a', group: 'g', expected: { trackingNumber: 'RS123456789IL', carrier: 'israel-post' } };
    const r = scoreCase(sample, { trackingNumber: 'RS123456789IL', carrier: 'israel-post' });
    expect(r.outcome).toBe('correct');
    expect(r.carrierCorrect).toBe(true);
  });

  it('ignores case and separators when comparing tracking numbers', () => {
    const sample = { id: 'a', group: 'g', expected: { trackingNumber: 'RS123456789IL', carrier: 'israel-post' } };
    expect(scoreCase(sample, { trackingNumber: 'rs-123 456 789-il', carrier: 'israel-post' }).outcome).toBe('correct');
  });

  it('does not credit a correct carrier attached to the wrong number', () => {
    const sample = { id: 'a', group: 'g', expected: { trackingNumber: 'RS123456789IL', carrier: 'israel-post' } };
    const r = scoreCase(sample, { trackingNumber: '0000', carrier: 'israel-post' });
    expect(r.outcome).toBe('wrong');
    expect(r.carrierCorrect).toBeNull();
  });

  it('treats any extraction on a negative case as a false positive', () => {
    const sample = { id: 'n', group: 'g', expected: { trackingNumber: null, carrier: null } };
    expect(scoreCase(sample, { trackingNumber: '482019374' }).outcome).toBe('wrong');
    expect(scoreCase(sample, { trackingNumber: '' }).outcome).toBe('correct');
  });

  it('distinguishes a miss from a wrong answer', () => {
    const sample = { id: 'a', group: 'g', expected: { trackingNumber: 'RS123456789IL', carrier: 'israel-post' } };
    expect(scoreCase(sample, { trackingNumber: '' }).outcome).toBe('missed');
    expect(scoreCase(sample, { trackingNumber: 'XX999999999XX' }).outcome).toBe('wrong');
  });

  it('counts false positives against precision', () => {
    const s = summarize([
      { isPositive: true, outcome: 'correct', carrierCorrect: true, group: 'g' },
      { isPositive: false, outcome: 'wrong', carrierCorrect: null, group: 'g' }
    ]);
    expect(s.precision).toBe(0.5);
    expect(s.recall).toBe(1);
  });
});

describe('parserEval — held-out corpus integrity', () => {
  it('has both positive and negative cases, with negatives well represented', () => {
    expect(POSITIVE_CASES.length).toBeGreaterThanOrEqual(25);
    // Precision failures only surface on negatives; a corpus without them
    // reports an accuracy number that cannot go down.
    expect(NEGATIVE_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it('has unique, stable case ids', () => {
    const ids = PARSER_EVAL_CORPUS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains no case text copied from the tuning corpus', async () => {
    const { SMS_CORPUS } = await import('../tests/fixtures/smsCorpus.js');
    const tuningText = new Set(SMS_CORPUS.map((s) => s.rawText.trim()));
    const overlap = PARSER_EVAL_CORPUS.filter((c) => tuningText.has(c.rawText.trim()));
    expect(overlap.map((c) => c.id)).toEqual([]);
  });
});

describe('parserEval — parser accuracy ratchet', () => {
  const report = evaluateCorpus(PARSER_EVAL_CORPUS, parseSmartText);

  for (const [metric, floor] of Object.entries(THRESHOLDS)) {
    it(`keeps ${metric} at or above ${(floor * 100).toFixed(0)}%`, () => {
      expect(
        report.summary[metric],
        `${metric} dropped to ${(report.summary[metric] * 100).toFixed(1)}%. ` +
        'Run `npm run eval:parser` to see which cases broke.'
      ).toBeGreaterThanOrEqual(floor);
    });
  }

  it('backs the stage and merchant rates with enough cases to mean something', () => {
    // An accuracy over zero scored cases is 0, and over three it is noise.
    // Without this, dropping the expectations would satisfy every threshold
    // above — the same blind spot, relocated.
    expect(report.summary.deliveryStatusScored).toBeGreaterThanOrEqual(30);
    expect(report.summary.storeScored).toBeGreaterThanOrEqual(4);
  });

  it('counts a right number with a wrong stage as a failure', () => {
    // `failures` fed the report that said this corpus was clean. While it
    // filtered on tracking alone, a stage regression could never appear in it.
    const stageMisses = report.results.filter((r) => r.deliveryStatusCorrect === false);
    for (const miss of stageMisses) {
      expect(report.failures.map((f) => f.id)).toContain(miss.id);
    }
  });

  it('never picks the wrong number when a real shipment is present', () => {
    // Silently saving the wrong ID is the worst failure mode: it looks like
    // success and the package never updates. Missing is preferable.
    const wrong = report.results.filter((r) => r.isPositive && r.outcome === 'wrong');
    expect(wrong.map((r) => `${r.id}: expected ${r.expectedTracking}, got ${r.actualTracking}`)).toEqual([]);
  });
});

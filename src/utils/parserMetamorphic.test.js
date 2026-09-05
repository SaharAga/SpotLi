import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSmartText } from './smartParser.js';
import { TRANSFORMS, applyTransform, applyAll, maskIdentifiers } from './parserMetamorphic.js';
import { PARSER_EVAL_CORPUS, POSITIVE_CASES, NEGATIVE_CASES } from '../tests/fixtures/parserEvalCorpus.js';

/**
 * Robustness floor. Every transform is meaning-preserving by construction, so
 * the honest target is 100% — but a floor below the current figure lets a
 * genuinely hard transform be added and worked down rather than blocking the
 * suite. Raise it as robustness improves; never lower it to make a change pass.
 */
const ROBUSTNESS_FLOOR = 0.97;

const normalize = (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[\s\-_.]/g, '') : '');

describe('parserMetamorphic — the transforms themselves', () => {
  it('leaves identifiers untouched for outside-ids transforms', () => {
    // The property the whole suite rests on: if a transform can rewrite an
    // identifier, a failure means the test is wrong, not the parser.
    const text = "צ'יטה: משלוח RS-948-219-481-IL בדרך";

    for (const transform of TRANSFORMS.filter((t) => t.scope === 'outside-ids')) {
      expect(applyTransform(transform, text), `${transform.name} altered an identifier`)
        .toContain('RS-948-219-481-IL');
    }
  });

  it('actually changes the text it is given', () => {
    // A transform that silently no-ops would report perfect robustness while
    // testing nothing at all.
    // Deliberately contains every character each transform keys on: an
    // apostrophe, a double quote, a double space, a newline, a spaced hyphen,
    // and a www URL. A transform that no-ops here is broken.
    const sample = 'צ\'יטה "משלוח":  הזמנה 12345678 יצאה למשלוח - https://www.chita.co.il/t/CH10849201. '
      + 'למעקב https://chtr.co.il/t/CH10849201.\nתודה!';
    const inert = TRANSFORMS.filter((t) => applyTransform(t, sample) === sample);
    expect(inert.map((t) => t.name)).toEqual([]);
  });

  it('masks identifiers while still transforming the prose around them', () => {
    const out = maskIdentifiers("צ'יטה RS123456789IL צ'יטה", (chunk) => chunk.replace(/'/g, '’'));
    expect(out).toContain('RS123456789IL');
    expect(out).toContain('צ’יטה');
    expect(out).not.toContain("'");
  });

  it('gives every transform a unique name and a stated real-world cause', () => {
    const names = TRANSFORMS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TRANSFORMS) {
      expect(t.models, `${t.name} must say what it imitates`).toBeTruthy();
    }
  });
});

describe('parserMetamorphic — invariance on real shipments', () => {
  // Only cases the parser currently gets right can be held invariant; a case
  // it already fails says nothing about robustness.
  const baseline = POSITIVE_CASES
    .map((sample) => ({ sample, parsed: parseSmartText(sample.rawText) }))
    .filter(({ sample, parsed }) => normalize(parsed.trackingNumber) === normalize(sample.expected.trackingNumber));

  it('has a baseline to test against', () => {
    expect(baseline.length).toBeGreaterThanOrEqual(25);
  });

  for (const transform of TRANSFORMS) {
    it(`survives ${transform.name} (${transform.models})`, () => {
      const broken = [];

      for (const { sample, parsed } of baseline) {
        const mutated = parseSmartText(applyTransform(transform, sample.rawText));
        if (normalize(mutated.trackingNumber) !== normalize(parsed.trackingNumber)) {
          broken.push(`${sample.id}: ${parsed.trackingNumber || '(none)'} → ${mutated.trackingNumber || '(none)'}`);
        }
      }

      expect(broken, `${transform.name} broke ${broken.length}/${baseline.length} cases`).toEqual([]);
    });
  }
});

describe('parserMetamorphic — negatives stay negative under noise', () => {
  const baseline = NEGATIVE_CASES.filter((sample) => !parseSmartText(sample.rawText).trackingNumber);

  it('has a baseline of correctly-rejected negatives', () => {
    expect(baseline.length).toBeGreaterThanOrEqual(20);
  });

  it('never invents a tracking number that noise alone created', () => {
    const invented = [];

    for (const transform of TRANSFORMS) {
      for (const sample of baseline) {
        const mutated = parseSmartText(applyTransform(transform, sample.rawText));
        if (mutated.trackingNumber) {
          invented.push(`${transform.name} + ${sample.id} → ${mutated.trackingNumber}`);
        }
      }
    }

    expect(invented).toEqual([]);
  });
});

describe('parserMetamorphic — composed transforms', () => {
  it('survives several transforms applied at once', () => {
    const baseline = POSITIVE_CASES
      .map((sample) => ({ sample, parsed: parseSmartText(sample.rawText) }))
      .filter(({ sample, parsed }) => normalize(parsed.trackingNumber) === normalize(sample.expected.trackingNumber));

    fc.assert(
      fc.property(
        fc.constantFrom(...baseline),
        fc.uniqueArray(fc.constantFrom(...TRANSFORMS), { minLength: 2, maxLength: 4 }),
        ({ sample, parsed }, transforms) => {
          const mutated = parseSmartText(applyAll(transforms, sample.rawText));
          expect(
            normalize(mutated.trackingNumber),
            `${sample.id} broke under [${transforms.map((t) => t.name).join(', ')}]`
          ).toBe(normalize(parsed.trackingNumber));
        }
      ),
      { numRuns: 400 }
    );
  });
});

describe('parserMetamorphic — coverage', () => {
  it('multiplies the corpus into a meaningful number of cases', () => {
    const cases = PARSER_EVAL_CORPUS.length * TRANSFORMS.length;
    expect(cases).toBeGreaterThanOrEqual(1000);
  });

  it('keeps overall robustness above the floor', () => {
    let checked = 0;
    let held = 0;

    for (const sample of POSITIVE_CASES) {
      const parsed = parseSmartText(sample.rawText);
      if (normalize(parsed.trackingNumber) !== normalize(sample.expected.trackingNumber)) continue;

      for (const transform of TRANSFORMS) {
        checked += 1;
        const mutated = parseSmartText(applyTransform(transform, sample.rawText));
        if (normalize(mutated.trackingNumber) === normalize(parsed.trackingNumber)) held += 1;
      }
    }

    const robustness = checked === 0 ? 0 : held / checked;
    expect(robustness, `robustness ${(robustness * 100).toFixed(1)}% (${held}/${checked})`)
      .toBeGreaterThanOrEqual(ROBUSTNESS_FLOOR);
  });
});

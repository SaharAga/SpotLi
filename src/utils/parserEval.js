/**
 * Accuracy harness for the Smart Import parser.
 *
 * Scores `parseSmartText` against the held-out corpus in
 * `tests/fixtures/parserEvalCorpus.js` and reports precision / recall /
 * calibration rather than pass/fail. Pure functions only — no I/O — so the
 * CLI (`scripts/eval_parser.mjs`) and the regression test can share them.
 *
 * Why precision and recall are reported separately: the two failure modes have
 * very different costs. A false negative makes the user type the number in
 * themselves (annoying). A false positive silently saves a package that will
 * never update (a bug they may not notice for days). Any change that trades
 * precision for recall should be a deliberate, visible decision.
 */

/**
 * The three outcomes a single case can have.
 * - `correct`      positive case, right ID extracted / negative case, nothing extracted
 * - `wrong`        an ID was extracted, but not the expected one (or any, on a negative)
 * - `missed`       positive case where nothing at all was extracted
 * @typedef {'correct' | 'wrong' | 'missed'} CaseOutcome
 */

/**
 * Scores one corpus case against a parser result.
 *
 * Comparison is case- and separator-insensitive on the tracking number, since
 * `RS 7361 0294 1 IL` and `rs736102941il` are the same shipment. Carrier is
 * only scored when the tracking number was right — a carrier label attached to
 * the wrong ID is not a partial success.
 *
 * @param {object} sample corpus entry
 * @param {object} parsed result of parseSmartText(sample.rawText)
 * @returns {{ id: string, group: string, outcome: CaseOutcome, expectedTracking: string|null,
 *             actualTracking: string, carrierCorrect: boolean|null, status: string|undefined,
 *             isPositive: boolean, note: string|undefined }}
 */
export function scoreCase(sample, parsed) {
  const normalize = (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[\s\-_.]/g, '') : '');

  const expected = sample.expected.trackingNumber;
  const actual = parsed?.trackingNumber || '';
  const isPositive = expected !== null;

  let outcome;
  let carrierCorrect = null;

  if (isPositive) {
    if (!actual) {
      outcome = 'missed';
    } else if (normalize(actual) === normalize(expected)) {
      outcome = 'correct';
      carrierCorrect = parsed.carrier === sample.expected.carrier;
    } else {
      outcome = 'wrong';
    }
  } else {
    // Negative case: extracting anything at all is a false positive.
    outcome = actual ? 'wrong' : 'correct';
  }

  // Scored only where the case declares an expectation, so the 77 cases written
  // before these fields existed stay valid rather than counting as failures.
  //
  // This is the hole a real Seestarz SMS fell through. The harness read only
  // `trackingNumber` and `carrier`; it found 48094292 correctly and reported
  // the case green, while the parser called a delivered package in_transit and
  // missed a merchant the message named outright. A miss the metric cannot see
  // is a miss the metric will keep letting through — the corpus even contains
  // "שליח של Seestarz online" already, and scored nothing about it.
  const deliveryStatusCorrect = typeof sample.expected.deliveryStatus === 'string'
    ? parsed?.status === sample.expected.deliveryStatus
    : null;

  const expectedStore = sample.expected.store;
  const storeCorrect = typeof expectedStore === 'string'
    ? (parsed?.store || '').trim().toLowerCase() === expectedStore.trim().toLowerCase()
    : null;

  return {
    id: sample.id,
    group: sample.group,
    outcome,
    expectedTracking: expected,
    actualTracking: actual,
    carrierCorrect,
    status: parsed?.candidateStatus,
    deliveryStatusCorrect,
    expectedDeliveryStatus: sample.expected.deliveryStatus ?? null,
    actualDeliveryStatus: parsed?.status ?? null,
    storeCorrect,
    expectedStore: expectedStore ?? null,
    actualStore: parsed?.store ?? null,
    isPositive,
    note: sample.note
  };
}

/**
 * Aggregates per-case results into the headline metrics.
 *
 * precision = correct extractions / all extractions (how often an answer is right)
 * recall    = correct extractions / all real shipments (how often we find one)
 *
 * @param {ReturnType<typeof scoreCase>[]} results
 * @returns {object}
 */
export function summarize(results) {
  const positives = results.filter((r) => r.isPositive);
  const negatives = results.filter((r) => !r.isPositive);

  const truePositives = positives.filter((r) => r.outcome === 'correct').length;
  const wrongOnPositives = positives.filter((r) => r.outcome === 'wrong').length;
  const missed = positives.filter((r) => r.outcome === 'missed').length;
  const falsePositives = negatives.filter((r) => r.outcome === 'wrong').length;
  const trueNegatives = negatives.filter((r) => r.outcome === 'correct').length;

  // Every extraction the parser made: right ones, wrong ones on real shipments,
  // and anything at all it pulled out of a message with no shipment.
  const totalExtractions = truePositives + wrongOnPositives + falsePositives;

  const precision = totalExtractions === 0 ? 0 : truePositives / totalExtractions;
  const recall = positives.length === 0 ? 0 : truePositives / positives.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const carrierScored = positives.filter((r) => r.carrierCorrect !== null);
  const carrierAccuracy = carrierScored.length === 0
    ? 0
    : carrierScored.filter((r) => r.carrierCorrect).length / carrierScored.length;

  // The counts are reported alongside the rates on purpose: an accuracy over
  // zero scored cases is 0, and an accuracy over three is noise. A threshold on
  // a rate nothing backs is the same blind spot in a new place.
  const deliveryStatusScored = results.filter((r) => r.deliveryStatusCorrect !== null);
  const deliveryStatusAccuracy = deliveryStatusScored.length === 0
    ? 0
    : deliveryStatusScored.filter((r) => r.deliveryStatusCorrect).length / deliveryStatusScored.length;

  const storeScored = results.filter((r) => r.storeCorrect !== null);
  const storeAccuracy = storeScored.length === 0
    ? 0
    : storeScored.filter((r) => r.storeCorrect).length / storeScored.length;

  return {
    total: results.length,
    positives: positives.length,
    negatives: negatives.length,
    truePositives,
    wrongOnPositives,
    missed,
    falsePositives,
    trueNegatives,
    precision,
    recall,
    f1,
    carrierAccuracy,
    deliveryStatusScored: deliveryStatusScored.length,
    deliveryStatusAccuracy,
    storeScored: storeScored.length,
    storeAccuracy,
    // Share of negatives correctly left alone — the metric the tuning corpus
    // cannot report at all, because it contains no negatives.
    specificity: negatives.length === 0 ? 0 : trueNegatives / negatives.length
  };
}

/**
 * Breaks results down by corpus group, so a regression can be traced to one
 * carrier family or one class of negative rather than just moving the total.
 *
 * @param {ReturnType<typeof scoreCase>[]} results
 * @returns {Array<{ group: string, total: number, correct: number, accuracy: number }>}
 */
export function byGroup(results) {
  const groups = new Map();

  for (const r of results) {
    if (!groups.has(r.group)) groups.set(r.group, { group: r.group, total: 0, correct: 0 });
    const g = groups.get(r.group);
    g.total += 1;
    if (r.outcome === 'correct') g.correct += 1;
  }

  return Array.from(groups.values())
    .map((g) => ({ ...g, accuracy: g.total === 0 ? 0 : g.correct / g.total }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Calibration table: for each confidence tier the parser reports, how often was
 * it actually right?
 *
 * This is the check on whether `candidateStatus` means anything. The UI gates
 * unattended auto-fill on `verified`, so if `verified` is not near-perfect here,
 * users are being silently handed wrong data — and if `uncertain` is highly
 * accurate, the parser is asking for confirmation it doesn't need.
 *
 * @param {ReturnType<typeof scoreCase>[]} results
 * @returns {Array<{ status: string, n: number, correct: number, accuracy: number }>}
 */
export function calibration(results) {
  const tiers = new Map();

  for (const r of results) {
    // Only cases where the parser committed to an answer carry a meaningful tier.
    if (!r.actualTracking) continue;
    const status = r.status || 'unknown';
    if (!tiers.has(status)) tiers.set(status, { status, n: 0, correct: 0 });
    const t = tiers.get(status);
    t.n += 1;
    if (r.outcome === 'correct') t.correct += 1;
  }

  const order = ['verified', 'probable', 'uncertain', 'none', 'unknown'];
  return Array.from(tiers.values())
    .map((t) => ({ ...t, accuracy: t.n === 0 ? 0 : t.correct / t.n }))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

/**
 * Runs the whole corpus through a parser and returns everything the report needs.
 *
 * @param {Array<object>} corpus
 * @param {(text: string) => object} parseFn
 * @returns {{ results: object[], summary: object, groups: object[], calibration: object[], failures: object[] }}
 */
export function evaluateCorpus(corpus, parseFn) {
  const results = corpus.map((sample) => scoreCase(sample, parseFn(sample.rawText)));

  return {
    results,
    summary: summarize(results),
    groups: byGroup(results),
    calibration: calibration(results),
    // A case with the right number but the wrong stage is a failure. Filtering
    // on `outcome` alone is what made the reported miss look like a pass.
    failures: results.filter((r) => (
      r.outcome !== 'correct'
      || r.deliveryStatusCorrect === false
      || r.storeCorrect === false
    ))
  };
}

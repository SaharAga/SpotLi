#!/usr/bin/env node
/**
 * Smart Import parser accuracy report.
 *
 *   npm run eval:parser              print the report
 *   npm run eval:parser -- --json    machine-readable, for diffing runs
 *   npm run eval:parser -- --save    overwrite the committed baseline
 *
 * Scores the held-out corpus (tests/fixtures/parserEvalCorpus.js) and compares
 * against `.parser-eval-baseline.json` so a change's effect on accuracy is a
 * number, not a hunch. Never fails the build — `parserEval.regression.test.js`
 * is what guards CI; this is the tool you run while iterating.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const BASELINE_PATH = join(repoRoot, process.argv.includes('--real')
  ? '.parser-eval-baseline-real.json'
  : '.parser-eval-baseline.json');

// The app sources rely on Vite resolution (extensionless imports, JSON imports),
// so they are loaded through a throwaway Vite server rather than plain node ESM.
const { createServer } = await import('vite');
const vite = await createServer({
  root: repoRoot,
  logLevel: 'error',
  configFile: false,
  server: { middlewareMode: true, watch: null },
  appType: 'custom'
});

const { PARSER_EVAL_CORPUS } = await vite.ssrLoadModule('/src/tests/fixtures/parserEvalCorpus.js');
const { parseSmartText } = await vite.ssrLoadModule('/src/utils/smartParser.js');
const { evaluateCorpus } = await vite.ssrLoadModule('/src/utils/parserEval.js');
await vite.close();

const args = new Set(process.argv.slice(2));

// `--real` scores the corpus pulled from actual user corrections
// (npm run corpus:pull) instead of the synthetic one. That file is gitignored,
// so this mode only works on a machine that has pulled it.
const REAL_CORPUS_PATH = join(repoRoot, '.parser-corpus-real.json');
let corpus = PARSER_EVAL_CORPUS;

if (args.has('--real')) {
  if (!existsSync(REAL_CORPUS_PATH)) {
    console.error('\n  No real corpus found. Pull one first:\n');
    console.error('    FIREBASE_SERVICE_ACCOUNT_JSON="$(cat serviceAccount.json)" npm run corpus:pull\n');
    process.exit(1);
  }
  const real = JSON.parse(readFileSync(REAL_CORPUS_PATH, 'utf8'));
  if (!real.cases?.length) {
    console.error('\n  The pulled corpus is empty — no labeled corrections yet.\n');
    process.exit(1);
  }
  corpus = real.cases;
  console.log(`\n  Using REAL corpus: ${real.cases.length} cases pulled ${real.pulledAt?.slice(0, 10)}`);
}

const report = evaluateCorpus(corpus, parseSmartText);
const { summary, groups, calibration, failures } = report;

if (args.has('--json')) {
  console.log(JSON.stringify({ summary, groups, calibration }, null, 2));
  process.exit(0);
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const bar = (n, width = 24) => {
  const filled = Math.round(n * width);
  return '█'.repeat(filled) + '·'.repeat(width - filled);
};

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : null;

/** Renders the change against the saved baseline, if there is one. */
const delta = (key) => {
  if (!baseline?.summary || typeof baseline.summary[key] !== 'number') return '';
  const d = summary[key] - baseline.summary[key];
  if (Math.abs(d) < 0.0005) return '  (=)';
  return `  (${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp)`;
};

console.log('\n  Smart Import parser — accuracy on held-out corpus');
console.log(`  ${summary.total} cases · ${summary.positives} real shipments · ${summary.negatives} negatives\n`);

for (const [label, key] of [
  ['Precision  ', 'precision'],
  ['Recall     ', 'recall'],
  ['F1         ', 'f1'],
  ['Specificity', 'specificity'],
  ['Carrier id ', 'carrierAccuracy']
]) {
  console.log(`  ${label} ${bar(summary[key])} ${pct(summary[key]).padStart(6)}${delta(key)}`);
}

console.log('\n  Errors');
console.log(`    ${String(summary.missed).padStart(3)}  missed        (real shipment, nothing extracted)`);
console.log(`    ${String(summary.wrongOnPositives).padStart(3)}  wrong id      (real shipment, wrong number picked)`);
console.log(`    ${String(summary.falsePositives).padStart(3)}  false positive (no shipment, invented one)`);

console.log('\n  By group (worst first)');
for (const g of groups) {
  console.log(`    ${bar(g.accuracy, 14)} ${pct(g.accuracy).padStart(6)}  ${g.group} (${g.correct}/${g.total})`);
}

console.log('\n  Calibration — does candidateStatus mean anything?');
if (calibration.length === 0) {
  console.log('    (no committed answers)');
} else {
  for (const t of calibration) {
    const flag = t.status === 'verified' && t.accuracy < 0.95 ? '  ⚠ verified should be ≥95%' : '';
    console.log(`    ${t.status.padEnd(10)} ${pct(t.accuracy).padStart(6)}  (${t.correct}/${t.n})${flag}`);
  }
}

if (failures.length > 0) {
  console.log(`\n  Failures (${failures.length})`);
  for (const f of failures) {
    const detail = f.outcome === 'missed'
      ? `expected ${f.expectedTracking}, got nothing`
      : f.isPositive
        ? `expected ${f.expectedTracking}, got ${f.actualTracking}`
        : `expected nothing, got ${f.actualTracking} [${f.status}]`;
    console.log(`    ${f.outcome.padEnd(7)} ${f.id}`);
    console.log(`            ${detail}`);
    if (f.note) console.log(`            note: ${f.note}`);
  }
}

if (args.has('--save')) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ savedAt: new Date().toISOString(), summary, groups, calibration }, null, 2)}\n`);
  console.log(`\n  Baseline written to ${BASELINE_PATH.replace(repoRoot + '/', '')}`);
} else if (baseline) {
  console.log(`\n  Compared against baseline from ${baseline.savedAt?.slice(0, 10) ?? 'unknown date'}. Re-save with --save.`);
} else {
  console.log('\n  No baseline yet. Save one with: npm run eval:parser -- --save');
}

console.log('');

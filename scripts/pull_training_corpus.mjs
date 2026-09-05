#!/usr/bin/env node
/**
 * Builds a real-world evaluation corpus from user Smart Import corrections.
 *
 *   FIREBASE_SERVICE_ACCOUNT_JSON="$(cat key.json)" npm run corpus:pull
 *
 * Reads `trainingExamples` — the pasted text plus the before/after field values
 * of a correction, written only for users who explicitly opted into AI training
 * (see src/services/trainingDataService.js). Each document where the user
 * corrected `trackingNumber` or `carrier` is a labeled case: the text is the
 * input, the corrected value is ground truth, and the initial value is what the
 * parser got wrong.
 *
 * Output goes to `.parser-corpus-real.json`, which is GITIGNORED ON PURPOSE.
 * The text is PII-redacted at write time, but it is still real messages from
 * real users' phones, and a public repository is not the place for it. The
 * eval harness picks the file up automatically when present and ignores it
 * when absent, so the repo stays clean and CI stays reproducible.
 *
 * Requires the `firebase-admin` package, the same dependency and credential
 * that scripts/triage_reports.mjs uses.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(repoRoot, '.parser-corpus-real.json');
const FETCH_LIMIT = 2000;

const { initializeApp, cert, getApps } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
    console.error('Run with: FIREBASE_SERVICE_ACCOUNT_JSON="$(cat serviceAccount.json)" npm run corpus:pull');
    process.exit(1);
  }
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    process.exit(1);
  }
  initializeApp({ credential: cert(credentials) });
}

initAdmin();

const snap = await getFirestore()
  .collection('trainingExamples')
  .orderBy('timestamp', 'desc')
  .limit(FETCH_LIMIT)
  .get();

const cases = [];
const seen = new Set();
let skippedNoText = 0;
let skippedNoLabel = 0;
let skippedDuplicate = 0;

snap.forEach((doc) => {
  const d = doc.data();
  const text = typeof d.inputText === 'string' ? d.inputText.trim() : '';
  if (!text) { skippedNoText += 1; return; }

  const corrected = d.correctedValues || {};
  const initial = d.initialValues || {};

  // Only corrections to the fields this harness scores are labels. A user who
  // only retitled the package tells us nothing about detection accuracy.
  const trackingChanged = corrected.trackingNumber && corrected.trackingNumber !== initial.trackingNumber;
  const carrierChanged = corrected.carrier && corrected.carrier !== initial.carrier;
  if (!trackingChanged && !carrierChanged) { skippedNoLabel += 1; return; }

  // The same forwarded message pasted twice would otherwise weight one format
  // more heavily than its real share of the traffic.
  const key = text.toLowerCase().replace(/\s+/g, ' ');
  if (seen.has(key)) { skippedDuplicate += 1; return; }
  seen.add(key);

  cases.push({
    id: `real-${doc.id.slice(0, 8)}`,
    group: `real-${corrected.carrier || initial.carrier || 'unknown'}`,
    rawText: text,
    note: `user corrected ${[trackingChanged && 'trackingNumber', carrierChanged && 'carrier'].filter(Boolean).join(' + ')}`,
    expected: {
      trackingNumber: corrected.trackingNumber || initial.trackingNumber || null,
      carrier: corrected.carrier || initial.carrier || null
    },
    // Kept for triage: what the parser produced at the time of the correction.
    wasParsedAs: {
      trackingNumber: initial.trackingNumber || null,
      carrier: initial.carrier || null,
      source: d.source || null,
      confidence: d.confidence || null
    }
  });
});

writeFileSync(OUT_PATH, `${JSON.stringify({ pulledAt: new Date().toISOString(), cases }, null, 2)}\n`);

console.log(`\n  Pulled ${snap.size} training examples.`);
console.log(`    ${cases.length} usable labeled cases`);
console.log(`    ${skippedNoLabel} skipped — no tracking/carrier correction`);
console.log(`    ${skippedDuplicate} skipped — duplicate text`);
console.log(`    ${skippedNoText} skipped — no input text`);
console.log(`\n  Written to ${OUT_PATH.replace(`${repoRoot}/`, '')} (gitignored).`);

if (cases.length === 0) {
  console.log('\n  No labeled cases yet. This is expected while few users have opted');
  console.log('  into AI training — the synthetic corpus remains the scoreboard.');
} else {
  console.log('\n  Score against it with: npm run eval:parser -- --real');
}

console.log('');

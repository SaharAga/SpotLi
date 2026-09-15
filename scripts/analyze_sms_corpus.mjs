#!/usr/bin/env node
/**
 * Ranks the Hebrew delivery phrasings in a real SMS export, and says which ones
 * the parser currently has no answer for.
 *
 *   npm run corpus:sms -- ~/Downloads/sms-export.xml
 *
 * WHY: parser accuracy is measured against 37 hand-annotated corpus cases —
 * one person's guess at which phrasings matter. Seven stage misses were found
 * that way and fixed, but nothing in this repo knows whether those seven are
 * 40% of real traffic or 0.4%. An export answers that, and it needs no labels:
 * the parser's own fall-through (`in_transit` / `ordered`) marks every message
 * it could not stage, and the phrases common in that bucket are the ranked list
 * of what to fix next.
 *
 * PRIVACY — read before running:
 * - Nothing leaves this machine. There is no network call in this script.
 * - Messages are normalized before anything is counted: URLs, emails, phone
 *   numbers, digits and Latin identifier tokens become placeholders, so a
 *   counted phrase cannot carry a tracking number, a link or a phone number.
 * - Raw message bodies are never written to the output.
 * - The output path is gitignored. Keep it that way: it is derived from real
 *   messages off a real phone, and a public repository is not the place for it.
 *
 * GETTING THE EXPORT — Android over USB debugging:
 *
 *     adb shell content query --uri content://sms/inbox --projection body > sms.txt
 *     npm run corpus:sms -- sms.txt
 *
 * Project `body` and nothing else. The content provider separates columns with
 * commas and does not quote them, so any message containing a comma runs into
 * the next column — with body alone there is no next column to run into.
 *
 * OTHER SUPPORTED EXPORTS (detected by content first, extension second):
 * - adb    "Row: N body=…" dump, as above
 * - .xml   Android "SMS Backup & Restore"      (<sms body="…">)
 * - .csv   iMazing / iExplorer iPhone export   (a Text/Message/Body column)
 * - .json  an array of strings, or of objects with a text/body/message field
 * - .txt   one message per line, or blank-line-separated blocks
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// The app sources rely on Vite resolution (extensionless imports, JSON imports),
// so they are loaded through a throwaway Vite server rather than plain node ESM
// — same as scripts/eval_parser.mjs, for the same reason.
const { createServer } = await import('vite');
const vite = await createServer({
  root: repoRoot,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom'
});

const { analyzeCorpus, extractMessagesFromExport } =
  await vite.ssrLoadModule('/src/utils/smsCorpusAnalysis.js');
const { parseSmartText } = await vite.ssrLoadModule('/src/utils/smartParser.js');
await vite.close();

const DEFAULT_OUT = '.sms-phrase-report.json';
const DEFAULT_TOP = 40;

function parseArgs(argv) {
  const args = { file: null, out: DEFAULT_OUT, top: DEFAULT_TOP };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--top') args.top = Number(argv[++i]) || DEFAULT_TOP;
    else if (!arg.startsWith('--')) args.file = arg;
  }
  return args;
}

function bar(share, width = 24) {
  return '█'.repeat(Math.round(share * width)).padEnd(width, '·');
}

const args = parseArgs(process.argv.slice(2));

if (!args.file) {
  console.error('Usage: npm run corpus:sms -- <export-file> [--out FILE] [--top N]');
  console.error('');
  console.error('Android over USB debugging:');
  console.error('  adb shell content query --uri content://sms/inbox --projection body > sms.txt');
  console.error('  npm run corpus:sms -- sms.txt');
  console.error('');
  console.error('Also reads: .xml (SMS Backup & Restore), .csv (iMazing/iExplorer), .json, .txt');
  process.exit(1);
}

let messages;
try {
  messages = extractMessagesFromExport(readFileSync(args.file, 'utf8'), args.file).filter(Boolean);
} catch (err) {
  console.error(`Could not read ${args.file}: ${err.message}`);
  process.exit(1);
}

if (messages.length === 0) {
  console.error('No messages found. Check the export format — see the header of this script.');
  process.exit(1);
}

const report = analyzeCorpus(messages, parseSmartText);

console.log(`\n  ${report.total} messages read, ${report.shipping} about a shipment.`);
console.log(`  A tracking number was extracted from ${report.withTracking} of those ` +
  `(${(report.trackingRate * 100).toFixed(1)}%).\n`);

console.log('  Stage assigned:');
for (const { stage, count, share } of report.stages) {
  console.log(`    ${stage.padEnd(18)} ${String(count).padStart(5)}  ${bar(share)} ${(share * 100).toFixed(1)}%`);
}

if (report.carriers.length) {
  console.log('\n  Carrier detected:');
  for (const { carrier, count } of report.carriers.slice(0, 12)) {
    console.log(`    ${carrier.padEnd(18)} ${String(count).padStart(5)}`);
  }
}

console.log(`\n  ── Phrases the parser could NOT stage, most common first ──`);
console.log('  These messages fell through to in_transit/ordered: nothing in them');
console.log('  named a stage. This is the fix list, in order of real volume.\n');

const top = report.unstagedPhrases.slice(0, args.top);
if (top.length === 0) {
  console.log('    (none — every shipping message was staged by a phrase)');
} else {
  console.log('    count  also-when-staged  phrase');
  for (const { phrase, count, alsoWhenStaged } of top) {
    // A phrase that is just as common in messages that DID stage is filler,
    // not the reason this one did not.
    const flag = alsoWhenStaged >= count ? ' ' : '*';
    console.log(`  ${flag} ${String(count).padStart(5)}  ${String(alsoWhenStaged).padStart(15)}  ${phrase}`);
  }
  console.log('\n    * = appears mostly in messages we could NOT stage — look here first.');
}

writeFileSync(args.out, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: args.file,
  ...report
}, null, 2)}\n`);

console.log(`\n  Full report (normalized, no raw messages) written to ${args.out} — gitignored.\n`);

#!/usr/bin/env node
/**
 * Runs your own SMS through the parser and prints a review sheet.
 *
 *   npm run review:messages -- ~/Downloads/sms-backup.xml
 *   npm run review:messages -- ~/Downloads/sms-backup.xml --raw
 *
 * The point is the "found nothing" pile. Detection bugs that matter are
 * knowledge gaps — a carrier format or a wording nobody encoded — and no
 * amount of generated data reveals those. Real messages do.
 *
 * Input, any of:
 *   - output of `adb shell content query --uri content://sms/inbox
 *     --projection address:body` (no app to install; see README of this file)
 *   - the XML from "SMS Backup & Restore" (Android)
 *   - a plain text file with messages separated by blank lines
 *
 * ── Privacy ───────────────────────────────────────────────────────────────
 *
 * These are your actual messages. By default every line printed and written is
 * run through the app's own `redactPII`, so phone numbers, emails and
 * recipient names are stripped before they can be copied anywhere. `--raw`
 * disables that for local eyeballing — don't paste `--raw` output into a chat,
 * an issue, or a commit.
 *
 * Nothing is uploaded. The detail file is written to `.message-review.json`,
 * which is gitignored.
 */

import { createReadStream, writeFileSync, existsSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(repoRoot, '.message-review.json');

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--'));
const raw = args.includes('--raw');
const showAll = args.includes('--all');
// --sender=NAME narrows the review to one sender. A sender failing across the
// board is one bug, so reading its messages together is how you find it.
const senderFilter = args.find((a) => a.startsWith('--sender='))?.slice('--sender='.length) || null;

if (!inputPath || !existsSync(inputPath)) {
  console.error('\n  Usage: npm run review:messages -- <path-to-export> [--raw] [--all]\n');
  console.error('  Android: install "SMS Backup & Restore", back up SMS to XML, pass that file.');
  console.error('  Or pass a plain text file with messages separated by blank lines.\n');
  console.error('  --sender=NAME  narrow to one sender    --all  print every miss    --raw  skip redaction\n');
  process.exit(1);
}

const { createServer } = await import('vite');
const vite = await createServer({ root: repoRoot, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { parseSmartText } = await vite.ssrLoadModule('/src/utils/smartParser.js');
const { redactPII } = await vite.ssrLoadModule('/src/utils/privacySanitizer.js');

/** Undoes the XML attribute escaping used by SMS Backup & Restore. */
function decodeXmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Reads messages without holding the whole export in memory — a few years of
 * SMS is routinely tens of megabytes.
 *
 * @returns {Promise<Array<{ sender: string, body: string }>>}
 */
async function readMessages(path) {
  const isXml = path.toLowerCase().endsWith('.xml');
  const messages = [];
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });

  let textBuffer = [];
  // adb's `content query` prints one "Row: N key=value, key=value" per record,
  // but a body containing newlines spills across lines — so a row continues
  // until the next "Row:" marker rather than until end of line.
  let adbRow = null;
  const flushAdbRow = () => {
    if (!adbRow) return;
    const body = adbRow.body.trim();
    if (body && body !== 'NULL') messages.push({ sender: adbRow.sender, body });
    adbRow = null;
  };

  for await (const line of rl) {
    const adbMatch = line.match(/^Row: \d+ (.*)$/);
    if (adbMatch || adbRow !== null) {
      if (adbMatch) {
        flushAdbRow();
        const fields = adbMatch[1];
        const senderMatch = fields.match(/(?:^|,\s*)address=(.*?)(?:,\s*body=|$)/s);
        const bodyMatch = fields.match(/(?:^|,\s*)body=([\s\S]*)$/);
        adbRow = {
          sender: senderMatch ? senderMatch[1].trim() : '(unknown)',
          body: bodyMatch ? bodyMatch[1] : ''
        };
      } else {
        adbRow.body += `\n${line}`;
      }
      continue;
    }

    if (isXml) {
      // One <sms .../> per line in this export format.
      const bodyMatch = line.match(/\sbody="([^"]*)"/);
      if (!bodyMatch) continue;
      // type="1" is received; sent messages are never courier notifications.
      if (/\stype="2"/.test(line)) continue;
      const senderMatch = line.match(/\saddress="([^"]*)"/);
      messages.push({
        sender: senderMatch ? decodeXmlEntities(senderMatch[1]) : '(unknown)',
        body: decodeXmlEntities(bodyMatch[1])
      });
    } else if (line.trim() === '') {
      if (textBuffer.length) {
        messages.push({ sender: '(unknown)', body: textBuffer.join('\n') });
        textBuffer = [];
      }
    } else {
      textBuffer.push(line);
    }
  }

  flushAdbRow();
  if (textBuffer.length) messages.push({ sender: '(unknown)', body: textBuffer.join('\n') });
  return messages;
}

/**
 * Whether a message plausibly concerns a delivery.
 *
 * Deliberately generous: this decides what lands in the review pile, and a
 * message wrongly excluded here is a bug that can never be found. Precision
 * costs you a few seconds of skimming; recall costs you the finding.
 */
const COURIER_HINT = new RegExp([
  // Shipment nouns and delivery verbs. "דואר" needs the negative lookahead
  // because "דואר אלקטרוני" is simply email, and "נשלח"/"הגיע" are absent on
  // purpose: a university writing "נשלח אליכם מייל" is not a courier, and one
  // sender's course announcements alone put 110 non-deliveries in the pile.
  'משלוח', 'חבילה', 'חבילת', 'חבילתך', 'מעקב', 'שליח', 'נמסרה?', 'לאיסוף',
  'איסוף', 'לוקר', 'דואר(?!\\s*אלקטרוני)', 'הפצה', 'שילוח', 'ברקוד',
  'tracking', 'delivery', 'deliver', 'parcel', 'shipment', 'shipped', 'courier',
  'pickup', 'package', 'dispatch', 'waybill', 'awb',
  // Carrier and marketplace names.
  'צ.יטה', 'בוקסיט', 'תפוז', 'זיגזג', 'באזר', 'קרגו', 'אוריאן', 'בר הפצה',
  'chita', 'boxit', 'tapuz', 'zigzag', 'zig-zag', 'buzzr', 'cargo', 'hfd',
  'epost', 'orian', 'lionwheel', 'cheetah',
  'dhl', 'fedex', 'ups', 'usps', 'aramex', 'cainiao', 'aliexpress', 'shein',
  'yunexpress', '4px', 'yanwen'
].join('|'), 'i');

const messages = await readMessages(inputPath);
const candidates = messages
  .filter((m) => COURIER_HINT.test(m.body))
  .filter((m) => !senderFilter || m.sender.toLowerCase().includes(senderFilter.toLowerCase()));

const buckets = { verified: [], probable: [], uncertain: [], nothing: [] };
const bySender = new Map();

for (const message of candidates) {
  const parsed = parseSmartText(message.body);
  const tier = parsed.trackingNumber ? (parsed.candidateStatus || 'uncertain') : 'nothing';
  const bucket = buckets[tier] ? tier : 'uncertain';

  const record = {
    sender: message.sender,
    body: raw ? message.body : redactPII(message.body),
    trackingNumber: parsed.trackingNumber || null,
    carrier: parsed.carrier || null,
    tier: parsed.candidateStatus || null
  };

  buckets[bucket].push(record);

  if (!bySender.has(message.sender)) bySender.set(message.sender, { total: 0, missed: 0 });
  const stats = bySender.get(message.sender);
  stats.total += 1;
  if (bucket === 'nothing') stats.missed += 1;
}

const pct = (n, d) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(0)}%`);

console.log(`\n  ${messages.length} messages read · ${candidates.length} look delivery-related`
  + `${senderFilter ? ` · filtered to sender ~"${senderFilter}"` : ''}\n`);
console.log(`    ${String(buckets.verified.length).padStart(4)}  verified   auto-filled without asking — spot-check a few`);
console.log(`    ${String(buckets.probable.length).padStart(4)}  probable   pre-filled, user can correct`);
console.log(`    ${String(buckets.uncertain.length).padStart(4)}  uncertain  sent to AI or the user`);
console.log(`    ${String(buckets.nothing.length).padStart(4)}  NOTHING    ← the ones worth reading\n`);

const senders = Array.from(bySender.entries())
  .map(([sender, s]) => ({ sender, ...s }))
  .filter((s) => s.missed > 0)
  .sort((a, b) => b.missed - a.missed)
  .slice(0, 15);

if (senders.length) {
  console.log('  Senders we most often fail (a whole sender missing is one bug, not many)\n');
  for (const s of senders) {
    console.log(`    ${String(s.missed).padStart(4)}/${String(s.total).padEnd(4)} ${pct(s.missed, s.total).padStart(4)} missed   ${s.sender}`);
  }
  console.log('');
}

const sample = showAll ? buckets.nothing : buckets.nothing.slice(0, 25);
if (sample.length) {
  console.log(`  Found nothing in these (${showAll ? 'all' : `first ${sample.length} of ${buckets.nothing.length}`}):\n`);
  for (const r of sample) {
    console.log(`    [${r.sender}]`);
    console.log(`    ${r.body.replace(/\s+/g, ' ').slice(0, 220)}`);
    console.log('');
  }
}

writeFileSync(OUT_PATH, `${JSON.stringify({ reviewedAt: new Date().toISOString(), redacted: !raw, buckets }, null, 2)}\n`);

console.log(`  Full detail written to ${OUT_PATH.replace(`${repoRoot}/`, '')} (gitignored${raw ? ', NOT redacted' : ', redacted'}).`);
console.log('  Skim the "NOTHING" pile, send me the ones that are real deliveries, and I\'ll fix them.\n');

await vite.close();

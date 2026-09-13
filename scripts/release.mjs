#!/usr/bin/env node
/**
 * Collects the changesets under .changes/, applies the highest bump they ask
 * for, writes the CHANGELOG entry, and deletes the files it consumed.
 *
 * This exists so a version marks a release rather than a pull request. Before
 * it, every PR touching src/ had to bump package.json and edit CHANGELOG.md,
 * which made a four-file conflict inevitable between any two PRs in flight.
 *
 *   node scripts/release.mjs                    # version derived from changesets
 *   node scripts/release.mjs 0.16.0             # version stated explicitly, then checked
 *   node scripts/release.mjs 0.16.0 --dry-run   # print what would happen
 *
 * An explicit version must be a legal successor of the current one AND at
 * least as large as the changesets imply. Deriving alone cannot catch a
 * breaking change mislabelled `type: patch`; stating alone cannot catch a
 * typo. Requiring both closes each other's gap.
 */
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { successors, bumpBetween, bumpAtLeast } from './version-utils.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REQUESTED = args.find((a) => !a.startsWith('--')) ?? null;
const CHANGES_DIR = '.changes';
const RANK = { major: 3, minor: 2, patch: 1 };

const files = readdirSync(CHANGES_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
if (files.length === 0) {
  console.error('No changesets in .changes/ — nothing to release.');
  process.exit(1);
}

const entries = files.map((file) => {
  const raw = readFileSync(join(CHANGES_DIR, file), 'utf8');
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: expected a --- front-matter block. See .changes/README.md`);
  const type = (match[1].match(/type:\s*(\w+)/) || [])[1];
  if (!RANK[type]) throw new Error(`${file}: type must be major, minor or patch (got ${type ?? 'nothing'})`);
  const body = match[2].trim();
  if (!body) throw new Error(`${file}: the description is empty`);
  return { file, type, body };
});

const impliedBump = entries.reduce((hi, e) => (RANK[e.type] > RANK[hi] ? e.type : hi), 'patch');

const pkgPath = 'package.json';
const pkgRaw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);
const legal = successors(pkg.version);

let next;
let bump;

if (REQUESTED === null) {
  bump = impliedBump;
  next = legal[bump];
} else {
  // Stated explicitly — check it twice.
  bump = bumpBetween(pkg.version, REQUESTED);
  if (bump === null) {
    console.error(
      `${REQUESTED} is not a legal successor of ${pkg.version}.\n` +
        `From ${pkg.version} the only valid next versions are:\n` +
        `  ${legal.patch}  (patch)\n  ${legal.minor}  (minor)\n  ${legal.major}  (major)\n` +
        `\nNo release commit was created.`
    );
    process.exit(1);
  }
  if (!bumpAtLeast(bump, impliedBump)) {
    console.error(
      `${REQUESTED} is a ${bump} bump, but the changesets require at least a ${impliedBump}.\n` +
        `Changesets asking for ${impliedBump}:\n` +
        entries.filter((e) => e.type === impliedBump).map((e) => `  - ${e.file}`).join('\n') +
        `\n\nRelease ${legal[impliedBump]} instead, or correct the changeset if its type is wrong.` +
        `\nNo release commit was created.`
    );
    process.exit(1);
  }
  next = REQUESTED;
}

// Group by type so the entry reads like the existing hand-written ones.
const HEADING = { major: 'Changed', minor: 'Added', patch: 'Fixed' };
const sections = ['major', 'minor', 'patch']
  .map((type) => {
    const forType = entries.filter((e) => e.type === type);
    if (forType.length === 0) return null;
    return `### ${HEADING[type]}\n${forType.map((e) => `- ${e.body}`).join('\n\n')}`;
  })
  .filter(Boolean)
  .join('\n\n');

const today = new Date().toISOString().slice(0, 10);
const entry = `## [${next}] - ${today}\n\n${sections}\n`;

console.log(
  `${pkg.version} -> ${next}  (${bump}, from ${entries.length} changeset(s)` +
    `${REQUESTED ? `; requested explicitly, changesets implied ${impliedBump}` : '; derived'})`
);
for (const e of entries) console.log(`  - ${e.file} [${e.type}]`);

if (DRY) {
  console.log('\n--- CHANGELOG entry that would be written ---\n');
  console.log(entry);
  process.exit(0);
}

// package.json: targeted replace so formatting and key order survive.
writeFileSync(pkgPath, pkgRaw.replace(/"version":\s*"[^"]+"/, `"version": "${next}"`));

/**
 * package-lock.json carries the same version in two places — the root and the
 * `packages[""]` entry describing this package. Nothing in `npm ci` or the
 * build reads them, which is exactly why they rotted: the lock sat at 0.16.0
 * across fourteen releases before anyone noticed, so a lock pulled from a
 * build under investigation identified no release at all.
 *
 * Rewritten by targeted replace rather than `npm install --package-lock-only`,
 * for the same reason package.json is: re-serializing the whole file to move
 * one string would bury the real dependency diff of any future release under
 * thousands of lines of formatting churn. Both live in the file's header,
 * ahead of the first dependency, so the replace is bounded to that slice and
 * cannot reach a dependency that happens to share the version number.
 */
const lockPath = 'package-lock.json';
const lockRaw = readFileSync(lockPath, 'utf8');
const headEnd = lockRaw.indexOf('"dependencies"');
if (headEnd === -1) throw new Error(`${lockPath}: no "dependencies" key — is this a lockfile?`);
const head = lockRaw
  .slice(0, headEnd)
  .replace(/"version":\s*"[^"]+"/g, `"version": "${next}"`);
writeFileSync(lockPath, head + lockRaw.slice(headEnd));

// The replace is positional, so prove it landed rather than assume it.
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
if (lock.version !== next || lock.packages?.['']?.version !== next) {
  throw new Error(
    `${lockPath}: version is still ${lock.version} / ${lock.packages?.['']?.version} after the bump. ` +
      'Its layout has changed — update this step in scripts/release.mjs.'
  );
}

// CHANGELOG: insert above the newest existing entry.
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const firstEntry = changelog.indexOf('\n## [');
if (firstEntry === -1) throw new Error('CHANGELOG.md: could not find an existing "## [" entry to insert above');
writeFileSync('CHANGELOG.md', `${changelog.slice(0, firstEntry + 1)}${entry}\n${changelog.slice(firstEntry + 1)}`);

for (const e of entries) unlinkSync(join(CHANGES_DIR, e.file));

console.log(`\nReleased ${next}. Commit the result, then tag it v${next}.`);

/**
 * Asserts that the module-layering rules in `.oxlintrc.json` still FIRE.
 *
 * Why this exists: the tree is 100% compliant with those rules, so a config
 * that has silently stopped working is indistinguishable from a clean tree —
 * `npm run lint` exits 0 either way. Renaming `regex` to `regexp`, dropping the
 * `import` plugin, or an oxlint upgrade that renames a rule would delete the
 * boundary with no diagnostic anywhere. This test lints deliberately-broken
 * fixtures and fails if they come back clean.
 *
 * It reuses the REAL config: patterns, rule names, levels and plugin list are
 * read from `.oxlintrc.json` verbatim. Only two things are rewritten — the
 * `src/` prefix in each override's globs is pointed at the fixture tree, and
 * `ignorePatterns` (which hides the fixtures from `npm run lint`) is dropped.
 * Because the glob rewrite is the one thing not covered by the fixtures, the
 * shape of those globs is asserted separately.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const configPath = join(repoRoot, '.oxlintrc.json');
const FIXTURES = '.agents/lint/fixtures';

const config = JSON.parse(readFileSync(configPath, 'utf8'));

/** Run oxlint over the fixture tree with the real rules, and capture output. */
function lintFixtures() {
  const derived = JSON.parse(JSON.stringify(config));
  delete derived.ignorePatterns;
  for (const override of derived.overrides ?? []) {
    override.files = override.files.map((g) => g.replace(/^src\//, `${FIXTURES}/`));
  }
  // The derived config must live beside the real one: oxlint resolves an
  // override's `files` globs relative to the config file's own directory, so a
  // config written to a temp directory silently matches nothing — every
  // override would be skipped and this test would pass for the wrong reason.
  const derivedPath = join(repoRoot, `.oxlintrc.boundaries-test.${process.pid}.json`);
  writeFileSync(derivedPath, JSON.stringify(derived));

  try {
    const stdout = execFileSync(
      'npx',
      ['oxlint', '--no-ignore', '-c', derivedPath, FIXTURES],
      { cwd: repoRoot, encoding: 'utf8' }
    );
    return { status: 0, output: stdout };
  } catch (err) {
    // Non-zero exit is the expected path — oxlint found the planted violations.
    return { status: err.status, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  } finally {
    rmSync(derivedPath, { force: true });
  }
}

describe('lint boundary enforcement', () => {
  let result;
  beforeAll(() => {
    result = lintFixtures();
  }, 60000);

  it('reports a non-zero exit for the planted violations', () => {
    expect(result.status).not.toBe(0);
  });

  it.each([
    ['leaf layer importing services/', 'utils/leaf-violation.js', 'no-restricted-imports'],
    ['leaf layer importing a context/ barrel', 'utils/leaf-barrel-violation.js', 'no-restricted-imports'],
    ['services/ importing context/', 'services/service-violation.js', 'no-restricted-imports'],
    ['a component reaching inside a module', 'components/internals-violation.js', 'no-restricted-imports'],
    ['a dependency cycle', 'cycle-a.js', 'no-cycle']
  ])('still flags %s', (_label, file, rule) => {
    const lines = result.output
      .split('\n')
      .filter((l) => l.includes(file) && l.includes(rule) && l.includes('error'));
    expect(lines.length, `expected ${rule} on ${file}, got:\n${result.output}`).toBeGreaterThan(0);
  });

  it('does not flag sibling-leaf or third-party subpath imports', () => {
    const lines = result.output.split('\n').filter((l) => l.includes('leaf-ok.js'));
    expect(lines, `leaf-ok.js must lint clean, got:\n${lines.join('\n')}`).toEqual([]);
  });

  it('keeps the layering overrides scoped to src/, so the fixture rewrite is faithful', () => {
    const layerGlobs = (config.overrides ?? [])
      .filter((o) => o.rules?.['no-restricted-imports'])
      .flatMap((o) => o.files);
    expect(layerGlobs.length).toBeGreaterThan(0);
    for (const glob of layerGlobs) expect(glob.startsWith('src/')).toBe(true);
    // Every directory under src/ must be claimed by exactly one layer, so a new
    // one cannot appear unnoticed and unconstrained.
    for (const dir of [
      'src/utils/**', 'src/types/**', 'src/schemas/**', 'src/constants/**',
      'src/i18n/**', 'src/data/**', 'src/services/**', 'src/components/**',
      'src/hooks/**', 'src/context/**', 'src/App.jsx', 'src/main.jsx'
    ]) {
      expect(layerGlobs, `${dir} is no longer assigned to a layer`).toContain(dir);
    }
  });

  it('hides the fixtures from the real lint run', () => {
    expect(config.ignorePatterns).toContain(`${FIXTURES}/**`);
  });
});

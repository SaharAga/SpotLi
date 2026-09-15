import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A component that reads the package list is useless if its container never
 * hands one over — and it fails *silently*, because `packages = []` is a
 * perfectly valid empty list.
 *
 * SmartImportModal shipped a "Matching Existing Package" badge and the copy
 * explaining that a re-imported SMS enriches the existing record rather than
 * adding a duplicate. `App.jsx` never passed `packages`, so both were
 * unreachable: the modal deduplicated against its own empty default forever.
 * No component test could catch it — each one passes `packages` itself, which
 * is exactly the thing the container was not doing.
 *
 * So this test reads the wiring instead of the component: every modal mounted
 * in App.jsx that declares a `packages` prop must be given one.
 */
const COMPONENTS_DIR = resolve(process.cwd(), 'src/components');
const APP_SOURCE = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');

/** Components that accept a `packages` prop, read from their own signatures. */
function componentsAcceptingPackages() {
  return readdirSync(COMPONENTS_DIR)
    .filter((file) => file.endsWith('.jsx') && !file.includes('.test.'))
    .filter((file) => /^\s*packages\s*=\s*\[\]\s*,?\s*$/m.test(
      readFileSync(resolve(COMPONENTS_DIR, file), 'utf8')
    ))
    .map((file) => file.replace(/\.jsx$/, ''));
}

/**
 * The opening JSX tag App.jsx mounts for `name`, or null when it mounts none.
 *
 * Scans to the tag's own closing bracket rather than the first `>`: prop values
 * are arrow functions (`onClose={() => ...}`), so the first `>` in the source
 * is usually inside a prop, not the end of the tag.
 */
function mountedElement(name) {
  const open = APP_SOURCE.indexOf(`<${name}`);
  if (open === -1) return null;

  let depth = 0;
  for (let i = open; i < APP_SOURCE.length; i += 1) {
    const char = APP_SOURCE[i];
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return APP_SOURCE.slice(open, i + 1);
  }
  return null;
}

describe('App.jsx package-list wiring', () => {
  const candidates = componentsAcceptingPackages();

  it('finds the components that read the package list', () => {
    // Guards the guard: a rename that broke the signature scan would otherwise
    // turn this whole file into a silent pass.
    expect(candidates.length).toBeGreaterThan(5);
    expect(candidates).toContain('SmartImportModal');
  });

  it.each(candidates)('passes packages to <%s> where App mounts it', (name) => {
    const element = mountedElement(name);
    if (element === null) return; // not mounted in App — nothing to wire

    expect(element).toMatch(/packages=\{/);
  });
});

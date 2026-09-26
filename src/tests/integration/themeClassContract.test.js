import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { globSync } from 'node:fs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Static guards for two mistakes that are invisible in review, invisible in
 * dark mode, and produce no error anywhere — the class simply does nothing, or
 * does the wrong thing in a theme nobody ran.
 *
 * Both shipped to users. `bg-opacity-10` sat on the package detail header for
 * releases, emitting no CSS at all (it was removed in Tailwind v4), so every
 * carrier's brand gradient painted at full strength. And a literal `text-white`
 * on a slate surface rendered the onboarding hero, the first-run card titles
 * and the push nudge as white-on-white for anyone whose device was set to
 * light — the first screen a new user sees.
 *
 * Deliberately pattern-based rather than resolved against generated CSS: this
 * runs in milliseconds with no Tailwind build. The tradeoff is that it catches
 * the patterns named here and not, say, a wholly undefined utility such as the
 * `bg-primary` that AutoArchivePromptModal used to carry. That needs the class
 * list checked against a real build; this file is not that.
 */

const SOURCE_GLOB = 'src/**/*.jsx';

/**
 * Backgrounds that do NOT flip between themes.
 *
 * index.css builds light mode by inverting the slate scale (`.light` redefines
 * --color-slate-*), so `bg-slate-900` means "panel" in both themes and
 * `text-slate-100` means "heading ink" in both. The saturated families below
 * are not inverted, so they stay dark in light mode and white text on them is
 * correct — that is the whole exception this guard has to tolerate.
 */
const NON_INVERTING_SURFACE =
  /bg-(gradient|blue|indigo|emerald|rose|red|amber|orange|purple|violet|green|teal|cyan|sky|pink|fuchsia|yellow|lime)\b|bg-white\/|bg-black\/|from-|via-|to-/;

/**
 * Pale ink from a family the light theme does NOT remap.
 *
 * `.light` only redefines slate (inverted) and the blue/indigo/purple accent
 * scales. Emerald, amber, rose and the rest keep their dark-theme values, so
 * `text-emerald-300` is a pastel on a near-white panel in light mode — the
 * PIN chip, the "Out for delivery" badge and every status tint shipped that
 * way. The remapped accents are retuned but keep their lightness order, so
 * their 100-300 are still pastels on white too. Each needs a light-mode shade with the pale one moved behind `dark:`.
 * Amber/emerald/cyan and friends are pale enough to fail at 400 as well.
 */
const PALE_UNREMAPPED_INK =
  /(?<![:\w-])text-(?:(?:emerald|amber|rose|orange|cyan|teal|green|yellow|red|sky|lime|pink|fuchsia|violet|blue|indigo|purple)-(?:50|100|200|300)|(?:emerald|amber|cyan|teal|green|yellow|lime|sky)-400)(?![\w/-])/;

/**
 * Grounds that stay dark in light mode, so pale ink on them is correct: a
 * solid saturated fill, a gradient, or a near-black tint at high opacity
 * (the toasts).
 */
const DARK_IN_BOTH_THEMES =
  /(?<![:\w-])(?:bg|from)-(?:emerald|amber|rose|orange|cyan|teal|green|yellow|red|sky|lime|pink|fuchsia|violet|blue|indigo|purple)-(?:500|600|700|800|900|950)(?![\w/])|(?<![:\w-])(?:bg|from)-\w+-9[05]0\/[5-9]0/;

/** Pale ink that is correct because its ground (on an ancestor) stays dark. */
const PALE_INK_ALLOWLIST = [
  {
    file: 'src/components/Toast.jsx',
    classes: 'w-5 h-5 text-emerald-400 shrink-0',
    why: 'success icon on the bg-emerald-950/80 toast — dark in both themes'
  },
  {
    file: 'src/components/InstallPwaBanner.jsx',
    classes: 'text-blue-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 min-h-[48px] min-w-[48px] flex items-center justify-center',
    why: 'dismiss button on the from-blue-900/90 banner — dark in both themes'
  },
  {
    file: 'src/components/InstallPwaBanner.jsx',
    classes: 'px-3 py-2 text-xs font-medium text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer min-h-[48px]',
    why: '"Not now" on the from-blue-900/90 banner — dark in both themes'
  },
  {
    file: 'src/App.jsx',
    classes: 'w-4 h-4 animate-spin text-blue-200',
    why: 'spinner in the from-blue-600 update toast — dark in both themes'
  },
  {
    file: 'src/components/FilterBar.jsx',
    classes: 'text-blue-100',
    why: 'count inside the active status chip, whose ground is bg-blue-600'
  }
];

/** Utilities Tailwind v4 removed. They emit nothing; the style silently vanishes. */
const REMOVED_IN_V4 = [
  [/\b(?:bg|text|border|ring|placeholder|divide)-opacity-\d+\b/, 'opacity modifier — use the color/NN syntax, e.g. bg-slate-900/10'],
  [/\bflex-shrink-\d\b/, 'flex-shrink-* — renamed to shrink-*'],
  [/\bflex-grow-\d\b/, 'flex-grow-* — renamed to grow-*'],
  [/\boverflow-ellipsis\b/, 'overflow-ellipsis — renamed to text-ellipsis'],
  [/\bdecoration-(?:slice|clone)\b/, 'decoration-slice/clone — renamed to box-decoration-*']
];

/**
 * Literal `text-white` that is correct as written, because it sits on a
 * surface that stays dark in light mode but whose background class lives on an
 * ancestor rather than in the same class string.
 *
 * Keyed by file and the exact class string so that moving the line does not
 * break the test, but changing what the element is cannot silently inherit the
 * exemption.
 */
const WHITE_INK_ALLOWLIST = [
  {
    file: 'src/components/AuthModal.jsx',
    classes: 'w-4 h-4 animate-spin text-white',
    why: 'spinner inside a from-blue-600 gradient submit button'
  },
  {
    file: 'src/components/InstallPwaBanner.jsx',
    classes: 'text-sm font-semibold text-white',
    why: 'banner ground is from-blue-900/90 to-indigo-900/90 — dark in both themes'
  },
  {
    file: 'src/components/AdminDashboardModal.jsx',
    classes: 'absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity',
    why: 'hover scrim over a screenshot thumbnail, not over the app surface'
  },
  {
    file: 'src/App.jsx',
    classes: 'underline ms-2 text-white hover:text-blue-300 cursor-pointer font-bold',
    why: 'demo banner ground is from-indigo-900/90 to-blue-900/90 — dark in both themes'
  }
];

/**
 * Strips comments so prose cannot trip the scanners.
 *
 * Not cosmetic: the comment explaining the `bg-opacity-10` fix quotes the class
 * name in backticks, and a naive string scan reads that as a template literal
 * and reports the very bug the comment documents.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Every quoted/template string in the file, with its 1-based line number. */
function classStrings(source) {
  const out = [];
  const lines = stripComments(source).split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(['"`])((?:[^'"`\\]|\\.)*?)\1/g)) {
      out.push({ line: i + 1, value: m[2] });
    }
  });
  return out;
}

function sourceFiles() {
  return globSync(SOURCE_GLOB, { cwd: REPO_ROOT })
    .filter((f) => !f.includes('.test.'))
    .map((f) => f.split('\\').join('/'));
}

describe('theme + Tailwind class contract', () => {
  it('finds source files to scan', () => {
    // A broken glob would make every assertion below vacuously pass.
    expect(sourceFiles().length).toBeGreaterThan(30);
  });

  it('uses no utility that Tailwind v4 removed', () => {
    const offences = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(join(REPO_ROOT, file), 'utf8');
      stripComments(source)
        .split('\n')
        .forEach((line, i) => {
          for (const [pattern, explanation] of REMOVED_IN_V4) {
            const hit = line.match(pattern);
            if (hit) offences.push(`${file}:${i + 1}  ${hit[0]}  — ${explanation}`);
          }
        });
    }
    expect(offences, `Dead utilities emit no CSS at all:\n${offences.join('\n')}`).toEqual([]);
  });

  it('puts no literal text-white on a surface that inverts in light mode', () => {
    const allowed = new Set(
      WHITE_INK_ALLOWLIST.map((e) => `${e.file}::${e.classes.replace(/\s+/g, ' ').trim()}`)
    );
    const seen = new Set();
    const offences = [];

    for (const file of sourceFiles()) {
      const source = readFileSync(join(REPO_ROOT, file), 'utf8');
      for (const { line, value } of classStrings(source)) {
        if (!/\btext-white\b/.test(value)) continue;
        if (NON_INVERTING_SURFACE.test(value)) continue;

        const key = `${file}::${value.replace(/\s+/g, ' ').trim()}`;
        seen.add(key);
        if (allowed.has(key)) continue;
        offences.push(
          `${file}:${line}  "${value.slice(0, 90)}"\n` +
            '    Light mode inverts the slate scale, so text-white here is white-on-white.\n' +
            '    Use text-slate-100 (heading ink in both themes), or add an allowlist entry\n' +
            '    in this file if the element really does sit on a non-inverting surface.'
        );
      }
    }
    expect(offences, `\n${offences.join('\n\n')}`).toEqual([]);

    // A stale exemption is its own bug: it silently re-permits the mistake the
    // day someone reuses that class string.
    const stale = [...allowed].filter((k) => !seen.has(k));
    expect(stale, `Allowlist entries no longer match any code:\n${stale.join('\n')}`).toEqual([]);
  });

  it('pairs pale ink from a non-remapped family with a light-mode shade', () => {
    const allowed = new Set(
      PALE_INK_ALLOWLIST.map((e) => `${e.file}::${e.classes.replace(/\s+/g, ' ').trim()}`)
    );
    const seen = new Set();
    const offences = [];
    for (const file of [...sourceFiles(), 'src/types/stages.js']) {
      const source = readFileSync(join(REPO_ROOT, file), 'utf8');
      for (const { line, value } of classStrings(source)) {
        const hit = value.match(PALE_UNREMAPPED_INK);
        if (!hit) continue;
        if (DARK_IN_BOTH_THEMES.test(value)) continue;
        const key = `${file}::${value.replace(/\s+/g, ' ').trim()}`;
        seen.add(key);
        if (allowed.has(key)) continue;
        offences.push(
          `${file}:${line}  ${hit[0]}\n` +
            '    Not remapped by .light, so this is pastel-on-white in light mode.\n' +
            '    Use a 600-800 shade and keep this one as dark:, e.g. text-emerald-700 dark:text-emerald-300.'
        );
      }
    }
    expect(offences, `\n${offences.join('\n\n')}`).toEqual([]);

    const stale = [...allowed].filter((k) => !seen.has(k));
    expect(stale, `Allowlist entries no longer match any code:\n${stale.join('\n')}`).toEqual([]);
  });
});

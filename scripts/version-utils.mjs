/**
 * The versioning rule, in one place.
 *
 * From any version there are exactly three legal successors — patch, minor and
 * major. Both the release script and the pre-submit gate import this, so the
 * rule cannot drift between "what the tooling produces" and "what CI accepts".
 */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(v) {
  const m = SEMVER.exec(String(v).trim());
  if (!m) throw new Error(`Not a MAJOR.MINOR.PATCH version: "${v}"`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/** The only three versions that may legally follow `current`. */
export function successors(current) {
  const { major, minor, patch } = parseVersion(current);
  return {
    patch: `${major}.${minor}.${patch + 1}`,
    minor: `${major}.${minor + 1}.0`,
    major: `${major + 1}.0.0`
  };
}

/** Which bump turns `from` into `to`, or null if `to` is not a legal successor. */
export function bumpBetween(from, to) {
  const next = successors(from);
  return Object.keys(next).find((k) => next[k] === to) ?? null;
}

const RANK = { patch: 1, minor: 2, major: 3 };

/** True when `a` is at least as large a bump as `b`. */
export function bumpAtLeast(a, b) {
  return RANK[a] >= RANK[b];
}

export { RANK };

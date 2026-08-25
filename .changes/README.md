# Changesets

A PR that changes shipped code declares its change by adding **one new file
here** instead of editing `CHANGELOG.md` and bumping `package.json`.

## Why

Editing a shared `CHANGELOG.md` and `package.json` in every PR guarantees a
merge conflict between any two PRs in flight: the moment one merges, every
sibling conflicts on the same lines. New files never conflict with each other.

It also stops the version from being a PR counter. A version should mark a
release, not a pull request.

## How

Create `.changes/<short-slug>.md`:

```markdown
---
type: patch
---

Short description of the change, in the past tense, as it should read in the
changelog. One or two sentences.
```

`type` is `major`, `minor`, or `patch`, following the convention at the top of
`CHANGELOG.md`: `minor` for new user-facing capability, `patch` for fixes and
internal work, `major` stays reserved while the project is in alpha.

Use a slug that will not collide with a sibling PR — the branch name works well
(`fix-backup-fidelity.md`).

## Releasing

`npm run release` collects every changeset, picks the highest bump type, writes
the entry into `CHANGELOG.md`, updates `package.json`, and deletes the consumed
files. That commit is the release.

## Still bumping directly?

That remains valid. The CI gate accepts either a changeset **or** a version
bump, so a one-off hotfix that ships immediately can just bump. The gate only
rejects a PR that changes shipped code and declares nothing at all.

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

```bash
npm run release            # version derived from the changesets
npm run release 0.16.0     # version stated explicitly, then checked
npm run release 0.16.0 --dry-run
```

It collects every changeset, writes the entry into `CHANGELOG.md`, updates
`package.json`, and deletes the files it consumed. That commit is the release.

**A stated version is checked twice.** It must be a legal successor of the
current one — from `0.6.4` that is only `0.6.5`, `0.7.0` or `1.0.0`, never
`0.6.99` or `0.9.0` — and it must be at least as large as the changesets imply.
If two changesets ask for `minor` and you ask for a patch, it refuses and names
the changesets forcing the minor. Nothing is written when it refuses.

Deriving alone cannot catch a breaking change mislabelled `type: patch`.
Stating alone cannot catch a typo. Requiring both closes each other's gap.

## Deploying

**Only the release commit deploys.** CI deploys a push to `main` only when it
changes `package.json`'s version, so an ordinary merge lands without shipping.
This is what keeps a version identifying a specific build — deploying every
merge meant several deploys shared one version number.

## Still bumping directly?

That remains valid. The CI gate accepts either a changeset **or** a version
bump, so a one-off hotfix that ships immediately can just bump. The gate only
rejects a PR that changes shipped code and declares nothing at all.

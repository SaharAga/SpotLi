# Rolling back production

**Short version: do not use CI to roll back.** A revert through the pipeline is
a PR, a full CI run and a release commit — tens of minutes. Firebase Hosting
already keeps every release and can serve a previous one again in seconds,
which is the path to use when production is broken.

Everything below was verified against `firebase-tools@14`. Note there is **no
`firebase hosting:rollback` command** — if you go looking for one you will not
find it.

---

## 1. Hosting: a bad build is live

**Fastest — Firebase Console (seconds, no CLI, no CI):**

1. Firebase Console → **Hosting** → the `deliveree-app-2a938` site
2. **Release history** — every deploy is listed, newest first
3. On the last known-good release, open the **⋮** menu → **Rollback**

The previous version is served immediately. This changes nothing in git: `main`
still carries the bad commit, so follow up with a real revert PR once the fire
is out, or the next release will ship the same breakage again.

**Nuclear option — take the site offline:**

```bash
npx firebase-tools@14 hosting:disable --project deliveree-app-2a938
```

Stops serving web traffic entirely. Use only when serving *nothing* beats
serving what is live (a data-destroying bug, a leak). Undo by deploying again
or rolling back as above.

**Promote a known-good channel onto live:**

```bash
npx firebase-tools@14 hosting:clone \
  deliveree-app-2a938:staging deliveree-app-2a938:live \
  --project deliveree-app-2a938
```

Useful when staging is known good and live is not.

---

## 2. Firestore rules: the case that does NOT roll back

**Hosting rollback does not touch Firestore rules.** They are deployed
separately and a rollback of the site leaves bad rules in place.

Two things make this the more dangerous failure:

- **Rules reach production at MERGE time, not at release time.** Staging and
  production share one Firebase project (`deliveree-app-2a938`), and the
  `deploy-staging` job pushes `firestore.rules` on every ordinary merge to
  `main`. There is no staging copy of the rules to catch a mistake in.
- Bad rules can expose or lock out real user data, which a bad UI build cannot.

**To fix:** revert `firestore.rules` in git and deploy just the rules —
you do not need a release commit or a full pipeline run:

```bash
git revert <the bad commit>            # or edit firestore.rules directly
npx firebase-tools@14 deploy --only firestore:rules \
  --project deliveree-app-2a938 --non-interactive
```

Deploying rules from a local checkout requires credentials for the project.
`.github/workflows/health-check.yml` runs daily and will flag deployed rules
that no longer match the repo, but daily is not fast enough to be a safety net
during an incident — check rules explicitly whenever a merge touched them.

---

## 3. Cloud Functions

Functions deploy on every ordinary merge to `main` that touches `functions/`,
independent of releases. There is no channel or version rollback: redeploy the
previous known-good code.

```bash
git checkout <last-good-sha> -- functions/
npx firebase-tools@14 deploy --only functions \
  --project deliveree-app-2a938 --non-interactive --force
```

---

## What each deploy path actually ships

Worth knowing before an incident, because "deploy" means three different
things here:

| Trigger | Hosting (live) | Hosting (staging) | Firestore rules | Functions |
| --- | --- | --- | --- | --- |
| Merge to `main` | — | ✅ | ✅ (if changed) | ✅ (if `functions/` changed) |
| Release commit (version bump) | ✅ | — | ✅ (if changed) | — |

So an ordinary merge already changes production behaviour through rules and
functions. Only the hosting *app bundle* waits for a release.

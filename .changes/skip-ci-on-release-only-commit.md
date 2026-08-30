---
type: patch
---

CI no longer re-runs lint/test/functions tests on the release commit produced by `npm run release` — that commit only touches `package.json`/`CHANGELOG.md`/`.changes/`, and the PR that preceded it already ran the full suite against this exact code. Also fixed staging deploy firing on every push to `main` instead of only on the release commit alongside production.

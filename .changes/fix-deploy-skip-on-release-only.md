---
type: patch
---

Fixed production/staging deploy silently skipping on every release commit since the previous release. GitHub's implicit `success()` on a job's `if:` walks the whole transitive dependency chain, not just direct `needs:` — with lint/test legitimately skipped (not failed) on a release-only commit, that implicit check broke and deploy never ran despite `is_release` correctly evaluating true.

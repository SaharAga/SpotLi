---
type: patch
---

Fixed the first-ever `gmailConnectionStatus` Cloud Function deploy failing its
container healthcheck — its 128MiB memory allocation was too tight for a
Node 22 2nd-gen function pulling in the Firebase Admin SDK, so it never
finished booting within the startup timeout. Bumped to 256MiB, matching
every sibling `onCall` handler. Also passes `--force` on the CI deploy so
the one-time Artifact Registry cleanup-policy confirmation prompt doesn't
fail the non-interactive deploy.

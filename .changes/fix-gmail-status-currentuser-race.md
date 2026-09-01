---
type: patch
---

Fixed the Gmail connect button still showing "Connect Gmail" after a real,
working connection (packages backfilled fine, but the status check never
even reached the server). `getGmailConnectionStatus()` was bailing out
locally on a bare `auth.currentUser` read, which can still be null for a
moment after a fresh page load or PWA relaunch even once the app's own
sign-in state is otherwise ready — it now lets the callable's own
auth-token flow (which properly waits on Auth SDK readiness) handle it
instead.

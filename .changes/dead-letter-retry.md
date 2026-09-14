---
type: minor
---

Changes that permanently failed to sync can now be recovered. The admin
dashboard's Sync Queue Health card previously showed only a count of
dead-lettered mutations — each one a change the user made that never reached
the cloud — with no way to see what they were or to try again; the service had
a retry function, but nothing called it. The card now lists each failure with
what it touched and the error that stopped it, and a Retry button puts it back
in the queue with a fresh retry budget.

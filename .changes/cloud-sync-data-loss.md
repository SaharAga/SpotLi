---
type: patch
---

Fixed a data-loss bug where cloud sync could delete packages off a signed-in
user's device (#91).

The Firestore listener queried with `orderBy("updatedAt", "desc")`. Firestore
omits documents that lack the field an `orderBy` names, so any package stored
without an `updatedAt` was simply absent from the snapshot — not deleted, just
not returned. The reconcile then treated "absent from the snapshot" as "no
longer exists" and dropped the local copy, and the listener persisted that
result to localStorage, destroying the records.

The query no longer orders server-side (ordering is presentation, and must
never decide which records exist), and reconciling a snapshot can no longer
shrink what is on disk: packages missing from a snapshot are kept and the
near-miss is logged. Deletions continue to travel through tombstones. The
`getPackages` path already had an equivalent guard; the listener, which is what
actually runs during a session, did not.

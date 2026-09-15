---
type: patch
---

Packages sync to the cloud again. Firestore refuses a package write outright if
it carries any field the security rules do not name, and the client was sending
two: `isDemo`, which the schema puts on every package, and `location`, which
the merge path wrote and nothing ever read. Any package that went through a
merge — every auto-ingested package, every status update from an email or SMS —
was therefore rejected with "Missing or insufficient permissions", retried five
times, and dead-lettered, which is why changes made on one device stopped
reaching the others. `isDemo` is now allowed by the rules, the dead `location`
field is gone, and unknown fields are dropped at the cloud boundary rather than
refusing the whole document — they still survive locally, which is what they
were preserved for. Changes already stranded can be replayed from the admin
dashboard's Retry button.

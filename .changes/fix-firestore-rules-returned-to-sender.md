---
type: patch
---

Fixed `returned_to_sender` packages failing to sync to the cloud. The status was
added to the client's `VALID_STATUSES` but not to the `validStatuses` allowlist in
`firestore.rules`, which is the actual enforcement — so a package that reached that
status was stored locally and then rejected by Firestore, silently dropping it from
cloud sync for signed-in users. Added a contract test that fails whenever the two
lists drift apart.

---
type: patch
---

Fixed cross-device sync and persistence failures for packages ingested from Gmail or email by allowlisting `source`, `confidence`, `lockerPin`, `orderNumber`, and `schemaVersion` in Firestore security rules and package schemas.

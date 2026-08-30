---
type: patch
---

Fixed the Israeli holiday/Shabbat status check using UTC instead of local
Israel time (causing off-by-one closures near midnight), surfaced Gmail
watch-renewal failures in the Ingestion Guide instead of only logging them
server-side, added a `store` field and reconciled `pickupPhone`'s max length
between the package schema and Firestore rules, added a staleness warning
for the hardcoded Israeli holiday table, and bumped a couple of remaining
44px touch targets in the locker and navigation modals to the 48px minimum.

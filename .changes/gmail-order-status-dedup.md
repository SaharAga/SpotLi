---
type: patch
---

Fixed Gmail sync spamming a separate untracked package card for every
follow-up email in an order's lifecycle (order confirmed, shipped, out for
delivery, delivery issue, ...) when no carrier tracking number was found. A
follow-up email for a store already represented by one of these order-status
packages now updates that package's status instead of creating a duplicate.

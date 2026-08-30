---
type: minor
---

Gmail sync no longer silently discards order-confirmation emails that name a
known store but carry no carrier tracking number (e.g. a marketplace order
number like AliExpress's). These now create a lower-confidence "order
status" package — built from the store and an explicit lifecycle phrase in
the email, never a fabricated tracking timeline — visually marked as "from
order confirmation" and kept structurally distinct from carrier-verified
packages.

---
type: patch
---

Fixed four detection faults found in a real courier message: "מס מעקב"
without an apostrophe was not recognised as a tracking label, WhatsApp contact
links had their phone numbers read as tracking numbers, Cargo was not
recognised by its bare brand name or its cargo-ship.co.il domain, and an
opaque token from a tracking URL could outrank the tracking number the message
actually shows you.

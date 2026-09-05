---
type: patch
---

Smart Import now reads Tapuz tracking links. Their notifications use a
`tracking_number` parameter on tapuzdelivery.com and issue short mixed-case
codes, none of which were recognised — and the code's capitalisation is now
preserved, since upper-casing it produces a number their tracking page does
not accept.

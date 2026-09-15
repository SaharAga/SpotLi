---
type: patch
---

A Tapuz SMS is now filed under the order number it quotes instead of the
session token in its link. Two faults compounded in one real message: "נקלטה
בתפוז" ("received at Tapuz") matched the rule meant to catch a shop saying an
order has been received but not yet shipped, which stopped the order-number
scan from ever running; and the tracking link's 36-character CRM token was then
accepted as the tracking number, because any path segment containing a digit
was trusted on a carrier's own domain. A courier saying it has taken the parcel
in now counts as a shipment when the message links to that courier, while a
shop's identical wording still does not, and a path segment longer than any
real tracking format has to match a carrier rule to be believed. The practical
effect is that a parcel announced twice — once by email, once by SMS — is
recognised as the package already in the list rather than added a second time.

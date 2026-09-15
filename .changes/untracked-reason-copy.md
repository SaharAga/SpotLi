---
type: patch
---

Refreshing a package that came back with no tracking data now says which of
three things happened, instead of blaming the carrier for all of them. A
shipment the tracking network has no record of yet reads "no tracking record
yet — try again later"; "live tracking isn't available for this carrier" is now
reserved for carriers that genuinely have no feed; and a lookup that could not
run says so rather than claiming the carrier is unsupported.

Reported from a real Tapuz parcel: its 8-digit number was sent to 17TRACK in
auto-detect mode, came back with no record, and the app told the user Tapuz is
unsupported — a permanent-sounding claim about the carrier, from an answer about
that one shipment.

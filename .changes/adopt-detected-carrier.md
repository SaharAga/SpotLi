---
type: minor
---

A package filed under the wrong carrier now gets corrected by the tracking
network instead of keeping the guess forever. The app already asks 17TRACK on
every refresh, including the one fired automatically when a package is added —
but its identification was discarded twice over: the Cloud Function echoed back
whichever carrier id the client had sent rather than the one detected, and the
client never wrote a carrier into the refreshed package at all. Both now carry
it. A carrier only inferred from a tracking number's shape is replaced by what
17TRACK reports; a carrier the number names itself (RS…IL, 1Z…) or one the user
chose is left alone. When 17TRACK names a courier absent from our catalogue —
Tapuz, and most of the Israeli last mile — the name is kept and shown while the
package stays manually tracked, rather than inventing an id for it.

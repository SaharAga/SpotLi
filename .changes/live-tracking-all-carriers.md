---
type: minor
---

Live tracking now actually reaches every carrier. The client refused the lookup
outright unless a carrier had a hand-written client-side adapter — four of
them — so twelve Israeli couriers, Cheetah and HFD among them, reported "live
tracking isn't available" without the Cloud Function that holds the 17TRACK key
ever being asked about a single one. The proxy already accepted any carrier and
already omitted the catalogue code when it had none, which is 17TRACK's
auto-detect mode; nothing was reaching it. Every carrier is now queried, and an
untracked answer is the outcome of a real lookup rather than a local refusal.
The detail screen no longer claims tracking is unavailable for a carrier it is
about to query — it distinguishes a confirmed integration from one resting on
auto-detect, and says a refresh will still try.

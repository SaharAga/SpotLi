---
type: minor
---

Added a background tracking refresh that runs every six hours on the server, so
a package can be updated — and notify you — without the app being open. Until
now "live tracking" only happened when you tapped refresh, which meant a parcel
could be delivered and sit at "in transit" indefinitely if the courier's SMS
carried no tracking number. Lookups are paced against a per-run budget and back
off numbers that keep coming back empty.

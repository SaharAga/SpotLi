---
type: patch
---

Dates now follow your local calendar rather than UTC. Israel is UTC+2/+3, so
between midnight and 02:00/03:00 the app treated "today" as yesterday — a
package added at 01:00 was dated a day early, delivery and return deadlines were
off by one, and an SMS saying a parcel arrives "tomorrow" resolved to the wrong
day. Analytics aggregation keys stay on UTC deliberately, so historical counts
remain comparable.

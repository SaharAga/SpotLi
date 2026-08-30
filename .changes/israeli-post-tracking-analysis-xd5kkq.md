---
type: patch
---

Fixed Gmail sync silently going stale after the initial connect: the watch
renewal job now runs daily instead of weekly (a weekly schedule could miss
renewing a subscription entirely depending on which day it was created,
letting push notifications lapse with no error), and a status-update email
for a tracking number you already have now updates that package instead of
being dropped as a duplicate.

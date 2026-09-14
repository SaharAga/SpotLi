---
type: patch
---

Changes made on one device now reach the others even after a failed sync. The
offline queue only ever replayed on an offline-to-online transition or when a
new change was queued, so a mutation that failed while *online* — a Firestore
hiccup, an expired token — was never retried by anything: no `online` event
fires when the page never left the network, and the offline banner (the only
place with a manual sync button) is hidden whenever you are online. The queue
stopped there silently, and the devices quietly disagreed about the package
list. Pending work now replays when the app starts, once sign-in has been
restored, and whenever the app returns to the foreground. Retry budgets are
unchanged, so a mutation that genuinely cannot succeed still lands in the
dead-letter queue rather than retrying forever.

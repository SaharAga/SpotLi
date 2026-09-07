---
type: patch
---

Fixed automatic push notifications never arriving. Three independent faults
each broke the chain on their own: `AccountModal` passed `user?.uid` to every
push call, but the auth profile exposes the Firebase uid as `id`, so
subscriptions were never persisted server-side; `subscribeToPush` was only
reachable from the "enable notifications" button, which is hidden once
permission is granted, so an already-permitted device could never register;
and the service worker read `packageId` only from `data.data`, while the Cloud
Functions send it at the top level, giving every notification the same tag so
each one replaced the last. Push preferences now reflect a genuinely reachable
subscription rather than permission alone, and the notification settings show
which stage of the chain — server key, browser subscription, server
registration — is actually failing.

---
type: minor
---

Added real-time Web Push notifications for packages automatically detected
from Gmail sync or forwarded email — the client already had subscription
code and a service worker push handler with nothing on the server ever
sending to them; this wires up the missing half. A Firestore trigger fires
whenever an automated ingestion source creates a new package, sending a
push to every device the user has subscribed on. Not sent for packages the
user creates themselves (manual add, Smart Import), since they're already
looking at the app when they do that. Requires a one-time VAPID keypair
setup (see README "Automated Email Ingestion & Gmail Sync") — the app and
Gmail sync work fine without it, push notifications just never activate.

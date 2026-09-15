---
type: patch
---

Signing in with Google now works in the installed app on iPhone. Added to the
home screen, the Google button spun forever: iOS opens the provider page in a
context the app cannot reach, so the popup sign-in never completed and never
failed either — and because nothing was thrown, the existing fallback to the
redirect flow could not fire. An installed app now takes the redirect flow from
the start, in any display mode a manifest can ask for; a browser tab keeps
using the popup. The check that tells those apart is now one helper rather than
a condition repeated per component.

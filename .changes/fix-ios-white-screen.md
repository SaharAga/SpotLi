---
type: patch
---

Fixed the app failing to load at all on iPhone. A leftover reference to a
renamed variable sat behind an iOS-only condition, so it threw on every iOS
Safari device and on no other platform — the whole app rendered as an error
screen. Undefined identifiers are now a lint error, so this class of bug cannot
reach a build again.

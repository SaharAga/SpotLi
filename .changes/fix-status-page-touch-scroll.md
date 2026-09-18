---
type: patch
---

Fixed mobile touch and viewport scrolling lockup on the status page by adopting `overflow-x: clip` on root document containers, adding `touch-pan-y` and gesture isolation to package cards, preventing unwanted first-visit onboarding modal triggers in demo mode, and safeguarding scroll lock release.

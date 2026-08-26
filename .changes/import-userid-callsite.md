---
type: patch
---

Scoped `importData` to the signed-in user at its call site. The service half shipped in #67, but `App.jsx` still called it with one argument, so `userId` defaulted to `null` and every restore landed in the guest partition regardless of who was signed in — leaving #56 closed while the bug was still live.

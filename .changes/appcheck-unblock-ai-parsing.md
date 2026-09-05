---
type: patch
---

Restored AI-assisted import. App Check could not issue a token in production,
so the function rejected every request and both AI text parsing and screenshot
parsing were unavailable. Sign-in, the daily call caps and the payload size
limits all still apply.

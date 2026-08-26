---
type: minor
---

Added automatic, anonymous crash reporting: uncaught React render errors and unhandled
window/promise errors are now reported to their own `crashReports` Firestore collection (kept
separate from tester `/feedback` so a burst of automatic reports can never crowd it out), visible
grouped by distinct failure in the Alpha Feedback Inspector's new "Crashes" tab.

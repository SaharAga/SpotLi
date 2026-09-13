---
type: patch
---

Insights no longer shows a Multi-Currency Spending Breakdown. The card totalled
what you had spent per currency, but nothing in the app records a package's
price — there is no price field on the add/edit form, the smart parser never
extracts one, and the schema has no such field — so it could only ever show a
figure when a price happened to appear in a note or title and a regex caught
it. In practice it was four zeroes and an apology, on a screen about deliveries
rather than spending. `extractPackageValue` stays for a future per-package
customs-threshold hint, which is the one place a package's declared value
actually matters here.

---
type: minor
---

The package list now leads with the package. Titles were clamped to one line
beside a status badge that repeats across most rows, leaving about seven
characters — "Sony WH-1000XM5 Headphones" rendered as "Sony W…" — while the
expected date was squeezed to "A…" and the carrier to a single pixel. Titles get
two lines, the date and carrier no longer truncate to nothing.

The first screen shows packages again. The install prompt and the feature nudge
could both be up at once and, stacked with the demo bar, KPI row, search and
filter chips, pushed every package below the fold; only one promotional banner
shows at a time now. The Feedback button no longer covers the last card, and the
filter chips fade at the edge instead of being sliced mid-word, so it reads as
scrollable rather than broken.

The Account screen is one screen again. The bottom-bar tab rendered its own copy
outside the modal router, with a different set of rows from the one the rest of
the app opened, and pushed no history entry — so the Android back gesture left
the app instead of closing the sheet. Removing the duplicate also un-blocked its
code splitting: the entry bundle drops from 57.4 kB to 48.4 kB gzipped.

The service worker has tests, covering the shell precache, offline fallback and
the update opt-in. A SessionStart hook installs `functions/` dependencies, which
the root install does not reach.

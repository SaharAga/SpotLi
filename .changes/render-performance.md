---
type: patch
---

Cut dashboard re-render work: the package list, table and KPI tiles are now
memoized behind stable handlers instead of re-rendering on every keystroke, the
Web Share Target handler runs once at startup rather than on every package
change, and the search filter normalizes the query once per pass. Status
bucketing moved into a single `TAB_PREDICATES` table shared by the filter and
both counters, which had drifted apart.

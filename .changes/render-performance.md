---
type: patch
---

Cut dashboard re-render work: the package list, table and KPI tiles are now
memoized behind stable handlers — including the mutators `usePackages` returns —
so typing in the search box no longer re-renders every card. The Web Share
Target handler runs once at startup rather than on every package change, which
also stops a `?tab=` shortcut from snapping the user back to that tab after
every edit. Status bucketing moved into a single `TAB_PREDICATES` table shared
by the filter and both counters, which had drifted apart.

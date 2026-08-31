---
type: minor
---

Instrumented feature-adoption tracking (Phase 3 of #117, using Phase 2's
pipeline): Analytics, Export, Smart Import modals and an `_app_active`
session baseline via a shared `useFeatureUsage` hook; Gmail-sync connect
and Web Share Target import at their existing App.jsx entry points; PWA
install acceptance. Also added: crash reports now dedupe by a random
per-browser-session id (distinct sessions hit vs. raw occurrences) shown
in the admin Crash Monitor tab, and a live "Sync Queue Health" card
(pending mutations, oldest pending age, dead-lettered count) in the admin
System tab, reading the existing offline sync queue read-only. Engagement/
retention and friction/abandonment signals from the original Phase 3 scope
are deferred — see the tracking issue for why.

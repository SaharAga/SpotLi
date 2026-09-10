---
type: patch
---

Cut the interaction latency that made the UI feel unfinished. Every control now
has an immediate press state (the app had removed the platform tap highlight
without replacing it) and `touch-action: manipulation`, which drops the
browser's wait-for-a-double-tap delay before firing click. The ~100
`transition-all` declarations became a `transition-ui` utility that names only
compositor-friendly properties, so an unrelated style change no longer schedules
a layout pass. `backdrop-filter` came off the surfaces that animate or repaint
on every scroll frame — the header and bottom nav are already 90–95% opaque, so
the large blur radius was paying full cost for a near-invisible effect. Tab
switches now jump to the top instead of smooth-scrolling while the list is
re-rendering underneath. The one remaining infinite animation loop in the
always-on UI (the update banner's bounce) is now a one-shot.

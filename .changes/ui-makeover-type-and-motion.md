---
type: minor
---

Interface text now scales with your browser and OS text-size setting across the
whole app. Every size was previously pinned in pixels, so raising your text size
produced a half-scaled interface where labels, badges and metadata stayed tiny.

Removed the animations that ran forever — a pulsing "closes soon" badge, pulsing
open/closed dots, pinging progress markers, a throbbing locker-screen icon and
the header logo glow. Each duplicated something already shown by colour, shape
or text. Spinners that report work actually in progress are unchanged.

The package detail view now fits a phone screen without its header overflowing.

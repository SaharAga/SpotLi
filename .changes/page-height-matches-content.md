---
type: patch
---

Pages are now only as tall as what they show, and stop clipping content at the
bottom. Three separate things made the end of a screen look broken: the page
footer sat underneath the fixed mobile tab bar, so 153px of height carried a
copyright line and the carrier list no phone user could reach, below a gap that
read as the page having run out early — it is desktop-only now, where there is
no tab bar. Every full-screen modal reserved 4.5rem for that tab bar even on
the drill-down screens (package detail, add, smart import) where the bar is
deliberately unmounted to give them full height, so those lost 72px to a bar
that was not there and clipped early against a dead band; the reservation now
follows the bar's actual presence. And on desktop the Feedback button covered
the end of the footer text, cutting the carrier list mid-word.

---
type: patch
---

fix(ui): prevent swipe gesture from hijacking vertical scroll on package list

Tightened the directional threshold in PackageCard's `handleTouchMove` from
45° (deltaX > deltaY) to ≈26° (deltaX > 2 × deltaY). The previous threshold
was too permissive: diagonal touches — common when a finger begins a vertical
scroll — were incorrectly classified as horizontal swipes, consuming the touch
event and blocking page scroll. The stricter 2:1 ratio ensures only clearly
lateral gestures engage swipe-to-delete/archive mode.

Also removed duplicate `transition-transform duration-150 ease-out` utilities
from the card wrapper className that conflicted with the existing
`transition-all duration-200`, causing Tailwind to emit an incorrect
`transition-property: transform` that suppressed hover shadow and lift
animations.

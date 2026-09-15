---
type: patch
---

Fixed the Smart Import confirm button doing nothing. A tracking number the
deterministic parser rates "probable" — the common Israeli-courier case, an
identifier with no check digit and no carrier URL — was displayed under
"Successfully extracted shipping details" with "Add this Package to Tracker"
permanently inert, and nothing on screen said why. Reported from a real Tapuz
delivery SMS. The button also now looks disabled when it is.

Smart Import also tells you when the number already belongs to a package you
track, so a follow-up SMS reads as an update to that package rather than
looking like it will add a duplicate. The badge and its explanation were
already written; `App` never passed the package list to the modal, so they
could never appear. Saving already merged rather than duplicating — this is
the half that says so before you commit.

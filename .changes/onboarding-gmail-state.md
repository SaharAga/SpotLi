---
type: patch
---

The empty-state onboarding no longer asks you to connect a Gmail account you
have already connected. Its Gmail tile rendered unconditionally, under a
"Recommended" badge, because the component was never given any account state —
so a signed-in user with Gmail syncing and nothing yet delivered was told to
set up the thing that was already running. The tile is now omitted once Gmail
is connected. The Gmail *nudge* banner had a second form of the same bug: it
read the connection flag but left it out of its memo's dependencies, so the
server's answer arriving after first paint never reached it.

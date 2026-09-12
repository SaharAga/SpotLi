---
type: minor
---

Fixed light mode rendering headings as white-on-white. The light theme inverts
the slate scale, so a literal `text-white` never flipped — the onboarding hero,
every first-run card title, and the push-alerts nudge were invisible to anyone
whose device was set to light.

Fixed closing a dialog being able to navigate the user out of the app. The modal
router mutated browser history from inside a `setStack` updater, which React
re-invokes, so one close fired two `history.back()` calls and walked past the
app's own entry. History now holds a single sentinel that cannot drift from the
stack, and Back closes exactly one screen at a time.

Gave the service worker real offline support. It shipped a bare network
passthrough that cached nothing, while `main.jsx` deleted every cache on every
boot (it matched against a version string frozen since 0.6.0), so the app had no
offline availability at all. The worker now precaches the shell, serves
navigations network-first with a cached fallback, and no longer force-reloads
every open tab — the existing "update available" prompt applies the update
instead.

Insights no longer reports 100% on-time over a list of overdue packages. Both
rates counted only delivered shipments, so one sitting weeks past its promised
date registered nowhere; an overdue package is now a miss in both.

Fixed the package detail header: the carrier gradient painted at full strength
because `bg-opacity-10` was removed in Tailwind v4 (Israel Post turned an
ordinary package's header solid red), and the Edit button was clipped off-screen
at 390px.

Fixed the auto-generated package title storing a truncated tracking number with
a literal ellipsis — that string is the package's name and is interpolated into
the WhatsApp/SMS message sent to a courier.

Account → Date format now actually changes how dates render; it was stored and
cloud-synced but never read. The auto-archive confirm button no longer relies on
an undefined `bg-primary` utility, and the demo banner no longer quotes a URL
query parameter at the user.

Finished landing `ready_for_pickup` as a real delivery status. The parser
returned it for a Hebrew "ממתינה לאיסוף" pickup SMS and four components plus
~20 tests already branched on it, but it was missing from `VALID_STATUSES` and
from the `firestore.rules` allowlist — so it could never be saved and a pasted
pickup notice landed on "Order Placed". It now has display metadata, transition
rules, a filter bucket and a stepper position, and Smart Import sets the stage
the message actually describes.

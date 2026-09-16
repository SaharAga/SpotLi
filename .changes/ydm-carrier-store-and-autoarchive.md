---
type: patch
---

Added YDM Group as a recognised courier, so its messages no longer import as
"Other / Universal", and taught the merchant reader two things it was missing:
`I-HERB` as iHerb (the hyphen hid it), and the "שליח מטעם <shop>" phrasing that
names a merchant with no parcel number in the message.

Fixed the auto-archive preference not surviving a reload for signed-in users. It
was written to the cloud correctly but dropped when the profile was read back,
so the toggle held for the session and reset on the next load.

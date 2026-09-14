---
type: minor
---

The admin dashboard's System tab now reports whether App Check is actually
working on this device: verified, configured but rejected, not configured at
all, or still checking — each with what to do about it. Every other signal App
Check gives requires a desktop browser (a console warning, the network tab, the
Firebase console's charts), so on a phone there was no way to tell a working
install from a silently broken one. A rejected key also names the hostname it
was rejected for, which is usually the answer: the origin is missing from the
key's allowed-domains list.

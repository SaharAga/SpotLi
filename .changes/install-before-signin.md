---
type: patch
---

On iPhone the sign-in screen now offers installing the app first. iOS gives a
home-screen app its own storage, separate from Safari, so anyone who signs in
through the browser and installs afterwards has to sign in a second time — the
app's own install hint lived in the post-sign-up wizard, which is exactly too
late to prevent that. The note appears above the sign-in options, only on an
iPhone that has not installed yet, and only as advice: the form underneath
stays usable for anyone who prefers the browser. Android and desktop share a
session between the browser and the installed app, so they are not shown it.
The install steps themselves are now one component shared with the install
banner rather than a second copy.

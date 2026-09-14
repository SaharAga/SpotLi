---
type: patch
---

App Check now says why it isn't working. The reCAPTCHA Enterprise site key was
the one configuration value read straight from the environment without being
trimmed, so a newline picked up from pasting it into a repository variable
would have been passed to the provider verbatim — the same mistake that once
broke Google sign-in through `authDomain`, and harder to spot here because
nothing fails loudly: `initializeAppCheck` returns successfully whether or not
the key is usable, and a key the provider rejects simply never produces a
token. The key is cleaned like every other config value now, and a whitespace
only key reads as unset so the existing "not configured" warning prints. On top
of that, a production build asks for a token once at startup and warns, naming
the current hostname, when it cannot get one — turning a silent failure (zero
verified requests, an empty console) into a message that says where to look.

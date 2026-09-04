---
type: patch
---

Added a `?lang=he|en` URL override for the interface language, so a link can
carry the language it should open in (useful for sharing a bug report in the
language it happens in). It takes precedence over the stored preference for
that view without rewriting it.

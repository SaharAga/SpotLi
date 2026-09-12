---
type: patch
---

Added guards against the class of bug that broke light mode. A static contract
test now rejects a literal `text-white` on a surface that inverts between themes
(with an allowlist for the genuine exceptions, which stays honest — a stale
entry fails the test too) and rejects utilities Tailwind v4 removed, such as
`bg-opacity-*`, which emit no CSS and fail silently. ThemeContext gained its
first tests, and `renderWithTheme` joins `renderWithLanguage` so components can
be rendered in a pinned theme. CLAUDE.md now states the invariant all of this
protects: theming is a palette inversion, so slate tokens flip between themes
and literal white/black ink does not.

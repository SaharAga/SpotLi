---
type: patch
---

Enforced module layering in lint: `import/no-cycle` is now an error, `utils/`,
`types/`, `schemas/`, `constants/` and `i18n/` may no longer import
`services/`, `components/`, `hooks/` or `context/`, and `services/` may no
longer import `components/`, `hooks/` or `context/`. Enabled the `react-perf`
rules at `warn` as a standing worklist.

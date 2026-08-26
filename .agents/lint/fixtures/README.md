# Lint boundary fixtures

Deliberately-broken files. Each one violates exactly one boundary rule in
`.oxlintrc.json`, so `lintBoundaries.test.js` can assert that the rule still
produces a diagnostic. They are listed in the config's `ignorePatterns`, so
`npm run lint` never sees them; the test strips that key from its derived copy
of the config.

Do not "fix" anything here — a clean fixture is a failing test.

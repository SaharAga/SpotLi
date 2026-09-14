---
type: patch
---

App Check now initializes in the production build. `firebase.js` only calls
`initializeAppCheck` when `VITE_RECAPTCHA_V3_SITE_KEY` is set at build time, and
that repository variable had never been added — so every request for the first
seven days of monitoring arrived with no App Check token at all (0 verified out
of 4.4k, 100% "outdated client"). Nothing in the client changed; the key is now
configured, so the shipped bundle starts presenting tokens and the App Check
metrics become meaningful. Enforcement stays off until verified traffic shows up
there, per the rollout sequence in README — turning it on against tokenless
traffic would have rejected every request, including real users'.

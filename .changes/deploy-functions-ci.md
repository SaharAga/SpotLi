---
type: minor
---

Cloud Functions now deploy automatically on every merge to main (reusing
the same Firebase service account CI already uses for Hosting/Firestore
rules), instead of requiring a manual `firebase deploy --only functions`.
This was previously left out of CI pending the Gemini secret and Blaze
plan being set up — both have been in place for a while (Gmail AI sync has
been live in production), so the gap was just never revisited.

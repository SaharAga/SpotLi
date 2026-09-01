---
type: minor
---

Added a privacy-preserving feature-adoption pipeline (Phase 2 of #117):
`featureUsageService.js` records a per-day, per-identity row (deduped, no
content beyond the feature id and date — identity lives only in the
document ID, never as content) to a new `featureUsage` collection nobody,
including admin, can read back. A daily scheduled Cloud Function
(`featureAdoptionRollup`) counts unique rows per feature into
`featureAdoptionStats` and deletes the raw rows immediately after, so
identity-shaped data never accumulates. The admin dashboard's new
"Feature Adoption" tab shows each feature's adoption rate against an
`_app_active` baseline over the trailing 30 days. No features are
instrumented yet — that's Phase 3.

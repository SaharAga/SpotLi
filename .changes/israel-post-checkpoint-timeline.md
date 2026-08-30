---
type: patch
---

Israel Post live tracking now builds a full checkpoint timeline from the
itemtrace gateway's `itemhistory` field when it's returned as a list of
events, instead of collapsing every package to a single "last status"
checkpoint. Falls back to the previous single-checkpoint behavior when
`itemhistory` is a plain string or absent.

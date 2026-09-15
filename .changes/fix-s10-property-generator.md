---
type: patch
---

Fixed a property-based test that generated Israel Post tracking numbers with
random UPU S10 check digits and asserted the parser must extract them. Only
about one in eleven verified, so the test contradicted the parser's deliberate
refusal of an unlabeled number whose check digit fails — failing at random
whenever fast-check also drew a prefix Israel Post actually issues. The
generator now appends the correct check digit, and a new test holds it to the
real validator so the two cannot drift apart.

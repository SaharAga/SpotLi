# SpotLi Security Baseline Guide (Client-Only PWA)

*Re-adopt ASVS L2/L3 language only if/when a real backend or auth server is introduced.*

---

## 1. Authorization & BOLA Invariants (Firestore Security Rules)

For all update operations on user-scoped collections, **BOTH** the existing document owner **AND** the incoming modified document owner must be validated:
```firestore
allow update: if request.auth != null 
              && resource.data.userId == request.auth.uid 
              && request.resource.data.userId == request.auth.uid;
```
Failing to validate `request.resource.data.userId` allows an attacker to overwrite document ownership and inject rogue data into victim accounts (BOLA).

---

## 2. Anti-ReDoS & Deterministic Regex Patterns

- **Adjacent Quantifier Traps**: Flag patterns with adjacent unanchored quantifiers separated by optional tokens (e.g. `\s*:?\s*` or `(a+)+`), which cause quadratic $O(N^2)$ or exponential $O(2^N)$ CPU freezes.
- **Deterministic Patterns**: Enforce anchored, single-pass character classes (e.g. `(?:AWB[:\s]\s*)?`).

---

## 3. Input Validation, XSS & Prototype Pollution

- **Schema Allowlisting**: Validate all incoming payloads against strict schemas (e.g. Zod `packageSchema`). Strip unknown keys (`strip()` / `strict()`).
- **Prototype Pollution**: Validate all object merge/clone keys against `__proto__`, `constructor`, `prototype`. Use `Object.create(null)` for accumulator objects.
- **XSS Sanitization**: Ensure untrusted text rendered into the DOM is escaped; never use raw `dangerouslySetInnerHTML` with user-supplied strings.

---

## 4. Client-Side Web APIs (Clipboard & File Reader)

- **Clipboard API**: Never swallow clipboard errors with `.catch(() => {})` while displaying a success notification. Always `await writeText()` inside `try/catch` with fallback.
- **Unbounded File Reader**: Enforce `file.size <= 2MB` before `readAsText()` and `file.size <= 5MB` before `readAsDataURL()` to prevent browser tab OOM crashes.

---

## 5. Secrets & Repository Hygiene

- **Zero Hardcoded Secrets**: Zero API secret keys, passwords, or personal access tokens committed to repo source code or client-side bundles.

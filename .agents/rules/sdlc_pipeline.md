# Autonomous Multi-Agent SDLC Pipeline Rulebook

When executing software development, feature additions, bugfixes, or refactors, adhere strictly to the **Autonomous Multi-Agent SDLC Framework**.

---

## 1. Core Architecture & Pipeline Model

For a single-developer project, the standard quality gate pipeline is:

```
[Specification & Contract] --> [Implementation] --> [Scalability & Code Review] --> [Security Baseline Audit] --> [QA & Build Verification] --> [Done]
   (Lead Orchestrator)              (Developer)             (Code Reviewer)                 (Security Auditor)              (QA Verifier)
```

### The Standard 4-Gate Flow:
1. **Gate 1: Implementation** (`software-development-standards`) — Developer
2. **Gate 2: Scalability & Scope Challenge** (`automated-code-review`) — Code Reviewer
3. **Gate 3: Security Baseline Audit** (`owasp-security-and-rate-limiting`) — Security Auditor
4. **Gate 4: QA & Build Verification** (`software-verification-and-qa`) — QA Verifier

---

## 2. Review Chain & Capped Adversarial Layers

1. **Standard Pipeline Rule**:
   - For all routine application development and maintenance, changes follow the standard 4 gates (**Developer → Code Reviewer → Security Auditor → QA Verifier → Done**).
   - **No nested challenger, auditor, or victory-auditor swarms** are dispatched by default.
2. **Exception for Framework Metareview**:
   - Extra adversarial layers (challenger + forensic auditor) are reserved exclusively for reviewing this framework's own configuration and governance rules after a major structural overhaul — never for routine application features or fixes.
3. **Gate 2 Scope Challenge**:
   - Before flagging any issue as blocking, the `code_reviewer` must state in one line why the issue matters *for this specific application at its current stage (client-only PWA)*.
   - Findings that cannot clear this bar (e.g. theoretical micro-optimizations or premature server architecture concerns) must be recorded in `DEFERRED.md` rather than blocking the gate.

---

## 3. Gate Breakdown & Verification Criteria

### Gate 1: Implementation (Developer)
* Follow Clean Architecture: separate Presentation (`src/components/`), Domain Logic (`src/context/`, `src/utils/`), and Service Adapters (`src/services/`).
* Co-locate unit testbenches with implementation (`*.test.jsx`, `*.test.js`).
* Write defensive, strongly-typed code with schema validations and Error Boundaries.

### Gate 2: Scalability & Code Review (Code Reviewer)
* **Big-O Audit**: Ensure $O(1)$ or $O(N)$ operations. Flag nested loop lookups ($O(N^2)$) and quadratic spreads.
* **Lifecycle & Memory**: Verify explicit cleanup for timers, intervals, event listeners, and `AbortController` instances.
* **FinOps & Free-Tier Guardrails**: Verify Firebase Spark quota awareness (batch writes, client cache, pagination).
* **RTL/LTR & Accessibility**: Verify logical CSS properties and $\ge 48\text{px}$ touch targets.
* **Execute Scope Challenge**: Log non-blocking findings to `DEFERRED.md`.

### Gate 3: Security Baseline Audit (Security Auditor)
* **Deliveree Security Baseline (Client-Only PWA)**:
  * *Re-adopt ASVS L2/L3 language only if/when a real backend or auth server is introduced.*
  * **Firestore BOLA Invariant**: `allow update: if request.auth != null && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;`
  * **Anti-ReDoS**: Deterministic, single-pass regex patterns with no nested quantifiers.
  * **Input Parsing**: Strict schema allowlisting (Zod `strip()`) and prototype pollution guards.
  * **Client APIs**: Safe `FileReader` size bounds ($\le 2\text{MB}$) and clipboard fallback.
  * **Secrets Check**: Zero hardcoded secrets, keys, or credentials committed.

### Gate 4: QA & Build Verification (QA Verifier)
* **Static Analysis**: `npm run lint` (exit 0). **Not** `-D warnings`: the
  `react-perf` rules are intentionally warnings — a standing worklist, not a
  gate. See `AGENTS.md` §9.1.
* **Typecheck**: `npx tsc --noEmit --strict`
* **Test Suite**: `npm test` (100% pass rate)
* **Anti-Facade**: Scan for dummy assertions (`expect(true).toBe(true)`) or skipped tests (`it.skip`).
* **Build**: `npm run build` (zero build errors).

---

## 4. Bounded Remediation Loop

* Maximum retries per failing gate: `MAX_RETRIES = 3`.
* If a gate fails after 3 remediation cycles, record the dead-end in `DEAD_ENDS.md` and escalate to the user.

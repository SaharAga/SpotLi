---
name: owasp-security-and-rate-limiting
description: Security auditing protocol based on the SpotLi Security Baseline (client-only PWA). Use when evaluating code changes touching authentication, Firestore security rules, user input parsing, regular expressions, clipboard/file APIs, or repository secrets. Do NOT use for styling/CSS-only changes, static asset updates, or pure documentation edits.
inputs:
  - List of modified files and code diffs
  - Identified threat surface (Firestore rules, user inputs, regexes, file parsing)
outputs:
  - Structured Security Audit Report (PASS / FAIL) with line-cited findings and remediation
---

# SpotLi Security Baseline (Client-Only PWA)

*Re-adopt ASVS L2/L3 language only if/when a real backend or auth server is introduced.*

This skill guides the security auditor in evaluating client-side PWA and Firestore security.

---

## 1. Quick Audit Checklist

1. **Firestore BOLA Invariant**: Rule `update` checks `resource.data.userId == auth.uid && request.resource.data.userId == auth.uid`.
2. **Anti-ReDoS**: No nested/adjacent unanchored quantifiers in carrier detection regexes.
3. **Input Sanitization & Prototype Pollution**: Schema allowlisting (Zod `strip()`), prototype key guards (`__proto__`, `constructor`).
4. **Client API Safety**: Clipboard `writeText` error handling, `FileReader` size bounds ($\le 2\text{MB}$).
5. **Secrets Hygiene**: No hardcoded API secrets or private tokens in repo or client bundles.

*(For detailed explanations and code patterns, see `references/security_baseline_guide.md`)*

---

## 2. Structured Security Audit Report

```markdown
# 🛡️ Security Audit Report (SpotLi Baseline)

## Overall Status: [ PASS | FAIL ]

### 1. Security Domain Compliance
- **Auth & Access Control (Firestore BOLA Invariant)**: [Pass / Fail / N/A]
- **Anti-ReDoS & Regex Resilience**: [Pass / Fail / N/A]
- **Input Sanitization & Prototype Pollution**: [Pass / Fail / N/A]
- **Native APIs & File Reader Guards**: [Pass / Fail / N/A]
- **Secrets in Repo Scan**: [Pass / Fail]

### 2. Vulnerability Findings (if FAIL)
| Severity | File:Line | Vulnerability | Remediation |
|---|---|---|---|
| [CRITICAL|HIGH|MEDIUM|LOW] | file.js:N | Description | Drop-in fix |
```

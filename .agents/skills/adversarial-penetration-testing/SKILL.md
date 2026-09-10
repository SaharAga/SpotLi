---
name: adversarial-penetration-testing
description: Adversarial Red Team Penetration Testing & Exploit Simulation protocol. Activate when conducting controlled attack simulations, attempting authorization bypasses (BOLA/BFLA), probing prototype pollution vectors, injecting XSS/SQLi payloads, testing ReDoS/DoS resource exhaustion, or executing malware/tamper audits.
inputs:
  - Target application runtime, storage endpoints, parsers, auth handlers, and data adapters
outputs:
  - Adversarial Red Team Penetration Testing & Threat Assessment Report with CVSS scores and exploit reproduction steps
---

# Adversarial Penetration Testing & Red Team Protocol

This skill guides the **Adversarial Pentester & Red Team Specialist** in executing offensive security audits and controlled exploit attempts to verify that defenses cannot be breached.

---

## 1. Offensive Attack Surfaces & Exploit Vectors

### A. Multi-Tenant Authorization & BOLA/BFLA Attacks (Broken Object Level Authorization)
* **Storage Namespace Tampering**:
  * Attempt horizontal access: Force User A to read, overwrite, or clear `spotli_packages_userB` (or legacy `deliveree_packages_userB`) or guest keys.
  * Attempt UID spoofing in cloud database mutations (e.g. passing a modified `userId` field to forge ownership).
* **IDOR (Insecure Direct Object References)**:
  * Probe endpoints and handlers for predictable IDs (`1`, `2`, sequential timestamps) without tenant session validation.

### B. Prototype Pollution & Object Injection
* **Dangerous Key Injection**:
  * Attempt payload injections containing `__proto__`, `constructor`, `prototype` in:
    * CSV/JSON import files (`importData`)
    * User profile sync (`validateUserProfile`)
    * Package payload objects (`validatePackage`)
  * Verify that `Object.prototype` remains unpolluted (`Object.prototype.isAdmin === undefined`).

### C. Cross-Site Scripting (XSS) & Content Injection
* **Polyglot XSS Vectors**:
  * Test tracking numbers, carrier names, order titles, and SMS parse inputs with hostile polyglots:
    * `"><script>alert(1)</script>`
    * `<img src=x onerror=alert('XSS')>`
    * `javascript:alert(document.domain)`
    * `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==`
* **DOM-Based & SVG Injection**:
  * Verify that unsanitized HTML is never passed to `dangerouslySetInnerHTML` or dynamic DOM sinks.

### D. Denial of Service (DoS) & ReDoS Catastrophic Backtracking
* **Hostile Regex Payloads**:
  * Subject every regex in `smartParser.js`, `carrierDetector.js`, and `packageValidator.js` to 50,000–100,000 character hostile repetitive sequences (e.g. `a`.repeat(50000) + '!').
  * Verify CPU execution completes in $< 20\text{ms}$ with zero thread starvation.
* **Payload Bombing & Memory Exhaustion**:
  * Attempt importing massive JSON payloads (> 10MB) or arrays containing 50,000+ items to verify file-size gating and item caps.

### E. Secrets Extraction & Data Exfiltration
* **Client Bundle Entropy Scan**:
  * Scan production `dist/` JS chunks for private API secrets, OAuth client secrets, or internal service credentials.
* **Sensitive Data in Storage**:
  * Verify that unencrypted passwords or raw session tokens are not dumped into unmasked `localStorage` keys.

---

## 2. Adversarial Red Team Sign-off Template

```markdown
# 🛡️ Adversarial Red Team Penetration Testing Report

**Audit Target:** [Target URL / Codebase]  
**Methodology:** OWASP Top 10 (2021), ASVS v4.0, CWE/SANS Top 25  
**Final Verdict:** [ 🟢 PASS (Hardened & Immune) | 🔴 FAIL (Vulnerabilities Found) ]

---

### Executive Threat Summary
[Brief overview of tested attack surfaces and overall resilience]

### Attack Vector Analysis

| # | Attack Surface | Vector Tested | CVSS v3.1 | Exploit Outcome | Status |
|---|---|---|---|---|---|
| 1 | Multi-Tenant BOLA | Cross-tenant storage tampering | 8.6 (HIGH) | Access Denied | MITIGATED |
| 2 | Prototype Pollution | `__proto__` injection in import | 7.5 (HIGH) | Object Sandboxed | MITIGATED |
| 3 | Stored / DOM XSS | Script injection in tracking inputs | 7.2 (HIGH) | Stripped & Escaped | MITIGATED |
| 4 | ReDoS / DoS | 85k-char backtracking attack | 5.3 (MED) | Executed in <15ms | MITIGATED |
| 5 | Secrets Disclosure | Entropy scan on client bundle | 8.9 (HIGH) | Zero Secrets Found | MITIGATED |

### Detailed Exploit Logs & Evidence
- **Vector 1**: [Description of test payload, result, and proof of mitigation]
- **Vector 2**: [Description of test payload, result, and proof of mitigation]

### Hardening Recommendations (if any)
1. [Recommendation 1]
```

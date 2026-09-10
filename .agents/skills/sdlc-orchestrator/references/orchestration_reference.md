# SDLC Orchestration Reference & Subagent Playbook

---

## 1. Domain Specialist Subagent Profiles

| Role | Subagent Name | Scope & Responsibilities |
|---|---|---|
| **UI/UX Architect** | `ui_ux_architect` | Mobile ergonomics (>= 48px), RTL/LTR logical symmetry, WCAG AAA. |
| **Feature Developer** | `developer` / `ui_ux_specialist` / `auth_cloud_specialist` / `delivery_pipeline_specialist` | Component implementation, Clean Architecture, co-located tests. |
| **Code Reviewer** | `code_reviewer` | Big-O complexity, N+1 query prevention, memory teardown, Scope Challenge. |
| **Security Auditor** | `security_auditor` | SpotLi Security Baseline (Firestore BOLA, ReDoS, input sanitization). |
| **QA Verifier** | `qa_verifier` | Oxlint, TypeScript, Vitest 5-tier testbench, production build. |

---

## 2. Gate Escalation & Bounded Remediation

```
Retry 1 → Developer fixes → Gate re-run
Retry 2 → Developer fixes → Gate re-run
Retry 3 → Developer fixes → Gate re-run
FAIL     → Log in DEAD_ENDS.md → Notify User
```
- Maximum retries: `MAX_RETRIES = 3` per failing gate.
- Oscillations or unresolvable dead-ends must be logged in `DEAD_ENDS.md`.

---

## 3. Remote Notifications Integration

For long-running runs or required approvals:
- Dispatch interactive Telegram question: `python3 scripts/telegram_bot.py --ask "..." --options "Approve ✅,Reject ❌"`
- Zero-permission outbox: `python3 scripts/telegram_bot.py --queue "..."`

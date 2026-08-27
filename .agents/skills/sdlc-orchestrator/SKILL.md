---
name: sdlc-orchestrator
description: Orchestration protocol for Project Managers and Lead Agents. Use when decomposing and coordinating multi-stage feature development, refactors, or fixes across Developer, Code Reviewer, Security Auditor, and QA Verifier roles. Do NOT use for single-file trivial fixes, read-only research lookups, or documentation-only updates.
inputs:
  - High-level feature request or engineering goal
  - Workspace repository context
outputs:
  - Decomposed execution plan with contract definitions and distinct subagent dispatches
---

# SDLC Orchestration Protocol

This skill guides the Lead Orchestrator in managing software changes across the 4 standard quality gates.

---

## 1. Core Orchestration Rules (Two-Tier Risk Model)

This repository operates on a Two-Tier Risk Model to balance velocity and safety:

1. **Tier 1: Fast-Track (Direct Execution)**
   - Used for routine bug fixes, UI/UX tweaks, single-component updates.
   - The Orchestrator is PERMITTED to write application code (`src/**`) directly without dispatching subagents.
2. **Tier 2: Deep-Audit (Multi-Agent Swarm)**
   - Used for core architecture, cross-domain features, Auth, or security rules.
   - The Orchestrator does NOT write code directly. It plans, decomposes, and dispatches subagents.
   - **Workspace Isolation**: Feature developers run in `Workspace: 'branch'`.
   - **Distinct Gates**: Code Review (Gate 2), Security Audit (Gate 3), and QA (Gate 4) must be executed by distinct subagents.
3. **Tier 2 Concurrent Quality Pipeline**:
   ```
   [Gate 1: Implementation] ──► ┌─► [Gate 2: Code Review]   ──┐ ──► [Gate 4: QA & Verification] ──► [Done]
     (Developer, Branch WS)     └─► [Gate 3: Security Audit] ──┘         (QA Verifier)
   ```
   *Gates 2 and 3 run concurrently against the developer's diff to minimize turnaround latency.*
4. **Explicit Skill Path Injection**: When dispatching any subagent via `invoke_subagent`, the prompt **MUST** explicitly instruct the subagent to view and follow its respective `.agents/skills/<skill-name>/SKILL.md` file.
5. **Bounded Remediation**: Maximum 3 remediation retries per gate before logging to `DEAD_ENDS.md` and escalating to the user.

*(For detailed subagent profiles and retry flows, see `references/orchestration_reference.md`)*

---

## 2. Subagent Dispatch Templates

### Gate 1: Developer Dispatch (Branch-Isolated)
* **Subagent Role**: `Feature Developer` (or `UI/UX Specialist`, `Auth & Cloud Specialist`, `Delivery Specialist`)
* **Workspace Mode**: `'branch'`
* **Target Skill**: `.agents/skills/software-development-standards/SKILL.md`
```markdown
View and adhere strictly to `.agents/skills/software-development-standards/SKILL.md`.
Task: [Describe components, services, or features to implement]
Files: [Target file paths]
Contract: [TypeScript interfaces / Zod schemas]
Invariants: Keep mobile touch targets >= 48px, RTL/LTR mirroring, and guard Firebase Spark quotas.
```

### Gates 2 & 3: Concurrent Review & Security Swarm (Dispatched Simultaneously)

#### Gate 2: Code Reviewer
* **Subagent Role**: `Scalability Code Reviewer`
* **Target Skill**: `.agents/skills/automated-code-review/SKILL.md`
```markdown
View and adhere strictly to `.agents/skills/automated-code-review/SKILL.md`.
Review Target: [List of modified files and diffs]
Execute Scope Challenge: Verify issue relevance for this client-only PWA before flagging. Check O(1)/O(N) complexity and React memory unmount teardowns.
```

#### Gate 3: Security Auditor
* **Subagent Role**: `Security Baseline Auditor`
* **Target Skill**: `.agents/skills/owasp-security-and-rate-limiting/SKILL.md`
```markdown
View and adhere strictly to `.agents/skills/owasp-security-and-rate-limiting/SKILL.md`.
Audit Target: [List of modified files and attack surfaces]
Evaluate against Deliveree Security Baseline (Zero client secret leaks, Anti-ReDoS, Firestore BOLA, input sanitization).
```

### Gate 4: QA & Build Verification Dispatch
* **Subagent Role**: `QA Verifier`
* **Target Skill**: `.agents/skills/software-verification-and-qa/SKILL.md`
```markdown
View and adhere strictly to `.agents/skills/software-verification-and-qa/SKILL.md`.
Tasks: Run `oxlint`, 5-Tier Vitest testbench (`npm test`), Anti-Facade assertions scan, and production build (`npm run build`).
```

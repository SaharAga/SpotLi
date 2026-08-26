---
name: software-verification-and-qa
description: Quality assurance and test execution protocol. Use when running linters, typecheckers, automated unit/integration test suites, anti-facade assertions scans, or production build verifications. Do NOT use for code authoring or high-level architecture planning.
inputs:
  - Repository workspace root
  - List of modified files
outputs:
  - Structured QA Verification Report (PASS / FAIL) with command output and anti-facade results
---

# Software Verification & QA Protocol

This skill defines the automated quality gates, lint/type checks, and build validation commands.

---

## 1. Quality Gate Commands

Execute these commands in sequence (all must exit with status 0). Exit status
is the gate — warnings are expected output, not a failure: the `react-perf`
rules are enabled at `warn` as a worklist (`AGENTS.md` §9.1).

```bash
# 1. Linting & Static Analysis (this is the gate CI runs; do NOT add
#    `-D warnings` — react-perf runs at warn on purpose, see AGENTS.md §9.1)
npm run lint

# 2. Type Checking
npx tsc --noEmit --strict

# 3. Test Suite (Vitest)
npm test

# 4. Anti-Facade Scan
grep -rn "expect(true).toBe(true)\|expect(1).toBe(1)" src/
grep -rn "it\.skip\|test\.skip\|xit\|xtest\|xdescribe" src/

# 5. Production Build
npm run build
```

*(For detailed 5-Tier Testbench guidance and anti-facade rules, see `references/qa_verification_guide.md`)*

---

## 2. Structured QA Verification Report

```markdown
# 🧪 QA & Build Verification Report

## Overall Status: [ PASS | FAIL ]

### Gate Summary
| Gate | Command | Status | Notes |
|---|---|---|---|
| Linting | `oxlint -D warnings` | ✅ / ❌ | N errors / N warnings |
| Typecheck | `tsc --noEmit --strict` | ✅ / ❌ | N errors |
| Test Suite | `npm test` | ✅ Passed (N/N) / ❌ Failed | Pass count / Fail count |
| Anti-Facade | `grep expect(true)...` | ✅ Clean / ❌ Found | Dummy assertion scan |
| Build | `npm run build` | ✅ / ❌ | Production assets compiled |

### Diagnostics (if FAIL)
- **Failing Check**: [Command / test name]
- **Output / Error**: [Exact error message]
- **Remediation Action**: [Targeted fix instructions]
```

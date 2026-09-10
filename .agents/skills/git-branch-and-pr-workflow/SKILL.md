---
name: git-branch-and-pr-workflow
description: Enforces GitHub branch isolation, PR creation, and review guardlines. Activate whenever starting any new feature, bugfix, or refactoring task to ensure work is never committed directly to main.
inputs:
  - Feature, bugfix, or refactoring task description
  - Target repository context
outputs:
  - Dedicated feature branch
  - Clean commit history adhering to Conventional Commits
  - Pull Request ready for review and CI verification
---

# Git Branching, Pull Request & Guardline Workflow

This skill defines the mandatory Git workflow for all development and automated agent tasks in the SpotLi repository.

---

## 1. Golden Rule: Never Commit or Push Directly to `main`

The `main` branch is strictly protected:
* **Direct pushes to `main` are prohibited.**
* All code changes, bugfixes, and refactors MUST originate from an isolated feature/bugfix branch and merge exclusively via Pull Requests.
* Pull Requests MUST pass all CI quality checks (`lint`, `test`, `build`) and obtain Code Owner review before merging.

---

## 2. Standard Branching Strategy

### Branch Naming Conventions
All branch names must follow a standard prefix pattern:
* **Features**: `feat/<short-descriptive-name>` (e.g., `feat/package-bulk-delete`, `feat/carrier-auto-detect`)
* **Bug Fixes**: `fix/<short-descriptive-name>` (e.g., `fix/auth-token-refresh`, `fix/rtl-modal-alignment`)
* **Refactoring**: `refactor/<short-descriptive-name>` (e.g., `refactor/storage-adapter`)
* **Performance**: `perf/<short-descriptive-name>` (e.g., `perf/virtualized-list`)
* **CI/Infrastructure**: `chore/<short-descriptive-name>` (e.g., `chore/github-actions-ci`)

---

## 3. Step-by-Step Development Lifecycle

### Step 1: Synchronize with Upstream
Before starting any new work, ensure the local `main` is up to date:
```bash
git checkout main
git pull origin main
```

### Step 2: Create a Dedicated Feature Branch
Branch off `main` with the appropriate prefix:
```bash
git checkout -b feat/my-new-feature
```

### Step 3: Implement & Verify Changes Locally
While working on the feature branch:
1. Adhere to Clean Architecture and project standards.
2. Verify all quality gates pass locally before committing:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

### Step 4: Atomic, Conventional Commits
Write clear, structured commit messages adhering to the Conventional Commits specification:
* `feat: add package export to CSV feature`
* `fix: prevent duplicate tracking number submissions`
* `test: add unit tests for carrier detector`

```bash
git add <modified-files>
git commit -m "feat(packages): add bulk status update capability"
```

### Step 5: Push Branch & Open Pull Request
Push your feature branch to the remote repository:
```bash
git push -u origin feat/my-new-feature
```

Create a Pull Request against `main` using the repository's PR template:
* Fill in the description, change type, and 7-Stage SDLC quality checklist.
* Ensure all CI workflow jobs pass green.
* Request review from the designated Code Owner (`@SaharAga`).

---

## 4. Subagent & Automation Invariants

When autonomous agents or subagents execute tasks:
1. **Branch Isolation**: Agents must verify the active branch using `git status` or `git branch --show-current`. If on `main`, the agent MUST immediately create and switch to a feature branch before modifying code.
2. **No Force Pushing**: Never run `git push --force` on shared or protected branches.
3. **Clean Workspace**: Untracked scratch files must be cleaned or kept out of git tracking (`.gitignore`).

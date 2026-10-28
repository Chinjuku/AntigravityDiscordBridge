---
name: review
description: Reviews features, recent code modifications, git diffs, commits, or pull requests in Antigravity. Performs rigorous architecture, security, performance, correctness, and edge-case evaluation with actionable feedback and structured summaries.
---

# Feature & Code Review Skill

This skill guides the agent in conducting thorough, senior-level code reviews for features, uncommitted changes, recent commits, or branch diffs within Antigravity IDE and connected environments (such as the Discord Bridge).

## When to Use This Skill

Activate this skill when:
- The user asks to review code, a feature, or recent modifications (e.g., "review this feature", "review my code", "check git diff").
- The user runs the `/review` slash command in Antigravity IDE or on Discord.
- A pull request, branch diff, or uncommitted worktree changes need evaluation before commit or deployment.
- Verifying code quality, security posture, edge case handling, and architectural consistency.

---

## Review Process & Step-by-Step Workflow

### Step 1: Establish Scope and Inspect Changes

1. **Detect Changes**:
   - For **Uncommitted Changes** (default when active in IDE):
     ```bash
     git status -s
     git diff
     ```
   - For **Specific Feature**:
     - Locate all files related to the feature (e.g., components, routes, services, schemas, tests).
     - Check git history for recent commits touching the feature:
       ```bash
       git log -n 5 --stat -- "<path/to/feature>"
       ```
   - For **Recent Commit / PR / Branch**:
     ```bash
     # Latest commit:
     git log -1 -p
     # Or branch diff against main:
     git diff $(git merge-base HEAD origin/main 2>/dev/null || echo "main")..HEAD
     ```
2. **Identify Callers and Affected Surfaces**:
   - Grep for functions, classes, or types modified by the change across the codebase to ensure callers, tests, and configuration remain consistent.

---

### Step 2: Multi-Dimensional Evaluation

Evaluate the code against five core dimensions:

1. **Architecture & Scope (Ponytail Senior Dev Principles)**:
   - Does this change solve the problem with the least necessary new code?
   - Is there premature abstraction, redundant boilerplate, or unused flexibility?
   - Are existing patterns, helpers, and conventions in the codebase respected?
2. **Correctness & Edge Cases**:
   - Are null, undefined, and empty inputs safely handled?
   - Are asynchronous operations (Promises, async/await, race conditions, timeouts) handled properly?
   - Are error handling and rollback semantics intact?
3. **Security & Boundary Protection**:
   - Are user inputs sanitized and validated at trust boundaries?
   - Are credentials, tokens, or sensitive data inadvertently logged or committed?
   - Are access control and authorization checks properly enforced?
4. **Performance & Resource Hygiene**:
   - Are there avoidable N+1 queries, heavy loops, or redundant re-renders?
   - Are connections, streams, intervals, or child processes properly closed/cleaned up?
5. **Testing & Documentation Integrity**:
   - Do existing tests still pass, or do new non-trivial branches have verification?
   - Are comments focused on "why" rather than repeating what the code obviously does?

---

### Step 3: Produce Structured Review Output

Structure the review report clearly using the following template:

```markdown
# 🔍 Code & Feature Review: <Feature Name or Scope>

## 📋 Overview
- **Scope**: `<e.g. Uncommitted changes in 4 files / Feature: Auth Flow>`
- **Files Touched**:
  - `path/to/file1.ts` (Core logic)
  - `path/to/file2.test.ts` (Tests)

---

## 🌟 Highlights & Strengths
- What was done well, elegant patterns, or good safety measures noticed.

---

## ⚠️ Findings & Recommendations

### 🔴 Critical Issues (Must fix before merge)
*If any bugs, security flaws, or breaking regressions exist:*
- **Issue**: Description of the defect.
- **Location**: `path/to/file.ts#L42`
- **Fix**:
  ```diff
  - buggyLine()
  + safeLine()
  ```

### 🟡 Warnings & Edge Cases (Should fix)
- Logic edge cases, missing error boundaries, or potential performance bottlenecks.

### 🟢 Suggestions & Cleanups (Optional polish)
- Simplifications, code-shortening opportunities, or documentation touch-ups.

---

## 🏁 Verdict
**[✅ APPROVED / ⚠️ NEEDS IMPROVEMENTS / ❌ ACTION REQUIRED]**
- Summary sentence of overall readiness and next recommended step.
```

---

### Step 4: Bridge / Discord Integration (If Triggered via Discord)

If running in headless mode or triggered via the Discord Bridge:
- Keep the summary punchy and formatted in Discord-compatible markdown.
- At completion, if `report-agent` CLI is installed, send a notification:
  ```bash
  report-agent completed "Code review completed for <Feature>" "<modified files>"
  ```


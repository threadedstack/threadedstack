---
name: verify-completion
description: "Mandatory verification before claiming any task is complete. Forces evidence-based completion claims — runs type checks, tests, and audits deliverables against the original request. Use BEFORE reporting any implementation as done."
---

# Completion Verification

You MUST run this verification before claiming any implementation work is complete.
This is not optional. This is not skippable. Skipping this skill means the work is NOT done.

## IMPORTANT RULES
- **NEVER commit, push, or modify git history** — only read-only git commands
- **NEVER skip a step** — if a step fails, fix the issue and re-run, don't skip it
- **NEVER claim success without evidence** — paste actual command output, not "it passed"
- Include anti-laziness rules in all subagent prompts

## Step 1: Enumerate Deliverables

List every discrete thing the user asked for. Be exhaustive. If the user said "add X, update Y, and fix Z," that's three deliverables — not one.

Format:
```
REQUESTED DELIVERABLES:
1. [deliverable 1] — STATUS: [DONE | INCOMPLETE | NOT STARTED]
2. [deliverable 2] — STATUS: [DONE | INCOMPLETE | NOT STARTED]
...
```

If ANY deliverable is INCOMPLETE or NOT STARTED, stop here and either:
- Do the work now
- Explain to the user exactly what's missing and why

Do NOT proceed to Step 2 with incomplete deliverables.

## Step 2: Identify Affected Repos

Run `git diff --name-only` and `git diff --name-only --cached` and `git status` to identify all changed files. Group them by sub-repo.

```bash
git diff --name-only
git diff --name-only --cached
git status
```

List the affected repos (e.g., backend, domain, admin, threads, etc.).

## Step 3: Run Type Checks

For EACH affected repo, run type checks:

```bash
cd repos/<repo> && pnpm types
```

Or run all at once:
```bash
pnpm types
```

**PASTE THE OUTPUT.** Do not summarize. Do not say "types pass" without evidence.

If types fail:
1. Fix the type errors
2. Re-run type checks
3. Repeat until clean

## Step 4: Run Unit Tests

For EACH affected repo that has tests:

```bash
cd repos/<repo> && pnpm test
```

**PASTE THE OUTPUT.** Include pass/fail counts.

If tests fail:
1. Read the failure output
2. Fix the failing tests or the code causing failures
3. Re-run tests
4. Repeat until green

## Step 5: Run Integration Tests (if applicable)

If the changes touch:
- Backend API endpoints
- Proxy routing
- Database schema/services
- Authentication/authorization
- Cross-repo behavior

Then run integration tests:

```bash
cd repos/integration && pnpm test
```

Or for specific test files:
```bash
cd repos/integration && npx vitest run --config configs/vitest.config.ts src/tier3/<relevant-test>.test.ts
```

**PASTE THE OUTPUT.**

If you believe integration tests are not applicable, state WHY explicitly.

## Step 6: Scan for Deferred Work

Search your own changes for any laziness patterns:

```bash
git diff | grep -inE '(TODO|FIXME|HACK|XXX|for now|temporary|placeholder|will (fix|handle|implement)|stub|not implemented)'
```

If this finds ANY matches in lines YOU added (lines starting with `+`):
1. Fix them — implement the actual functionality
2. Re-run the scan
3. Repeat until clean

## Step 7: Adjacent Issues Audit

Thoroughly review the files you touched. For each file:
- Are there broken imports?
- Are there missing error handlers that neighboring code has?
- Are there type issues you introduced?
- Did you break any existing functionality?

If you find issues: **fix them now**. Do not note them for later.

## Step 8: Final Report

Output this report to the user:

```
## Completion Report

### Deliverables
1. [deliverable] — DONE (verified by: [what you ran])
2. [deliverable] — DONE (verified by: [what you ran])

### Verification Results
- Type checks: PASS (N repos checked)
- Unit tests: PASS (N tests across M repos)
- Integration tests: PASS / NOT APPLICABLE (reason: ...)
- Deferred work scan: CLEAN

### Adjacent Findings
- [any bugs/issues you found and fixed, or "None"]

### Gaps (if any)
- [anything not delivered, prominently listed with reason]
```

If you cannot fill in "PASS" for type checks and unit tests with actual evidence, **THE WORK IS NOT DONE.**

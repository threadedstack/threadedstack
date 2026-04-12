# Multi-Session Sandbox — Phase 6: Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE:** NEVER run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log` are allowed. Output commit messages as text — do NOT execute them. This applies to ALL subagents.

**Goal:** Verify all phases compile, pass tests, and build successfully across the entire monorepo.

**Prerequisites:** ALL prior phases must be complete:
- Phase 1: Domain Foundation (`repos/domain/`)
- Phase 2: Backend (`repos/backend/`)
- Phase 3: Threads (`repos/threads/`)
- Phase 4+5: TSA + Admin (`repos/tsa/`, `repos/admin/`)

**Spec:** `docs/superpowers/specs/2026-04-12-multi-session-sharing-design.md`
**Master Plan:** `docs/superpowers/plans/2026-04-12-multi-session-sharing.md` (Task 28)

---

### Task 1: Full Type Check & Build

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: All repos pass type checking.

If failures occur, identify which repo/file fails and fix the type error. Common issues:
- Missing `visibility` field when constructing `TSandboxSession` — add `visibility: ESandboxSessionVisibility.private`
- Missing `podOwnerUserId` field on `TOpenSession` — add to construction site
- Stale `sandboxId` parameter name — should be `sessionId` in Threads

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run builds in dependency order**

```
pnpm --filter @tdsk/domain build
pnpm --filter @tdsk/database build
pnpm --filter @tdsk/logger build
pnpm --filter @tdsk/backend build
pnpm --filter @tdsk/proxy build
pnpm --filter @tdsk/admin build
pnpm --filter @tdsk/threads build
```
Expected: All builds succeed.

- [ ] **Step 4: Review staged changes**

```
git status
git diff --stat
```

Review staged changes and ensure no unintended files are included. Verify no files were accidentally saved to the root directory.

- [ ] **Step 5: Output commit message**

Output a conventional commit message summarizing all changes. Do NOT run `git commit`.

Expected format:
```
feat(sandbox): add multi-session support and session sharing

- Allow multiple independent SSH shell sessions per sandbox
- Add session visibility toggle (public/private) for project-scoped sharing
- Add PlanLimits concurrent session cap per org (sandboxSessions field)
- Rekey Threads SPA session state from sandboxId to sessionId
- Add session picker page (/sandbox/:sandboxId) with reconnect/join/create
- Add tsa sessions list/share/unshare commands and --session flag on tsa ssh
- Update Admin ConnectModal with per-session list table
- Add ESandboxSessionVisibility enum and extend TSandboxSession/TShellSession
- Remove findShellSessionForSandbox (1:1 session limit)
- Add getShellSessionsForSandbox, getOrgShellSessionCount, updateSessionVisibility
```

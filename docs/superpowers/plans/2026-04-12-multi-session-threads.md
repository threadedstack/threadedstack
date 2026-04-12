<!-- --resume 93626c45-49fd-4222-987d-ddaa7cb47cd5 -->

# Multi-Session Sandbox — Phase 3: Threads Client Restructuring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE:** NEVER run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log` are allowed. Output commit messages as text — do NOT execute them. This applies to ALL subagents.

**Goal:** Rekey all Threads SPA session state from sandboxId to sessionId, enabling multiple independent sessions per sandbox and shared session support.

**Prerequisites:**
- Phase 1 (Domain Foundation) must be complete. Verify: `cd repos/domain && pnpm types` passes with `ESandboxSessionVisibility`, extended `TSandboxSession`, and `sandboxSessions` in `TPlanLimits`.
- Phase 2 (Backend) does NOT need to be complete — Threads is a client-side rewrite. The backend changes are server-side and will be available when deployed.

**Scope:** Only `repos/threads/` files. No other repos are touched.

**Spec:** `docs/superpowers/specs/2026-04-12-multi-session-sharing-design.md` (Section 11)
**Master Plan:** `docs/superpowers/plans/2026-04-12-multi-session-sharing.md` (Tasks 9-23)

**IMPORTANT:** This phase must be completed atomically — halfway through, the repo won't compile because some files will be rekeyed and others won't. All tasks must be completed before `pnpm types` or `pnpm build` will pass.

---

## Context: Current Architecture

All session state is keyed by `sandboxId` (one session per sandbox):
- **4 Jotai atoms:** `openSessionsAtom`, `sessionEventsAtom`, `sessionToolStateAtom`, `activeSessionAtom` — all use sandboxId as key
- **4 module-level Maps:** `connections`, `parsers`, `rawBuffers`, `terminalWriters` — all keyed by sandboxId
- **sessionStorage:** `shell_${sandboxId}` stores one sessionId
- **Routing:** `/session/:sandboxId`

**Target:** All state keyed by `sessionId`. `sandboxId` becomes a lookup property on `TOpenSession`. New `/sandbox/:sandboxId` route for session picker. New hooks for sandbox-scoped queries (`useSessionsForSandbox`, `useSandboxHasSession`, `useSandboxToolState`).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/sessions.types.ts` | Modify | Extend TOpenSession, update TOpenSessionOpts |
| `src/types/routes.types.ts` | Modify | Update ERoutePath enum |
| `src/constants/sessions.ts` | Create | ShellSessionsStorageKey constant |
| `src/utils/sessionStorage.ts` | Create | sessionStorage CRUD helpers |
| `src/state/accessors.ts` | Modify | Rekey all accessors sandboxId → sessionId, add getSessionsForSandbox |
| `src/state/selectors.ts` | Modify | Rekey hooks, add sandbox-scoped hooks |
| `src/actions/sessions/openSession.ts` | Modify | Rekey maps, new connect flow, new message types |
| `src/actions/sessions/closeSession.ts` | Modify | Rekey parameter |
| `src/actions/sessions/sendInput.ts` | Modify | Rekey parameter |
| `src/actions/sandboxes/stopSandbox.ts` | Modify | Multi-session close |
| `src/actions/sandboxes/restartSandbox.ts` | Modify | Multi-session restore |
| `src/actions/sandboxes/recreateSandbox.ts` | Modify | Multi-session clear |
| `src/routes/Routes.tsx` | Modify | Add sandbox picker route |
| `src/pages/Session/Session.tsx` | Modify | Route param → sessionId |
| `src/pages/Sandbox/Sandbox.tsx` | Create | Session picker page |
| `src/components/SessionTabs/SessionTabs.tsx` | Modify | Iterate by sessionId, multi-session labels |
| `src/components/SessionTabs/OpenSessionStrip.tsx` | Modify | Same as SessionTabs |
| `src/components/TerminalView/TerminalView.tsx` | Modify | Props sandboxId → sessionId |
| `src/components/ChatView/ChatView.tsx` | Modify | Props sandboxId → sessionId |
| `src/components/SmartInput/SmartInput.tsx` | Modify | Props sandboxId → sessionId |
| `src/components/ChatView/PermissionCard.tsx` | Modify | Props sandboxId → sessionId |
| `src/components/Session/SessionCommands.tsx` | Modify | Owner-gated actions, share toggle, new session btn |
| `src/components/Sidebar/NavSandboxItem.tsx` | Modify | Smart navigation, aggregate tool state |
| `src/pages/Project/Project.tsx` | Modify | Uses useSandboxHasSession |

---

Refer to the master plan `docs/superpowers/plans/2026-04-12-multi-session-sharing.md` Tasks 9-23 for the complete step-by-step implementation with full code for each task. The tasks are:

| Task | Title | Key Change |
|------|-------|------------|
| 9 | Types — TOpenSession & TOpenSessionOpts | Add `podOwnerUserId`, `visibility`; rename `reconnectSessionId` → `sessionId` |
| 10 | Constants & Utils — sessionStorage | Create `ShellSessionsStorageKey` constant + sessionStorage CRUD helpers |
| 11 | State — Rekey Accessors | All accessors sandboxId → sessionId; add `getSessionsForSandbox` |
| 12 | State — Rekey Selectors + New Hooks | Rekey hooks; add `useSessionsForSandbox`, `useSandboxHasSession`, `useSandboxToolState` |
| 13 | Actions — openSession Rekey + New Flow | Rekey module maps; new connect flow with `connected`/`joined`/`reconnected`/`visibility`/`user-joined`/`user-left` handling |
| 14 | Actions — closeSession & sendInput Rekey | Parameter changes sandboxId → sessionId |
| 15 | Actions — Sandbox Actions (stop/restart/recreate) | Multi-session close/restore/clear |
| 16 | Routes — Add Sandbox Picker Route | `ERoutePath.Session = session/:sessionId`; add `ERoutePath.Sandbox` route |
| 17 | Components — TerminalView, ChatView, SmartInput, PermissionCard | Props sandboxId → sessionId |
| 18 | Components — SessionTabs & OpenSessionStrip | Iterate by sessionId; multi-session tab labels |
| 19 | Components — SessionCommands (Owner-Gated) | Owner-only actions; share toggle; "Leave Session" for non-owners |
| 20 | Pages — Session.tsx (Rekey to sessionId) | Route param → sessionId; derive sandboxId from session |
| 21 | Pages — Sandbox.tsx (Session Picker) | New page: list/create/join sessions for a sandbox |
| 22 | Components — NavSandboxItem & Project Page | Smart navigation; aggregate tool state; `useSandboxHasSession` |
| 23 | Verify Types & Build | `pnpm types` + `pnpm build` |

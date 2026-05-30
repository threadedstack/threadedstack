<!-- --resume 6fff0f1c-d8d3-43db-a1f6-f87b962ad253 -->

# Multi-Session Sandbox — Phase 4+5: TSA CLI & Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE:** NEVER run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log` are allowed. Output commit messages as text — do NOT execute them. This applies to ALL subagents.

**Goal:** Add `tsa sessions` commands (list, share, unshare), `tsa ssh --session` flag, and update Admin ConnectModal with session list table.

**Prerequisites:**
- Phase 1 (Domain Foundation) must be complete. Verify: `cd repos/domain && pnpm types` passes with `ESandboxSessionVisibility`, extended `TSandboxSession`, and `sandboxSessions` in `TPlanLimits`.
- Phase 2 (Backend) and Phase 3 (Threads) do NOT need to be complete — TSA and Admin are independent clients.

**Scope:** Only `repos/tsa/` and `repos/admin/` files. No other repos are touched.

**Spec:** `docs/superpowers/specs/2026-04-12-multi-session-sharing-design.md` (Sections 9-10)
**Master Plan:** `docs/superpowers/plans/2026-04-12-multi-session-sharing.md` (Tasks 24-27)

---

## File Structure

### TSA (`repos/tsa/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/tasks/sessions.ts` | Create | `tsa sessions` list + share/unshare sub-commands |
| `src/tasks/ssh.ts` | Modify | Add `--session` flag for joining shared sessions |
| `src/tasks/index.ts` | Modify | Register new sessions task |

### Admin (`repos/admin/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/Sandboxes/ConnectModal.tsx` | Modify | Session list table replacing count chip |

---

Refer to the master plan `docs/superpowers/plans/2026-04-12-multi-session-sharing.md` Tasks 24-27 for the complete step-by-step implementation with full code for each task. The tasks are:

| Task | Title | Key Change |
|------|-------|------------|
| 24 | TSA — `tsa sessions` List Command | New task file + register in index; add `getSandboxSessions` to API client |
| 25 | TSA — `tsa ssh --session` Flag | Add `--session` option; implement shell WebSocket join path |
| 26 | TSA — `tsa sessions share/unshare` | Sub-tasks on sessions; WebSocket visibility toggle |
| 27 | Admin ConnectModal — Session List Table | Replace session count chip with per-session table rows |

### TSA Context

**Task registration pattern:** Tasks are exported from individual files and imported in `src/tasks/index.ts` into a `tasks: TTasks` object. Each task implements `TTask` with `name`, `alias`, `description`, `example`, `options`, and `action`.

**SSH task:** `repos/tsa/src/tasks/ssh.ts` spawns a native SSH process through the tunnel WebSocket. The `--session` flag adds an alternative path that connects via the shell WebSocket endpoint instead.

**Share/unshare:** Implemented as sub-tasks (`tasks` property) on the `sessions` task. They connect to the shell WebSocket, send a visibility control message, wait for confirmation, and print the result.

### Admin Context

**ConnectModal:** `repos/admin/src/components/Sandboxes/ConnectModal.tsx` currently shows a session count chip. Replace with a table listing each `TSandboxSession` with: truncated session ID, owner, visibility badge, connected-at timestamp, and "Copy ID" action for the current user's sessions.

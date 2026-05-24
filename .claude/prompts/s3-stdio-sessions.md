# Decouple Sandbox Sessions from Threads + S3 Stdio Streaming

## What this is

Implement the plan at `~/.claude/plans/scheduled-runs-were-recently-sunny-goblet.md`. Read it first; it has all the context, decisions, file paths, and code references you need.

## Background (so you don't need to re-investigate)

We investigated how sandbox sessions and scheduled runs track stdio and found several problems:

1. **Sandbox sessions co-opt the `threads` table.** Every shell connection creates a thread record with `sandboxId` and stores raw terminal bytes in a `ptyBuffer` (bytea) column. Threads should be an agent-only concept. The `ptyBuffer` is effectively dead code: unreachable during normal reconnection (the in-memory ptyRecorder always has data first), and not restored after backend restart (sessions aren't rehydrated, only pods are).

2. **`listSandboxThreads` is dead code.** The backend endpoint exists and the threads SPA has API client code wired up (`repos/threads/src/services/threadsApi.ts`, `loadThreadHistory.ts`), but zero components import or call those actions.

3. **Scheduled run output is stored in a single `output` text column** on `schedule_runs`, written as one blob after execution. No real-time streaming to UI, no stdout/stderr separation, and the column will bloat with large outputs.

4. **Both session and run stdio are stored in DB columns**, which doesn't scale. Session ptyBuffer is bytea on threads; run output is text on schedule_runs.

## What to implement

The plan has 5 phases. Execute them in order:

**Phase 1: S3 Object Store Service + Config** - Add `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` to backend. Create an object store service wrapping S3Client with `createUploadStream()`, `getObject()`, `deleteObject()`. All config via ENVs (`TDSK_S3_ENDPOINT`, `TDSK_S3_BUCKET`, `TDSK_S3_ACCESS_KEY_ID`, `TDSK_S3_SECRET_ACCESS_KEY`). Uses Civo's S3-compatible object store.

**Phase 2: Database Changes** - New `sandbox_sessions` table (session history with `stdoutKey`/`stderrKey` pointing to S3). Add `stdoutKey`/`stderrKey` to `schedule_runs`, drop `output` column. Drop `sandboxId` and `ptyBuffer` from `threads`. No migration needed; just drop columns directly.

**Phase 3: Session Stdio Streaming** - Replace `ptyRecorder` in `onShellConnect.ts` with two S3 PassThrough upload streams (stdout + stderr). Create `sandbox_sessions` record instead of thread. Remove thread creation entirely. Simplify reconnection to ring buffer only. Add `listSandboxSessions` and `getSandboxSessionOutput` endpoints.

**Phase 4: Schedule Run Stdio Streaming** - Replace `outputChunks[]` in `executor.ts` with two S3 upload streams. Add `getScheduleRunOutput` endpoint. Query param `?stream=stdout|stderr`.

**Phase 5: Cleanup** - Delete `listSandboxThreads`, `listSandboxThreadMessages`, dead threads SPA actions, `createPtyRecorder`, `appendOutput`. Update admin UI ScheduleRuns component.

## Key constraints

- **NEVER commit or modify git history** - user handles all commits manually
- All S3 config via environment variables, not values.yaml
- No backwards compatibility shims or data migration
- Store raw bytes to S3 (preserve ANSI); UI renders with xterm.js
- Stdout and stderr are separate S3 objects
- Active sessions stay in-memory only; `sandbox_sessions` table is for completed session history
- Ring buffer (1MB) stays for reconnection; ptyRecorder is removed entirely
- Load the relevant skill files before working on each repo (see CLAUDE.md for the skill file paths)

# Sync Session Cleanup Design

## Problem

Mutagen file sync runs as a separate daemon process on the user's machine. The `tsa` CLI starts sync sessions in that daemon, but several exit paths fail to terminate them. The orphaned daemon retries SSH connections via `tsa proxy` → tunnel WebSocket indefinitely, flooding the server with rapid connect/disconnect cycles. At scale, many users with orphaned sessions could degrade server performance.

### Root Cause

The tunnel endpoint (`/_/sandboxes/:id/tunnel`) is only used by `tsa proxy`, which serves as the SSH ProxyCommand for `tsa ssh` and Mutagen sync. Mutagen's daemon is independent of the `tsa` process lifecycle — when `tsa` exits without terminating sessions, the daemon persists and keeps retrying.

### Identified Cleanup Gaps

| Gap | Location | Severity |
|-----|----------|----------|
| `tsa logout` doesn't terminate sync sessions | `repos/tsa/src/tasks/logout.ts` | High |
| Daemon mode (`--daemon`) has no cleanup guidance | `repos/tsa/src/tasks/sync.ts:328-336` | Medium |
| No global signal handlers for crash cleanup | `repos/tsa/src/main.ts` | High |
| `stopDaemon()` defined but never called | `repos/tsa/src/services/sync/mutagenClient.ts:283-285` | Low |
| No server-side defense against orphaned tunnels | `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` | High |

## Solution: Lifecycle Hooks + Tunnel Rate Guard

Two-layer defense: the `tsa` CLI cleans up properly on every exit path (client-side), and the backend rejects pathological tunnel connection patterns (server-side).

## Client-Side: Lifecycle Cleanup

### 1. `tsa logout` Sync Termination

**File**: `repos/tsa/src/tasks/logout.ts`

Before removing credentials, terminate all active Mutagen sync sessions:

1. Instantiate `CliDriver` + `SyncManager`
2. Call `manager.status()` to list all sessions (no label filter)
3. Terminate each session via `driver.terminateSession()`
4. Then call `auth.logout()` as before

Best-effort: warn on failure but don't block logout. If Mutagen isn't running or has no sessions, this is a no-op.

```
tsa logout
  → Stopping 3 sync sessions...
  → Sync sessions stopped
  → Logged out
```

### 2. Global Signal Handlers in `main.ts`

**File**: `repos/tsa/src/main.ts`

Add `process.on('SIGINT')` and `process.on('SIGTERM')` handlers that clean up active sync sessions before exiting.

**Mechanism**: A module-level sync cleanup registry that tasks opt into:

- **New file**: `repos/tsa/src/utils/tasks/syncCleanupRegistry.ts`
  - Exports `registerSyncCleanup(sandboxId: string, manager: SyncManager)` — called by sync/ssh tasks when they start sessions
  - Exports `clearSyncCleanup()` — called when tasks clean up normally
  - Exports `runSyncCleanup()` — called by signal handlers to terminate registered sessions

- **`main.ts` changes**: Register SIGINT/SIGTERM handlers at startup that call `runSyncCleanup()` then `process.exit()`
  - 5-second timeout — if cleanup takes too long, force exit
  - Guard against double-invocation (user hits Ctrl+C twice)

- **`sync.ts` changes**: Call `registerSyncCleanup()` before foreground blocking, call `clearSyncCleanup()` in existing cleanup handler
- **`ssh.ts` changes**: Call `registerSyncCleanup()` after `autoStartSync()` succeeds, call `clearSyncCleanup()` in existing `finally` block

This catches the case where `tsa ssh` with auto-sync gets killed by a signal before the `finally` block runs. Node.js runs all registered signal handlers, so both the global handler and any task-level handler will fire. The global handler must be idempotent — `runSyncCleanup()` should no-op if `clearSyncCleanup()` was already called (i.e., the task cleaned up normally before the global handler ran). The registry uses a simple `Map` that `clearSyncCleanup()` empties, so a subsequent `runSyncCleanup()` finds nothing to do.

### 3. `tsa sync cleanup` Command

**File**: `repos/tsa/src/tasks/sync.ts` (new subtask)

A subtask that finds and terminates orphaned sessions:

1. `manager.status()` to list all sessions
2. Filter to sessions with status `errored` or `disconnected`
3. Terminate each via `driver.terminateSession()`
4. Report what was cleaned up

```
tsa sync cleanup
  → Found 2 orphaned sessions
  →   cli-sync (sb_ucahmrz) — errored
  →   project-sync (sb_abc123) — disconnected
  → Cleaned up 2 sessions
```

If no orphaned sessions exist, print "No orphaned sessions found".

### 4. Daemon Mode User Guidance

**File**: `repos/tsa/src/tasks/sync.ts:328-336`

The daemon mode exit path currently prints session details and returns silently. Add a clear message about how to stop:

```
File sync running in background. Use "tsa sync stop sb_xxx" to stop.
```

No new tracking mechanism needed — sessions are already labeled with `sandboxId` in Mutagen, so `tsa sync stop <sandbox-id>` and `tsa sync stop --all` already work via label selectors.

## Server-Side: Tunnel Rate Guard

### Overview

An in-memory rate guard in the tunnel handler that detects and throttles pathological connect/disconnect cycles. Legitimate SSH connections are unaffected.

**File**: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`

### Detection Logic

A tunnel connection is a "fast failure" if the WebSocket closes within 10 seconds of opening — before the SSH handshake completes or shortly after. Legitimate SSH sessions stay open for minutes to hours.

### Data Structure

Module-level `Map<string, number[]>` — sandbox ID to array of failure timestamps.

```typescript
const tunnelFailures = new Map<string, number[]>()
```

Entries are pruned lazily on each connection attempt: drop timestamps older than the rate window.

### Constants

```typescript
const TunnelRateWindow = 60_000      // 60s sliding window
const TunnelRateLimit = 5            // max fast failures per window
const TunnelFastCloseThreshold = 10_000  // connections shorter than 10s count as failures
const TunnelBlockDuration = 60_000   // block duration after threshold hit
```

These are code constants, not configuration. They can be tuned later if needed.

### Flow

1. **On tunnel connection** (after sandbox ID extraction, before auth/DB lookups):
   - Prune stale entries from `tunnelFailures` for this sandbox ID
   - If failure count >= `TunnelRateLimit`, check if the most recent failure is within `TunnelBlockDuration`
     - If yes: close WebSocket with code `4008`, message `Too many failed connections, retry later`
     - If no: clear the failures array (backoff expired, allow retry)
   - Proceed with normal auth/validation flow

2. **On tunnel close** (in the existing `cleanup()` function):
   - Calculate connection duration (close time - open time)
   - If duration < `TunnelFastCloseThreshold`, record a failure timestamp for this sandbox ID

3. **On successful bridge** (inside the existing `tcp.on('connect')` handler):
   - Clear the failures array for this sandbox ID immediately when TCP connects
   - A connection that reaches the TCP bridge is legitimate — even if it closes later due to SSH auth failure, the initial handshake succeeded, which orphaned Mutagen connections rarely achieve (they typically fail at auth or pod lookup before TCP)

### What It Doesn't Do

- Does not affect the `/shell` endpoint — only `/tunnel`
- Does not persist across backend restarts — clean slate is fine; orphaned clients re-trigger the guard quickly
- Does not require configuration or database changes
- Does not block legitimate reconnection attempts — the threshold is generous (5 failures in 60s)
- Does not log individual blocked connections at warn/error level — use debug to avoid log spam from the very problem we're solving

## Testing

### Unit Tests

**`repos/tsa/src/tasks/logout.test.ts`** (new or extended):
- Verify sync sessions are terminated before credentials are removed
- Verify logout succeeds even when Mutagen is not running
- Verify logout succeeds even when session termination fails (best-effort)

**`repos/tsa/src/utils/tasks/syncCleanupRegistry.test.ts`** (new):
- Register/clear/run lifecycle
- Multiple registrations (ssh + sync running simultaneously)
- Timeout behavior — cleanup completes within deadline

**`repos/tsa/src/tasks/sync.test.ts`** (extended):
- `cleanup` subtask filters to errored/disconnected sessions only
- `cleanup` subtask is a no-op when no orphaned sessions exist
- Daemon mode prints stop instructions

**`repos/backend/src/endpoints/sandboxes/onTunnelConnect.test.ts`** (new or extended):
- Connections below rate limit proceed normally
- Connections exceeding rate limit are rejected with 4008
- Backoff expiry allows new connections
- Successful long-lived connection resets the failure counter
- Fast close increments failure counter
- Independent sandbox IDs don't interfere with each other

## Files Changed

| File | Change |
|------|--------|
| `repos/tsa/src/tasks/logout.ts` | Add sync termination before credential removal |
| `repos/tsa/src/main.ts` | Register global SIGINT/SIGTERM handlers |
| `repos/tsa/src/utils/tasks/syncCleanupRegistry.ts` | New — cleanup registry for signal handlers |
| `repos/tsa/src/tasks/sync.ts` | Add `cleanup` subtask, add daemon mode message |
| `repos/tsa/src/tasks/ssh.ts` | Register sync cleanup for signal handler fallback |
| `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` | Add tunnel rate guard |

## Out of Scope

- **Mutagen daemon lifecycle management** (`stopDaemon()`): The daemon is lightweight and shared across all sandboxes. Stopping it aggressively could disrupt other active syncs. Not worth the complexity.
- **Backend push-notification to clients**: Would require a persistent side-channel to tell clients their sync is orphaned. Over-engineered for this problem.
- **Tunnel session TTL**: Disruptive to legitimate long-running syncs. The rate guard achieves the same goal without interrupting real work.
- **Shell-gated tunnels**: Would break `tsa sync --daemon` which is designed to run without an active shell.

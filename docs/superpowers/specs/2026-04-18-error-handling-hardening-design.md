# Error Handling & Edge Case Hardening Design

## Problem

A comprehensive audit of error handling and edge case resilience identified 10 issues that could cause user-visible failures, data loss, or operational problems during the beta launch. The core functionality works, but failure paths are underhandled — errors are silently swallowed, cleanup is incomplete, shutdown is ungraceful, and error messages leak internal details.

## Scope

10 targeted fixes organized by severity:

**Critical (user-visible failures):**
1. Graceful shutdown with WebSocket draining
2. Scheduler tick loop error handling
3. SSH error message sanitization

**High (data loss / reliability):**
4. Event batch flush retry
5. Sandbox delete guard (prevent deleting sandboxes with active sessions)
6. Pong timeout on WebSocket keepalive

**Medium (operational issues):**
7. Pod OOMKilled/Evicted reason reporting
8. TCP tunnel cleanup atomicity
9. Database error classification

**Deferred (acceptable for beta):**
- Quota fire-and-forget pattern is intentionally correct — quota drift is acceptable for beta, reconciliation mechanism is post-launch work

## 1. Graceful Shutdown with WebSocket Draining

### Problem

`repos/backend/src/utils/signals.ts` calls `server.close()` on SIGTERM but does not close active WebSocket connections or drain in-flight requests. The process hangs until K8s force-kills it at 30s, causing users to see "connection reset" errors on every deploy.

### Fix

Modify the signal handler to:
1. Stop the scheduler (prevent new ticks)
2. Close all WebSocket clients with code `1001` ("Going Away")
3. Call `server.close()` to stop accepting new connections
4. Set a 5-second timeout, then force `process.exit(0)`

The signal handler needs access to the WebSocketServer instance and the scheduler. The `signals()` function signature changes to accept these dependencies:

```typescript
export const signals = (
  server: Server,
  opts?: { wss?: WebSocketServer, scheduler?: Scheduler }
) => { ... }
```

The caller in `main.ts` passes the WebSocketServer and scheduler when available.

### Files
- Modify: `repos/backend/src/utils/signals.ts`
- Modify: Backend main entry point (where `signals()` is called)

## 2. Scheduler Tick Loop Error Handling

### Problem

`repos/backend/src/services/scheduler/scheduler.ts:42` — the `setInterval` callback calls `this.tick()` without `.catch()`. If `tick()` throws an unexpected error, it becomes an unhandled promise rejection. The scheduler silently stops working with no recovery.

### Fix

Add `.catch()` to the interval callback, matching the pattern already used for the initial tick at line 41:

```typescript
this.intervalId = setInterval(() => {
  this.tick().catch((err) =>
    logger.error(`[Scheduler] Periodic tick failed: ${err}`)
  )
}, 60_000)
```

The `tick()` method has internal try/catch (lines 57-104) that handles per-schedule errors, so this outer catch only fires for truly unexpected failures (e.g., the `#ticking` guard or top-level exceptions).

### Files
- Modify: `repos/backend/src/services/scheduler/scheduler.ts`

## 3. SSH Error Message Sanitization

### Problem

`repos/backend/src/endpoints/sandboxes/onShellConnect.ts` sends raw SSH error messages to WebSocket clients:

```typescript
ws.close(4005, `SSH connection failed: ${sshErr.message}`)
```

This can leak pod IP addresses, SSH configuration details, or internal network topology.

### Fix

Replace with a generic message. Server-side log keeps the full error:

```typescript
logger.error(`[Shell] SSH connection failed for pod ${podName}:`, sshErr.message)
ws.close(4005, `SSH connection failed`)
```

### Files
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

## 4. Event Batch Flush Retry

### Problem

`repos/backend/src/services/sandboxes/sandbox.ts` has three call sites where `flushEventBatch()` failures silently drop queued events. With 20+ events in a batch, a transient DB hiccup loses all of them.

### Fix

Replace the fire-and-forget `.catch(log)` with a single retry attempt at each of the three call sites:

```typescript
this.flushEventBatch(sessionId).catch(async (err) => {
  logger.warn('[Shell] Event batch flush failed, retrying once:', (err as Error).message)
  try {
    await this.flushEventBatch(sessionId)
  } catch (retryErr) {
    logger.error('[Shell] Event batch flush retry failed, events lost:', (retryErr as Error).message)
  }
})
```

One retry is sufficient — if the DB is down for two consecutive attempts, the events are genuinely lost. Retrying indefinitely would back up the queue and consume memory.

### Files
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts` (3 call sites)

## 5. Sandbox Delete Guard

### Problem

`repos/backend/src/endpoints/sandboxes/deleteSandbox.ts` deletes the sandbox config record without checking for active shell sessions. Active sessions become orphaned — SSH streams keep running, but reconnection breaks because the sandbox config is gone.

### Fix

Before deleting, check for active shell sessions and return `409 Conflict` if any exist:

```typescript
const activeSessions = sbService.getShellSessionsForSandbox(sandboxId)
if (activeSessions.length > 0) {
  throw new Exception(409, `Cannot delete sandbox with ${activeSessions.length} active session(s)`)
}
```

This requires a `getShellSessionsForSandbox(sandboxId)` method on the sandbox service. It filters the in-memory `shellSessions` map by `sandboxId` — a simple `Array.from(map.values()).filter(s => s.sandboxId === sandboxId)` operation.

### Files
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts` (add `getShellSessionsForSandbox` method)
- Modify: `repos/backend/src/endpoints/sandboxes/deleteSandbox.ts` (add guard check)

## 6. Pong Timeout on WebSocket Keepalive

### Problem

`onShellConnect.ts` and `onTunnelConnect.ts` both send WebSocket pings every 30 seconds, but never check if a pong comes back. If the client is dead (browser crash, network drop) but the TCP connection is still half-open, the server keeps pinging forever — accumulating zombie connections that consume resources.

### Fix

Use a `pongReceived` flag that resets on each pong and is checked before each ping:

```typescript
let pongReceived = true
ws.on('pong', () => { pongReceived = true })

const pingInterval = setInterval(() => {
  if (!pongReceived) {
    cleanup('Pong timeout')
    return
  }
  pongReceived = false
  if (ws.readyState === ws.OPEN) ws.ping()
}, 30_000)
```

If a pong is not received within one ping interval (30s), the connection is considered dead and is cleaned up. This is the standard WebSocket heartbeat pattern from the `ws` library documentation.

Apply to both `onShellConnect.ts` and `onTunnelConnect.ts`.

### Files
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`

## 7. Pod OOMKilled/Evicted Reason Reporting

### Problem

When a sandbox pod is evicted or OOM-killed, users see a generic "Pod terminated" message. The pod termination reason is available in `pod.status.containerStatuses[0]?.lastState?.terminated?.reason` but is not extracted or surfaced.

### Fix

In `repos/sandbox/src/kube/kubeClient.ts`, when a pod is detected as Failed in the watch handler, extract the termination reason and include it in the removal event. The `toContainerState()` helper or `shouldRemove()` method should read the reason and pass it through.

Then in the backend's sandbox service, when a pod removal is detected, include the reason in the WebSocket close message or event so the user sees "Pod was terminated: OOMKilled" instead of just "Pod terminated".

### Files
- Modify: `repos/sandbox/src/kube/kubeClient.ts` (extract termination reason)
- Modify: `repos/sandbox/src/kube/toContainerState.ts` (include reason in state)
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts` (forward reason to WebSocket)

## 8. TCP Tunnel Cleanup Atomicity

### Problem

`repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` — the cleanup function calls `removeSession()`, `tcp.destroy()`, and `ws.close()` sequentially. If any one throws, the subsequent steps are skipped — leaving dangling sockets or orphaned sessions.

### Fix

Wrap each cleanup step in its own try-catch:

```typescript
const cleanup = () => {
  if (closed) return
  closed = true
  if (pingInterval) clearInterval(pingInterval)
  try { sbService.removeSession(podName, sessionId) }
  catch (e) { logger.error('[Tunnel] removeSession failed:', (e as Error).message) }
  try { tcp.destroy() }
  catch (e) { logger.error('[Tunnel] tcp.destroy failed:', (e as Error).message) }
  if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
    try { ws.close() }
    catch (e) { logger.error('[Tunnel] ws.close failed:', (e as Error).message) }
  }
}
```

### Files
- Modify: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`

## 9. Database Error Classification

### Problem

`repos/database/src/services/base.ts` returns raw database errors without classification. All errors surface as HTTP 500, even when they should be 409 (unique constraint) or 400 (foreign key violation). Endpoints cannot distinguish error types to return appropriate status codes.

### Fix

Add error classification in the base service catch blocks. Common PostgreSQL error codes:
- `23505` — unique constraint violation (conflict, 409)
- `23503` — foreign key violation (bad reference, 400)
- `23502` — not-null violation (missing required field, 400)

Add a `status` hint to the return type:

```typescript
export type TDBApiRes<T> = {
  data?: T
  error?: Error
  status?: number
}
```

In each catch block in `base.ts`:

```typescript
catch (error: any) {
  const code = error?.code
  if (code === '23505') return { error: new Error('Record already exists'), status: 409 }
  if (code === '23503') return { error: new Error('Referenced record not found'), status: 400 }
  if (code === '23502') return { error: new Error('Missing required field'), status: 400 }
  return { error }
}
```

Endpoints can then use the status hint: `throw new Exception(result.status || 500, result.error.message)`. Existing endpoints that don't check `status` continue working unchanged (they default to 500).

### Files
- Modify: `repos/database/src/types/schema.types.ts` (add `status` to `TDBApiRes`)
- Modify: `repos/database/src/services/base.ts` (classify errors in catch blocks)

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Modify | `repos/backend/src/utils/signals.ts` | Graceful shutdown with WS draining |
| Modify | Backend main entry point | Pass WSS + scheduler to signals |
| Modify | `repos/backend/src/services/scheduler/scheduler.ts` | Tick loop error handling |
| Modify | `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | SSH error sanitization + pong timeout |
| Modify | `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` | Pong timeout + atomic cleanup |
| Modify | `repos/backend/src/endpoints/sandboxes/deleteSandbox.ts` | Active session guard |
| Modify | `repos/backend/src/services/sandboxes/sandbox.ts` | Event flush retry + getShellSessionsForSandbox + pod reason forwarding |
| Modify | `repos/sandbox/src/kube/kubeClient.ts` | Extract pod termination reason |
| Modify | `repos/sandbox/src/kube/toContainerState.ts` | Include reason in container state |
| Modify | `repos/database/src/services/base.ts` | Error classification |
| Modify | `repos/database/src/types/schema.types.ts` | Add status to TDBApiRes |

~11 modified files, 0 new files.

## Testing

- **Graceful shutdown:** Manual test — start backend, connect a WebSocket, send SIGTERM, verify WS receives close code 1001 and process exits within 5s.
- **Scheduler tick:** Unit test — mock `tick()` to throw, verify logger.error is called and interval continues.
- **SSH error sanitization:** Unit test — verify WS close message does not contain SSH details.
- **Event flush retry:** Unit test — mock flushEventBatch to fail once then succeed, verify retry and success.
- **Sandbox delete guard:** Unit test — mock active sessions, verify 409 response. Integration test — connect a shell session, try to delete sandbox, verify rejection.
- **Pong timeout:** Unit test — simulate missing pong, verify cleanup fires after one interval.
- **Pod reason reporting:** Unit test — mock pod status with OOMKilled reason, verify reason surfaces in event.
- **TCP cleanup atomicity:** Unit test — mock removeSession to throw, verify tcp.destroy and ws.close still execute.
- **DB error classification:** Unit test — simulate unique constraint violation, verify status=409 in response.

## Out of Scope

- Quota reconciliation mechanism (acceptable drift for beta, post-launch backlog)
- Pod liveness probes (K8s manifest change, separate from code hardening)
- K8s node capacity checks before pod creation (cluster-level concern)
- File descriptor limits (OS-level config, not code)
- Two-phase pod creation locking (race window is microseconds, extremely unlikely)

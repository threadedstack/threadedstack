# Error Handling & Edge Case Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 error handling and edge case vulnerabilities — graceful shutdown, scheduler resilience, error message sanitization, event persistence retry, WS keepalive, sandbox delete guards, pod reason reporting, cleanup atomicity, and DB error classification.

**Architecture:** 9 independent targeted fixes across backend, sandbox, and database repos. Each modifies 1-3 files with minimal blast radius. No new dependencies. Ordered from simplest to most complex.

**Tech Stack:** Node.js, Express 5, WebSocket (`ws`), K8s client, Drizzle ORM, Vitest

**Spec:** `docs/superpowers/specs/2026-04-18-error-handling-hardening-design.md`

---

### Task 1: Scheduler Tick Loop Error Handling

**Files:**
- Modify: `repos/backend/src/services/scheduler/scheduler.ts`

- [ ] **Step 1: Add .catch() to the setInterval callback**

In `repos/backend/src/services/scheduler/scheduler.ts`, find line 41:

```typescript
    this.intervalId = setInterval(() => this.tick(), 60_000)
```

Replace with:

```typescript
    this.intervalId = setInterval(() => {
      this.tick().catch((err) =>
        logger.error(`[Scheduler] Periodic tick failed: ${err}`)
      )
    }, 60_000)
```

This matches the pattern already used for the initial tick at the line above it.

- [ ] **Step 2: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 2: SSH Error Message Sanitization

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

- [ ] **Step 1: Sanitize the SSH error close message**

Find the SSH client error handler (around line 621-623):

```typescript
  sshClient.on(`error`, (sshErr) => {
    logger.error(`[Shell] SSH connection failed for pod ${podName}:`, sshErr.message)
    ws.close(4005, `SSH connection failed: ${sshErr.message}`)
  })
```

Replace the `ws.close` line only:

```typescript
  sshClient.on(`error`, (sshErr) => {
    logger.error(`[Shell] SSH connection failed for pod ${podName}:`, sshErr.message)
    ws.close(4005, `SSH connection failed`)
  })
```

The server-side log keeps the full error. The client only sees the generic message.

- [ ] **Step 2: Also sanitize the tunnel TCP error message**

In `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`, find the TCP error handler (around line 186):

```typescript
  tcp.on(`error`, (err) => {
    logger.error(`[Tunnel] TCP error for ${podName}:`, err.message)
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close(4005, `SSH connection to pod failed: ${err.message}`)
    }
    cleanup()
  })
```

Replace the `ws.close` line:

```typescript
      ws.close(4005, `SSH connection to pod failed`)
```

- [ ] **Step 3: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 3: Event Batch Flush Retry

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts`

- [ ] **Step 1: Add retry to the batch-size-triggered flush**

In `repos/backend/src/services/sandboxes/sandbox.ts`, find the `queueEventForPersistence` method. The batch-size flush (around line 618) currently reads:

```typescript
    if (batch.length >= 20) {
      this.flushEventBatch(sessionId).catch((err) => {
        logger.error('[Shell] Event batch flush failed:', (err as Error).message)
      })
      return
    }
```

Replace with:

```typescript
    if (batch.length >= 20) {
      this.flushEventBatch(sessionId).catch(async (err) => {
        logger.warn('[Shell] Event batch flush failed, retrying once:', (err as Error).message)
        try {
          await this.flushEventBatch(sessionId)
        } catch (retryErr) {
          logger.error('[Shell] Event batch flush retry failed, events lost:', (retryErr as Error).message)
        }
      })
      return
    }
```

- [ ] **Step 2: Add retry to the timer-triggered flush**

In the same method, the timer flush (around line 623) currently reads:

```typescript
    if (!this.eventBatchTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.flushEventBatch(sessionId).catch((err) => {
          logger.error('[Shell] Event batch flush failed:', (err as Error).message)
        })
      }, 2000)
      this.eventBatchTimers.set(sessionId, timer)
    }
```

Replace the inner flush call:

```typescript
    if (!this.eventBatchTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.flushEventBatch(sessionId).catch(async (err) => {
          logger.warn('[Shell] Event batch flush failed, retrying once:', (err as Error).message)
          try {
            await this.flushEventBatch(sessionId)
          } catch (retryErr) {
            logger.error('[Shell] Event batch flush retry failed, events lost:', (retryErr as Error).message)
          }
        })
      }, 2000)
      this.eventBatchTimers.set(sessionId, timer)
    }
```

- [ ] **Step 3: Add retry to the TTL cleanup flush**

In the `detachFromShellSession` method, the TTL timer flush (around line 605) currently reads:

```typescript
      session.ttlTimer = setTimeout(async () => {
        try {
          await this.flushEventBatch(sessionId)
        } catch (err) {
          logger.error(
            `[ShellSession] Flush failed during TTL cleanup for ${sessionId}:`,
            (err as Error).message
          )
        }
        this.removeShellSession(sessionId)
      }, this.ShellTtlMS)
```

Replace with:

```typescript
      session.ttlTimer = setTimeout(async () => {
        try {
          await this.flushEventBatch(sessionId)
        } catch (err) {
          logger.warn(
            `[ShellSession] Flush failed during TTL cleanup for ${sessionId}, retrying:`,
            (err as Error).message
          )
          try {
            await this.flushEventBatch(sessionId)
          } catch (retryErr) {
            logger.error(
              `[ShellSession] Flush retry failed during TTL cleanup for ${sessionId}, events lost:`,
              (retryErr as Error).message
            )
          }
        }
        this.removeShellSession(sessionId)
      }, this.ShellTtlMS)
```

- [ ] **Step 4: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 4: Pong Timeout on WebSocket Keepalive

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`

- [ ] **Step 1: Add pong timeout to shell connect**

In `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`, find the `startPingInterval` function (around line 115):

```typescript
  const startPingInterval = () => {
    pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping()
      else cleanup(`WebSocket no longer open`)
    }, WS_PING_INTERVAL)
  }
```

Replace with:

```typescript
  const startPingInterval = () => {
    let pongReceived = true
    ws.on(`pong`, () => { pongReceived = true })

    pingInterval = setInterval(() => {
      if (ws.readyState !== ws.OPEN) {
        cleanup(`WebSocket no longer open`)
        return
      }
      if (!pongReceived) {
        cleanup(`Pong timeout`)
        return
      }
      pongReceived = false
      ws.ping()
    }, WS_PING_INTERVAL)
  }
```

- [ ] **Step 2: Add pong timeout to tunnel connect**

In `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`, find the ping interval setup in the `tcp.on('connect')` handler (around line 163):

```typescript
    pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping()
      } else {
        cleanup()
      }
    }, 30_000)
```

Replace with:

```typescript
    let pongReceived = true
    ws.on(`pong`, () => { pongReceived = true })

    pingInterval = setInterval(() => {
      if (ws.readyState !== ws.OPEN) {
        cleanup()
        return
      }
      if (!pongReceived) {
        cleanup()
        return
      }
      pongReceived = false
      ws.ping()
    }, 30_000)
```

- [ ] **Step 3: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 5: TCP Tunnel Cleanup Atomicity

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`

- [ ] **Step 1: Wrap each cleanup step in try-catch**

Find the cleanup function (around line 147):

```typescript
  const cleanup = () => {
    if (closed) return
    closed = true
    if (pingInterval) clearInterval(pingInterval)
    sbService.removeSession(podName, sessionId)
    tcp.destroy()
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close()
    }
  }
```

Replace with:

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

- [ ] **Step 2: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 6: Sandbox Delete Guard

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/deleteSandbox.ts`

- [ ] **Step 1: Add getShellSessionsForSandbox method**

In `repos/backend/src/services/sandboxes/sandbox.ts`, add this method to the `SandboxService` class. Find an appropriate location near other shell session methods (near `getShellSession`, `removeShellSession`, etc.):

```typescript
  getShellSessionsForSandbox(sandboxId: string): string[] {
    const sessionIds: string[] = []
    for (const [sessionId, session] of this.shellSessions) {
      if (session.sandboxId === sandboxId) sessionIds.push(sessionId)
    }
    return sessionIds
  }
```

- [ ] **Step 2: Add guard to deleteSandbox endpoint**

Edit `repos/backend/src/endpoints/sandboxes/deleteSandbox.ts`. The current file is:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResource } from '@TBE/utils/auth/requireResource'

export const deleteSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    await requireResource(db.services.sandbox, id, `Sandbox`)

    const { data, error } = await db.services.sandbox.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
```

Add the active session check before the delete call. Replace the action body:

```typescript
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, sandbox: sbService } = req.app.locals
    const { id } = req.params

    await requireResource(db.services.sandbox, id, `Sandbox`)

    if (sbService) {
      const activeSessions = sbService.getShellSessionsForSandbox(id)
      if (activeSessions.length > 0) {
        throw new Exception(
          409,
          `Cannot delete sandbox with ${activeSessions.length} active session(s)`
        )
      }
    }

    const { data, error } = await db.services.sandbox.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
```

The `if (sbService)` guard handles the case where the sandbox service isn't initialized (e.g., in tests).

- [ ] **Step 3: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 7: Pod Termination Reason Reporting

**Files:**
- Modify: `repos/sandbox/src/kube/toContainerState.ts`
- Modify: `repos/sandbox/src/kube/kubeClient.ts`

- [ ] **Step 1: Extend toContainerState to extract termination reason**

The current `repos/sandbox/src/kube/toContainerState.ts` is:

```typescript
import { EContainerState } from '@tdsk/domain'
import { ContainerStatesSet } from '@TSB/constants/kube'

export const toContainerState = (phase?: string): EContainerState => {
  if (phase && ContainerStatesSet.has(phase)) return phase as EContainerState
  return EContainerState.Unknown
}
```

Add a helper to extract the termination reason from a pod's container statuses:

```typescript
import type { V1Pod } from '@kubernetes/client-node'
import { EContainerState } from '@tdsk/domain'
import { ContainerStatesSet } from '@TSB/constants/kube'

export const toContainerState = (phase?: string): EContainerState => {
  if (phase && ContainerStatesSet.has(phase)) return phase as EContainerState
  return EContainerState.Unknown
}

export const getTerminationReason = (pod: V1Pod): string | undefined => {
  const statuses = pod.status?.containerStatuses
  if (!statuses?.length) return undefined

  const terminated = statuses[0]?.lastState?.terminated ?? statuses[0]?.state?.terminated
  return terminated?.reason
}
```

- [ ] **Step 2: Log termination reason when removing pods**

In `repos/sandbox/src/kube/kubeClient.ts`, find the `hydrateSingle` method where `shouldRemove` is called (around line 227):

```typescript
  hydrateSingle(pod: k8s.V1Pod): void {
    if (this.shouldRemove(pod)) {
      this.removeFromCache(pod)
      return
    }
```

Add reason logging by importing and using `getTerminationReason`:

```typescript
  hydrateSingle(pod: k8s.V1Pod): void {
    if (this.shouldRemove(pod)) {
      const reason = getTerminationReason(pod)
      if (reason) {
        logger.info(
          `[KubeClient] Pod ${pod.metadata?.name} terminated: ${reason}`
        )
      }
      this.removeFromCache(pod)
      return
    }
```

Add the import at the top of the file:

```typescript
import { getTerminationReason } from '@TSB/kube/toContainerState'
```

- [ ] **Step 3: Verify sandbox tests pass**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass

---

### Task 8: Database Error Classification

**Files:**
- Modify: `repos/database/src/types/schema.types.ts`
- Modify: `repos/database/src/services/base.ts`

- [ ] **Step 1: Add status field to TDBApiResType**

In `repos/database/src/types/schema.types.ts`, find the `TDBApiResType` type (around line 203):

```typescript
export type TDBApiResType<T> = {
  data?: T
  error?: Error | DBError
}
```

Replace with:

```typescript
export type TDBApiResType<T> = {
  data?: T
  error?: Error | DBError
  status?: number
}
```

- [ ] **Step 2: Add error classification helper to base service**

In `repos/database/src/services/base.ts`, add a private method to the `Base` class that classifies PostgreSQL errors:

```typescript
  private classifyError(error: any): TDBApiRes<any> {
    const code = error?.code
    if (code === '23505') return { error: new DBError('Record already exists'), status: 409 }
    if (code === '23503') return { error: new DBError('Referenced record not found'), status: 400 }
    if (code === '23502') return { error: new DBError('Missing required field'), status: 400 }
    return { error }
  }
```

- [ ] **Step 3: Use classifyError in all catch blocks**

In `repos/database/src/services/base.ts`, replace each `catch (error: any) { return { error } }` block with `catch (error: any) { return this.classifyError(error) }`.

The methods to update are: `create`, `by`, `get`, `list`, `update`, `upsert`, `delete` — 7 catch blocks total.

For example, `create` changes from:

```typescript
    } catch (error: any) {
      return { error }
    }
```

To:

```typescript
    } catch (error: any) {
      return this.classifyError(error)
    }
```

Apply this same change to all 7 methods.

- [ ] **Step 4: Verify database tests pass**

Run: `cd repos/database && pnpm test`
Expected: All tests pass

---

### Task 9: Graceful Shutdown with WebSocket Draining

**Files:**
- Modify: `repos/backend/src/utils/signals.ts`
- Modify: `repos/backend/src/main.ts`

- [ ] **Step 1: Rewrite the signals module**

Replace the entire contents of `repos/backend/src/utils/signals.ts`:

```typescript
import type { Server as HTTP } from 'http'
import type { Server as HTTPS } from 'https'
import type { WebSocketServer } from 'ws'
import type { Scheduler } from '@TBE/services/scheduler'

import { logger } from './logger'
import { sigs } from '@TBE/constants/values'

const SHUTDOWN_TIMEOUT_MS = 5_000

type TSignalOpts = {
  wss?: WebSocketServer
  scheduler?: Scheduler
}

export const signals = (server: HTTP | HTTPS, opts?: TSignalOpts) => {
  let shuttingDown = false

  sigs.forEach((sig) => {
    process.on(sig, () => {
      if (shuttingDown) return
      shuttingDown = true

      logger.info(`Received ${sig}, starting graceful shutdown`)

      // 1. Stop the scheduler
      if (opts?.scheduler) {
        try { opts.scheduler.stop() }
        catch (e) { logger.error(`Failed to stop scheduler:`, (e as Error).message) }
      }

      // 2. Close all WebSocket connections
      if (opts?.wss) {
        opts.wss.clients.forEach((ws) => {
          try { ws.close(1001, `Server shutting down`) }
          catch (e) { /* client may already be closed */ }
        })
      }

      // 3. Stop accepting new connections
      server.close(() => {
        logger.info(`Server closed, exiting`)
        process.exit(0)
      })

      // 4. Force exit after timeout
      setTimeout(() => {
        logger.warn(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`)
        process.exit(1)
      }, SHUTDOWN_TIMEOUT_MS).unref()
    })
  })
}
```

- [ ] **Step 2: Pass WSS and scheduler to signals in main.ts**

The current `repos/backend/src/main.ts` calls `signals(server)` at line 35. The WebSocketServer is created inside `initServer()`. Read `repos/backend/src/server/server.ts` to understand how the WSS is created and returned, then pass it to `signals()`.

The implementer should read `repos/backend/src/server/server.ts` (specifically `initServer()`) to find where `createWSServer(app)` is called and how the `wss` is returned. Then modify `main.ts` to capture the WSS and pass it:

```typescript
  const { server, wss } = initServer()
  signals(server, { wss })
```

If `initServer()` doesn't currently return the `wss`, modify it to do so. The `createWSServer(app)` call returns `{ wss, onUpgrade }` — just return `wss` alongside the server.

- [ ] **Step 3: Verify tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 10: Type Check and Full Verification

**Files:** None — validation only

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: All repos type check cleanly

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass across all repos

- [ ] **Step 3: Verify backend build**

Run: `cd repos/backend && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Verify sandbox build**

Run: `cd repos/sandbox && pnpm build`
Expected: Build succeeds (if sandbox has a build script)

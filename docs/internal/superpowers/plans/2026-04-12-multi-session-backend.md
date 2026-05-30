<!-- --resume d49a6425-013b-49f0-acff-8cf32415fd2f -->

# Multi-Session Sandbox — Phase 2: Backend Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE:** NEVER run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log` are allowed. Output commit messages as text — do NOT execute them. This applies to ALL subagents.

**Goal:** Implement backend multi-session support: remove 1:1 shell session limit, add visibility toggle, project-scoped sharing auth, and PlanLimits enforcement.

**Prerequisites:** Phase 1 (Domain Foundation) must be complete. Verify by running `cd repos/domain && pnpm types` — it should pass with `ESandboxSessionVisibility`, extended `TSandboxSession`, and `sandboxSessions` in `TPlanLimits`.

**Scope:** Only `repos/backend/` files. No other repos are touched.

**Spec:** `docs/superpowers/specs/2026-04-12-multi-session-sharing-design.md` (Sections 4-8)
**Master Plan:** `docs/superpowers/plans/2026-04-12-multi-session-sharing.md` (Tasks 4-8)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/shellSession.types.ts` | Modify | Extend types with visibility, joined msg, podOwnerUserId |
| `src/services/sandboxes/sandbox.ts` | Modify | Remove old method, add new session query/count/visibility methods |
| `src/services/sandboxes/sandbox.test.ts` | Modify | Tests for new SandboxService methods |
| `src/endpoints/sandboxes/onShellConnect.ts` | Modify | 2-path flow, PlanLimits check, sharing auth, visibility toggle |

---

## Context: Current Architecture

**Shell Session Flow (current 3-path):** In `onShellConnect.ts`:
1. Path 1 (line 142): Explicit reconnect via `?sessionId=<id>` — checks `userId === session.userId`
2. Path 2 (line 170): `findShellSessionForSandbox(sandboxId, userId)` — finds ONE existing session, reattaches
3. Path 3 (line 192+): Create new SSH connection + PTY + thread

**Target 2-path flow:**
1. Path 1: Reconnect/Join — own session reconnection OR cross-user join of public sessions
2. Path 2: Create new session — with pod ownership check and PlanLimits enforcement

**SandboxService key methods:**
- `findShellSessionForSandbox(sandboxId, userId)` at line 556 — **TO BE REMOVED**
- `addShellSession(session)` at line 492
- `getShellSession(sessionId)` at line 488
- `attachToShellSession(sessionId, ws)` at line 519
- `detachFromShellSession(sessionId, ws)` at line 535
- `addSession(podName, session)` at line 307 — pod-level session for idle tracking

---

### Task 1: Backend Types — Shell Session Extensions

**Files:**
- Modify: `repos/backend/src/types/shellSession.types.ts`

- [ ] **Step 1: Extend TShellSession with visibility and projectId**

Add imports and new fields. Replace the full file:

```typescript
import type { WebSocket } from 'ws'
import type { Client, ClientChannel } from 'ssh2'
import type { TerminalParser, ESandboxSessionVisibility } from '@tdsk/domain'
import type { RingBuffer } from '@TBE/utils/ringBuffer'

export type TShellSession = {
  orgId: string
  userId: string
  sessionId: string
  sshClient: Client
  threadId: string
  sandboxId: string
  buffer: RingBuffer
  parser: TerminalParser
  sshStream: ClientChannel
  attachments: Set<WebSocket>
  ttlTimer: NodeJS.Timeout | null
  projectId?: string
  visibility: ESandboxSessionVisibility
}

export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `reconnect`; sessionId: string }
  | { type: `visibility`; visibility: ESandboxSessionVisibility }

export type TShellServerMsg =
  | {
      type: `connected`
      sessionId: string
      sandboxId: string
      runtime: string
      threadId: string
      podOwnerUserId: string
    }
  | { type: `reconnected`; sessionId: string; bufferedBytes: number; podOwnerUserId: string }
  | {
      type: `joined`
      sessionId: string
      sandboxId: string
      runtime: string
      threadId: string
      podOwnerUserId: string
    }
  | { type: `disconnected`; reason: string }
  | { type: `error`; message: string }
  | { type: `visibility`; sessionId: string; visibility: ESandboxSessionVisibility }
  | { type: `user-joined`; sessionId: string; userId: string }
  | { type: `user-left`; sessionId: string; userId: string }
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: Errors in `onShellConnect.ts` where `TShellSession` is constructed without `visibility`. This is expected — Task 4 fixes it.

- [ ] **Step 3: Stage changes**

```
git add repos/backend/src/types/shellSession.types.ts
```

### Task 2: Backend SandboxService — New Methods

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts`

- [ ] **Step 1: Remove findShellSessionForSandbox**

Delete lines 556-564 (the `findShellSessionForSandbox` method) entirely.

- [ ] **Step 2: Add getShellSessionsForSandbox method**

Add after the `getShellSession` method (after line 490):

```typescript
  getShellSessionsForSandbox(sandboxId: string): TShellSession[] {
    const result: TShellSession[] = []
    for (const session of this.shellSessions.values()) {
      if (session.sandboxId === sandboxId) result.push(session)
    }
    return result
  }
```

- [ ] **Step 3: Add getOrgShellSessionCount method**

Add after `getShellSessionsForSandbox`:

```typescript
  getOrgShellSessionCount(orgId: string): number {
    let count = 0
    for (const session of this.shellSessions.values()) {
      if (session.orgId === orgId) count++
    }
    return count
  }
```

- [ ] **Step 4: Add updateSessionVisibility method**

Add the import for `ESandboxSessionVisibility` at the top of the file (in the existing `@tdsk/domain` import block), then add the method:

```typescript
  updateSessionVisibility(
    sessionId: string,
    visibility: ESandboxSessionVisibility
  ): boolean {
    const shell = this.shellSessions.get(sessionId)
    if (!shell) return false

    shell.visibility = visibility

    for (const [podName, sessions] of this.sessions.entries()) {
      const match = sessions.find((s) => s.sessionId === sessionId)
      if (match) {
        match.visibility = visibility
        break
      }
    }

    return true
  }
```

- [ ] **Step 5: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: Errors in `onShellConnect.ts` due to the removed method call. Expected — Task 4 fixes it.

- [ ] **Step 6: Stage changes**

```
git add repos/backend/src/services/sandboxes/sandbox.ts
```

### Task 3: Backend SandboxService — Tests for New Methods

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.test.ts`

- [ ] **Step 1: Add test describe block for new session methods**

Add a new `describe` block at the end of the `SandboxService` describe (before the closing `})`). The tests operate on the in-memory maps directly, so they don't need K8s mocks:

```typescript
  describe(`shell session queries`, () => {
    it(`getShellSessionsForSandbox returns sessions matching sandboxId`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube, makeDb())

      const session1 = {
        sessionId: `s1`,
        sandboxId: `sb_aaa`,
        orgId: `org1`,
        userId: `u1`,
        threadId: `t1`,
        sshClient: {} as any,
        sshStream: {} as any,
        buffer: { clear: vi.fn() } as any,
        parser: {} as any,
        attachments: new Set() as any,
        ttlTimer: null,
        visibility: `private` as const,
      }
      const session2 = {
        ...session1,
        sessionId: `s2`,
        sandboxId: `sb_bbb`,
      }
      const session3 = {
        ...session1,
        sessionId: `s3`,
        sandboxId: `sb_aaa`,
      }

      svc.addShellSession(session1)
      svc.addShellSession(session2)
      svc.addShellSession(session3)

      const result = svc.getShellSessionsForSandbox(`sb_aaa`)
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.sessionId).sort()).toEqual([`s1`, `s3`])
    })

    it(`getOrgShellSessionCount counts sessions for org`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube, makeDb())

      const base = {
        sandboxId: `sb_aaa`,
        userId: `u1`,
        threadId: `t1`,
        sshClient: {} as any,
        sshStream: {} as any,
        buffer: { clear: vi.fn() } as any,
        parser: {} as any,
        attachments: new Set() as any,
        ttlTimer: null,
        visibility: `private` as const,
      }

      svc.addShellSession({ ...base, sessionId: `s1`, orgId: `org1` })
      svc.addShellSession({ ...base, sessionId: `s2`, orgId: `org1` })
      svc.addShellSession({ ...base, sessionId: `s3`, orgId: `org2` })

      expect(svc.getOrgShellSessionCount(`org1`)).toBe(2)
      expect(svc.getOrgShellSessionCount(`org2`)).toBe(1)
      expect(svc.getOrgShellSessionCount(`org3`)).toBe(0)
    })

    it(`updateSessionVisibility updates both shell and pod session maps`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube, makeDb())

      const shell = {
        sessionId: `s1`,
        sandboxId: `sb_aaa`,
        orgId: `org1`,
        userId: `u1`,
        threadId: `t1`,
        sshClient: {} as any,
        sshStream: {} as any,
        buffer: { clear: vi.fn() } as any,
        parser: {} as any,
        attachments: new Set() as any,
        ttlTimer: null,
        visibility: `private` as const,
      }
      svc.addShellSession(shell)
      svc.addSession(`pod1`, {
        orgId: `org1`,
        userId: `u1`,
        podName: `pod1`,
        sandboxId: `sb_aaa`,
        sessionId: `s1`,
        connectedAt: new Date().toISOString(),
        visibility: `private` as const,
      })

      const updated = svc.updateSessionVisibility(`s1`, `public` as any)
      expect(updated).toBe(true)

      const shellSession = svc.getShellSession(`s1`)
      expect(shellSession?.visibility).toBe(`public`)

      const podSessions = svc.getSessions(`pod1`)
      expect(podSessions[0].visibility).toBe(`public`)
    })

    it(`updateSessionVisibility returns false for unknown session`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube, makeDb())
      expect(svc.updateSessionVisibility(`nonexistent`, `public` as any)).toBe(false)
    })
  })
```

- [ ] **Step 2: Run tests**

Run: `cd repos/backend && pnpm test -- src/services/sandboxes/sandbox.test.ts`
Expected: All tests pass including the new ones.

- [ ] **Step 3: Stage changes**

```
git add repos/backend/src/services/sandboxes/sandbox.test.ts
```

### Task 4: Backend onShellConnect — Multi-Session + Sharing Flow

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

This is the largest backend change. The current 3-path flow (lines 142-190) is replaced with a 2-path flow.

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of the file:

```typescript
import { ESandboxSessionVisibility, PlanLimits } from '@tdsk/domain'
import type { ESubscriptionTier } from '@tdsk/domain'
import { PodLabelKeys } from '@tdsk/sandbox'
```

- [ ] **Step 2: Replace Path 1 (reconnect) and Path 2 (find existing) with new 2-path flow**

Replace lines 142-190 (the reconnection check + findShellSessionForSandbox block) with:

```typescript
  // 5. Handle reconnect/join via sessionId param
  if (reconnectSessionId) {
    const existing = sbService.getShellSession(reconnectSessionId)
    if (existing && existing.sandboxId === sandboxId) {
      if (existing.userId === userId) {
        // Own session reconnection
        const session = sbService.attachToShellSession(reconnectSessionId, ws)
        if (!session) {
          ws.close(4005, `Session expired during reconnection`)
          return
        }
        ;(ws as any).__shellSessionId = reconnectSessionId

        const buffered = session.buffer.drain()
        if (buffered.length > 0) ws.send(buffered)

        const podName = await sbService.findRunningPod(sandboxId, orgId)
        let podOwnerUserId = userId
        if (podName) {
          try {
            const pod = await kube.getPod(podName)
            podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? userId
          } catch {}
        }

        ws.send(
          JSON.stringify({
            type: `reconnected`,
            sessionId: reconnectSessionId,
            bufferedBytes: buffered.length,
            podOwnerUserId,
          })
        )

        wireWebSocket(ws, session, sbService, cleanup, podName)
        startPingInterval()
        return
      }

      // Cross-user join — verify public + project access
      if (existing.visibility !== ESandboxSessionVisibility.public) {
        ws.close(4003, `Session is not shared`)
        return
      }

      // Check project access
      const { data: sbConfig } = await db.services.sandbox.get(sandboxId)
      const sbProjects = sbConfig?.projects ?? []
      if (sbProjects.length > 0) {
        const { data: userRole } = await db.services.role.findByUserAndOrg(userId, orgId)
        if (!userRole) {
          ws.close(4003, `Not authorized to join this session`)
          return
        }
      }

      const session = sbService.attachToShellSession(reconnectSessionId, ws)
      if (!session) {
        ws.close(4005, `Session expired`)
        return
      }
      ;(ws as any).__shellSessionId = reconnectSessionId
      ;(ws as any).__joinedUserId = userId

      const buffered = session.buffer.drain()
      if (buffered.length > 0) ws.send(buffered)

      const podName = await sbService.findRunningPod(sandboxId, orgId)
      let podOwnerUserId = existing.userId
      if (podName) {
        try {
          const pod = await kube.getPod(podName)
          podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? existing.userId
        } catch {}
      }

      ws.send(
        JSON.stringify({
          type: `joined`,
          sessionId: reconnectSessionId,
          sandboxId,
          runtime: sbConfig?.config?.runtime ?? `custom`,
          threadId: session.threadId,
          podOwnerUserId,
        })
      )

      // Notify other attachments
      for (const client of session.attachments) {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify({ type: `user-joined`, sessionId: reconnectSessionId, userId }))
        }
      }

      wireWebSocket(ws, session, sbService, cleanup, podName)
      startPingInterval()
      return
    }
  }
```

- [ ] **Step 3: Add pod ownership and PlanLimits checks to Path 2 (create new session)**

After the pod ownership validation (around line 200), add the pod creator check and PlanLimits check:

```typescript
  // Verify requesting user is the pod creator
  let podOwnerUserId: string
  try {
    const pod = await kube.getPod(podName)
    podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? ``
  } catch (err) {
    logger.warn(`[Shell] Failed to get pod labels for ${podName}:`, (err as Error).message)
    ws.close(4004, `Pod not reachable`)
    return
  }

  if (podOwnerUserId !== userId) {
    ws.close(4003, `Cannot create sessions on a pod you did not start`)
    return
  }

  // Check PlanLimits concurrent session cap
  try {
    const { data: org } = await db.services.org.get(orgId)
    if (org?.userId) {
      const { data: sub } = await db.services.subscription.findByUser(org.userId)
      const tier = (sub?.tier ?? `free`) as ESubscriptionTier
      const limit = PlanLimits[tier].sandboxSessions
      if (limit !== -1) {
        const count = sbService.getOrgShellSessionCount(orgId)
        if (count >= limit) {
          ws.close(4029, `Session limit reached for your plan`)
          return
        }
      }
    }
  } catch (err) {
    logger.warn(`[Shell] PlanLimits check failed, allowing session:`, (err as Error).message)
  }
```

- [ ] **Step 4: Update session construction to include visibility and podOwnerUserId**

In the SSH `ready` handler where the `TShellSession` object is created (around line 275), add the new fields:

```typescript
      const session: TShellSession = {
        sessionId,
        sshClient,
        sshStream: stream,
        buffer: new RingBuffer(1024 * 1024),
        attachments: new Set([ws]),
        parser,
        threadId,
        userId,
        orgId,
        sandboxId,
        ttlTimer: null,
        projectId: sandbox?.projects?.[0]?.id ?? undefined,
        visibility: ESandboxSessionVisibility.private,
      }
```

Update the `TSandboxSession` construction (around line 306) to include visibility:

```typescript
      sbService.addSession(podName, {
        orgId,
        userId,
        podName,
        sessionId,
        sandboxId,
        connectedAt: new Date().toISOString(),
        projectId: sandbox?.projects?.[0]?.id ?? undefined,
        visibility: ESandboxSessionVisibility.private,
      })
```

Update the `connected` server message to include `podOwnerUserId`:

```typescript
      ws.send(
        JSON.stringify({
          type: `connected`,
          sessionId,
          sandboxId,
          runtime,
          threadId,
          podOwnerUserId,
        })
      )
```

- [ ] **Step 5: Stage changes**

```
git add repos/backend/src/endpoints/sandboxes/onShellConnect.ts
```

### Task 5: Backend wireWebSocket — Visibility Toggle & User Leave

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` (wireWebSocket function)
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts` (detachFromShellSession)

- [ ] **Step 1: Add visibility control message handling**

In the `wireWebSocket` function, inside the text frame handler (the `if (typeof data === 'string' || !isBinary)` block), add handling for the `visibility` message type after the existing `signal` handling:

```typescript
        if (msg.type === `resize`) {
          session.sshStream.setWindow(msg.rows, msg.cols, msg.rows * 16, msg.cols * 8)
        } else if (msg.type === `signal`) {
          if (msg.signal === `SIGINT`) session.sshStream.write(`\x03`)
          else if (msg.signal === `SIGTSTP`) session.sshStream.write(`\x1a`)
        } else if (msg.type === `visibility`) {
          // Only session owner can toggle visibility
          const authUserId = (ws as any).__joinedUserId ?? session.userId
          if (authUserId !== session.userId) return

          const newVis = msg.visibility as ESandboxSessionVisibility
          sbService.updateSessionVisibility(session.sessionId, newVis)
          session.visibility = newVis

          for (const client of session.attachments) {
            if (client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: `visibility`,
                  sessionId: session.sessionId,
                  visibility: newVis,
                })
              )
            }
          }
        }
```

- [ ] **Step 2: Add user-left notification on detach**

In `repos/backend/src/services/sandboxes/sandbox.ts`, update `detachFromShellSession` to broadcast user-left for public sessions:

```typescript
  detachFromShellSession(sessionId: string, ws: import('ws').WebSocket) {
    const session = this.shellSessions.get(sessionId)
    if (!session) return

    session.attachments.delete(ws)

    // Broadcast user-left if this is a public session
    if (session.visibility === ESandboxSessionVisibility.public) {
      const departingUserId = (ws as any).__joinedUserId ?? session.userId
      for (const client of session.attachments) {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: `user-left`,
              sessionId,
              userId: departingUserId,
            })
          )
        }
      }
    }

    if (session.attachments.size === 0) {
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
    }
  }
```

Add `ESandboxSessionVisibility` to the imports from `@tdsk/domain` at the top of `sandbox.ts` if not already added in Task 2.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: Clean exit, no type errors.

- [ ] **Step 4: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Stage changes**

```
git add repos/backend/src/endpoints/sandboxes/onShellConnect.ts repos/backend/src/services/sandboxes/sandbox.ts
```

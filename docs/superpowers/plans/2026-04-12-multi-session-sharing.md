# Multi-Session Sandbox Support & Session Sharing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE:** NEVER run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log` are allowed. Output commit messages as text — do NOT execute them. This applies to ALL subagents.

**Goal:** Allow multiple independent SSH shell sessions per sandbox and enable session sharing between project members.

**Architecture:** In-memory session state (no new DB tables). Backend removes the 1:1 shell session limit, adds visibility toggle and project-scoped sharing auth. Threads SPA rekeys all session state from sandboxId → sessionId. TSA CLI gets `tsa sessions` commands. PlanLimits enforces concurrent session cap per org.

**Tech Stack:** TypeScript, Express 5 WebSocket, Jotai (React state), ssh2, ghostty-web terminal, Vitest

**Spec:** `docs/superpowers/specs/2026-04-12-multi-session-sharing-design.md`

---

## File Structure

### Domain (`repos/domain/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/sandbox.types.ts` | Modify | Add `ESandboxSessionVisibility` enum, extend `TSandboxSession` |
| `src/types/payments.types.ts` | Modify | Add `sandboxSessions` to `TPlanLimits` |
| `src/constants/plans.ts` | Modify | Add `sandboxSessions` value per tier |

### Backend (`repos/backend/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/shellSession.types.ts` | Modify | Extend types with visibility, joined msg, podOwnerUserId |
| `src/services/sandboxes/sandbox.ts` | Modify | Remove old method, add new session query/count/visibility methods |
| `src/services/sandboxes/sandbox.test.ts` | Modify | Tests for new SandboxService methods |
| `src/endpoints/sandboxes/onShellConnect.ts` | Modify | 2-path flow, PlanLimits check, sharing auth, visibility toggle |

### Threads (`repos/threads/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/sessions.types.ts` | Modify | Extend TOpenSession, update TOpenSessionOpts |
| `src/types/routes.types.ts` | Modify | Update ERoutePath enum |
| `src/constants/sessions.ts` | Create | ShellSessionsStorageKey constant |
| `src/utils/sessionStorage.ts` | Create | sessionStorage CRUD helpers |
| `src/state/sessions.ts` | Modify | Atoms unchanged (generic Map keys) |
| `src/state/accessors.ts` | Modify | Rekey all accessors sandboxId → sessionId |
| `src/state/selectors.ts` | Modify | Rekey hooks, add sandbox-scoped hooks |
| `src/actions/sessions/openSession.ts` | Modify | Rekey maps, new connect flow, new message types |
| `src/actions/sessions/closeSession.ts` | Modify | Rekey parameter |
| `src/actions/sessions/sendInput.ts` | Modify | Rekey parameter |
| `src/actions/sessions/index.ts` | Modify | Re-export new utils |
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

### TSA (`repos/tsa/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/tasks/sessions.ts` | Create | `tsa sessions` list command |
| `src/tasks/sessionsShare.ts` | Create | `tsa sessions share/unshare` commands |
| `src/tasks/ssh.ts` | Modify | Add `--session` flag |
| `src/tasks/index.ts` | Modify | Register new tasks |

### Admin (`repos/admin/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/Sandboxes/ConnectModal.tsx` | Modify | Session list table replacing count chip |

---

## Phase 1: Domain Foundation

### Task 1: Domain Types — Visibility Enum & Extended TSandboxSession

**Files:**
- Modify: `repos/domain/src/types/sandbox.types.ts:243-250`

- [ ] **Step 1: Add ESandboxSessionVisibility enum**

In `repos/domain/src/types/sandbox.types.ts`, add the enum after the existing `TSandboxSession` type (after line 250):

```typescript
export enum ESandboxSessionVisibility {
  private = `private`,
  public = `public`,
}
```

- [ ] **Step 2: Extend TSandboxSession with visibility and projectId**

Replace the existing `TSandboxSession` type at lines 243-250:

```typescript
export type TSandboxSession = {
  orgId: string
  userId: string
  podName: string
  sandboxId: string
  sessionId: string
  projectId?: string
  connectedAt: string
  visibility: ESandboxSessionVisibility
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: Clean exit, no type errors.

- [ ] **Step 4: Stage changes**

```
git add repos/domain/src/types/sandbox.types.ts
```

### Task 2: Domain Types — TPlanLimits Extension

**Files:**
- Modify: `repos/domain/src/types/payments.types.ts:20-31`

- [ ] **Step 1: Add sandboxSessions to TPlanLimits**

In `repos/domain/src/types/payments.types.ts`, add to the `TPlanLimits` type (after the `additionalSeats` field at line 30):

```typescript
export type TPlanLimits = {
  organizations: number
  projects: number
  compute: number
  threads: number
  messages: number
  endpoints: number
  secrets: number
  retention: number
  seats: number
  additionalSeats: boolean
  sandboxSessions: number
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: Errors in `repos/domain/src/constants/plans.ts` because `sandboxSessions` is now required but not yet provided. This is expected — Task 3 fixes it.

- [ ] **Step 3: Stage changes**

```
git add repos/domain/src/types/payments.types.ts
```

### Task 3: Domain Constants — PlanLimits Values

**Files:**
- Modify: `repos/domain/src/constants/plans.ts:4-53`

- [ ] **Step 1: Add sandboxSessions to each tier**

In `repos/domain/src/constants/plans.ts`, add `sandboxSessions` to each tier object. The field goes after `additionalSeats` in each tier:

For `free` (after line 15): `sandboxSessions: 1,`
For `solo` (after line 26): `sandboxSessions: 3,`
For `pro` (after line 37): `sandboxSessions: 10,`
For `team` (after line 48): `sandboxSessions: -1,`

- [ ] **Step 2: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: Clean exit, no type errors.

- [ ] **Step 3: Run domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Stage changes**

```
git add repos/domain/src/constants/plans.ts
```

---

## Phase 2: Backend

### Task 4: Backend Types — Shell Session Extensions

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
Expected: Errors in `onShellConnect.ts` where `TShellSession` is constructed without `visibility`. This is expected — Task 7 fixes it.

- [ ] **Step 3: Stage changes**

```
git add repos/backend/src/types/shellSession.types.ts
```

### Task 5: Backend SandboxService — New Methods

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
Expected: Errors in `onShellConnect.ts` due to the removed method call. Expected — Task 7 fixes it.

- [ ] **Step 6: Stage changes**

```
git add repos/backend/src/services/sandboxes/sandbox.ts
```

### Task 6: Backend SandboxService — Tests for New Methods

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

### Task 7: Backend onShellConnect — Multi-Session + Sharing Flow

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

### Task 8: Backend wireWebSocket — Visibility Toggle & User Leave

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` (wireWebSocket function)

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

In `SandboxService.detachFromShellSession` (in `sandbox.ts`), add a notification broadcast after the WebSocket is removed from the set. Modify the method to accept an optional userId for the departing user:

In `repos/backend/src/services/sandboxes/sandbox.ts`, update `detachFromShellSession`:

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

---

## Phase 3: Threads Client

### Task 9: Threads Types — TOpenSession & TOpenSessionOpts

**Files:**
- Modify: `repos/threads/src/types/sessions.types.ts`

- [ ] **Step 1: Update types**

Replace the full file:

```typescript
import type { ESandboxSessionVisibility } from '@tdsk/domain'

export type TSandboxStatus = 'stopped' | 'starting' | 'running' | 'error'

export type TOpenSession = {
  runtime: string
  podName: string
  threadId: string
  sandboxId: string
  sessionId: string
  projectId: string
  podOwnerUserId: string
  visibility: ESandboxSessionVisibility
}

export type TOpenSessionOpts = {
  orgId: string
  run?: boolean
  sandboxId: string
  projectId: string
  sessionId?: string | null
}
```

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/types/sessions.types.ts
```

### Task 10: Threads Constants & Utils — sessionStorage

**Files:**
- Create: `repos/threads/src/constants/sessions.ts`
- Create: `repos/threads/src/utils/sessionStorage.ts`

- [ ] **Step 1: Create constants file**

```typescript
export const ShellSessionsStorageKey = `shell_sessions`
```

- [ ] **Step 2: Create sessionStorage utils**

```typescript
import { ShellSessionsStorageKey } from '@TTH/constants/sessions'

type TStoredSessions = Record<string, string[]>

function readMap(): TStoredSessions {
  try {
    const raw = sessionStorage.getItem(ShellSessionsStorageKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMap(map: TStoredSessions): void {
  sessionStorage.setItem(ShellSessionsStorageKey, JSON.stringify(map))
}

export function getStoredSessions(sandboxId: string): string[] {
  return readMap()[sandboxId] ?? []
}

export function storeSession(sandboxId: string, sessionId: string): void {
  const map = readMap()
  const list = map[sandboxId] ?? []
  if (!list.includes(sessionId)) list.push(sessionId)
  map[sandboxId] = list
  writeMap(map)
}

export function removeStoredSession(sandboxId: string, sessionId: string): void {
  const map = readMap()
  const list = (map[sandboxId] ?? []).filter((id) => id !== sessionId)
  if (list.length === 0) delete map[sandboxId]
  else map[sandboxId] = list
  writeMap(map)
}

export function clearStoredSessionsForSandbox(sandboxId: string): void {
  const map = readMap()
  delete map[sandboxId]
  writeMap(map)
}
```

- [ ] **Step 3: Stage changes**

```
git add repos/threads/src/constants/sessions.ts repos/threads/src/utils/sessionStorage.ts
```

### Task 11: Threads State — Rekey Accessors

**Files:**
- Modify: `repos/threads/src/state/accessors.ts`

- [ ] **Step 1: Rekey all session accessors from sandboxId to sessionId**

Replace the session-related accessor functions (lines 47-89). The atom keys are generic strings, so the atoms themselves don't change — only the parameter names in the accessor functions:

```typescript
export const getSessionEvents = (sessionId: string) =>
  store.get(sessionEventsAtom).get(sessionId) ?? []
export const setSessionEvents = (sessionId: string, events: TParsedEvent[]) => {
  const map = new Map(store.get(sessionEventsAtom))
  map.set(sessionId, events)
  store.set(sessionEventsAtom, map)
}
export const appendSessionEvent = (sessionId: string, event: TParsedEvent) => {
  const map = new Map(store.get(sessionEventsAtom))
  const events = [...(map.get(sessionId) ?? []), event]
  map.set(sessionId, events)
  store.set(sessionEventsAtom, map)
}

export const clearSessionEvents = (sessionId: string) => {
  const map = new Map(store.get(sessionEventsAtom))
  map.delete(sessionId)
  store.set(sessionEventsAtom, map)
}

export const getToolState = (sessionId: string) =>
  store.get(sessionToolStateAtom).get(sessionId) ?? 'idle'
export const setToolState = (sessionId: string, state: TToolState) => {
  const map = new Map(store.get(sessionToolStateAtom))
  map.set(sessionId, state)
  store.set(sessionToolStateAtom, map)
}

export const getOpenSessions = () => store.get(openSessionsAtom)
export const setOpenSession = (sessionId: string, session: TOpenSession) => {
  const map = new Map(store.get(openSessionsAtom))
  map.set(sessionId, session)
  store.set(openSessionsAtom, map)
}
export const removeOpenSession = (sessionId: string) => {
  const map = new Map(store.get(openSessionsAtom))
  map.delete(sessionId)
  store.set(openSessionsAtom, map)
}

export const getActiveSession = () => store.get(activeSessionAtom)
export const setActiveSession = (sessionId: string | null) =>
  store.set(activeSessionAtom, sessionId)

export const getSessionsForSandbox = (sandboxId: string): TOpenSession[] => {
  const all = store.get(openSessionsAtom)
  const result: TOpenSession[] = []
  for (const session of all.values()) {
    if (session.sandboxId === sandboxId) result.push(session)
  }
  return result
}
```

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/state/accessors.ts
```

### Task 12: Threads State — Rekey Selectors + New Hooks

**Files:**
- Modify: `repos/threads/src/state/selectors.ts`

- [ ] **Step 1: Rekey existing hooks and add new sandbox-scoped hooks**

Replace the session-related hooks (lines 42-50) and add new ones:

```typescript
export const useSessionEvents = (sessionId: string) => {
  const [eventsMap] = useRecState(sessionEventsAtom)
  return eventsMap.get(sessionId) ?? []
}

export const useToolState = (sessionId: string) => {
  const [stateMap] = useRecState(sessionToolStateAtom)
  return stateMap.get(sessionId) ?? ('idle' as TToolState)
}

export const useOpenSessions = () => useRecState(openSessionsAtom)[0]
export const useActiveSession = () => useRecState(activeSessionAtom)[0]

export const useSessionsForSandbox = (sandboxId: string): TOpenSession[] => {
  const [sessions] = useRecState(openSessionsAtom)
  return useMemo(() => {
    const result: TOpenSession[] = []
    for (const session of sessions.values()) {
      if (session.sandboxId === sandboxId) result.push(session)
    }
    return result
  }, [sessions, sandboxId])
}

export const useSandboxHasSession = (sandboxId: string): boolean => {
  const sessions = useSessionsForSandbox(sandboxId)
  return sessions.length > 0
}

export const useSandboxToolState = (sandboxId: string): TToolState => {
  const sessions = useSessionsForSandbox(sandboxId)
  const [stateMap] = useRecState(sessionToolStateAtom)
  for (const session of sessions) {
    const state = stateMap.get(session.sessionId)
    if (state && state !== `idle`) return state
  }
  return `idle` as TToolState
}
```

Add the needed imports at the top of the file:

```typescript
import { useMemo } from 'react'
import type { TOpenSession } from '@TTH/types'
```

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/state/selectors.ts
```

### Task 13: Threads Actions — openSession Rekey + New Flow

**Files:**
- Modify: `repos/threads/src/actions/sessions/openSession.ts`

This is the largest Threads file change. The module-level maps rekey from sandboxId to sessionId, and the connect flow handles new message types.

- [ ] **Step 1: Replace the full file**

```typescript
import type { TOpenSessionOpts } from '@TTH/types'
import type { TParsedEvent, TToolState, ESandboxSessionVisibility } from '@tdsk/domain'

import { toast } from 'sonner'
import { TerminalParser } from '@tdsk/domain'
import { apiService } from '@TTH/services/api'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { getStoredSessions, storeSession, removeStoredSession } from '@TTH/utils/sessionStorage'
import {
  setToolState,
  setOpenSession,
  getOpenSessions,
  getActiveSession,
  setActiveSession,
  removeOpenSession,
  appendSessionEvent,
} from '@TTH/state/accessors'

const RAW_BUFFER_MAX_BYTES = 1024 * 1024

const connections = new Map<string, WebSocket>()
const parsers = new Map<string, TerminalParser>()
const rawBuffers = new Map<string, string[]>()
const terminalWriters = new Map<string, Set<(data: string) => void>>()

export const getConnection = (sessionId: string) => connections.get(sessionId)
export const getParser = (sessionId: string) => parsers.get(sessionId)
export const getRawBuffer = (sessionId: string) => rawBuffers.get(sessionId) ?? []

export const subscribeTerminalData = (sessionId: string, cb: (data: string) => void) => {
  if (!terminalWriters.has(sessionId)) terminalWriters.set(sessionId, new Set())
  terminalWriters.get(sessionId)!.add(cb)
  return () => {
    terminalWriters.get(sessionId)?.delete(cb)
  }
}

export const openSession = async (opts: TOpenSessionOpts) => {
  const { sandboxId, orgId, projectId, run = true } = opts

  const connectResult = await sandboxApi.connect(orgId, projectId, sandboxId)
  if (connectResult.error)
    throw new Error(connectResult.error?.message ?? `Failed to connect to sandbox`)

  const shellToken = connectResult.data?.shellToken
  const podName = connectResult.data?.podName ?? ``

  const baseUrl = new URL(apiService.base)
  const wsProto = baseUrl.protocol === `https:` ? `wss:` : `ws:`
  const params = new URLSearchParams({ cols: `80`, rows: `24` })
  if (run) params.set(`run`, `true`)
  if (shellToken) params.set(`token`, shellToken)

  // Resolve session intent
  let targetSessionId: string | undefined
  if (opts.sessionId === null) {
    targetSessionId = undefined
  } else if (opts.sessionId) {
    targetSessionId = opts.sessionId
  } else {
    const stored = getStoredSessions(sandboxId)
    targetSessionId = stored[0]
  }
  if (targetSessionId) params.set(`sessionId`, targetSessionId)

  const wsUrl = `${wsProto}//${baseUrl.host}/_/sandboxes/${sandboxId}/shell?${params}`

  const ws = new WebSocket(wsUrl)
  // Use a temp key until we get the real sessionId from the server
  const tempKey = targetSessionId ?? `pending_${sandboxId}_${Date.now()}`
  connections.set(tempKey, ws)
  rawBuffers.set(tempKey, [])

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let sessionId = tempKey
    ws.binaryType = `arraybuffer`

    const setupSession = (msg: Record<string, any>) => {
      sessionId = msg.sessionId

      // Migrate from temp key to real sessionId
      if (tempKey !== sessionId) {
        connections.delete(tempKey)
        rawBuffers.delete(tempKey)
        connections.set(sessionId, ws)
        rawBuffers.set(sessionId, [])
      }

      const runtime = msg.runtime ?? `custom`
      const parser = new TerminalParser({
        runtime,
        onEvent: (parsedEvent: TParsedEvent) => appendSessionEvent(sessionId, parsedEvent),
        onToolState: (state: TToolState) => {
          setToolState(sessionId, state)
          if (state === `permission` && getActiveSession() !== sessionId) {
            toast.warning(`Sandbox needs permission`, { duration: 5000 })
          }
        },
        debounceMs: 100,
      })
      parsers.set(sessionId, parser)

      setOpenSession(sessionId, {
        sandboxId,
        sessionId,
        threadId: msg.threadId ?? ``,
        runtime,
        projectId,
        podName: msg.podName ?? podName,
        podOwnerUserId: msg.podOwnerUserId ?? ``,
        visibility: (msg.visibility ?? `private`) as ESandboxSessionVisibility,
      })
      setActiveSession(sessionId)
      storeSession(sandboxId, sessionId)
    }

    ws.onmessage = (event) => {
      if (typeof event.data === `string`) {
        let msg: Record<string, any>
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        try {
          if (msg.type === `connected` || msg.type === `joined`) {
            setupSession(msg)
            settled = true
            resolve()
          } else if (msg.type === `reconnected`) {
            setupSession(msg)
            settled = true
            resolve()
          } else if (msg.type === `visibility`) {
            const current = getOpenSessions()
            const existing = current.get(msg.sessionId)
            if (existing) {
              setOpenSession(msg.sessionId, {
                ...existing,
                visibility: msg.visibility,
              })
            }
          } else if (msg.type === `user-joined`) {
            toast.info(`User joined your session`, { duration: 3000 })
          } else if (msg.type === `user-left`) {
            toast.info(`User left your session`, { duration: 3000 })
          } else if (msg.type === `error`) {
            settled = true
            reject(new Error(msg.message))
          }
        } catch (err) {
          settled = true
          reject(err instanceof Error ? err : new Error(`Session setup failed`))
        }
        return
      }

      const data = new TextDecoder().decode(event.data)
      const buf = rawBuffers.get(sessionId)
      if (buf) {
        buf.push(data)
        let totalBytes = 0
        for (const chunk of buf) totalBytes += chunk.length
        while (totalBytes > RAW_BUFFER_MAX_BYTES && buf.length > 1) {
          totalBytes -= buf.shift()!.length
        }
      }
      parsers.get(sessionId)?.write(data)
      terminalWriters.get(sessionId)?.forEach((cb) => cb(data))
    }

    ws.onclose = (event: CloseEvent) => {
      if (connections.get(sessionId) !== ws) return
      parsers.get(sessionId)?.flush()
      connections.delete(sessionId)
      parsers.delete(sessionId)
      rawBuffers.delete(sessionId)
      terminalWriters.delete(sessionId)

      // Also clean temp key if still present
      if (tempKey !== sessionId) {
        connections.delete(tempKey)
        rawBuffers.delete(tempKey)
      }

      const session = getOpenSessions().get(sessionId)
      if (session) {
        removeOpenSession(sessionId)
        removeStoredSession(sandboxId, sessionId)
      }
      if (getActiveSession() === sessionId) {
        setActiveSession(null)
      }
      if (!settled) {
        settled = true
        const reason = event.reason || `Connection closed (code ${event.code})`
        toast.error(`Session failed`, { description: reason })
        reject(new Error(reason))
        return
      }
      if (event.code >= 4000) {
        toast.error(`Session disconnected`, {
          description: event.reason || `Connection closed (code ${event.code})`,
        })
      }
    }

    ws.onerror = () => {
      if (!settled) {
        settled = true
        toast.error(`Session failed`, { description: `WebSocket connection failed` })
        reject(new Error(`WebSocket connection failed`))
      }
    }
  })
}

```

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/actions/sessions/openSession.ts
```

### Task 14: Threads Actions — closeSession & sendInput Rekey

**Files:**
- Modify: `repos/threads/src/actions/sessions/closeSession.ts`
- Modify: `repos/threads/src/actions/sessions/sendInput.ts`

- [ ] **Step 1: Update closeSession**

Replace the full file:

```typescript
import {
  getOpenSessions,
  removeOpenSession,
  getActiveSession,
  setActiveSession,
} from '@TTH/state/accessors'
import { removeStoredSession } from '@TTH/utils/sessionStorage'
import { getConnection } from './openSession'

export const closeSession = (sessionId: string, opts?: { preserveStorage?: boolean }) => {
  const ws = getConnection(sessionId)
  if (ws) ws.close()

  const session = getOpenSessions().get(sessionId)
  removeOpenSession(sessionId)
  if (getActiveSession() === sessionId) setActiveSession(null)
  if (!opts?.preserveStorage && session) {
    removeStoredSession(session.sandboxId, sessionId)
  }
}
```

- [ ] **Step 2: Update sendInput**

Replace the full file:

```typescript
import { toast } from 'sonner'
import { getConnection, getParser } from './openSession'

export const sendInput = (sessionId: string, text: string): boolean => {
  const ws = getConnection(sessionId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  const parser = getParser(sessionId)
  parser?.trackInput(text)
  const encoder = new TextEncoder()
  ws.send(encoder.encode(text))
  return true
}

export const sendControl = (sessionId: string, msg: Record<string, unknown>): boolean => {
  const ws = getConnection(sessionId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify(msg))
  return true
}

export const approvePermission = (sessionId: string) => {
  if (!sendInput(sessionId, `y\n`)) {
    toast.error(`Could not send approval`, { description: `Session disconnected` })
  }
}

export const denyPermission = (sessionId: string) => {
  if (!sendInput(sessionId, `n\n`)) {
    toast.error(`Could not send denial`, { description: `Session disconnected` })
  }
}
```

- [ ] **Step 3: Stage changes**

```
git add repos/threads/src/actions/sessions/closeSession.ts repos/threads/src/actions/sessions/sendInput.ts
```

### Task 15: Threads Actions — Sandbox Actions (stop/restart/recreate)

**Files:**
- Modify: `repos/threads/src/actions/sandboxes/stopSandbox.ts`
- Modify: `repos/threads/src/actions/sandboxes/restartSandbox.ts`
- Modify: `repos/threads/src/actions/sandboxes/recreateSandbox.ts`

- [ ] **Step 1: Update stopSandbox — close ALL sessions for sandbox**

Replace the full file:

```typescript
import { sandboxApi } from '@TTH/services/sandboxApi'
import { getSessionsForSandbox } from '@TTH/state/accessors'
import { closeSession } from '@TTH/actions/sessions'

export type TStopSandboxOpts = {
  sandboxId: string
  orgId: string
}

export const stopSandbox = async (opts: TStopSandboxOpts): Promise<boolean> => {
  const { sandboxId, orgId } = opts
  const sessions = getSessionsForSandbox(sandboxId)
  if (sessions.length === 0) return false

  const { projectId, podName } = sessions[0]

  try {
    const resp = await sandboxApi.stop(orgId, projectId, sandboxId, podName)
    return !resp.error
  } finally {
    for (const session of sessions) {
      closeSession(session.sessionId, { preserveStorage: true })
    }
  }
}
```

- [ ] **Step 2: Update restartSandbox — restore ALL sessions**

Replace the full file:

```typescript
import { getSessionsForSandbox } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'

export type TRestartSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const restartSandbox = async (opts: TRestartSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts
  const sessions = getSessionsForSandbox(sandboxId)
  const sessionIds = sessions.map((s) => s.sessionId)

  await stopSandbox({ sandboxId, orgId })

  for (const sid of sessionIds) {
    await openSession({ sandboxId, orgId, projectId, sessionId: sid })
  }
}
```

- [ ] **Step 3: Update recreateSandbox — clear ALL, create one fresh**

Replace the full file:

```typescript
import { getSessionsForSandbox, clearSessionEvents } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { clearStoredSessionsForSandbox } from '@TTH/utils/sessionStorage'

export type TRecreateSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const recreateSandbox = async (opts: TRecreateSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts

  const sessions = getSessionsForSandbox(sandboxId)
  await stopSandbox({ sandboxId, orgId })
  clearStoredSessionsForSandbox(sandboxId)
  for (const session of sessions) {
    clearSessionEvents(session.sessionId)
  }
  await openSession({ sandboxId, orgId, projectId, sessionId: null })
}
```

- [ ] **Step 4: Stage changes**

```
git add repos/threads/src/actions/sandboxes/stopSandbox.ts repos/threads/src/actions/sandboxes/restartSandbox.ts repos/threads/src/actions/sandboxes/recreateSandbox.ts
```

### Task 16: Threads Routes — Add Sandbox Picker Route

**Files:**
- Modify: `repos/threads/src/types/routes.types.ts`
- Modify: `repos/threads/src/routes/Routes.tsx`

- [ ] **Step 1: Update ERoutePath**

In `repos/threads/src/types/routes.types.ts`, change the `Session` path to use sessionId and keep the existing `Sandbox` path:

```typescript
export enum EOrgSubPath {}

export enum ERoutePath {
  Home = `/`,
  Auth = `/auth`,
  Signin = `/auth/sign-in`,
  Signout = `/auth/sign-out`,
  AuthPage = `/auth/:pathname`,
  Profile = `profile`,
  Settings = `settings`,
  Project = `project/:projectId`,
  Sandbox = `sandbox/:sandboxId`,
  Session = `session/:sessionId`,
  Star = `*`,
}
```

- [ ] **Step 2: Add Sandbox route to router**

In `repos/threads/src/routes/Routes.tsx`, add the Sandbox page route after the Session route (around line 52). Add the lazy import at the top:

After the existing lazy imports (around line 8), add:

```typescript
const Sandbox = lazy(() => import(`@TTH/pages/Sandbox/Sandbox`))
```

In the children array, add after the Session route:

```typescript
        {
          path: ERoutePath.Sandbox,
          element: <SuspensePage><Sandbox /></SuspensePage>,
        },
```

- [ ] **Step 3: Stage changes**

```
git add repos/threads/src/types/routes.types.ts repos/threads/src/routes/Routes.tsx
```

### Task 17: Threads Components — TerminalView, ChatView, SmartInput, PermissionCard

These components all do the same change: replace `sandboxId` prop with `sessionId`.

**Files:**
- Modify: `repos/threads/src/components/TerminalView/TerminalView.tsx`
- Modify: `repos/threads/src/components/ChatView/ChatView.tsx`
- Modify: `repos/threads/src/components/SmartInput/SmartInput.tsx`
- Modify: `repos/threads/src/components/ChatView/PermissionCard.tsx`

- [ ] **Step 1: Update TerminalView**

Change the props interface and all internal references from `sandboxId` to `sessionId`. The component currently receives `{ sandboxId: string, active: boolean }` — change to `{ sessionId: string, active: boolean }`. Update all calls to `getRawBuffer(sessionId)`, `subscribeTerminalData(sessionId, ...)`, `sendInput(sessionId, ...)`, `sendControl(sessionId, ...)`.

- [ ] **Step 2: Update ChatView**

Change the interface `TChatView` from `{ sandboxId: string, readOnly?: boolean }` to `{ sessionId: string, readOnly?: boolean }`. Update `useSessionEvents(sessionId)`.

- [ ] **Step 3: Update PermissionCard**

Change props from `sandboxId: string` to `sessionId: string`. Update `approvePermission(sessionId)` and `denyPermission(sessionId)`.

- [ ] **Step 4: Update SmartInput**

Change all internal references from `sandboxId` to `sessionId`. Update `useToolState(sessionId)`, `sendInput(sessionId, ...)`, `sendControl(sessionId, ...)`, `approvePermission(sessionId)`, `denyPermission(sessionId)`.

- [ ] **Step 5: Stage changes**

```
git add repos/threads/src/components/TerminalView/TerminalView.tsx repos/threads/src/components/ChatView/ChatView.tsx repos/threads/src/components/SmartInput/SmartInput.tsx repos/threads/src/components/ChatView/PermissionCard.tsx
```

### Task 18: Threads Components — SessionTabs & OpenSessionStrip

**Files:**
- Modify: `repos/threads/src/components/SessionTabs/SessionTabs.tsx`
- Modify: `repos/threads/src/components/SessionTabs/OpenSessionStrip.tsx`

- [ ] **Step 1: Update SessionTabs**

The component iterates `openSessions` entries. Change:
- Tab value from `sandboxId` to `sessionId`
- Tab click navigation from `/session/${sandboxId}` to `/session/${sessionId}`
- `setActiveSession(sessionId)` instead of `setActiveSession(sandboxId)`
- `closeSession(sessionId)` instead of `closeSession(sandboxId)`
- `useToolState(sessionId)` instead of `useToolState(sandboxId)`
- Tab label: use sandbox name (look up from `useSandboxes()` by `session.sandboxId`). If multiple sessions exist for the same sandbox, append ` (N)` suffix.

- [ ] **Step 2: Update OpenSessionStrip**

Same changes as SessionTabs — rekey chip keys, navigation, close handlers, and tool state from sandboxId to sessionId.

- [ ] **Step 3: Stage changes**

```
git add repos/threads/src/components/SessionTabs/SessionTabs.tsx repos/threads/src/components/SessionTabs/OpenSessionStrip.tsx
```

### Task 19: Threads Components — SessionCommands (Owner-Gated)

**Files:**
- Modify: `repos/threads/src/components/Session/SessionCommands.tsx`

- [ ] **Step 1: Add owner-gating and new actions**

The component currently receives `sandboxId`, `projectId`, `onPendingOp`. Update to:

- Add `sessionId` and `isOwner` props
- Show stop/restart/recreate only when `isOwner` is true
- Add "New Session" button (calls `openSession({ sandboxId, ..., sessionId: null })`) — only when `isOwner`
- Add "Share" / "Unshare" toggle button — only when `isOwner`
  - Sends `sendControl(sessionId, { type: 'visibility', visibility: toggled })`
- Add "Leave Session" button — only when NOT `isOwner`
  - Calls `closeSession(sessionId)`

The visibility toggle reads the current session's visibility from the `openSessionsAtom`.

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/components/Session/SessionCommands.tsx
```

### Task 20: Threads Pages — Session.tsx (Rekey to sessionId)

**Files:**
- Modify: `repos/threads/src/pages/Session/Session.tsx`

- [ ] **Step 1: Update route param and session lookup**

Change `const { sandboxId } = useParams()` to `const { sessionId } = useParams()`.

Look up the session from the atom: `const session = openSessions.get(sessionId)`. Derive `sandboxId` from `session?.sandboxId`.

Update all child component props from `sandboxId` to `sessionId`:
- `<ChatView sessionId={sessionId} />`
- `<TerminalView sessionId={sessionId} active={...} />`
- `<SmartInput sessionId={sessionId} />`
- `<SessionCommands sessionId={sessionId} sandboxId={sandboxId} isOwner={isOwner} ... />`

Compute `isOwner` from `session?.podOwnerUserId === user?.id`.

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/pages/Session/Session.tsx
```

### Task 21: Threads Pages — Sandbox.tsx (Session Picker)

**Files:**
- Create: `repos/threads/src/pages/Sandbox/Sandbox.tsx`

- [ ] **Step 1: Create the session picker page**

This page shows when a user navigates to `/sandbox/:sandboxId`. It queries `listSessions` for the sandbox and shows:
- "My Sessions" — sessions owned by the current user (with "Reconnect" button)
- "Shared Sessions" — public sessions from other users (with "Join" button)
- "New Session" button at the bottom

If no sessions exist and no pod is running, show a "Start Session" button that calls `openSession({ sandboxId, ..., sessionId: null })`.

If exactly one own session exists, auto-navigate to `/session/${sessionId}`.

Create `repos/threads/src/pages/Sandbox/Sandbox.tsx` following the patterns from `Session.tsx` (Box layout, styled components, MUI components, `useParams`, `useNavigate`). The page fetches sessions via `sandboxApi.sessions(orgId, projectId, sandboxId)` on mount.

- [ ] **Step 2: Stage changes**

```
git add repos/threads/src/pages/Sandbox/Sandbox.tsx
```

### Task 22: Threads Components — NavSandboxItem & Project Page

**Files:**
- Modify: `repos/threads/src/components/Sidebar/NavSandboxItem.tsx`
- Modify: `repos/threads/src/pages/Project/Project.tsx`

- [ ] **Step 1: Update navigation logic and status indicators**

Replace the running status check from `openSessions.has(sandbox.id)` to `useSandboxHasSession(sandbox.id)`.

Replace the tool state color from `useToolState(sandbox.id)` to `useSandboxToolState(sandbox.id)`.

Update the navigation click handler:
- Get sessions for this sandbox: `const sessions = useSessionsForSandbox(sandbox.id)`
- If `sessions.length === 1`: navigate to `/session/${sessions[0].sessionId}`
- Otherwise: navigate to `/sandbox/${sandbox.id}`

- [ ] **Step 2: Update Project.tsx**

In `repos/threads/src/pages/Project/Project.tsx`, replace any `openSessions.has(sandbox.id)` checks with `useSandboxHasSession(sandbox.id)` from the new selectors. Import `useSandboxHasSession` from `@TTH/state/selectors`.

- [ ] **Step 3: Stage changes**

```
git add repos/threads/src/components/Sidebar/NavSandboxItem.tsx repos/threads/src/pages/Project/Project.tsx
```

### Task 23: Threads — Verify Types & Build

- [ ] **Step 1: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: Clean exit, no type errors.

- [ ] **Step 2: Run build**

Run: `cd repos/threads && pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Stage any remaining changes**

```
git add repos/threads/
```

---

## Phase 4: TSA CLI

### Task 24: TSA — `tsa sessions` List Command

**Files:**
- Create: `repos/tsa/src/tasks/sessions.ts`
- Modify: `repos/tsa/src/tasks/index.ts`

- [ ] **Step 1: Create sessions task**

Create `repos/tsa/src/tasks/sessions.ts` following the pattern from `sandboxes.ts`:

```typescript
import type { TTask } from '@TSA/types'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'

export const sessions: TTask = {
  name: `sessions`,
  alias: [`session`],
  description: `List active sessions for a sandbox`,
  example: `tsa sessions <sandbox-id>`,
  options: {},
  action: requireAuth(async (params, config) => {
    const sandboxId = params.__args?.[0]
    if (!sandboxId) {
      process.stderr.write(`Usage: tsa sessions <sandbox-id>\n`)
      process.exit(1)
    }

    const { orgId, projectId } = await resolveOrgProject(config)
    const resp = await config.api.getSandboxSessions(orgId, projectId, sandboxId)
    if (resp.error) {
      process.stderr.write(`Error: ${resp.error.message}\n`)
      process.exit(1)
    }

    const sessions = resp.data ?? []
    if (sessions.length === 0) {
      process.stdout.write(`No active sessions for sandbox ${sandboxId}\n`)
      return
    }

    process.stdout.write(`Sessions for sandbox ${sandboxId} (${sessions.length} active)\n\n`)
    process.stdout.write(`  ${'ID'.padEnd(20)} ${'Owner'.padEnd(20)} ${'Visibility'.padEnd(12)} Connected\n`)
    for (const s of sessions) {
      const id = s.sessionId.slice(0, 16).padEnd(20)
      const owner = s.userId.slice(0, 18).padEnd(20)
      const vis = s.visibility.padEnd(12)
      process.stdout.write(`  ${id} ${owner} ${vis} ${s.connectedAt}\n`)
    }
  }),
}
```

Note: The exact implementation depends on the `resolveOrgProject` helper pattern used in the TSA codebase. Adapt imports and helpers to match existing TSA task conventions (e.g., the `sandboxes` or `agents` task patterns).

- [ ] **Step 2: Register in index.ts**

In `repos/tsa/src/tasks/index.ts`, add the import and registration:

```typescript
import { sessions } from './sessions'
```

And add `sessions,` to the `tasks` object.

- [ ] **Step 3: Add getSandboxSessions to TSA API client**

If not already present in the TSA API service, add a method to call `GET /_/sandboxes/:id/sessions`. Follow the existing pattern from other sandbox API methods.

- [ ] **Step 4: Stage changes**

```
git add repos/tsa/src/tasks/sessions.ts repos/tsa/src/tasks/index.ts
```

### Task 25: TSA — `tsa ssh --session` Flag

**Files:**
- Modify: `repos/tsa/src/tasks/ssh.ts`

- [ ] **Step 1: Add --session option**

Add a `session` option to the SSH task's `options` object:

```typescript
  session: {
    alias: [`s`],
    description: `Join an existing shared session by ID (connects via shell WebSocket instead of SSH tunnel)`,
    example: `tsa ssh sb_abc --session sess_xy12ab`,
  },
```

- [ ] **Step 2: Implement shared session join path**

In the task's `action` handler, check if `params.session` is provided. If so, instead of spawning a native SSH process via `spawnSsh`, connect to the shell WebSocket endpoint with `?sessionId=<id>` and pipe stdin/stdout. This is a different connection mode than the normal SSH tunnel.

The implementation should:
1. Call `sandboxApi.connect(orgId, projectId, sandboxId)` to get the shell token
2. Open a WebSocket to `/_/sandboxes/${sandboxId}/shell?sessionId=${params.session}&token=${shellToken}`
3. Pipe WebSocket binary frames to `process.stdout`
4. Pipe `process.stdin` to WebSocket as binary frames
5. Handle `connected`/`joined`/`reconnected` JSON messages

- [ ] **Step 3: Stage changes**

```
git add repos/tsa/src/tasks/ssh.ts
```

### Task 26: TSA — `tsa sessions share/unshare`

**Files:**
- Create: `repos/tsa/src/tasks/sessionsShare.ts`

- [ ] **Step 1: Create share/unshare commands**

These can be sub-tasks of the `sessions` task, or separate tasks. Following the existing pattern, add them as sub-tasks by adding a `tasks` property to the `sessions` task object:

In `repos/tsa/src/tasks/sessions.ts`, add:

```typescript
  tasks: {
    share: {
      name: `share`,
      description: `Make a session public (shareable with project members)`,
      example: `tsa sessions share <session-id>`,
      action: requireAuth(async (params, config) => {
        const sessionId = params.__args?.[0]
        if (!sessionId) {
          process.stderr.write(`Usage: tsa sessions share <session-id>\n`)
          process.exit(1)
        }
        // Connect to shell WS and send visibility control message
        // Implementation: open WS, send { type: 'visibility', visibility: 'public' }, wait for confirmation, close
      }),
    },
    unshare: {
      name: `unshare`,
      description: `Make a session private`,
      example: `tsa sessions unshare <session-id>`,
      action: requireAuth(async (params, config) => {
        const sessionId = params.__args?.[0]
        if (!sessionId) {
          process.stderr.write(`Usage: tsa sessions unshare <session-id>\n`)
          process.exit(1)
        }
        // Same as share but with visibility: 'private'
      }),
    },
  },
```

The WebSocket connection for share/unshare should:
1. Resolve the sandboxId for the session (may need a sessions lookup endpoint or derive from local state)
2. Connect to `/_/sandboxes/${sandboxId}/shell?sessionId=${sessionId}` with API key auth
3. Send `{ type: 'visibility', visibility: 'public' | 'private' }` text frame
4. Wait for `{ type: 'visibility' }` confirmation
5. Print result and close

- [ ] **Step 2: Stage changes**

```
git add repos/tsa/src/tasks/sessions.ts
```

---

## Phase 5: Admin

### Task 27: Admin ConnectModal — Session List Table

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/ConnectModal.tsx`

- [ ] **Step 1: Replace session count chip with session list**

The ConnectModal currently shows `${sessions.length} session(s)` as a chip. Replace this with a table/list that renders each `TSandboxSession`:

- Each row shows: session ID (first 12 chars), owner userId, visibility badge (`private` | `public`), connected-at time (relative, e.g., "2 min ago")
- For the current user's sessions: add a "Copy ID" icon button that copies the full sessionId to clipboard
- Use existing MUI components (Table, TableRow, TableCell, Chip, IconButton)

The `TSandboxSession` type already includes `visibility` and `projectId` from the domain changes — no new API calls needed.

- [ ] **Step 2: Stage changes**

```
git add repos/admin/src/components/Sandboxes/ConnectModal.tsx
```

---

## Phase 6: Verification

### Task 28: Full Type Check & Build

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: All repos pass type checking.

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run builds**

Run in dependency order:
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

- [ ] **Step 4: Stage all remaining changes**

```
git add -A
git status
```

Review staged changes and ensure no unintended files are included.

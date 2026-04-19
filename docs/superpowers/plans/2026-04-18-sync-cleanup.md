# Sync Session Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent orphaned Mutagen sync sessions from flooding the server with rapid tunnel connect/disconnect cycles by adding client-side cleanup to every `tsa` CLI exit path and a server-side rate guard on the tunnel endpoint.

**Architecture:** Client-side: a sync cleanup registry in the `tsa` CLI that signal handlers and task lifecycle hooks call to terminate Mutagen sessions. Server-side: an in-memory rate guard in `onTunnelConnect.ts` that detects and blocks pathological connect/disconnect patterns per sandbox ID.

**Tech Stack:** TypeScript, Vitest, `tsa` CLI (Bun), Express backend, `ws` WebSocket library

**Spec:** `docs/superpowers/specs/2026-04-18-sync-cleanup-design.md`

**CRITICAL RULES FOR ALL TASKS:**
- **NEVER** run `git commit`, `git push`, or any git history modification — user handles all commits manually
- **NEVER** place shared/exported types next to related files — they go in the repo's `types/` directory
- **NEVER** add TODO/FIXME comments — implement fully or explain why you can't
- **NEVER** re-export from another package — update all callsites to import from the real source

---

### Task 1: Sync Cleanup Registry

Create the registry module that tracks active sync sessions for signal handler cleanup.

**Files:**
- Create: `repos/tsa/src/utils/tasks/syncCleanupRegistry.ts`
- Create: `repos/tsa/src/utils/tasks/syncCleanupRegistry.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// repos/tsa/src/utils/tasks/syncCleanupRegistry.test.ts
import type { IMutagenClient } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncManager } from '@TSA/services/sync/syncManager'
import {
  registerSyncCleanup,
  clearSyncCleanup,
  runSyncCleanup,
} from './syncCleanupRegistry'

const mockClient: IMutagenClient = {
  createSession: vi.fn().mockResolvedValue({}),
  terminateSession: vi.fn().mockResolvedValue(undefined),
  pauseSession: vi.fn().mockResolvedValue(undefined),
  resumeSession: vi.fn().mockResolvedValue(undefined),
  flushSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi.fn().mockResolvedValue([
    { id: `s1`, name: `app`, status: `watching`, labels: { sandboxId: `sb_1` } },
  ]),
  getSession: vi.fn().mockResolvedValue(null),
  ensureDaemon: vi.fn().mockResolvedValue(undefined),
  stopDaemon: vi.fn().mockResolvedValue(undefined),
}

describe(`syncCleanupRegistry`, () => {
  let manager: SyncManager

  beforeEach(() => {
    vi.clearAllMocks()
    clearSyncCleanup()
    manager = new SyncManager(mockClient)
  })

  it(`runSyncCleanup is a no-op when nothing is registered`, async () => {
    await runSyncCleanup()
    expect(mockClient.listSessions).not.toHaveBeenCalled()
  })

  it(`terminates sessions for registered sandbox on runSyncCleanup`, async () => {
    registerSyncCleanup(`sb_1`, manager)
    await runSyncCleanup()
    expect(mockClient.listSessions).toHaveBeenCalledWith({ sandboxId: `sb_1` })
    expect(mockClient.terminateSession).toHaveBeenCalledWith(`s1`)
  })

  it(`clearSyncCleanup prevents subsequent runSyncCleanup from acting`, async () => {
    registerSyncCleanup(`sb_1`, manager)
    clearSyncCleanup()
    await runSyncCleanup()
    expect(mockClient.listSessions).not.toHaveBeenCalled()
  })

  it(`supports multiple registrations`, async () => {
    const mockClient2: IMutagenClient = {
      ...mockClient,
      listSessions: vi.fn().mockResolvedValue([
        { id: `s2`, name: `config`, status: `watching`, labels: { sandboxId: `sb_2` } },
      ]),
      terminateSession: vi.fn().mockResolvedValue(undefined),
    }
    const manager2 = new SyncManager(mockClient2)

    registerSyncCleanup(`sb_1`, manager)
    registerSyncCleanup(`sb_2`, manager2)
    await runSyncCleanup()

    expect(mockClient.terminateSession).toHaveBeenCalledWith(`s1`)
    expect(mockClient2.terminateSession).toHaveBeenCalledWith(`s2`)
  })

  it(`swallows errors during cleanup without throwing`, async () => {
    ;(mockClient.listSessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error(`daemon not running`)
    )
    registerSyncCleanup(`sb_1`, manager)
    await expect(runSyncCleanup()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/syncCleanupRegistry.test.ts`
Expected: FAIL — module `./syncCleanupRegistry` not found

- [ ] **Step 3: Write the implementation**

```typescript
// repos/tsa/src/utils/tasks/syncCleanupRegistry.ts
import type { SyncManager } from '@TSA/services/sync/syncManager'

const entries = new Map<string, SyncManager>()

export const registerSyncCleanup = (sandboxId: string, manager: SyncManager): void => {
  entries.set(sandboxId, manager)
}

export const clearSyncCleanup = (): void => {
  entries.clear()
}

export const runSyncCleanup = async (): Promise<void> => {
  const snapshot = [...entries.entries()]
  entries.clear()

  for (const [sandboxId, manager] of snapshot) {
    try {
      await manager.stopAll(sandboxId)
    } catch {
      // Best-effort — daemon may already be stopped or sessions already gone
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/syncCleanupRegistry.test.ts`
Expected: All 5 tests PASS

---

### Task 2: Global Signal Handlers in main.ts

Wire the cleanup registry into global SIGINT/SIGTERM handlers so orphaned sessions are terminated even when task-level cleanup doesn't run.

**Files:**
- Modify: `repos/tsa/src/main.ts`

- [ ] **Step 1: Add signal handlers to main.ts**

Replace the full contents of `repos/tsa/src/main.ts` with:

```typescript
#!/usr/bin/env bun

import util from 'node:util'
import { main } from '@TSA/cli'
import { themed } from '@TSA/theme'
import { runSyncCleanup } from '@TSA/utils/tasks/syncCleanupRegistry'

util.inspect.defaultOptions.depth = null
process.env.STL_FORCE_DISABLE_SAFE = `1`

let cleaningUp = false
const signalCleanup = async () => {
  if (cleaningUp) return
  cleaningUp = true

  const forceTimer = setTimeout(() => process.exit(1), 5_000)
  try {
    await runSyncCleanup()
  } catch {
    // Best-effort
  }
  clearTimeout(forceTimer)
  process.exit(0)
}

process.on(`SIGINT`, signalCleanup)
process.on(`SIGTERM`, signalCleanup)

main().catch((err) => {
  process.stderr.write(`${themed('error', `Fatal:`)} ${err.message}\n`)
  process.exit(1)
})
```

- [ ] **Step 2: Verify the tsa CLI still runs**

Run: `cd repos/tsa && bun src/main.ts --help`
Expected: Usage output printed, no errors

---

### Task 3: Wire Sync Tasks Into Cleanup Registry

Register sync sessions in the cleanup registry from `sync.ts` (foreground mode) and `ssh.ts` (auto-sync) so the global signal handlers can clean them up.

**Files:**
- Modify: `repos/tsa/src/tasks/sync.ts:327-370`
- Modify: `repos/tsa/src/tasks/ssh.ts:195-211`

- [ ] **Step 1: Update sync.ts — register cleanup and add daemon mode message**

In `repos/tsa/src/tasks/sync.ts`, add the import at the top with the other imports:

```typescript
import {
  registerSyncCleanup,
  clearSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'
```

Then replace lines 328–373 (the daemon/foreground block) with:

```typescript
    if (params.daemon) {
      // Daemon mode: print and exit, sessions persist via Mutagen daemon
      for (const s of sessions) {
        process.stdout.write(
          `  ${themed(`muted`, s.name)} ${s.source || `?`} -> ${s.target || `?`}\n`
        )
      }
      process.stdout.write(
        `\n${themed(`muted`, `File sync running in background. Use "tsa sync stop ${sandboxId}" to stop.`)}\n`
      )
      return
    }

    // Foreground mode: block until Ctrl+C
    process.stdout.write(`${themed(`muted`, `Press Ctrl+C to stop sync`)}\n\n`)

    // Register for global signal handler fallback
    registerSyncCleanup(sandboxId, manager)

    let cleanupRunning = false
    const cleanup = async () => {
      if (cleanupRunning) {
        process.stderr.write(`\nForce quitting...\n`)
        process.exit(1)
      }
      cleanupRunning = true
      clearSyncCleanup()
      process.stdout.write(`\n${themed(`muted`, `Stopping sync...`)}\n`)
      const timer = setTimeout(() => {
        process.stderr.write(
          `Cleanup timed out. Sessions may still be running. Use "tsa sync stop ${sandboxId}" to clean up.\n`
        )
        process.exit(1)
      }, 10_000)
      try {
        await manager.stopAll(sandboxId)
        clearTimeout(timer)
        process.stdout.write(`${themed(`success`, `File sync stopped`)}\n`)
      } catch (err) {
        clearTimeout(timer)
        process.stderr.write(
          `Warning: could not stop all sync sessions: ${(err as Error).message}\n` +
            `Run "tsa sync stop ${sandboxId}" to clean up manually.\n`
        )
      }
      process.exit(0)
    }

    process.on(`SIGINT`, cleanup)
    process.on(`SIGTERM`, cleanup)

    // Keep process alive
    await new Promise(() => {})
```

- [ ] **Step 2: Update ssh.ts — register/clear cleanup around auto-sync**

In `repos/tsa/src/tasks/ssh.ts`, add the import at the top with the other imports:

```typescript
import {
  registerSyncCleanup,
  clearSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'
```

Then replace lines 195–211 (the sync context block) with:

```typescript
    const syncCtx = createSyncContext()
    try {
      await autoStartSync(syncCtx, config?.sync, client, orgId, sandboxId)
      if (syncCtx.started) registerSyncCleanup(sandboxId, syncCtx.manager)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      await stopSync(syncCtx, sandboxId)
      process.exit(1)
    }

    try {
      await spawnSsh(sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      await stopSync(syncCtx, sandboxId)
    }
```

- [ ] **Step 3: Expose `manager` on the sync context**

The `createSyncContext` return type must include `manager` for the registry. Check `repos/tsa/src/utils/tasks/sandboxSync.ts:13-17` — the function already returns `{ manager, started }`, so `manager` is already exposed. No change needed.

- [ ] **Step 4: Verify tsa CLI compiles and tests pass**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests pass, no type errors

---

### Task 4: `tsa sync cleanup` Subtask

Add a subtask that finds and terminates orphaned (errored/disconnected) sessions.

**Files:**
- Modify: `repos/tsa/src/tasks/sync.ts` (add `cleanupTask` and register in `tasks`)

- [ ] **Step 1: Add the cleanup subtask to sync.ts**

Add the following subtask definition after the existing `flushTask` (around line 114) and before the main `sync` export:

```typescript
const cleanupTask: TTask = {
  name: `cleanup`,
  description: `Terminate orphaned sync sessions (errored/disconnected)`,
  example: `tsa sync cleanup`,
  action: requireAuth(async () => {
    const sessions = await manager.status()
    const orphaned = sessions.filter(
      (s) => s.status === `errored` || s.status === `disconnected`
    )

    if (orphaned.length === 0) {
      process.stdout.write(`${themed(`muted`, `No orphaned sessions found`)}\n`)
      return
    }

    process.stdout.write(
      `${themed(`muted`, `Found ${orphaned.length} orphaned session${orphaned.length !== 1 ? `s` : ``}`)}\n`
    )

    const errors: string[] = []
    for (const s of orphaned) {
      const sbId = s.labels?.sandboxId || `unknown`
      process.stdout.write(
        `  ${themed(`muted`, s.name)} (${sbId}) — ${themed(`warning`, s.status)}\n`
      )
      try {
        await driver.terminateSession(s.id)
      } catch (err) {
        errors.push(`${s.name || s.id}: ${(err as Error).message}`)
      }
    }

    if (errors.length) {
      process.stderr.write(
        `${themed(`warning`, `Warning: could not terminate ${errors.length} session(s):`)} ${errors.join(`; `)}\n`
      )
    }
    process.stdout.write(
      `${themed(`success`, `Cleaned up ${orphaned.length - errors.length} session${orphaned.length - errors.length !== 1 ? `s` : ``}`)}\n`
    )
  }),
}
```

- [ ] **Step 2: Register the cleanup subtask**

In the `sync` task definition's `tasks` object (around line 121–125), add `cleanup`:

```typescript
  tasks: {
    stop: stopTask,
    status: statusTask,
    flush: flushTask,
    cleanup: cleanupTask,
  },
```

- [ ] **Step 3: Verify the subtask registers correctly**

Run: `cd repos/tsa && bun src/main.ts sync cleanup --help`
Expected: Shows usage for the cleanup subtask, no errors

- [ ] **Step 4: Run all tsa tests**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

---

### Task 5: `tsa logout` Sync Termination

Add best-effort sync session termination to the logout task.

**Files:**
- Modify: `repos/tsa/src/tasks/logout.ts`

- [ ] **Step 1: Write the test file**

```typescript
// repos/tsa/src/tasks/logout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TSA/services/sync/mutagenClient`, () => {
  const terminateSession = vi.fn().mockResolvedValue(undefined)
  const listSessions = vi.fn().mockResolvedValue([])
  return {
    CliDriver: vi.fn().mockImplementation(() => ({
      terminateSession,
      listSessions,
      ensureDaemon: vi.fn().mockResolvedValue(undefined),
      stopDaemon: vi.fn().mockResolvedValue(undefined),
      pauseSession: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
      flushSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({}),
    })),
    _mocks: { terminateSession, listSessions },
  }
})

import { logout } from './logout'
import { CliDriver, _mocks } from '@TSA/services/sync/mutagenClient'

describe(`logout`, () => {
  let mockAuth: { logout: ReturnType<typeof vi.fn> }
  let output: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = { logout: vi.fn() }
    output = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
  })

  it(`terminates sync sessions before removing credentials`, async () => {
    _mocks.listSessions.mockResolvedValueOnce([
      { id: `s1`, name: `app`, status: `watching`, labels: {} },
    ])

    await logout.action!({ auth: mockAuth } as any)

    expect(_mocks.terminateSession).toHaveBeenCalledWith(`s1`)
    expect(mockAuth.logout).toHaveBeenCalled()
  })

  it(`logs out even when no sync sessions exist`, async () => {
    _mocks.listSessions.mockResolvedValueOnce([])

    await logout.action!({ auth: mockAuth } as any)

    expect(_mocks.terminateSession).not.toHaveBeenCalled()
    expect(mockAuth.logout).toHaveBeenCalled()
  })

  it(`logs out even when sync termination fails`, async () => {
    _mocks.listSessions.mockRejectedValueOnce(new Error(`daemon not running`))

    await logout.action!({ auth: mockAuth } as any)

    expect(mockAuth.logout).toHaveBeenCalled()
    expect(output.some((o) => o.includes(`Warning`))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/tasks/logout.test.ts`
Expected: FAIL — logout doesn't call terminateSession yet

- [ ] **Step 3: Update logout.ts**

Replace the full contents of `repos/tsa/src/tasks/logout.ts` with:

```typescript
import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { CliDriver } from '@TSA/services/sync/mutagenClient'
import { SyncManager } from '@TSA/services/sync/syncManager'

export const logout: TTask = {
  name: `logout`,
  alias: [`lo`],
  description: `Remove stored credentials`,
  example: `tsa logout`,
  action: async ({ auth }) => {
    // Best-effort: terminate all sync sessions before removing credentials
    try {
      const driver = new CliDriver()
      const manager = new SyncManager(driver)
      const sessions = await manager.status()
      if (sessions.length > 0) {
        process.stdout.write(
          `${themed(`muted`, `Stopping ${sessions.length} sync session${sessions.length !== 1 ? `s` : ``}...`)}\n`
        )
        for (const s of sessions) {
          try {
            await driver.terminateSession(s.id)
          } catch {
            // Individual session failures don't block logout
          }
        }
        process.stdout.write(`${themed(`muted`, `Sync sessions stopped`)}\n`)
      }
    } catch (err) {
      process.stderr.write(
        `${themed(`warning`, `Warning: could not stop sync sessions:`)} ${(err as Error).message}\n`
      )
    }

    auth.logout()
    process.stdout.write(`${themed('success', `Logged out`)}\n`)
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/tasks/logout.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Run all tsa tests**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

---

### Task 6: Tunnel Rate Guard

Add an in-memory rate guard to the tunnel handler that detects and blocks pathological connect/disconnect cycles.

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`
- Modify: `repos/backend/src/constants/sandbox.ts`

- [ ] **Step 1: Write the test file**

```typescript
// repos/backend/src/endpoints/sandboxes/onTunnelConnect.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkTunnelRateLimit,
  recordTunnelFailure,
  clearTunnelFailures,
} from './onTunnelConnect'
import {
  TunnelRateLimit,
  TunnelRateWindow,
  TunnelBlockDuration,
} from '@TBE/constants/sandbox'

describe(`tunnel rate guard`, () => {
  beforeEach(() => {
    clearTunnelFailures()
  })

  it(`allows connections below rate limit`, () => {
    for (let i = 0; i < TunnelRateLimit - 1; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)
  })

  it(`blocks connections at rate limit`, () => {
    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(true)
  })

  it(`does not block after backoff expires`, () => {
    const now = Date.now()
    vi.spyOn(Date, `now`).mockReturnValue(now)

    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(true)

    // Advance past block duration
    vi.spyOn(Date, `now`).mockReturnValue(now + TunnelBlockDuration + 1)
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)

    vi.restoreAllMocks()
  })

  it(`prunes stale entries outside the rate window`, () => {
    const now = Date.now()
    vi.spyOn(Date, `now`).mockReturnValue(now)

    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }

    // Advance past rate window — stale entries pruned on next check
    vi.spyOn(Date, `now`).mockReturnValue(now + TunnelRateWindow + 1)
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)

    vi.restoreAllMocks()
  })

  it(`clearTunnelFailures resets for a sandbox`, () => {
    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    clearTunnelFailures(`sb_1`)
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)
  })

  it(`independent sandbox IDs do not interfere`, () => {
    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(true)
    expect(checkTunnelRateLimit(`sb_2`)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/endpoints/sandboxes/onTunnelConnect.test.ts`
Expected: FAIL — exports not found

- [ ] **Step 3: Add rate guard constants to sandbox constants**

In `repos/backend/src/constants/sandbox.ts`, add at the end:

```typescript
export const TunnelRateWindow = 60_000
export const TunnelRateLimit = 5
export const TunnelFastCloseThreshold = 10_000
export const TunnelBlockDuration = 60_000
```

- [ ] **Step 4: Add rate guard logic and integrate into onTunnelConnect**

In `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`, add the rate guard imports and module-level state after the existing imports:

```typescript
import {
  TunnelRateWindow,
  TunnelRateLimit,
  TunnelFastCloseThreshold,
  TunnelBlockDuration,
} from '@TBE/constants/sandbox'
```

Add the rate guard functions after the imports, before the `onTunnelConnect` export:

```typescript
const tunnelFailures = new Map<string, number[]>()

export const recordTunnelFailure = (sandboxId: string): void => {
  const failures = tunnelFailures.get(sandboxId) || []
  failures.push(Date.now())
  tunnelFailures.set(sandboxId, failures)
}

export const clearTunnelFailures = (sandboxId?: string): void => {
  if (sandboxId) tunnelFailures.delete(sandboxId)
  else tunnelFailures.clear()
}

export const checkTunnelRateLimit = (sandboxId: string): boolean => {
  const failures = tunnelFailures.get(sandboxId)
  if (!failures || failures.length === 0) return false

  const now = Date.now()
  const recent = failures.filter((t) => now - t < TunnelRateWindow)
  tunnelFailures.set(sandboxId, recent)

  if (recent.length < TunnelRateLimit) return false

  const lastFailure = recent[recent.length - 1]
  if (now - lastFailure > TunnelBlockDuration) {
    tunnelFailures.delete(sandboxId)
    return false
  }

  return true
}
```

Then integrate the guard into `onTunnelConnect`. After the sandbox ID extraction (after `const sandboxId = match[1]`, around line 37), add:

```typescript
  // Rate guard: reject pathological connect/disconnect cycles
  if (checkTunnelRateLimit(sandboxId)) {
    logger.debug(`[Tunnel] Rate limited for sandbox ${sandboxId}`)
    ws.close(4008, `Too many failed connections, retry later`)
    return
  }
  const connectTime = Date.now()
```

In the `tcp.on('connect')` handler (around line 124), add after the existing `logger.info` line:

```typescript
    clearTunnelFailures(sandboxId)
```

In the `cleanup()` function (around line 112), add before the `if (closed) return` guard:

```typescript
  const recordFailureOnClose = () => {
    if (Date.now() - connectTime < TunnelFastCloseThreshold) {
      recordTunnelFailure(sandboxId)
    }
  }
```

And call `recordFailureOnClose()` right after `closed = true`:

The full updated `cleanup` function should be:

```typescript
  const cleanup = () => {
    if (closed) return
    closed = true
    if (Date.now() - connectTime < TunnelFastCloseThreshold) {
      recordTunnelFailure(sandboxId)
    }
    if (pingInterval) clearInterval(pingInterval)
    sbService.removeSession(podName, sessionId)
    tcp.destroy()
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close()
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/endpoints/sandboxes/onTunnelConnect.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Run all backend tests**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

---

### Task 7: Type Check and Full Test Suite

Verify everything compiles and all tests pass across both repos.

**Files:** None (verification only)

- [ ] **Step 1: Type check tsa**

Run: `cd repos/tsa && pnpm types`
Expected: No type errors

- [ ] **Step 2: Type check backend**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

- [ ] **Step 3: Run all tsa tests**

Run: `cd repos/tsa && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Run all backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

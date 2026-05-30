# Sandbox Session Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stop, Restart, and Recreate command buttons to the Threads app Session page so users can manage running sandbox sessions.

**Architecture:** Four-layer change — type (add `podName` to session state), service (add `stop()` to `SandboxApi`), actions (three new lifecycle actions), UI (command bar in session header with confirmation dialogs). No backend changes needed.

**Tech Stack:** React, MUI 6, Jotai, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-11-sandbox-session-commands-design.md`

**IMPORTANT — git rules from CLAUDE.md:**
- **NEVER** run `git commit`, `git push`, or any history-modifying git command
- **ALLOWED**: `git add`, `git status`, `git diff`
- Commit steps in this plan mean OUTPUT the commit message — the user commits manually

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `repos/threads/src/types/sessions.types.ts` | Modify | Add `podName` to `TOpenSession` |
| `repos/threads/src/services/sandboxApi.ts` | Modify | Add `stop()` method |
| `repos/threads/src/actions/sessions/openSession.ts` | Modify | Store `podName`; fix `reconnectSessionId: null` handling |
| `repos/threads/src/state/accessors.ts` | Modify | Add `clearSessionEvents()` helper |
| `repos/threads/src/actions/sandboxes/stopSandbox.ts` | Create | Stop pod + close session |
| `repos/threads/src/actions/sandboxes/restartSandbox.ts` | Create | Stop + reconnect with preserved history |
| `repos/threads/src/actions/sandboxes/recreateSandbox.ts` | Create | Stop + wipe + fresh connect |
| `repos/threads/src/actions/sandboxes/index.ts` | Modify | Add barrel exports |
| `repos/threads/src/components/Session/SessionCommands.tsx` | Create | Command bar with Stop/Restart/Recreate buttons + confirmation dialogs |
| `repos/threads/src/pages/Session/Session.tsx` | Modify | Integrate `SessionCommands`, add pending-op loading state |

---

### Task 1: Add `podName` to `TOpenSession` type

**Files:**
- Modify: `repos/threads/src/types/sessions.types.ts`

- [ ] **Step 1: Add `podName` field to `TOpenSession`**

In `repos/threads/src/types/sessions.types.ts`, add `podName` to the type:

```typescript
export type TOpenSession = {
  sandboxId: string
  sessionId: string
  threadId: string
  runtime: string
  projectId: string
  podName: string
}
```

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS (no consumers reference `TOpenSession` without `podName` yet — the only construction site is `openSession.ts` which we fix in Task 3)

Note: This may show a type error in `openSession.ts` because it constructs `TOpenSession` without `podName`. That's expected and fixed in Task 3. If the type check fails only on that file, proceed.

---

### Task 2: Add `stop()` method to `SandboxApi`

**Files:**
- Modify: `repos/threads/src/services/sandboxApi.ts`

- [ ] **Step 1: Add `stop` method**

In `repos/threads/src/services/sandboxApi.ts`, add the `stop` method to the `SandboxApi` class after the existing `connect` method. Also add the `TApiRes` import if not already present (it is — it's on line 1):

```typescript
async stop(
  orgId: string,
  projectId: string,
  id: string,
  podName: string
): Promise<TApiRes<{ success: boolean }>> {
  const resp = await this.api.delete<{ success: boolean }>({
    data: { podName },
    path: `${this.#path(orgId, projectId)}/${id}/stop`,
  })
  resp.error && (await this._onError(resp.error, `Failed to stop sandbox`))
  return resp
}
```

This mirrors `repos/admin/src/services/sandboxApi.ts` lines 196-208 exactly.

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS (or only the pre-existing `openSession.ts` error from Task 1)

---

### Task 3: Update `openSession` to store `podName` and fix `reconnectSessionId: null` handling

**Files:**
- Modify: `repos/threads/src/actions/sessions/openSession.ts`

- [ ] **Step 1: Capture `podName` from connect response**

In `repos/threads/src/actions/sessions/openSession.ts`, after line 41 (`const shellToken = connectResult.data?.shellToken`), add:

```typescript
const podName = connectResult.data?.podName ?? ``
```

- [ ] **Step 2: Pass `podName` into `setOpenSession`**

In the same file, find the `setOpenSession` call (around line 90-96) and add `podName`:

```typescript
setOpenSession(sandboxId, {
  sandboxId,
  sessionId: msg.sessionId,
  threadId: msg.threadId ?? ``,
  runtime,
  projectId,
  podName,
})
```

- [ ] **Step 3: Fix `reconnectSessionId: null` handling**

The current code on line 49:
```typescript
const storedSessionId = opts.reconnectSessionId ?? sessionStorage.getItem(`shell_${sandboxId}`)
```

The `??` operator treats `null` as nullish and falls through to `sessionStorage.getItem()`. For the recreate flow, we need `null` to mean "skip sessionStorage — start fresh." Replace line 49 with:

```typescript
const storedSessionId = opts.reconnectSessionId !== null
  ? (opts.reconnectSessionId ?? sessionStorage.getItem(`shell_${sandboxId}`))
  : undefined
```

This gives three behaviors:
- `reconnectSessionId: undefined` (default) → check sessionStorage
- `reconnectSessionId: 'abc-123'` (restart) → use that sessionId directly
- `reconnectSessionId: null` (recreate) → skip sessionStorage, connect fresh

- [ ] **Step 4: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS — the `TOpenSession` construction now includes `podName`

---

### Task 4: Add `clearSessionEvents` accessor

**Files:**
- Modify: `repos/threads/src/state/accessors.ts`

- [ ] **Step 1: Add `clearSessionEvents` function**

In `repos/threads/src/state/accessors.ts`, after the `appendSessionEvent` function (around line 50), add:

```typescript
export const clearSessionEvents = (sandboxId: string) => {
  const map = new Map(store.get(sessionEventsAtom))
  map.delete(sandboxId)
  store.set(sessionEventsAtom, map)
}
```

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 5: Create `stopSandbox` action

**Files:**
- Create: `repos/threads/src/actions/sandboxes/stopSandbox.ts`

- [ ] **Step 1: Create the action file**

Create `repos/threads/src/actions/sandboxes/stopSandbox.ts`:

```typescript
import { sandboxApi } from '@TTH/services/sandboxApi'
import { getOpenSessions } from '@TTH/state/accessors'
import { closeSession } from '@TTH/actions/sessions'

export type TStopSandboxOpts = {
  sandboxId: string
  orgId: string
}

export const stopSandbox = async (opts: TStopSandboxOpts): Promise<boolean> => {
  const { sandboxId, orgId } = opts
  const session = getOpenSessions().get(sandboxId)
  if (!session) return false

  const { projectId, podName } = session

  const resp = await sandboxApi.stop(orgId, projectId, sandboxId, podName)
  closeSession(sandboxId)

  return !resp.error
}
```

Note: `closeSession` is called regardless of API success — if the pod is already gone, we still need to clean up local state. The API error is toasted by `sandboxApi._onError`.

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 6: Create `restartSandbox` action

**Files:**
- Create: `repos/threads/src/actions/sandboxes/restartSandbox.ts`

- [ ] **Step 1: Create the action file**

Create `repos/threads/src/actions/sandboxes/restartSandbox.ts`:

```typescript
import { getOpenSessions } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'

export type TRestartSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const restartSandbox = async (opts: TRestartSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts
  const session = getOpenSessions().get(sandboxId)
  const reconnectSessionId = session?.sessionId

  await stopSandbox({ sandboxId, orgId })
  await openSession({ sandboxId, orgId, projectId, reconnectSessionId })
}
```

The `reconnectSessionId` is captured before `stopSandbox` clears the session from state. This sessionId enables the backend to resume the existing thread and restore chat history.

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 7: Create `recreateSandbox` action

**Files:**
- Create: `repos/threads/src/actions/sandboxes/recreateSandbox.ts`

- [ ] **Step 1: Create the action file**

Create `repos/threads/src/actions/sandboxes/recreateSandbox.ts`:

```typescript
import { clearSessionEvents } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'

export type TRecreateSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const recreateSandbox = async (opts: TRecreateSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts

  await stopSandbox({ sandboxId, orgId })
  sessionStorage.removeItem(`shell_${sandboxId}`)
  clearSessionEvents(sandboxId)
  await openSession({ sandboxId, orgId, projectId, reconnectSessionId: null })
}
```

Three cleanup steps before reconnect:
1. `stopSandbox` — kills pod, closes WebSocket, removes session from state
2. `sessionStorage.removeItem` — prevents `openSession` from attempting reconnection
3. `clearSessionEvents` — wipes chat history from Jotai state

Passing `reconnectSessionId: null` explicitly tells `openSession` to skip the sessionStorage fallback (per the fix in Task 3).

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 8: Update barrel exports

**Files:**
- Modify: `repos/threads/src/actions/sandboxes/index.ts`

- [ ] **Step 1: Add exports for the three new actions**

Replace the contents of `repos/threads/src/actions/sandboxes/index.ts` with:

```typescript
export { listSandboxes } from './listSandboxes'
export type { TListSandboxesOpts } from './listSandboxes'
export { connectSandbox } from './connectSandbox'
export type { TConnectSandboxOpts } from './connectSandbox'
export { stopSandbox } from './stopSandbox'
export type { TStopSandboxOpts } from './stopSandbox'
export { restartSandbox } from './restartSandbox'
export type { TRestartSandboxOpts } from './restartSandbox'
export { recreateSandbox } from './recreateSandbox'
export type { TRecreateSandboxOpts } from './recreateSandbox'
```

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 9: Create `SessionCommands` component

**Files:**
- Create: `repos/threads/src/components/Session/SessionCommands.tsx`

- [ ] **Step 1: Create the component**

Create `repos/threads/src/components/Session/SessionCommands.tsx`:

```typescript
import { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useOpenSessions, useOrgId } from '@TTH/state/selectors'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { recreateSandbox } from '@TTH/actions/sandboxes/recreateSandbox'

type TCommand = 'stop' | 'restart' | 'recreate'

type TSessionCommandsProps = {
  sandboxId: string
  projectId: string
  onPendingOp: (op: TCommand | null) => void
}

const commandConfig: Record<TCommand, {
  label: string
  icon: React.ReactNode
  color: 'error' | 'warning'
  dialogTitle: string
  dialogText: string
}> = {
  stop: {
    label: `Stop`,
    icon: <StopIcon sx={{ fontSize: 18 }} />,
    color: `error`,
    dialogTitle: `Stop Sandbox`,
    dialogText: `Stop this sandbox session? The pod will be shut down.`,
  },
  restart: {
    label: `Restart`,
    icon: <RestartAltIcon sx={{ fontSize: 18 }} />,
    color: `warning`,
    dialogTitle: `Restart Sandbox`,
    dialogText: `Restart this sandbox? Your session history will be preserved.`,
  },
  recreate: {
    label: `Recreate`,
    icon: <RefreshIcon sx={{ fontSize: 18 }} />,
    color: `warning`,
    dialogTitle: `Recreate Sandbox`,
    dialogText: `Recreate this sandbox from scratch? All session history will be lost.`,
  },
}

export const SessionCommands = (props: TSessionCommandsProps) => {
  const { sandboxId, projectId, onPendingOp } = props
  const openSessions = useOpenSessions()
  const orgId = useOrgId()
  const [executing, setExecuting] = useState<TCommand | null>(null)
  const [confirmAction, setConfirmAction] = useState<TCommand | null>(null)

  const session = openSessions.get(sandboxId)
  if (!session || !orgId) return null

  const handleConfirm = useCallback(async () => {
    const action = confirmAction
    if (!action || !orgId) return

    setConfirmAction(null)
    setExecuting(action)

    if (action !== `stop`) onPendingOp(action)

    try {
      if (action === `stop`) {
        await stopSandbox({ sandboxId, orgId })
      } else if (action === `restart`) {
        await restartSandbox({ sandboxId, orgId, projectId })
      } else if (action === `recreate`) {
        await recreateSandbox({ sandboxId, orgId, projectId })
      }
    } catch {
      // Errors already toasted by API service
    } finally {
      setExecuting(null)
      onPendingOp(null)
    }
  }, [confirmAction, sandboxId, orgId, projectId, onPendingOp])

  const config = confirmAction ? commandConfig[confirmAction] : null

  return (
    <>
      <Box sx={{ display: `flex`, gap: 0.5 }}>
        {(Object.keys(commandConfig) as TCommand[]).map((cmd) => {
          const cfg = commandConfig[cmd]
          return (
            <Button
              key={cmd}
              size='small'
              color={cfg.color}
              variant='outlined'
              startIcon={executing === cmd ? <CircularProgress size={14} /> : cfg.icon}
              onClick={() => setConfirmAction(cmd)}
              disabled={executing !== null}
              sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
            >
              {cfg.label}
            </Button>
          )
        })}
      </Box>

      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
      >
        <DialogTitle>{config?.dialogTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{config?.dialogText}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            color={config?.color}
            variant='contained'
            autoFocus
          >
            {config?.label}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
```

Key design decisions:
- `onPendingOp` callback lets the parent Session page know when a restart/recreate is in-flight, so it can show a loading state instead of "Start Session" during the reconnect phase
- `executing` state disables all buttons while any command runs (prevents double-click)
- Confirmation dialog uses the `commandConfig` map to avoid repetitive code
- `onPendingOp` is NOT called for `stop` — stop just returns to the config view normally

- [ ] **Step 2: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 10: Integrate `SessionCommands` into `Session` page

**Files:**
- Modify: `repos/threads/src/pages/Session/Session.tsx`

- [ ] **Step 1: Add imports**

At the top of `repos/threads/src/pages/Session/Session.tsx`, add these imports:

```typescript
import { SessionCommands } from '@TTH/components/Session/SessionCommands'
```

Also add `Loading` to the existing `@tdsk/components` import if not already there (it is — line 15).

- [ ] **Step 2: Add `pendingOp` state**

Inside the `Session` component (after line 80 where `connecting` is declared), add:

```typescript
const [pendingOp, setPendingOp] = useState<'restart' | 'recreate' | null>(null)
```

- [ ] **Step 3: Add `SessionCommands` to the header**

In `SessionHeader`, after the sandbox name `Typography` (around line 148), add `SessionCommands` inside the `{hasSession && (...)}` block. The header should render both `SessionCommands` and the existing `ToggleButtonGroup` when a session is active.

Replace the current `{hasSession && (...)}` block (lines 149-165) with:

```typescript
{hasSession && (
  <>
    <SessionCommands
      sandboxId={sandboxId}
      projectId={projectId}
      onPendingOp={setPendingOp}
    />
    <ToggleButtonGroup
      value={viewMode}
      exclusive
      onChange={handleViewChange}
      size='small'
    >
      <ToggleButton value='chat'>
        <Chat sx={{ fontSize: 18, mr: 0.5 }} />
        Chat
      </ToggleButton>
      <ToggleButton value='terminal'>
        <Terminal sx={{ fontSize: 18, mr: 0.5 }} />
        Terminal
      </ToggleButton>
    </ToggleButtonGroup>
  </>
)}
```

- [ ] **Step 4: Add pending-op loading state to pre-connect view**

In the `ContentArea`, the pre-connect view currently has two states: `connecting` (shows Loading) and default (shows config + Start Session button). Add a third state for `pendingOp` that shows a loading spinner with context-appropriate text.

Find the block that starts with `{!hasSession ? (` (around line 168). Replace the inner conditional:

```typescript
{connecting ? (
  <Loading message='Connecting...' messageSx={{ color: `text.primary` }} />
) : (
```

With:

```typescript
{connecting || pendingOp ? (
  <Loading
    message={
      pendingOp === `recreate`
        ? `Recreating session...`
        : pendingOp === `restart`
          ? `Restarting session...`
          : `Connecting...`
    }
    messageSx={{ color: `text.primary` }}
  />
) : (
```

This handles the edge case from the spec: when a restart or recreate stops the pod (causing `hasSession` to become false), the pre-connect view shows a loading spinner with "Restarting session..." or "Recreating session..." instead of the config panel with the "Start Session" button.

- [ ] **Step 5: Run type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS

- [ ] **Step 6: Full build check**

Run: `cd repos/threads && pnpm build`
Expected: PASS — successful Vite production build

---

### Task 11: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `cd repos/threads && pnpm start`

- [ ] **Step 2: Verify pre-connect state**

Navigate to a sandbox session page. Verify:
- No command buttons visible before connecting
- "Start Session" button works as before

- [ ] **Step 3: Verify connected state**

After connecting to a sandbox, verify:
- Three buttons appear in the header: Stop (red), Restart (orange), Recreate (orange)
- Buttons are positioned between the sandbox name and the Chat/Terminal toggle
- Each button shows a confirmation dialog when clicked

- [ ] **Step 4: Test Stop command**

Click Stop → confirm → verify:
- Pod stops (WebSocket closes)
- UI returns to the pre-connect config view
- "Start Session" button is shown (not a loading spinner)

- [ ] **Step 5: Test Restart command**

Connect to a sandbox, generate some chat history, then click Restart → confirm → verify:
- Brief "Restarting session..." loading state appears
- New session connects
- Chat history is preserved (same thread)

- [ ] **Step 6: Test Recreate command**

Connect to a sandbox, generate some chat history, then click Recreate → confirm → verify:
- Brief "Recreating session..." loading state appears
- New session connects
- Chat history is gone (fresh session, new thread)

- [ ] **Step 7: Stage files**

Run:
```bash
git add repos/threads/src/types/sessions.types.ts \
       repos/threads/src/services/sandboxApi.ts \
       repos/threads/src/actions/sessions/openSession.ts \
       repos/threads/src/state/accessors.ts \
       repos/threads/src/actions/sandboxes/stopSandbox.ts \
       repos/threads/src/actions/sandboxes/restartSandbox.ts \
       repos/threads/src/actions/sandboxes/recreateSandbox.ts \
       repos/threads/src/actions/sandboxes/index.ts \
       repos/threads/src/components/Session/SessionCommands.tsx \
       repos/threads/src/pages/Session/Session.tsx
```

Commit message (output only — do NOT run `git commit`):
```
feat(threads): add stop, restart, and recreate sandbox session commands

Add a command bar to the Session page header with three lifecycle
commands for managing running sandbox sessions. Stop kills the pod,
Restart preserves session history, and Recreate starts fresh.
```

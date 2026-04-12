# Sandbox Session Commands — Design Spec

## Problem

The Threads app can start sandbox sessions but provides no way to stop, restart, or recreate them. Users must rely on idle timeouts or external tools to manage running sandboxes. This creates a poor UX for the primary interaction surface.

## Solution

Add a **command bar** to the Session page header that exposes three lifecycle commands when a session is active:

| Command | Behavior | Session history |
|---------|----------|-----------------|
| **Stop** | Stop the pod, close WebSocket, return to pre-connect config view | Preserved in sessionStorage for future reconnect |
| **Restart** | Stop pod + reconnect using stored sessionId | Chat history preserved, same thread resumed |
| **Recreate** | Stop pod + wipe sessionStorage + connect fresh | New session, new thread, clean slate |

## Scope

All changes are in `repos/threads/`. No backend changes required — the `stop` and `start` endpoints already exist and the `connect` endpoint handles pod startup. No new database schema changes.

## Architecture

### Layer 1: Type — Add `podName` to `TOpenSession`

**File**: `src/types/sessions.types.ts`

The stop endpoint requires `podName` in the request body. Currently `TOpenSession` does not store it, and the `podName` from `sandboxApi.connect()` is discarded after use.

```typescript
export type TOpenSession = {
  sandboxId: string
  sessionId: string
  threadId: string
  runtime: string
  projectId: string
  podName: string          // ← add
}
```

**File**: `src/actions/sessions/openSession.ts`

Capture `podName` from the connect response and pass it into `setOpenSession`:

```typescript
const podName = connectResult.data?.podName ?? ''

// ... later in the ws.onmessage handler:
setOpenSession(sandboxId, {
  sandboxId,
  sessionId: msg.sessionId,
  threadId: msg.threadId ?? '',
  runtime,
  projectId,
  podName,         // ← add
})
```

The `podName` variable must be declared in the outer scope (alongside `shellToken`) so it's accessible inside the WebSocket `onmessage` closure.

### Layer 2: Service — Add `stop` method to `SandboxApi`

**File**: `src/services/sandboxApi.ts`

Add a `stop` method mirroring the admin app's `SandboxApi.stop()`:

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
  resp.error && (await this._onError(resp.error, 'Failed to stop sandbox'))
  return resp
}
```

No `start` method is needed — `connect` already handles starting a pod if one isn't running. The restart/recreate flows will call `connect` via `openSession`.

### Layer 3: Actions — `stopSandbox`, `restartSandbox`, `recreateSandbox`

All three actions go in `src/actions/sandboxes/`.

#### `stopSandbox.ts`

Stops the pod and tears down the local session:

```
1. Get the open session from state (need podName, projectId)
2. Call sandboxApi.stop(orgId, projectId, sandboxId, podName)
3. Call closeSession(sandboxId) — closes WebSocket, removes from openSessionsAtom, clears activeSession
4. Do NOT clear sessionStorage — allows future reconnect
```

Signature:
```typescript
export type TStopSandboxOpts = {
  sandboxId: string
  orgId: string
}

export const stopSandbox = async (opts: TStopSandboxOpts): Promise<boolean>
```

Returns `true` on success, `false` on error (errors are toasted by the API service).

#### `restartSandbox.ts`

Stops the pod, then reconnects using the stored session ID to preserve chat history:

```
1. Capture sessionId from current open session before stopping
2. Call stopSandbox({ sandboxId, orgId })
3. Call openSession({ sandboxId, orgId, projectId, reconnectSessionId: sessionId })
   - openSession calls connect internally, which starts a new pod
   - The stored sessionId in sessionStorage enables session resumption
```

Signature:
```typescript
export type TRestartSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const restartSandbox = async (opts: TRestartSandboxOpts): Promise<void>
```

#### `recreateSandbox.ts`

Stops the pod, wipes session state, then connects fresh:

```
1. Call stopSandbox({ sandboxId, orgId })
2. Clear sessionStorage key: sessionStorage.removeItem(`shell_${sandboxId}`)
3. Clear session events from state for this sandboxId (wipe chat history)
4. Call openSession({ sandboxId, orgId, projectId, reconnectSessionId: null })
   - Passing null explicitly prevents sessionStorage lookup in openSession
```

Signature:
```typescript
export type TRecreateSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const recreateSandbox = async (opts: TRecreateSandboxOpts): Promise<void>
```

**Note on `openSession` change**: The `reconnectSessionId` parameter already exists in `TOpenSessionOpts`. Currently `openSession` falls through to `sessionStorage.getItem()` when it's `undefined`. To support recreate, `openSession` must distinguish between "not provided" (`undefined` — check sessionStorage) and "explicitly null" (`null` — skip sessionStorage lookup). The existing code already handles this: `opts.reconnectSessionId ?? sessionStorage.getItem(...)` — when `null` is passed, the `??` operator does NOT fall through (null is not nullish for `??` — actually it IS nullish). 

**Correction**: `null ?? fallback` DOES fall through because `null` is nullish. So `openSession` needs a small tweak: check for explicit `null` before the `??` fallback:

```typescript
const storedSessionId = opts.reconnectSessionId !== null
  ? (opts.reconnectSessionId ?? sessionStorage.getItem(`shell_${sandboxId}`))
  : undefined
```

This way:
- `reconnectSessionId: undefined` (default) → falls through to sessionStorage lookup
- `reconnectSessionId: 'abc-123'` → uses that value directly
- `reconnectSessionId: null` → skips sessionStorage, connects fresh

#### Action Barrel Export

**File**: `src/actions/sandboxes/index.ts`

Add exports for the three new actions alongside the existing `connectSandbox` and `listSandboxes`.

### Layer 4: UI — `SessionCommands` component

**File**: `src/components/Session/SessionCommands.tsx`

A horizontal button group rendered in the `SessionHeader` when a session is active. Three icon buttons with text labels:

| Button | Icon | Color | Action |
|--------|------|-------|--------|
| Stop | `Stop` (MUI) | `error` | Confirmation dialog → `stopSandbox()` |
| Restart | `RestartAlt` (MUI) | `warning` | Confirmation dialog → `restartSandbox()` |
| Recreate | `Refresh` (MUI) | `warning` | Confirmation dialog → `recreateSandbox()` |

Each button shows a confirmation dialog before executing because these are destructive operations. The dialog text distinguishes restart from recreate:

- **Stop**: "Stop this sandbox session? The pod will be shut down."
- **Restart**: "Restart this sandbox? Your session history will be preserved."
- **Recreate**: "Recreate this sandbox from scratch? All session history will be lost."

During execution, the active button shows a loading spinner and all three are disabled.

#### Component Props

```typescript
type TSessionCommandsProps = {
  sandboxId: string
  orgId: string
  projectId: string
}
```

The component reads the open session from state via `useOpenSessions()` to get `podName`. If there's no open session for the given `sandboxId`, it renders nothing.

#### State Management

The component manages its own local state:
- `executing: 'stop' | 'restart' | 'recreate' | null` — which command is in progress
- `confirmAction: 'stop' | 'restart' | 'recreate' | null` — which confirmation dialog is open

No new Jotai atoms needed. The existing `openSessionsAtom` already provides the session presence check, and the actions handle all state transitions (removing sessions, clearing events, etc.).

#### Session Page Integration

**File**: `src/pages/Session/Session.tsx`

Add `SessionCommands` to the `SessionHeader`, positioned between the sandbox name and the view mode toggle:

```
[←] [Sandbox Name]  [Stop] [Restart] [Recreate]  [Chat | Terminal]
```

The commands only render when `hasSession` is true. During restart/recreate, the Session page will naturally transition: `hasSession` becomes false (showing the config/loading view), then back to true when the new session connects.

## Edge Cases

1. **Stop while tool is executing**: The WebSocket close will interrupt the running process. The `closeSession` cleanup handles this — parsers are flushed, state is cleared. No special handling needed.

2. **Restart/recreate fails on reconnect**: If `openSession` throws after a successful stop, the user sees the pre-connect config view with a toast error. If in a restart or recreate state, "Start Session" button should be replaced with a loading spinner saying something like "Restarting session...".

3. **Double-click prevention**: The `executing` state disables all buttons during an operation. The confirmation dialog also prevents accidental triggers.

4. **Pod already stopped**: If the stop API returns an error (pod not found), the action still calls `closeSession` to clean up local state. The user ends up on the config view either way.

## Files Changed

| File | Change |
|------|--------|
| `src/types/sessions.types.ts` | Add `podName` to `TOpenSession` |
| `src/services/sandboxApi.ts` | Add `stop()` method |
| `src/actions/sessions/openSession.ts` | Store `podName` in session state; fix `reconnectSessionId: null` handling |
| `src/actions/sandboxes/stopSandbox.ts` | New — stop pod + close session |
| `src/actions/sandboxes/restartSandbox.ts` | New — stop + reconnect with session preservation |
| `src/actions/sandboxes/recreateSandbox.ts` | New — stop + wipe + fresh connect |
| `src/actions/sandboxes/index.ts` | Add exports |
| `src/state/accessors.ts` | Add `clearSessionEvents(sandboxId)` helper (for recreate) |
| `src/components/Session/SessionCommands.tsx` | New — command bar with Stop/Restart/Recreate buttons |
| `src/pages/Session/Session.tsx` | Integrate `SessionCommands` into header |

## Not In Scope

- Status polling / health indicator (future enhancement)
- Keyboard shortcuts for commands
- Backend changes — all endpoints already exist
- Admin app changes

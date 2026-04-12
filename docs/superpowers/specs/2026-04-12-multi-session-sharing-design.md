# Multi-Session Sandbox Support & Session Sharing

## Problem

Users can only run one shell session per sandbox. The backend's `onShellConnect` handler finds an existing session for the `(sandboxId, userId)` pair and reattaches the WebSocket — preventing independent sessions. A user running Claude Code in a sandbox cannot open a second Claude Code instance in the same sandbox.

Additionally, there is no mechanism for sharing a running session with other users. Collaborative debugging, pair programming, and live demonstrations all require the ability for multiple users to observe and interact with the same terminal session.

### Root Cause

`onShellConnect.ts` line 171 calls `findShellSessionForSandbox(sandboxId, userId)`, which returns the single existing `TShellSession` for that pair and reattaches the new WebSocket. This is an intentional 1:1 design that must be replaced with explicit session targeting.

### Affected Code

| Location | Current Behavior | Required Change |
|----------|-----------------|-----------------|
| `onShellConnect.ts:171` | Finds one session per (sandbox, user), reattaches | Remove; create new session when no sessionId provided |
| `onShellConnect.ts:145` | Reconnect check requires `userId === session.userId` | Allow cross-user attachment for public sessions |
| `SandboxService.findShellSessionForSandbox()` | Returns single session | Remove entirely |
| Threads client state atoms | All keyed by sandboxId (one per sandbox) | Rekey by sessionId |
| Threads module-level Maps | connections/parsers/buffers keyed by sandboxId | Rekey by sessionId |
| Threads routing | `/session/:sandboxId` | `/session/:sessionId` |

## Solution

Two features built on the same architectural change:

1. **Multi-session** — Remove the 1:1 shell session limit. Each WebSocket connection without a `sessionId` param creates a new independent session (own SSH + PTY + thread). Concurrent session count is capped by PlanLimits per org.

2. **Session sharing** — Session owner can toggle visibility to `public`. Other users with project access can attach to public sessions as additional WebSocket clients using the existing fan-in/fan-out pattern. Shared sessions are fully interactive (all attached users can type). Only the pod owner can perform sandbox actions (stop/restart/recreate) or create new sessions on the pod.

### Design Decision: In-Memory Session State (No `sandbox_sessions` Table)

Sessions remain in-memory. No new database table.

**Rationale:**
- The SSH connection, PTY stream, ring buffer, and WebSocket attachments are inherently in-process state — they cannot be serialized to a database.
- After a backend restart, SSH connections are dead regardless of whether metadata is persisted. Users must reconnect.
- Thread table already captures session history (sandboxId, userId, meta.shellSessionId, events as messages) — a sessions table would duplicate this.
- In-memory concurrent count checks have zero race conditions (Node.js single-threaded event loop) — a DB check would need locking.
- For multi-replica backends (future), in-memory sessions are insufficient — but so is a DB table alone (the SSH connection is pinned to one instance). Multi-replica needs a session routing layer, which is out of scope.
- Hydration on startup loads running pods from K8s. Pod metadata (labels) provides orgId, userId, sandboxId, projectId. Combined with the thread table for history, all information is recoverable without a dedicated sessions table.

### Design Decision: Fully Interactive Sharing

Shared sessions are fully interactive — all attached users can type and send signals. View-only mode (where watchers can observe but not type) is a future enhancement. The `visibility` field on sessions is designed to accommodate a future `mode` field (`interactive` | `view-only`) without structural changes.

### Security Note: Shared SSH Context

When User B joins User A's shared session, they inherit User A's SSH context inside the pod — same OS user (`sandbox`), same environment variables, same filesystem. This is inherent to terminal sharing (identical to shared tmux). Safe for trusted collaborators within the same project. The project-scoped access check ensures only authorized users can join.

## Changes

### 1. Domain Types — `repos/domain/src/types/sandbox.types.ts`

New enum:

```typescript
export enum ESandboxSessionVisibility {
  private = `private`,
  public = `public`,
}
```

Extended `TSandboxSession`:

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

### 2. Domain Types — `repos/domain/src/types/payments.types.ts`

New field on `TPlanLimits`:

```typescript
export type TPlanLimits = {
  // ...existing fields
  sandboxSessions: number   // max concurrent shell sessions per org (-1 = unlimited)
}
```

### 3. Domain Constants — `repos/domain/src/constants/plans.ts`

Add `sandboxSessions` to each tier:

```typescript
[ESubscriptionTier.free]:  { ...existing, sandboxSessions: 1 },
[ESubscriptionTier.solo]:  { ...existing, sandboxSessions: 3 },
[ESubscriptionTier.pro]:   { ...existing, sandboxSessions: 10 },
[ESubscriptionTier.team]:  { ...existing, sandboxSessions: -1 },
```

Exact numbers are tunable. The enforcement mechanism is the critical path.

### 4. Backend Types — `repos/backend/src/types/shellSession.types.ts`

Extended `TShellSession`:

```typescript
export type TShellSession = {
  // ...existing fields
  projectId?: string
  visibility: ESandboxSessionVisibility
}
```

New control message variant:

```typescript
export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `reconnect`; sessionId: string }
  | { type: `visibility`; visibility: ESandboxSessionVisibility }
```

New server message variants:

```typescript
export type TShellServerMsg =
  // ...existing variants
  | { type: `joined`; sessionId: string; sandboxId: string; runtime: string; threadId: string; podOwnerUserId: string }
  | { type: `visibility`; sessionId: string; visibility: ESandboxSessionVisibility }
  | { type: `user-joined`; sessionId: string; userId: string }
  | { type: `user-left`; sessionId: string; userId: string }
```

The `joined` message is sent when a user attaches to another user's shared session (distinct from `reconnected` which means re-establishing your own prior connection). It carries the same fields as `connected` so the client can set up the session.

Extended `connected` and `reconnected` messages gain `podOwnerUserId: string` field so clients know who owns the pod.

### 5. Backend — `SandboxService` (`repos/backend/src/services/sandboxes/sandbox.ts`)

**Remove:**
- `findShellSessionForSandbox(sandboxId, userId)` — the 1:1 enforcement method. No longer needed.

**Add:**

```typescript
getShellSessionsForSandbox(sandboxId: string): TShellSession[]
```
Returns all shell sessions for a sandbox. Used by listing/query paths.

```typescript
getOrgShellSessionCount(orgId: string): number
```
Counts all active shell sessions for an org by iterating the `shellSessions` map. Used for PlanLimits enforcement.

```typescript
updateSessionVisibility(sessionId: string, visibility: ESandboxSessionVisibility): boolean
```
Updates visibility on both the `TShellSession` in `shellSessions` and the matching `TSandboxSession` in `sessions`. Returns false if session not found.

### 6. Backend — `onShellConnect.ts` Connection Flow

Replace the current three-path flow with two paths:

**Path 1 — Reconnect/Join (sessionId provided in query params):**

```
Find session = sbService.getShellSession(sessionId)
If not found → fall through to Path 2

If session.userId === requesting userId:
  → Own session reconnection (existing logic — reattach, drain buffer)

If session.userId !== requesting userId:
  → Verify session.visibility === 'public'
  → Verify requesting user has project access:
    Load sandbox → get projects → check user role in any project
  → If authorized: attach WebSocket, send 'joined' message to new client,
    broadcast 'user-joined' to all OTHER attachments
  → If not: ws.close(4003, 'Not authorized to join this session')
```

**Path 2 — Create New Session (no sessionId, or session expired):**

```
Find running pod for sandboxId
Verify pod ownership: pod.labels.userId === requesting userId
  If not → ws.close(4003, 'Cannot create sessions on a pod you did not start')

Check PlanLimits:
  Get org owner's subscription tier
  count = sbService.getOrgShellSessionCount(orgId)
  limit = PlanLimits[tier].sandboxSessions
  If limit !== -1 AND count >= limit → ws.close(4029, 'Session limit reached')

Create new SSH connection + PTY + thread (existing logic)
Set visibility = ESandboxSessionVisibility.private
Set projectId from sandbox's first linked project
Include podOwnerUserId in 'connected' server message
```

### 7. Backend — Visibility Toggle in `wireWebSocket`

When a text frame with `type: 'visibility'` is received:

```
Verify sender is the session owner (session.userId === authenticated userId)
  If not → ignore (or send error message)
Update: sbService.updateSessionVisibility(sessionId, msg.visibility)
Update: TShellSession.visibility in memory
Broadcast { type: 'visibility', sessionId, visibility } to ALL attachments
```

### 8. Backend — User Join/Leave Notifications

When attaching a WebSocket to a public session (sharing path):

```
After successful attachment:
  Broadcast { type: 'user-joined', sessionId, userId } to all OTHER attachments
```

When detaching a WebSocket from a public session:

```
In detachFromShellSession, if session.visibility === 'public':
  Broadcast { type: 'user-left', sessionId, userId } to remaining attachments
```

### 9. Admin Client — `repos/admin/`

Admin is a management dashboard with no terminal. Changes are display-only.

**ConnectModal** (`repos/admin/src/components/Sandboxes/ConnectModal.tsx`):
- Replace session count chip with a session list table
- Each row: session ID (truncated), owner, visibility badge, connected-at timestamp
- For the current user's sessions: "Copy Session ID" action
- Data source: existing `getSandboxSessions` API call — new fields flow through automatically

**Sandbox detail view:**
- Show active session count grouped by user when sandbox is running
- Derived from `listSessions` response grouped on `userId`

No new endpoints needed. No session creation from admin.

### 10. TSA CLI — `repos/tsa/`

**`tsa ssh` — No change for multi-session.** Each invocation spawns a fresh SSH process through the tunnel WebSocket. Multiple terminal windows running `tsa ssh` to the same sandbox already creates independent tunnel sessions.

**New command: `tsa sessions <sandbox-id>`**

Lists active sessions for a sandbox:

```
Sessions for sandbox sb_abc1234 (3 active)

  ID              Owner           Visibility  Connected
  sess_xy12ab     you             private     2 min ago
  sess_zw34cd     you             public      15 min ago
  sess_qr56ef     user@corp.com   private     1 hour ago
```

Calls `GET /_/sandboxes/:id/sessions` and formats the response.

**New flag: `tsa ssh --session <session-id>`**

Joins an existing shared session via the shell WebSocket endpoint (`/_/sandboxes/:id/shell?sessionId=<id>`) instead of the tunnel endpoint. The user attaches to the existing PTY with fan-in/fan-out.

Without `--session`, `tsa ssh` continues using the tunnel endpoint as it does today.

**New command: `tsa sessions share <session-id>`**

Makes a session public:

```
Session sess_xy12ab is now public
Other project members can join with: tsa ssh <sandbox-id> --session sess_xy12ab
```

Connects to the shell WebSocket and sends `{ type: 'visibility', visibility: 'public' }`. Prints the confirmation when the server responds.

**New command: `tsa sessions unshare <session-id>`**

Makes a session private again:

```
Session sess_xy12ab is now private
```

Sends `{ type: 'visibility', visibility: 'private' }`. Only the session owner can run these commands — backend enforces this.

### 11. Threads Client — `repos/threads/`

The most significant client change. All session state is rekeyed from `sandboxId` to `sessionId`.

#### 11a. Core Keying Strategy

`sessionId` becomes the primary key for all session state. `sandboxId` becomes a lookup property on the session object. This is simpler than nested maps — every piece of state is a flat map keyed by `sessionId`. When "all sessions for sandbox X" is needed, filter the map (session count per sandbox is single digits).

#### 11b. Types — `repos/threads/src/types/sessions.types.ts`

```typescript
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
  // null    = force new session
  // string  = reconnect to own session or join public session
  // undefined = check sessionStorage for recent session, else new
}
```

#### 11c. Constants — `repos/threads/src/constants/sessions.ts`

```typescript
export const ShellSessionsStorageKey = `shell_sessions`
```

#### 11d. Jotai Atoms — `repos/threads/src/state/sessions.ts`

All atoms rekey from sandboxId to sessionId:

| Atom | Current Type | New Type |
|------|-------------|----------|
| `openSessionsAtom` | `Map<sandboxId, TOpenSession>` | `Map<sessionId, TOpenSession>` |
| `sessionEventsAtom` | `Map<sandboxId, TParsedEvent[]>` | `Map<sessionId, TParsedEvent[]>` |
| `sessionToolStateAtom` | `Map<sandboxId, TToolState>` | `Map<sessionId, TToolState>` |
| `activeSessionAtom` | `string \| null` (sandboxId) | `string \| null` (sessionId) |

#### 11e. State Accessors — `repos/threads/src/state/accessors.ts`

All existing accessors change parameter from `sandboxId` to `sessionId`. Internal logic is identical (get map, get/set by key):

| Current | New |
|---------|-----|
| `getSessionEvents(sandboxId)` | `getSessionEvents(sessionId)` |
| `appendSessionEvent(sandboxId, e)` | `appendSessionEvent(sessionId, e)` |
| `clearSessionEvents(sandboxId)` | `clearSessionEvents(sessionId)` |
| `getToolState(sandboxId)` | `getToolState(sessionId)` |
| `setToolState(sandboxId, state)` | `setToolState(sessionId, state)` |
| `setOpenSession(sandboxId, s)` | `setOpenSession(sessionId, s)` |
| `removeOpenSession(sandboxId)` | `removeOpenSession(sessionId)` |
| `setActiveSession(sandboxId)` | `setActiveSession(sessionId)` |
| `getActiveSession()` | `getActiveSession()` (returns sessionId now) |

New accessor:

```typescript
export const getSessionsForSandbox = (sandboxId: string): TOpenSession[] => {
  const all = store.get(openSessionsAtom)
  const result: TOpenSession[] = []
  for (const session of all.values()) {
    if (session.sandboxId === sandboxId) result.push(session)
  }
  return result
}
```

#### 11f. Selectors / Hooks — `repos/threads/src/state/selectors.ts`

Existing hooks change parameter from sandboxId to sessionId:

| Current | New |
|---------|-----|
| `useSessionEvents(sandboxId)` | `useSessionEvents(sessionId)` |
| `useToolState(sandboxId)` | `useToolState(sessionId)` |

New hooks:

```typescript
// All open sessions for a specific sandbox
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

// Whether any session exists for a sandbox
export const useSandboxHasSession = (sandboxId: string): boolean => {
  const sessions = useSessionsForSandbox(sandboxId)
  return sessions.length > 0
}

// Aggregate tool state across all sessions for a sandbox (for nav indicators)
export const useSandboxToolState = (sandboxId: string): TToolState => {
  const sessions = useSessionsForSandbox(sandboxId)
  const [stateMap] = useRecState(sessionToolStateAtom)
  for (const session of sessions) {
    const state = stateMap.get(session.sessionId)
    if (state && state !== `idle`) return state
  }
  return 'idle'
}
```

#### 11g. Module-Level Maps — `repos/threads/src/actions/sessions/openSession.ts`

All four maps rekey from sandboxId to sessionId:

| Map | Current Key | New Key |
|-----|------------|---------|
| `connections` | `Map<sandboxId, WebSocket>` | `Map<sessionId, WebSocket>` |
| `parsers` | `Map<sandboxId, TerminalParser>` | `Map<sessionId, TerminalParser>` |
| `rawBuffers` | `Map<sandboxId, string[]>` | `Map<sessionId, string[]>` |
| `terminalWriters` | `Map<sandboxId, Set<callback>>` | `Map<sessionId, Set<callback>>` |

Exported accessor functions change signatures:

| Current | New |
|---------|-----|
| `getConnection(sandboxId)` | `getConnection(sessionId)` |
| `getParser(sandboxId)` | `getParser(sessionId)` |
| `getRawBuffer(sandboxId)` | `getRawBuffer(sessionId)` |
| `subscribeTerminalData(sandboxId, cb)` | `subscribeTerminalData(sessionId, cb)` |

#### 11h. sessionStorage Strategy

Current: single key `shell_${sandboxId}` stores one sessionId.

New: single key (the `ShellSessionsStorageKey` constant) stores a JSON object mapping sandboxId to arrays of sessionIds:

```json
{
  "sb_abc1234": ["sess_xyz1", "sess_xyz2"],
  "sb_def5678": ["sess_uvw3"]
}
```

Helper functions (in `repos/threads/src/utils/sessionStorage.ts`):

```typescript
import { ShellSessionsStorageKey } from '@THR/constants/sessions'

type TStoredSessions = Record<string, string[]>

function readMap(): TStoredSessions {
  const raw = sessionStorage.getItem(ShellSessionsStorageKey)
  return raw ? JSON.parse(raw) : {}
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
  const list = (map[sandboxId] ?? []).filter(id => id !== sessionId)
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

#### 11i. `openSession` Action — Revised Flow

```
1. Call sandboxApi.connect(orgId, projectId, sandboxId) → shellToken, podName

2. Resolve session intent:
   - opts.sessionId === null → new session (no sessionId param on WS URL)
   - opts.sessionId is a string → use it (reconnect or join shared)
   - opts.sessionId is undefined → check sessionStorage for recent sessions
     on this sandbox. If found, use first stored ID. If not, new session.

3. Open WebSocket: /_/sandboxes/:id/shell?token=...&cols=...&rows=...
   If reconnecting/joining: append &sessionId=<id>

4. On 'connected' message (new session created by server):
   - sessionId from server response
   - Store: connections.set(sessionId, ws)
   - Store: rawBuffers.set(sessionId, [])
   - Create parser: parsers.set(sessionId, new TerminalParser({...}))
   - State: setOpenSession(sessionId, { sandboxId, sessionId, threadId,
     runtime, projectId, podName, podOwnerUserId, visibility: 'private' })
   - State: setActiveSession(sessionId)
   - Storage: storeSession(sandboxId, sessionId)

5. On 'reconnected' message (reattached to own existing session):
   - Same as connected but drain buffered output to terminal
   - Storage: storeSession(sandboxId, sessionId)

6a. On 'joined' message (attached to another user's shared session):
   - Same setup as connected (store maps, create parser, set state)
   - Drain buffered output (same as reconnected)
   - Visibility comes from server response (already 'public')
   - podOwnerUserId !== current user → UI shows shared session indicators

6b. On 'visibility' message:
   - Update TOpenSession.visibility in openSessionsAtom
   - UI reactively re-renders (tab label, share toggle)

7. On 'user-joined' / 'user-left' messages:
   - Show transient toast notification

8. On binary frames (terminal data):
   - Append to rawBuffers.get(sessionId)
   - Write to parsers.get(sessionId)
   - Broadcast to terminalWriters.get(sessionId)

9. On close:
   - Flush: parsers.get(sessionId)?.flush()
   - Clean module maps: connections, parsers, rawBuffers, terminalWriters
   - State: removeOpenSession(sessionId)
   - If active: setActiveSession(null)
   - Storage: removeStoredSession(sandboxId, sessionId)
```

#### 11j. `closeSession` Action

```
Current:  closeSession(sandboxId, opts?)
New:      closeSession(sessionId, opts?)
```

Gets connection by sessionId, closes WebSocket, removes from state. When `preserveStorage` is true, skips the `removeStoredSession` call so the sessionId remains in sessionStorage for reconnection.

#### 11k. `sendInput` / `sendControl` Actions

```
Current:  sendInput(sandboxId, text), sendControl(sandboxId, msg)
New:      sendInput(sessionId, text), sendControl(sessionId, msg)
```

`approvePermission(sessionId)` and `denyPermission(sessionId)` update accordingly.

#### 11l. Sandbox Actions

These operate on sandboxes (pods), not individual sessions. They must handle the fact that stopping a sandbox affects ALL sessions on it. Only the pod owner can invoke these.

**`stopSandbox`:**

```typescript
const sessions = getSessionsForSandbox(sandboxId)
for (const session of sessions) {
  closeSession(session.sessionId, { preserveStorage: true })
}
await sandboxApi.stop(orgId, projectId, sandboxId, podName)
```

**`restartSandbox`:**

```typescript
const sessions = getSessionsForSandbox(sandboxId)
const sessionIds = sessions.map(s => s.sessionId)
await stopSandbox({ sandboxId, orgId })
for (const sid of sessionIds) {
  await openSession({ sandboxId, orgId, projectId, sessionId: sid })
}
```

**`recreateSandbox`:**

```typescript
await stopSandbox({ sandboxId, orgId })
clearStoredSessionsForSandbox(sandboxId)
for (const session of getSessionsForSandbox(sandboxId)) {
  clearSessionEvents(session.sessionId)
}
await openSession({ sandboxId, orgId, projectId, sessionId: null })
```

#### 11m. Routing

Two routes replace the current single route:

```
Current:  /session/:sandboxId             → terminal view (one session per sandbox)
New:      /sandbox/:sandboxId             → session picker (list/create/join sessions)
          /session/:sessionId             → terminal view (specific session)
```

**`/sandbox/:sandboxId`** — Session picker page. Queries `listSessions` for the sandbox, shows the picker UI (see 11t). If the sandbox has no running pod, shows the "Start Session" button (which calls `connectSandbox` then `openSession`).

**`/session/:sessionId`** — Active session terminal view. Loads the session from `openSessionsAtom` by sessionId and derives sandboxId from `TOpenSession.sandboxId`.

For direct URL navigation or page refresh when the session isn't in the atom:
1. Check sessionStorage for the sessionId → if found, derive sandboxId
2. Call `openSession` with that sessionId to reconnect
3. If session no longer exists on server → redirect to `/sandbox/${sandboxId}` (session picker)

**NavSandboxItem** navigation logic:
- If user has exactly one active session for this sandbox → navigate to `/session/${sessionId}` (direct)
- If user has multiple active sessions → navigate to `/sandbox/${sandboxId}` (picker)
- If user has no active session → navigate to `/sandbox/${sandboxId}` (picker)

#### 11n. SessionTabs Component

Iterates `openSessionsAtom` entries as `[sessionId, session]`. Multiple tabs can exist for the same sandbox.

Tab label format:
- Single session on a sandbox: `{Sandbox Name}`
- Multiple sessions on same sandbox: `{Sandbox Name} (1)`, `{Sandbox Name} (2)`, etc.
- Shared session (joined from another user): `{Sandbox Name} (shared)`

Tab click: `setActiveSession(sessionId)` + `navigate(/session/${sessionId})`
Tab close: `closeSession(sessionId)`
Status dot: `useToolState(sessionId)`

#### 11o. TerminalView Component

```
Current props:  { sandboxId: string, active: boolean }
New props:      { sessionId: string, active: boolean }
```

Internal calls update:
- `getRawBuffer(sessionId)` for history replay
- `subscribeTerminalData(sessionId, callback)` for live output
- `sendInput(sessionId, data)` for user input
- `sendControl(sessionId, msg)` for resize/signals

Each TerminalView creates one ghostty-web Terminal instance. Multiple sessions for the same sandbox = multiple TerminalView instances (one per tab). Hidden via CSS `display: none` when not active.

#### 11p. ChatView Component

```
Current:  useSessionEvents(sandboxId)
New:      useSessionEvents(sessionId)
```

Receives sessionId from the parent Session page (via route params).

#### 11q. NavSandboxItem / Project Components

These show "is this sandbox running?" indicators:

```
Current:  openSessions.has(sandbox.id)
New:      useSandboxHasSession(sandbox.id)
```

Nav tool state dot uses `useSandboxToolState(sandbox.id)` — the aggregate hook that returns the most active tool state across all sessions for that sandbox.

#### 11r. SmartInput / PermissionCard Components

```
Current:  sendInput(sandboxId, text), approvePermission(sandboxId)
New:      sendInput(sessionId, text), approvePermission(sessionId)
```

Receive sessionId from the parent Session page context.

#### 11s. SessionCommands Component

Conditionally renders actions based on pod ownership:

```typescript
const session = openSessions.get(activeSessionId)
const sandboxId = session?.sandboxId
const isOwner = session?.podOwnerUserId === currentUserId
```

When `isOwner` is true:
- Stop, Restart, Recreate buttons (operate on sandbox/pod)
- "New Session" button: `openSession({ sandboxId, orgId, projectId, sessionId: null })`
- "Share/Unshare" toggle: `sendControl(sessionId, { type: 'visibility', visibility: toggled })`

When `isOwner` is false (joined shared session):
- No sandbox actions (stop/restart/recreate hidden)
- No "New Session" button
- No share toggle
- "Leave Session" button: `closeSession(sessionId)`

#### 11t. Session Page — Session Picker

When a user navigates to a sandbox that has a running pod but no open local session, the Session page shows a session picker instead of auto-connecting:

1. Query `listSessions` endpoint → get active sessions on this sandbox
2. Separate into:
   - "My Sessions" — `session.userId === currentUserId`
   - "Shared Sessions" — `session.visibility === 'public' AND session.userId !== currentUserId`
3. Display:
   - My Sessions list (each with "Reconnect" button)
   - Shared Sessions list (each with "Join" button)
   - "New Session" button
4. If no sessions exist → auto-create (same as today's behavior)

The picker appears only when navigating to an active sandbox without an existing local connection.

#### 11u. Visibility Change Handling

When the backend broadcasts `{ type: 'visibility', sessionId, visibility }`:
1. `openSession.ts` WebSocket message handler receives it
2. Update `TOpenSession.visibility` in `openSessionsAtom`
3. UI reactively re-renders (tab label, share toggle state)

When `user-joined` / `user-left` messages arrive:
1. Show transient toast: "User X joined your session" / "User X left your session"

### 12. Complete File Impact Map

#### Domain (`repos/domain/`)
| File | Change |
|------|--------|
| `src/types/sandbox.types.ts` | Add `ESandboxSessionVisibility` enum; extend `TSandboxSession` with `visibility`, `projectId` |
| `src/types/payments.types.ts` | Add `sandboxSessions` to `TPlanLimits` |
| `src/constants/plans.ts` | Add `sandboxSessions` value per tier |

#### Backend (`repos/backend/`)
| File | Change |
|------|--------|
| `src/types/shellSession.types.ts` | Extend `TShellSession` with `visibility`, `projectId`; add visibility control/server message types; add `podOwnerUserId` to connected/reconnected messages |
| `src/services/sandboxes/sandbox.ts` | Remove `findShellSessionForSandbox`; add `getShellSessionsForSandbox`, `getOrgShellSessionCount`, `updateSessionVisibility` |
| `src/endpoints/sandboxes/onShellConnect.ts` | Replace 3-path flow with 2-path (reconnect/join vs create); add PlanLimits check; add pod ownership check on create; add project access check on share join |
| `src/endpoints/sandboxes/onShellConnect.ts` (`wireWebSocket`) | Handle `visibility` control message; broadcast user-joined/user-left |

#### Admin (`repos/admin/`)
| File | Change |
|------|--------|
| `src/components/Sandboxes/ConnectModal.tsx` | Replace session count chip with session list table |

#### TSA (`repos/tsa/`)
| File | Change |
|------|--------|
| New: `src/tasks/sessions.ts` | `tsa sessions <sandbox-id>` command |
| `src/tasks/ssh.ts` | Add `--session` flag for joining shared sessions |
| New: `src/tasks/sessionsShare.ts` | `tsa sessions share <session-id>` command |
| New: `src/tasks/sessionsUnshare.ts` | `tsa sessions unshare <session-id>` command |

#### Threads (`repos/threads/`)
| File | Change |
|------|--------|
| `src/types/sessions.types.ts` | Add `podOwnerUserId`, `visibility` to `TOpenSession`; update `TOpenSessionOpts` |
| New: `src/constants/sessions.ts` | `ShellSessionsStorageKey` constant |
| New: `src/utils/sessionStorage.ts` | sessionStorage helpers (getStoredSessions, storeSession, removeStoredSession, clearStoredSessionsForSandbox) |
| `src/state/sessions.ts` | All atoms rekeyed by sessionId |
| `src/state/accessors.ts` | All accessors take sessionId; add `getSessionsForSandbox` |
| `src/state/selectors.ts` | Hooks take sessionId; add `useSessionsForSandbox`, `useSandboxHasSession`, `useSandboxToolState` |
| `src/actions/sessions/openSession.ts` | Module maps rekeyed by sessionId; revised connect flow; sessionStorage integration; visibility/user-joined message handling |
| `src/actions/sessions/closeSession.ts` | Parameter changes to sessionId |
| `src/actions/sessions/sendInput.ts` | All functions take sessionId |
| `src/actions/sandboxes/stopSandbox.ts` | Close ALL sessions for sandbox |
| `src/actions/sandboxes/restartSandbox.ts` | Save/restore ALL session IDs |
| `src/actions/sandboxes/recreateSandbox.ts` | Clear ALL sessions, create one fresh |
| `src/components/SessionTabs/SessionTabs.tsx` | Iterate by sessionId; multi-session tab labels |
| `src/components/OpenSessionStrip.tsx` | Same as SessionTabs |
| `src/components/TerminalView/TerminalView.tsx` | Props change to sessionId |
| `src/components/ChatView/ChatView.tsx` | Uses sessionId for events |
| `src/components/SmartInput/SmartInput.tsx` | Uses sessionId |
| `src/components/PermissionCard/PermissionCard.tsx` | Uses sessionId |
| `src/components/SessionCommands/SessionCommands.tsx` | Conditional actions based on pod ownership; New Session + Share toggle for owner; Leave Session for non-owner |
| `src/components/NavSandboxItem/NavSandboxItem.tsx` | Uses `useSandboxHasSession` + `useSandboxToolState` |
| `src/pages/Session/Session.tsx` | Route param becomes sessionId; loads session from atom |
| New: `src/pages/Sandbox/Sandbox.tsx` | Session picker page — list/create/join sessions for a sandbox |
| `src/pages/Project/Project.tsx` | Uses `useSandboxHasSession` |
| `src/components/NavSandboxItem/NavSandboxItem.tsx` | Smart navigation: single session → `/session/:id`, else → `/sandbox/:id` |
| `src/components/Layout/Layout.tsx` | No structural change (map size check still works) |
| Router config | `/session/:sandboxId` → `/sandbox/:sandboxId` (picker) + `/session/:sessionId` (terminal) |

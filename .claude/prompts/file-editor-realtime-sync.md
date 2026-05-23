# Real-Time File Tree Sync Across Users

## Goal
Add the ability for multiple users connected to the same sandbox instance to see file/folder changes as they happen. When User A creates, deletes, or saves a file, User B's file tree should update automatically.

## Context: What Was Done in the Previous Session

### 1. writeFile Bug Fix (RESOLVED)
The `writeFile` method in `repos/threads/src/services/fileService.ts` was broken because the backend's `KubeSandbox` always wraps commands in `sh -c` after joining args with spaces. Sending `command: "sh"` caused double shell wrapping, destroying positional params.

**Fix applied:** Base64 encode content, use `printf` (not `sh`) as the command:
```typescript
const bytes = new TextEncoder().encode(content)
const encoded = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
const resp = await runExec(ctx, 'printf', ['%s', encoded, '|', 'base64', '-d', '>', sq(filePath)])
```

### 2. Security Hardening (3 fixes applied)

**Fix 1 — Filename validation** (`repos/threads/src/actions/editor/createEntry.ts`):
- Added `ShellUnsafeChars` regex blocking shell metacharacters
- Added `..` substring check (path traversal)

**Fix 2 — Shell quoting** (`repos/threads/src/services/fileService.ts`):
- Added `sq()` function for POSIX single-quote escaping
- Applied to ALL 9 fileService methods — all paths are single-quote wrapped in the shell command

**Fix 3 — Backend input validation** (`repos/backend/src/endpoints/sandboxes/execInSandbox.ts`):
- `command`: must be non-empty string, max 2048 chars
- `args`: must be array of strings, max 64 elements, each arg max 1MB
- `instanceId`: must be non-empty string

### 3. Verification Status
All 9 operations verified from the browser UI via captured network requests — every command has shell-quoted paths and returns exitCode 0. All injection tests blocked. Types, tests, builds all pass for both threads and backend repos.

## Architecture for the New Feature

### How the Backend Sandbox API Works
```
Frontend fileService
  -> sandboxApi (POST /_/orgs/:orgId/projects/:projectId/sandboxes/:id/exec)
  -> execInSandbox.ts handler
  -> KubeSandbox (joins command+args, wraps in sh -c)
  -> KubeClient.runInPod (K8s WebSocket to pod)
```

### Existing WebSocket Monitor Infrastructure (LEVERAGE THIS)

**Backend:**
- `repos/backend/src/endpoints/sandboxes/onMonitorConnect.ts` — WebSocket handler for `/_/sandboxes/monitor?token=<jwt>`
- `repos/backend/src/endpoints/sandboxes/monitorToken.ts` — Token generation: `POST /orgs/{orgId}/sandboxes/monitor/token`
- `repos/backend/src/services/sandboxes/sandbox.ts` — `SandboxService` manages org-scoped monitor connections, broadcasts via `broadcastSessionList(sandboxId)`
- Currently broadcasts `EShellMsg.SessionsUpdated` with session data

**Frontend:**
- `repos/threads/src/services/monitorService.ts` — Singleton WebSocket client with auto-reconnect
- `repos/threads/src/state/sessions.ts` — `backendSessionsAtom` (Map of sandboxId to sessions)
- `repos/threads/src/state/selectors.ts` — `useBackendSessions()` hook
- Sidebar components consume this for real-time session status in the nav

### File Editor State (Jotai atoms in `repos/threads/src/state/`)
- `fileTreeDataState` — Map of dirPath to TFileEntry[] (tree data)
- `fileTreeRootState` — root directory path
- `expandedFoldersState` — Set of expanded folder paths
- `fileContentCacheState` — Map of filePath to TFileCacheEntry (loaded/dirty/error/loading)
- `activeEditorFileState` — currently open file path
- `openEditorFilesState` — list of open tab paths

### Key Files for the Feature
- `repos/threads/src/services/fileService.ts` — all file operations
- `repos/threads/src/actions/editor/` — createEntry, deleteEntry, loadDirectory, saveFileContent, etc.
- `repos/threads/src/components/FileTree/FileTree.tsx` — file tree UI
- `repos/threads/src/components/Editor/EditorPane.tsx` — Monaco editor pane
- `repos/threads/src/services/monitorService.ts` — existing WebSocket client to extend
- `repos/backend/src/services/sandboxes/sandbox.ts` — backend broadcast service

## Approach (Design Discussion Needed)

The basic idea: after any file operation succeeds, broadcast a message to all monitor WebSocket connections for that sandbox's org. Other clients receive the message and refresh their file tree.

**Key design questions to work through:**
1. **What to broadcast:** Just an invalidation signal (FileTreeChanged + sandboxId + instanceId) so clients re-fetch? Or the actual file tree diff (created/deleted path + type)?
2. **Granularity:** Per-instance or per-sandbox? Users on different instances of the same sandbox have separate filesystems.
3. **Where to trigger:** In the backend after successful file operations? In a new middleware? In the sandbox service?
4. **Content cache invalidation:** If User B has a file open and User A modifies it, should User B's editor show a "file changed on disk" notification? Or auto-reload?
5. **Debouncing:** Rapid file operations (bulk create/delete) should batch updates, not flood the WebSocket.

## Changed Files (Uncommitted)
```
repos/threads/src/services/fileService.ts          — writeFile fix + sq() shell quoting
repos/threads/src/actions/editor/createEntry.ts    — filename validation hardening
repos/backend/src/endpoints/sandboxes/execInSandbox.ts — input validation
+ several other editor/filetree files from the broader file editor feature
```

## Validation Checklist for the New Feature
- [ ] File tree refreshes on other clients when a file is created
- [ ] File tree refreshes on other clients when a folder is created
- [ ] File tree refreshes on other clients when a file is deleted
- [ ] File tree refreshes on other clients when a folder is deleted
- [ ] File tree refreshes on other clients when a file is saved (writeFile)
- [ ] Only clients on the SAME instance receive updates
- [ ] Content cache handles stale content (file modified by another user)
- [ ] No performance regression from WebSocket message volume
- [ ] Types pass, tests pass, builds pass for both repos
- [ ] Browser-verified with two tabs open to the same session

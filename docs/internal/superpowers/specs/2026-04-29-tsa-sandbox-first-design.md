# TSA CLI Sandbox-First Refactor

**Date**: 2026-04-29
**Status**: Draft
**Repo**: `repos/tsa` (`@tdsk/tsa`)

## Problem Statement

The TSA CLI was built agent-first: `tsa` with no arguments launches an interactive agent chat. ThreadedStack has pivoted to sandbox-first — managed sandboxes running third-party AI tools are the primary feature. The CLI needs to reflect this.

There are four concrete problems:

1. **Default command is agent-focused**: `tsa` → `chat` → org → project → agent picker. Should be sandbox-focused.
2. **`requireAuth` is a dead end**: Tasks wrapped with `requireAuth` print `"Not logged in. Run tsa login first."` and call `process.exit(1)`. The user must manually run `tsa login`, then re-run their original command. Browser auth infrastructure already exists (`browserAuth.ts`, `TokenRefreshService`) but isn't used by `requireAuth`.
3. **No interactive pickers for org or sandbox**: `resolveOrgId` throws on multiple orgs instead of prompting. `tsa run` without a sandbox ID lists sandboxes then exits with an error instead of offering selection.
4. **Sandbox aliases don't resolve**: Sandboxes have per-project aliases (e.g., `claude-code`) stored in `sandbox.projectConfigs[].alias`, but passing an alias to `tsa run` fails because it's sent as-is to the API instead of being resolved to the sandbox ID first.

Secondary issues:

- Two sandbox listing commands (`tsa sandboxes` and `tsa run --list`) with different column formats and different scoping (org-wide vs. project-scoped).
- Last-used sandbox isn't persisted in config, so repeat runs require re-specifying it.

## Design

### 1. `ensureAuth` — Auto-Login Wrapper

**Replaces**: `requireAuth` at `src/utils/tasks/requireAuth.ts` (deleted entirely, no deprecation).

**New file**: `src/utils/tasks/ensureAuth.ts`

**Signature**: `(action: TTaskAction) => TTaskAction` — identical to `requireAuth` so all callsites just swap the import.

**Logic**:

```
ensureAuth(action) returns wrappedAction(args):
  1. auth.loggedIn() && !auth.isExpired()
     → proceed to action(args)

  2. auth has token && isExpired()
     → TokenRefreshService.maybeRefresh()
       success → proceed to action(args)
       failure → fall through to step 3

  3. Not logged in OR refresh failed:
     TTY:
       → print "Opening browser to log in..."
       → browserLogin(resolveAuthUrl(config))
       → auth.loginWithToken({ ...result, proxyUrl, insecure })
       → proceed to action(args)
     Non-TTY:
       → print "Not logged in. Run tsa login first."
       → process.exit(1)

  4. Browser login failure (timeout, cancel, network error):
     → print error message
     → process.exit(1)
```

**Dependencies**: `browserLogin` from `services/browserAuth.ts`, `TokenRefreshService` from `services/tokenRefresh.ts`, `resolveAuthUrl` and `resolveProxyUrl` from `utils/tasks/resolveUrls.ts`.

**Config access**: `ensureAuth` needs the loaded config to resolve the auth URL. The config is available on the task action args (`args.config`), so the wrapper reads it from there.

**Insecure mode**: After browser login succeeds, if the proxy URL is local (checked via `isLocalUrl`), set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` — matching what `cli.ts` already does for stored credentials at startup.

### 2. Interactive Org Picker

**File**: `src/utils/tasks/resolveOrgId.ts`

**Current behavior**: explicit → single-org auto-select → throw on 0 or multiple.

**New behavior**:

```
resolveOrgId(client, explicitOrgId?, configOrgId?):
  1. explicitOrgId provided → return it
  2. Fetch orgs via client.listOrgs()
  3. 0 orgs → throw "No organizations found"
  4. 1 org → auto-select, return it
  5. configOrgId exists AND matches an org in the list → return it
  6. Multiple orgs + TTY → promptOrgSelection() (numbered list)
  7. Multiple orgs + non-TTY → throw "Multiple orgs found. Use --org <id>"
```

**New parameter**: `configOrgId?: string` — the saved org from config. Callers pass `config?.org`. This allows repeat runs to skip the picker when the saved org is still valid.

**Prompt format** (matches existing `promptProjectSelection` pattern):

```
Select an organization:
  1. My Org (org_abc123)
  2. Other Org (org_def456)
Enter number:
```

### 3. Sandbox Alias Resolution + Interactive Picker

**New file**: `src/utils/tasks/resolveSandboxId.ts`

**Signature**:

```typescript
resolveSandboxId(
  client: ApiClient,
  orgId: string,
  projectId: string,
  explicitSandboxId?: string,
  configSandboxId?: string
): Promise<string>
```

**Logic**:

```
resolveSandboxId(client, orgId, projectId, explicit?, configSaved?):
  1. Fetch sandbox list: client.listSandboxes(orgId, projectId)
     (always project-scoped — only sandboxes tied to the active project)

  2. If explicit value provided:
     a. Find sandbox where sandbox.id === explicit → return it
     b. Find sandbox where projectConfigs has entry with
        projectId === active project AND alias === explicit → return sandbox.id
     c. No match → throw "Sandbox not found: <explicit>"

  3. No explicit value:
     a. 0 sandboxes → throw "No sandboxes found in this project"
     b. 1 sandbox → auto-select, print "Using sandbox: <name>", return id
     c. configSaved exists AND matches a sandbox in the list → return it
     d. Multiple + TTY → promptSandboxSelection()
     e. Multiple + non-TTY → throw "Multiple sandboxes. Use --sandbox <id>"
```

**Alias resolution detail**: Each sandbox has a `projectConfigs` array with entries like `{ projectId, alias }`. The alias is project-scoped, so the same sandbox can have different aliases in different projects. Resolution filters for `pc.projectId === projectId` first, then matches `pc.alias === input`.

**Prompt format**:

```
Select a sandbox:
  1. Claude Code    claude-code    claude       sb_abc123
  2. Codex          codex          codex        sb_def456
Enter number:
```

Columns: Name, Alias (project-scoped), Runtime command, ID (muted).

### 4. Rename `run` → `sandbox`, Delete `sandboxes` Task

**Delete**: `src/tasks/sandboxes.ts` — removed entirely.

**Rename**: `src/tasks/run.ts` → `src/tasks/sandbox.ts`

**Task definition changes**:

| Field | Before | After |
|-------|--------|-------|
| name | `run` | `sandbox` |
| alias | `[]` | `['sb', 'run']` |
| description | `Start a sandbox, sync files, and launch its configured AI tool` | `Start a sandbox, sync files, and launch its configured AI tool` |
| example | `tsa run <sandbox> [--org <id>] [--no-sync]` | `tsa sandbox [<sandbox>] [--org <id>] [--project <id>] [--no-sync]` |
| action wrapper | `requireAuth(...)` | `ensureAuth(...)` |

**Flow changes in the action**:

1. Replace `requireAuth` → `ensureAuth`
2. Pass `config?.org` to `resolveOrgId` as config fallback
3. Pass `config?.sandboxId` to new `resolveSandboxId` (replaces the inline list-then-error logic)
4. Alias input is resolved to a real sandbox ID by `resolveSandboxId` before any API calls
5. Save sandbox ID to config via updated `saveContext`
6. `--list` flag still works: fetches project-scoped list, prints table, exits. Uses same column format as the picker (Name, Alias, Runtime, ID).

**Removed behavior**: The old code that printed a listing then `process.exit(1)` when no sandbox ID was provided is replaced by the interactive picker from `resolveSandboxId`.

**Update `src/tasks/index.ts`**:

```typescript
// Before
import { run } from './run'
import { sandboxes } from './sandboxes'
export const tasks: TTasks = { run, ..., sandboxes }

// After
import { sandbox } from './sandbox'
export const tasks: TTasks = { sandbox, ... }
// No 'sandboxes' import, no 'run' import
```

### 5. Config Persistence for Sandbox

**File**: `src/utils/tasks/saveContext.ts`

**Current signature**: `saveContext(config, orgId, projectId)`

**New signature**: `saveContext(config, orgId, projectId, sandboxId?)`

**Behavior**:

```
saveContext(config, orgId, projectId, sandboxId?):
  changes = {}
  if (orgId !== config.org):
    changes.org = orgId
    changes.project = projectId   // reset project on org change
    changes.sandboxId = sandboxId   // reset sandbox on org change
  else if (projectId !== config.project):
    changes.project = projectId
    changes.sandboxId = sandboxId   // reset sandbox on project change
  else if (sandboxId && sandboxId !== config.sandboxId):
    changes.sandboxId = sandboxId

  if (Object.keys(changes).length > 0):
    ConfigService.saveGlobal({ ...config, ...changes })
```

The key invariant: changing org clears project and sandbox. Changing project clears sandbox. This prevents stale references.

**Type change**: Add `sandboxId?: string` to `TTsaConfig` in `src/types/config.types.ts`. Named `sandboxId` (not `sandbox`) because `TTsaConfig` already has `sandbox?: TSandboxConfig` for sandbox settings (timeout, provider, envVars).

### 6. Default Command Switch

**File**: `src/cli.ts`, lines 16-21.

**Change**:

```typescript
// Before
const args =
  !argv.length || (argv[0].startsWith('--') && argv[0] !== '--help')
    ? ['chat', ...argv]
    : argv

// After
const args =
  !argv.length || (argv[0].startsWith('--') && argv[0] !== '--help')
    ? ['sandbox', ...argv]
    : argv
```

**Result**: `tsa` with no args triggers: `ensureAuth` (auto browser login if needed) → `resolveOrgId` (interactive picker or config fallback) → `resolveProjectId` (interactive picker or config fallback) → `resolveSandboxId` (interactive picker or config fallback) → connect → sync → launch runtime.

On first run, all pickers are interactive. On subsequent runs, saved config skips all pickers automatically.

### 7. Update All Remaining Tasks

Every task currently using `requireAuth` switches to `ensureAuth`. No other changes to these tasks — just the wrapper swap:

| Task file | Callsites |
|-----------|-----------|
| `src/tasks/ssh.ts` | Main action |
| `src/tasks/sync.ts` | Main action + 4 subtasks (stop, status, flush, cleanup) |
| `src/tasks/agents.ts` | Main action |
| `src/tasks/threads.ts` | Main action |
| `src/tasks/sessions.ts` | Main action + `share` subtask + `unshare` subtask |

Additionally, tasks that call `resolveOrgId` should pass `config?.org` as the new `configOrgId` parameter. This applies to: `ssh`, `sandbox` (already covered), and `sessions` (main + subtasks).

The `agents.ts` task currently has its own inline org resolution (fetches orgs, auto-selects single, lists multiple with "use --org" message). Replace this inline logic with a call to the updated `resolveOrgId(client, params.org, config?.org)` so it gets the same interactive picker and config fallback behavior. Same for `threads.ts` if it has similar inline resolution.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/utils/tasks/ensureAuth.ts` | Create | Auto-login wrapper with browser auth + token refresh |
| `src/utils/tasks/requireAuth.ts` | Delete | Replaced by ensureAuth |
| `src/utils/tasks/resolveOrgId.ts` | Modify | Add configOrgId param + TTY interactive picker |
| `src/utils/tasks/resolveSandboxId.ts` | Create | Alias resolution + interactive picker, project-scoped |
| `src/utils/tasks/saveContext.ts` | Modify | Add optional sandboxId, cascade clears |
| `src/cli.ts` | Modify | Default command `chat` → `sandbox` |
| `src/tasks/run.ts` → `src/tasks/sandbox.ts` | Rename + Modify | Use ensureAuth, resolveSandboxId, save sandbox to config |
| `src/tasks/sandboxes.ts` | Delete | Consolidated into sandbox task |
| `src/tasks/index.ts` | Modify | Remove sandboxes, replace run with sandbox |
| `src/tasks/ssh.ts` | Modify | requireAuth → ensureAuth |
| `src/tasks/sync.ts` | Modify | requireAuth → ensureAuth |
| `src/tasks/agents.ts` | Modify | requireAuth → ensureAuth, use resolveOrgId with config |
| `src/tasks/threads.ts` | Modify | requireAuth → ensureAuth |
| `src/tasks/sessions.ts` | Modify | requireAuth → ensureAuth (3 callsites) |
| `src/tasks/logout.ts` | No change | Does not use requireAuth (no wrapper needed to log out) |
| `src/types/config.types.ts` | Modify | Add `sandboxId?: string` to TTsaConfig |

## Out of Scope

- ChatLogic / PiTuiApp changes — chat remains agent-focused, just no longer the default
- Help text / branding changes
- Slash command additions (no `/sandbox` command in chat)
- New API endpoints — all resolution is client-side against existing list endpoints

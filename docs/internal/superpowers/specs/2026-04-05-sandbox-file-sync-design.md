# Sandbox File Sync: Mutagen-Based File Synchronization Design Spec

## Context

Threaded Stack's sandbox infrastructure provides K8s pod-based isolated environments with SSH access via `tsa ssh <sandbox-id>`. Developers can connect and work inside sandboxes, but there is no mechanism to **sync local files** into a running sandbox. This spec defines a file synchronization layer using [Mutagen](https://mutagen.io) over the existing SSH tunnel, enabling live development workflows where local edits appear in the sandbox near-instantly.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync engine | Mutagen via `@nuanced-dev/mutagen` npm package | Best-in-class rsync-like delta sync with 3-way merge. SSH transport works over existing tunnel. MIT core license. |
| Transport | Existing SSH tunnel (`tsa proxy` ProxyCommand) | Zero new infrastructure. WebSocket tunnel is a raw TCP passthrough — transparent to SSH/SCP. |
| Agent binary | Pre-baked in pod image, SCP fallback for custom images | Fastest first-sync. SCP fallback is Mutagen's built-in behavior. |
| Integration layer | `MutagenClient` abstraction with `CliDriver` (v1) | CLI wrapping via `@nuanced-dev/mutagen` for fast delivery. Abstraction allows swap to gRPC driver later. |
| Config model | Hybrid: local `tsa.yaml` rules + DB-stored `syncDefaults` | Sandbox knows default targets/ignores; user owns source paths and personal overrides. |
| Sync lifecycle | Tied to session (SSH or foreground process) | No orphaned sessions. Opt-in `--daemon` flag for persistent sync. |
| Default sync mode | `one-way-replica` (host → sandbox) | Live dev loop: local files are source of truth. Configurable per rule. |
| Ignore defaults | Additive with `!` negation | Sensible defaults (.git, node_modules) that users can override explicitly. |
| Deferred items | Tracked in TASKS.md | Admin UI, Threads integration, gRPC driver, file browser, `tsa cp` all deferred and tracked. |

---

## Architecture

### Overview

```
User's Machine                          K8s Cluster
─────────────────                       ──────────────────
tsa CLI                                 Sandbox Pod
├── SyncManager                         ├── mutagen-agent (pre-baked)
│   ├── MutagenClient (abstraction)     ├── sshd :2222
│   │   └── CliDriver (v1)             └── /workspace (sync target)
│   │       └── child_process.execFile
│   │          (mutagen binary)
│   ├── ConfigLoader                        ↑
│   │   ├── local: ~/.config/tdsk/tsa.yaml  │
│   │   └── remote: sandbox.config.sync     │
│   └── IgnoreResolver                      │
│       └── merges defaults + rule ignores  │
│                                           │
└── SSH tunnel (existing)───────────────────┘
    tsa proxy → WS → TCP:2222
    Mutagen uses ProxyCommand from ~/.ssh/config
```

### Components

- **SyncManager** — Orchestrates sync lifecycle. Called by `tsa sync` command and by `tsa ssh` (when autoStart enabled). Manages multiple concurrent Mutagen sessions per sandbox. Monitors pod state and terminates sessions when the pod goes away.
- **MutagenClient** — Abstraction over Mutagen operations. v1 uses `CliDriver` which executes the mutagen binary via `child_process.execFile`. Swappable to `GrpcDriver` later without changing consumers.
- **ConfigLoader** — Merges local config (`tsa.yaml`) with sandbox-level defaults from the backend API.
- **IgnoreResolver** — Combines built-in defaults + sandbox defaults + rule-specific ignores. Handles `!pattern` negation for un-ignoring.

### No New Backend Endpoints

The existing SSH tunnel is the sync transport. Backend uses the existing `config` JSONB field on the sandbox DB record to store sync defaults under `config.sync`. No new REST endpoints, WebSocket endpoints, or middleware.

---

## MutagenClient Abstraction

### Interface

```typescript
interface IMutagenClient {
  createSession(opts: TSyncSessionOpts): Promise<TSyncSession>
  terminateSession(sessionId: string): Promise<void>
  pauseSession(sessionId: string): Promise<void>
  resumeSession(sessionId: string): Promise<void>
  flushSession(sessionId: string): Promise<void>
  listSessions(labels?: Record<string, string>): Promise<TSyncSession[]>
  getSession(sessionId: string): Promise<TSyncSession | null>
  ensureDaemon(): Promise<void>
  stopDaemon(): Promise<void>
}
```

### Types

```typescript
type TSyncSessionOpts = {
  name: string
  source: string                      // local absolute path
  target: string                      // remote path in sandbox
  sandboxId: string                   // used in SSH URL + labels
  mode: TSyncMode
  ignores: string[]                   // fully resolved (defaults + rule + negations)
  labels: Record<string, string>      // { sandboxId, ruleName, orgId }
  stageMode?: 'neighboring' | 'mutagen'
}

type TSyncSession = {
  id: string
  name: string
  status: TSyncStatus
  source: string
  target: string
  mode: TSyncMode
  labels: Record<string, string>
  errors?: string[]
}

type TSyncMode = 'one-way-replica' | 'one-way-safe' | 'two-way-safe' | 'two-way-resolved'
type TSyncStatus = 'watching' | 'scanning' | 'staging' | 'syncing' | 'idle' | 'paused' | 'errored' | 'disconnected'
```

### CliDriver Implementation

The `CliDriver` executes the mutagen binary directly via `child_process.execFile` (not the `@nuanced-dev/mutagen` npm wrapper, which crashes in Bun-compiled binaries):

```typescript
// Uses child_process.execFile to run the mutagen binary directly
class CliDriver implements IMutagenClient {
  async createSession(opts: TSyncSessionOpts): Promise<TSyncSession> {
    const args = [
      'sync', 'create',
      `--name=${opts.name}`,
      `--mode=${opts.mode}`,
      `--stage-mode-beta=${opts.stageMode || 'neighboring'}`,
      ...opts.ignores.map(i => `--ignore=${i}`),
      ...Object.entries(opts.labels).map(([k, v]) => `--label=${k}=${v}`),
      opts.source,
      `sandbox@${opts.sandboxId}:${opts.target}`,
    ]
    await runMutagen(args)
    // ... return session info
  }

  async terminateSession(sessionId: string): Promise<void> {
    await runMutagen(['sync', 'terminate', sessionId])
  }

  async listSessions(labels?: Record<string, string>): Promise<TSyncSession[]> {
    const args = ['sync', 'list']
    if (labels) {
      const selector = Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',')
      args.push(`--label-selector=${selector}`)
    }
    const result = await runMutagen(args)
    // ... parse result.stdout into TSyncSession[]
  }

  // ... other methods follow same pattern
}
```

Labels are used to query sessions by `sandboxId` — no local state tracking needed.

---

## SyncManager Lifecycle

### Flow

```
1. RESOLVE CONFIG
   ├── Load local tsa.yaml sync rules
   ├── Fetch sandbox.syncDefaults from backend API
   └── Merge: local rules override remote defaults

2. RESOLVE IGNORES (per rule)
   ├── Start with built-in defaults (.git, node_modules, .DS_Store, etc.)
   ├── Append sandbox-level default ignores
   ├── Append rule-specific ignores
   └── Process negations (! prefix removes from earlier layers)

3. RESOLVE SOURCE PATHS
   ├── Resolve relative paths against CWD
   └── Validate source directories exist

4. ENSURE DAEMON
   └── MutagenClient.ensureDaemon()

5. CREATE SESSIONS (one per rule)
   ├── Check for existing sessions (by sandboxId + ruleName labels)
   ├── If exists → skip (already syncing)
   └── If new → create session

6. WAIT / CLEANUP
   ├── Foreground: block until SIGINT/SIGTERM → terminate all sessions
   ├── Daemon: exit immediately, sessions persist via Mutagen daemon
   └── Auto-start: SSH process exit → terminate all sessions in finally block
```

### Invocation Modes

| Mode | Trigger | Behavior |
|---|---|---|
| **Foreground** | `tsa sync <sandbox-id>` | Blocks, shows status, Ctrl+C terminates sync |
| **Background** | `tsa sync <sandbox-id> --daemon` | Starts sessions and detaches. Persists until `tsa sync stop` or pod death. |
| **Auto-start** | `tsa ssh` with `sync.autoStart: true` | Starts sessions non-blocking, prints summary. Terminates when SSH exits. |

### Lifecycle Rules

- **No pod = no sync, always.** If the pod dies, all sync sessions for that sandbox terminate immediately regardless of mode.
- **Foreground and auto-start modes:** Sync is tied to the process that started it. Process exits → sync terminates.
- **Daemon mode:** Opt-in persistent sync. Mutagen daemon detects the SSH connection drop when the pod dies and moves sessions to "disconnected" status. `tsa sync stop` cleans them up explicitly — or `tsa sync status` shows them as disconnected so the user knows.
- **Duplicate prevention:** Labels (`sandboxId` + `ruleName`) prevent creating duplicate sessions. Existing sessions are detected and reused or recreated.

### SSH Integration

```
tsa ssh <sandbox-id>
  1. Connect sandbox (existing flow — get credentials, auto-start pod)
  2. If sync.autoStart && sync.rules exist:
     a. SyncManager.startAll(sandboxId, rules)  // non-blocking
     b. Print "File sync started (N rules)"
  3. Spawn SSH process (existing flow — blocks until user exits)
  4. SSH exits → SyncManager.stopAll(sandboxId)
  5. Print "File sync stopped"
```

---

## CLI Commands

```
tsa sync <sandbox-id> [options]       # Start sync (foreground)
tsa sync <sandbox-id> --daemon        # Start sync (background)
tsa sync stop <sandbox-id>            # Stop all sync sessions for a sandbox
tsa sync stop --all                   # Stop all ThreadedStack sync sessions
tsa sync status [sandbox-id]          # Show sync session status
tsa sync flush <sandbox-id>           # Force immediate sync cycle
```

### Options

| Flag | Alias | Type | Default | Description | Optional
|---|---|---|---|---|
| `--daemon` | `-d` | bool | false | Run in background | true |
| `--org` | `-o` | string | auto | Organization ID | true |
| `--sandbox` | `sb` | string | auto | Sandbox ID | true |
| `--project` | `-p` | string | auto | Project ID | true |
| `--source` | `-s` | string | from config | Local source path (single-rule shorthand) |
| `--target` | `-t` | string | /workspace | Remote target path (single-rule shorthand) |
| `--mode` | `-m` | string | one-way-replica | Sync mode | true |
| `--ignore` | `-i` | string[] | from config | Additional ignore patterns (repeatable) | true |
| `--no-defaults` | | bool | false | Skip default ignore patterns | true |
| `--name` | `-n` | string | auto | Session name | true |

### Single-Rule Shorthand

For quick one-off sync without a config file:

```bash
tsa sync sb_abc123 --source ./src --target /workspace/src --ignore "*.test.ts"
```

When `--source` is provided, it creates one session from flags. Config file rules are ignored.

When no `--source` and no config rules exist:

```
No sync rules configured. Either:
  - Add rules to ~/.config/tdsk/tsa.yaml under sync.rules
  - Use --source <path> for a quick one-off sync
```

### Status Output

```
Sandbox: sb_abc123
  app-source    ./src → /workspace/src       one-way-replica   ● watching
  configs       ./config → /workspace/config one-way-safe      ● idle

Sandbox: sb_def456
  app-source    ./src → /workspace/src       one-way-replica   ⚠ disconnected
```

---

## Configuration

### Local Config (`~/.config/tdsk/tsa.yaml`)

```yaml
sync:
  autoStart: true
  defaultIgnores:
    - .git/
    - node_modules/
    - .DS_Store
    - "*.swp"
    - "*.swo"
    - "*~"
    - .env
    - .env.local
  rules:
    - name: app-source
      source: ./src
      target: /workspace/src
      mode: one-way-replica
      ignores:
        - dist/
        - "*.map"
    - name: configs
      source: ./config
      target: /workspace/config
      mode: one-way-safe
  sandboxes:
    sb_abc123:
      rules:
        - name: app-source
          target: /workspace/custom-path
          ignores:
            - vendor/
```

### Backend Sandbox Record (`syncDefaults` field)

```typescript
type TSandboxSyncDefaults = {
  targetBase?: string       // default target root path (e.g., "/workspace")
  ignores?: string[]        // server-side default ignores
  mode?: TSyncMode          // default sync mode for this sandbox
}
```

### Resolution Order (later wins)

```
1. Built-in defaults (hardcoded: .git, node_modules, .DS_Store, *.swp, *.swo, *~, .env, .env.local)
2. Sandbox syncDefaults.ignores from DB (remote)
3. sync.defaultIgnores from tsa.yaml (local)
4. Rule-specific ignores from tsa.yaml (local)
5. ! negations processed last (can un-ignore anything from layers 1-4)
```

For `mode` and `target`: rule-level > sandbox defaults > built-in defaults (`one-way-replica` and `/workspace`).

Per-sandbox overrides in `sync.sandboxes.<id>` merge with top-level rules by `name` match.

---

## Database & Backend Changes

### Schema

Sync defaults are stored in the existing `config` JSONB column on the `sandboxes` table as `TKubeSandboxConfig.sync`:

```typescript
// repos/domain/src/types/sandbox.types.ts
type TKubeSandboxConfig = {
  // ... existing fields ...
  sync?: TSandboxSyncDefaults
}
```

### Backend Endpoint Changes

- `createSandbox` / `updateSandbox` — Accept sync defaults within the `config` field
- `getSandbox` — Returns `config` (including `sync`) in response (automatic via schema inclusion)
- Domain types — Add `TSandboxSyncDefaults` to `TSandbox` type

No new endpoints. The existing `GET /orgs/:orgId/sandboxes/:id` returns the sandbox record including `config.sync`. The `tsa` CLI fetches it during config resolution.

---

## Dockerfile Changes

### `Dockerfile.sandbox-base`

```dockerfile
# Pre-bake Mutagen agent for file sync
# Install the platform-specific npm package, extract the agent binary
ARG TARGETARCH
RUN MUTAGEN_PKG="@nuanced-dev/mutagen-linux-${TARGETARCH:-arm64}" \
    && MUTAGEN_VER=$(npm show "$MUTAGEN_PKG" version 2>/dev/null) \
    && npm pack "$MUTAGEN_PKG" --pack-destination /tmp \
    && tar xzf /tmp/nuanced-dev-mutagen-linux-*.tgz -C /tmp \
    && AGENTS_BUNDLE="/tmp/package/bin/mutagen-agents.tar.gz" \
    && AGENT_DIR="/home/sandbox/.mutagen-dev/agents/${MUTAGEN_VER}" \
    && mkdir -p "$AGENT_DIR" \
    && tar xzf "$AGENTS_BUNDLE" -C "$AGENT_DIR" "linux_${TARGETARCH:-arm64}" \
    && mv "$AGENT_DIR/linux_${TARGETARCH:-arm64}" "$AGENT_DIR/mutagen-agent" \
    && chmod 700 "$AGENT_DIR/mutagen-agent" \
    && chown -R sandbox:sandbox /home/sandbox/.mutagen-dev \
    && rm -rf /tmp/package /tmp/nuanced-dev-mutagen-linux-*
```

- Uses the `@nuanced-dev/mutagen-linux-*` npm package to install the platform-specific agent binary. Agent directory is `.mutagen-dev/agents/` (not `.mutagen/agents/`) since the npm fork uses a different daemon data path.
- Docker's `TARGETARCH` build arg (auto-set by BuildKit) selects the correct platform binary (e.g., `arm64`, `amd64`), with `arm64` as the fallback default.
- SCP fallback: Custom sandbox images without the pre-baked agent will trigger Mutagen's automatic agent deployment via SCP through the existing SSH tunnel (~10 MB one-time cost)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Sandbox pod not running | `tsa sync` calls `connectSandbox` to auto-start pod, then begins sync |
| SSH config missing ProxyCommand | Connection fails → print setup instructions for `~/.ssh/config` |
| Pod dies mid-sync | All sync sessions for that sandbox terminate immediately |
| SSH exits (autoStart mode) | All sync sessions for that sandbox terminate |
| Source path doesn't exist | Error before creating session: `"Source path ./src does not exist"` |
| Mutagen binary not found | Error at startup: `"Mutagen binary not found. Reinstall tsa."` |
| Duplicate session (same sandboxId + ruleName) | Existing session detected via labels — skip or recreate if config changed |
| Version mismatch (CLI vs pod agent) | Mutagen auto-redeploys agent via SCP fallback. Transparent to user. |

---

## File Locations

### `repos/repl/` (CLI — primary implementation)

| File | Purpose |
|---|---|
| `src/tasks/sync.ts` | `tsa sync` command with subcommands: start (default), stop, status, flush |
| `src/tasks/index.ts` | Register sync task |
| `src/services/sync/syncManager.ts` | Sync lifecycle orchestration, pod monitoring, cleanup |
| `src/services/sync/mutagenClient.ts` | `IMutagenClient` interface + `CliDriver` implementation |
| `src/services/sync/configLoader.ts` | Merge local config + sandbox syncDefaults from API |
| `src/services/sync/ignoreResolver.ts` | Merge default + rule ignores, process negations |
| `src/tasks/ssh.ts` | Modified — add autoStart sync integration |
| `package.json` | Add `@nuanced-dev/mutagen` as required dependency |

### `repos/domain/`

| File | Purpose |
|---|---|
| `src/types/sync.types.ts` | New file with all sync types: `TSandboxSyncDefaults`, `TSyncMode`, `TSyncSessionOpts`, `TSyncSession`, etc. |

### `repos/database/`

| File | Purpose |
|---|---|
| `src/schemas/sandboxes.ts` | Sandbox ID format change (lowercase nanoid) |

### `repos/backend/`

| File | Purpose |
|---|---|
| `src/endpoints/sandboxes/createSandbox.ts` | Accept `syncDefaults` in request body |
| `src/endpoints/sandboxes/updateSandbox.ts` | Accept `syncDefaults` in request body |

### `deploy/`

| File | Purpose |
|---|---|
| `Dockerfile.sandbox-base` | Add mutagen-agent binary download and install |

---

## Deferred Items

Each of these will be added as entries in TASKS.md with full acceptance criteria:

| Item | Description | Depends On |
|---|---|---|
| `tsa cp` command | One-off file copy in/out of sandbox via SCP over existing SSH tunnel | v1 sync |
| Admin UI sync config | Sync configuration drawer in admin sandbox management | v1 sync + syncDefaults API |
| Threads app sync | Sync controls in the Threads app for non-developer users | Threads app baseline + v1 sync |
| Sync status streaming | Real-time sync status via WebSocket or SSE for UI consumers | Admin/Threads UI |
| MutagenClient GrpcDriver | Replace CliDriver with gRPC integration for structured data and long-polling | v1 sync stable |
| File browser UI | Browse/download sandbox files from admin and Threads UIs | Admin/Threads UI |
| Sync session persistence | Track active sync sessions in backend DB for cross-client visibility | GrpcDriver or status streaming |

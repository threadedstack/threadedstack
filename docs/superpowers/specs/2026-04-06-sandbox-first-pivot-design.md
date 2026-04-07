# Sandbox-First Platform Pivot

**Date:** 2026-04-06
**Status:** Draft
**Scope:** Full cross-repo (domain, database, backend, admin, repl, sandbox)

## Problem

ThreadedStack was originally built around a custom AI agent harness exposed via chat UI and TUI. This puts the platform in direct competition with established AI agent tools (Claude Code, Codex, OpenCode, pi-mono) that have far more resources and developer hours behind them.

The platform's real differentiators are elsewhere: managed sandbox environments, secrets injection via MITM proxy, reusable configuration, AI provider proxying, and org/team management. These features are valuable regardless of which AI tool a user prefers.

## Direction

Shift the platform's primary experience from "run our agent" to "run your AI tool of choice in a managed sandbox." ThreadedStack becomes the infrastructure layer that makes any AI tool secure, configurable, and team-ready.

Key principles:
- Sandboxes are the primary resource, not agents
- Users pick an AI tool runtime (Claude Code, Codex, OpenCode, or custom) and get a working environment in one click
- All existing security infrastructure (MITM proxy, secret injection, SSH auth) continues to protect sandbox execution
- ThreadedStack agents remain functional but are deprioritized in UI/UX
- No agent code is removed or broken

## Data Model

### No New Tables

The existing `sandboxes` table already stores configuration without runtime state. A sandbox record IS a saved config — the same thing a "template" would be. Pod lifecycle is managed entirely in-memory by `SandboxService`.

### Sandboxes Table Changes

**New column:**
- `builtIn: boolean` (default `false`) — marks org-seeded preset sandboxes for UI treatment (badge/icon). Purely cosmetic, not a permissions gate. Built-in sandboxes are fully editable and deletable.

### TKubeSandboxConfig Changes

**New fields:**
- `runtime: ESandboxRuntime` — identifies which AI tool is available in the sandbox
- `runtimeCommand: string` — the shell command executed by `tsa run` to launch the AI tool inside the SSH session. For built-in runtimes, resolved from `SandboxRuntimeConfigs`. For custom runtimes, user-specified.

**Existing fields — clarified semantics:**
- `command: string[]` — Docker entrypoint override for the **container start command** (keeps the pod alive, starts SSH). Only used when `runtime === 'custom'`
- `args: string[]` — Docker CMD override for the **container start command**. Only used when `runtime === 'custom'`
- For built-in runtimes, the pod manifest builder resolves the container start command from the runtime identifier
- For `custom` runtime with no command/args set, the image's own ENTRYPOINT/CMD runs as-is

**Two-command model + init script:**
- `command` / `args` = what runs when the **container starts** (keeps pod alive, starts SSH server, waits)
- `initScript: string` = shell script that runs **after container start and SSH is up**, before the sandbox is marked ready. Used for setup tasks: install dependencies, configure tools, prepare the workspace. Runs after built-in setup (git clone, env vars).
- `runtimeCommand` = what runs when the **user connects via `tsa run`** (launches the AI tool interactively)
- `tsa ssh` connects without executing `runtimeCommand` — plain shell only

**Startup sequence:**
1. Container starts → SSH server starts
2. Built-in setup runs (git clone if `gitRepo` set, env vars applied)
3. `initScript` runs if set (user's custom setup)
4. Sandbox marked "ready" — connections accepted
5. User connects via `tsa run` (executes `runtimeCommand`) or `tsa ssh` (plain shell)

**Init script error handling:** If `initScript` exits non-zero, sandbox status reflects the failure so the user knows setup didn't complete. Pod stays running so they can `tsa ssh` in to debug.

### Org Seeding

When an organization is created, the backend seeds default sandbox records — one per built-in runtime (Claude Code, Codex, OpenCode, Base). These are real rows, immediately startable, editable, and copyable. Seed configs come from the `SandboxPresets` domain constant.

## Domain Types

### ESandboxRuntime Enum

```typescript
enum ESandboxRuntime {
  claudeCode = 'claude-code',
  codex = 'codex',
  openCode = 'opencode',
  custom = 'custom',
}
```

### SandboxRuntimeConfigs

Domain constant mapping each built-in runtime to its container start command and runtime command:

```typescript
const SandboxRuntimeConfigs: Record<ESandboxRuntime, {
  command?: string[],          // container start (keeps pod alive, starts SSH)
  args?: string[],             // container start args
  runtimeCommand?: string,     // AI tool launch command (executed by tsa run)
  initScript?: string,         // default init script for this runtime
}> = {
  [ESandboxRuntime.claudeCode]: { command: [...], args: [...], runtimeCommand: 'claude-code', initScript: '...' },
  [ESandboxRuntime.codex]:      { command: [...], args: [...], runtimeCommand: 'codex', initScript: '...' },
  [ESandboxRuntime.openCode]:   { command: [...], args: [...], runtimeCommand: 'opencode', initScript: '...' },
  [ESandboxRuntime.custom]:     {},  // all fields user-specified or image defaults
}
```

Shared across backend (pod manifest builder) and REPL (`tsa run` reads `runtimeCommand`).

### SandboxPresets

Domain constant with default `TKubeSandboxConfig` for each built-in runtime. Used by org creation seeding:

```typescript
const SandboxPresets: Record<ESandboxRuntime, { name: string, description: string, config: Partial<TKubeSandboxConfig> }> = {
  [ESandboxRuntime.claudeCode]: {
    name: 'Claude Code',
    description: 'Anthropic Claude Code AI assistant',
    config: { runtime: ESandboxRuntime.claudeCode, image: 'tdsk/sandbox:latest', sshEnabled: true, resources: { requests: { cpu: '1', memory: '2Gi' }, limits: { cpu: '2', memory: '4Gi' } } }
  },
  // ... codex, openCode, custom
}
```

### Sandbox Model Class

Add `builtIn: boolean` property matching the new DB column. No other structural changes — `config` is already `TKubeSandboxConfig`.

## Backend API

### Existing Endpoints — No Changes

All sandbox CRUD and lifecycle endpoints remain as-is:
- `POST /sandboxes` — create
- `PATCH /sandboxes/:id` — edit
- `DELETE /sandboxes/:id` — delete
- `POST /sandboxes/:id/start` — start pod
- `POST /sandboxes/:id/stop` — stop pod
- `POST /sandboxes/:id/connect` — SSH connect
- `POST /sandboxes/:id/exec` — run command in pod
- `GET /sandboxes/:id/sessions` — list SSH sessions

### New Endpoint

**`POST /sandboxes/:id/copy`** — Deep-copies the sandbox record with a new ID, sets `builtIn: false`. Returns the new sandbox. User can then edit the copy freely.

### Org Creation Seeding

The org creation flow (existing endpoint) gains a post-creation hook that inserts default sandbox rows from `SandboxPresets`. Each seeded sandbox gets `builtIn: true`.

### Pod Manifest Builder

`buildPodManifest()` in `repos/sandbox` gains runtime-aware container start command resolution:

1. If `config.runtime` is a known built-in → look up container start command from `SandboxRuntimeConfigs`, set `TDSK_RUNTIME` env var on the pod
2. If `config.runtime === 'custom'` with `command`/`args` set → use those as the container start command
3. If `config.runtime === 'custom'` with no `command`/`args` → omit from pod spec, image defaults apply

The container start command is responsible for keeping the pod alive and starting the SSH server. It does NOT launch the AI tool — that happens later when the user connects via `tsa run`.

The `TDSK_RUNTIME` env var and `config.runtimeCommand` are informational at the pod level — consumed by `tsa run` to know what command to execute after SSH connect.

## Admin UI

### Navigation Reorder

Both org-level and project-level sidebars reorder nav items:

**Current:** Agents, Sandboxes, Endpoints, Functions, Secrets, Providers...
**New:** Sandboxes, Endpoints, Functions, Secrets, Providers, ..., Agents (bottom)

### Project Landing — Unified Workspace View

A new dashboard component replaces the current project overview as the default route when navigating into a project.

**Panels:**
- **Sandboxes** — Active sandboxes with status indicators (Running/Stopped/Starting), inline Start/Stop/Connect actions, "New Sandbox" and "Copy" buttons
- **Recent Threads** — Latest conversation threads across agents, showing thread name, agent, last message timestamp, quick link to continue
- **Quick Actions bar** — Create Sandbox, Connect to Running Sandbox, Sync Files, Start Chat. Most common operations surfaced as prominent buttons
- **Activity feed** (lightweight) — Recent sandbox starts/stops, thread messages, config changes. Project pulse at a glance

Individual pages (Sandboxes list, Agents list, etc.) still exist as dedicated nav items for full CRUD.

### Sandbox Creation Flow

"New Sandbox" opens a picker:
- Built-in presets shown as cards with icon and description (Claude Code, Codex, OpenCode, Base)
- "Custom Image" option — blank config, user provides image URL
- Selecting a preset creates the sandbox record and opens the SandboxDrawer pre-filled for review/tweaking

### SandboxDrawer Updates

- New **Runtime** dropdown: built-in runtimes + "Custom"
- When built-in selected → `runtimeCommand` shown as read-only (resolved from `SandboxRuntimeConfigs`), container start command hidden (backend resolves)
- When "Custom" selected → four fields appear:
  - **Start Command** (`command`/`args`) — what runs when the container starts (optional, image defaults if empty)
  - **Init Script** (`initScript`) — multi-line editor for setup script that runs after container start (optional)
  - **Runtime Command** (`runtimeCommand`) — what `tsa run` executes after SSH connect (optional, plain shell if empty)
- When built-in selected → `initScript` shown as editable (pre-filled from preset, user can customize)

### Agent Pages

Remain fully functional. No removal of routes, components, or features. Only change is nav position (moved to bottom).

## REPL (tsa CLI)

### New Command: tsa run

Unified sandbox launch + connect + sync:

```
tsa run <sandbox-id> [--org <id>] [--sync [source]] [--no-sync]
tsa run --list                    # list sandboxes, pick interactively
```

**Flow:**
1. Resolve sandbox config (by ID or interactive picker from `--list`)
2. Start pod if not already running
3. Inject SSH keys
4. Start file sync if `--sync` flag or sandbox config has sync defaults (skip with `--no-sync`)
5. SSH into the pod and execute the `runtimeCommand` — user is attached to the AI tool interactively
6. On exit: stop sync, optionally stop pod (prompt or `--stop` flag)

The key difference from `tsa ssh`: after connecting, `tsa run` executes the sandbox's `runtimeCommand` (e.g. `claude-code`) as the SSH command, so the user lands directly in the AI tool. `tsa ssh` gives a plain shell with no runtime launched.

Wraps existing `tsa ssh` + `tsa sync` primitives — orchestration layer, no duplication.

### Help Output Reorder

```
Commands:
  run          Start and connect to a sandbox (recommended)
  sandboxes    List sandbox configurations
  ssh          SSH into a running sandbox
  sync         Manage file synchronization
  chat         Interactive agent chat
  agents       List available agents
  threads      Manage conversation threads
  ...
```

`tsa run` is the hero command — first in list, marked as recommended.

### Existing Commands

All preserved, no removal:
- `tsa ssh` — plain shell SSH, no runtime launched
- `tsa sync` — manual sync management
- `tsa sandboxes` — list sandbox configs
- `tsa chat` — agent interaction (listed lower)
- `tsa agents` — list agents (listed lower)
- `tsa threads` — thread management (listed lower)

## Agent Deprioritization

**Principle:** Zero functional regression. Changes are cosmetic only.

| Layer | What Changes | What Stays |
|-------|-------------|------------|
| Admin UI | Nav position (moved to bottom) | All pages, routes, CRUD, chat, threads |
| REPL | Help text ordering | All commands, chat flow, agent API |
| Backend | Nothing | All endpoints, AgentRunner, SSE/WS paths |
| Database | Nothing | Agent schema, agent_projects, threads, messages |
| Domain | Nothing | Agent model, types, config resolution |

Agents continue to create their own sandbox context at runtime via `resolveAgentConfig()`, separate from the user-facing sandbox records. This coupling is unchanged.

## Security

No changes required. The existing security infrastructure is already sandbox-native:

- **MITM egress proxy** — iptables DNAT routes sandbox pod traffic through the proxy, replacing `tdsk_ph_*` placeholder tokens with real secrets. Works regardless of what runs inside the sandbox.
- **Secret injection** — Secrets referenced via `config.secretIds` are decrypted and injected as env vars at pod creation. Exclusive arc scoping (org, project, provider, or agent) unchanged.
- **SSH authentication** — Auto-generated random password per pod lifecycle, double auth (TDSK + SSH), pod ownership validation on connect. Unchanged.
- **Secret scoping** — Project-scoped sandboxes access project + org secrets. Org-scoped sandboxes access org secrets only. Unchanged.

No new attack surfaces introduced by the pivot.

## Docker Images

### Base Image

Single base image (`tdsk/sandbox`) with all built-in AI tools pre-installed:

- Ubuntu base with common dev tools (git, curl, build-essential, etc.)
- Node.js, Python runtimes
- OpenSSH server (for tsa ssh / file sync)
- Claude Code, Codex CLI, OpenCode binaries pre-installed (but not auto-started)
- CA cert volume mount point (for MITM proxy TLS)
- Startup script that starts SSH and waits — does NOT launch any AI tool

**Container startup flow:**
1. Pod starts → startup script runs
2. SSH server starts
3. Built-in setup runs (git clone if configured, env vars applied)
4. `initScript` runs if set (user's custom setup — install deps, configure tools, etc.)
5. Sandbox marked "ready" — if `initScript` fails, status reflects it but pod stays running for debugging
6. Container stays alive and idle, waiting for user connections
7. No AI tool is launched — the pod is just a ready environment

**User connection flows:**
- `tsa run <id>` → SSH in + execute `runtimeCommand` (e.g. `claude-code`) → user lands in the AI tool
- `tsa ssh <id>` → SSH in → plain shell, no AI tool launched

### Custom Images

- User provides any Docker image
- **Start command** (`command`/`args`): overrides container entrypoint/cmd. If unset, image defaults apply
- **Runtime command** (`runtimeCommand`): executed by `tsa run` after SSH connect. If unset, `tsa run` behaves like `tsa ssh` (plain shell)
- Start command and runtime command are configured independently
- MITM proxy (iptables + CA cert) still applies via init container regardless of image
- SSH access works only if the user's image includes an SSH server

### Image Versioning

- Base image tagged with tool versions: `tdsk/sandbox:claude-code-1.x`, etc.
- `latest` tag tracks most recent stable combination
- Built-in sandbox presets reference specific tags, updatable via `SandboxPresets` constant

## Summary of Changes by Repo

| Repo | Changes |
|------|---------|
| **domain** | `ESandboxRuntime` enum, `SandboxRuntimeConfigs` map (container start + init script + runtime command), `SandboxPresets` seed configs, `runtime` + `runtimeCommand` + `initScript` fields on `TKubeSandboxConfig`, `builtIn` on Sandbox model |
| **database** | `builtIn` column on sandboxes table, runtime in config jsonb (no schema migration needed — jsonb) |
| **backend** | `POST /sandboxes/:id/copy` endpoint, org-creation seeding hook, runtime resolution in `buildPodManifest()` |
| **sandbox** | `buildPodManifest()` resolves container start command from runtime config, sets `TDSK_RUNTIME` env var. Runtime command is NOT used at pod level — consumed by `tsa run` |
| **admin** | Nav reorder, unified workspace dashboard, runtime picker in SandboxDrawer, preset cards in creation flow, copy action on sandboxes |
| **repl** | New `tsa run` command (SSH + execute `runtimeCommand`), `tsa ssh` unchanged (plain shell), help output reordered |
| **agent** | No changes |
| **proxy** | No changes |
| **cli** | Docker image build updates for new base image |

---
name: "tdsk-tsa"
description: "Knowledge base for the terminal TSA CLI for AI agent interaction"
version: "2.0.0"
tags: ["cli", "tsa", "bun", "agent", "terminal", "interactive", "session", "proxy-adapter", "args-parse", "tasks", "pi-tui", "tui", "sandbox", "mutagen", "sync"]
---
# TSA Repo Skill

## Overview

The **TSA** repo (`repos/tsa`, `@tdsk/tsa`) is a terminal-based interactive CLI for communicating with ThreadedStack AI agents and managing sandboxes. It provides:

- **Pi-TUI Terminal UI** — Full terminal UI built with `@mariozechner/pi-tui` (pure TypeScript/WebSocket-based TUI renderer, NOT React)
- **Decoupled Business Logic** — `ChatLogic` class manages all state; renderers (`PiTuiApp`, `PiTuiChat`, `PiTuiStatus`) are pure display
- **Local Agent Execution** — Runs agent ReAct loops locally via session-based LLM proxy (API keys never leave the backend)
- **Sandbox-First Workflow** — `tsa run` is the hero command: start sandbox, sync files, launch AI tool runtime
- **File Sync** — Mutagen-based bidirectional file sync via SyncManager, CliDriver, configLoader, ignoreResolver, sshConfig
- **Persistent Authentication** — API key-based login stored in YAML config (`~/.config/tdsk/tsa.yaml`)
- **Two-Layer Configuration** — Global config (`~/.config/tdsk/tsa.yaml`) merged with project config (`.tdsk/config.yaml`)
- **Context Injection** — Auto-detects `AGENTS.md` and `.tdsk/context/` files, prepends to prompts as XML blocks
- **Slash Command System** — 21 slash commands in a registry with pre-auth filtering
- **Lifecycle Hooks** — Shell commands triggered on session/tool/error events via config
- **Rich Terminal Output** — Themed colors (dark/light), markdown rendering, streaming responses, tool call visualization
- **Task-Based Architecture** — CLI commands implemented as `@keg-hub/args-parse` tasks with auto-generated help
- **Error Classification** — `classifyApiError()` and `toFriendlyError()` for user-friendly error messages
- **Session Caching** — 55-minute TTL (server sessions expire at 60 minutes)
- **Compilable Binary** — Produces a standalone `tsa` binary via `bun build --compile`

**Runtime**: Bun (not Node.js) — the entry point uses `#!/usr/bin/env bun`

**Binary Name**: `tsa` (was `tdsk-agent` in v2.x)

**Key Problem Solved**: Bridges server-hosted agent management with local execution, giving developers an interactive chat interface for testing and using agents without a browser UI. Also serves as the primary entry point for launching AI tool runtimes in managed sandboxes. LLM API keys never leave the server — the TSA uses session tokens to proxy LLM calls through the backend.

## Directory Structure

```
repos/tsa/
├── configs/              # Biome, vitest config
├── scripts/build.ts      # Bun build script: bundle + optional compile to native binary
├── src/
│   ├── index.ts           # CLI entry point (#!/usr/bin/env bun)
│   ├── main.ts            # main() entry — sets up env, calls cli.ts
│   ├── cli.ts             # argsParse + task dispatch
│   ├── constants/         # Version, paths, defaults, retry config, error patterns, tool names, sync paths
│   │   ├── api.ts         # RetryStatusCodes, RetryNetworkCodes
│   │   ├── errors.ts      # FRIENDLY_ERRORS, classifyApiError(), toFriendlyError()
│   │   ├── paths.ts       # ConfigDir, ConfigPath, HistoryDir, ProjectDir, etc.
│   │   ├── sync.ts        # MutagenNpmVersion, SSH paths, PrivateKeyPath, ProxyWrapperPath
│   │   ├── values.ts      # ApiKeyPrefix, defaults, ConnectionColors, ToolDisplayNames, SpinnerFrames, PreAuthCommands
│   │   └── version.ts     # Build-time version injection
│   ├── types/             # TypeScript types for client, commands, config, context, session, tasks, theme, tools
│   ├── tasks/             # 14 CLI task definitions (run, chat, login, logout, status, agents, threads, sandboxes, ssh, proxy, sync, sessions, help)
│   ├── commands/          # 21 slash commands for in-TSA use (/help, /login, /fork, /tree, /projects, etc.)
│   ├── renderers/         # Pi-TUI renderer classes (PiTuiApp, PiTuiChat, PiTuiStatus, chatLogic)
│   ├── services/          # ConfigService, ContextLoader, HooksService, ApiClient, AuthManager, Executor, SyncManager
│   │   ├── api.ts         # ApiClient (extends ApiService from @tdsk/domain)
│   │   ├── auth.ts        # AuthManager class (login/logout/credentials via ConfigService)
│   │   ├── config.ts      # ConfigService (YAML global + project merge)
│   │   ├── context.ts     # ContextLoader (auto-detect AGENTS.md + .tdsk/context/)
│   │   ├── executor.ts    # Executor (WebSocket LLM proxy with session caching)
│   │   ├── hooks.ts       # HooksService (lifecycle shell commands)
│   │   └── sync/          # Mutagen file sync subsystem
│   │       ├── configLoader.ts   # mergeRules(), resolveSourcePath()
│   │       ├── ignoreResolver.ts # Resolve .gitignore + .tdskignore patterns
│   │       ├── mutagenClient.ts  # CliDriver (Mutagen CLI wrapper)
│   │       ├── sshConfig.ts      # ensureSshConfig(), getPublicKey()
│   │       └── syncManager.ts    # SyncManager (start/stop/status lifecycle)
│   ├── theme/             # Dark/light theming via picocolors
│   ├── utils/
│   │   ├── api/           # resolveOrg helper
│   │   ├── friendly-errors.ts  # Friendly error formatting
│   │   ├── markdown.ts    # Markdown rendering for terminal
│   │   ├── tasks/         # Shared task utilities (resolveOrgId, resolveProjectId, sandboxConnect, sandboxSync, spawnSsh, etc.)
│   │   └── tools/         # Tool name display helpers
│   └── dist/              # Bundled JS + native binary (tsa)
```

## Architecture

### Component Diagram

```
CLI Entry (main.ts) → main() (cli.ts)
    ├── hasArg() — Handle --version/-v directly
    ├── find() — Resolve task from registry by name/alias
    ├── loadConfig() — Load user config (global YAML + project YAML, merged)
    ├── addDefaults() — Merge config defaults into task option definitions
    ├── argsParse() — Parse CLI arguments with task-specific options
    ├── AuthManager — Persistent login (API key + proxy URL via ConfigService)
    │
    └── task.action(context) — Dispatch to task handler:
        │
        ├── run (hero) → Connect sandbox → sync files → SSH with runtime command
        ├── login → Validate API key against /_/orgs, store in config
        ├── logout → Remove auth config
        ├── status → Show login status (masked API key)
        ├── agents → List agents for org (auth required)
        ├── threads → List threads for agent (auth required)
        ├── sandboxes → List sandbox configs for org (auth required)
        ├── sessions → List/share/unshare sandbox sessions (auth required)
        ├── sync → Start/stop Mutagen file sync (auth required)
        ├── ssh → Interactive SSH to sandbox pod (auth required)
        ├── proxy → Internal SSH ProxyCommand transport via WebSocket tunnel
        ├── help → Show command list with examples
        │
        └── chat (default) → Pi-TUI Application:
            │
            ├── ChatLogic (renderers/chatLogic.ts) — Pure TS business logic:
            │   ├── Phase management: login → loading → pickProject → pickAgent → chat
            │   ├── Session state: orgId, agentId, threadId, projectId, connection
            │   ├── Chat state: messages[], streamText, isStreaming, toolCalls[]
            │   ├── Event callbacks: onPhaseChange, onMessagesChange, onStreamingChange, etc.
            │   ├── Slash command dispatch: parseCommand → findCommand → handler
            │   └── Error classification: classifyApiError() → auto-logout on auth errors
            │
            ├── PiTuiApp (renderers/PiTuiApp.ts) — TUI orchestrator:
            │   ├── TUI layout: Container + Editor + PiTuiChat + PiTuiStatus
            │   ├── Phase rendering: welcome text, loader, select list, error text
            │   ├── Inline menu system (for slash command pickers)
            │   ├── Connects ChatLogic callbacks to TUI component updates
            │   └── Uses pi-tui: TUI, Text, Spacer, Loader, Editor, Container, SelectList, ProcessTerminal
            │
            ├── PiTuiChat (renderers/PiTuiChat.ts) — Message display:
            │   ├── Renders chat messages, streaming text, tool activity
            │   ├── Markdown rendering via pi-tui Markdown component
            │   └── Implements pi-tui Component interface
            │
            ├── PiTuiStatus (renderers/PiTuiStatus.ts) — Status bar:
            │   ├── Connection dot (green/yellow/red)
            │   ├── Agent name, thread ID, model, provider, project
            │   └── Implements pi-tui Component interface
            │
            ├── Executor (services/executor.ts) — Agent execution:
            │   ├── Session caching: 55-minute TTL (server: 60 min)
            │   ├── WebSocket connection to /ai/ws with session token
            │   ├── Streaming events forwarded via onEvent callback
            │   └── Abort/destroy lifecycle methods
            │
            └── Slash Command System:
                ├── parseCommand() → { name, args }
                ├── findCommand() → TSlashCommand | null
                ├── isPreAuthCommand() → boolean (login, help, exit allowed before auth)
                └── 21 registered commands (see Slash Commands section)
```

### Request Flow

```
1. User types message in Editor (pi-tui Editor component)
2. ChatLogic.handleSubmit(text)
   - If starts with '/': parseCommand → findCommand → handler(args, context)
   - Otherwise: proceed with agent execution
3. Executor.run()
   a. ensureSession(agentId, providerId?) → cached or creates new session (55-min TTL)
   b. Creates thread if none exists
   c. Prepends context files as <context> XML blocks
   d. Connects to backend WebSocket (/ai/ws?token=<sessionToken>)
   e. Sends prompt message, receives streaming events
4. WebSocket → /ai/ws with ?token=<session-token>
   - Backend injects API key server-side, streams responses via WebSocket
5. Event handling in ChatLogic:
   - 'text_delta' → append to streamText buffer (50ms throttled flush to TUI)
   - 'tool_call_start' → add tool to toolCalls[] (shows spinner)
   - 'tool_result' → update tool status (success/error)
   - 'error' → add system message, classify error
6. On completion: save threadId, add assistant message, clear stream
7. PiTuiChat re-renders with updated messages/stream state
```

## Two Command Systems

### 1. CLI Tasks (`src/tasks/`) — Terminal Commands

Invoked from the terminal: `tsa run`, `tsa chat`, `tsa ssh`, etc. Use `@keg-hub/args-parse` for argument parsing.

```typescript
type TTask = {
  name: string
  alias?: string[]
  description: string
  example?: string
  options?: Record<string, TTaskOption>
  tasks?: Record<string, TTask>  // Sub-tasks (e.g., sessions share/unshare, sync stop)
  action?: TTaskAction
}

type TTaskAction = (context: {
  params: Record<string, any>
  task: TTask
  tasks: TTasks
  auth: AuthManager
  config?: TTsaConfig
  options?: string[]
}) => Promise<void>
```

**Task Registry** (`src/tasks/index.ts`):

| Task | Alias | Description |
|------|-------|-------------|
| `run` | — | **Hero command** — Start sandbox, sync files, launch AI tool runtime |
| `chat` | `ch` | Start interactive chat (default, renders Pi-TUI App) |
| `login` | `li` | Authenticate with API key |
| `logout` | `lo` | Remove stored credentials |
| `status` | `st` | Show authentication status |
| `agents` | `ag` | List agents (auth required) |
| `threads` | `th` | List threads for agent (auth required) |
| `sandboxes` | `sb` | List sandbox configs for org (auth required) |
| `sessions` | `session` | List/share/unshare sandbox sessions (auth required) |
| `sync` | — | Start/stop Mutagen file sync (auth required) |
| `ssh` | — | Interactive SSH connection to sandbox pod (auth required) |
| `proxy` | — | Internal SSH ProxyCommand transport via WebSocket tunnel |
| `help` | `--help`, `-h` | Show available commands |

**Sub-Tasks**:
- `sessions share <session-id>` — Make a session public (shareable with project members)
- `sessions unshare <session-id>` — Make a session private
- `sync stop [<sandbox-id> | --all]` — Stop file sync sessions

### 2. Slash Commands (`src/commands/`) — In-TSA Commands

Invoked within the Pi-TUI chat session: `/help`, `/fork <id>`, `/tree`, `/projects`, etc.

```typescript
type TSlashCommand = {
  name: string
  aliases: string[]
  description: string
  handler: (args: string, ctx: TSlashCommandContext) => Promise<string | void>
}

type TSlashCommandContext = {
  orgId: string
  agentId: string
  verbose: boolean
  exit: () => void
  connection: string
  threadId: string | null
  projectId: string | null
  clearMessages: () => void
  output: (text: string) => void
  setAgentId: (id: string) => void
  setVerbose: (v: boolean) => void
  setProviderId: (id: string) => void
  setProjectId: (id: string) => void
  addContextFile: (path: string) => void
  setThreadId: (id: string | null) => void
  removeContextFile: (index: number) => void
  messages: Array<{ type: string; content: string }>
  contextFiles: Array<{ path: string; name: string; content: string; sizeBytes: number }>

  // Thread operations
  deleteThread: (threadId: string) => Promise<void>
  loadThreadMessages: (threadId: string) => Promise<void>
  createThread: (name?: string) => Promise<{ id: string; name?: string }>
  listThreads: () => Promise<Array<{ id: string; name?: string; createdAt?: string }>>
  branchThread: (threadId: string, messageId: string) => Promise<{ id: string; name?: string }>
  getThreadWithBranches: (threadId: string) => Promise<{
    id: string; name?: string
    parentThreadId?: string
    branches?: Array<{ id: string; name?: string; branchMessageId?: string }>
    parentThread?: { id: string; name?: string }
  }>

  // Project/Agent operations
  switchProject: () => Promise<void>
  listProjects: () => Promise<TSelectItem[]>
  listAgents: () => Promise<TSelectItem[]>

  // Menu system (renders inline in TUI, not overlay)
  showMenu: (prompt: string, items: TSelectItem[], onSelect: (item: TSelectItem) => void, options?: { onAction?: (item: TSelectItem) => void }) => void
  closeMenu: () => void

  // Auth
  auth: {
    loggedIn: boolean
    logout: () => void
    login: (apiKey: string, proxyUrl?: string, insecure?: boolean) => Promise<void>
  }
}
```

**Slash Command Registry** (`src/commands/registry.ts`):

| Command | Aliases | Description | Status |
|---------|---------|-------------|--------|
| `/help` | `/h` | Show available commands | Working |
| `/exit` | `/quit`, `/q` | Exit the TSA | Working |
| `/login` | `/li` | Authenticate with API key | Working |
| `/logout` | `/lo` | Remove credentials | Working |
| `/clear` | `/cl` | Clear screen | Working |
| `/verbose` | `/v` | Toggle verbose mode | Working |
| `/new` | `/n` | Start new thread | Working |
| `/agent` | `/a` | Switch to different agent | Working |
| `/switch` | `/sw` | Switch to different thread | Working |
| `/provider` | `/p` | Switch LLM provider | Working |
| `/add` | — | Add context file | Working |
| `/remove` | `/rm` | Remove context file | Working |
| `/info` | `/i` | Show session info | Working |
| `/context` | `/ctx` | List context files | Working |
| `/history` | `/hist` | Show thread history | Working |
| `/threads` | `/t` | List threads | Working |
| `/fork` | `/br` | Branch current thread at a message | Working |
| `/tree` | `/tr` | Display thread branch hierarchy as ASCII tree | Working |
| `/projects` | `/proj` | Switch project | Working |

**Pre-Auth Commands**: `login`, `help`, `exit`, `quit`, `q`, `h`, `li` — allowed before authentication.

## Key Components

### Renderers (`src/renderers/`)

The TUI layer is built on `@mariozechner/pi-tui`, a pure TypeScript/WebSocket-based terminal renderer. Components implement the `Component` interface from pi-tui.

**PiTuiApp** (`renderers/PiTuiApp.ts`) — Main TUI orchestrator:
- Creates `TUI` instance with `ProcessTerminal`
- Manages layout: `Container` (main) → `PiTuiStatus` + `PiTuiChat` + `Editor`
- Handles phase transitions by swapping transient components (welcome text, loader, select list, error)
- Inline menu system for slash command pickers (replaces overlays)
- Connects `ChatLogic` callbacks to TUI component updates
- Uses pi-tui components: `TUI`, `Text`, `Spacer`, `Loader`, `Editor`, `Container`, `SelectList`, `ProcessTerminal`, `CombinedAutocompleteProvider`
- Configures `EditorTheme` and `selectListTheme` with chalk colors

**PiTuiChat** (`renderers/PiTuiChat.ts`) — Chat message rendering:
- Implements pi-tui `Component` interface
- Renders messages, streaming text, and tool activity indicators
- Uses pi-tui `Markdown` component with custom `MarkdownTheme` (chalk-based colors)
- Manages welcome box display (agent name, description, context count)

**PiTuiStatus** (`renderers/PiTuiStatus.ts`) — Status bar:
- Implements pi-tui `Component` interface
- Single-line status: connection dot (green/yellow/red) + org + agent + thread + model + provider + project
- `setStatus(metadata)` updates display metadata

**ChatLogic** (`renderers/chatLogic.ts`) — Decoupled business logic:
- Pure TypeScript class, no UI framework dependency
- Manages all TSA state: phase, session, messages, streaming, errors
- Event callbacks (`onPhaseChange`, `onMessagesChange`, `onStreamingChange`, `onStatusChange`, `onError`, etc.) allow any renderer to subscribe
- 50ms throttled stream buffer flush for smooth rendering
- Error classification via `classifyApiError()` — auto-logout on auth errors
- Phase transitions: `login` → `loading` → `pickProject` → `pickAgent` → `chat`
- Handles slash command dispatch, agent/project selection, thread management

### AuthManager (`src/services/auth.ts`)

```typescript
class AuthManager {
  creds(): TAuthCredentials | null       // Read from ConfigService.loadGlobal().auth
  loggedIn(): boolean
  async login(apiKey, proxyUrl?, insecure?)  // Validate against /_/orgs + store via ConfigService
  logout(): void                              // Remove auth from config
}
```

- **Config Path**: `~/.config/tdsk/tsa.yaml` (auth section)
- **Default Proxy**: `https://px.local.threadedstack.app`
- **Validation**: Fetches `/_/orgs` endpoint to verify API key works
- **API Key Prefix**: `tdsk_` (validated on login)

### ApiClient (`src/services/api.ts`)

Extends `ApiService` from `@tdsk/domain` with automatic retry and auth injection.

```typescript
class ApiClient extends ApiService {
  get proxyUrl(): string

  // Organizations
  listOrgs(): Promise<TApiResponse<Organization[]>>
  getOrg(orgId): Promise<TApiResponse<Organization>>

  // Agents
  listAgents(orgId): Promise<TApiResponse<Agent[]>>
  getAgent(orgId, agentId): Promise<TApiResponse<Agent>>

  // Sessions
  createSession(agentId, providerId?): Promise<TApiResponse<TSessionInfo>>

  // Providers
  listProviders(orgId): Promise<TApiResponse<TProviderInfo[]>>

  // Projects
  listProjects(orgId): Promise<TApiResponse<any[]>>

  // Threads
  listThreads(orgId, agentId): Promise<TApiResponse<Thread[]>>
  getThread(orgId, agentId, threadId, opts?): Promise<TApiResponse<Thread>>
  createThread(orgId, agentId, name?): Promise<TApiResponse<Thread>>
  branchThread(orgId, agentId, threadId, messageId): Promise<TApiResponse<Thread>>
  deleteThread(orgId, agentId, threadId): Promise<TApiResponse<void>>

  // Messages
  listMessages(orgId, agentId, threadId, opts?): Promise<TApiResponse<Message[]>>
  createMessage(orgId, agentId, threadId, data): Promise<TApiResponse<Message>>

  // Sandboxes
  listSandboxes(orgId, projectId?): Promise<TApiResponse<any[]>>
  getSandbox(orgId, sandboxId): Promise<TApiResponse<any>>
  connectSandbox(orgId, projectId, sandboxId): Promise<TApiResponse<any>>
  getSandboxSessions(orgId, projectId, sandboxId): Promise<TApiResponse<TSandboxSession[]>>
  execInSandbox(orgId, projectId, sandboxId, podName, command): Promise<TApiResponse<any>>
  injectSshKey(orgId, projectId, sandboxId, podName, publicKey): Promise<TApiResponse>
}
```

- **Auth**: `Authorization: Bearer <apiKey>` on all `/_/*` requests via `#ensureAuth()` override
- **Session Creation**: `POST /_/ai/sessions` with `{ agentId, providerId? }` → `TSessionInfo`
- **Retry**: Up to 3 retries with delays `[1000, 3000, 9000]ms` on ECONNREFUSED, ETIMEDOUT, ENOTFOUND, 429, 5xx
- **Response Format**: Returns `TApiResponse<T>` (`{ ok, status, data?, error? }`)

### Executor (`src/services/executor.ts`)

WebSocket-based agent execution with session caching.

```typescript
class Executor {
  static SESSION_TTL_MS = 55 * 60 * 1000  // 55 minutes (server expires at 60)

  get client(): ApiClient
  createSession(agentId, providerId?): Promise<TSessionInfo>
  clearSession(): void
  abort(): void
  destroy(): void

  run(opts: TExecRunOpts): Promise<TRunResult>
}
```

**Run flow**:
1. `ensureSession()` — Returns cached session if valid (55-min TTL), otherwise creates new
2. Creates thread if none provided
3. Prepends context files as `<context>--- name ---\ncontent\n</context>` blocks
4. Connects to WebSocket at `/ai/ws?token=<sessionToken>`
5. Sends prompt, receives streaming events via `onEvent` callback
6. Events: `text_delta`, `tool_call_start`, `tool_result`, `error`, `done`

### ConfigService (`src/services/config.ts`)

YAML-based configuration management with two layers.

```typescript
class ConfigService {
  static loadGlobal(): TTsaConfig           // ~/.config/tdsk/tsa.yaml
  static saveGlobal(config: TTsaConfig)     // YAML dump, chmod 0600, mkdir 0700
  static loadProject(cwd?): TProjectConfig  // .tdsk/config.yaml
  static merge(global, project): TTsaConfig // Project org/agent override; hooks/tools merge
}
```

**Config Schema** (`TTsaConfig`):
```yaml
org: "org_xxx"          # Default organization ID
agent: "agent_xxx"      # Default agent ID
project: "proj_xxx"     # Default project
auth:
  apiKey: "tdsk_..."
  proxyUrl: "https://px.local.threadedstack.app"
  insecure: false
display:
  theme: "dark"         # dark | light | auto
  verbose: false
  markdown: true
  timestamps: false
behavior:
  autoResume: false
  maxHistory: 50
  confirmTools: false
sandbox:
  timeout: 300000
  provider: "local"     # local | e2b
  envVars: {}
sync:                   # TSyncConfig from @tdsk/domain
  rules:
    - source: "./src"
      target: "/workspace/src"
      mode: "one-way-replica"
      ignore: ["*.test.ts"]
  defaultIgnores:
    - "node_modules/"
    - ".git/"
    - ".DS_Store"
hooks:
  onSessionStart: "echo started"
  onSessionEnd: "echo ended"
  onToolCall: "echo tool called"
  onToolResult: "echo tool result"
  onError: "echo error"
  onMessage: "echo message"
tools:
  confirm: ["shellExec"]
  block: ["deleteFile"]
```

**Project Config** (`.tdsk/config.yaml`):
```yaml
org: "org_xxx"
agent: "agent_xxx"
context: ["./docs/api.md"]
hooks:
  onSessionStart: "echo project session"
tools:
  confirm: ["writeFile"]
  block: []
```

**Config Merge Rules**:
- Project `org`/`agent` **override** global
- Project `hooks` **merge** with global (project wins per-key)
- Project `tools.confirm`/`tools.block` **concatenate** with global arrays

### ContextLoader (`src/services/context.ts`)

```typescript
class ContextLoader {
  static autoDetect(cwd): TContextFile[]      // Scans AGENTS.md + .tdsk/context/
  static loadFile(path): TContextFile | null   // Manual file loading
}
```

- **Auto-detected sources**: `AGENTS.md` at cwd root, all files in `.tdsk/context/`
- **TContextFile**: `{ path, name, source: 'auto'|'manual', content, sizeBytes }`
- **Injection**: Context files prepended to prompt as XML `<context>` blocks by executor

### HooksService (`src/services/hooks.ts`)

```typescript
class HooksService {
  constructor(config: THooksConfig)
  run(name: keyof THooksConfig, env: Record<string, string>): Promise<void>
}
```

- Executes via `execFile('/bin/sh', ['-c', command], { env, timeout: 10000 })`
- Silently swallows errors (writes to stderr only)
- Available hooks: `onSessionStart`, `onSessionEnd`, `onToolCall`, `onToolResult`, `onError`, `onMessage`

### File Sync (`src/services/sync/`)

Mutagen-based file synchronization between local machine and sandbox pods.

| File | Class/Functions | Purpose |
|------|----------------|---------|
| `syncManager.ts` | `SyncManager` | High-level lifecycle: start, stop, stopAll, status |
| `mutagenClient.ts` | `CliDriver` | Low-level Mutagen CLI wrapper: create, list, terminate, flush |
| `configLoader.ts` | `mergeRules()`, `resolveSourcePath()` | Merge sync rules from config with defaults |
| `ignoreResolver.ts` | — | Resolve `.gitignore` + `.tdskignore` patterns into Mutagen ignore list |
| `sshConfig.ts` | `ensureSshConfig()`, `getPublicKey()` | SSH config setup for Mutagen, key pair management |

### Error Classification (`src/constants/errors.ts`)

```typescript
type TApiErrorKind = 'auth' | 'forbidden' | 'network' | 'notFound' | 'data' | 'server' | 'tls' | 'unknown'

function classifyApiError(err: unknown): TApiErrorKind
function toFriendlyError(error: Error): { message: string; suggestion?: string }
```

- `classifyApiError()` inspects Exception.status, error codes, and message patterns
- `toFriendlyError()` matches against `FRIENDLY_ERRORS` patterns for user-friendly messages
- TLS errors detected via patterns: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `self-signed certificate`, etc.

### Theme System (`src/theme/`)

```typescript
type TThemeColors = {
  primary: (s: string) => string    // cyan (dark) / blue (light)
  secondary: (s: string) => string  // dim
  success: (s: string) => string    // green
  warning: (s: string) => string    // yellow
  error: (s: string) => string      // red
  muted: (s: string) => string      // gray
  accent: (s: string) => string     // magenta
  border: (s: string) => string     // dim
  bold: (s: string) => string       // bold
}

function getTheme(name: 'dark' | 'light' | 'auto'): TThemeColors
function setTheme(name): void
function themed(color: keyof TThemeColors, text: string): string  // NO_COLOR aware
```

## CLI Commands

```bash
# Sandbox Runtime (hero command — first in help output)
tsa run <sandbox-id> [--org <id>] [--project <id>] [--no-sync] [--list]
tsa run --list                     # List available sandboxes

# File Sync
tsa sync <sandbox-id> [--org <id>] [--project <id>]
tsa sync stop <sandbox-id>         # Stop sync for a sandbox
tsa sync stop --all                # Stop all sync sessions

# Session Management
tsa sessions <sandbox-id> [--org <id>] [--project <id>]
tsa sessions share <session-id> [--org <id>] [--project <id>]
tsa sessions unshare <session-id> [--org <id>] [--project <id>]

# Authentication
tsa login <api-key> [--url <proxy-url>] [--insecure]
tsa logout
tsa status

# Discovery
tsa agents [--org <id>]
tsa threads <agent-id> [--org <id>]
tsa sandboxes [--org <id>]

# Interactive Chat (Pi-TUI)
tsa chat [--org <id>] [--agent <id>] [--thread <id>]
tsa                    # Default: launches chat

# Sandbox SSH
tsa ssh <sandbox-id> [--org <id>] [--project <id>]    # Interactive SSH to sandbox pod
tsa proxy <sandbox-id>                                  # ProxyCommand transport (used by SSH config)

# Help
tsa help / --help / -h
tsa --version / -v
```

## Configuration

### Config Paths

| Path | Format | Purpose |
|------|--------|---------|
| `~/.config/tdsk/tsa.yaml` | YAML | Global config (auth, display, behavior, hooks, tools, sync) |
| `.tdsk/config.yaml` | YAML | Project config (org, agent, context, hooks, tools) |
| `AGENTS.md` | Markdown | Auto-detected agent context file |
| `.tdsk/context/` | Directory | Auto-detected context files |
| `~/.config/tdsk/sandbox_key` | SSH Key | Generated SSH private key for sandbox access |
| `~/.config/tdsk/sandbox_key.pub` | SSH Key | Generated SSH public key for sandbox access |
| `~/.config/tdsk/bin/mutagen` | Binary | Mutagen binary path |
| `~/.config/tdsk/bin/tsa-proxy` | Script | SSH ProxyCommand wrapper script |

## Constants

### Values (`src/constants/values.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `ApiKeyPrefix` | `"tdsk_"` | API key prefix validation |
| `DefaultMaxSteps` | `10` | Agent runner max steps |
| `DefaultMaxHistory` | `50` | Max input history entries |
| `UpstreamTimeoutMS` | `30000` | 30 second upstream timeout |
| `DefaultTheme` | `"dark"` | Default color theme |
| `DefaultSandboxTimeout` | `300000` | 5 minutes |
| `DefaultProxyUrl` | `https://px.local.threadedstack.app` | Default proxy URL |
| `MaxRetries` | `3` | HTTP retry attempts |
| `RetryDelays` | `[1000, 3000, 9000]` | Retry delay progression (ms) |
| `ToolDisplayNames` | `Record<string, string>` | Friendly names for tools (readFile→"Read file", etc.) |
| `SpinnerFrames` | Braille characters | 10-frame braille spinner animation |
| `PreAuthCommands` | `Set<string>` | Commands allowed before authentication |

### Paths (`src/constants/paths.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `ConfigDir` | `~/.config/tdsk` | Global config directory |
| `ConfigPath` | `~/.config/tdsk/tsa.yaml` | Global config file |
| `HistoryDir` | `~/.config/tdsk/history` | Input history directory |
| `ProjectDir` | `.tdsk` | Project directory |
| `AgentsFile` | `AGENTS.md` | Agent context file |
| `ContextDir` | `.tdsk/context` | Context files directory |
| `ProjectConfig` | `.tdsk/config.yaml` | Project config file |

### Sync (`src/constants/sync.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `DefSyncTarget` | `"/workspace"` | Default sync target directory in sandbox |
| `DefSyncMode` | `"one-way-replica"` | Default Mutagen sync mode |
| `DefSyncIgnores` | `[".git/", "node_modules/", ...]` | Default ignore patterns |
| `MutagenNpmVersion` | `"0.19.0-dev.1"` | Required Mutagen npm package version |
| `SshDir` | `~/.ssh` | SSH directory |
| `SshConfig` | `~/.ssh/config` | SSH config file |
| `TdskConfigDir` | `~/.config/tdsk` | TDSK config directory |
| `TdskBinDir` | `~/.config/tdsk/bin` | TDSK binary directory |
| `MutagenBinPath` | `~/.config/tdsk/bin/mutagen` | Mutagen binary path |
| `ProxyWrapperPath` | `~/.config/tdsk/bin/tsa-proxy` | SSH ProxyCommand wrapper |
| `PrivateKeyPath` | `~/.config/tdsk/sandbox_key` | SSH private key |
| `PublicKeyPath` | `~/.config/tdsk/sandbox_key.pub` | SSH public key |
| `MutagenAgentsPath` | `~/.config/tdsk/bin/mutagen-agents.tar.gz` | Mutagen agents archive |

## Shared Task Utilities (`src/utils/tasks/`)

Extracted from individual tasks to enable reuse across `run.ts`, `ssh.ts`, `sync.ts`, `sessions.ts`:

| File | Purpose |
|------|---------|
| `resolveOrgId.ts` | Org resolution from params/config/single-org. Throws on failure (no `process.exit`) |
| `resolveProjectId.ts` | Project resolution from params/config. Throws on failure |
| `sandboxConnect.ts` | Connect to sandbox pod + inject SSH keys. Throws on failure, returns connect response |
| `sandboxSync.ts` | Auto-start/stop Mutagen file sync lifecycle. Auth errors re-throw (non-swallowed) |
| `spawnSsh.ts` | SSH process spawning with optional remote command + PTY support |
| `saveContext.ts` | Save resolved orgId/projectId back to config for subsequent runs |
| `requireAuth.ts` | Wrapper that ensures auth before running a task action |
| `addDefaults.ts` | Merge config defaults into task option definitions |
| `config.ts` | Load and merge global + project config |
| `find.ts` | Find task by name or alias in registry |
| `hasArg.ts` | Check for specific CLI arguments |
| `error.ts` | Error handling utilities |

**`tsa run` Flow** (`src/tasks/run.ts`):
1. Resolve org ID via `resolveOrgId()`
2. Resolve project ID via `resolveProjectId()`
3. Fetch sandbox config via `GET /_/orgs/:orgId/sandboxes/:id` (hard error if fails)
4. Connect to sandbox via `sandboxConnect()` (auto-starts pod if needed)
5. Start file sync via `sandboxSync()` (unless `--no-sync`)
6. SSH with runtime command via `spawnSsh()` with `config.runtimeCommand` as remote command
7. Exit non-zero on SSH failure

## Key Patterns

### Phase-Based App Lifecycle

```
Not logged in → 'login' → /login → 'loading' → 'pickProject' → 'pickAgent' → 'chat'
Already logged in → 'loading' → 'pickProject' or 'pickAgent' or 'chat'
Error at any point → 'error'
```

Phases defined in `EAppPhase` enum: `login`, `loading`, `pickProject`, `pickAgent`, `chat`, `error`.

### Pi-TUI Component Pattern

Components implement the pi-tui `Component` interface with `render(width: number): string[]` and `invalidate()`. State updates flow through ChatLogic callbacks → component setters → TUI re-render.

### Private Fields (#)

Uses JavaScript private fields for encapsulation throughout all classes.

### Event-Driven Streaming

Agent execution streams events to ChatLogic state via `onEvent` callback. ChatLogic buffers stream text with 50ms throttled flush and notifies the TUI renderer via `onStreamingChange` callback.

### Build-Time Version Injection

```typescript
// scripts/build.ts
define: { __TDSK_TSA_VERSION__: JSON.stringify(pkg.version) }
// src/constants/version.ts — falls back to package.json when running from source
```

### Error Classification Flow

```
Error → classifyApiError(err) → TApiErrorKind
                                    ├── 'auth' → auto-logout, show "please log in again"
                                    ├── 'tls' → suggest --insecure flag
                                    ├── 'network' → suggest checking connection
                                    └── other → toFriendlyError() → user-friendly message + suggestion
```

### Session Caching

```typescript
Executor.SESSION_TTL_MS = 55 * 60 * 1000  // 55 minutes
// Server expires sessions at 60 min — client refreshes 5 min early to avoid race
```

## Building

```bash
pnpm build           # Bundle via bun (bun build → dist/index.js)
pnpm compile         # Native binary (bun build --compile → dist/tsa)
```

The `start` command requires `bun` (not Node.js). The `compile` command produces a standalone native binary that doesn't require bun at runtime.

## Testing Patterns

- Mocks `fetch` globally via `vi.stubGlobal()` for API tests
- Co-located test files (`.test.ts` adjacent to source)
- ChatLogic tests use plain TypeScript (no TUI mocking needed — logic is decoupled)
- Slash command tests mock `TSlashCommandContext` directly
- Sync subsystem tests mock `CliDriver` and filesystem operations

## Dependencies

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-tui` | Terminal UI framework (replaces Ink/React) |
| `@nuanced-dev/mutagen` | File sync between local and sandbox pods |
| `@keg-hub/args-parse` | CLI argument parsing with task definitions |
| `@tdsk/domain` | Shared types, models, ApiService base class |
| `chalk` | Terminal color output (used by pi-tui themes) |
| `marked` + `marked-terminal` | Markdown rendering for terminal |
| `js-yaml` | YAML config parsing |
| `picocolors` | Lightweight terminal colors (theme system) |
| `ws` | WebSocket client for agent execution |

## Integration Points

### With Domain (`@tdsk/domain`)

- `ApiService` — base class for `ApiClient` with `TApiRequest`/`TApiResponse`
- `Exception` — error class with status codes
- `TStreamEvent`, `EStreamEventType` — streaming event types
- `TLLMProviderBrand`, `TMessageContent` — shared types
- `Organization`, `Agent`, `Thread`, `Message` — API response model classes
- `TSyncConfig`, `TSyncRule`, `TSyncMode` — sync configuration types
- `TSandboxSession` — sandbox session type

### With Backend API

- **Auth**: API key validated against `/_/orgs`
- **Sessions**: `POST /_/ai/sessions` — session token + LLM config
- **LLM Proxy**: `WS /ai/ws` — WebSocket streaming (session token auth)
- **Providers**: `GET /_/orgs/:orgId/providers`
- **Agents**: `/_/orgs/:orgId/agents` for listing
- **Projects**: `/_/orgs/:orgId/projects` for listing
- **Threads**: `/_/orgs/:orgId/agents/:agentId/threads` for CRUD + branching
- **Messages**: `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages`
- **Sandboxes**: `GET /_/orgs/:orgId/sandboxes` for listing
- **Sandbox Detail**: `GET /_/orgs/:orgId/sandboxes/:sandboxId`
- **Sandbox Connect**: `POST /_/orgs/:orgId/projects/:projectId/sandboxes/:sandboxId/connect`
- **Sandbox Sessions**: `GET /_/orgs/:orgId/projects/:projectId/sandboxes/:sandboxId/sessions`
- **Sandbox Exec**: `POST /_/orgs/:orgId/projects/:projectId/sandboxes/:sandboxId/exec`
- **Sandbox Tunnel**: `WS /_/sandboxes/:sandboxId/tunnel` for SSH proxy transport
- **Sandbox Shell**: `WS /_/sandboxes/:sandboxId/shell` for session visibility control

### With Proxy

- All API requests route through proxy at configured URL
- Default: `https://px.local.threadedstack.app`
- Auth: `Authorization: Bearer <apiKey>` header

### Adding New Tasks/Commands

Follow the pattern in existing files:
- **New CLI task**: Create `src/tasks/<command>.ts`, add to `src/tasks/index.ts`. Use `requireAuth()` wrapper if auth needed. Use `resolveOrgId()` and `resolveProjectId()` for org/project resolution.
- **New slash command**: Create `src/commands/<name>.ts`, add to `registeredCommands[]` in `src/commands/registry.ts`. Add to `PreAuthCommands` in `src/constants/values.ts` if needed before auth.
- **New renderer component**: Implement pi-tui `Component` interface with `render(width): string[]` and `invalidate()`. Wire to ChatLogic via callbacks.
- **New sync feature**: Add to `src/services/sync/`. Use `CliDriver` for Mutagen operations, `SyncManager` for lifecycle.

---
name: "tdsk-tsa"
description: "Knowledge base for the terminal TSA CLI for AI agent interaction"
version: "1.0.0"
tags: ["cli", "tsa", "bun", "agent", "terminal", "interactive", "session", "proxy-adapter", "args-parse", "tasks", "ink", "react", "tui"]
---
# TSA Repo Skill

## Overview

The **TSA** repo (`repos/tsa`, `@tdsk/tsa`) is a terminal-based interactive CLI for communicating with ThreadedStack AI agents. It provides:

- **Ink React TUI** — Full terminal UI built with Ink (React for CLIs)
- **Local Agent Execution** — Runs agent ReAct loops locally via session-based LLM proxy (API keys never leave the backend)
- **Persistent Authentication** — API key-based login stored in YAML config (`~/.config/tdsk/tsa/config.yaml`)
- **Two-Layer Configuration** — Global config (`~/.config/tdsk/tsa/config.yaml`) merged with project config (`.tdsk/config.yaml`)
- **Context Injection** — Auto-detects `AGENTS.md` and `.tdsk/context/` files, prepends to prompts as XML blocks
- **Slash Command System** — 16 slash commands in a registry with pre-auth filtering
- **Lifecycle Hooks** — Shell commands triggered on session/tool/error events via config
- **Rich Terminal Output** — Themed colors (dark/light), markdown rendering, streaming responses, tool call visualization
- **Task-Based Architecture** — CLI commands implemented as `@keg-hub/args-parse` tasks with auto-generated help
- **Compilable Binary** — Produces a standalone `tsa` binary via `bun build --compile`

**Runtime**: Bun (not Node.js) — the entry point uses `#!/usr/bin/env bun`

**Binary Name**: `tsa` (was `tdsk-agent` in v2.x)

**Key Problem Solved**: Bridges server-hosted agent management with local execution, giving developers an interactive chat interface for testing and using agents without a browser UI. LLM API keys never leave the server — the TSA uses session tokens to proxy LLM calls through the backend.

## Directory Structure

```
repos/tsa/
├── configs/              # Biome, vitest config, Ink test mocks
├── scripts/build.ts      # Bun build script: bundle + optional compile to native binary
├── src/
│   ├── index.ts           # CLI entry point (#!/usr/bin/env bun)
│   ├── cli.ts             # main() entry — argsParse + task dispatch
│   ├── constants/         # Version, paths, defaults, retry config, error patterns, tool names
│   ├── types/             # TypeScript types for client, commands, config, context, session, tasks
│   ├── tasks/             # 10 CLI task definitions (login, logout, status, agents, threads, chat, help, ssh, proxy, sandboxes)
│   ├── commands/          # 16 slash commands for in-TSA use (/help, /login, /agent, etc.)
│   ├── components/        # Ink React components (App, ChatSession, Prompt, etc.)
│   ├── hooks/             # React hooks for session, messages, config, context, auth state
│   ├── services/          # ConfigService (YAML), ContextLoader (auto-detect), HooksService (lifecycle)
│   ├── theme/             # Dark/light theming via picocolors
│   ├── auth/              # AuthManager class (login/logout/credentials via ConfigService)
│   ├── api/               # ApiClient — HTTP wrapper with retry logic
│   ├── executor/          # LocalAgentExecutor, HttpMessageAdapter (IAgentRunnerDB impl)
│   └── utils/             # Markdown rendering, friendly errors, task utilities
└── dist/                  # Bundled JS + native binary (tsa)
```

## Architecture

### Component Diagram

```
CLI Entry (index.ts) → main() (cli.ts)
    ├── hasArg() — Handle --version/-v directly
    ├── find() — Resolve task from registry by name/alias
    ├── loadConfig() — Load user config (global YAML + project YAML, merged)
    ├── addDefaults() — Merge config defaults into task option definitions
    ├── argsParse() — Parse CLI arguments with task-specific options
    ├── AuthManager — Persistent login (API key + proxy URL via ConfigService)
    │
    └── task.action(context) — Dispatch to task handler:
        │
        ├── login → Validate API key against /_/orgs, store in config.yaml
        ├── logout → Remove auth config
        ├── status → Show login status (masked API key)
        ├── agents → List agents for org (auth required)
        ├── threads → List threads for agent (auth required)
        ├── help → Show command list with examples
        │
        └── chat (default) → Ink React TUI:
            │
            ├── App.tsx — Phase-based root component:
            │   ├── 'login' phase → Login prompt with pre-auth slash commands
            │   ├── 'loading' phase → Spinner while connecting
            │   ├── 'pickAgent' phase → AgentPicker component
            │   ├── 'chat' phase → WelcomeBox + ChatSession
            │   └── 'error' phase → ErrorMessage component
            │
            ├── ChatSession.tsx — Main chat interface:
            │   ├── StatusBar (agent, provider, model, thread, connection)
            │   ├── MessageList (user/assistant/system messages)
            │   ├── StreamingResponse (spinner + tool activity + live text)
            │   └── Prompt (TextInput with '>' prefix)
            │
            ├── Slash Command System:
            │   ├── parseCommand() → { name, args }
            │   ├── findCommand() → TSlashCommand | null
            │   ├── isPreAuthCommand() → boolean (login, help, exit allowed before auth)
            │   └── 16 registered commands (see Slash Commands section)
            │
            ├── State Management (React hooks):
            │   ├── useSession() → orgId, agentId, threadId, provider, connection
            │   ├── useMessages() → messages[], streaming, toolCalls, clearStream
            │   ├── useAgent() → agents list, selection
            │   ├── useContext() → contextFiles, autoDetect, add/remove
            │   └── useConfig() → global + project config merged
            │
            ├── LocalAgentExecutor — Orchestrator:
            │   ├── createSession(agentId, providerId?) → TSessionInfo
            │   ├── Executor — LLM calls proxied through backend WS (/ai/ws)
            │   ├── createThread() → thread ID
            │   ├── Context injection (XML <context> blocks)
            │   └── AgentRunner.run() — Local ReAct loop with Executor
            │
            └── HttpMessageAdapter — IAgentRunnerDB over HTTP
```

### Request Flow

```
1. User types message at > prompt (Ink TextInput)
2. App.handleSubmit(text)
   - If starts with '/': parseCommand → findCommand → handler(args, context)
   - Otherwise: proceed with agent execution
3. LocalAgentExecutor.run()
   a. createSession(agentId, providerId?) → backend resolves API key, returns session token
   b. Creates thread if none exists
   c. Prepends context files as <context> XML blocks
   d. AgentRunner.run() with:
      - proxyConfig: { backendUrl, sessionToken } (LLM calls go through backend SSE)
      - llmConfig: { provider, model, maxTokens, systemPrompt }
      - db: HttpMessageAdapter (persists messages via HTTP)
      - onEvent: callback for streaming events
4. Executor → WS /ai/ws with ?token=<session-token>
   - Backend injects API key server-side, streams responses via WebSocket
5. Event handling in App.tsx:
   - 'text' → append to streamText (rendered as markdown)
   - 'tool_call_start' → add tool to toolCalls[] (shows spinner)
   - 'tool_result' → update tool status (success/error)
   - 'error' → add system message
6. On completion: save threadId, add assistant message, clear stream
7. Messages persisted to backend via HttpMessageAdapter
```

## Two Command Systems

### 1. CLI Tasks (`src/tasks/`) — Terminal Commands

Invoked from the terminal: `tsa login`, `tsa chat`, `tsa agents`, etc. Use `@keg-hub/args-parse` for argument parsing.

```typescript
type TTask = {
  name: string
  alias?: string[]
  description: string
  example?: string
  options?: Record<string, TTaskOption>
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
| `run` | `r` | **Hero command** — Launch AI tool runtime in sandbox (first in help output) |
| `chat` | `ch` | Start interactive chat (default, renders Ink App) |
| `login` | `li` | Authenticate with API key |
| `logout` | `lo` | Remove stored credentials |
| `status` | `st` | Show authentication status |
| `agents` | `ag` | List agents (auth required) |
| `threads` | `th` | List threads for agent (auth required) |
| `sandboxes` | `sb` | List sandbox configs for org (auth required) |
| `ssh` | — | Interactive SSH connection to sandbox pod (auth required) |
| `proxy` | — | Internal SSH ProxyCommand transport via WebSocket tunnel |
| `help` | `--help`, `-h` | Show available commands |

### 2. Slash Commands (`src/commands/`) — In-TSA Commands

Invoked within the Ink chat session: `/help`, `/login <key>`, `/agent <id>`, etc.

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
  threadId: string | null
  exit: () => void
  output: (text: string) => void
  setAgentId: (id: string) => void
  setVerbose: (v: boolean) => void
  setProviderId: (id: string) => void
  setThreadId: (id: string | null) => void
  addContextFile: (path: string) => void
  removeContextFile: (index: number) => void
  auth: { isLoggedIn: boolean, logout: () => void, login: (...) => Promise<void> }
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
| `/info` | `/i` | Show session info | Stub |
| `/context` | `/ctx` | List context files | Stub |
| `/history` | `/hist` | Show thread history | Stub |
| `/threads` | `/t` | List threads | Stub |

**Pre-Auth Commands**: `login`, `help`, `exit`, `quit`, `q`, `h`, `li` — allowed before authentication.

## Key Components

### AuthManager (`src/auth/auth.ts`)

```typescript
class AuthManager {
  getCredentials(): TAuthCredentials | null   // Read from ConfigService.loadGlobal().auth
  isLoggedIn(): boolean
  async login(apiKey, proxyUrl?, insecure?)   // Validate against /_/orgs + store via ConfigService.saveGlobal()
  logout(): void                               // Remove auth from config
}
```

- **Config Path**: `~/.config/tdsk/tsa/config.yaml` (auth section)
- **Default Proxy**: `https://px.local.threadedstack.app`
- **Validation**: Fetches `/_/orgs` endpoint to verify API key works
- **API Key Prefix**: `tdsk_` (validated on login)

### ApiClient (`src/api/client.ts`)

HTTP wrapper for all backend API interactions with automatic retry.

```typescript
class ApiClient {
  get proxyUrl(): string

  // Organizations
  listOrgs(): Promise<Organization[]>
  getOrg(orgId): Promise<Organization>

  // Agents
  listAgents(orgId): Promise<Agent[]>
  getAgent(orgId, agentId): Promise<Agent>

  // Sessions
  createSession(agentId, providerId?): Promise<TSessionInfo>

  // Providers
  listProviders(orgId, agentId): Promise<TProviderInfo[]>

  // Threads
  listThreads(orgId, agentId): Promise<Thread[]>
  getThread(orgId, agentId, threadId): Promise<Thread>
  createThread(orgId, agentId, name?): Promise<Thread>

  // Messages
  listMessages(orgId, agentId, threadId): Promise<Message[]>
  createMessage(orgId, agentId, threadId, data): Promise<Message>

  // Sandboxes
  listSandboxes(orgId): Promise<Sandbox[]>
  connectSandbox(orgId, sandboxId): Promise<TSandboxConnectResponse>
}
```

- **Auth**: `Authorization: Bearer <apiKey>` on all `/_/*` requests
- **Session Creation**: `POST /_/ai/sessions` with `{ agentId, providerId? }` → `TSessionInfo`
- **Retry**: Up to 3 retries with delays `[1000, 3000, 9000]ms` on ECONNREFUSED, ETIMEDOUT, ENOTFOUND, 429, 5xx
- **Response Format**: Unwraps `{ data: T }` envelope

### LocalAgentExecutor (`src/executor/executor.ts`)

Orchestrates local agent execution with session-based LLM proxying.

```typescript
class LocalAgentExecutor {
  get client(): ApiClient
  createSession(agentId, providerId?): Promise<TSessionInfo>
  run(opts: {
    orgId: string
    agentId: string
    prompt: string
    userId: string
    threadId?: string
    providerId?: string
    maxSteps?: number
    contextFiles?: TContextFile[]
    onEvent: (event: TStreamEvent) => void
  }): Promise<TRunResult>
}
```

**Run flow**:
1. Creates session → backend resolves API key, returns session token
2. Creates thread if none provided
3. Prepends context files as `<context>--- name ---\ncontent\n</context>` blocks
4. Creates `HttpMessageAdapter` for message persistence
5. Calls `AgentRunner.run()` with `proxyConfig` (LLM calls through backend SSE) and `llmConfig`

### ConfigService (`src/services/config.ts`)

YAML-based configuration management with two layers.

```typescript
class ConfigService {
  static loadGlobal(): TTsaConfig           // ~/.config/tdsk/tsa/config.yaml
  static saveGlobal(config: TTsaConfig)     // YAML dump, chmod 0600, mkdir 0700
  static loadProject(cwd?): TProjectConfig   // .tdsk/config.yaml
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
  provider: "local"     # local | e2b
  timeout: 300000
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
  static autoDetect(cwd): TContextFile[]   // Scans AGENTS.md + .tdsk/context/
  static loadFile(path): TContextFile | null  // Manual file loading
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

### Ink Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `App` | `auth, initialOrgId?, initialAgentId?, initialThreadId?` | Root — phase-based lifecycle |
| `ChatSession` | `agentName, verbose?, modelName?, streamText, threadName?, isStreaming, providerName?, toolCalls, connection, onSubmit, messages` | Main chat UI |
| `Prompt` | `onSubmit, disabled` | TextInput with cyan `>` prefix |
| `AgentPicker` | `agents, onSelect` | Auto-selects single agent, otherwise shows list |
| `SelectPrompt` | `items, prompt, onSelect` | Keyboard-navigable (up/down Enter, number keys) |
| `StatusBar` | `agentName, providerName?, modelName?, threadName?, connection` | Status line with connection indicator |
| `MessageList` | `messages, markdown?` | Renders UserMessage/AssistantMessage/system |
| `AssistantMessage` | `text, markdown?` | Markdown-rendered text |
| `UserMessage` | `text` | Dimmed `> text` |
| `StreamingResponse` | `text, toolCalls, isStreaming, verbose?` | Live response with tool activity |
| `ToolActivity` | `tools, verbose?` | Per-tool status: success/error/spinning with optional result |
| `Spinner` | `message?` | Braille animation (80ms) |
| `WelcomeBox` | `agentName, agentDescription?, providerName?, modelName?, threadName?, contextFileCount?, tools?` | Bordered info box |
| `ErrorMessage` | `message?, suggestion?, error?` | Friendly error with `toFriendlyError()` |

### React Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `useSession()` | `{ orgId, setOrgId, agentId, setAgentId, threadId, setThreadId, provider, setProvider, connection, setConnection }` | Session state |
| `useMessages()` | `{ messages, addMessage, setMessages, isStreaming, setIsStreaming, streamText, setStreamText, toolCalls, setToolCalls, clearStream }` | Message + streaming state |
| `useAgent(client)` | `{ agents, currentAgent, loading, loadAgents(orgId), selectAgent(agent) }` | Agent discovery |
| `useAuth()` | `{ auth, isLoggedIn, login, logout }` | AuthManager wrapper |
| `useConfig()` | `{ config, global, project }` | Merged config |
| `useConnection()` | `{ status, connect, disconnect, reconnect }` | Connection with 3s reconnect delay |
| `useContextFiles()` | `{ contextFiles, autoDetect(cwd), addFile(path), removeFile(index) }` | Context management |
| `useInputHistory(maxSize?)` | `{ add, up, down, reset, history }` | Input history (default 100) |
| `useLifecycleHooks(config?)` | `{ run(name, env?) }` | HooksService wrapper |

## CLI Commands

```bash
# Sandbox Runtime (hero command — first in help output)
tsa run <sandbox-id> [--org <id>] [--no-sync] [--list]
tsa run --list                     # List available sandboxes

# Authentication
tsa login <api-key> [--url <proxy-url>] [--insecure]
tsa logout
tsa status

# Discovery
tsa agents [--org <id>]
tsa threads <agent-id> [--org <id>]
tsa sandboxes [--org <id>]

# Interactive Chat (Ink TUI)
tsa chat [--org <id>] [--agent <id>] [--thread <id>]
tsa                    # Default: launches chat

# Sandbox SSH
tsa ssh <sandbox-id> [--org <id>]    # Interactive SSH to sandbox pod
tsa proxy <sandbox-id>                # ProxyCommand transport (used by SSH config)

# Help
tsa help / --help / -h
tsa --version / -v
```

## Configuration

### Config Paths

| Path | Format | Purpose |
|------|--------|---------|
| `~/.config/tdsk/tsa/config.yaml` | YAML | Global config (auth, display, behavior, hooks, tools) |
| `.tdsk/config.yaml` | YAML | Project config (org, agent, context, hooks, tools) |
| `AGENTS.md` | Markdown | Auto-detected agent context file |
| `.tdsk/context/` | Directory | Auto-detected context files |

## Constants (`src/constants/values.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `Version` | from package.json | App version |
| `ConfigDir` | `~/.config/tdsk/tsa` | Global config directory |
| `ConfigPath` | `~/.config/tdsk/tsa/config.yaml` | Global config file |
| `ProjectDir` | `.tdsk` | Project directory |
| `AgentsFile` | `AGENTS.md` | Agent context file |
| `ContextDir` | `.tdsk/context` | Context files directory |
| `ProjectConfig` | `.tdsk/config.yaml` | Project config file |
| `DefaultMaxSteps` | `10` | Agent runner max steps |
| `DefaultMaxHistory` | `50` | Max input history entries |
| `DefaultTheme` | `"dark"` | Default color theme |
| `DefaultSandboxTimeout` | `300000` | 5 minutes |
| `DefaultProxyUrl` | `https://px.local.threadedstack.app` | Default proxy URL |
| `MaxRetries` | `3` | HTTP retry attempts |
| `RetryDelays` | `[1000, 3000, 9000]` | Retry delay progression (ms) |

## Shared Task Utilities (`src/utils/tasks/`)

Extracted from `ssh.ts` to enable reuse by `run.ts`:

| File | Purpose |
|------|---------|
| `resolveOrgId.ts` | Org resolution from params/config/single-org. Throws on failure (no `process.exit`) |
| `sandboxConnect.ts` | Connect to sandbox pod + inject SSH keys. Throws on failure, returns `TSandboxConnectResponse` |
| `sandboxSync.ts` | Auto-start/stop Mutagen file sync lifecycle. Auth errors re-throw (non-swallowed) |
| `spawnSsh.ts` | SSH process spawning with optional remote command + PTY support |

**`tsa run` Flow** (`src/tasks/run.ts`):
1. Resolve org ID via `resolveOrgId()`
2. Fetch sandbox config via `GET /_/orgs/:orgId/sandboxes/:id` (hard error if fails, unlike `tsa ssh`)
3. Connect to sandbox via `sandboxConnect()` (auto-starts pod if needed)
4. Start file sync via `sandboxSync()` (unless `--no-sync`)
5. SSH with runtime command via `spawnSsh()` with `config.runtimeCommand` as remote command
6. Exit non-zero on SSH failure

`ssh.ts` refactored to compose from the same utilities. Same behavior, cleaner structure.

## Key Patterns

### Phase-Based App Lifecycle

```
Not logged in → 'login' → /login → 'loading' → 'pickAgent' → 'chat'
Already logged in → 'loading' → 'pickAgent' or 'chat'
Error at any point → 'error'
```

### Private Fields (#)

Uses JavaScript private fields for encapsulation throughout all classes.

### Event-Driven Streaming

Agent execution streams events to React state in real-time via `onEvent` callback, which updates `streamText`, `toolCalls`, and `messages` state.

### Build-Time Version Injection

```typescript
// scripts/build.ts
define: { __TDSK_TSA_VERSION__: JSON.stringify(pkg.version) }
// src/constants/values.ts — falls back to package.json when running from source
```

### Devtools Stub Plugin

The build script stubs `react-devtools-core` and `ws` which Ink statically imports but never executes in production. Without this, the binary fails at runtime.

## Building

```bash
pnpm build           # Bundle via bun (bun build → dist/index.js)
pnpm compile         # Native binary (bun build --compile → dist/tsa)
```

The `start` command requires `bun` (not Node.js). The `compile` command produces a standalone native binary that doesn't require bun at runtime.

## Testing Patterns

- Mocks `fetch` globally via `vi.stubGlobal()` for API tests
- Co-located test files (`.test.ts`/`.test.tsx` adjacent to source)
- Component tests use `ink-testing-library` with custom mocks in `configs/setupInkMocks.tsx`
- `setupInkMocks.tsx` provides a minimal React hooks dispatcher for synchronous component testing
- **Note**: `setupInkMocks.tsx` is NOT wired via `setupFiles` in vitest config. Component tests rely on module-level `vi.mock()` calls within the setup file being loaded through imports.

## Integration Points

### With Agent (`@tdsk/agent`)

- `AgentRunner` — local ReAct loop execution
- `Executor` — LLM calls proxied through backend WebSocket (`/ai/ws`)
- `IAgentRunnerDB` — implemented by `HttpMessageAdapter`
- `TStreamEvent` — real-time event streaming

### With Domain (`@tdsk/domain`)

- `TStreamEvent`, `TLLMProviderBrand`, `TMessageContent` — shared types
- `Organization`, `Agent`, `Thread`, `Message` — API response types

### With Backend API

- **Auth**: API key validated against `/_/orgs`
- **Sessions**: `POST /_/ai/sessions` — session token + LLM config
- **LLM Proxy**: `WS /ai/ws` — WebSocket streaming (session token auth)
- **Providers**: `GET /_/orgs/:orgId/agents/:agentId/providers`
- **Agents**: `/_/orgs/:orgId/agents` for listing
- **Threads**: `/_/orgs/:orgId/agents/:agentId/threads` for CRUD
- **Messages**: `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages`
- **Sandboxes**: `GET /_/orgs/:orgId/sandboxes` for listing
- **Sandbox Connect**: `POST /_/sandboxes/:sandboxId/connect` for SSH credentials
- **Sandbox Tunnel**: `WS /_/sandboxes/:sandboxId/tunnel` for SSH proxy transport

### With Proxy

- All API requests route through proxy at configured URL
- Default: `https://px.local.threadedstack.app`
- Auth: `Authorization: Bearer <apiKey>` header

### Adding New Tasks/Commands

Follow the pattern in existing files:
- **New CLI task**: Create `src/tasks/<command>.ts`, add to `src/tasks/index.ts`. Use `requireAuth()` wrapper if auth needed.
- **New slash command**: Create `src/commands/<name>.ts`, add to `registeredCommands[]` in `src/commands/registry.ts`. Add to `PRE_AUTH_COMMANDS` in `src/commands/index.ts` if needed before auth.
- **New Ink component**: Create `src/components/<Name>.tsx` with co-located `.test.tsx`. Use `themed()` for colors.
- **New React hook**: Create `src/hooks/use<Name>.ts`, export from `src/hooks/index.ts`.

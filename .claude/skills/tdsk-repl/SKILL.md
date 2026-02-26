---
name: "tdsk-repl"
description: "Knowledge base for the terminal REPL CLI for AI agent interaction"
version: "1.0.0"
tags: ["cli", "repl", "bun", "agent", "terminal", "interactive", "session", "proxy-adapter", "args-parse", "tasks", "ink", "react", "tui"]
---
# REPL Repo Skill

## Overview

The **REPL** repo (`repos/repl`, `@tdsk/repl`) is a terminal-based interactive CLI for communicating with ThreadedStack AI agents. It provides:

- **Ink React TUI** — Full terminal UI built with Ink (React for CLIs), replacing the old readline-based REPL
- **Local Agent Execution** — Runs agent ReAct loops locally via session-based LLM proxy (API keys never leave the backend)
- **Persistent Authentication** — API key-based login stored in YAML config (`~/.config/tdsk/repl/config.yaml`)
- **Two-Layer Configuration** — Global config (`~/.config/tdsk/repl/config.yaml`) merged with project config (`.tdsk/config.yaml`)
- **Context Injection** — Auto-detects `AGENTS.md` and `.tdsk/context/` files, prepends to prompts as XML blocks
- **Slash Command System** — 16 slash commands in a registry with pre-auth filtering
- **Lifecycle Hooks** — Shell commands triggered on session/tool/error events via config
- **Rich Terminal Output** — Themed colors (dark/light), markdown rendering, streaming responses, tool call visualization
- **Task-Based Architecture** — CLI commands implemented as `@keg-hub/args-parse` tasks with auto-generated help
- **Compilable Binary** — Produces a standalone `tsa` binary via `bun build --compile`

**Runtime**: Bun (not Node.js) — the entry point uses `#!/usr/bin/env bun`

**Binary Name**: `tsa` (was `tdsk-agent` in v2.x)

**Key Problem Solved**: Bridges server-hosted agent management with local execution, giving developers an interactive chat interface for testing and using agents without a browser UI. LLM API keys never leave the server — the REPL uses session tokens to proxy LLM calls through the backend.

## Directory Structure

```
repos/repl/
├── configs/
│   ├── biome.json              # Biome linter/formatter config
│   ├── setupInkMocks.tsx       # Vitest setup: mocks ink + ink-testing-library for component tests
│   └── vitest.config.ts        # Vitest config (node env, .test.ts + .test.tsx)
├── scripts/
│   └── build.ts                # Bun build script: bundle + optional compile to native binary
├── src/
│   ├── index.ts                # CLI entry point (#!/usr/bin/env bun)
│   ├── cli.ts                  # main() entry — argsParse + task dispatch
│   ├── cli.test.ts             # 38 integration tests
│   ├── constants/
│   │   ├── index.ts            # Barrel exports
│   │   ├── values.ts           # Version, paths, defaults, retry config
│   │   ├── errors.ts           # FRIENDLY_ERRORS patterns, toFriendlyError()
│   │   └── tools.ts            # TOOL_DISPLAY_NAMES, getToolDisplayName()
│   ├── types/
│   │   ├── index.ts            # Barrel type exports
│   │   ├── client.types.ts     # TSessionInfo, TProviderInfo, TConnectionStatus
│   │   ├── commands.types.ts   # TSlashCommand, TSlashCommandContext
│   │   ├── config.types.ts     # TReplConfig, TProjectConfig, THooksConfig, etc.
│   │   ├── config.types.test.ts # 3 tests
│   │   ├── context.types.ts    # TContextFile, TContextSource
│   │   ├── repl.types.ts       # TAuthCredentials, TCliArgs, TToolCallAccumulator
│   │   ├── session.types.ts    # TProviderInfo, TConnectionStatus
│   │   └── tasks.types.ts      # TTask, TTasks, TTaskAction, TTaskOption
│   ├── tasks/                  # CLI task definitions (tsa <command>)
│   │   ├── index.ts            # tasks registry export
│   │   ├── agents.ts           # 'agents' command
│   │   ├── chat.ts             # 'chat' command (default) — renders Ink App
│   │   ├── help.ts             # 'help' command
│   │   ├── login.ts            # 'login' command
│   │   ├── logout.ts           # 'logout' command
│   │   ├── status.ts           # 'status' command
│   │   └── threads.ts          # 'threads' command
│   ├── commands/               # Slash commands for in-REPL use (/help, /login, etc.)
│   │   ├── index.ts            # findCommand, parseCommand, isPreAuthCommand, commands[]
│   │   ├── index.test.ts       # 6 tests
│   │   ├── registry.ts         # registeredCommands[] (all except help)
│   │   ├── help.ts             # /help, /h
│   │   ├── exit.ts             # /exit, /quit, /q
│   │   ├── login.ts            # /login, /li
│   │   ├── logout.ts           # /logout, /lo
│   │   ├── clear.ts            # /clear, /cl
│   │   ├── info.ts             # /info, /i (stub)
│   │   ├── verbose.ts          # /verbose, /v
│   │   ├── context.ts          # /context, /ctx (stub)
│   │   ├── history.ts          # /history, /hist (stub)
│   │   ├── newThread.ts        # /new, /n
│   │   ├── addContext.ts       # /add
│   │   ├── removeContext.ts    # /remove, /rm
│   │   ├── listThreads.ts     # /threads, /t (stub)
│   │   ├── switchAgent.ts      # /agent, /a
│   │   ├── switchThread.ts     # /switch, /sw
│   │   └── switchProvider.ts   # /provider, /p
│   ├── components/             # Ink React components
│   │   ├── App.tsx             # Root app — phases: login → loading → pickAgent → chat → error
│   │   ├── App.test.tsx        # 1 test
│   │   ├── ChatSession.tsx     # StatusBar + MessageList + StreamingResponse + Prompt
│   │   ├── ChatSession.test.tsx # 4 tests
│   │   ├── Prompt.tsx          # TextInput with cyan '>' prompt
│   │   ├── Prompt.test.tsx     # 2 tests
│   │   ├── AgentPicker.tsx     # Agent selection (auto-selects if single)
│   │   ├── AgentPicker.test.tsx # 2 tests
│   │   ├── SelectPrompt.tsx    # Keyboard-navigable selection list
│   │   ├── SelectPrompt.test.tsx # 2 tests
│   │   ├── StatusBar.tsx       # Agent name, provider, model, thread, connection indicator
│   │   ├── StatusBar.test.tsx  # 4 tests
│   │   ├── MessageList.tsx     # Renders user/assistant/system messages
│   │   ├── MessageList.test.tsx # 2 tests
│   │   ├── AssistantMessage.tsx # Markdown-rendered assistant text
│   │   ├── AssistantMessage.test.tsx # 2 tests
│   │   ├── UserMessage.tsx     # Dimmed "> text" display
│   │   ├── UserMessage.test.tsx # 1 test
│   │   ├── StreamingResponse.tsx # Spinner + ToolActivity + streaming markdown
│   │   ├── StreamingResponse.test.tsx # 3 tests
│   │   ├── ToolActivity.tsx    # Tool call status (✓/✗/⠙) with optional verbose output
│   │   ├── ToolActivity.test.tsx # 4 tests
│   │   ├── Spinner.tsx         # Braille animation spinner
│   │   ├── Spinner.test.tsx    # 2 tests
│   │   ├── WelcomeBox.tsx      # Bordered agent info box on session start
│   │   ├── WelcomeBox.test.tsx # 5 tests
│   │   ├── ErrorMessage.tsx    # Friendly error display with suggestions
│   │   └── ErrorMessage.test.tsx # 3 tests
│   ├── hooks/                  # React hooks for state management
│   │   ├── index.ts            # Barrel exports
│   │   ├── useSession.ts       # orgId, agentId, threadId, provider, connection state
│   │   ├── useMessages.ts      # messages[], streaming state, tool calls
│   │   ├── useAgent.ts         # agents list, selection, loading
│   │   ├── useAuth.ts          # AuthManager wrapper
│   │   ├── useConfig.ts        # Global + project config loading/merging
│   │   ├── useConfig.test.ts   # 1 test
│   │   ├── useConnection.ts    # Connection status with reconnect logic
│   │   ├── useContext.ts       # Context file management (auto-detect, add, remove)
│   │   ├── useInputHistory.ts  # Input history with up/down navigation
│   │   ├── useInputHistory.test.ts # 2 tests
│   │   └── useLifecycleHooks.ts # HooksService wrapper for lifecycle events
│   ├── services/               # Non-React service classes
│   │   ├── index.ts            # Barrel exports
│   │   ├── config.ts           # ConfigService — YAML config load/save/merge
│   │   ├── config.test.ts      # Tests
│   │   ├── context.ts          # ContextLoader — auto-detect AGENTS.md + .tdsk/context/
│   │   ├── context.test.ts     # Tests
│   │   ├── hooks.ts            # HooksService — shell command lifecycle hooks
│   │   └── hooks.test.ts       # Tests
│   ├── theme/                  # Theming system (replaces old display/colors.ts)
│   │   ├── index.ts            # Barrel exports
│   │   ├── colors.ts           # getTheme(), setTheme(), themed() — picocolors-based
│   │   ├── colors.test.ts      # 4 tests
│   │   └── themes.ts           # darkTheme, lightTheme (TThemeColors)
│   ├── auth/
│   │   ├── index.ts            # AuthManager export
│   │   ├── auth.ts             # AuthManager class (login/logout/credentials via ConfigService)
│   │   └── auth.test.ts        # Tests
│   ├── api/
│   │   ├── index.ts            # ApiClient + type exports
│   │   ├── client.ts           # ApiClient class — HTTP wrapper with retry logic
│   │   └── client.test.ts      # 26 tests
│   ├── executor/
│   │   ├── index.ts            # Executor exports
│   │   ├── executor.ts         # LocalAgentExecutor class (session-based flow)
│   │   ├── executor.test.ts    # Tests
│   │   ├── httpAdapter.ts      # HttpMessageAdapter (IAgentRunnerDB impl)
│   │   └── httpAdapter.test.ts # Tests
│   └── utils/
│       ├── friendly-errors.ts  # Re-exports toFriendlyError from constants
│       ├── friendly-errors.test.ts # 4 tests
│       ├── markdown.ts         # renderMarkdown(), StreamingMarkdownBuffer
│       ├── markdown.test.ts    # 5 tests
│       └── tasks/
│           ├── index.ts        # Barrel exports
│           ├── addDefaults.ts  # Merges config defaults into task options
│           ├── config.ts       # loadConfig/saveConfig (delegates to ConfigService)
│           ├── config.test.ts  # Tests
│           ├── error.ts        # taskError (prints + exits)
│           ├── find.ts         # Task resolver with alias + subtask support
│           ├── find.test.ts    # 8 tests
│           ├── hasArg.ts       # CLI arg presence checker
│           └── requireAuth.ts  # Auth-required task wrapper
├── dist/
│   ├── index.js                # Bundled JS (bun build)
│   └── tsa                     # Native binary (bun build --compile)
├── package.json
└── tsconfig.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point — shebang (`#!/usr/bin/env bun`) + calls `main()` |
| `src/cli.ts` | Main CLI logic — argsParse integration, task dispatch, auth/config loading |
| `src/tasks/*.ts` | 7 CLI task definitions (login, logout, status, agents, threads, chat, help) |
| `src/commands/*.ts` | 16 slash commands for in-REPL use (/help, /login, /agent, etc.) |
| `src/components/App.tsx` | Root Ink component — phase-based UI (login → loading → pickAgent → chat) |
| `src/components/ChatSession.tsx` | Chat UI: StatusBar + MessageList + StreamingResponse + Prompt |
| `src/hooks/*.ts` | 10 React hooks for session, messages, config, context, auth state |
| `src/services/*.ts` | ConfigService (YAML), ContextLoader (auto-detect), HooksService (lifecycle) |
| `src/theme/*.ts` | Dark/light theming via picocolors |
| `src/auth/auth.ts` | AuthManager — persistent API key storage via ConfigService |
| `src/api/client.ts` | ApiClient — HTTP wrapper with retry logic for backend API |
| `src/executor/executor.ts` | LocalAgentExecutor — sessions, ProxyAdapter, threads, AgentRunner |
| `src/executor/httpAdapter.ts` | HttpMessageAdapter — IAgentRunnerDB over HTTP |
| `src/utils/markdown.ts` | renderMarkdown() + StreamingMarkdownBuffer for incremental rendering |
| `scripts/build.ts` | Bun build script with devtools stub plugin for Ink compatibility |

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
            ├── render(<App />) → Ink application lifecycle
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
            │   ├── ProxyAdapter — LLM calls proxied through backend SSE (/ai/chat)
            │   ├── createThread() → thread ID
            │   ├── Context injection (XML <context> blocks)
            │   └── AgentRunner.run() — Local ReAct loop with ProxyAdapter
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
4. ProxyAdapter → POST /ai/chat with Authorization: Session <token>
   - Backend injects API key server-side, streams SSE response
5. Event handling in App.tsx:
   - 'text' → append to streamText (rendered as markdown)
   - 'tool_call_start' → add tool to toolCalls[] (shows ⠙ spinner)
   - 'tool_result' → update tool status (✓ success / ✗ error)
   - 'error' → add system message
6. On completion: save threadId, add assistant message, clear stream
7. Messages persisted to backend via HttpMessageAdapter
```

## Two Command Systems

The REPL has **two separate command systems**:

### 1. CLI Tasks (`src/tasks/`) — Terminal Commands

Invoked from the terminal: `tsa login`, `tsa chat`, `tsa agents`, etc. Use `@keg-hub/args-parse` for argument parsing.

```typescript
type TTask = {
  name: string                    // Command name (e.g., 'login', 'chat')
  alias?: string[]                // Short aliases (e.g., ['li'], ['ch'])
  description: string             // Help text
  example?: string                // Usage example
  options?: Record<string, TTaskOption>  // CLI flags
  action?: TTaskAction            // Handler function
}

type TTaskAction = (context: {
  params: Record<string, any>     // Parsed CLI args
  task: TTask                     // Current task
  tasks: TTasks                   // All tasks
  auth: AuthManager               // Auth manager instance
  config?: TReplConfig            // Merged user config
  options?: string[]              // Remaining unparsed args
}) => Promise<void>
```

**Task Registry** (`src/tasks/index.ts`):

| Task | Alias | Description |
|------|-------|-------------|
| `chat` | `ch` | Start interactive chat (default, renders Ink App) |
| `login` | `li` | Authenticate with API key |
| `logout` | `lo` | Remove stored credentials |
| `status` | `st` | Show authentication status |
| `agents` | `ag` | List agents (auth required) |
| `threads` | `th` | List threads for agent (auth required) |
| `help` | `--help`, `-h` | Show available commands |

### 2. Slash Commands (`src/commands/`) — In-REPL Commands

Invoked within the Ink chat session: `/help`, `/login <key>`, `/agent <id>`, etc. Use `TSlashCommandContext` for state manipulation.

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
| `/exit` | `/quit`, `/q` | Exit the REPL | Working |
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

### 1. CLI Entry (`src/cli.ts`)

```typescript
export const main = async (): Promise<any> => {
  const argv = process.argv.slice(2)

  if (hasArg(argv, 'version', ['v'])) return process.stdout.write(`tsa v${Version}\n`)

  // Default to 'chat' when no args or first arg is a value flag (not --help)
  const args = !argv.length || (argv[0].startsWith('--') && argv[0] !== '--help')
    ? ['chat', ...argv]
    : argv

  const { task, options } = find(tasks, args)
  const config = loadConfig()
  const params = await argsParse({ args: options, task: { options: addDefaults(task, config) } })
  const auth = new AuthManager()

  if (storedCreds?.insecure || hasArg(argv, 'insecure', ['ins'])) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  await task.action?.({ task, auth, tasks, config, params, options })
}
```

### 2. App Component (`src/components/App.tsx`)

Root Ink component managing the full application lifecycle through phases:

```typescript
type TAppPhase = 'login' | 'loading' | 'pickAgent' | 'chat' | 'error'

const App = ({ auth, initialOrgId?, initialAgentId?, initialThreadId? }) => {
  // Phase transitions:
  // 1. 'login' — if not authenticated, shows login prompt with pre-auth slash commands
  // 2. 'loading' — spinner while connecting + resolving org
  // 3. 'pickAgent' — AgentPicker if no initialAgentId
  // 4. 'chat' — WelcomeBox + ChatSession with full slash command support
  // 5. 'error' — ErrorMessage display
}
```

**Event Handling** in chat phase:
- `text` → `setStreamText(prev => prev + event.text)` (live markdown rendering)
- `tool_call_start` → adds tool to `toolCalls[]` with `status: 'running'`
- `tool_result` → updates last tool's status to `'success'` or `'error'`
- `error` → adds system message

### 3. AuthManager (`src/auth/auth.ts`)

Handles persistent authentication via `ConfigService`.

```typescript
class AuthManager {
  getCredentials(): TAuthCredentials | null   // Read from ConfigService.loadGlobal().auth
  isLoggedIn(): boolean
  async login(apiKey, proxyUrl?, insecure?)   // Validate against /_/orgs + store via ConfigService.saveGlobal()
  logout(): void                               // Remove auth from config
}
```

- **Config Path**: `~/.config/tdsk/repl/config.yaml` (auth section)
- **Default Proxy**: `https://px.local.threadedstack.app`
- **Validation**: Fetches `/_/orgs` endpoint to verify API key works
- **API Key Prefix**: `tdsk_` (validated on login)

### 4. ApiClient (`src/api/client.ts`)

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
}
```

- **Auth**: `Authorization: Bearer <apiKey>` on all `/_/*` requests
- **Session Creation**: `POST /_/ai/sessions` with `{ agentId, providerId? }` → `TSessionInfo`
- **Retry**: Up to `MaxRetries` (3) with delays `[1000, 3000, 9000]ms` on ECONNREFUSED, ETIMEDOUT, ENOTFOUND, 429, 5xx
- **Response Format**: Unwraps `{ data: T }` envelope

### 5. LocalAgentExecutor (`src/executor/executor.ts`)

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

### 6. ConfigService (`src/services/config.ts`)

YAML-based configuration management with two layers.

```typescript
class ConfigService {
  static loadGlobal(): TReplConfig           // ~/.config/tdsk/repl/config.yaml
  static saveGlobal(config: TReplConfig)     // YAML dump, chmod 0600, mkdir 0700
  static loadProject(cwd?): TProjectConfig   // .tdsk/config.yaml
  static merge(global, project): TReplConfig // Project org/agent override; hooks/tools merge
}
```

**Config Schema** (`TReplConfig`):
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

### 7. ContextLoader (`src/services/context.ts`)

Auto-detects context files for injection into agent prompts.

```typescript
class ContextLoader {
  static autoDetect(cwd): TContextFile[]   // Scans AGENTS.md + .tdsk/context/
  static loadFile(path): TContextFile | null  // Manual file loading
}
```

- **Auto-detected sources**: `AGENTS.md` at cwd root, all files in `.tdsk/context/`
- **TContextFile**: `{ path, name, source: 'auto'|'manual', content, sizeBytes }`
- **Injection**: Context files prepended to prompt as XML `<context>` blocks by executor

### 8. HooksService (`src/services/hooks.ts`)

Lifecycle hooks that execute shell commands on events.

```typescript
class HooksService {
  constructor(config: THooksConfig)
  run(name: keyof THooksConfig, env: Record<string, string>): Promise<void>
}
```

- Executes via `execFile('/bin/sh', ['-c', command], { env, timeout: 10000 })`
- Silently swallows errors (writes to stderr only)
- Available hooks: `onSessionStart`, `onSessionEnd`, `onToolCall`, `onToolResult`, `onError`, `onMessage`

### 9. Theme System (`src/theme/`)

Replaces the old `display/colors.ts` with a configurable theming system.

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

### 10. Ink Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `App` | `auth, initialOrgId?, initialAgentId?, initialThreadId?` | Root — phase-based lifecycle |
| `ChatSession` | `agentName, verbose?, modelName?, streamText, threadName?, isStreaming, providerName?, toolCalls, connection, onSubmit, messages` | Main chat UI |
| `Prompt` | `onSubmit, disabled` | TextInput with cyan `>` prefix |
| `AgentPicker` | `agents, onSelect` | Auto-selects single agent, otherwise shows list |
| `SelectPrompt` | `items, prompt, onSelect` | Keyboard-navigable (↑↓ Enter, number keys) |
| `StatusBar` | `agentName, providerName?, modelName?, threadName?, connection` | Status line with connection indicator |
| `MessageList` | `messages, markdown?` | Renders UserMessage/AssistantMessage/system |
| `AssistantMessage` | `text, markdown?` | Markdown-rendered text |
| `UserMessage` | `text` | Dimmed `> text` |
| `StreamingResponse` | `text, toolCalls, isStreaming, verbose?` | Live response with tool activity |
| `ToolActivity` | `tools, verbose?` | Per-tool status: ✓/✗/⠙ with optional result |
| `Spinner` | `message?` | Braille animation (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, 80ms) |
| `WelcomeBox` | `agentName, agentDescription?, providerName?, modelName?, threadName?, contextFileCount?, tools?` | Bordered info box |
| `ErrorMessage` | `message?, suggestion?, error?` | Friendly error with `toFriendlyError()` |

### 11. React Hooks

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
# Authentication
tsa login <api-key> [--url <proxy-url>] [--insecure]
tsa logout
tsa status

# Discovery
tsa agents [--org <id>]
tsa threads <agent-id> [--org <id>]

# Interactive Chat (Ink TUI)
tsa chat [--org <id>] [--agent <id>] [--thread <id>]
tsa                    # Default: launches chat

# Help
tsa help / --help / -h
tsa --version / -v
```

## Configuration

### Config Paths

| Path | Format | Purpose |
|------|--------|---------|
| `~/.config/tdsk/repl/config.yaml` | YAML | Global config (auth, display, behavior, hooks, tools) |
| `.tdsk/config.yaml` | YAML | Project config (org, agent, context, hooks, tools) |
| `~/.config/tdsk/repl/history` | — | Input history (future) |
| `AGENTS.md` | Markdown | Auto-detected agent context file |
| `.tdsk/context/` | Directory | Auto-detected context files |

### Config Merge Rules

- Project `org`/`agent` **override** global
- Project `hooks` **merge** with global (project wins per-key)
- Project `tools.confirm`/`tools.block` **concatenate** with global arrays

## Constants (`src/constants/values.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `Version` | from package.json | App version |
| `ConfigDir` | `~/.config/tdsk/repl` | Global config directory |
| `ConfigPath` | `~/.config/tdsk/repl/config.yaml` | Global config file |
| `HistoryPath` | `~/.config/tdsk/repl/history` | Input history file |
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

## Key Patterns

### 1. Ink React TUI

The chat task renders a full Ink application:

```typescript
// src/tasks/chat.ts
export const chat: TTask = {
  name: 'chat',
  action: async ({ params, auth }) => {
    const { waitUntilExit } = render(React.createElement(App, { auth, ... }))
    await waitUntilExit()
  }
}
```

### 2. Phase-Based App Lifecycle

The App component transitions through phases:
```
Not logged in → 'login' → /login → 'loading' → 'pickAgent' → 'chat'
Already logged in → 'loading' → 'pickAgent' or 'chat'
Error at any point → 'error'
```

### 3. Two Command Systems

- **CLI tasks** (`src/tasks/`): Terminal-level commands parsed by `@keg-hub/args-parse`
- **Slash commands** (`src/commands/`): In-REPL commands with registry + pre-auth filtering

### 4. Context Injection

Context files are auto-detected from `AGENTS.md` and `.tdsk/context/` and can be manually added/removed via slash commands. They're prepended to prompts as XML blocks.

### 5. YAML Configuration

Config uses `js-yaml` with two layers (global + project). Auth credentials are stored within the YAML config, not in a separate JSON file.

### 6. Private Fields (#)

Uses JavaScript private fields for encapsulation throughout all classes.

### 7. Event-Driven Streaming

Agent execution streams events to React state in real-time via `onEvent` callback, which updates `streamText`, `toolCalls`, and `messages` state.

### 8. Build-Time Version Injection

```typescript
// scripts/build.ts
define: { __TDSK_REPL_VERSION__: JSON.stringify(pkg.version) }

// src/constants/values.ts — falls back to package.json when running from source
```

### 9. Devtools Stub Plugin

The build script stubs `react-devtools-core` and `ws` which Ink statically imports but never executes in production. Without this, the binary fails at runtime.

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@keg-hub/args-parse` | 10.0.1 | CLI argument parser (task-based architecture) |
| `@keg-hub/jsutils` | 10.0.0 | JavaScript utility functions |
| `@tdsk/agent` | workspace:* | AgentRunner for local ReAct loop execution |
| `@tdsk/domain` | workspace:* | Shared types (TStreamEvent, TLLMProviderBrand, TMessageContent) |
| `@tdsk/sandbox` | workspace:* | Sandbox provider abstraction |
| `ink` | 6.7.0 | React-based terminal UI framework |
| `ink-text-input` | 6.0.0 | Text input component for Ink |
| `react` | ^19.0.0 | React runtime for Ink components |
| `picocolors` | 1.1.1 | Lightweight ANSI color library (theming) |
| `js-yaml` | 4.1.1 | YAML config parsing/serialization |
| `marked` | ^15.0.0 | Markdown parsing for agent responses |
| `marked-terminal` | ^7.0.0 | Terminal-friendly markdown rendering (ANSI) |
| `cli-highlight` | ^2.1.11 | Syntax highlighting for code blocks |
| `ora` | 9.3.0 | Terminal spinner |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@biomejs/biome` | 2.1.2 | Linting and formatting |
| `@types/bun` | 1.3.9 | Bun type definitions |
| `@types/js-yaml` | 4.0.9 | js-yaml type definitions |
| `@types/node` | 22.12.0 | Node.js type definitions |
| `@types/react` | ^19.0.0 | React type definitions |
| `ink-testing-library` | 4.0.0 | Ink component testing utilities |
| `typescript` | 5.7.3 | Type checking |
| `vite-tsconfig-paths` | 4.3.2 | Path alias resolution in tests |
| `vitest` | 1.6.1 | Test framework |

## Commands

### Development

```bash
pnpm start           # Run directly via bun (bun run src/index.ts)
```

### Building

```bash
pnpm build           # Bundle via bun (bun build → dist/index.js)
pnpm compile         # Native binary (bun build --compile → dist/tsa)
pnpm clean           # Remove dist/ and node_modules/
```

### Testing

```bash
pnpm test            # Run vitest (189 tests, 31 files)
```

### Commands Notes

* Linting and formatting run automatically via Biome — `pnpm lint` and `pnpm format` should be ignored.
* The `start` command requires `bun` to be installed (not Node.js).
* The `compile` command produces a standalone native binary that doesn't require bun at runtime.
* Binary name is `tsa` (not `tdsk-agent`).

## Testing

### Current Coverage (189 tests, 31 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/cli.test.ts` | 38 | CLI arg parsing, task dispatch, help/version, config defaults, insecure mode |
| `src/api/client.test.ts` | 26 | CRUD endpoints, session creation, retry logic, proxyUrl, auth headers |
| `src/commands/index.test.ts` | 6 | Command finding, parsing, pre-auth filtering |
| `src/utils/friendly-errors.test.ts` | 4 | Error pattern matching, friendly messages |
| `src/utils/markdown.test.ts` | 5 | Markdown rendering, streaming buffer |
| `src/utils/tasks/find.test.ts` | 8 | Task resolution by name/alias |
| `src/theme/colors.test.ts` | 4 | Theme get/set, themed() function, NO_COLOR |
| `src/types/config.types.test.ts` | 3 | Config type validation |
| `src/hooks/useInputHistory.test.ts` | 2 | History add/navigate |
| `src/hooks/useConfig.test.ts` | 1 | Config loading/merging |
| `src/services/config.test.ts` | — | ConfigService YAML load/save |
| `src/services/context.test.ts` | — | ContextLoader auto-detect |
| `src/services/hooks.test.ts` | — | HooksService execution |
| `src/auth/auth.test.ts` | — | Login flow, credential storage |
| `src/executor/executor.test.ts` | — | Session, thread, runner integration |
| `src/executor/httpAdapter.test.ts` | — | Message list/create |
| **Component tests (14 files):** | | |
| `App.test.tsx` | 1 | Root app rendering |
| `ChatSession.test.tsx` | 4 | Chat UI composition |
| `Prompt.test.tsx` | 2 | Input submission |
| `AgentPicker.test.tsx` | 2 | Agent selection |
| `SelectPrompt.test.tsx` | 2 | Keyboard navigation |
| `StatusBar.test.tsx` | 4 | Status display |
| `MessageList.test.tsx` | 2 | Message rendering |
| `AssistantMessage.test.tsx` | 2 | Markdown rendering |
| `UserMessage.test.tsx` | 1 | User message display |
| `StreamingResponse.test.tsx` | 3 | Streaming + tool activity |
| `ToolActivity.test.tsx` | 4 | Tool status display |
| `Spinner.test.tsx` | 2 | Spinner animation |
| `WelcomeBox.test.tsx` | 5 | Welcome box rendering |
| `ErrorMessage.test.tsx` | 3 | Error display |

**Testing Patterns**:
- Mocks `fetch` globally via `vi.stubGlobal()` for API tests
- Co-located test files (`.test.ts`/`.test.tsx` adjacent to source)
- Component tests use `ink-testing-library` with custom mocks in `configs/setupInkMocks.tsx`
- `setupInkMocks.tsx` provides a minimal React hooks dispatcher for synchronous component testing

**Note**: `setupInkMocks.tsx` is NOT wired into `vitest.config.ts` via `setupFiles`. Component tests rely on module-level `vi.mock()` calls within the setup file being loaded through imports.

## Integration Points

### With Agent (`@tdsk/agent`)

- `AgentRunner` — local ReAct loop execution
- `ProxyAdapter` — LLM calls proxied through backend SSE (`/ai/chat`)
- `IAgentRunnerDB` — implemented by `HttpMessageAdapter`
- `TStreamEvent` — real-time event streaming

### With Domain (`@tdsk/domain`)

- `TStreamEvent` — event types for agent streaming
- `TLLMProviderBrand` — provider type enum
- `TMessageContent` — message content structure
- `Organization`, `Agent`, `Thread`, `Message` — API response types

### With Backend API

- **Auth**: API key validated against `/_/orgs`
- **Sessions**: `POST /_/ai/sessions` — session token + LLM config
- **LLM Proxy**: `POST /ai/chat` — SSE streaming (session token auth)
- **Providers**: `GET /_/orgs/:orgId/agents/:agentId/providers`
- **Agents**: `/_/orgs/:orgId/agents` for listing
- **Threads**: `/_/orgs/:orgId/agents/:agentId/threads` for CRUD
- **Messages**: `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages`

### With Proxy

- All API requests route through proxy at configured URL
- Default: `https://px.local.threadedstack.app`
- Auth: `Authorization: Bearer <apiKey>` header

## Path Aliases

```json
{
  "@TRL": ["./src"],
  "@TRL/*": ["./src/*"],
  "@TRL/configs": ["./configs"],
  "@TRL/configs/*": ["./configs/*"],
  "@TDM/*": ["../domain/src/*"],
  "@TAG/*": ["../agent/src/*"],
  "@TSB/*": ["../sandbox/src/*"],
  "@tdsk/domain": ["../domain/src"],
  "@tdsk/agent": ["../agent/src"],
  "@tdsk/sandbox": ["../sandbox/src"],
  "@tdsk/logger": ["../logger/src"]
}
```

## Development Notes

### Adding a New CLI Command

1. Create task file in `src/tasks/<command>.ts`
2. Export task definition with name, alias, description, example, options, action
3. Add to `tasks` record in `src/tasks/index.ts`
4. If it needs auth, wrap action with `requireAuth()`

```typescript
// src/tasks/example.ts
import type { TTask } from '@TRL/types'
import { requireAuth } from '@TRL/utils/tasks'

export const example: TTask = {
  name: 'example',
  alias: ['ex'],
  description: 'Example command',
  example: 'tsa example [--flag]',
  options: {
    flag: { alias: ['f'], description: 'Example flag', type: 'bool' }
  },
  action: requireAuth(async ({ params, auth }) => {
    // Implementation
  })
}
```

### Adding a New Slash Command

1. Create command file in `src/commands/<name>.ts`
2. Export `TSlashCommand` with name, aliases, description, handler
3. Add to `registeredCommands[]` in `src/commands/registry.ts`
4. If pre-auth, add name/aliases to `PRE_AUTH_COMMANDS` set in `src/commands/index.ts`

```typescript
// src/commands/example.ts
import type { TSlashCommand } from '@TRL/types'

export const exampleCommand: TSlashCommand = {
  name: 'example',
  aliases: ['ex'],
  description: 'Example slash command',
  handler: async (args, ctx) => {
    ctx.output('Example output')
  }
}
```

### Adding a New Ink Component

1. Create component in `src/components/<Name>.tsx`
2. Create co-located test in `src/components/<Name>.test.tsx`
3. Use `themed()` for colors, `useInput` from ink for keyboard handling
4. Import from other components as needed

### Adding a New React Hook

1. Create hook in `src/hooks/use<Name>.ts`
2. Export from `src/hooks/index.ts`
3. Follow pattern: `export function use<Name>() { ... return { ... } }`

### Authentication Flow

```
1. User runs: tsa login <api-key> [--url <url>] [--insecure]
   OR in REPL: /login <api-key> [--insecure]
2. AuthManager.login() validates tdsk_ prefix, fetches /_/orgs
3. On success: stores { auth: { apiKey, proxyUrl, insecure } } in config.yaml
4. All subsequent operations read credentials via ConfigService
5. ApiClient uses stored apiKey as Bearer token
6. Insecure mode stored in config, applied at CLI startup
```

### Config Flow

```
1. User runs: tsa chat --org abc --agent xyz
2. loadConfig() → ConfigService.loadGlobal() + ConfigService.loadProject() → merge()
3. addDefaults() injects config values as task option defaults
4. argsParse() parses CLI args (--org abc overrides default)
5. Final params: { org: 'abc', agent: 'xyz' }
```


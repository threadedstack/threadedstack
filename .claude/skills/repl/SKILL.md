---
name: "Threaded Stack - REPL Repo"
description: "Knowledge base for the terminal REPL CLI for AI agent interaction"
version: "2.0.0"
tags: ["cli", "repl", "bun", "agent", "terminal", "interactive", "session", "proxy-adapter", "args-parse", "tasks"]
---
# REPL Repo Skill

## Overview

The **REPL** repo (`repos/repl`, `@tdsk/repl`) is a terminal-based interactive CLI for communicating with ThreadedStack AI agents. It provides:

- **Local Agent Execution** — Runs agent ReAct loops locally via session-based LLM proxy (API keys never leave the backend)
- **Persistent Authentication** — API key-based login stored in `~/.config/tdsk/repl-auth.json`
- **User Configuration** — Default org/agent/insecure preferences stored in `~/.config/tdsk/repl.json`
- **Conversation Management** — Thread creation, switching, history loading via backend API
- **Rich Terminal Output** — Markdown rendering, syntax highlighting, ANSI colors, tool call visualization
- **Task-Based Architecture** — Commands implemented as `@keg-hub/args-parse` tasks with auto-generated help
- **Compilable Binary** — Produces a standalone `tdsk-agent` binary (67MB) via `bun build --compile`

**Runtime**: Bun (not Node.js) — the entry point uses `#!/usr/bin/env bun`

**Key Problem Solved**: Bridges server-hosted agent management with local execution, giving developers an interactive chat interface for testing and using agents without a browser UI. LLM API keys never leave the server — the REPL uses session tokens to proxy LLM calls through the backend.

## Directory Structure

```
repos/repl/
├── configs/
│   ├── biome.json              # Biome linter/formatter config
│   └── vitest.config.ts        # Vitest test runner config
├── scripts/
│   └── compile.ts              # Bun compile script for native binary
├── src/
│   ├── index.ts                # CLI entry point (#!/usr/bin/env bun)
│   ├── cli.ts                  # main() entry — argsParse + task dispatch
│   ├── cli.test.ts             # 124 integration tests
│   ├── repl.ts                 # AgentRepl main interactive loop class
│   ├── repl.test.ts            # 52 unit tests
│   ├── constants/
│   │   ├── index.ts            # Exports
│   │   └── values.ts           # TDSK_REPL_VERSION constant
│   ├── types/
│   │   ├── index.ts            # Type exports
│   │   ├── client.types.ts     # TSessionInfo
│   │   ├── repl.types.ts       # TAuthCredentials, TToolCallAccumulator
│   │   └── tasks.types.ts      # TTask, TTasks, TTaskAction
│   ├── tasks/                  # Command task definitions
│   │   ├── index.ts            # TTasks export (task registry)
│   │   ├── agents.ts           # 'agents' command
│   │   ├── chat.ts             # 'chat' command (default)
│   │   ├── help.ts             # 'help' command
│   │   ├── login.ts            # 'login' command
│   │   ├── logout.ts           # 'logout' command
│   │   ├── status.ts           # 'status' command
│   │   └── threads.ts          # 'threads' command
│   ├── utils/tasks/            # Task utilities
│   │   ├── index.ts            # Exports
│   │   ├── addDefaults.ts      # Merges config defaults into task options
│   │   ├── config.ts           # loadConfig/saveConfig (~/.config/tdsk/repl.json)
│   │   ├── config.test.ts      # 8 unit tests
│   │   ├── error.ts            # taskError (unknown command handler)
│   │   ├── find.ts             # Task resolver with alias support
│   │   ├── find.test.ts        # 10 unit tests
│   │   └── requireAuth.ts      # Auth-required task wrapper
│   ├── auth/
│   │   ├── index.ts            # AuthManager export
│   │   ├── auth.ts             # AuthManager class (login/logout/credentials)
│   │   └── auth.test.ts        # 19 unit tests
│   ├── api/
│   │   ├── index.ts            # ApiClient export
│   │   ├── client.ts           # ApiClient class (HTTP API wrapper + session creation)
│   │   └── client.test.ts      # 60 unit tests
│   ├── executor/
│   │   ├── index.ts            # Executor exports
│   │   ├── executor.ts         # LocalAgentExecutor class (session-based flow)
│   │   ├── executor.test.ts    # 12 unit tests
│   │   ├── httpAdapter.ts      # HttpMessageAdapter (IAgentRunnerDB impl)
│   │   └── httpAdapter.test.ts # 3 unit tests
│   └── display/
│       ├── index.ts            # Renderer & colors exports
│       ├── renderer.ts         # Renderer class (output formatting)
│       ├── renderer.test.ts    # 35 unit tests
│       └── colors.ts           # ANSI color functions
├── dist/
│   ├── index.js                # 2.4MB bundled JS (bun build)
│   └── tdsk-agent              # 67MB native binary (bun build --compile)
├── package.json
└── tsconfig.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point — shebang (`#!/usr/bin/env bun`) + calls `main()` |
| `src/cli.ts` | Main CLI logic — argsParse integration, task dispatch, auth/config loading |
| `src/tasks/*.ts` | 7 task definitions (login, logout, status, agents, threads, chat, help) |
| `src/utils/tasks/*.ts` | Task utilities (find, config, error, addDefaults, requireAuth) |
| `src/repl.ts` | AgentRepl class — interactive readline loop with 10 slash commands |
| `src/auth/auth.ts` | AuthManager — persistent API key storage and validation |
| `src/api/client.ts` | ApiClient — HTTP wrapper for backend API (`/_/*` endpoints) |
| `src/executor/executor.ts` | LocalAgentExecutor — creates sessions, ProxyAdapter, threads, runs AgentRunner |
| `src/executor/httpAdapter.ts` | HttpMessageAdapter — implements IAgentRunnerDB for message persistence via HTTP |
| `src/display/renderer.ts` | Renderer — event-driven terminal output with markdown and tool call formatting |
| `src/display/colors.ts` | ANSI color utility functions (red, green, cyan, yellow, dim, bold, gray) |
| `scripts/compile.ts` | Bun compile wrapper for native binary output |

## Architecture

### Component Diagram

```
CLI Entry (index.ts) → main() (cli.ts)
    ├── argsParse() — Parse CLI arguments with task-specific options
    │
    ├── find() — Resolve task from registry by name/alias
    │
    ├── loadConfig() — Load user defaults from ~/.config/tdsk/repl.json
    │
    ├── addDefaults() — Merge config defaults into task option defaults
    │
    ├── AuthManager — Persistent login (API key + proxy URL → ~/.config/tdsk/repl-auth.json)
    │
    ├── Renderer — Terminal output formatting
    │
    └── task.action(context) — Dispatch to task handler:
        │
        ├── login → Validate API key, store credentials
        ├── logout → Remove credentials
        ├── status → Show login status
        ├── agents → List agents (auth required)
        ├── threads → List threads (auth required)
        ├── help → Show command list
        │
        └── chat (default) → Interactive REPL:
            ├── ApiClient — HTTP wrapper (Bearer token auth to proxy /_/* endpoints)
            │   └── createSession(agentId) → TSessionInfo (sessionToken, provider, model)
            │
            ├── LocalAgentExecutor — Orchestrator:
            │   ├── createSession(agentId) → TSessionInfo (backend resolves API key server-side)
            │   ├── ProxyAdapter — LLM calls proxied through backend SSE (/ai/chat)
            │   ├── createThread() → thread ID
            │   └── AgentRunner.run() — Local ReAct loop with ProxyAdapter
            │
            ├── HttpMessageAdapter — IAgentRunnerDB implementation
            │   ├── listMessages() → GET /_/orgs/:orgId/agents/:agentId/threads/:threadId/messages
            │   └── createMessage() → POST same endpoint
            │
            └── AgentRepl — Interactive loop:
                ├── #selectOrg() — Interactive org picker
                ├── #selectAgent() — Interactive agent picker
                └── #loop() — Readline prompt (> )
```

### Request Flow

```
1. User types message at > prompt
2. AgentRepl.#sendMessage(prompt)
3. LocalAgentExecutor.run()
   a. createSession(agentId) → backend resolves API key, returns session token
   b. ProxyAdapter created with session token (LLM calls go through backend SSE)
   c. Creates thread if none exists
   d. AgentRunner.run() with:
      - adapter: ProxyAdapter (proxies LLM calls through /ai/chat)
      - llmConfig (provider + model, NO apiKey)
      - db: HttpMessageAdapter (persists messages via API)
      - onEvent callback (streams events to Renderer)
4. ProxyAdapter → POST /ai/chat with Authorization: Session <token>
   - Backend injects API key server-side, streams SSE response
5. Renderer displays streaming response:
   - text → rendered markdown
   - tool_call_start → tool header
   - tool_call_args → streaming args
   - tool_result → formatted result
   - done → completion
6. Messages persisted to backend via HttpMessageAdapter
```

## Task-Based Architecture

### Task System (`@keg-hub/args-parse`)

All commands are implemented as tasks with standardized structure:

```typescript
type TTask = {
  name: string                    // Command name (e.g., 'login', 'chat')
  alias?: string[]                // Short aliases (e.g., ['li'], ['ch'])
  description: string             // Help text
  default?: boolean               // Default command if no args
  options?: Record<string, {      // CLI flags (auto-parsed by argsParse)
    alias?: string[]
    description?: string
    type?: string
    default?: any
  }>
  action: TTaskAction             // Handler function
}

type TTaskAction = (context: {
  params: Record<string, any>     // Parsed CLI args
  task: TTask                     // Current task
  tasks: TTasks                   // All tasks (for help)
  auth: AuthManager               // Auth manager instance
  renderer: Renderer              // Renderer instance
  config: TReplConfig             // User config from ~/.config/tdsk/repl.json
  options: Record<string, any>    // Original options (pre-parse)
}) => Promise<void>
```

### Task Registry (`src/tasks/index.ts`)

```typescript
export const TTasks: TTask[] = [
  loginTask,      // 'login', alias: ['li']
  logoutTask,     // 'logout', alias: ['lo']
  statusTask,     // 'status', alias: ['st']
  agentsTask,     // 'agents', alias: ['ag']
  threadsTask,    // 'threads', alias: ['th']
  chatTask,       // 'chat', alias: ['ch'], default: true
  helpTask        // 'help' (also --help, -h)
]
```

### Task Resolution Flow

```
1. main() parses process.argv
2. Handles --version/-v flag directly (prints version, exits)
3. Defaults to 'chat' if:
   - No args provided
   - First arg is a value flag (--org, --agent, --thread)
4. Calls find(tasks, commandName) to resolve task
   - Returns task if found (by name or alias)
   - Returns null if not found
5. If not found: calls taskError() (suggests similar commands)
6. Calls loadConfig() to load ~/.config/tdsk/repl.json
7. Calls addDefaults() to merge config into task option defaults
8. Calls argsParse() with task-specific options
9. Instantiates AuthManager, Renderer
10. Applies insecure mode from stored credentials
11. Calls task.action() with full context
```

## Key Components

### 1. CLI Entry (`src/cli.ts`)

Main entry point for the CLI. Orchestrates argument parsing, config loading, and task dispatch.

```typescript
export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle --version/-v
  if (args.includes('--version') || args.includes('-v')) {
    console.log(TDSK_REPL_VERSION)
    return
  }

  // Default to 'chat' command
  const firstArg = args[0]
  const isValueFlag = firstArg?.startsWith('--')
  const commandName = !firstArg || isValueFlag ? 'chat' : firstArg

  // Find task
  const task = find(TTasks, commandName)
  if (!task) return taskError(commandName, TTasks)

  // Load user config
  const config = loadConfig()

  // Merge config defaults into task options
  const options = addDefaults(task.options, config)

  // Parse args
  const params = argsParse(args, options)

  // Setup context
  const auth = new AuthManager()
  const renderer = new Renderer()

  // Apply insecure mode from stored credentials
  const credentials = auth.getCredentials()
  if (credentials?.insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  // Dispatch to task
  await task.action({ params, task, tasks: TTasks, auth, renderer, config, options })
}
```

### 2. Task Utilities (`src/utils/tasks/`)

#### `find.ts` — Task Resolution

```typescript
export function find(tasks: TTask[], name: string): TTask | null
```

Resolves a task by name or alias. Returns `null` if not found.

#### `config.ts` — User Configuration

```typescript
type TReplConfig = {
  org?: string       // Default org ID
  agent?: string     // Default agent ID
  insecure?: boolean // Allow self-signed certs
}

export function loadConfig(): TReplConfig
export function saveConfig(config: TReplConfig): void
```

- **Config Path**: `~/.config/tdsk/repl.json`
- **Purpose**: Store user preferences (default org/agent, insecure mode)
- **Behavior**: Returns `{}` if file doesn't exist

#### `addDefaults.ts` — Config Injection

```typescript
export function addDefaults(
  options: Record<string, any>,
  config: TReplConfig
): Record<string, any>
```

Merges config values into task option defaults:
- `config.org` → `options.org.default`
- `config.agent` → `options.agent.default`
- `config.insecure` → `options.insecure.default`

#### `requireAuth.ts` — Auth Wrapper

```typescript
export function requireAuth(action: TTaskAction): TTaskAction
```

Wraps a task action to enforce authentication. Checks `auth.isLoggedIn()` and exits with error if not authenticated.

#### `error.ts` — Unknown Command Handler

```typescript
export function taskError(name: string, tasks: TTask[]): void
```

Prints error message and suggests similar commands based on name/alias matching.

### 3. Task Definitions (`src/tasks/`)

#### `login.ts`

```typescript
export const loginTask: TTask = {
  name: 'login',
  alias: ['li'],
  description: 'Authenticate with API key',
  options: {
    key: { description: 'API key (tdsk_...)', type: 'string', required: true },
    url: { description: 'Proxy URL', type: 'string' },
    insecure: { description: 'Allow self-signed certs', type: 'boolean' }
  },
  action: async ({ params, auth, renderer }) => {
    await auth.login(params.key, params.url, params.insecure)
    renderer.renderSuccess('Logged in successfully')
  }
}
```

#### `logout.ts`

```typescript
export const logoutTask: TTask = {
  name: 'logout',
  alias: ['lo'],
  description: 'Remove stored credentials',
  action: async ({ auth, renderer }) => {
    auth.logout()
    renderer.renderSuccess('Logged out successfully')
  }
}
```

#### `status.ts`

```typescript
export const statusTask: TTask = {
  name: 'status',
  alias: ['st'],
  description: 'Show authentication status',
  action: async ({ auth, renderer }) => {
    const credentials = auth.getCredentials()
    if (credentials) {
      renderer.renderInfo(`Logged in to ${credentials.proxyUrl}`)
    } else {
      renderer.renderWarning('Not logged in')
    }
  }
}
```

#### `agents.ts`

```typescript
export const agentsTask: TTask = {
  name: 'agents',
  alias: ['ag'],
  description: 'List agents',
  options: {
    org: { alias: ['o'], description: 'Organization ID', type: 'string' }
  },
  action: requireAuth(async ({ params, auth, renderer }) => {
    const client = new ApiClient(auth)
    const orgId = await resolveOrgId(params.org, client, renderer)
    const agents = await client.listAgents(orgId)
    // ... render agents table
  })
}
```

#### `threads.ts`

```typescript
export const threadsTask: TTask = {
  name: 'threads',
  alias: ['th'],
  description: 'List threads for an agent',
  options: {
    agent: { alias: ['a'], description: 'Agent ID', type: 'string', required: true },
    org: { alias: ['o'], description: 'Organization ID', type: 'string' }
  },
  action: requireAuth(async ({ params, auth, renderer }) => {
    const client = new ApiClient(auth)
    const orgId = await resolveOrgId(params.org, client, renderer)
    const threads = await client.listThreads(orgId, params.agent)
    // ... render threads table
  })
}
```

#### `chat.ts`

```typescript
export const chatTask: TTask = {
  name: 'chat',
  alias: ['ch'],
  description: 'Start interactive chat',
  default: true,
  options: {
    org: { alias: ['o'], description: 'Organization ID', type: 'string' },
    agent: { alias: ['a'], description: 'Agent ID', type: 'string' },
    thread: { alias: ['t'], description: 'Thread ID', type: 'string' }
  },
  action: requireAuth(async ({ params, auth, renderer }) => {
    const client = new ApiClient(auth)
    const executor = new LocalAgentExecutor(client)
    const repl = new AgentRepl(executor, renderer)
    await repl.start({
      orgId: params.org,
      agentId: params.agent,
      threadId: params.thread
    })
  })
}
```

#### `help.ts`

```typescript
export const helpTask: TTask = {
  name: 'help',
  description: 'Show available commands',
  action: async ({ tasks, renderer }) => {
    // Renders table of all tasks with name, alias, description
  }
}
```

### 4. AuthManager (`src/auth/auth.ts`)

Handles persistent authentication via API key stored on disk.

```typescript
class AuthManager {
  getCredentials(): TAuthCredentials | null   // Read ~/.config/tdsk/repl-auth.json
  isLoggedIn(): boolean
  async login(apiKey, proxyUrl?, insecure?)   // Validate against /_/orgs + store
  logout(): void                               // Delete config file
}

type TAuthCredentials = {
  apiKey: string
  proxyUrl: string
  insecure?: boolean
}
```

- **Config Path**: `~/.config/tdsk/repl-auth.json`
- **Default Proxy**: `https://px.local.threadedstack.app`
- **Validation**: Fetches `/_/orgs` endpoint to verify API key works
- **Insecure Mode**: Sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certs (persisted to config)

### 5. ApiClient (`src/api/client.ts`)

HTTP wrapper for all backend API interactions.

```typescript
class ApiClient {
  // Proxy URL getter (throws if not logged in)
  get proxyUrl(): string

  // Organizations
  listOrgs(): Promise<unknown[]>
  getOrg(orgId): Promise<unknown>

  // Agents
  listAgents(orgId): Promise<unknown[]>
  getAgent(orgId, agentId): Promise<unknown>

  // Sessions (replaces resolveAgent — API keys never leave the server)
  createSession(agentId): Promise<TSessionInfo>

  // Threads
  listThreads(orgId, agentId): Promise<unknown[]>
  getThread(orgId, agentId, threadId): Promise<unknown>
  createThread(orgId, agentId, name?): Promise<unknown>

  // Messages
  listMessages(orgId, agentId, threadId): Promise<unknown[]>
  createMessage(orgId, agentId, threadId, data): Promise<unknown>
}

type TSessionInfo = {
  sessionToken: string
  provider: TLLMProviderType
  model: string
  maxTokens?: number
  systemPrompt?: string
}
```

- **Auth**: `Authorization: Bearer <apiKey>` header on all `/_/*` requests
- **Session Creation**: `POST /_/ai/sessions` with `{ agentId }` → returns `TSessionInfo`
- **Base URL**: `${proxyUrl}/_` (all paths prefixed with `/_`)
- **Response Format**: Unwraps `{ data: T }` envelope from backend

### 6. LocalAgentExecutor (`src/executor/executor.ts`)

Orchestrates local agent execution with session-based LLM proxying. API keys never leave the server.

```typescript
class LocalAgentExecutor {
  #client: ApiClient

  async createSession(agentId: string): Promise<TSessionInfo>

  async run(opts: {
    orgId: string
    agentId: string
    threadId?: string
    prompt: string
    onEvent?: (event: TStreamEvent) => void
  }): Promise<{ threadId: string }>
}
```

- **Session Creation**: Calls `POST /_/ai/sessions` → backend resolves API key, returns session token + LLM config
- **ProxyAdapter**: Creates `ProxyAdapter` with session token — LLM calls go through backend SSE (`/ai/chat`)
- **Thread Management**: Creates thread if none provided, reuses existing
- **Execution**: Delegates to `AgentRunner.run()` with:
  - `adapter`: ProxyAdapter (no API key)
  - `llmConfig`: provider + model from session
  - `db`: HttpMessageAdapter
  - `onEvent`: streams to renderer
  - `maxSteps`: 10 (hardcoded)
- **Persistence**: Uses `HttpMessageAdapter` as the database layer

### 7. HttpMessageAdapter (`src/executor/httpAdapter.ts`)

Implements `IAgentRunnerDB` interface from `@tdsk/agent` using HTTP instead of direct DB access.

```typescript
class HttpMessageAdapter implements IAgentRunnerDB {
  #client: ApiClient
  #orgId: string
  #agentId: string
  #threadId: string

  async listMessages(opts): Promise<{ data?: Array<{...}> }>
  async createMessage(data): Promise<void>
}
```

### 8. AgentRepl (`src/repl.ts`)

Main interactive REPL with slash commands and session management.

```typescript
class AgentRepl {
  #client: ApiClient
  #executor: LocalAgentExecutor
  #renderer: Renderer
  #orgId: string | null = null
  #agentId: string | null = null
  #threadId: string | null = null

  async start(opts?: { orgId?, agentId?, threadId? }): Promise<void>
}
```

**Slash Commands** (10 total):

| Command | Aliases | Description |
|---------|---------|-------------|
| `/help` | `/h` | Show available commands |
| `/new` | — | Start new thread |
| `/threads` | — | List threads for current agent |
| `/switch <id>` | — | Switch to a different thread |
| `/history` | — | Load and display thread messages |
| `/agent` | — | Switch to a different agent |
| `/info` | — | Show current session info |
| `/exit` | `/quit`, `/q` | Exit the REPL |

**Interactive Flows**:
- `#selectOrg()` — Lists orgs, prompts user to pick one (auto-selects if only 1)
- `#selectAgent()` — Lists agents, prompts user to pick one (auto-selects if only 1)
- `#loop()` — Readline prompt (`> `), dispatches messages to executor

### 9. Renderer (`src/display/renderer.ts`)

Event-driven terminal output with rich formatting.

```typescript
class Renderer {
  renderEvent(event: TStreamEvent): void
  renderWelcome(agentName: string, threadId?: string): void
  renderInfo(msg: string): void
  renderSuccess(msg: string): void
  renderWarning(msg: string): void
  spinner(msg: string): { stop: () => void }
  clear(): void
}
```

**Event Types Handled**: `text`, `tool_call_start`, `tool_call_args`, `tool_result`, `error`, `done`

**Tool Call Formatting**:
- Tree structure using `┌ │ ├ └` characters
- ✓ (green) for success, ✗ (red) for errors
- Truncates args >80 chars, results >500 chars
- Syntax highlighting for JSON/code blocks

**Spinner**:
- ANSI animation: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`
- 80ms interval
- `.stop()` method to clear

## CLI Commands

```bash
# Authentication
tdsk-agent login <api-key> [--url <proxy-url>] [--insecure]
tdsk-agent logout
tdsk-agent status

# Discovery
tdsk-agent agents [--org <id>]
tdsk-agent threads <agent-id> [--org <id>]

# Interactive Chat
tdsk-agent chat [--org <id>] [--agent <id>] [--thread <id>]
tdsk-agent                    # Default: launches chat

# Help
tdsk-agent help / --help / -h
tdsk-agent --version / -v
```

**Command Aliases**:
- `login` → `li`
- `logout` → `lo`
- `status` → `st`
- `agents` → `ag`
- `threads` → `th`
- `chat` → `ch`

**Global Flags**:
- `--org <id>` / `-o <id>` — Organization ID
- `--agent <id>` / `-a <id>` — Agent ID
- `--thread <id>` / `-t <id>` — Thread ID (chat only)
- `--url <proxy-url>` — Custom proxy URL (login only)
- `--insecure` — Allow self-signed TLS certs (login only)

**Default Command Behavior**:
- No args: launches `chat`
- Args starting with `--`: launches `chat` with those flags
- Other args: dispatches to named command

## Key Patterns

### 1. Task-Based Architecture

All commands follow the task pattern:

```typescript
export const exampleTask: TTask = {
  name: 'example',
  alias: ['ex'],
  description: 'Example command',
  options: {
    flag: { alias: ['f'], description: 'Example flag', type: 'boolean' }
  },
  action: async ({ params, auth, renderer, config }) => {
    // Implementation
  }
}
```

### 2. Config-Driven Defaults

User preferences stored in `~/.config/tdsk/repl.json` are merged into task option defaults:

```typescript
// User config: { org: 'abc', agent: 'xyz' }
// Task options: { org: { default: undefined } }
// After addDefaults(): { org: { default: 'abc' } }
```

### 3. Private Fields (#)

Uses JavaScript private fields for encapsulation throughout all classes:

```typescript
class AgentRepl {
  #client: ApiClient
  #executor: LocalAgentExecutor
  #renderer: Renderer
  #orgId: string | null = null
  #agentId: string | null = null
  #threadId: string | null = null
}
```

### 4. Event Streaming

Agent execution streams events to the renderer in real-time:

```typescript
await executor.run({
  prompt,
  onEvent: (event: TStreamEvent) => renderer.renderEvent(event)
})
```

### 5. Config Path Convention

Follows XDG convention for user configuration:
- `~/.config/tdsk/repl-auth.json` — Auth credentials
- `~/.config/tdsk/repl.json` — User preferences

### 6. API Envelope Unwrapping

All API responses unwrap the `{ data: T }` envelope:

```typescript
async #request<T>(path: string, opts?): Promise<T> {
  const json = await response.json()
  return json.data
}
```

### 7. Graceful Error Handling

All async operations wrap errors with context:

```typescript
throw new Error(`Authentication failed (${response.status}): ${body}`)
```

### 8. Auth-Required Tasks

Tasks requiring authentication use the `requireAuth()` wrapper:

```typescript
export const agentsTask: TTask = {
  name: 'agents',
  action: requireAuth(async ({ params, auth }) => {
    // Only runs if authenticated
  })
}
```

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@keg-hub/args-parse` | 10.0.1 | CLI argument parser (task-based architecture) |
| `@keg-hub/jsutils` | 10.0.0 | JavaScript utility functions |
| `@tdsk/agent` | workspace:* | AgentRunner for local ReAct loop execution |
| `@tdsk/domain` | workspace:* | Shared types (TStreamEvent, TLLMAdapterConfig, TMessageContent) |
| `@tdsk/sandbox` | workspace:* | Sandbox provider abstraction (imported but not actively used) |
| `marked` | 15.0.0 | Markdown parsing for agent responses |
| `marked-terminal` | 7.0.0 | Terminal-friendly markdown rendering (ANSI) |
| `cli-highlight` | 2.1.11 | Syntax highlighting for code blocks in output |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `@biomejs/biome` | Linting and formatting |
| `typescript` | Type checking |
| `vitest` | Test framework |
| `vite-tsconfig-paths` | Path alias resolution in tests |

## Commands

### Development

```bash
pnpm dev             # Run directly via bun (bun run src/index.ts)
```

### Building

```bash
pnpm build           # Bundle via bun (bun build → dist/index.js, 2.4MB)
pnpm compile         # Native binary (bun build --compile → dist/tdsk-agent, 67MB)
pnpm clean           # Remove dist/
```

### Testing

```bash
pnpm test            # Run vitest (149 tests, 9 files)
```

### Commands Notes

* Linting and formatting run automatically via Biome — `pnpm lint` and `pnpm format` should be ignored.
* The `dev` command requires `bun` to be installed (not Node.js).
* The `compile` command produces a standalone native binary that doesn't require bun at runtime.

## Testing

### Current Coverage (149 tests, 9 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/cli.test.ts` | 124 | CLI arg parsing, task dispatch, help/version output, error handling, config defaults, insecure mode |
| `src/api/client.test.ts` | 60 | All CRUD endpoints, session creation, proxyUrl getter, auth headers, error handling |
| `src/repl.test.ts` | 52 | Interactive loop, slash commands, session management, org/agent selection |
| `src/display/renderer.test.ts` | 35 | Event rendering, markdown output, tool call formatting, spinner |
| `src/auth/auth.test.ts` | 19 | Login flow, credential storage, API validation, logout, insecure mode |
| `src/executor/executor.test.ts` | 12 | Session creation, ProxyAdapter construction, thread management, runner integration |
| `src/utils/tasks/find.test.ts` | 10 | Task resolution by name/alias, null handling |
| `src/utils/tasks/config.test.ts` | 8 | Config load/save, JSON parsing, file creation |
| `src/executor/httpAdapter.test.ts` | 3 | Message list/create, null handling |

**Note**: Test counts add up to more than 149 due to nested `describe` blocks. The actual test output reports 149 total tests.

**Testing Patterns**:
- Mocks `fetch` globally via `vi.stubGlobal()`
- Co-located test files (`.test.ts` adjacent to source)
- Full mock coverage of external dependencies
- `beforeEach()` setup/cleanup in all suites

## Integration Points

### With Agent (`@tdsk/agent`)

- Imports `AgentRunner` for local ReAct loop execution
- Imports `ProxyAdapter` — LLM calls proxied through backend SSE (`/ai/chat`)
- Implements `IAgentRunnerDB` interface via `HttpMessageAdapter`
- Uses `TStreamEvent` for real-time event handling

### With Domain (`@tdsk/domain`)

- `TStreamEvent` — Event types for agent streaming output
- `TLLMAdapterConfig` — LLM provider configuration (apiKey is optional when using ProxyAdapter)
- `TLLMProviderType` — Provider type enum used in `TSessionInfo`
- `TMessageContent` — Message content structure

### With Backend API

- **Auth**: API key validated against `/_/orgs` endpoint
- **Sessions**: `POST /_/ai/sessions` — creates session token, resolves API key server-side
- **LLM Proxy**: `POST /ai/chat` — streams LLM responses via SSE (session token auth, no API key auth)
- **Agents**: `/_/orgs/:orgId/agents` for listing
- **Threads**: `/_/orgs/:orgId/agents/:agentId/threads` for CRUD
- **Messages**: `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages` for persistence

### With Proxy

- All API requests route through the proxy at the configured URL
- Default: `https://px.local.threadedstack.app`
- Auth: `Authorization: Bearer <apiKey>` header

## Path Aliases

```json
{
  "@TRL": ["src"],
  "@TRL/*": ["src/*"],
  "@TRL/configs": ["configs"],
  "@TDM/*": ["../domain/src/*"],
  "@TAG/*": ["../agent/src/*"],
  "@TSB/*": ["../sandbox/src/*"],
  "@tdsk/domain": ["../domain/src"],
  "@tdsk/agent": ["../agent/src"],
  "@tdsk/sandbox": ["../sandbox/src"]
}
```

## Development Notes

### Adding a New CLI Command

1. Create task file in `src/tasks/<command>.ts`
2. Export task definition with name, alias, description, options, action
3. Add task to `TTasks` array in `src/tasks/index.ts`
4. If it needs auth, wrap action with `requireAuth()`
5. If it needs API access, use `ApiClient` in action
6. If it needs display, use `Renderer` in action

Example:

```typescript
// src/tasks/example.ts
import type { TTask } from '@TRL/types'
import { requireAuth } from '@TRL/utils/tasks'

export const exampleTask: TTask = {
  name: 'example',
  alias: ['ex'],
  description: 'Example command',
  options: {
    flag: { alias: ['f'], description: 'Example flag', type: 'boolean' }
  },
  action: requireAuth(async ({ params, auth, renderer }) => {
    // Implementation
  })
}

// src/tasks/index.ts
import { exampleTask } from './example'
export const TTasks = [loginTask, ..., exampleTask, helpTask]
```

### Adding a New Slash Command

1. Add case to `AgentRepl.#handleCommand()` in `src/repl.ts`
2. Implement the handler method on the class
3. Update `/help` output in `#showHelp()`

Example:

```typescript
// In AgentRepl class
#handleCommand(input: string): boolean {
  if (input === '/example') {
    this.#handleExample()
    return true
  }
  // ... existing commands
}

#handleExample(): void {
  this.#renderer.renderInfo('Example command')
}

#showHelp(): void {
  console.log(`
Available commands:
  /example        - Example slash command
  ...
  `)
}
```

### Adding a New Task Utility

1. Create utility file in `src/utils/tasks/<name>.ts`
2. Export function that operates on task context
3. Add to `src/utils/tasks/index.ts`

Example:

```typescript
// src/utils/tasks/example.ts
import type { TTaskAction } from '@TRL/types'

export function exampleWrapper(action: TTaskAction): TTaskAction {
  return async (context) => {
    // Pre-processing
    await action(context)
    // Post-processing
  }
}

// src/utils/tasks/index.ts
export { exampleWrapper } from './example'
```

### Authentication Flow

```
1. User runs: tdsk-agent login <api-key> [--url <url>] [--insecure]
2. AuthManager.login() validates key by fetching /_/orgs
3. On success: writes { apiKey, proxyUrl, insecure } to ~/.config/tdsk/repl-auth.json
4. All subsequent commands read credentials from disk
5. ApiClient uses stored apiKey as Bearer token
6. Insecure mode persisted to config, applied at startup
```

### Config Flow

```
1. User runs command with flags: tdsk-agent chat --org abc --agent xyz
2. loadConfig() reads ~/.config/tdsk/repl.json (e.g., { org: 'def' })
3. addDefaults() merges config into task option defaults
4. argsParse() parses CLI args (--org abc overrides default)
5. Final params: { org: 'abc', agent: 'xyz' }
6. Config can be updated by modifying ~/.config/tdsk/repl.json
```

---

**Last Updated:** 2026-02-15
**Version:** 2.0.0

### Changelog

#### v2.0.0 (2026-02-15)
- **Breaking**: Migrated to `@keg-hub/args-parse` task-based architecture
- **Breaking**: Command dispatch now uses task registry instead of switch statement
- **New**: Task system (`src/tasks/`) with 7 task definitions
- **New**: Task utilities (`src/utils/tasks/`) — find, config, error, addDefaults, requireAuth
- **New**: User config system (`~/.config/tdsk/repl.json`) for default org/agent/insecure
- **New**: `addDefaults()` merges config values into task option defaults
- **New**: `requireAuth()` wrapper enforces authentication on tasks
- **New**: `taskError()` suggests similar commands on unknown input
- **New**: Insecure mode persisted to auth config, applied at startup
- **New**: Default command behavior (no args or value flags → `chat`)
- **New**: Command aliases (login→li, logout→lo, status→st, agents→ag, threads→th, chat→ch)
- **Improved**: Config path now `~/.config/tdsk/repl.json` (was only auth JSON)
- **Improved**: Help text auto-generated from task registry
- **Testing**: 149/149 tests passing across 9 test files (was 138/7)
- **Docs**: Updated SKILL.md to reflect task-based architecture

#### v1.1.0 (2026-02-14)
- **Breaking**: Replaced `resolveAgent()` with session-based LLM proxy flow
- **New**: `createSession(agentId)` → `TSessionInfo` (session token + LLM config, no API key)
- **New**: `ProxyAdapter` from `@tdsk/agent` — LLM calls proxied through backend SSE (`/ai/chat`)
- **New**: `proxyUrl` getter on ApiClient
- **Removed**: `resolveAgent()` method and `TResolvedAgentConfig` type
- **Security**: API keys never leave the server — session tokens used for LLM proxy auth
- **Testing**: 138/138 tests passing across 7 test files

#### v1.0.0 (2026-02-13)
- **Initial Release**: Terminal REPL for AI agent interaction
- **New**: AuthManager with persistent API key storage
- **New**: ApiClient HTTP wrapper for backend API
- **New**: LocalAgentExecutor with server-side credential resolution
- **New**: HttpMessageAdapter (IAgentRunnerDB over HTTP)
- **New**: AgentRepl interactive loop with 9 slash commands
- **New**: Renderer with markdown, syntax highlighting, tool call visualization
- **New**: Compilable to standalone binary via `bun build --compile`
- **Testing**: 59/59 tests passing across 4 test files

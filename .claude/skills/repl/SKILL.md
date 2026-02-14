---
name: "Threaded Stack - REPL Repo"
description: "Knowledge base for the terminal REPL CLI for AI agent interaction"
version: "1.1.0"
tags: ["cli", "repl", "bun", "agent", "terminal", "interactive", "session", "proxy-adapter"]
---
# REPL Repo Skill

## Overview

The **REPL** repo (`repos/repl`, `@tdsk/repl`) is a terminal-based interactive CLI for communicating with ThreadedStack AI agents. It provides:

- **Local Agent Execution** — Runs agent ReAct loops locally via session-based LLM proxy (API keys never leave the backend)
- **Persistent Authentication** — API key-based login stored in `~/.config/tdsk/repl-auth.json`
- **Conversation Management** — Thread creation, switching, history loading via backend API
- **Rich Terminal Output** — Markdown rendering, syntax highlighting, ANSI colors, tool call visualization
- **Compilable Binary** — Produces a standalone `tdsk-agent` binary via `bun build --compile`

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
│   ├── repl.ts                 # AgentRepl main interactive loop class
│   ├── types/
│   │   ├── index.ts            # Type exports
│   │   └── repl.types.ts       # TAuthCredentials, TCliArgs, TToolCallAccumulator
│   ├── auth/
│   │   ├── index.ts            # AuthManager export
│   │   ├── auth.ts             # AuthManager class (login/logout/credentials)
│   │   └── auth.test.ts        # 17 unit tests
│   ├── api/
│   │   ├── index.ts            # ApiClient export
│   │   ├── client.ts           # ApiClient class (HTTP API wrapper + session creation)
│   │   └── client.test.ts      # 18 unit tests
│   ├── executor/
│   │   ├── index.ts            # Executor exports
│   │   ├── executor.ts         # LocalAgentExecutor class (session-based flow)
│   │   ├── executor.test.ts    # 9 unit tests
│   │   ├── httpAdapter.ts      # HttpMessageAdapter (IAgentRunnerDB impl)
│   │   └── httpAdapter.test.ts # 3 unit tests
│   └── display/
│       ├── index.ts            # Renderer & colors exports
│       ├── colors.ts           # ANSI color functions
│       └── renderer.ts         # Renderer class (output formatting)
├── package.json
└── tsconfig.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point — parses args, dispatches commands (login/logout/status/agents/threads/chat) |
| `src/repl.ts` | AgentRepl class — interactive readline loop with slash commands |
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
CLI Entry (index.ts)
    ├── AuthManager — Persistent login (API key + proxy URL → ~/.config/tdsk/repl-auth.json)
    │
    ├── Command Dispatcher (login, logout, status, agents, threads, chat)
    │
    └── Chat Flow:
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

## Key Components

### 1. AuthManager (`src/auth/auth.ts`)

Handles persistent authentication via API key stored on disk.

```typescript
class AuthManager {
  getCredentials(): TAuthCredentials | null   // Read ~/.config/tdsk/repl-auth.json
  isLoggedIn(): boolean
  async login(apiKey, proxyUrl?, insecure?)   // Validate against /_/orgs + store
  logout(): void                               // Delete config file
}
```

- **Config Path**: `~/.config/tdsk/repl-auth.json`
- **Default Proxy**: `https://px.local.threadedstack.app`
- **Validation**: Fetches `/_/orgs` endpoint to verify API key works
- **Insecure Mode**: Sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certs

### 2. ApiClient (`src/api/client.ts`)

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

### 3. LocalAgentExecutor (`src/executor/executor.ts`)

Orchestrates local agent execution with session-based LLM proxying. API keys never leave the server.

```typescript
class LocalAgentExecutor {
  client: ApiClient
  async createSession(agentId): Promise<TSessionInfo>
  async run(opts): Promise<{ threadId: string }>
}
```

- **Session Creation**: Calls `POST /_/ai/sessions` → backend resolves API key, returns session token + LLM config
- **ProxyAdapter**: Creates `ProxyAdapter` with session token — LLM calls go through backend SSE (`/ai/chat`)
- **Thread Management**: Creates thread if none provided, reuses existing
- **Execution**: Delegates to `AgentRunner.run()` with `adapter` (ProxyAdapter) and `llmConfig` (no apiKey)
- **Persistence**: Uses `HttpMessageAdapter` as the database layer

### 4. HttpMessageAdapter (`src/executor/httpAdapter.ts`)

Implements `IAgentRunnerDB` interface from `@tdsk/agent` using HTTP instead of direct DB access.

```typescript
class HttpMessageAdapter implements IAgentRunnerDB {
  async listMessages(opts): Promise<{ data?: Array<{...}> }>
  async createMessage(data): Promise<void>
}
```

### 5. AgentRepl (`src/repl.ts`)

Main interactive REPL with slash commands and session management.

```typescript
class AgentRepl {
  async start(opts?: { orgId?, agentId?, threadId? }): Promise<void>
}
```

**Slash Commands**:
| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/new` | Start new thread |
| `/threads` | List threads for current agent |
| `/switch <id>` | Switch to a different thread |
| `/history` | Load and display thread messages |
| `/agent` | Switch to a different agent |
| `/info` | Show current session info |
| `/exit`, `/quit` | Exit the REPL |

### 6. Renderer (`src/display/renderer.ts`)

Event-driven terminal output with rich formatting.

```typescript
class Renderer {
  renderEvent(event: TStreamEvent): void
  renderWelcome(agentName, threadId?): void
  renderInfo(msg): void
  renderSuccess(msg): void
  renderWarning(msg): void
  spinner(msg): { stop: () => void }
}
```

**Event Types Handled**: `text`, `tool_call_start`, `tool_call_args`, `tool_result`, `error`, `done`

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

**Session Flags**:
- `--org <id>` — Skip org selection
- `--agent <id>` — Skip agent selection
- `--thread <id>` — Resume existing thread
- `--url <proxy-url>` — Custom proxy URL (login only)
- `--insecure` — Allow self-signed TLS certs (login only)

## Key Patterns

### 1. Private Fields (#)

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

### 2. Event Streaming

Agent execution streams events to the renderer in real-time:

```typescript
await executor.run({
  prompt,
  onEvent: (event: TStreamEvent) => renderer.renderEvent(event)
})
```

### 3. Config Path Convention

Follows XDG convention for user configuration:
- `~/.config/tdsk/repl-auth.json` — Auth credentials

### 4. API Envelope Unwrapping

All API responses unwrap the `{ data: T }` envelope:

```typescript
async #request<T>(path: string, opts?): Promise<T> {
  const json = await response.json()
  return json.data
}
```

### 5. Graceful Error Handling

All async operations wrap errors with context:

```typescript
throw new Error(`Authentication failed (${response.status}): ${body}`)
```

## Dependencies

### Core Dependencies

| Package | Purpose |
|---------|---------|
| `@tdsk/agent` | AgentRunner for local ReAct loop execution |
| `@tdsk/domain` | Shared types (TStreamEvent, TLLMAdapterConfig, TMessageContent) |
| `@tdsk/sandbox` | Sandbox provider abstraction for agent execution |
| `marked` | Markdown parsing for agent responses |
| `marked-terminal` | Terminal-friendly markdown rendering (ANSI) |
| `cli-highlight` | Syntax highlighting for code blocks in output |

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
pnpm build           # Bundle via bun (bun build → dist/)
pnpm compile         # Native binary (bun build --compile → dist/tdsk-agent)
pnpm clean           # Remove dist/
```

### Testing

```bash
pnpm test            # Run vitest (138 tests, 7 files)
```

### Commands Notes

* Linting and formatting run automatically via Biome — `pnpm lint` and `pnpm format` should be ignored.
* The `dev` command requires `bun` to be installed (not Node.js).
* The `compile` command produces a standalone native binary that doesn't require bun at runtime.

## Testing

### Current Coverage (138 tests, 7 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/auth/auth.test.ts` | 17 | Login flow, credential storage, API validation, logout, insecure mode |
| `src/api/client.test.ts` | 18 | All CRUD endpoints, session creation, proxyUrl getter, auth headers, error handling |
| `src/executor/executor.test.ts` | 9 | Session creation, ProxyAdapter construction, thread management, runner integration |
| `src/executor/httpAdapter.test.ts` | 3 | Message list/create, null handling |
| `src/display/renderer.test.ts` | 23 | Event rendering, markdown output, tool call formatting, spinner |
| `src/repl.test.ts` | 29 | Interactive loop, slash commands, session management, org/agent selection |
| `src/cli.test.ts` | 39 | CLI arg parsing, command dispatch, help/version output, error handling |

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

1. Add command handler in `src/index.ts` command dispatcher
2. If it needs API access, add method to `ApiClient`
3. If it needs display, add method to `Renderer`

### Adding a New Slash Command

1. Add case to `AgentRepl.#handleCommand()` in `src/repl.ts`
2. Implement the handler method on the class
3. Update `/help` output

### Authentication Flow

```
1. User runs: tdsk-agent login <api-key> [--url <url>] [--insecure]
2. AuthManager.login() validates key by fetching /_/orgs
3. On success: writes { apiKey, proxyUrl, insecure } to ~/.config/tdsk/repl-auth.json
4. All subsequent commands read credentials from disk
5. ApiClient uses stored apiKey as Bearer token
```

---

**Last Updated:** 2026-02-14
**Version:** 1.1.0

### Changelog

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

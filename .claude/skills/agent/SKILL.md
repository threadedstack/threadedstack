---
name: "Threaded Stack - Agent Repo"
description: "Knowledge base for the headless AI agent orchestration library"
version: "2.0.0"
tags: ["ai-agent", "llm", "streaming", "react-loop", "tool-execution", "sandbox", "typescript"]
---
# Agent Repo Skill

## Overview

The **Agent** repo (`repos/agent`, `@tdsk/agent`) is a headless AI agent orchestration library that provides streaming-first LLM integration and a ReAct loop for tool execution. It acts as the runtime brain for Threaded Stack's AI agent system.

**Key Characteristics:**
- **Type**: Headless AI Agent Library (no server, no WASM)
- **Tech Stack**: TypeScript, streaming SSE, async generators
- **Architecture**: AgentRunner orchestrates a multi-step ReAct loop with LLM streaming and sandbox-based tool execution
- **LLM Support**: Anthropic, OpenAI, Google Gemini, Z.AI (GLM), and ProxyAdapter (backend SSE relay)
- **Sandbox**: Delegates to `@tdsk/sandbox` for isolated code/shell execution (E2B or local)
- **Concurrency**: Mutex-based serial execution per threadId
- **Build**: Single-step CJS bundle via tsup (no WASM compilation)

**Key Problem Solved**: Provides a unified, streaming-first interface for running AI agents across multiple LLM providers, with automatic tool call detection, sandbox execution, and conversation history management.

## Directory Structure

```
repos/agent/
├── package.json                  # v2.0.0, type: module
├── tsconfig.json                 # TypeScript config with path mappings
├── configs/
│   ├── agent.config.ts           # Logger + env config
│   ├── aliases.ts                # Path aliases (@TAG/*)
│   ├── biome.json                # Biome linter config
│   ├── tsup.config.ts            # CJS build, externals
│   └── vitest.config.ts          # Vitest test runner config
└── src/
    ├── index.ts                  # Re-exports: llm, types, tools, tsagent, runner, services, @tdsk/sandbox
    ├── index.test.ts             # 6 tests
    ├── tsagent.ts                # TSAgent class — sandbox lifecycle manager (62 lines)
    ├── tsagent.test.ts           # 14 tests
    ├── llm/
    │   ├── index.ts              # Barrel: zai, proxy, openai, google, factory, anthropic, openai-compatible
    │   ├── factory.ts            # createLLMAdapter() — Map-based factory
    │   ├── factory.test.ts       # 7 tests
    │   ├── anthropic.ts          # AnthropicAdapter — native @anthropic-ai/sdk streaming (120 lines)
    │   ├── anthropic.test.ts     # 22 tests
    │   ├── openai.ts             # OpenAIAdapter extends OpenAICompatibleAdapter (15 lines)
    │   ├── openai.test.ts        # 18 tests
    │   ├── openai-compatible.ts  # Abstract base class — SSE fetch, tool call tracking (257 lines)
    │   ├── openai-compatible.test.ts # 29 tests
    │   ├── google.ts             # GoogleAdapter — @google/genai with lazy import (156 lines)
    │   ├── google.test.ts        # 29 tests
    │   ├── zai.ts                # ZaiAdapter extends OpenAICompatibleAdapter (79 lines)
    │   ├── zai.test.ts           # 17 tests
    │   ├── proxy.ts              # ProxyAdapter — backend /ai/chat SSE relay (77 lines)
    │   └── proxy.test.ts         # 7 tests
    ├── runner/
    │   ├── index.ts              # Re-exports runner + runner.types
    │   ├── runner.ts             # AgentRunner — ReAct loop orchestrator (279 lines)
    │   └── runner.test.ts        # 21 tests
    ├── services/
    │   ├── index.ts              # Re-exports mutex
    │   ├── mutex.ts              # Mutex — promise-based locking (61 lines)
    │   └── mutex.test.ts         # 15 tests
    ├── tools/
    │   ├── index.ts              # Re-exports definitions
    │   ├── definitions.test.ts   # 12 tests
    │   └── definitions/
    │       ├── index.ts          # Re-exports definitions
    │       ├── definitions.ts    # allToolDefs, getToolDefs()
    │       ├── definitions.test.ts # 9 tests
    │       ├── fs/fs.ts          # readFile, writeFile, listDir, deleteFile, mkdir, fileExists
    │       ├── shell/definition.ts # shellExec
    │       └── web/web.ts        # webSearch (stub)
    ├── types/
    │   ├── index.ts              # Re-exports mutex.types + runner.types
    │   ├── runner.types.ts       # TAgentRunOpts, IAgentRunnerDB (58 lines)
    │   └── mutex.types.ts        # TMutexOpts (5 lines)
    └── utils/
        ├── index.ts              # Re-exports paths
        ├── logger.ts             # buildApiLogger wrapper
        └── paths.ts              # alias-hq path resolution
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Root barrel export — re-exports llm, types, tools, tsagent, runner, services, and `createSandboxProvider` from `@tdsk/sandbox` |
| `src/tsagent.ts` | TSAgent class — manages sandbox lifecycle (create/get/destroy) with mutex concurrency |
| `src/runner/runner.ts` | AgentRunner — static `run()` method orchestrating the ReAct loop (279 lines) |
| `src/llm/factory.ts` | `createLLMAdapter()` — Map-based factory creating adapters by provider type |
| `src/llm/openai-compatible.ts` | Abstract base class for OpenAI-compatible providers — SSE fetch + tool call tracking (257 lines) |
| `src/llm/anthropic.ts` | AnthropicAdapter — native `@anthropic-ai/sdk` streaming (120 lines) |
| `src/llm/openai.ts` | OpenAIAdapter — thin subclass of OpenAICompatibleAdapter (15 lines) |
| `src/llm/google.ts` | GoogleAdapter — `@google/genai` with lazy dynamic import (156 lines) |
| `src/llm/zai.ts` | ZaiAdapter — OpenAICompatibleAdapter subclass with thinking/web_search/do_sample (79 lines) |
| `src/llm/proxy.ts` | ProxyAdapter — routes LLM calls through backend `/ai/chat` SSE proxy (77 lines) |
| `src/services/mutex.ts` | Mutex — promise-chaining concurrency control (61 lines) |
| `src/tools/definitions/definitions.ts` | `allToolDefs` array and `getToolDefs()` filter function |
| `src/types/runner.types.ts` | `TAgentRunOpts` and `IAgentRunnerDB` interface definitions |
| `configs/agent.config.ts` | Logger configuration from environment variables |
| `configs/tsup.config.ts` | Build configuration — CJS output, external non-workspace deps |

## Architecture

### Component Hierarchy

```
TSAgent (sandbox lifecycle manager)
  ├─ sandboxProvider: ISandboxProvider (from @tdsk/sandbox)
  ├─ activeSandboxes: Map<string, ISandbox>
  └─ mutex: Mutex (concurrency control)

AgentRunner.run(opts) (main orchestration — static method)
  ├─ Mutex (per-threadId locking)
  ├─ IAgentRunnerDB (message persistence)
  ├─ LLM Adapter (streaming via async generator)
  │   ├─ AnthropicAdapter (@anthropic-ai/sdk native streaming)
  │   ├─ OpenAIAdapter → OpenAICompatibleAdapter (SSE fetch)
  │   ├─ GoogleAdapter (@google/genai streaming)
  │   ├─ ZaiAdapter → OpenAICompatibleAdapter (SSE fetch + thinking/web_search)
  │   └─ ProxyAdapter (backend /ai/chat SSE proxy)
  ├─ Tool Definitions (fs: 6, shell: 1, web: 1 = 8 total)
  └─ Sandbox (from @tdsk/sandbox — E2B or local)
```

### Adapter Inheritance

```
ILLMAdapter (interface from @tdsk/domain)
├── AnthropicAdapter (standalone — uses @anthropic-ai/sdk)
├── GoogleAdapter (standalone — uses @google/genai)
├── ProxyAdapter (standalone — SSE fetch to backend)
└── OpenAICompatibleAdapter (abstract base — raw SSE fetch)
    ├── OpenAIAdapter (base URL: api.openai.com/v1)
    └── ZaiAdapter (base URL: api.z.ai/api/paas/v4)
```

### Request Flow (AgentRunner.run)

```
AgentRunner.run(opts: TAgentRunOpts)
    ↓
1. Acquire mutex lock for threadId
    ↓
2. Load conversation history from DB (db.listMessages)
    ↓
3. Append user message to history + persist to DB
    ↓
4. Get tool definitions (getToolDefs, optionally filtered by opts.tools)
    ↓
5. Create LLM adapter (opts.adapter ?? createLLMAdapter(llmConfig.provider))
    ↓
6. Create sandbox if tool defs + sandboxConfig present
    ↓
7. Conversation loop (max opts.maxSteps iterations, default 10):
   ├─ Stream LLM response via adapter.stream(history, toolDefs, llmConfig)
   │   ├─ Yield text events → collect into assistantContent
   │   ├─ Yield tool_call_start → track pending tool calls
   │   ├─ Yield tool_call_args → accumulate args
   │   ├─ Yield done → check stopReason (tool_use = continue, else stop)
   │   └─ Yield error → stop loop
   ├─ Parse tool_use content blocks from pending tool calls
   ├─ Save assistant message to DB
   ├─ If tool calls + sandbox:
   │   ├─ Run each tool via AgentRunner.executeTool(sandbox, name, args)
   │   ├─ Emit toolResult events via onEvent
   │   └─ Append tool results as user message (Anthropic convention) + persist
   ├─ If tool calls but no sandbox → error, stop loop
   └─ If no tool calls → stop loop (natural completion)
    ↓
8. Cleanup: close sandbox, release mutex lock (in finally block)
```

### Tool Execution (AgentRunner.executeTool)

Maps tool names (from `EAgentTool` enum) to sandbox methods:

| Tool Name | Sandbox Method | Description |
|-----------|---------------|-------------|
| `shellExec` | `sandbox.exec(command, args)` | Run shell command |
| `readFile` | `sandbox.readFile(path)` | Read file contents |
| `writeFile` | `sandbox.writeFile(path, content)` | Write content to file |
| `listDir` | `sandbox.listDir(path)` | List directory entries |
| `deleteFile` | `sandbox.deleteFile(path)` | Delete a file |
| `mkdir` | `sandbox.mkdir(path)` | Create directory |
| `fileExists` | `sandbox.fileExists(path)` | Check if path exists |
| `webSearch` | (not implemented) | Returns stub error |

## Component Details

### 1. TSAgent (Sandbox Lifecycle Manager)

**File**: `src/tsagent.ts` (62 lines)

**Purpose**: Manages sandbox instances per session with concurrency control

**Constructor**:
```typescript
type TTSAgentOpts = {
  sandboxProvider: ISandboxProvider  // From @tdsk/sandbox
  mutex?: TMutexOpts                // Optional mutex config
}

const agent = new TSAgent({
  sandboxProvider: createSandboxProvider('local'),
  mutex: { maxLocks: 100, timeout: 30000 }
})
```

**Properties**:
- `mutex: Mutex` — Concurrency control instance
- `sandboxProvider: ISandboxProvider` — Factory for creating sandboxes (private)
- `activeSandboxes: Map<string, ISandbox>` — Active sandbox instances keyed by sessionId (private)

**Methods**:

| Method | Returns | Description |
|--------|---------|-------------|
| `createSandbox(sessionId, config)` | `Promise<ISandbox>` | Creates or returns existing sandbox for session |
| `getSandbox(sessionId)` | `Promise<ISandbox \| undefined>` | Retrieves active sandbox by session ID |
| `destroySandbox(sessionId)` | `Promise<void>` | Closes and removes sandbox (swallows errors) |
| `cleanup()` | `Promise<void>` | Closes all sandboxes and clears mutex locks |
| `getStats()` | `{ activeLocks, activeSandboxes }` | Returns current resource counts |

### 2. AgentRunner (ReAct Loop Orchestrator)

**File**: `src/runner/runner.ts` (279 lines)

**Purpose**: Core orchestration engine that runs a multi-step conversation loop with streaming LLM responses and tool execution

**API**: Static `run(opts: TAgentRunOpts): Promise<void>` method (no instantiation needed)

**Key Behaviors**:
- Acquires mutex per `threadId` to prevent concurrent thread access
- Loads existing conversation history from DB before each run
- Streams LLM responses via async generator (`adapter.stream()`)
- Collects tool calls during streaming, runs them in sandbox after stream completes
- Feeds tool results back to LLM as user messages (Anthropic convention)
- Repeats until LLM stops calling tools or `maxSteps` reached (default 10)
- Always cleans up sandbox and releases mutex in `finally` block

**TAgentRunOpts**:
```typescript
{
  agentId: string
  threadId: string
  prompt: string
  userId: string
  orgId: string
  db: IAgentRunnerDB           // Message persistence adapter
  llmConfig: TLLMAdapterConfig // Provider, model, apiKey, etc.
  sandboxConfig?: {            // Optional sandbox configuration
    provider: string
    apiKey?: string
    template?: string
    timeout?: number
    envVars?: Record<string, string>
  }
  tools?: string[]             // Allowed tool names (empty = all 8 tools)
  environment?: TAgentEnvironment
  maxSteps?: number            // Max conversation loop steps (default 10)
  adapter?: ILLMAdapter        // Pre-built adapter (e.g. ProxyAdapter). Falls back to factory
  onEvent: (event: TStreamEvent) => void  // Streaming event callback
}
```

**IAgentRunnerDB** (pluggable persistence interface):
```typescript
interface IAgentRunnerDB {
  listMessages(opts: {
    where: { threadId: string }
    limit: number
    offset: number
  }): Promise<{ data?: Array<{ type: string; content: TMessageContent[] }> }>

  createMessage(data: {
    threadId: string
    type: string
    content: TMessageContent[]
    orgId: string
  }): Promise<unknown>
}
```

Backend implements this via direct DB calls; REPL implements it via HTTP calls to the backend API.

### 3. LLM Adapter Factory

**File**: `src/llm/factory.ts`

**Purpose**: Creates LLM adapter instances by provider type

```typescript
const adapters = new Map<TLLMProviderType, () => ILLMAdapter>([
  ['zai',       () => new ZaiAdapter()],
  ['anthropic', () => new AnthropicAdapter()],
  ['openai',    () => new OpenAIAdapter()],
  ['google',    () => new GoogleAdapter()],
])

export const createLLMAdapter = (provider: TLLMProviderType): ILLMAdapter
// Throws: Error('Unknown LLM provider: ${provider}')
```

Note: `ProxyAdapter` is NOT in the factory -- it is always injected via `opts.adapter` because it requires constructor parameters (`backendUrl`, `sessionToken`, `provider`).

### 4. OpenAICompatibleAdapter (Abstract Base)

**File**: `src/llm/openai-compatible.ts` (257 lines)

**Purpose**: Abstract base class for all OpenAI-compatible LLM providers. Uses raw `fetch()` + SSE parsing (no SDK dependency).

**Abstract members**:
- `provider: TLLMProviderType` — Provider identifier
- `getBaseUrl(config): string` — Returns API base URL

**Protected methods (overridable)**:
- `getHeaders(config)` — Returns request headers. Default: `{ Content-Type: application/json, Authorization: Bearer ${config.apiKey}, ...config.headers }`
- `getExtraBody(config, tools)` — Returns extra body params. Default: `{}`
- `mapFinishReason(reason)` — Maps provider-specific finish reasons to `TStreamStopReason`. Default: `stop` -> `end_turn`, `tool_calls` -> `tool_use`, `length` -> `max_tokens`

**Streaming implementation**:
- POSTs to `${baseUrl}/chat/completions` with `stream: true`
- Reads response body as `ReadableStream<Uint8Array>`
- Parses SSE `data: ` lines, handles `[DONE]` sentinel
- Tracks tool calls by index in a `Map<number, { id, name, args }>`
- Yields unified `TStreamEvent` objects: `text`, `tool_call_start`, `tool_call_args`, `done`, `error`

**Message conversion helpers** (exported):
- `toOpenAIMessages(messages: TAIMessage[])` — Converts unified messages to OpenAI chat format
- `toOpenAITools(tools: TLLMToolDef[])` — Converts unified tool defs to OpenAI function calling format

**Request body construction**:
```typescript
body = {
  model: config.model,
  max_tokens: config.maxTokens ?? 4096,
  temperature: config.temperature,
  messages: toOpenAIMessages(messages),
  stream: true,
  ...config.bodyParams,    // User-specified body overrides
  ...extraBody,            // Subclass-specific params (e.g. ZAI thinking)
  tools: toOpenAITools(tools),  // Only if tools.length > 0 and extraBody doesn't set tools
}
```

### 5. AnthropicAdapter

**File**: `src/llm/anthropic.ts` (120 lines)

**Purpose**: Anthropic LLM adapter using native `@anthropic-ai/sdk` streaming

**Key differences from OpenAI-compatible**:
- Uses `client.messages.stream()` from the Anthropic SDK (not raw fetch)
- System prompt passed as separate `system` parameter (not in messages array)
- Handles `content_block_start` (tool_use detection), `content_block_delta` (text + input_json), `message_stop` events
- Supports `config.headers` via `defaultHeaders` on client
- Supports `config.bodyParams` spread into stream options

**Message conversion**:
- Filters out system messages (handled separately)
- Maps `tool_result` content blocks with `tool_use_id` and `is_error` fields
- Maps `tool_use` content blocks with `id`, `name`, `input` fields

### 6. OpenAIAdapter

**File**: `src/llm/openai.ts` (15 lines)

**Purpose**: Thin subclass of `OpenAICompatibleAdapter` for OpenAI API

```typescript
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  readonly provider = 'openai' as const
  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return 'https://api.openai.com/v1'
  }
}
```

Inherits all streaming, tool handling, and message conversion from the base class.

### 7. GoogleAdapter

**File**: `src/llm/google.ts` (156 lines)

**Purpose**: Google Gemini adapter using `@google/genai` SDK with lazy dynamic import

**Key details**:
- **Lazy loading**: `@google/genai` loaded via `await import('@google/genai')` to avoid CJS/ESM compatibility issues (p-retry dependency)
- Uses `client.models.generateContentStream()` for streaming
- System prompt passed via `config.systemInstruction`
- Supports `config.headers` via `httpOptions: { headers }`
- Supports `config.bodyParams` spread into config object
- Generates synthetic tool IDs (`tool_0`, `tool_1`, etc.)
- Maps `STOP` -> `end_turn`, `MAX_TOKENS` -> `max_tokens`

**Message conversion**:
- Role mapping: `assistant` -> `model`, `user` stays `user`
- `tool_use` -> `functionCall: { name, args }`
- `tool_result` -> `functionResponse: { name: toolUseId, response: { result: content } }`

### 8. ZaiAdapter

**File**: `src/llm/zai.ts` (79 lines)

**Purpose**: Z.AI (GLM models) adapter extending `OpenAICompatibleAdapter`

**Base URL**: `https://api.z.ai/api/paas/v4`

**Z.AI-specific features** (via `config.options` as `TZaiOptions`):
- `thinking: boolean` — Enables chain-of-thought mode with `budget_tokens`
- `thinkingBudget: number` — Token budget for thinking (default 2048)
- `doSample: boolean` — When `false`, enables greedy decoding
- `toolStream: boolean` — Enables streaming tool calls (GLM-4.6+)
- `webSearch: Record<string, unknown>` — Enables built-in web search tool

**Custom finish reasons**: Maps `sensitive` -> `error`, `network_error` -> `error`

### 9. ProxyAdapter

**File**: `src/llm/proxy.ts` (77 lines)

**Purpose**: Routes LLM calls through the backend's SSE proxy instead of calling providers directly

**Constructor**:
```typescript
new ProxyAdapter({
  backendUrl: string,      // Backend URL (e.g. 'https://px.local.threadedstack.app')
  sessionToken: string,    // Session token from POST /_/ai/sessions
  provider: TLLMProviderType
})
```

**How it works**:
- POSTs to `${backendUrl}/ai/chat` with `Authorization: Session ${token}`
- Body: `{ messages, tools }` (config handled server-side from cached session)
- Reads SSE response and yields pre-formed `TStreamEvent` objects (backend emits events in unified format)
- API key never leaves the backend -- the session token references a cached config with the decrypted key

### 10. Mutex (Concurrency Control)

**File**: `src/services/mutex.ts` (61 lines)

**Purpose**: Promise-based locking for serial execution per resource key

**Constructor**:
```typescript
new Mutex({ maxLocks?: number, timeout?: number })
// maxLocks default: 100, timeout default: 30000
```

**Methods**:
- `acquire(key: string): Promise<() => void>` — Returns release function. Chains promises so callers queue behind the current lock holder
- `getActiveLocks(): number` — Returns count of active locks
- `clearAll(): void` — Clears all locks (use with caution)

**Pattern**: Promise-chaining queue (not blocking the event loop):
```typescript
const currentLock = this.locks.get(key) || Promise.resolve()
const newLock = currentLock.then(() => new Promise(resolve => { releaseLock = resolve }))
this.locks.set(key, newLock)
await currentLock  // Wait for turn
return releaseLock
```

### 11. Tool Definitions

**Files**: `src/tools/definitions/`

**8 total tool definitions** organized by category:

**Filesystem tools** (`fs/fs.ts` — 6 tools):
| Tool | Parameters | Description |
|------|-----------|-------------|
| `readFile` | `path: string` | Read file contents |
| `writeFile` | `path: string, content: string` | Write content to file |
| `listDir` | `path: string` | List files and directories |
| `deleteFile` | `path: string` | Delete a file |
| `mkdir` | `path: string` | Create directory (recursive) |
| `fileExists` | `path: string` | Check if path exists |

**Shell tools** (`shell/definition.ts` — 1 tool):
| Tool | Parameters | Description |
|------|-----------|-------------|
| `shellExec` | `command: string, args?: string[]` | Run shell command |

**Web tools** (`web/web.ts` — 1 tool):
| Tool | Parameters | Description |
|------|-----------|-------------|
| `webSearch` | `query: string` | Search the web (stub -- not yet implemented) |

**API**:
- `allToolDefs: TLLMToolDef[]` — All 8 tool definitions
- `getToolDefs(allowedTools?: string[]): TLLMToolDef[]` — Filter by names (empty/undefined = all)

## Streaming Events

All adapters yield `TStreamEvent` objects (from `@tdsk/domain`):

| Event Type | Fields | When Emitted |
|-----------|--------|-------------|
| `text` | `text: string` | LLM generates text content |
| `tool_call_start` | `id: string, name: string` | LLM begins a tool call |
| `tool_call_args` | `id: string, args: string` | LLM streams tool call arguments (may be chunked) |
| `tool_result` | `toolUseId: string, content: string, isError: boolean` | Tool execution result (emitted by AgentRunner) |
| `done` | `stopReason: TStreamStopReason` | Stream complete. stopReason: `end_turn`, `tool_use`, `max_tokens`, `error` |
| `error` | `error: string` | Error occurred during streaming |

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.39.0 | Anthropic native SDK for streaming |
| `@google/genai` | ^1.0.0 | Google Gemini SDK (lazy-loaded) |
| `openai` | ^4.77.0 | OpenAI SDK (type reference only -- actual calls use raw fetch) |
| `events` | 3.3.0 | Node.js EventEmitter polyfill |
| `tsx` | 4.21.0 | TypeScript execution |

### Workspace Dependencies

| Package | Purpose |
|---------|---------|
| `@tdsk/sandbox` | Sandbox execution (E2B + local providers) |
| `@tdsk/domain` | Shared types: ILLMAdapter, TStreamEvent, TLLMToolDef, TAIMessage, ISandbox, etc. |
| `@tdsk/database` | Database types (workspace dep) |
| `@tdsk/logger` | Winston logger via `buildApiLogger()` |

### Utility Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@keg-hub/jsutils` | ^10.0.0 | General utilities (`toBool`) |
| `@keg-hub/parse-config` | 2.1.0 | Environment variable loading from YAML |
| `alias-hq` | 6.2.2 | Path alias resolution |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@biomejs/biome` | 2.1.2 | Linting and formatting |
| `tsup` | 8.3.0 | TypeScript bundler (CJS output) |
| `typescript` | 5.7.3 | Type checking |
| `vitest` | 1.6.1 | Test framework |
| `vite-tsconfig-paths` | 4.3.2 | Path alias resolution in tests |

## Commands

### Development

```bash
pnpm start           # Build + watch mode (tsup watch)
                     # Watches: src, configs, domain, logger, database, sandbox
                     # On success: runs `pnpm serve` (node dist/index.cjs)
```

### Building

```bash
pnpm build           # Single-step CJS build via tsup-node
                     # Output: dist/index.cjs (with source maps)
pnpm clean           # Remove dist/
pnpm clean:nm        # Remove node_modules/
pnpm clean:full      # Remove both dist/ and node_modules/
```

### Testing

```bash
pnpm test            # Run vitest (206 tests, 13 files)
```

### Commands Notes

* Linting and formatting run automatically via Biome -- `pnpm lint` and `pnpm format` should be ignored.
* No WASM build step. Single `pnpm build` produces CJS bundle.
* `@tdsk/sandbox` and `@tdsk/domain` are bundled into the output (not external). Only non-workspace, non-keg-hub packages are externalized.

## Testing

### Current Coverage (206 tests, 13 files -- all passing)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/index.test.ts` | 6 | Module exports verification |
| `src/tsagent.test.ts` | 14 | TSAgent: createSandbox, getSandbox, destroySandbox, cleanup, getStats |
| `src/llm/anthropic.test.ts` | 22 | AnthropicAdapter: streaming, tool calls, system prompt, message conversion |
| `src/llm/openai.test.ts` | 18 | OpenAIAdapter: streaming, tool calls, error handling |
| `src/llm/openai-compatible.test.ts` | 29 | Base class: SSE parsing, tool call tracking, finish reasons, message/tool conversion |
| `src/llm/google.test.ts` | 29 | GoogleAdapter: lazy import, streaming, tool calls, content conversion |
| `src/llm/zai.test.ts` | 17 | ZaiAdapter: thinking mode, do_sample, tool_stream, web_search, custom finish reasons |
| `src/llm/proxy.test.ts` | 7 | ProxyAdapter: SSE relay, session auth, error handling |
| `src/llm/factory.test.ts` | 7 | Factory: adapter creation, unknown provider error, fresh instances |
| `src/runner/runner.test.ts` | 21 | AgentRunner: ReAct loop, tool execution, mutex, error handling, max steps |
| `src/services/mutex.test.ts` | 15 | Mutex: acquire/release, queuing, getActiveLocks, clearAll |
| `src/tools/definitions.test.ts` | 12 | Tool definitions: getToolDefs filtering, allToolDefs content |
| `src/tools/definitions/definitions.test.ts` | 9 | Individual tool def validation: schemas, required fields |

**Testing strategy**:
- All external SDKs mocked (`@anthropic-ai/sdk`, `@google/genai`, `fetch`)
- Vitest with Node.js environment
- Co-located test files (`.test.ts` adjacent to source)
- Globals enabled (`describe`, `it`, `expect` without imports)

## Key Patterns

### 1. Streaming-First via Async Generators

All LLM adapters implement `ILLMAdapter.stream()` as an `AsyncIterable<TStreamEvent>`:

```typescript
for await (const event of adapter.stream(history, toolDefs, config)) {
  if (event.type === 'text') { /* handle text chunk */ }
  if (event.type === 'tool_call_start') { /* track new tool call */ }
  // ...
}
```

### 2. Unified Message Format

All adapters convert between the unified `TAIMessage` format (from `@tdsk/domain`) and provider-specific formats. Conversion happens at adapter boundaries:
- `toOpenAIMessages()` / `toOpenAITools()` — OpenAI-compatible providers
- `toAnthropicMessages()` / `toAnthropicTools()` — Anthropic
- `toGoogleContents()` / `toGoogleTools()` — Google Gemini

### 3. Factory + Strategy Pattern

Provider selection via Map-based factory, each adapter implementing the same `ILLMAdapter` interface:

```typescript
const adapter = createLLMAdapter('anthropic')  // or 'openai', 'google', 'zai'
// ProxyAdapter injected directly via opts.adapter (not from factory)
```

### 4. Pluggable Persistence (IAgentRunnerDB)

AgentRunner accepts a narrow DB interface rather than depending on the full database package. This allows:
- Backend: passes direct DB service calls
- REPL: passes HTTP client that calls backend API

### 5. Tool Call Accumulation Pattern

During streaming, tool calls arrive in chunks. The runner accumulates them:

```typescript
const pendingToolCalls: Array<{ id, name, args }> = []

// During streaming:
if (event.type === 'tool_call_start') {
  pendingToolCalls.push({ id: event.id, name: event.name, args: '' })
}
if (event.type === 'tool_call_args') {
  const tc = pendingToolCalls.find(t => t.id === event.id)
  if (tc) tc.args += event.args  // Accumulate JSON fragments
}

// After streaming: parse accumulated args, run in sandbox
```

### 6. Mutex-Protected Threads

Every `AgentRunner.run()` call acquires a mutex keyed by `threadId`, preventing concurrent modifications to the same conversation thread:

```typescript
const releaseLock = await mutex.acquire(threadId)
try {
  // ... entire conversation loop
} finally {
  releaseLock()
}
```

### 7. Lazy SDK Loading

GoogleAdapter uses dynamic `import()` to load `@google/genai` only when first used, avoiding CJS/ESM compatibility issues at import time:

```typescript
const loadGoogleGenAI = async () => {
  const mod = await import('@google/genai')
  return mod.GoogleGenAI
}
```

## Configuration

### Agent Config (`configs/agent.config.ts`)

Loads environment variables and configures logger:

```typescript
export const config = {
  logger: {
    label: 'TDSK - Agent',
    level: TDSK_AG_LOG_LEVEL ?? TDSK_LOG_LEVEL,
    pretty: toBool(TDSK_BE_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_AG_LOGGER_SILENT) ?? false,
    exceptions: true,
    rejections: true,
    exitOnError: false,
  }
}
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `TDSK_AG_LOG_LEVEL` | Agent-specific log level | Falls back to `TDSK_LOG_LEVEL` |
| `TDSK_LOG_LEVEL` | Global log level | - |
| `TDSK_BE_LOGGER_PRETTY` | Pretty-printed logs | `false` |
| `TDSK_AG_LOGGER_SILENT` | Disable all agent logging | `false` |
| `NODE_ENV` | Runtime environment | `local` |

### Build Config (`configs/tsup.config.ts`)

- **Format**: CJS only (`format: ['cjs']`)
- **Output**: `dist/index.cjs` with source maps
- **Externals**: All non-workspace, non-keg-hub packages (SDK packages like `@anthropic-ai/sdk` are external)
- **No externals for**: `@tdsk/*` and `@keg-hub/*` packages (bundled into output)
- **Source maps**: Enabled
- **Splitting**: Disabled

## Path Aliases

**Configured in**: `tsconfig.json` + `configs/aliases.ts`

```typescript
@TAG/*              → repos/agent/src/*         // Agent internal imports
@TAG/configs/*      → repos/agent/configs/*     // Agent config files
@TSB/*              → repos/sandbox/src/*       // Sandbox imports
@tdsk/sandbox       → repos/sandbox/src         // Sandbox package
@TDM/*              → repos/domain/src/*        // Domain imports
@tdsk/domain        → repos/domain/src          // Domain package
@TDB/*              → repos/database/src/*      // Database imports
@tdsk/database      → repos/database/src        // Database package
@tdsk/logger        → repos/logger/src          // Logger package
@ROOT               → ../../                    // Monorepo root
```

**Example Usage**:
```typescript
import type { TAgentRunOpts } from '@TAG/types'
import { Mutex } from '@TAG/services/mutex'
import { createLLMAdapter } from '@TAG/llm/factory'
import { buildApiLogger } from '@tdsk/logger'
import { createSandboxProvider } from '@tdsk/sandbox'
import { EContentType, EStreamEventType } from '@tdsk/domain'
```

## Integration Points

### With Backend (`@tdsk/backend`)

- Backend's `runAgent` endpoint calls `AgentRunner.run()` with direct DB service as `IAgentRunnerDB`
- Backend's `chatProxy` endpoint uses `createLLMAdapter()` to stream LLM responses via SSE
- Backend's `sessionStore` caches LLM config; `ProxyAdapter` uses session tokens to access it

### With Sandbox (`@tdsk/sandbox`)

- AgentRunner creates sandbox via `createSandboxProvider(type).create(config)`
- Tool execution maps tool names to `ISandbox` methods (readFile, writeFile, listDir, etc.)
- Sandbox is created per-run and closed in the `finally` block

### With Domain (`@tdsk/domain`)

- `ILLMAdapter` — LLM adapter interface (stream method signature)
- `TStreamEvent` — Unified streaming event type
- `TLLMToolDef` — Tool definition schema
- `TAIMessage` / `TMessageContent` — Message format types
- `TLLMAdapterConfig` — Provider config (apiKey, model, temperature, headers, bodyParams, etc.)
- `TLLMProviderType` — Provider type union
- `ISandbox` / `ISandboxProvider` / `TSandboxConfig` — Sandbox interfaces
- `EContentType` — Content type enum (text, tool_use, tool_result)
- `EStreamEventType` — Event type enum (text, tool_call_start, tool_call_args, done, error, tool_result)
- `EAgentTool` — Tool name enum (shellExec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, webSearch)

### With REPL (`@tdsk/repl`)

- REPL's `LocalAgentExecutor` calls `AgentRunner.run()` with HTTP-based `IAgentRunnerDB`
- REPL uses `ProxyAdapter` to route LLM calls through the backend proxy (API key stays server-side)

### With Logger (`@tdsk/logger`)

- `buildApiLogger()` creates Winston logger with configured label and level
- Used in `runner.ts` for error logging and in `google.ts` for SDK loading diagnostics

## Development Guidelines

### Adding a New LLM Adapter

1. **For OpenAI-compatible APIs**: Extend `OpenAICompatibleAdapter`:
   ```typescript
   export class MyAdapter extends OpenAICompatibleAdapter {
     readonly provider = 'myProvider' as const
     protected getBaseUrl(config): string { return 'https://api.myprovider.com/v1' }
     // Optionally override: getHeaders, getExtraBody, mapFinishReason
   }
   ```

2. **For non-OpenAI APIs**: Implement `ILLMAdapter` directly (like `AnthropicAdapter` or `GoogleAdapter`)

3. **Register in factory** (`src/llm/factory.ts`):
   ```typescript
   adapters.set('myProvider', () => new MyAdapter())
   ```

4. **Add `TLLMProviderType` union member** in `@tdsk/domain`

5. **Export from barrel** (`src/llm/index.ts`)

6. **Write tests** (co-located `.test.ts` file)

### Adding a New Tool

1. **Define tool schema** in `src/tools/definitions/` (new file or add to existing category)

2. **Export from definitions barrel** (`definitions.ts`):
   ```typescript
   export const allToolDefs = [...fsTools, ...shellTools, ...webTools, ...myTools]
   ```

3. **Add handler** in `AgentRunner.executeTool()` switch statement

4. **Add to `EAgentTool` enum** in `@tdsk/domain`

### Testing Patterns

```typescript
// Mock LLM adapter for runner tests
const mockAdapter: ILLMAdapter = {
  provider: 'openai',
  async *stream() {
    yield { type: 'text', text: 'Hello' }
    yield { type: 'done', stopReason: 'end_turn' }
  }
}

// Mock sandbox for tool execution tests
const mockSandbox: ISandbox = {
  exec: vi.fn().mockResolvedValue({ success: true, output: 'result' }),
  readFile: vi.fn().mockResolvedValue('file content'),
  // ...
}

// Mock DB for runner tests
const mockDb: IAgentRunnerDB = {
  listMessages: vi.fn().mockResolvedValue({ data: [] }),
  createMessage: vi.fn().mockResolvedValue({}),
}
```

---

**Last Updated**: 2026-02-15
**Version**: 2.0.0

### Changelog

#### v2.0.0 (2026-02-15)
- **Breaking**: Complete architecture rewrite from WASM-based to headless LLM orchestration
- **Removed**: All WASM infrastructure (componentize-js, jco, preview2-shim, WIT files, build pipeline)
- **Removed**: Executor service (command allowlist/blocklist)
- **Removed**: WasmBridge (VFS mounting, import objects)
- **Removed**: Guest-side code (agent.ts, context.ts, provider.ts, sandbox.ts)
- **New**: AgentRunner — static ReAct loop orchestrator with streaming (279 lines, 21 tests)
- **New**: LLM adapter layer with 5 providers:
  - AnthropicAdapter — native `@anthropic-ai/sdk` streaming (22 tests)
  - OpenAIAdapter — extends OpenAICompatibleAdapter (18 tests)
  - OpenAICompatibleAdapter — abstract base with SSE parsing (29 tests)
  - GoogleAdapter — `@google/genai` with lazy import (29 tests)
  - ZaiAdapter — GLM models with thinking/web_search (17 tests)
  - ProxyAdapter — backend SSE relay (7 tests)
- **New**: Factory pattern for adapter creation (7 tests)
- **New**: TSAgent class — sandbox lifecycle manager (62 lines, 14 tests)
- **New**: 8 tool definitions (fs: 6, shell: 1, web: 1) with filtering
- **New**: IAgentRunnerDB — pluggable persistence interface (backend DB or REPL HTTP)
- **Changed**: Sandbox execution delegated to `@tdsk/sandbox` package (extracted from agent)
- **Changed**: Build simplified to single-step CJS via tsup (no WASM compilation)
- **Dependencies**: Added `@anthropic-ai/sdk`, `@google/genai`, `openai`, `@tdsk/sandbox`
- **Dependencies**: Removed `@bytecodealliance/*` packages
- **Testing**: 206/206 tests passing across 13 test files

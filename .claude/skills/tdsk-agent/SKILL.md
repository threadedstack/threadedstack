---
name: "tdsk-agent"
description: "Knowledge base for the headless AI agent orchestration library"
tags: ["ai-agent", "llm", "streaming", "multi-turn", "tool-execution", "sandbox", "typescript"]
---
# Agent Repo Skill

## Overview

The **Agent** repo (`repos/agent`, `@tdsk/agent`) is a headless AI agent orchestration library that provides persistent multi-turn agent sessions with streaming LLM integration, automatic context management, and sandbox-based tool execution. It acts as the runtime brain for Threaded Stack's AI agent system.

**Key Characteristics:**
- **Type**: Headless AI Agent Library (no server, no WASM)
- **Tech Stack**: TypeScript, streaming SSE/WebSocket, pi-mono Agent framework
- **Architecture**: Instance-based `AgentRunner` with `init()` / `runTurn()` / `updateConfig()` / `destroy()` lifecycle, wrapping pi-mono's `Agent` class for multi-turn ReAct loops with streaming and sandbox execution
- **LLM Support**: All providers supported by pi-mono (`@mariozechner/pi-ai`) -- Anthropic, OpenAI, Google, etc. via `getModel()`
- **Context Management**: Automatic context window management with prune/compact strategies via `createContextManager()`
- **Thinking Support**: Extended thinking via `thinkingLevel` config and `thinking_delta` streaming events
- **Custom Messages**: Declaration merging with pi-agent-core for custom roles (artifact, notification, systemEvent) filtered before LLM calls
- **Sandbox**: Delegates to `@tdsk/sandbox` for isolated code/shell execution (E2B, K8s, or local)
- **Web Tools**: `webSearch` + `webFetch` backed by pluggable `IWebProvider` (Jina implementation)
- **Build**: Single-step CJS bundle via tsup (no WASM compilation)
- **Total LOC**: ~7,197 across all TS files (12 test files)

**Key Problem Solved**: Provides a unified, streaming-first interface for running persistent multi-turn AI agents across multiple LLM providers, with automatic tool call detection, per-turn skill resolution, transient error retries, context overflow detection, sandbox execution, custom function support, image/file attachments, and conversation history management.

## Directory Structure

```
repos/agent/
├── package.json
├── configs/
│   ├── agent.config.ts             # Logger + env config
│   ├── aliases.ts                  # Path aliases (@TAG/*)
│   ├── tsup.config.ts              # CJS build, externals
│   └── vitest.config.ts            # Vitest test runner config
└── src/
    ├── index.ts                    # Re-exports: types, tools, utils, runner, adapters
    ├── index.test.ts               # Barrel export tests
    ├── adapters/
    │   ├── index.ts                # Re-exports eventBridge + messageConverter
    │   ├── eventBridge.ts          # mapAgentEvent() — pi-mono AgentEvent to TStreamEvent (incl. turnEnd with usage/cost)
    │   ├── eventBridge.test.ts     # Event bridge mapping tests
    │   ├── messageConverter.ts     # convertToLlmMessages(), convertAssistantToContent(), convertToolResultToContent()
    │   └── messageConverter.test.ts # Message converter tests (incl. image/file/thinking)
    ├── runner/
    │   ├── index.ts                # Re-exports runner
    │   ├── runner.ts               # AgentRunner — instance-based with init/runTurn/updateConfig/destroy + static run()
    │   └── runner.test.ts          # Runner lifecycle + turn tests
    ├── tools/
    │   ├── index.ts                # Re-exports tools + definitions
    │   ├── tools.ts                # createSandboxTools(), createWebTools(), buildCustomFunctionTools()
    │   ├── tools.test.ts           # Sandbox + web + custom function tool tests
    │   ├── definitions.test.ts     # Definition aggregation tests
    │   └── definitions/
    │       ├── index.ts            # Re-exports all definitions
    │       ├── definitions.ts      # allToolDefs, getToolDefs(), buildFunctionToolDefs()
    │       ├── definitions.test.ts # Definition filtering tests
    │       ├── fs/
    │       │   ├── index.ts
    │       │   └── fs.ts           # readFile, writeFile, listDir, deleteFile, mkdir, fileExists
    │       ├── shell/
    │       │   ├── index.ts
    │       │   └── definition.ts   # shellExec
    │       ├── code/
    │       │   ├── index.ts
    │       │   └── code.ts         # evalCode (V8 sandbox)
    │       └── web/
    │           ├── index.ts
    │           ├── web.ts              # webSearch, webFetch (static TLLMToolDef)
    │           ├── webProvider.ts       # createWebProvider() factory
    │           ├── webProvider.test.ts  # Factory tests
    │           ├── jinaWebProvider.ts   # JinaWebProvider — IWebProvider implementation
    │           ├── jinaWebProvider.test.ts # Jina search/fetch/URL validation tests
    │           └── jinaValues.ts       # Jina constants (URLs, timeouts, blocked hosts)
    ├── types/
    │   ├── index.ts                # Re-exports + imports customMessages
    │   ├── runner.types.ts         # TAgentInitOpts, TAgentTurnOpts, TAgentConfig, TAgentHandle, TAgentRunOpts, IAgentRunnerDB
    │   ├── web.types.ts            # IWebProvider, TSearchResult, TFetchResult, TJina* types
    │   └── customMessages.ts       # Declaration merging: artifact, notification, systemEvent roles
    └── utils/
        ├── index.ts                # Re-exports
        ├── logger.ts               # buildApiLogger wrapper
        ├── paths.ts                # alias-hq path resolution
        ├── skillResolver.ts        # resolveActiveSkills() — keyword-triggered per-turn skill activation
        ├── skillResolver.test.ts   # Skill resolution tests
        ├── contextManager.ts       # createContextManager() — auto context window management (prune/compact)
        ├── contextManager.test.ts  # Context manager tests
        ├── errorClassifier.ts      # isTransientError() — regex-based transient error detection
        └── errorClassifier.test.ts # Error classifier tests
```

## Architecture

### Component Hierarchy

```
AgentRunner (persistent agent session — instance-based)
  ├─ init(opts: TAgentInitOpts) — creates sandbox, tools, loads history, creates Agent
  ├─ runTurn(opts: TAgentTurnOpts) — prompts agent, persists messages, returns handle
  ├─ updateConfig(config: TAgentConfig) — hot-swap model/systemPrompt/tools/thinkingLevel
  ├─ destroy() — cleanup sandbox, subscriptions, agent
  └─ static run(opts: TAgentRunOpts) — one-shot init+runTurn+auto-destroy (SSE compat)
      │
      ├─ pi-mono Agent (from @mariozechner/pi-agent-core)
      │   ├─ Model selection via getModel() (from @mariozechner/pi-ai)
      │   ├─ streamFn: StreamFn wrapping streamSimple() with temperature/maxTokens/headers/cacheRetention
      │   ├─ transformContext: auto context window manager (prune or compact strategy)
      │   ├─ convertToLlm: filterCustomMessages — strips artifact/notification/systemEvent before LLM calls
      │   ├─ getApiKey: optional () => string
      │   └─ thinkingLevel + thinkingBudgets support
      ├─ IAgentRunnerDB (message persistence — queued, drained after turn)
      ├─ Event Bridge (mapAgentEvent: AgentEvent → TStreamEvent, incl. turnEnd with usage/cost)
      ├─ Message Converter (ThreadedStack ↔ pi-mono formats, incl. images/files/thinking)
      ├─ Skill Resolver (resolveActiveSkills — per-turn keyword activation)
      ├─ Error Classifier (isTransientError — retry loop for rate limits, timeouts, 5xx)
      ├─ Context Manager (createContextManager — prune oldest or LLM-compact strategy)
      ├─ Sandbox Tools (AgentTool[] backed by ISandbox — 9 tools incl. evalCode + createArtifact)
      ├─ Web Tools (AgentTool[] backed by IWebProvider — webSearch + webFetch)
      ├─ Custom Function Tools (AgentTool[] from FunctionModel[])
      └─ Sandbox (from @tdsk/sandbox — E2B, K8s, or local)
```

### AgentRunner Lifecycle

```
Instance mode (multi-turn sessions):
  const runner = new AgentRunner()
  await runner.init(initOpts)           ← creates sandbox, loads history, builds Agent
  const handle1 = await runner.runTurn({ prompt: "..." })  ← turn 1
  await handle1.waitForIdle()
  runner.updateConfig({ model: "..." }) ← hot-swap between turns
  const handle2 = await runner.runTurn({ prompt: "..." })  ← turn 2
  await handle2.waitForIdle()
  await runner.destroy()                ← cleanup

Static mode (one-shot, SSE endpoint):
  const handle = await AgentRunner.run({ ...initOpts, prompt: "...", signal })
  await handle.waitForIdle()            ← auto-destroys on completion
```

### runTurn Flow

```
runner.runTurn(opts: TAgentTurnOpts)
    |
1. Resolve active skills for this turn (keyword matching)
   → Update system prompt + merge skill-injected tools
    |
2. Wire abort signal (AbortSignal → agent.abort())
    |
3. Build user content (text + images + files) and persist to DB
    |
4. Build pi-mono ImageContent[] from images + file image data
    |
5. Build full prompt (prepend file extracted text)
    |
6. Start agent loop (non-blocking Promise):
   ├─ agent.prompt(fullPrompt, imageContents)
   ├─ agent.waitForIdle()
   ├─ Transient retry loop (rate limits, timeouts, 5xx)
   │   └─ isTransientError() check → delay → agent.continue()
   ├─ Context overflow detection (isContextOverflow)
   └─ Drain pending persistence queue
    |
7. Return TAgentHandle { steer, followUp, abort, waitForIdle }
```

### init Flow

```
runner.init(opts: TAgentInitOpts)
    |
1. Load conversation history from DB (db.listMessages)
    |
2. Create sandbox + tools if sandboxConfig present
    |
3. Create web provider (IWebProvider) from environment config
    |
4. Build all tools (sandbox + web + custom function)
    |
5. Create pi-mono model via getModel() with buildFallbackModel() fallback
    |
6. Convert history to pi-mono Messages (using current model's api/provider)
    |
7. Build streamFn wrapper (streamSimple + temperature/maxTokens/headers/cacheRetention)
    |
8. Build context manager (prune or compact strategy based on environment config)
    |
9. Create pi-mono Agent with initialState, streamFn, transformContext, convertToLlm,
   thinkingLevel, thinkingBudgets
    |
10. Subscribe to agent events:
    ├─ Map each AgentEvent to TStreamEvent via mapAgentEvent()
    ├─ Forward to opts.onEvent() for WebSocket/SSE output
    └─ On turn_end: queue assistant message + tool results to persistence queue
```

### Event Bridge (AgentEvent to TStreamEvent)

Maps pi-mono `AgentEvent` types to ThreadedStack `TStreamEvent`:

| pi-mono Event | Sub-type | TStreamEvent |
|--------------|----------|--------------|
| `message_update` | `text_delta` | `{ type: 'text', text }` |
| `message_update` | `thinking_delta` | `{ type: 'thinking', thinking }` |
| `message_update` | `toolcall_start` | `{ type: 'tool_call_start', id, name }` |
| `message_update` | `toolcall_delta` | `{ type: 'tool_call_args', id, args }` |
| `message_update` | `done` | `{ type: 'done', stopReason }` |
| `message_update` | `error` | `{ type: 'error', error }` |
| `tool_execution_update` | -- | `{ type: 'tool_execution_update', toolUseId, content }` |
| `tool_execution_end` | -- | `{ type: 'tool_result', toolUseId, content, isError }` |
| `turn_end` | -- | `{ type: 'turnEnd', usage: { input, output, cacheRead, cacheWrite, cost } }` |
| `agent_end` | -- | `{ type: 'done', stopReason: 'end_turn' }` |
| `agent_start`, `turn_start`, `message_start/end`, `tool_execution_start` | -- | `undefined` (not forwarded) |

Token usage on `turnEnd` includes cost calculation via pi-mono's `calculateCost()`.

### Message Converter

Bidirectional conversion between ThreadedStack `TMessageContent[]` and pi-mono `Message[]`:

**ThreadedStack to pi-mono** (`convertToLlmMessages`):
- User text → `UserMessage` (string content)
- User text + images/files → `UserMessage` (array content with `TextContent` + `ImageContent`)
- User tool_result → `ToolResultMessage` (each tool_result block becomes separate message)
- Assistant text/thinking/toolCall → `AssistantMessage` (with `api`, `provider`, `model` from defaults param)
- System messages: skipped (handled via systemPrompt)
- File blocks with `extractedText` → `TextContent` with `[Attached file: ...]` wrapper

**pi-mono to ThreadedStack** (`convertAssistantToContent`, `convertToolResultToContent`):
- `AssistantMessage` text/thinking/toolCall → `TTextContent` / `TThinkingContent` / `TToolUseContent`
- `ToolResultMessage` → `TToolResultContent`

### Custom Messages (Declaration Merging)

**File**: `src/types/customMessages.ts`

Augments pi-agent-core's `CustomAgentMessages` interface to add three custom roles:

| Role | Fields | Purpose |
|------|--------|---------|
| `artifact` | `content`, `mimeType`, `title`, `timestamp` | Renderable artifact (HTML/SVG/code/etc.) |
| `notification` | `text`, `level` (info/warn/error), `timestamp` | System notifications |
| `systemEvent` | `event`, `data`, `timestamp` | Internal system events |

These messages are stored in the agent's message history but **filtered out** by `convertToLlm` (the `filterCustomMessages` function) before LLM API calls. This keeps custom state in the conversation without confusing the model.

## Component Details

### 1. AgentRunner (Persistent Multi-Turn Agent Session)

**File**: `src/runner/runner.ts`

Instance-based agent runner wrapping pi-mono's `Agent` class with DB persistence, event bridging, per-turn skill resolution, transient error retries, context management, and sandbox integration.

**Instance methods**:
- `init(opts: TAgentInitOpts)` — creates sandbox, tools, loads history, builds pi-mono Agent
- `runTurn(opts: TAgentTurnOpts)` — saves user message, prompts agent, returns `TAgentHandle`
- `updateConfig(config: TAgentConfig)` — hot-swaps model/systemPrompt/tools/thinkingLevel between turns
- `destroy()` — cleans up sandbox, subscriptions, drains persistence queue

**Static convenience**:
- `AgentRunner.run(opts: TAgentRunOpts)` — one-shot init+runTurn+auto-destroy (backward compat for SSE endpoints)

**TAgentInitOpts** (session setup):
```typescript
{
  agentId: string
  threadId: string
  userId: string
  orgId: string
  db: IAgentRunnerDB                   // Message persistence adapter
  llmConfig: TLLMAdapterConfig         // Provider, model, apiKey, systemPrompt, temperature, maxTokens, headers
  sandboxConfig?: {                    // Optional sandbox
    provider: string
    timeout?: number                   // Default: 300000 (5 min)
    envVars?: Record<string, string>
    options?: Record<string, unknown>  // e.g. { podName } for K8s
  }
  tools?: string[]                     // Allowed tool names (empty = all)
  environment?: TAgentEnvironment      // thinkingLevel, thinkingBudgets, contextBudgetPercent, contextCompaction, webProvider, maxRetries, cacheRetention
  onEvent: (event: TStreamEvent) => void  // Streaming event callback
  customFunctions?: FunctionModel[]       // User-defined function tools
  onExecuteFunction?: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
  skills?: Skill[]                        // Dynamic skill definitions for per-turn resolution
}
```

**TAgentTurnOpts** (per-turn input):
```typescript
{
  prompt: string
  images?: TImageAttachment[]    // Image data + mimeType (vision models)
  files?: TFileAttachment[]      // File references with extractedText + optional imageData
  signal?: AbortSignal           // Abort signal for this turn
}
```

**TAgentConfig** (runtime-updatable between turns):
```typescript
{
  model?: string
  provider?: string
  systemPrompt?: string
  thinkingLevel?: string
  tools?: string[]
}
```

**TAgentHandle** (returned by runTurn):
```typescript
{
  steer: (message: string) => void    // Inject user message during agent execution
  followUp: (message: string) => void // Queue follow-up prompt
  abort: () => void                   // Cancel current turn
  waitForIdle: () => Promise<void>    // Wait for turn completion
}
```

**TAgentRunOpts** (one-shot mode):
```typescript
TAgentInitOpts & TAgentTurnOpts & { maxSteps?: number }
```

**IAgentRunnerDB** (pluggable persistence interface):
```typescript
interface IAgentRunnerDB {
  listMessages(opts: {
    where: { threadId: string }
    limit: number
    offset: number
  }): Promise<{ data?: Array<{ type: string; content: TMessageContent[]; createdAt?: string | Date }> }>

  createMessage(data: {
    threadId: string
    type: string
    content: TMessageContent[]
    orgId: string
  }): Promise<unknown>
}
```

Backend implements this via direct DB calls; TSA delegates all persistence to the backend API.

### 2. Context Manager (Automatic Context Window Management)

**File**: `src/utils/contextManager.ts`

Creates a `transformContext` function for pi-mono's Agent that keeps messages within a percentage of the model's context window.

```typescript
const transformContext = createContextManager(model, budgetPercent, compactionOpts?)
```

**Parameters**:
- `model: Model<Api>` — pi-mono model (provides `contextWindow` token count)
- `budgetPercent: number` — percentage of context window to use (default: 80)
- `compactionOpts?: TCompactionOpts` — optional compact strategy config

**TCompactionOpts**:
```typescript
{
  strategy: 'prune' | 'compact'
  streamFn?: StreamFn              // Required for compact strategy
  compactionModel?: string         // Optional model override for summarization
}
```

**Strategies**:
- **prune** (default): Keeps first 2 messages (anchors) + as many recent messages as fit the budget. Walks backward from most recent.
- **compact**: Splits messages into old (to summarize) and recent (to keep verbatim). Reserves ~20% of budget for summary. Summarizes old messages via LLM using the same `streamFn`. Falls back to prune on failure.

**Token estimation**: ~4 characters per token heuristic. Tool calls estimated at 100 tokens overhead, unknown shapes at 50 tokens.

### 3. Skill Resolver (Per-Turn Skill Activation)

**File**: `src/utils/skillResolver.ts`

Resolves which skills are active for the current turn's prompt, then injects their instructions into the system prompt and merges their tools.

```typescript
const resolved = resolveActiveSkills(skills, prompt)
// resolved.instructions — "\n\n# Active Skills\n\n## SkillName\n..."
// resolved.tools — string[] of tool names to merge
// resolved.activeSkills — Skill[] that matched
```

**Activation rules**:
- `alwaysActive: true` — always included
- `triggerKeywords` — case-insensitive substring match against prompt

### 4. Error Classifier (Transient Error Detection)

**File**: `src/utils/errorClassifier.ts`

Regex-based classification for retryable errors. Used by the transient retry loop in `runTurn()`.

```typescript
isTransientError(errorMessage: string): boolean
```

**Matches**: rate limit, 429, 502/503, timeout, ECONNRESET, ECONNREFUSED, ETIMEDOUT, ENETUNREACH, socket hang up, network error, overloaded, service unavailable, internal server error, retry after/please retry.

The retry loop in `runTurn()` retries up to `maxRetries` (default: 2) with exponential backoff (1s * attempt) using `agent.continue()`.

### 5. Sandbox Tools (createSandboxTools)

**File**: `src/tools/tools.ts`

Creates pi-mono `AgentTool[]` definitions backed by an ISandbox instance.

```typescript
const tools = createSandboxTools(sandbox, allowedTools?)
// Returns AgentTool[] (9 tools, or filtered subset)
```

**9 sandbox tools** (each calls `onUpdate()` for progress streaming):

| Tool Name | Sandbox Method | Description |
|-----------|---------------|-------------|
| `shellExec` | `sandbox.exec(command, args)` | Run shell command |
| `readFile` | `sandbox.readFile(path)` | Read file contents |
| `writeFile` | `sandbox.writeFile(path, content)` | Write content to file |
| `listDir` | `sandbox.listDir(path)` | List directory entries |
| `deleteFile` | `sandbox.deleteFile(path)` | Delete a file |
| `mkdir` | `sandbox.mkdir(path)` | Create directory |
| `fileExists` | `sandbox.fileExists(path)` | Check if path exists |
| `evalCode` | `sandbox.evaluate(code, { timeout })` | Evaluate JS in isolated V8 sandbox |
| `createArtifact` | (no sandbox call) | Create renderable artifact (HTML/SVG/Markdown/code/JSON/CSV/YAML/XML/Mermaid/LaTeX/image/table/diff/plaintext) |

Tools use TypeBox (`Type.Object`, `Type.String`, etc.) from `@mariozechner/pi-ai` for parameter schemas.

### 6. Web Tools (createWebTools)

**File**: `src/tools/tools.ts`

Creates web tool definitions independent of any sandbox. Requires an `IWebProvider` instance.

```typescript
const tools = createWebTools(webProvider?, allowedTools?)
```

**2 web tools**:

| Tool Name | Provider Method | Description |
|-----------|----------------|-------------|
| `webSearch` | `webProvider.search(query, maxResults)` | Search web, returns titles/URLs/snippets |
| `webFetch` | `webProvider.fetch(url, { maxLength })` | Fetch URL content as cleaned markdown |

Returns "not configured" gracefully when no `webProvider` is provided.

### 7. Web Provider (IWebProvider + JinaWebProvider)

**Files**: `src/types/web.types.ts`, `src/tools/definitions/web/webProvider.ts`, `src/tools/definitions/web/jinaWebProvider.ts`

**IWebProvider interface**:
```typescript
interface IWebProvider {
  readonly type: TWebProviderBrand
  search(query: string, maxResults?: number): Promise<TSearchResult[]>
  fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult>
}
```

**createWebProvider(config?)** — factory that creates provider by type (currently only `jina`).

**JinaWebProvider** — Full implementation using Jina AI APIs:
- Search: `https://s.jina.ai/?q=...` with JSON Accept header
- Fetch: `https://r.jina.ai/<url>` reader API with content truncation
- URL validation: blocks private IPs, localhost, metadata endpoints, non-http protocols, decimal/hex/octal IP encodings
- 30s request timeout, optional API key auth via Bearer token

### 8. Custom Function Tools (buildCustomFunctionTools)

**File**: `src/tools/tools.ts`

Converts `FunctionModel[]` definitions into pi-mono `AgentTool[]` that delegate execution to a caller-provided callback.

```typescript
const tools = buildCustomFunctionTools(functions, onExecute)
```

**Parameter schema generation** (3 modes):
1. **inputSchema** (preferred): Rich typed parameters from `fn.inputSchema[]` -- name, type (string/number/boolean/object/array), description, required
2. **defaultArgs** (legacy): Named string parameters from `fn.defaultArgs` keys
3. **Generic**: Fallback `{ input: Record<string, any> }` when neither is defined

When `inputSchema` or `defaultArgs` define named properties, the LLM params object IS the input directly. Otherwise, it uses an `input` wrapper property.

### 9. Tool Definitions (Static LLM Tool Defs)

**Files**: `src/tools/definitions/`

Static `TLLMToolDef[]` definitions organized by category. Used for API response metadata, not for runtime tool execution (runtime uses `AgentTool[]` from `createSandboxTools`/`createWebTools`).

**11 total tool definitions** across 4 categories:

- **Filesystem** (`fs/fs.ts` -- 6): `readFile`, `writeFile`, `listDir`, `deleteFile`, `mkdir`, `fileExists`
- **Shell** (`shell/definition.ts` -- 1): `shellExec`
- **Code** (`code/code.ts` -- 1): `evalCode`
- **Web** (`web/web.ts` -- 2): `webSearch`, `webFetch`

**API**:
- `allToolDefs: TLLMToolDef[]` — All tool definitions (note: `createArtifact` is runtime-only, not in static defs)
- `getToolDefs(allowedTools?: string[]): TLLMToolDef[]` — Filter by names (empty/undefined = all)
- `buildFunctionToolDefs(functions: FunctionModel[]): TLLMToolDef[]` — Convert FunctionModel to TLLMToolDef

## Key Patterns

### 1. Instance-Based Multi-Turn Sessions

The primary architectural pattern. `AgentRunner` is an instance that maintains state across turns:

- pi-mono `Agent` is created once in `init()` and reused across `runTurn()` calls
- In-memory message history accumulates naturally through pi-mono's Agent state
- The `#pendingPersistence` queue batches DB writes and drains after each turn
- `updateConfig()` hot-swaps model/systemPrompt/tools between turns without recreating the Agent
- `destroy()` cleans up everything; `init()` can be called again for a new session

The static `AgentRunner.run()` wraps init+runTurn+destroy for backward compatibility with the SSE endpoint pattern.

### 2. Per-Turn Skill Resolution

Each `runTurn()` call runs `resolveActiveSkills()` to check if any configured skills match the current prompt. Matched skills inject instructions into the system prompt and merge additional tool names.

### 3. Transient Error Retry Loop

After `agent.waitForIdle()`, if the agent has an error, the runner checks `isTransientError()`. If transient and retries remain (default: 2), it delays with exponential backoff (1s * attempt) and calls `agent.continue()`. This handles rate limits, network hiccups, and temporary 5xx errors transparently.

### 4. Context Overflow Detection

After the agent completes a turn, `isContextOverflow()` from pi-mono checks if the last assistant message exceeded the model's context window. If detected, an error event is emitted to the client.

### 5. Message Persistence Queue

Messages are not persisted synchronously during the agent loop. Instead, `turn_end` events push persistence promises onto `#pendingPersistence`, which is drained after the agent completes via `#drainPersistence()`. Failed persistence is logged but does not crash the agent.

### 6. Pluggable Persistence (IAgentRunnerDB)

AgentRunner accepts a narrow DB interface rather than depending on the full database package. This allows:
- Backend: passes direct DB service calls
- TSA: delegates all persistence to the backend API (no local implementation)

### 7. Custom Message Filtering (convertToLlm)

The `filterCustomMessages` function is passed to pi-mono's Agent as `convertToLlm`. It strips any messages with custom roles (artifact, notification, systemEvent) before LLM API calls, keeping only standard `user`, `assistant`, and `toolResult` roles.

### 8. Tool Execution via AgentTool Interface

Tools implement pi-mono's `AgentTool` interface with TypeBox parameter schemas:

```typescript
{
  name: string,
  label: string,
  description: string,
  parameters: TypeBox.TObject,  // TypeBox schema
  execute: (toolCallId, params, signal, onUpdate?) => Promise<ToolResult>
}
```

`onUpdate()` is called during execution to stream progress events.

## Configuration

### Agent Config (`configs/agent.config.ts`)

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

### TAgentEnvironment Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `thinkingLevel` | `string` | `undefined` (off) | Extended thinking level (off/low/medium/high) |
| `thinkingBudgets` | `object` | `undefined` | Per-model thinking token budgets |
| `contextBudgetPercent` | `number` | `80` | Max % of context window to use |
| `contextCompaction` | `object` | `undefined` | `{ enabled, strategy: 'prune'|'compact', compactionModel? }` |
| `webProvider` | `TWebProviderConfig` | `undefined` | `{ type, apiKey?, secretId? }` |
| `maxRetries` | `number` | `2` | Max transient error retries per turn |
| `cacheRetention` | `string` | `undefined` | Cache retention hint for LLM API |

### LLM Config Additions (TLLMAdapterConfig)

Beyond standard fields (provider, model, apiKey, systemPrompt, temperature, maxTokens):
- `headers?: Record<string, string>` — Custom headers injected into LLM API calls via streamFn
- `cacheRetention` is passed via `environment.cacheRetention`, not through llmConfig

### Build Config (`configs/tsup.config.ts`)

- **Format**: CJS only (`format: ['cjs']`)
- **Output**: `dist/index.cjs` with source maps
- **Externals**: All non-workspace, non-keg-hub packages (pi-mono packages are external)
- **No externals for**: `@tdsk/*` and `@keg-hub/*` packages (bundled into output)
- **Splitting**: Disabled

## Workspace Dependencies

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-agent-core` | Agent class, AgentEvent types, AgentTool interface, StreamFn, CustomAgentMessages |
| `@mariozechner/pi-ai` | getModel(), streamSimple(), isContextOverflow(), calculateCost(), Message types, TypeBox schema builder, ImageContent |
| `@tdsk/sandbox` | Sandbox execution (E2B, K8s, local providers) |
| `@tdsk/domain` | Shared types: TStreamEvent, TLLMToolDef, TMessageContent, TLLMAdapterConfig, TAgentEnvironment, TAgentConfigFields, ISandbox, FunctionModel, Skill, EContentType, EStreamEventType, EStreamStopReason, TTokenUsage, TImageAttachment, TFileAttachment, TWebProviderConfig, TWebProviderBrand, buildFallbackModel |
| `@tdsk/database` | Database types (workspace dep) |
| `@tdsk/logger` | Winston logger via `buildApiLogger()` |

## Integration Points

### With Backend (`@tdsk/backend`)

- Backend's `runAgent` SSE endpoint calls `AgentRunner.run()` (static, one-shot) with direct DB service as `IAgentRunnerDB`
- Backend's WebSocket session manager can use instance mode (`init()` / `runTurn()` / `destroy()`)
- Backend provides `onExecuteFunction` callback for custom function tool execution
- Backend resolves web provider secrets and injects `apiKey` into `environment.webProvider`

### With Sandbox (`@tdsk/sandbox`)

- `init()` creates sandbox via `createSandboxProvider(type).create(config)` when `sandboxConfig` is present
- `createSandboxTools()` creates AgentTool[] backed by ISandbox methods (including `evaluate()` for evalCode)
- Sandbox is created per-session and closed in `destroy()`

### With Domain (`@tdsk/domain`)

- `TStreamEvent` / `EStreamEventType` / `EStreamStopReason` — Streaming event types
- `TTokenUsage` — Token usage + cost in turnEnd events
- `TLLMToolDef` — Tool definition schema (static format)
- `TMessageContent` / `EContentType` — Message content types (text, tool_use, tool_result, thinking, image, file)
- `TLLMAdapterConfig` — Provider config (apiKey, model, systemPrompt, headers, etc.)
- `TAgentEnvironment` — Runtime environment settings
- `TAgentConfigFields` — Runtime-updatable config fields (aliased as `TAgentConfig`)
- `ISandbox` / `ISandboxProvider` / `TSandboxConfig` — Sandbox interfaces
- `FunctionModel` / `TFunctionExecResult` — Custom function definitions + results
- `Skill` — Skill definitions for per-turn resolution
- `TImageAttachment` / `TFileAttachment` — Attachment types
- `TWebProviderConfig` / `TWebProviderBrand` — Web provider config
- `buildFallbackModel` — Model construction when pi-mono registry lookup fails

### With TSA (`@tdsk/tsa`)

- TSA's `LocalAgentExecutor` calls `AgentRunner.run()` (static) with HTTP-based `IAgentRunnerDB`
- TSA delegates all message persistence to the backend API (no local DB)

## Development Guidelines

### Adding a New Sandbox Tool

1. **Add to `createSandboxTools()`** in `src/tools/tools.ts`:
   ```typescript
   {
     name: 'myTool',
     label: 'My Tool',
     description: 'Description for LLM',
     parameters: Type.Object({
       param1: Type.String({ description: 'Parameter description' }),
     }),
     execute: async (_toolCallId, params, _signal, onUpdate) => {
       onUpdate?.({
         content: [{ type: 'text', text: `Running: ${params.param1}` }],
         details: { status: 'running' },
       })
       const result = await sandbox.myMethod(params.param1)
       return {
         content: [{ type: 'text', text: result }],
         details: { success: true },
       }
     },
   }
   ```

2. **Add static definition** in `src/tools/definitions/` (for API metadata)

3. **Update ISandbox interface** in `@tdsk/domain` if new sandbox method needed

4. **Write tests** (co-located `.test.ts` file)

### Adding a New Web Provider

1. **Implement `IWebProvider`** in `src/tools/definitions/web/`:
   ```typescript
   export class MyProvider implements IWebProvider {
     readonly type = 'my-provider' as const
     async search(query: string, maxResults?: number): Promise<TSearchResult[]> { ... }
     async fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult> { ... }
   }
   ```

2. **Add to `createWebProvider()` factory** in `webProvider.ts`

3. **Add type to `TWebProviderBrand`** in `@tdsk/domain`

### Testing Patterns

```typescript
// Mock pi-mono Agent for runner tests
vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    prompt: vi.fn().mockResolvedValue(undefined),
    waitForIdle: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn(),
    steer: vi.fn(),
    followUp: vi.fn(),
    continue: vi.fn(),
    setModel: vi.fn(),
    setTools: vi.fn(),
    setSystemPrompt: vi.fn(),
    setThinkingLevel: vi.fn(),
    state: { error: null },
  })),
}))

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn().mockReturnValue({
    api: 'test',
    provider: 'test',
    id: 'test-model',
    contextWindow: 100000,
  }),
  streamSimple: vi.fn(),
  isContextOverflow: vi.fn().mockReturnValue(false),
  calculateCost: vi.fn().mockReturnValue({
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0,
  }),
}))

// Mock sandbox for tool execution tests
const mockSandbox = {
  exec: vi.fn().mockResolvedValue({ success: true, output: 'result' }),
  readFile: vi.fn().mockResolvedValue('file content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  listDir: vi.fn().mockResolvedValue(['file1.ts']),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  fileExists: vi.fn().mockResolvedValue(true),
  evaluate: vi.fn().mockResolvedValue({ result: 42, output: '' }),
  close: vi.fn().mockResolvedValue(undefined),
}

// Mock DB for runner tests
const mockDb: IAgentRunnerDB = {
  listMessages: vi.fn().mockResolvedValue({ data: [] }),
  createMessage: vi.fn().mockResolvedValue({}),
}
```

### Test File Organization (12 files)

| Test File | Module | Scope |
|-----------|--------|-------|
| `src/index.test.ts` | Barrel exports | Validates all exports present |
| `src/runner/runner.test.ts` | AgentRunner | init/runTurn/updateConfig/destroy lifecycle, static run, error handling |
| `src/adapters/eventBridge.test.ts` | Event Bridge | All AgentEvent → TStreamEvent mappings incl. turnEnd usage |
| `src/adapters/messageConverter.test.ts` | Message Converter | Bidirectional conversion incl. images/files/thinking |
| `src/tools/tools.test.ts` | Runtime Tools | Sandbox + web + custom function tool creation and execution |
| `src/tools/definitions.test.ts` | Tool Definitions | Static definition aggregation |
| `src/tools/definitions/definitions.test.ts` | Definition Helpers | getToolDefs/buildFunctionToolDefs filtering |
| `src/tools/definitions/web/jinaWebProvider.test.ts` | Jina Provider | Search, fetch, URL validation, SSRF blocking |
| `src/tools/definitions/web/webProvider.test.ts` | Provider Factory | createWebProvider factory |
| `src/utils/skillResolver.test.ts` | Skill Resolver | Keyword matching, alwaysActive, instruction building |
| `src/utils/contextManager.test.ts` | Context Manager | Prune + compact strategies, token estimation |
| `src/utils/errorClassifier.test.ts` | Error Classifier | Transient pattern matching |

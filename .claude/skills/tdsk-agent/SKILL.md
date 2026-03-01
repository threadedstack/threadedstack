---
name: "tdsk-agent"
description: "Knowledge base for the headless AI agent orchestration library"
tags: ["ai-agent", "llm", "streaming", "react-loop", "tool-execution", "sandbox", "typescript"]
---
# Agent Repo Skill

## Overview

The **Agent** repo (`repos/agent`, `@tdsk/agent`) is a headless AI agent orchestration library that provides streaming-first LLM integration and a ReAct loop for tool execution. It acts as the runtime brain for Threaded Stack's AI agent system.

**Key Characteristics:**
- **Type**: Headless AI Agent Library (no server, no WASM)
- **Tech Stack**: TypeScript, streaming SSE, pi-mono Agent framework
- **Architecture**: AgentRunner wraps pi-mono's `Agent` class for multi-step ReAct loop with streaming and sandbox-based tool execution
- **LLM Support**: All providers supported by pi-mono (`@mariozechner/pi-ai`) -- Anthropic, OpenAI, Google, etc. via `getModel()`
- **Proxy Mode**: `createStreamProxy()` routes LLM calls through backend SSE proxy (API key stays server-side)
- **Sandbox**: Delegates to `@tdsk/sandbox` for isolated code/shell execution (E2B or local)
- **Build**: Single-step CJS bundle via tsup (no WASM compilation)

**Key Problem Solved**: Provides a unified, streaming-first interface for running AI agents across multiple LLM providers, with automatic tool call detection, sandbox execution, custom function support, and conversation history management.

## Directory Structure

```
repos/agent/
├── package.json
├── configs/
│   ├── agent.config.ts           # Logger + env config
│   ├── aliases.ts                # Path aliases (@TAG/*)
│   ├── tsup.config.ts            # CJS build, externals
│   └── vitest.config.ts          # Vitest test runner config
└── src/
    ├── index.ts                  # Re-exports: stream, types, tools, tsagent, runner, adapters
    ├── tsagent.ts                # TSAgent class — sandbox lifecycle manager
    ├── adapters/
    │   ├── eventBridge.ts        # mapAgentEvent() — pi-mono AgentEvent to TStreamEvent
    │   └── messageConverter.ts   # convertToLlmMessages(), convertAssistantToContent(), convertToolResultToContent()
    ├── stream/
    │   └── stream.ts             # createStreamProxy() — pi-mono StreamFn for backend SSE proxy
    ├── runner/
    │   └── runner.ts             # AgentRunner — wraps pi-mono Agent with DB persistence
    ├── tools/
    │   ├── tools.ts              # createSandboxTools(), buildCustomFunctionTools()
    │   └── definitions/
    │       ├── definitions.ts    # allToolDefs, getToolDefs(), buildFunctionToolDefs()
    │       ├── fs/fs.ts          # readFile, writeFile, listDir, deleteFile, mkdir, fileExists
    │       ├── shell/definition.ts # shellExec
    │       └── web/web.ts        # webSearch (stub)
    ├── types/
    │   └── runner.types.ts       # TAgentRunOpts, IAgentRunnerDB, TProxyConfig
    └── utils/
        ├── logger.ts             # buildApiLogger wrapper
        └── paths.ts              # alias-hq path resolution
```

## Architecture

### Component Hierarchy

```
TSAgent (sandbox lifecycle manager)
  ├─ sandboxProvider: ISandboxProvider (from @tdsk/sandbox)
  └─ activeSandboxes: Map<string, ISandbox>

AgentRunner.run(opts) (main orchestration — static method)
  ├─ pi-mono Agent (from @mariozechner/pi-agent-core)
  │   ├─ Model selection via getModel() (from @mariozechner/pi-ai)
  │   ├─ streamFn: optional StreamFn (proxy mode via createStreamProxy)
  │   └─ getApiKey: optional () => string
  ├─ IAgentRunnerDB (message persistence)
  ├─ Event Bridge (mapAgentEvent: AgentEvent to TStreamEvent)
  ├─ Message Converter (ThreadedStack <-> pi-mono message formats)
  ├─ Sandbox Tools (AgentTool[] backed by ISandbox — 8 tools)
  ├─ Custom Function Tools (AgentTool[] from FunctionModel[])
  └─ Sandbox (from @tdsk/sandbox — E2B or local)
```

### Request Flow (AgentRunner.run)

```
AgentRunner.run(opts: TAgentRunOpts)
    |
1. Load conversation history from DB (db.listMessages)
    |
2. Save user message to DB (db.createMessage)
    |
3. Create sandbox + sandbox tools if sandboxConfig present
    |
4. Build custom function tools if customFunctions present
    |
5. Convert history to pi-mono Messages (convertToLlmMessages)
    |
6. Get pi-mono model via getModel(provider, model)
    |
7. Create StreamFn if proxyConfig present (createStreamProxy)
    |
8. Construct pi-mono Agent with initialState, streamFn, getApiKey
    |
9. Subscribe to agent events:
   |- Map each AgentEvent to TStreamEvent via mapAgentEvent()
   |- Forward to opts.onEvent() for SSE output
   |- On turn_end: persist assistant message + tool results to DB
    |
10. Run: agent.prompt(prompt) then agent.waitForIdle()
    |
11. Cleanup: unsubscribe, close sandbox (in finally block)
```

### Event Bridge (AgentEvent to TStreamEvent)

Maps pi-mono `AgentEvent` types to ThreadedStack `TStreamEvent`:

| pi-mono Event | Sub-type | TStreamEvent |
|--------------|----------|--------------|
| `message_update` | `text_delta` | `{ type: 'text', text }` |
| `message_update` | `toolcall_start` | `{ type: 'tool_call_start', id, name }` |
| `message_update` | `toolcall_delta` | `{ type: 'tool_call_args', id, args }` |
| `message_update` | `done` | `{ type: 'done', stopReason }` |
| `message_update` | `error` | `{ type: 'error', error }` |
| `tool_execution_update` | -- | `{ type: 'tool_execution_update', toolUseId, content }` |
| `tool_execution_end` | -- | `{ type: 'tool_result', toolUseId, content, isError }` |
| `agent_end` | -- | `{ type: 'done', stopReason: 'end_turn' }` |
| `agent_start`, `turn_start/end`, `message_start/end`, `tool_execution_start` | -- | `undefined` (not forwarded) |

### Message Converter

Bidirectional conversion between ThreadedStack `TMessageContent[]` and pi-mono `Message[]`:

**ThreadedStack to pi-mono** (`convertToLlmMessages`):
- User text messages to `UserMessage` (role: `user`, content: string)
- User tool_result messages to `ToolResultMessage` (role: `toolResult`)
- Assistant text/toolUse messages to `AssistantMessage` (role: `assistant`, content: TextContent/ToolCall)
- System messages: skipped (handled via systemPrompt)

**pi-mono to ThreadedStack** (`convertAssistantToContent`, `convertToolResultToContent`):
- `AssistantMessage` text/toolCall to `TTextContent`/`TToolUseContent`
- `ToolResultMessage` to `TToolResultContent`
- Thinking blocks: skipped (not persisted)

## Component Details

### 1. TSAgent (Sandbox Lifecycle Manager)

**File**: `src/tsagent.ts`

Manages sandbox instances per session.

```typescript
type TTSAgentOpts = {
  sandboxProvider: ISandboxProvider  // From @tdsk/sandbox
}
```

**Methods**:
- `createSandbox(sessionId, config)` -- Creates or returns existing sandbox for session
- `getSandbox(sessionId)` -- Retrieves active sandbox by session ID
- `destroySandbox(sessionId)` -- Closes and removes sandbox (swallows errors)
- `cleanup()` -- Closes all sandboxes and clears map
- `getStats()` -- Returns current sandbox count

### 2. AgentRunner (pi-mono Agent Wrapper)

**File**: `src/runner/runner.ts`

Wraps pi-mono's `Agent` class with ThreadedStack's DB persistence, event bridging, and sandbox integration. Static `run(opts: TAgentRunOpts): Promise<void>` method (no instantiation needed).

**TAgentRunOpts**:
```typescript
{
  agentId: string
  threadId: string
  prompt: string
  userId: string
  orgId: string
  db: IAgentRunnerDB           // Message persistence adapter
  llmConfig: TLLMAdapterConfig // Provider, model, apiKey, systemPrompt, etc.
  sandboxConfig?: {            // Optional sandbox configuration
    provider: string
    apiKey?: string
    template?: string
    timeout?: number           // Default: 300000 (5 min)
    envVars?: Record<string, string>
  }
  tools?: string[]             // Allowed tool names (empty = all 8 tools)
  environment?: TAgentEnvironment
  maxSteps?: number            // Max conversation loop steps
  proxyConfig?: TProxyConfig   // Routes LLM calls through backend SSE proxy
  onEvent: (event: TStreamEvent) => void  // Streaming event callback
  customFunctions?: FunctionModel[]       // Custom user-defined functions
  onExecuteFunction?: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
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

**TProxyConfig**:
```typescript
type TProxyConfig = {
  backendUrl: string      // Backend URL (e.g. 'https://px.local.threadedstack.app')
  sessionToken: string    // Session token from POST /_/ai/sessions
}
```

### 3. Stream Proxy (createStreamProxy)

**File**: `src/stream/stream.ts`

Creates a pi-mono `StreamFn` that routes LLM calls through the backend's SSE proxy endpoint instead of calling providers directly.

```typescript
const streamFn = createStreamProxy({
  backendUrl: 'https://px.local.threadedstack.app',
  sessionToken: 'session-token-123',
})
```

**How it works**:
- Returns a `StreamFn` (pi-mono interface) that can be passed to `Agent` constructor
- POSTs to `${backendUrl}/ai/stream` with `Authorization: Session ${token}`
- Body includes `{ model, context, options }` for the backend to process
- Reads SSE response and converts `ProxyAssistantMessageEvent` to `AssistantMessageEvent`
- Handles text, thinking, toolcall, done, and error proxy events
- Reconstructs a partial `AssistantMessage` as events stream in
- API key never leaves the backend -- the session token references a cached config with the decrypted key

### 4. Sandbox Tools (createSandboxTools)

**File**: `src/tools/tools.ts`

Creates pi-mono `AgentTool[]` definitions backed by an ISandbox instance.

```typescript
const tools = createSandboxTools(sandbox, allowedTools?)
// Returns AgentTool[] (8 tools, or filtered subset)
```

**8 sandbox tools** (each calls `onUpdate()` for progress streaming):

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

Tools use TypeBox (`Type.Object`, `Type.String`, etc.) from `@mariozechner/pi-ai` for parameter schemas.

### 5. Custom Function Tools (buildCustomFunctionTools)

**File**: `src/tools/tools.ts` (same file as sandbox tools)

Converts `FunctionModel[]` definitions into pi-mono `AgentTool[]` that delegate execution to a caller-provided callback.

```typescript
const tools = buildCustomFunctionTools(functions, onExecute)
// functions: FunctionModel[] from @tdsk/domain
// onExecute: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
```

**Parameter schema generation** (3 modes):
1. **inputSchema** (preferred): Rich typed parameters from `fn.inputSchema[]` -- name, type (string/number/boolean/object/array), description, required
2. **defaultArgs** (legacy): Named string parameters from `fn.defaultArgs` keys
3. **Generic**: Fallback `{ input: Record<string, any> }` when neither is defined

When `inputSchema` or `defaultArgs` define named properties, the LLM params object IS the input directly. Otherwise, it uses an `input` wrapper property.

### 6. Tool Definitions (Static LLM Tool Defs)

**Files**: `src/tools/definitions/`

**8 total tool definitions** organized by category:

**Filesystem tools** (`fs/fs.ts` -- 6 tools): `readFile`, `writeFile`, `listDir`, `deleteFile`, `mkdir`, `fileExists`

**Shell tools** (`shell/definition.ts` -- 1 tool): `shellExec` (command, args?)

**Web tools** (`web/web.ts` -- 1 tool): `webSearch` (stub -- not yet implemented)

**API**:
- `allToolDefs: TLLMToolDef[]` -- All 8 tool definitions
- `getToolDefs(allowedTools?: string[]): TLLMToolDef[]` -- Filter by names (empty/undefined = all)
- `buildFunctionToolDefs(functions: FunctionModel[]): TLLMToolDef[]` -- Convert FunctionModel to TLLMToolDef

## Key Patterns

### 1. pi-mono Agent Integration

The AgentRunner wraps pi-mono's `Agent` class rather than implementing its own ReAct loop. The Agent handles multi-step tool call loops, LLM streaming, and tool execution orchestration.

AgentRunner adds ThreadedStack-specific behavior:
- DB-backed message persistence
- Event bridging (AgentEvent to TStreamEvent)
- Sandbox lifecycle management
- Custom function tool injection

```typescript
const agent = new Agent({
  initialState: { model, tools, messages, systemPrompt },
  streamFn,           // Optional proxy StreamFn
  getApiKey: () => apiKey,  // Optional API key provider
})

agent.subscribe((event: AgentEvent) => {
  const streamEvent = mapAgentEvent(event)
  if (streamEvent) onEvent(streamEvent)
})

await agent.prompt(prompt)
await agent.waitForIdle()
```

### 2. Pluggable Persistence (IAgentRunnerDB)

AgentRunner accepts a narrow DB interface rather than depending on the full database package. This allows:
- Backend: passes direct DB service calls
- REPL: passes HTTP client that calls backend API

### 3. Proxy Mode via StreamFn

When `proxyConfig` is provided, `createStreamProxy()` creates a `StreamFn` that POSTs to `${backendUrl}/ai/stream` with session token auth, reads SSE response, and reconstructs pi-mono `AssistantMessageEvent` objects. API key never leaves the backend.

### 4. Tool Execution via AgentTool Interface

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

### 5. Custom Function Support

Custom user-defined functions (FunctionModel from @tdsk/domain) are converted to AgentTool[] and merged with sandbox tools. The backend provides an `onExecuteFunction` callback that handles actual execution. Parameter schemas are auto-generated from `inputSchema` (rich typed), `defaultArgs` (legacy string keys), or a generic `input` wrapper.

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

### Build Config (`configs/tsup.config.ts`)

- **Format**: CJS only (`format: ['cjs']`)
- **Output**: `dist/index.cjs` with source maps
- **Externals**: All non-workspace, non-keg-hub packages (pi-mono packages are external)
- **No externals for**: `@tdsk/*` and `@keg-hub/*` packages (bundled into output)
- **Splitting**: Disabled

## Workspace Dependencies

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-agent-core` | Agent class, AgentEvent types, AgentTool interface, StreamFn |
| `@mariozechner/pi-ai` | getModel(), Message types, TypeBox schema builder, createAssistantMessageEventStream |
| `@tdsk/sandbox` | Sandbox execution (E2B + local providers) |
| `@tdsk/domain` | Shared types: TStreamEvent, TLLMToolDef, TMessageContent, ISandbox, FunctionModel, etc. |
| `@tdsk/database` | Database types (workspace dep) |
| `@tdsk/logger` | Winston logger via `buildApiLogger()` |

## Integration Points

### With Backend (`@tdsk/backend`)

- Backend's `runAgent` endpoint calls `AgentRunner.run()` with direct DB service as `IAgentRunnerDB`
- Backend's `streamChat` endpoint uses `createStreamProxy` pattern or direct pi-mono streaming
- Backend provides `onExecuteFunction` callback for custom function tool execution

### With Sandbox (`@tdsk/sandbox`)

- AgentRunner creates sandbox via `createSandboxProvider(type).create(config)`
- `createSandboxTools()` creates AgentTool[] backed by ISandbox methods (readFile, writeFile, listDir, etc.)
- Sandbox is created per-run and closed in the `finally` block

### With Domain (`@tdsk/domain`)

- `TStreamEvent` -- Unified streaming event type
- `TLLMToolDef` -- Tool definition schema (static format)
- `TMessageContent` -- Message content types (text, tool_use, tool_result)
- `TLLMAdapterConfig` -- Provider config (apiKey, model, systemPrompt, etc.)
- `ISandbox` / `ISandboxProvider` / `TSandboxConfig` -- Sandbox interfaces
- `FunctionModel` -- Custom function definitions
- `TFunctionExecResult` -- Function execution result type
- `EContentType` -- Content type enum (text, tool_use, tool_result)
- `EStreamEventType` -- Event type enum (text, tool_call_start, tool_call_args, done, error, tool_result, tool_execution_update)
- `EStreamStopReason` -- Stop reason enum (endTurn, toolUse, maxTokens, error)

### With REPL (`@tdsk/repl`)

- REPL's `LocalAgentExecutor` calls `AgentRunner.run()` with HTTP-based `IAgentRunnerDB`
- REPL provides `proxyConfig` to route LLM calls through the backend proxy (API key stays server-side)

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

2. **Add static definition** in `src/tools/definitions/` (for LLM function calling format)

3. **Update ISandbox interface** in `@tdsk/domain` if new sandbox method needed

4. **Write tests** (co-located `.test.ts` file)

### Testing Patterns

```typescript
// Mock pi-mono Agent for runner tests
vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    prompt: vi.fn().mockResolvedValue(undefined),
    waitForIdle: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn().mockReturnValue({ api: 'test', provider: 'test', id: 'test-model' }),
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
  close: vi.fn().mockResolvedValue(undefined),
}

// Mock DB for runner tests
const mockDb: IAgentRunnerDB = {
  listMessages: vi.fn().mockResolvedValue({ data: [] }),
  createMessage: vi.fn().mockResolvedValue({}),
}
```

# WebSocket Agent Execution with Workspace Sync

## Problem

When interacting with an agent from the REPL, the AI model has no awareness of its configured tools. The root cause is that the REPL runs AgentRunner locally but never passes sandbox config, tools, or environment — because the backend's session creation endpoint doesn't return them, and agent envVars contain secrets that must not leave the server.

## Solution

Move agent execution (the full ReAct loop) to the backend. Replace the SSE-based `/ai/stream` endpoint with a bidirectional WebSocket connection that handles LLM streaming, tool execution, and workspace file sync over a single connection. The REPL becomes a thin WebSocket client.

## Architecture

```
REPL / Admin (thin client)            Backend (full execution)
    │                                        │
    ├─ POST /_/ai/sessions ──────────────► Create session
    │  (JWT or API key auth)                 Store: envVars, tools, config, functions
    │◄── { sessionToken, tools, env } ────   (secrets stay server-side)
    │                                        │
    ├─ WS /ai/ws?token=<session> ────────► Accept WebSocket
    │  Caddy → Auth Proxy → Backend          Validate session token
    │                                        │
    ├─► { type: "prompt", prompt, ... }      AgentRunner.run():
    │                                        │ ├─ Call LLM with tool definitions
    │◄── { type: "text_delta", delta }       │ ├─ LLM returns tool_use
    │◄── { type: "tool_execution_start" }    │ ├─ Execute tool in sandbox (with envVars)
    │◄── { type: "file_request", path }      │ │   └─ File missing → request from client
    ├─► { type: "file_upload", path, ... }   │ │       └─ Tool awaits, then resumes
    │◄── { type: "file_changed", path, ... } │ ├─ Tool writes file → push to client
    │◄── { type: "tool_execution_end" }      │ ├─ Feed result back to LLM
    │◄── { type: "done", reason }            │ └─ Loop until done
    │                                        │
    └─ REPL stages file changes              │
       User confirms → write to real FS      │
```

## WebSocket Protocol

### Connection

Single endpoint: `GET /ai/ws?token=<sessionToken>` (upgrade to WebSocket).

Auth flow:
1. Client creates session via HTTP: `POST /_/ai/sessions` with JWT or API key
2. Client connects to WebSocket with session token as query param
3. Auth proxy validates session token on the upgrade request, proxies to backend
4. Backend accepts connection, loads session state

Both REPL (Node.js `ws` client) and Admin (browser native `WebSocket`) use the same endpoint and auth model.

### Message Types

All event type names are defined in `repos/domain` as `EWSEventType` enum — shared across all repos.

```typescript
// repos/domain/src/types/ws.types.ts

export enum EWSEventType {
  // Client → Server
  Prompt = 'prompt',
  FileUpload = 'file_upload',
  WorkspaceManifest = 'workspace_manifest',
  Cancel = 'cancel',

  // Server → Client
  TextDelta = 'text_delta',
  ToolExecutionStart = 'tool_execution_start',
  ToolExecutionEnd = 'tool_execution_end',
  FileRequest = 'file_request',
  FileChanged = 'file_changed',
  ThreadCreated = 'thread_created',
  TurnEnd = 'turn_end',
  Done = 'done',
  Error = 'error',
}
```

### Client → Server Messages

```typescript
// User sends a message to the agent
{ type: EWSEventType.Prompt, prompt: string, threadId?: string, maxSteps?: number }

// Response to a file_request from the server
{ type: EWSEventType.FileUpload, requestId: string, path: string, content: string }

// Initial workspace manifest (file metadata, no content)
{ type: EWSEventType.WorkspaceManifest, rootDir: string, files: { path: string, hash: string, size: number }[] }

// Cancel current agent execution
{ type: EWSEventType.Cancel }
```

### Server → Client Messages

```typescript
// LLM streaming text
{ type: EWSEventType.TextDelta, delta: string }

// Tool lifecycle
{ type: EWSEventType.ToolExecutionStart, toolCallId: string, toolName: string, args: Record<string, unknown> }
{ type: EWSEventType.ToolExecutionEnd, toolCallId: string, result: string, isError: boolean }

// Workspace file sync
{ type: EWSEventType.FileRequest, requestId: string, path: string }
{ type: EWSEventType.FileChanged, path: string, content: string }

// Agent lifecycle
{ type: EWSEventType.ThreadCreated, threadId: string }
{ type: EWSEventType.TurnEnd, usage: { input: number, output: number } }
{ type: EWSEventType.Done, reason: string }
{ type: EWSEventType.Error, message: string }
```

## Session Enhancement

The in-memory session store gains fields for server-side agent execution:

```typescript
type TSession = {
  // Existing
  agentId: string
  orgId: string
  userId: string
  llmConfig: TLLMAdapterConfig    // Contains decrypted API key
  createdAt: number

  // New
  tools: string[]                    // Tool name filter from agent config
  envVars: Record<string, string>    // Secret env vars (NEVER sent to client)
  environment: TAgentEnvironment     // timeout, temperature, etc.
  customFunctions: TFunctionRecord[] // DB-loaded function records
  workspace?: {                      // Lazy-loaded file state
    rootDir: string
    files: Map<string, { hash: string, size: number }>
    loadedFiles: Map<string, string> // path → content (cached after upload)
  }
}
```

Session creation response (what clients receive):
```typescript
{
  sessionToken: string
  model: string
  provider: string
  maxTokens: number
  systemPrompt: string
  tools: string[]              // Safe: just tool names
  environment: TAgentEnvironment  // Safe: non-secret config
  // NOT included: envVars, customFunctions, apiKey
}
```

## Workspace File Sync

Lazy loading with push-on-change. No persistent WebSocket outside of agent execution.

### File Loading (server pulls from client)

When a sandbox tool reads a file not in the InMemoryFs:
1. Backend checks workspace manifest — is the file known?
2. If yes: send `{ type: "file_request", requestId, path }`
3. Client reads local file, responds: `{ type: "file_upload", requestId, path, content }`
4. Backend loads into InMemoryFs, tool resumes execution
5. File is cached — subsequent reads skip the round-trip

Tool execution awaits a Promise that resolves when the file_upload arrives on the same WebSocket connection.

### File Changes (server pushes to client)

When a sandbox tool writes a file:
1. Backend writes to InMemoryFs
2. Backend sends: `{ type: "file_changed", path, content }`
3. Client stages the change locally

### Persist Model

Client maintains a "pending changes" list. After agent execution completes, user explicitly accepts or rejects changes before anything writes to real filesystem. Like a git staging area.

## Proxy Layer

### Auth Proxy Changes

Minimal. `http-proxy-middleware` already has `ws: true` for `/ai/*` paths.

One change: `setupSessionAuth.ts` needs to extract session token from query param in addition to Authorization header:

```typescript
// Updated: header OR query param
const token = extractFromHeader(req.headers.authorization)
           ?? req.query?.token as string
```

### Caddy

No changes. Caddy's `reverse_proxy` automatically handles WebSocket upgrade requests.

## Endpoints

### Kept (unchanged)
- `POST /_/ai/sessions` — session creation via HTTP (JWT/API key auth)
- `POST /_/agents/:id/run` — SSE-based agent execution for Endpoints and future sub-agents
- All CRUD endpoints — unchanged HTTP REST

### New
- `GET /ai/ws?token=<sessionToken>` — WebSocket upgrade for agent execution

### Removed
- `POST /ai/stream` — SSE LLM proxy (replaced by WebSocket)

## Cross-Repo Impact

| Repo | Changes | Scope |
|------|---------|-------|
| **domain** | New `EWSEventType` enum, typed WS message interfaces, session type updates | Light |
| **backend** | Add `ws` dep. New WebSocket handler. Enhance session store. Add workspace-aware sandbox integration. | Heavy |
| **proxy** | Update session auth to also extract token from query param | Light |
| **repl** | Replace AgentRunner + SSE with WebSocket client. Remove agent/sandbox deps. Add file sync. Major simplification. | Medium |
| **admin** | Replace SSE reader in `useAgentChat` with `WebSocket`. Add session creation before chat. | Medium |
| **agent** | Remove `createStreamProxy()` (no longer needed). Keep `eventBridge` and `AgentRunner` for backend use. | Light |
| **sandbox** | Add workspace-aware sandbox that requests files via callback when not in InMemoryFs | Medium |
| **database** | No changes | None |
| **deploy** | No changes (Caddy + proxy already handle WS) | None |

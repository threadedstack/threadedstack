# Agent Endpoints

## What is an Agent Endpoint

An agent endpoint is one of three endpoint types in Threaded Stack. It connects an LLM provider with sandbox tools, custom functions, and conversation history to create an autonomous AI agent that can reason, use tools, and maintain persistent threads.

**Contrast with the other endpoint types:**

| Type | Purpose | Execution model |
|------|---------|-----------------|
| **Agent** | Multi-turn LLM reasoning with tool use and sandbox access | Streaming ReAct loop via `AgentRunner` |
| **Proxy** | HTTP forwarding with auth, transforms, and secret injection | Single request/response passthrough via `ProxyService` |
| **FaaS** | Serverless function execution in a sandboxed environment | One-shot code execution via `FunctionExecutor` |

Agent endpoints are the only type that maintain conversation state across requests. Each run uses a thread to persist messages, and the agent can autonomously decide to invoke tools (shell, filesystem, code evaluation, web search, custom functions) across multiple turns before returning a final response.

The runtime is built on pi-mono (`@mariozechner/pi-agent-core` and `@mariozechner/pi-ai`), which provides the ReAct loop, multi-provider LLM streaming, and tool execution orchestration. Threaded Stack's `AgentRunner` wraps this with database persistence, event bridging, sandbox lifecycle management, and custom function injection.

## Agent Lifecycle

```
1. Configure              2. Attach                 3. Assign               4. Run
+-----------------+       +-----------------+       +----------------+      +------------------+
| Create agent    |       | Link providers  |       | Add to project |      | POST /agents/:id |
| - name          | ----> | via junction    | ----> | via junction   | ---> |   /run           |
| - system prompt |       | table           |       | table          |      | { prompt,        |
| - model         |       | (priority 0 =   |       | (optional      |      |   threadId? }    |
| - tools[]       |       |  primary)       |       |  overrides)    |      |                  |
| - environment   |       |                 |       |                |      | Streams SSE      |
+-----------------+       | Link functions  |       +----------------+      | events back      |
                          | Link skills     |                               +------------------+
                          +-----------------+
```

**Detailed execution flow:**

```
Client POST /_/agents/:id/run  { prompt, threadId?, providerId? }
  |
  v
AgentEndpoint.run()
  |
  +-- resolveAgentConfig()
  |     |-- Load agent + providers + secrets (unsanitized)
  |     |-- Apply project-level overrides if projectId provided
  |     |-- Select provider (explicit or primary by priority)
  |     |-- SecretResolver: 3-tier API key lookup (agent -> provider -> org)
  |     |-- Resolve headers + bodyParams via template substitution
  |     |-- Load custom functions attached to agent
  |     |-- Resolve web provider API key + skills
  |     |-- Build LLM config, sandbox config, execution callback
  |     +-- Return TResolvedAgentConfig
  |
  +-- ensureThread() -- reuse threadId or create new thread
  |
  +-- Set SSE headers (Content-Type: text/event-stream)
  |     Write first event: { type: "thread", threadId }
  |
  +-- AgentRunner.run(opts)
  |     |-- init(): create sandbox, load history, build tools, create pi-mono Agent
  |     |-- runTurn(): save user message, prompt agent, stream events
  |     |-- waitForIdle(): block until agent completes all turns
  |     +-- destroy(): close sandbox, drain pending message persistence
  |
  +-- Write `data: [DONE]\n\n` sentinel, end response
```

## Agent Configuration

### Database Schema

The `agents` table stores the core configuration. Source: `repos/database/src/schemas/agents.ts`.

| Column | Type | Description |
|--------|------|-------------|
| `name` | text | Agent display name |
| `description` | text | Optional description |
| `orgId` | varchar(10) | Organization owner (cascade delete) |
| `systemPrompt` | text | System prompt sent to the LLM |
| `model` | text | Model identifier override (falls back to provider default) |
| `maxTokens` | integer | Maximum tokens for responses (default: 100000) |
| `tools` | jsonb | Array of allowed tool names (empty = all tools) |
| `envVars` | jsonb | Environment variables passed to sandbox |
| `environment` | jsonb | Execution settings: sandbox type, timeout, temperature, thinking level, context budget, web provider config |
| `active` | boolean | Whether the agent can be used (default: true) |

### Junction Tables

Agents use three junction tables for many-to-many relationships:

**`agent_providers`** (`repos/database/src/schemas/agentProviders.ts`) -- Links agents to LLM providers. Each row has a `priority` field: `0` = primary/default provider, `1+` = secondary. A per-provider `model` override can be set. Uniqueness is enforced on `(agentId, providerId)`.

**`agent_projects`** (`repos/database/src/schemas/agentProjects.ts`) -- Links agents to projects with per-project configuration overrides. Override fields (`model`, `maxTokens`, `systemPrompt`, `tools`, `envVars`, `environment`, `functionIds`) are nullable; `NULL` means inherit from the base agent config. The `enabled` flag controls whether the agent is active in that project. Uniqueness is enforced on `(agentId, projectId)`.

**`agent_skills`** (`repos/database/src/schemas/agentSkills.ts`) -- Links agents to skills. Skills provide additional system prompt instructions and tool registrations that are resolved per-turn based on the user's prompt. Uniqueness is enforced on `(agentId, skillId)`.

### Secret Resolution

The `SecretResolver` service (`repos/backend/src/services/secrets/secretResolver.ts`) performs a 3-tier API key lookup:

1. **Agent-level** -- secrets directly attached to the agent
2. **Provider-level** -- secrets attached to the provider
3. **Org-level** -- secrets belonging to the organization

Provider headers and body params support `{{SECRET_NAME}}` template substitution, where references are replaced with decrypted secret values at runtime. API keys never leave the backend.

## Execution Paths

Agents can be run through two transport mechanisms: SSE (Server-Sent Events) and WebSocket.

### SSE: `POST /_/agents/:id/run`

The SSE path is a one-shot request/response stream. The client sends a prompt and receives a stream of events until the agent completes.

**Request:**
```json
{
  "prompt": "Write a hello world script",
  "threadId": "optional-existing-thread-id",
  "providerId": "optional-provider-override"
}
```

**Response:** `Content-Type: text/event-stream` with `X-Thread-Id` header.

```
data: {"type":"thread","threadId":"abc123"}

data: {"type":"text","text":"I'll create"}

data: {"type":"text","text":" a hello world script."}

data: {"type":"tool_call_start","id":"tc_1","name":"writeFile"}

data: {"type":"tool_call_args","id":"tc_1","args":"{\"path\":\"/hello.js\","}

data: {"type":"tool_result","toolUseId":"tc_1","content":"File written to /hello.js","isError":false}

data: {"type":"done","stopReason":"end_turn"}

data: [DONE]
```

**Auth:** JWT or API key (standard `/_/*` auth middleware).

**When to use:** Simple integrations, single-prompt interactions, admin UI chat, any client that does not need mid-stream steering or multi-turn persistence within a single connection.

Source: `repos/backend/src/endpoints/agents/runAgent.ts` and `repos/backend/src/services/endpoints/agentEndpoint.ts`.

### WebSocket: `/ai/ws`

The WebSocket path maintains a persistent connection with a long-lived `AgentRunner` instance. The agent persists across multiple prompts without re-initialization, and the client can steer, follow up, cancel, or reconfigure the agent mid-session.

**Connection:** `wss://host/ai/ws?token=<session-token>`

The session token is obtained via `POST /_/ai/sessions`, which resolves the agent config and API key server-side, then returns a signed JWT. The token expires after 1 hour.

**Client messages:**
| Type | Fields | Description |
|------|--------|-------------|
| `prompt` | `message`, `images?`, `files?` | Send a user prompt |
| `cancel` | | Abort the current agent run |
| `steer` | `message` | Inject a steering message mid-turn |
| `follow_up` | `message` | Queue a follow-up after the current turn |
| `update_config` | `model?`, `provider?`, `tools?`, `systemPrompt?`, `thinkingLevel?` | Reconfigure the agent between turns |

**Server messages:** Same `TStreamEvent` types as SSE, plus `heartbeat` keepalive messages.

**When to use:** Interactive chat UIs that need multi-turn sessions, real-time agent steering, mid-conversation model switching, or REPL-style interfaces.

Source: `repos/backend/src/endpoints/ai/onWSConnect.ts`.

## AgentRunner

The `AgentRunner` class (`repos/agent/src/runner/runner.ts`) wraps pi-mono's `Agent` class with Threaded Stack's persistence, event bridging, and sandbox lifecycle.

### Instance Lifecycle

```
                    +--------+
                    | new()  |
                    +---+----+
                        |
                   +----v----+
                   | init()  |  Creates sandbox, loads history,
                   +----+----+  builds tools, creates pi-mono Agent
                        |
              +---------v---------+
              |    runTurn()      |  Saves user message, prompts agent,
              |  (repeatable)    |  streams events, persists responses
              +---------+---------+
                        |
              +---------v---------+
              | updateConfig()   |  Change model, prompt, tools
              |  (optional)      |  between turns
              +---------+---------+
                        |
                   +----v-----+
                   | destroy() |  Close sandbox, drain persistence,
                   +----------+  release resources
```

### Key Methods

**`init(opts: TAgentInitOpts)`** -- Creates the sandbox (if configured), loads conversation history from the database, converts messages to pi-mono format, resolves the LLM model, builds sandbox + web + custom function tools, creates the pi-mono `Agent` instance, and subscribes to agent events for streaming and message persistence.

**`runTurn(opts: TAgentTurnOpts)`** -- Resolves active skills for the current prompt, saves the user message to the database, prompts the pi-mono `Agent`, and returns a `TAgentHandle` with `steer()`, `followUp()`, `abort()`, and `waitForIdle()` methods. Includes automatic retry logic for transient LLM errors and context overflow detection.

**`updateConfig(config: TAgentConfig)`** -- Mutates the live pi-mono `Agent` at runtime. Can change model, system prompt, thinking level, or tools between turns without re-initialization.

**`destroy()`** -- Unsubscribes from agent events, drains all pending message persistence promises, closes the sandbox, and nulls all internal references. After destroy, `init()` can be called again.

**`static run(opts: TAgentRunOpts)`** -- One-shot convenience method that creates a runner, calls `init()` + `runTurn()`, and auto-destroys on completion. Used by the SSE endpoint and TSA for fire-and-forget execution.

### Pluggable Persistence

`AgentRunner` accepts an `IAgentRunnerDB` interface rather than a direct database dependency:

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

The backend implements this via direct DB service calls (`repos/backend/src/utils/agent/resolveAgentConfig.ts` -- `createDBAdapter()`). The TSA implements it via HTTP calls to the backend API. This decoupling means the agent runtime has no dependency on the database package.

## Tools

### Sandbox Tools

`createSandboxTools()` (`repos/agent/src/tools/tools.ts`) creates pi-mono `AgentTool[]` definitions backed by an `ISandbox` instance. Each tool streams progress via `onUpdate()` during execution.

| Tool | Description |
|------|-------------|
| `shellExec` | Run a shell command in the sandbox |
| `readFile` | Read file contents |
| `writeFile` | Write content to a file |
| `listDir` | List directory entries |
| `deleteFile` | Delete a file |
| `mkdir` | Create a directory |
| `fileExists` | Check if a path exists |
| `evalCode` | Evaluate JavaScript in an isolated V8 sandbox |
| `createArtifact` | Create a renderable artifact (HTML, SVG, Markdown, code, JSON, CSV, etc.) |

If an `allowedTools` list is provided in the agent config, only matching tools are registered. An empty or absent list registers all tools.

### Web Tools

`createWebTools()` creates tools for web operations independent of any sandbox:

| Tool | Description |
|------|-------------|
| `webSearch` | Search the web and return results with titles, URLs, and snippets |
| `webFetch` | Fetch and extract content from a URL as cleaned markdown |

Web tools require a configured `IWebProvider` instance (resolved from the agent's `environment.webProvider` settings).

### Custom Function Tools

`buildCustomFunctionTools()` converts user-defined `FunctionModel[]` into `AgentTool[]`. Each tool delegates execution to an `onExecuteFunction` callback provided by the backend, which runs the function in a sandboxed environment via `FunctionExecutor`.

Parameter schemas are auto-generated in three modes:

1. **`inputSchema`** (preferred) -- Rich typed parameters with name, type (`string`/`number`/`boolean`/`object`/`array`), description, and required flag
2. **`defaultArgs`** (legacy) -- Named string parameters derived from `defaultArgs` keys
3. **Generic fallback** -- A single `input: Record<string, any>` wrapper property

### Tool Interface

All tools implement pi-mono's `AgentTool` interface with TypeBox parameter schemas:

```typescript
{
  name: string
  label: string
  description: string
  parameters: TypeBox.TObject
  execute: (toolCallId, params, signal, onUpdate?) => Promise<ToolResult>
}
```

## Message Flow

### Conversion Pipeline

Messages flow between two formats: Threaded Stack's `TMessageContent[]` (database representation) and pi-mono's `Message[]` (LLM representation). The adapters in `repos/agent/src/adapters/` handle bidirectional conversion.

```
Database (TMessageContent[])                        LLM (pi-mono Message[])
+---------------------------+                       +---------------------------+
| user + text blocks        | -- convertToLlm.. --> | UserMessage (string/arr)  |
| user + tool_result blocks | -- convertToLlm.. --> | ToolResultMessage         |
| assistant + text/toolUse  | -- convertToLlm.. --> | AssistantMessage          |
| system                    | -- (skipped) -------> | (handled via systemPrompt)|
+---------------------------+                       +---------------------------+

+---------------------------+                       +---------------------------+
| TTextContent              | <-- convertAssist. -- | AssistantMessage text     |
| TToolUseContent           | <-- convertAssist. -- | AssistantMessage toolCall |
| TThinkingContent          | <-- convertAssist. -- | AssistantMessage thinking |
| TToolResultContent        | <-- convertToolR.. -- | ToolResultMessage         |
+---------------------------+                       +---------------------------+
```

Source: `repos/agent/src/adapters/messageConverter.ts`.

### History Loading and Saving

**Loading (on init):** The runner calls `db.listMessages()` to fetch existing thread messages, then `convertToLlmMessages()` converts them to pi-mono format. The current model's `api`/`provider`/`model` values are passed as defaults so `AssistantMessage` objects are reconstructed with the correct provider metadata.

**Saving (on turn_end):** The runner subscribes to pi-mono agent events. On each `turn_end` event, it converts the `AssistantMessage` via `convertAssistantToContent()` and each `ToolResultMessage` via `convertToolResultToContent()`, then queues `db.createMessage()` calls. All pending persistence is drained (via `Promise.allSettled`) when the agent completes or the runner is destroyed.

### Event Bridge

`mapAgentEvent()` (`repos/agent/src/adapters/eventBridge.ts`) maps pi-mono's internal `AgentEvent` types to Threaded Stack's `TStreamEvent` for client output:

| pi-mono Event | Sub-type | TStreamEvent type |
|--------------|----------|-------------------|
| `message_update` | `text_delta` | `text` |
| `message_update` | `thinking_delta` | `thinking` |
| `message_update` | `toolcall_start` | `tool_call_start` |
| `message_update` | `toolcall_delta` | `tool_call_args` |
| `message_update` | `done` | `done` |
| `message_update` | `error` | `error` |
| `tool_execution_update` | -- | `tool_execution_update` |
| `tool_execution_end` | -- | `tool_result` |
| `turn_end` | -- | `turn_end` (includes token usage + cost) |
| `agent_end` | -- | `done` (stopReason: `end_turn`) |
| `agent_start`, `turn_start`, `message_start`, `message_end`, `tool_execution_start` | -- | Not forwarded |

## Admin UI

Agents are configured through the admin dashboard (`repos/admin/`):

**Agent CRUD** -- Create, list, update, and delete agents via the `/_/agents` endpoints. The admin UI provides forms for setting the agent name, description, system prompt, model, max tokens, tools, environment variables, and environment settings.

**Provider linking** -- Providers are attached to agents via the agent-providers junction table. The UI allows selecting from available org providers, setting priority order, and optionally overriding the model per provider.

**Project assignment** -- Agents are assigned to projects via the agent-projects junction table. Per-project overrides (model, system prompt, tools, functions, environment) can be configured, letting the same agent behave differently across projects.

**Skill attachment** -- Skills are linked to agents via the agent-skills junction table. Active skills are resolved per-turn based on the user's prompt content.

**Running agents** -- The admin UI sends `POST /_/agents/:id/run` with a prompt and optional thread ID. SSE events are consumed in real-time to display streaming text, tool calls, tool results, and artifacts in the chat interface.

**Thread management** -- Conversations are persisted as threads with messages. The admin UI supports viewing thread history, continuing existing threads, and branching threads from specific messages via `POST /_/threads/:id/branch`.

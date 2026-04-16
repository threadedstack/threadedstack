---
name: "tdsk-backend"
description: "Knowledge base for the backend Core API repo"
tags: ["express", "nodejs", "api", "backend", "payments", "stripe", "ai", "session", "proxy", "secrets", "pi-ai", "openai", "shell", "scheduler", "egress"]
---
# Backend Repo Skill

## Overview

The **Backend** repo (`repos/backend`) serves as the Core API server for Threaded Stack. It is built on Express 5.1.0 and acts as the central orchestration layer for:

- **Admin CRUD operations** - Organization, project, user, API key, secret, endpoint, provider, agent, thread, skill, schedule, invitation, and subscription management
- **Proxy Engine** - Secure API proxying with secret injection, OAuth 2.0, retry logic, and header/body transforms via endpoint type services (ProxyEndpoint, AgentEndpoint, FaaSEndpoint)
- **AI Engine** - LLM proxy with SSE streaming via `@mariozechner/pi-ai`, session-based API key resolution, AgentRunner integration, and OpenAI-compatible chat completions
- **Shell Sessions** - Interactive terminal access to sandbox pods via WebSocket with SSH PTY, terminal parsing, event persistence, session sharing, and generative UI interpretation
- **Egress Proxy** - Transparent MITM proxy for sandbox outbound traffic with SNI extraction and placeholder secret scanning
- **Scheduler** - Cron-based schedule execution with 60s tick interval
- **Payment Integration** - Stripe subscription management with quota tracking
- **Email Service** - Invitation and notification emails via Resend/Mailgun/Console

The backend receives all admin requests from the Auth-Proxy service at `/_/*` paths and handles internal business logic before interacting with the database or external services.

## Directory Structure

```
repos/backend/
├── configs/
│   ├── backend.config.ts    # Main configuration loader
│   ├── tsup.config.ts       # Build configuration
│   └── vitest.config.ts     # Test configuration
├── src/
│   ├── constants/           # envs.ts, values.ts, sandbox.ts (AuthIgnore, AllowedRetryCodes, DBPaging, SBTcpTimeout, SBShellPattern, DefSBConfig, FileMaxSize, MaxOutputBytes, etc.)
│   ├── endpoints/           # API route definitions
│   │   ├── agents/          # CRUD + runAgent (SSE streaming) + oaiChatCompletions + oaiModels
│   │   ├── ai/              # sessions + streamChat (SSE LLM proxy via pi-ai)
│   │   ├── apiKeys/         # CRUD with generation, scoping, rate limiting
│   │   ├── assets/          # Asset CRUD
│   │   ├── auth/            # Authentication endpoints
│   │   ├── base/            # Base + health endpoints
│   │   ├── domains/         # Domain CRUD
│   │   ├── endpoints/       # Endpoint definitions CRUD
│   │   ├── functions/       # Function CRUD
│   │   ├── invitations/     # Invitation CRUD + accept/revoke/pending
│   │   ├── orgs/            # Orgs CRUD + members + roles + quickstart + nested resources (skills, schedules, sandboxes, etc.)
│   │   ├── payments/        # Payment endpoints + webhook
│   │   ├── projects/        # Projects CRUD
│   │   ├── providers/       # Provider configurations + fetchModels
│   │   ├── proxy/           # Proxy endpoint routing (dispatches to endpoint type services)
│   │   ├── sandboxes/       # Sandbox CRUD + lifecycle (connect, tunnel, shell, start, stop, status, sessions, exec, threads)
│   │   ├── schedules/       # Schedule CRUD + trigger
│   │   ├── skills/          # Skill CRUD + attach/detach
│   │   ├── quotas/          # Quota checking and limits
│   │   ├── secrets/         # Secrets with AES-256-GCM encryption
│   │   ├── subscriptions/   # Subscription management
│   │   ├── threads/         # Thread CRUD + messages + branching + file upload
│   │   ├── users/           # Users CRUD
│   │   ├── accounts.ts      # Main accounts routes (/_/*) — auth + enforceQuota middleware applied here
│   │   ├── endpoints.ts     # Endpoint registry (proxy, accounts)
│   │   └── index.ts
│   ├── middleware/           # Express middleware setup
│   │   ├── authorize.ts     # Authorization middleware
│   │   ├── enforceQuota.ts  # Tier-based POST route quota limits
│   │   ├── projectAccessGuard.ts # Project-scoped API key boundaries
│   │   ├── sandboxProxy.ts  # Caddy wildcard subdomain → pod IP proxy
│   │   ├── setupAuth.ts     # JWT authentication (authenticate function)
│   │   ├── setupDatabase.ts # Database connection with validation
│   │   ├── setupEndpoints.ts # Dynamic route builder with param auto-validation
│   │   ├── setupErrorHandler.ts # Error handling
│   │   ├── setupLogger.ts   # Winston logging
│   │   ├── setupProxy.ts    # Proxy to Auth-Proxy
│   │   ├── setupSandbox.ts  # SandboxService + EgressProxy initialization
│   │   ├── setupServer.ts   # CORS, base setup
│   │   ├── setupSubscription.ts # Auto-create free tier subscription
│   │   └── index.ts
│   ├── mocks/               # Test mocks
│   ├── server/              # Express app, router, HTTP server, WebSocket server
│   ├── services/            # Service layer (see Services section)
│   ├── types/               # TypeScript type definitions (shellSession.types.ts, oai.types.ts, etc.)
│   ├── utils/               # Utility functions (see Utilities section)
│   ├── index.ts             # Entry export (re-exports start.ts)
│   ├── start.ts             # Application bootstrap
│   └── main.ts              # Main initialization logic
├── package.json
└── tsconfig.json
```

## Key Files

### Entry Points
- **`src/index.ts`** - Root export that re-exports `start.ts`
- **`src/start.ts`** - Loads config and calls `main(config)`
- **`src/main.ts`** - Orchestrates all middleware setup and initializes the server

### Configuration
- **`configs/backend.config.ts`** - Loads environment variables and builds the application config object with sections for `server`, `proxy`, `database`, `logger`, `email`, `payments`, and `egress`

### Application Core
- **`src/server/app.ts`** - Creates the Express app instance as a singleton
- **`src/server/server.ts`** - `initServer()` function creates HTTP or HTTPS server based on config
- **`src/server/router.ts`** - `createAsyncRouter()` wraps Express router methods with `express-async-handler` for automatic error handling

### Middleware Setup
- **`setupDatabase.ts`** - Initializes database connection with validation and error handling
- **`setupLogger.ts`** - Sets up Winston request/error logging
- **`setupServer.ts`** - Disables `x-powered-by`, sets up CORS
- **`setupAuth.ts`** - Exports `authenticate` function for JWT authentication (used as middleware in `accounts.ts`)
- **`setupSubscription.ts`** - Exports `setupSubscription` for auto-creating free tier subscription for new users (used as middleware in `accounts.ts`)
- **`setupEndpoints.ts`** - Dynamically builds Express routes from endpoint configs with auto param validation
- **`setupSandbox.ts`** - Initializes `SandboxService` (KubeClient) and `EgressProxy` with graceful shutdown handlers
- **`sandboxProxy.ts`** - Intercepts sandbox subdomain requests (`*.sb.local.threadedstack.app`), parses hostname to extract port + subdomain, looks up in-memory route map, and proxies to pod IP:port
- **`setupProxy.ts`** - Proxies remaining requests to Auth-Proxy service
- **`setupErrorHandler.ts`** - Error handling middleware
- **`authorize.ts`** - Role-based authorization middleware
- **`enforceQuota.ts`** - Maps POST routes to quota resource keys (projects, endpoints, secrets, threads, messages, organizations), checks tier-based limits from `PlanLimits`, returns 403 `quota_exceeded` when over limit. For POST /orgs, uses user-scoped owned org count instead of quota table. Fails closed (blocks on error).
- **`projectAccessGuard.ts`** - Enforces project-level access boundaries for project-scoped API keys. Org-scoped keys and JWT auth pass through. Project-scoped keys can only access their specific project (403 otherwise).

### Endpoint Type Services (`src/services/endpoints/`)

The endpoint type system uses polymorphic dispatch to handle different endpoint types (proxy, FaaS, agent). Each type has a dedicated service class that extends `BaseEndpoint`.

- **`base.ts`** - Abstract `BaseEndpoint` class providing shared operations: permission checks (`checkPermission`), project validation (`validateProject`), method validation (`validateMethod`), and secret fetching (`fetchSecrets`)
- **`agentEndpoint.ts`** - `AgentEndpoint` class: loads agent + provider + secrets, resolves API key via `SecretResolver`, resolves headers/bodyParams, loads custom functions, creates/reuses thread, streams SSE via `AgentRunner.run()` from `@tdsk/agent`. Shared `run()` method is used by both the admin `POST /_/agents/:id/run` route, the proxy engine, and the OpenAI-compatible completions endpoint
- **`proxyEndpoint.ts`** - `ProxyEndpoint` class: HTTP proxy requests through configured endpoints with auth, transforms, and retries via `ProxyService`
- **`faasEndpoint.ts`** - `FaaSEndpoint` class: FaaS function execution via `FunctionExecutor` in sandboxed environment
- **`getEPService.ts`** - Singleton registry mapping `EEndpointType` to service instance. Used by `endpoints/proxy/endpoint.ts` to dispatch requests

### Function Executor (`src/services/functions/functionExecutor.ts`)

Executes user-defined functions inside a sandboxed environment. TypeScript functions are transpiled via esbuild before execution. The sandbox is always torn down in a finally block.

**Key Features:**
- TypeScript transpilation via `esbuild` (ts -> esm)
- Local sandbox execution via `@tdsk/sandbox` `createSandboxProvider('local')`
- Runner wrapper pattern: writes `function.mjs` + `runner.mjs` to sandbox, executes with `node`
- Input passed via `__FUNCTION_INPUT__` env var
- 1 MB output cap (`MaxOutputBytes`), configurable timeout (default 30s via `DefaultTimeoutMS`)

### Services

#### SecretResolver (`src/services/secrets/secretResolver.ts`)
Service for resolving, decrypting, and replacing secret references. Handles `{{SECRET_NAME}}` template substitution, multi-scope decryption, and 3-tier API key resolution.

**Usage in Agent Execution:**
```typescript
const secrets = new SecretResolver(db)
const apiKey = await secrets.resolveApiKey(agent)  // 3-tier lookup: agent -> provider -> org
const headers = await secrets.resolveHeaders(provider)  // Template substitution
const bodyParams = await secrets.resolveBodyParams(provider)  // Template substitution
```

Key methods: `hasSecretRefs`, `replaceRefs`, `replaceInHeaders`, `replaceInObj`, `decrypt`, `resolveApiKey`, `loadAndDecrypt`, `resolveHeaders`, `resolveBodyParams`

#### ProxyService (`src/services/proxy/proxyService.ts`)
Service for applying endpoint options to proxy requests. Handles OAuth token management, authentication, validation, and transformations.

**Key Features:**
- OAuth 2.0 token exchange with caching (5-minute buffer before expiration)
- Auth types: Bearer, Basic, API Key
- Domain whitelist validation with wildcard support (`*.example.com`)
- Path regex validation
- Request/response transforms with secret injection

#### RetryService (`src/services/proxy/retryService.ts`)
Request retry logic with configurable backoff strategies.

**Key Features:**
- Exponential backoff (default: 2x multiplier)
- Configurable retries (default 3, max delay 30s)
- Retryable status codes: `[408, 429, 500, 502, 503, 504]`

#### EgressProxy (`src/services/proxy/egress.ts`)
Transparent MITM egress proxy for sandbox pod outbound HTTP/HTTPS traffic.

**Architecture:**
- All outbound traffic from sandbox pods is redirected via iptables DNAT rules in the pod init container
- A protocol-sniffing TCP front server sits in front of `http-mitm-proxy`:
  - HTTP traffic (non-0x16 first byte): piped directly to MITM proxy with `X-TDSK-Real-IP` header injection
  - TLS traffic (0x16 first byte): SNI extracted from ClientHello, converted to HTTP CONNECT tunnel, forwarded to MITM proxy
- The MITM proxy intercepts requests, scans headers for placeholder tokens (`tdsk_ph_*`), resolves them to real secret values via `SecretResolver`, and forwards to the original destination
- Throws on unresolvable secrets to prevent placeholder tokens from leaking to external services

**Initialization:** `EgressProxy.init(app)` checks for CA cert files at `/etc/tdsk/ca/tls.{crt,key}`, creates a temp CA directory structure for `http-mitm-proxy`, and starts both the MITM proxy (internal loopback port) and the front TCP server (public port)

#### InterpreterService (`src/services/interpreter/`)
Generative UI service that interprets terminal output into structured component trees for rich UI rendering.

**Modules:**
- **`interpreter.ts`** - `InterpreterService` class: calls LLM via `pi-ai` `streamSimple()` with terminal events as input, validates JSON response as a component tree, supports retry with backoff
- **`chunkBuffer.ts`** - `ChunkBuffer`: batches parsed terminal events by chunk ID, stamps each with timestamps, calls `onFlush` when a chunk completes for interpretation
- **`skipHeuristic.ts`** - `shouldInterpret()`: determines if a batch of events warrants UI interpretation (filters noise)
- **`validator.ts`** - `validateTree()`: validates the LLM response is a valid JSON component tree
- **`prompt.ts`** - `getSystemPrompt()` and `buildUserMessage()`: constructs the LLM prompt from `TGuiConfig` and parsed events

**Integration with Shell Sessions:** When a sandbox has `guiConfig.enabled` with a `providerId`, the shell handler creates a `ChunkBuffer` + `InterpreterService`. As terminal events arrive, they are batched and sent to the LLM for interpretation. Results are broadcast to all attached WebSocket clients as `generative-ui` messages.

#### Scheduler (`src/services/scheduler/`)
Cron-based schedule execution service.

**Modules:**
- **`scheduler.ts`** - `Scheduler` class: ticks every 60 seconds, queries due schedules from DB, executes agent via `TScheduleExecutor` callback, marks run with next cron time, increments error count on failure. Guard against concurrent ticks via `#ticking` flag.
- **`cronParser.ts`** - `isValidCron()` and `parseNextRun()`: validates cron expressions and computes next run timestamp

**Factory:** `createScheduler(db, executeAgent?)` returns a `Scheduler` instance

#### OpenAI Adapters (`src/services/openai/`)
Request and response adapters for OpenAI-compatible chat completions API.

- **`requestAdapter.ts`** - `extractPrompt()`: extracts text from last user message; `convertOAIMessages()`: converts OpenAI messages to ThreadedStack format (handles tool calls, vision content, tool results); `buildOverrides()`: maps OpenAI params (model, temperature, max_tokens, system messages) to `TAgentRunOverrides`
- **`responseAdapter.ts`** - `createStreamingAdapter()`: converts `TStreamEvent` to OpenAI `chat.completion.chunk` SSE format; `createNonStreamingAdapter()`: collects events and builds final `chat.completion` JSON response; `formatOAIError()`: maps Exception/Error to OpenAI error format

#### FileExtractor (`src/services/files/fileExtractor.ts`)
File text extraction service for uploaded documents.

- Text-based formats (`text/*`, JSON, CSV, markdown): direct UTF-8 passthrough
- PDF extraction: optional `pdf-parse` package (dynamic import)
- DOCX extraction: optional `mammoth` package (dynamic import)
- Image files: no text extraction (handled as `ImageContent` by the agent)
- Max extracted length: `MaxExtractedLength` (50,000 chars)

#### EmailService (`src/services/email/email.ts`)
Provider-agnostic email service using the Strategy Pattern. Switches between Resend, Mailgun, or Console logging based on configuration.

- `TemplatesService` loads HTML templates from `public/templates/` directory with Handlebars compilation and caching
- Templates: `invitation.html`, `member-notification.html`

#### PaymentsService (`src/services/payments/payments.ts`)
Provider-agnostic payments service using the Strategy Pattern. Switches between Stripe or Console logging based on configuration.

```typescript
const service = new PaymentsService(config)
// service.service is one of: StripeService | ConsoleService
```

#### SessionStore (`src/services/sessionStore.ts`)
In-memory LLM session store with 1-hour TTL and periodic cleanup (every 5 minutes). Used by AI proxy endpoints to cache session configurations.

#### SandboxService (`src/services/sandboxes/sandbox.ts`)
K8s sandbox pod lifecycle manager with session tracking, idle timeout, shell session management, and subdomain proxy routing.

**State Management:**
- `sessions: Map<podName, TSandboxSession[]>` -- Active SSH sessions per pod
- `passwords: Map<podName, password>` -- SSH password cache
- `podActivity: Map<podName, timestamp>` -- Last activity for idle detection
- `startingPods: Set<sandboxId>` -- Tracks pods being started to prevent races
- Shell sessions: persistent `TShellSession` objects indexed by session ID

**Key Methods:**
- `startPod(sandbox, orgId, projectId?)` -- Generate SSH password, create K8s pod with env vars
- `stopPod(sandbox, orgId)` -- Delete pod, clean up routes and sessions
- `findRunningPod(sandboxId, orgId)` -- Find Running-phase pod
- `findActivePod(sandboxId, orgId)` -- Find Running or Pending pod
- `validatePodOwnership(podName, orgId)` -- Verify pod belongs to org
- `addSession/removeSession/getSessions(podName)` -- Session tracking
- `getPassword/recoverPassword(podName)` -- SSH password management (recovery via `printenv`)
- `addShellSession/getShellSession/removeShellSession(sessionId)` -- Persistent shell session lifecycle
- `attachToShellSession/detachFromShellSession(sessionId, ws)` -- WebSocket attachment management for reconnect/join
- `updateSessionVisibility(sessionId, visibility)` -- Toggle session sharing (private/public)
- `getOrgShellSessionCount(orgId)` -- Count active shell sessions per org (for plan limits)
- `queueEventForPersistence/flushEventBatch(sessionId)` -- Batched event persistence to DB
- `updateActivity(podName)` -- Touch activity timestamp for idle timeout
- `getPodProxy(target)` -- Static method returning `createProxyMiddleware` instance for sandbox subdomain proxying

**Idle Timeout System:**
- Runs check every 60s (configurable)
- Stops pods with no active sessions after 30min (configurable per sandbox via `idleTimeoutMinutes`)
- Active sessions prevent idle shutdown

#### Websocket (`src/services/websocket/websocket.ts`)
Persistent WebSocket session handler for AI agent execution.

**Key Features:**
- Persistent `AgentRunner` lifecycle: reuses runner across turns, destroys and reinits on thread change
- Message types: `prompt`, `cancel`, `steer`, `followUp`, `updateConfig`, `file_upload`, `workspace_manifest`
- File uploads: validates MIME type, size (25MB max), path traversal, creates asset records with text extraction
- Workspace manifest: stores client file listing for agent awareness
- Heartbeat: application-level JSON ping every 25s (avoids Caddy RSV1 bit corruption of protocol-level pings)
- Event bridge: maps `TStreamEvent` types to `EWSEventType` WebSocket messages, detects artifact content in tool results

### Endpoints

#### Agent Execution (`src/endpoints/agents/runAgent.ts`)
**POST `/_/agents/:id/run`** - Run an agent with SSE streaming

The endpoint delegates to `AgentEndpoint.run()` from `services/endpoints/agentEndpoint.ts`.

**Request Flow:**
1. Load agent with provider and secrets (unsanitized to access secret values)
2. Select provider: explicit `providerId` override, or `agent.primaryProvider`
3. Resolve API key via `SecretResolver.resolveApiKey()` (3-tier lookup: agent -> provider -> org)
4. Resolve provider headers and bodyParams via `SecretResolver`
5. Load custom functions attached to agent via junction table
6. Get or create thread
7. Build LLM config with optional overrides (model, maxTokens, systemPrompt, tools, envVars)
8. Build sandbox config from agent environment
9. Stream SSE via `AgentRunner.run()` from `@tdsk/agent`, with `onExecuteFunction` callback for custom function execution via `FunctionExecutor`

**Body:** `prompt` (required), `threadId` (optional), `providerId` (optional)

#### OpenAI-Compatible Chat Completions (`src/endpoints/agents/oaiChatCompletions.ts`)
**POST `/_/agents/:id/v1/chat/completions`** - OpenAI-compatible chat completions endpoint

Accepts the same request shape as the OpenAI API and returns responses in the same format. The agent is identified by the URL `:id` param. Supports both streaming (SSE with `data: [DONE]` sentinel) and non-streaming modes.

**Request Flow:**
1. Validate messages array and extract prompt from last user message
2. Resolve agent config via `resolveAgentConfig()`
3. Convert OpenAI messages to ThreadedStack format (handles tool calls, vision content, tool results)
4. Build overrides from OpenAI params (model, temperature, max_tokens, system messages)
5. Create or reuse thread, seed with converted message history
6. Run agent via `AgentEndpoint` with streaming or non-streaming adapter
7. Return OpenAI-formatted response (`chat.completion` or `chat.completion.chunk`)

**Body:** Standard OpenAI request (`messages`, `model?`, `stream?`, `temperature?`, `max_tokens?`, etc.)

#### OpenAI Models (`src/endpoints/agents/oaiModels.ts`)
**GET `/_/agents/:id/v1/models`** - Returns model list in OpenAI format for the agent's provider

#### Quickstart (`src/endpoints/orgs/orgQuickstart.ts`)
**POST `/_/orgs/:orgId/quickstart`** - Create Provider + Secret + Project + Agent + Endpoint in a single database transaction

**Request Flow:**
1. Validate required fields (template, apiKey, projectName, agentName)
2. Resolve provider template from `ProviderTemplates` (Anthropic/OpenAI/Google/Custom)
3. Create all resources in a single DB transaction: Provider, Secret, Project, Agent, Endpoint

**Body:** `template` (required), `apiKey` (required), `projectName` (required), `agentName` (required), plus optional: `model`, `maxTokens`, `systemPrompt`, `agentDescription`, `providerName`, `providerUrl`

**Response:** `{ data: { provider, secret, project, agent, endpoint } }`

#### Org Creation Seeding (`src/endpoints/orgs/createOrg.ts`)
**POST `/_/orgs`** - When creating an organization, 4 default sandbox presets are automatically seeded from `SandboxPresets` (domain constants):
- Claude Code, Codex, OpenCode, and Base (custom) sandboxes
- All seeded sandboxes have `builtIn: true`
- Seeding failures are non-fatal: the org is still created, with `warnings` array in the 201 response
- User-created sandboxes via `POST /_/sandboxes` always get `builtIn: false` (server-side enforcement)

#### AI Session Creation (`src/endpoints/ai/createSession.ts`)
**POST `/_/ai/sessions`** - Creates LLM session, resolves API key server-side, returns session token

**Request Flow:**
1. Validate request (`agentId` required)
2. Load agent with provider and secrets (unsanitized)
3. Check permission to read agents in this org
4. Resolve API key, provider type, headers, bodyParams via `SecretResolver`
5. Build LLM config (apiKey stays server-side)
6. Create session via `sessionStore.create()`
7. Return session token + non-sensitive config (no apiKey)

**Auth:** JWT or API key (normal auth, under `/_/ai/sessions`)

#### AI WebSocket (`src/endpoints/ai/onWSConnect.ts`)
**WS `/ai/ws`** - WebSocket endpoint for AI agent execution using cached session config

**Connection Flow:**
1. Extract session token from `?token=<token>` query param
2. Load session from `sessionStore`
3. Validate incoming messages (prompt, cancel, steer, followUp, file_upload, workspace_manifest, updateConfig)
4. Execute agent with session config via persistent `Websocket` handler
5. Stream responses via WebSocket messages

**Auth:** Session token only (no JWT/API key -- session token already validated at creation time)

**Response:** WebSocket messages with event types: `start`, `text_start`, `text_delta`, `text_end`, `thinking_start`, `thinking_delta`, `thinking_end`, `toolcall_start`, `toolcall_delta`, `toolcall_end`, `done`, `error`, `ping`, `thread_created`, `file_upload_complete`, `artifact`, `tool_execution_update`, `turn_end`

#### Sandbox Connect (`src/endpoints/sandboxes/connectSandbox.ts`)
**POST `/_/sandboxes/:id/connect`** - Start sandbox pod and return SSH credentials

**Flow:**
1. Check for already-running pod to prevent race conditions
2. Query pending pods and check if startup in progress
3. If needed, start pod (generates random SSH password, stores in memory)
4. Poll pod state until Running (max 120s with 2s polling interval)
5. Handle pod startup failures and cleanup
6. Return pod name, SSH password, port 2222, and CLI command suggestion

**Error codes:** 409 (already starting), 500 (pod failed), 504 (timeout)

#### Sandbox Shell (`src/endpoints/sandboxes/onShellConnect.ts`)
**WS `/_/sandboxes/:id/shell`** - WebSocket-based interactive terminal with SSH PTY

**Auth:** API key in `Authorization: Bearer` header (TSA CLI flow) or shell token in `?token=<token>` query param (browser flow)

**Protocol:**
- Binary frames (browser -> server): raw stdin bytes -> SSH stream
- Text frames (browser -> server): JSON control messages (`resize`, `signal`, `visibility`, `permission-response`)
- Binary frames (server -> browser): raw stdout bytes from SSH stream
- Text frames (server -> browser): JSON status messages (`connected`, `reconnected`, `joined`, `visibility`, `user-joined`, `user-left`, `disconnected`, `error`)
- Text frames (server -> browser): JSON event messages (`{ sessionId, event }` for parsed terminal events)
- Text frames (server -> browser): JSON generative-ui messages (`{ sessionId, chunkId, type: 'generative-ui', tree }`)

**Connection Flow (new session):**
1. Extract sandbox ID from URL, parse query params (cols, rows, run, sessionId)
2. Authenticate via API key hash or shell token (validates sandbox ID match)
3. Check sandbox service/kube availability
4. Find running pod, validate pod ownership (org + pod creator must match)
5. Check `PlanLimits` concurrent session cap for org's subscription tier
6. Validate pod IP and recover SSH password
7. Load sandbox config for runtime info and generative UI config (sandbox-level override -> org-level fallback)
8. Create thread for session history in DB
9. Establish SSH connection via `ssh2.Client`, allocate PTY shell (xterm-256color)
10. Create `TerminalParser` with `onEvent` callback for event broadcasting and persistence
11. Initialize `ChunkBuffer` + `InterpreterService` if generative UI is enabled
12. Register session with `SandboxService` (both shell session and pod session for idle tracking)
13. Execute runtime command if `run=true` and `runtimeCommand` is configured
14. Wire SSH stream -> WebSocket fan-out with backpressure handling

**Reconnect/Join Flow (sessionId param):**
- **Same user reconnect:** Reattaches WebSocket to existing session, drains ring buffer (or parser raw buffer, or DB ptyBuffer fallback), replays persisted events for ChatView history
- **Cross-user join:** Validates session is `public` visibility, verifies org membership, then attaches as observer. Notifies existing clients of `user-joined`

**Session Persistence:**
- Terminal output stored in `RingBuffer` (1MB) for reconnect
- Parser maintains raw buffer for full PTY history
- Events batched and persisted as messages in session thread
- On SSH stream close: flush parser, persist PTY buffer to thread, flush final event batch

**Multi-user Support:**
- Session creator can toggle visibility (private/public) via control message
- Public sessions can be joined by org members
- Input events tagged with `userId` for attribution
- `user-joined`/`user-left` notifications broadcast to all attachments

#### Sandbox Exec (`src/endpoints/sandboxes/execInSandbox.ts`)
**POST `/_/sandboxes/:id/exec`** - Execute a command in a sandbox pod

Uses Kubernetes Exec API (`k8s.Exec`) via `KubeClient.runInPod()` -- commands execute inside the pod via `sh -c`, NOT on the host.

**Body:** `command` (required), `args` (optional), `podName` (required)

#### Sandbox Tunnel (`src/endpoints/sandboxes/onTunnelConnect.ts`)
**WS `/_/sandboxes/:id/tunnel`** - WebSocket-to-TCP bridge for SSH access

**Connection Flow:**
1. Validate API key from Bearer token via hash lookup
2. Verify pod ownership (pod belongs to requesting org)
3. Open TCP connection to pod IP:2222 (SSH port)
4. Bidirectional relay: WebSocket <-> TCP with backpressure handling (64KB threshold)
5. Keepalive pings every 30s to prevent Caddy idle timeout
6. Register session on TCP connect, remove on disconnect

**Close codes:** 4000 (internal), 4001 (auth), 4002 (validation), 4003 (permission), 4004 (not found), 4005 (connection failed)

#### Sandbox Sessions (`src/endpoints/sandboxes/listSessions.ts`)
**GET `/_/sandboxes/:id/sessions`** - List active SSH sessions for a sandbox

#### Sandbox Threads (`src/endpoints/sandboxes/listSandboxThreads.ts`)
**GET `/_/sandboxes/:id/threads`** - List threads associated with a sandbox

#### Copy Sandbox (`src/endpoints/sandboxes/copySandbox.ts`)
**POST `/_/sandboxes/:id/copy`** - Deep-copy a sandbox config with a new ID

**Flow:**
1. Load original sandbox by ID
2. Validate org ownership (`original.orgId !== orgId` -> 404, prevents IDOR)
3. Create new sandbox with all config fields from original
4. Force `builtIn: false` on the copy (user copies are never built-in)
5. Return new sandbox

Registered in both `sandboxes.ts` and `orgSandboxes.ts` routers.

#### Skills CRUD (`src/endpoints/skills/`)
**Under `/_/orgs/:orgId/skills`**:
- **GET `/`** - List skills for org
- **POST `/`** - Create skill
- **GET `/:id`** - Get skill by ID
- **PUT `/:id`** - Update skill
- **DELETE `/:id`** - Delete skill
- **POST `/:id/attach`** - Attach skill to an agent
- **POST `/:id/detach`** - Detach skill from an agent

#### Schedules CRUD (`src/endpoints/schedules/`)
**Under `/_/orgs/:orgId/schedules`**:
- **GET `/`** - List schedules for org
- **POST `/`** - Create schedule (validates cron expression, computes nextRunAt)
- **GET `/:scheduleId`** - Get schedule by ID
- **PUT `/:scheduleId`** - Update schedule
- **DELETE `/:scheduleId`** - Delete schedule
- **POST `/:scheduleId/trigger`** - Manually trigger a schedule (executes agent, marks run with next cron time)

#### Thread File Upload (`src/endpoints/threads/uploadFile.ts`)
**POST `/_/orgs/:orgId/agents/:agentId/threads/:threadId/files`** - Upload a file to a thread

**Body:** `fileName` (required), `data` (required, base64), `mimeType` (required)
**Validation:** MIME type allowlist, 25MB size cap, base64 encoding check, path traversal prevention
**Response:** `{ data: { assetId, fileName, fileType, fileSize, extractedText?, extractionError?, imageData? } }`

#### Provider Models (`src/endpoints/providers/fetchModels.ts`)
**POST `/_/providers/:brand/models`** - Fetch available models for a provider brand

Models sourced from `ModelRegistry` (pi-mono static registry). Ollama special-cased with live fetch from local API. Custom providers return empty list.

**Body:** `{ baseUrl? }` (optional, for Ollama)

### WebSocket Server (`src/server/wsServer.ts`)

Multi-path dispatch WebSocket server using `noServer: true` mode:
- **Static routes**: `/ai/ws` -> `onWSConnect` (AI agent execution)
- **Dynamic pattern routes**:
  - `/_/sandboxes/:id/tunnel` (matched by `SBTunnelPattern`) -> `onTunnelConnect` (sandbox SSH tunnel)
  - `/_/sandboxes/:id/shell` (matched by `SBShellPattern`) -> `onShellConnect` (interactive shell with PTY)

HTTP upgrade listener filters by pathname and routes to the correct handler. Unmatched upgrades destroy the socket. Centralized error logging for connection failures.

### Utilities

#### `requireResourceWithPermission()` (`src/utils/auth/requireResource.ts`)
Permission check + resource fetch helper. Eliminates permission boilerplate from CRUD endpoints.

```typescript
const data = await requireResourceWithPermission(
  req, db.services.apiKey, id,
  EPermAction.read, EPermResource.apiKey, 'API key'
)
res.status(200).json({ data: data.sanitize() })
```

Throws 404 if resource not found, 403 if permission denied.

#### `validateExclusiveArc()` (`src/utils/validation/exclusiveArc.ts`)
Ensures exactly one of multiple fields is set (e.g., orgId OR projectId OR providerId). Throws Exception(400) if 0 or 2+ fields are set.

#### Provider Utilities (`src/utils/providers/`)
- **`resolveProviderType(provider)`** - Resolve LLM provider type (anthropic/openai/google) from provider config
- **`validateProviderType(type)`** - Validate provider type string
- **`validateLLMProvider(type, brand)`** - Validate AI-type providers have `brand` set to a valid `ELLMProviderBrand` value

#### Auth Utilities (`src/utils/auth/`)
- **`checkPermission`** - Check user permission for action on resource in scope
- **`generateInvitationToken`** - Generate invitation token
- **`getBillingPeriod`** - Calculate billing period start/end dates
- **`pxToBeHeader`** - Convert Proxy-to-Backend headers
- **`shouldIgnore`** - Determine if request should bypass auth
- **`validateApiKey`** - API key validation logic

#### Agent Utilities (`src/utils/agent/`)
- **`resolveAgentConfig`** - Shared utility that loads agent + provider + secrets, resolves API key/headers/bodyParams, builds LLM config, loads custom functions and skills. Used by both WebSocket handler and OpenAI-compatible endpoint.

#### Validation Utilities (`src/utils/validation/`)
- **`mimeFromPath`** - Derive MIME type from file path extension
- **`isAllowedMimeType`** - Check MIME type against `FileAllowedMimePrefixes` and `FileAllowedMimeTypes`

#### Proxy Utilities (`src/utils/proxy/`)
- **`extractSNI`** - Extract SNI hostname from TLS ClientHello for egress proxy routing

#### Pagination (`src/utils/pagination.ts`)
Parse pagination query parameters. Defaults: limit=50 (max 200), offset=0.

```typescript
const { limit, offset } = parsePagination(req)
const { data } = await db.services.X.list({ where: {...}, limit, offset })
res.status(200).json({ data, limit, offset })
```

## Architecture

### Application Bootstrap Flow

```
index.ts
  |
start.ts -> loads backend.config.ts
  |
main.ts
  |-- app.locals.config = config   # Store config
  |-- app.locals.email = EmailService  # Email service instance
  |-- app.locals.payments = PaymentsService  # Payments service instance
  |-- setupLogger(app)             # Winston request/error logging
  |-- setupServer(app, router)     # CORS, router mount
  |-- setupDatabase(app)           # DB connection with validation + error handling
  |-- await setupSandbox(app)      # SandboxService (KubeClient) + EgressProxy init
  |-- setupSandboxProxy(app)       # Sandbox subdomain -> pod IP proxy middleware
  |-- setupEndpoints(app, router)  # Dynamic route building (auth is in accounts middleware)
  |-- setupErrorHandler(app)       # Error middleware
  |-- initServer()                 # HTTP/HTTPS server creation
  +-- signals(server)              # Graceful shutdown handlers
```

**Note:** Authentication (`authenticate`), subscription auto-creation (`setupSubscription`), and quota enforcement (`enforceQuota`) are applied as middleware in `accounts.ts`, not as global middleware in `main.ts`.

### Middleware Setup Order

1. **Logger** - Winston request/error logging (from `@tdsk/logger`)
2. **Server Setup** - CORS, basic Express config, router mount
3. **Database** - Database connection with validation
4. **Sandbox** - SandboxService (KubeClient init, pod watcher) + EgressProxy (MITM proxy for outbound traffic)
5. **Sandbox Proxy** - Sandbox subdomain -> pod IP proxy middleware (Caddy wildcard -> backend -> pod)
6. **Endpoints** - Dynamic route registration from `endpoints/` directory
   - `accounts` routes get `express.json()` (with raw body capture), `authenticate`, `setupSubscription`, and `enforceQuota` middleware
   - `proxy` routes dispatch to endpoint type services
7. **Error Handler** - Formats and sends error responses

### Endpoint Definition Pattern

Endpoints are defined as configuration objects or builder functions:

```typescript
// Static endpoint
export const base: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req, res) => { /* handler */ }
}

// Dynamic endpoint with builder (receives app instance)
export const accounts: TEndpointBuilder = (app) => ({
  method: EPMethod.Use,
  path: adminPath(app.locals.config.server),  // e.g., /_
  middleware: [express.json(), authenticate, setupSubscription, enforceQuota],
  endpoints: { ai, auth, base, orgs, users, agents, health, payments, invitations, subscriptions, providerModels }
})
```

### AI Endpoint Architecture

AI endpoints are split into two groups with different auth mechanisms:

1. **Session Creation** (`/_/ai/sessions`) - Normal JWT/API key auth under accounts (`ai.ts`)
   - Creates LLM session with agent's resolved API key, provider, model config
   - API key resolved server-side via SecretResolver (never leaves the backend)
   - Returns session token + non-sensitive config

2. **WebSocket** (`/ai/ws`) - Session-token auth via `?token=<token>` query param
   - Uses session token from `?token=<token>` query param
   - Streams responses via WebSocket using cached session config
   - No API key validation needed (already validated at session creation time)

3. **OpenAI-Compatible** (`/_/agents/:id/v1/chat/completions`) - Normal JWT/API key auth
   - Accepts standard OpenAI request format, returns OpenAI response format
   - Supports streaming (SSE) and non-streaming modes
   - Converts between OpenAI message types and ThreadedStack types (tool calls, vision, tool results)

**Rationale:**
- API keys are never sent over the wire to the client
- Session tokens are scoped to a single agent+provider+model configuration
- Session tokens expire after 1 hour (TTL in sessionStore)
- `pi-ai` provides unified multi-provider LLM streaming (Anthropic, OpenAI, Google)

### Agent Run Flow

When executing an agent via `POST /_/agents/:id/run` (handled by `AgentEndpoint.run()`):

1. Load agent + provider + secrets (unsanitized to access encrypted values)
2. Select provider: explicit `providerId` override, or `agent.primaryProvider`
3. Resolve API key via `SecretResolver.resolveApiKey(agent, provider)` (3-tier: agent -> provider -> org)
4. Resolve provider headers via `SecretResolver.resolveHeaders()` (template substitution)
5. Resolve provider bodyParams via `SecretResolver.resolveBodyParams()` (handles non-string values)
6. Load custom functions attached to agent via junction table (`db.services.function.listByAgent`)
7. Get or create thread
8. Build LLM config with optional overrides (model, maxTokens, systemPrompt, tools, envVars)
9. Build sandbox config from agent environment options
10. Stream SSE via `AgentRunner.run()` from `@tdsk/agent` with `onExecuteFunction` callback for custom function execution via `FunctionExecutor`

### Shell Session Architecture

Shell sessions provide persistent interactive terminal access to sandbox pods with multi-user support.

```
Browser/CLI                         Backend                           Pod
    |                                  |                               |
    |-- WS connect (shell) -------->   |                               |
    |                                  |-- SSH connect (ssh2) ------> |
    |                                  |   (PTY: xterm-256color)       |
    |                                  |                               |
    |<---- binary (stdout) --------   |<---- SSH stream data -------  |
    |<---- JSON (events) ----------   |                               |
    |<---- JSON (generative-ui) ---   |                               |
    |                                  |                               |
    |-- binary (stdin) ------------>   |-- SSH stream write --------> |
    |-- JSON (resize/signal) ----->   |-- setWindow/write ----------> |
    |                                  |                               |
    |                   TerminalParser |                               |
    |                     |            |                               |
    |                     v            |                               |
    |               onEvent -> broadcast + persist                    |
    |                     |                                            |
    |                     v (if guiConfig enabled)                    |
    |               ChunkBuffer -> InterpreterService -> LLM         |
    |                     |                                            |
    |                     v                                            |
    |<-- generative-ui tree broadcast                                 |
```

**Key Design Decisions:**
- Sessions survive WebSocket disconnects (persistent in `SandboxService`)
- Ring buffer (1MB) stores output during disconnect gaps
- Thread-per-session stores event history in DB
- Parser raw buffer provides full PTY history for reconnect
- `PlanLimits` enforces per-tier concurrent session caps
- Generative UI config resolves from sandbox-level, then falls back to org-level

## API Routes

All routes are documented in the root CLAUDE.md architecture diagram and are discoverable in `src/endpoints/`. Key non-obvious routes:

- **POST `/_/agents/:id/run`** - Run agent with SSE streaming (body: `{ prompt, threadId?, providerId? }`)
- **POST `/_/agents/:id/v1/chat/completions`** - OpenAI-compatible chat completions (body: standard OpenAI request)
- **GET `/_/agents/:id/v1/models`** - OpenAI-compatible model list
- **POST `/_/orgs/:orgId/quickstart`** - Single-transaction create (Provider + Secret + Project + Agent + Endpoint)
- **POST `/_/ai/sessions`** - Create LLM session (JWT/API key auth)
- **WS `/ai/ws`** - AI agent WebSocket (session token auth: `?token=<token>`)
- **ALL `/proxy/:projectId/:endpointId`** - Dispatches to endpoint type service via `getEPService()`
- **POST `/_/threads/:id/branch`** - Branch thread from specific message
- **POST `/_/orgs/:orgId/agents/:agentId/threads/:threadId/files`** - Upload file to thread
- **POST `/_/payments/webhook`** - Stripe webhook handler
- **POST `/_/sandboxes/:id/connect`** - Start sandbox pod and return SSH credentials
- **POST `/_/sandboxes/:id/copy`** - Deep-copy sandbox config (forces `builtIn: false`)
- **POST `/_/sandboxes/:id/exec`** - Execute command in sandbox pod via K8s Exec API
- **GET `/_/sandboxes/:id/sessions`** - List active SSH sessions
- **GET `/_/sandboxes/:id/threads`** - List threads for a sandbox
- **WS `/_/sandboxes/:id/tunnel`** - WebSocket SSH tunnel to sandbox pod
- **WS `/_/sandboxes/:id/shell`** - WebSocket interactive shell with PTY, parser, event persistence
- **POST `/_/orgs/:orgId/skills`** - Create skill
- **POST `/_/orgs/:orgId/skills/:id/attach`** - Attach skill to agent
- **POST `/_/orgs/:orgId/skills/:id/detach`** - Detach skill from agent
- **POST `/_/orgs/:orgId/schedules`** - Create schedule with cron expression
- **POST `/_/orgs/:orgId/schedules/:scheduleId/trigger`** - Manually trigger schedule execution
- **POST `/_/providers/:brand/models`** - Fetch available models for a provider brand

All admin routes (`/_/*`) are protected by JWT authentication middleware except those in `AuthIgnore` list (`/`, `/health`, `/payments/webhooks`). All list endpoints support `?limit=N&offset=N` pagination. POST routes are subject to `enforceQuota` middleware.

## Logic Flow

### Request Flow

```
1. Request arrives at Express app
2. Winston logger logs the request
3. CORS middleware checks origin
4. Database connection validated
5. Sandbox subdomain proxy checked (if hostname matches sandbox pattern, forward to pod)
6. Router attempts to match endpoint:
   |-- /_/* routes (accounts):
   |  |-- express.json() parses body (with raw body capture for webhooks)
   |  |-- authenticate (JWT auth)
   |  |-- setupSubscription (ensures free tier subscription exists)
   |  |-- enforceQuota (checks tier-based POST limits)
   |  +-- Execute endpoint handler
   |-- /proxy/* routes:
   |  +-- Dispatch to endpoint type service via getEPService()
   +-- WebSocket upgrades (handled by wsServer):
      |-- /ai/ws -> onWSConnect (session token auth)
      |-- /_/sandboxes/:id/tunnel -> onTunnelConnect (API key auth)
      +-- /_/sandboxes/:id/shell -> onShellConnect (API key or shell token auth)
6. Response sent or error thrown
7. Error handler formats error response
```

### Authentication Flow

```
1. Request enters authenticate middleware (applied in accounts.ts)
2. Check if path should be ignored (shouldIgnore: /, /health, /payments/webhooks)
   |-- Yes: Skip to next middleware
   +-- No: Continue authentication
3. Extract Bearer token from Authorization header
4. Validate token with database (Neon Auth)
   |-- Valid: Attach user to req.user
   +-- Invalid: Return 401 error
5. setupSubscription middleware ensures free tier subscription exists
6. enforceQuota middleware checks POST route limits against tier
7. Continue to endpoint handler
```

### Endpoint Registration Flow

```
1. setupEndpoints called with app and router
2. Iterate through endpoints object (proxy, accounts)
3. For each endpoint:
   |-- If builder function: Call with app
   +-- If config object: Use directly
4. Validate endpoint (method, path)
5. Auto-inject param validation for routes with :id or :xxxId params
6. Determine endpoint type:
   |-- EPMethod.Use: Create nested router, recursively build children
   |-- EPMethod.Proxy or has proxy config: Create proxy middleware via endpointProxy
   +-- Has action: Use action handler
7. Register with Express router
8. If public: Add to publicRoutes list
```

## Key Patterns

### 1. Async Router Pattern

All route handlers are automatically wrapped with `express-async-handler` to catch errors:

```typescript
export const createAsyncRouter = () => {
  const Router = express.Router()
  Router.get = (endpoint, ...args) =>
    Get(endpoint, ...args.map(handler => asyncHandler(handler)))
  // ... similar for post, put, patch, delete, all, use
  return Router
}
```

### 2. Configuration-Driven Endpoints

Endpoints are defined declaratively, then dynamically registered:

```typescript
export const endpoints = {
  proxy,
  accounts,   // Builder function
}
// setupEndpoints(app, router) iterates and registers
```

### 3. Middleware Composition

Endpoints can specify middleware arrays:

```typescript
{
  path: '/_',
  middleware: [express.json(), authenticate, setupSubscription, enforceQuota],
  endpoints: { /* nested */ }
}
```

### 4. Error Handling

Custom `Exception` class with HTTP status codes:

```typescript
throw new Exception(400, 'Invalid request', 'BAD_REQUEST')
// Caught by global error handler:
res.status(status).json({ error: message, ...(code && { code }) })
```

### 5. Strategy Pattern for Services

EmailService and PaymentsService use the Strategy Pattern to support multiple providers:

```typescript
const email = new EmailService({ type: 'resend', apiKey: '...' })
await email.invitation({ email, orgName, inviterName, ... })

const payments = new PaymentsService({ type: 'stripe', accessToken: '...' })
await payments.service.createCheckoutSession({ ... })
```

### 6. Permission Helper Pattern

CRUD endpoints use `requireResourceWithPermission()` to reduce boilerplate (see Utilities section).

### 7. Pagination Pattern

All list endpoints support pagination via `parsePagination(req)` (see Utilities section).

### 8. Persistent Session Pattern

Shell sessions and AI WebSocket sessions use a persistent session broker:
- Sessions outlive individual WebSocket connections
- Reconnection replays buffered output and persisted events
- Multi-user attachment model for collaborative sessions
- TTL-based cleanup for abandoned sessions

## Types

### `shellSession.types.ts`
- **`TShellSession`** - Persistent shell session state: SSH client/stream, parser, ring buffer, attachments set, tool state, visibility, thread/sandbox/org/project IDs
- **`TShellControlMsg`** - Client-to-server control messages: `resize`, `signal` (SIGINT/SIGTSTP), `visibility`, `permission-response`
- **`TShellServerMsg`** - Server-to-client status messages: `connected`, `reconnected`, `joined`, `disconnected`, `error`, `visibility`, `user-joined`, `user-left`
- **`TWebSocketMeta`** - Per-WebSocket metadata: sessionId, joinedUserId (for cross-user joins)

### `oai.types.ts`
- **`TOAIRequest`** - OpenAI chat completion request (messages, model, stream, temperature, max_tokens, etc.)
- **`TOAIMessage`** - OpenAI message (role, content as string or content parts, tool_calls)
- **`TOAIContentPart`** - Text or image_url content parts
- **`TOAIToolCall`** - Function tool call with id, name, arguments
- **`TOAIResponse`** / **`TOAIChunk`** - Non-streaming and streaming response shapes
- **`TOAIUsage`** - Token usage (prompt_tokens, completion_tokens, total_tokens)
- **`TOAIFinishReason`** - `stop`, `length`, `tool_calls`, `content_filter`
- **`TOAIErrorBody`** / **`TOAIErrorType`** - Error response format
- **`TOAIModel`** / **`TOAIModelList`** - Model list response format

## Constants

### Authentication
```typescript
AuthIgnore = ['/', '/health', '/payments/webhooks']
```

### Logging
```typescript
LoggerIgnore = {
  methods: ['OPTIONS'],
  routes: ['/.well-known/appspecific/com.chrome.devtools.json']
}
```

### Retry Logic
```typescript
AllowedRetryCodes = [408, 429, 500, 502, 503, 504]

DefRetryCfg = {
  maxRetries: 3,
  initialDelay: 1000,      // 1 second
  maxDelay: 30000,         // 30 seconds
  backoffMultiplier: 2,
  exponentialBackoff: true
}
```

### Pagination
```typescript
DBPaging = { max: 200, default: 50 }
```

### File Handling
```typescript
FileMaxSize = 25 * 1024 * 1024           // 25MB upload limit
FileAllowedMimePrefixes = ['text/', 'image/']
MaxExtractedLength = 50_000              // Max chars extracted from PDF/DOCX/text
MaxOutputBytes = 1_048_576               // 1MB function output cap
RequestBodyMaxSize = 1_048_576           // 1MB request body limit
DefaultTimeoutMS = 30_000               // 30s default execution timeout
```

### Sandbox
```typescript
SBTcpTimeout = 10_000           // TCP connection timeout
SBBackpressureThreshold = 64KB  // Pause TCP when WS buffer exceeds this
SBBackpressureMaxWait = 30_000  // Max backpressure wait before force resume
SBTunnelPattern = /^\/_\/sandboxes\/([^/]+)\/tunnel$/
SBShellPattern = /^\/_\/sandboxes\/([^/]+)\/shell$/
DefSBConfig = { timeoutMin: 30, maxWait: 120_000, pollInterval: 2_000, idleInterval: 60_000 }
```

### Egress Proxy
```typescript
PhTokenPrefix = 'tdsk_ph_'     // Placeholder token prefix
CACertPath = '/etc/tdsk/ca/tls.crt'
CAKeyPath = '/etc/tdsk/ca/tls.key'
RealIpHeader = 'x-tdsk-real-ip'
```

### WebSocket
```typescript
WsPingIntervalMS = 25_000      // Heartbeat interval
SessionTtlSec = 3600           // 1-hour session token TTL
ClientMsgTypes = Set(['steer', 'prompt', 'cancel', 'followUp', 'file_upload', 'updateConfig', 'workspace_manifest'])
```

## Integration Points

### Workspace Dependencies
- `@tdsk/domain` - Shared types and domain models (TApp, TRequest, TResponse, TABConfig, TerminalParser, GhosttyVT, PlanLimits, SandboxPresets, ESandboxSessionVisibility, TGuiConfig, TToolState)
- `@tdsk/database` - Database ORM (Drizzle) and services; stored on `app.locals.db`
- `@tdsk/logger` - Winston logging service
- `@tdsk/agent` - AI agent runtime, `AgentRunner` for persistent multi-turn execution with tool use
- `@tdsk/sandbox` - Pluggable sandbox execution (E2b Firecracker microVMs or local just-bash + V8 isolate), `PodLabelKeys`, `parseSandboxHost`

### LLM Integration
- `@mariozechner/pi-ai` provides unified multi-provider LLM streaming (used by streamChat for SSE proxy and by InterpreterService for generative UI)
- Individual LLM SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`) are dependencies of `@tdsk/agent`, not the backend directly
- `ModelRegistry` (from `services/providers/modelRegistry.ts`) provides static model catalogs from pi-mono

### Shell Integration
- `ssh2` - SSH client library for establishing PTY sessions to sandbox pods
- `ws` - WebSocket library for client connections (shell, tunnel, AI)
- Domain's `TerminalParser` and `GhosttyVT` (WASM) for parsing terminal output into structured events

### Egress Proxy Integration
- `http-mitm-proxy` - MITM proxy library for intercepting outbound HTTP/HTTPS from sandbox pods
- CA certificates mounted at `/etc/tdsk/ca/` for TLS interception
- iptables DNAT rules in pod init container redirect outbound traffic to egress proxy

### Auth-Proxy Communication
- Receives admin requests from Auth-Proxy at `/_/*` paths
- Proxies back to Auth-Proxy for unmatched routes via `setupProxy`
- Configured via `TDSK_BE_REMOTE` and `TDSK_BE_REMOTE_PORT`

### Debugging
- Set `TDSK_BE_LOGGER_LEVEL=debug` for verbose logs
- Use `TDSK_BE_LOGGER_PRETTY=true` for formatted logs

---

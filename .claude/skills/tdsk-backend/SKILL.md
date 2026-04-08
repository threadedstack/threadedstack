---
name: "tdsk-backend"
description: "Knowledge base for the backend Core API repo"
tags: ["express", "nodejs", "api", "backend", "payments", "stripe", "ai", "session", "proxy", "secrets", "pi-ai"]
---
# Backend Repo Skill

## Overview

The **Backend** repo (`repos/backend`) serves as the Core API server for Threaded Stack. It is built on Express 5.1.0 and acts as the central orchestration layer for:

- **Admin CRUD operations** - Organization, project, user, API key, secret, endpoint, provider, agent, thread, invitation, and subscription management
- **Proxy Engine** - Secure API proxying with secret injection, OAuth 2.0, retry logic, and header/body transforms via endpoint type services (ProxyEndpoint, AgentEndpoint, FaaSEndpoint)
- **AI Engine** - LLM proxy with SSE streaming via `@mariozechner/pi-ai`, session-based API key resolution, and AgentRunner integration
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
│   ├── constants/           # envs.ts, values.ts, sandbox.ts (AuthIgnore, AllowedRetryCodes, DBPaging, SBTcpTimeout, DefSBConfig)
│   ├── endpoints/           # API route definitions
│   │   ├── agents/          # CRUD + runAgent (SSE streaming via AgentEndpoint)
│   │   ├── ai/              # sessions + streamChat (SSE LLM proxy via pi-ai)
│   │   ├── apiKeys/         # CRUD with generation, scoping, rate limiting
│   │   ├── auth/            # Authentication endpoints
│   │   ├── base/            # Base + health endpoints
│   │   ├── domains/         # Domain CRUD
│   │   ├── endpoints/       # Endpoint definitions CRUD
│   │   ├── functions/       # Function CRUD
│   │   ├── invitations/     # Invitation CRUD + accept/revoke/pending
│   │   ├── orgs/            # Orgs CRUD + members + roles + quickstart + nested resources
│   │   ├── payments/        # Payment endpoints + webhook
│   │   ├── projects/        # Projects CRUD
│   │   ├── providers/       # Provider configurations
│   │   ├── proxy/           # Proxy endpoint routing (dispatches to endpoint type services)
│   │   ├── sandboxes/       # Sandbox CRUD + lifecycle (connect, tunnel, start, stop, status, sessions)
│   │   ├── quotas/          # Quota checking and limits
│   │   ├── secrets/         # Secrets with AES-256-GCM encryption
│   │   ├── subscriptions/   # Subscription management
│   │   ├── threads/         # Thread CRUD + messages + branching
│   │   ├── users/           # Users CRUD
│   │   ├── accounts.ts      # Main accounts routes (/_/*) — auth middleware applied here
│   │   ├── endpoints.ts     # Endpoint registry (aiStream, proxy, accounts)
│   │   └── index.ts
│   ├── middleware/           # Express middleware setup
│   │   ├── authorize.ts     # Authorization middleware
│   │   ├── setupAuth.ts     # JWT authentication (authenticate function)
│   │   ├── setupDatabase.ts # Database connection with validation
│   │   ├── setupEndpoints.ts # Dynamic route builder with param auto-validation
│   │   ├── setupErrorHandler.ts # Error handling
│   │   ├── setupLogger.ts   # Winston logging
│   │   ├── setupProxy.ts    # Proxy to Auth-Proxy
│   │   ├── setupServer.ts   # CORS, base setup
│   │   ├── setupSubscription.ts # Auto-create free tier subscription
│   │   └── index.ts
│   ├── mocks/               # Test mocks
│   ├── server/              # Express app, router, HTTP server setup
│   ├── services/            # Service layer (see Services section)
│   ├── types/               # TypeScript type definitions
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
- **`configs/backend.config.ts`** - Loads environment variables and builds the application config object with sections for `server`, `proxy`, `database`, `logger`, `email`, and `payments`

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
- **`setupProxy.ts`** - Proxies remaining requests to Auth-Proxy service
- **`setupErrorHandler.ts`** - Error handling middleware
- **`authorize.ts`** - Role-based authorization middleware

### Endpoint Type Services (`src/services/endpoints/`)

The endpoint type system uses polymorphic dispatch to handle different endpoint types (proxy, FaaS, agent). Each type has a dedicated service class that extends `BaseEndpoint`.

- **`base.ts`** - Abstract `BaseEndpoint` class providing shared operations: permission checks (`checkPermission`), project validation (`validateProject`), method validation (`validateMethod`), and secret fetching (`fetchSecrets`)
- **`agentEndpoint.ts`** - `AgentEndpoint` class: loads agent + provider + secrets, resolves API key via `SecretResolver`, resolves headers/bodyParams, loads custom functions, creates/reuses thread, streams SSE via `AgentRunner.run()` from `@tdsk/agent`. Shared `run()` method is used by both the admin `POST /_/agents/:id/run` route and the proxy engine
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
- 1 MB output cap, configurable timeout (default 30s)

### Services

#### SecretResolver (`src/services/secrets/secretResolver.ts`)
Service for resolving, decrypting, and replacing secret references. Handles `{{SECRET_NAME}}` template substitution, multi-scope decryption, and 3-tier API key resolution.

**Usage in Agent Execution:**
```typescript
const secrets = new SecretResolver(db)
const apiKey = await secrets.resolveApiKey(agent)  // 3-tier lookup: agent → provider → org
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
K8s sandbox pod lifecycle manager with session tracking and idle timeout.

**State Management:**
- `sessions: Map<podName, TSandboxSession[]>` — Active SSH sessions per pod
- `passwords: Map<podName, password>` — SSH password cache
- `podActivity: Map<podName, timestamp>` — Last activity for idle detection
- `startingPods: Set<sandboxId>` — Tracks pods being started to prevent races

**Key Methods:**
- `startPod(sandbox, orgId, projectId?)` — Generate SSH password, create K8s pod with env vars
- `stopPod(sandbox, orgId)` — Delete pod, clean up routes and sessions
- `findRunningPod(sandboxId, orgId)` — Find Running-phase pod
- `findActivePod(sandboxId, orgId)` — Find Running or Pending pod
- `validatePodOwnership(podName, orgId)` — Verify pod belongs to org
- `addSession/removeSession/getSessions(podName)` — Session tracking
- `getPassword/recoverPassword(podName)` — SSH password management (recovery via `printenv`)

**Idle Timeout System:**
- Runs check every 60s (configurable)
- Stops pods with no active sessions after 30min (configurable per sandbox via `idleTimeoutMinutes`)
- Active sessions prevent idle shutdown

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
3. Validate incoming messages
4. Execute agent with session config
5. Stream responses via WebSocket messages

**Auth:** Session token only (no JWT/API key — session token already validated at creation time)

**Response:** WebSocket messages with event types: `start`, `text_start`, `text_delta`, `text_end`, `thinking_start`, `thinking_delta`, `thinking_end`, `toolcall_start`, `toolcall_delta`, `toolcall_end`, `done`, `error`

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

#### Sandbox Tunnel (`src/endpoints/sandboxes/onTunnelConnect.ts`)
**WS `/_/sandboxes/:id/tunnel`** - WebSocket-to-TCP bridge for SSH access

**Connection Flow:**
1. Validate API key from Bearer token via hash lookup
2. Verify pod ownership (pod belongs to requesting org)
3. Open TCP connection to pod IP:2222 (SSH port)
4. Bidirectional relay: WebSocket ↔ TCP with backpressure handling (64KB threshold)
5. Keepalive pings every 30s to prevent Caddy idle timeout
6. Register session on TCP connect, remove on disconnect

**Close codes:** 4000 (internal), 4001 (auth), 4002 (validation), 4003 (permission), 4004 (not found), 4005 (connection failed)

#### Sandbox Sessions (`src/endpoints/sandboxes/listSessions.ts`)
**GET `/_/sandboxes/:id/sessions`** - List active SSH sessions for a sandbox

#### Copy Sandbox (`src/endpoints/sandboxes/copySandbox.ts`)
**POST `/_/sandboxes/:id/copy`** - Deep-copy a sandbox config with a new ID

**Flow:**
1. Load original sandbox by ID
2. Validate org ownership (`original.orgId !== orgId` → 404, prevents IDOR)
3. Create new sandbox with all config fields from original
4. Force `builtIn: false` on the copy (user copies are never built-in)
5. Return new sandbox

Registered in both `sandboxes.ts` and `orgSandboxes.ts` routers.

### WebSocket Server (`src/server/wsServer.ts`)

Multi-path dispatch WebSocket server using `noServer: true` mode:
- **Static routes**: `/ai/ws` → `onWSConnect` (AI agent execution)
- **Dynamic pattern routes**: `/_/sandboxes/:id/tunnel` → `onTunnelConnect` (sandbox SSH tunnel)

HTTP upgrade listener filters by pathname and routes to the correct handler. Centralized error logging for connection failures.

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
  ↓
start.ts → loads backend.config.ts
  ↓
main.ts
  ├─ app.locals.config = config   # Store config
  ├─ app.locals.email = EmailService  # Email service instance
  ├─ app.locals.payments = PaymentsService  # Payments service instance
  ├─ setupLogger(app)             # Winston request/error logging
  ├─ setupServer(app, router)     # CORS, router mount
  ├─ setupDatabase(app)           # DB connection with validation + error handling
  ├─ setupEndpoints(app, router)  # Dynamic route building (auth is in accounts middleware)
  ├─ setupErrorHandler(app)       # Error middleware
  ├─ initServer()                 # HTTP/HTTPS server creation
  └─ signals(server)              # Graceful shutdown handlers
```

**Note:** Authentication (`authenticate`) and subscription auto-creation (`setupSubscription`) are applied as middleware in `accounts.ts`, not as global middleware in `main.ts`.

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
  middleware: [express.json(), authenticate, setupSubscription],
  endpoints: { ai, auth, base, orgs, users, health, payments, invitations, subscriptions }
})
```

### Middleware Setup Order

1. **Logger** - Winston request/error logging (from `@tdsk/logger`)
2. **Server Setup** - CORS, basic Express config, router mount
3. **Database** - Database connection with validation
4. **Endpoints** - Dynamic route registration from `endpoints/` directory
   - `accounts` routes get `express.json()`, `authenticate`, and `setupSubscription` middleware
   - `aiStream` routes get `express.json()` middleware (session-token auth in handler)
   - `proxy` routes dispatch to endpoint type services
5. **Error Handler** - Formats and sends error responses

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

## API Routes

All routes are documented in the root CLAUDE.md architecture diagram and are discoverable in `src/endpoints/`. Key non-obvious routes:

- **POST `/_/agents/:id/run`** - Run agent with SSE streaming (body: `{ prompt, threadId?, providerId? }`)
- **POST `/_/orgs/:orgId/quickstart`** - Single-transaction create (Provider + Secret + Project + Agent + Endpoint)
- **POST `/_/ai/sessions`** - Create LLM session (JWT/API key auth)
- **WS `/ai/ws`** - AI agent WebSocket (session token auth: `?token=<token>`)
- **ALL `/proxy/:projectId/:endpointId`** - Dispatches to endpoint type service via `getEPService()`
- **POST `/_/threads/:id/branch`** - Branch thread from specific message
- **POST `/_/payments/webhook`** - Stripe webhook handler
- **POST `/_/sandboxes/:id/connect`** - Start sandbox pod and return SSH credentials
- **POST `/_/sandboxes/:id/copy`** - Deep-copy sandbox config (forces `builtIn: false`)
- **GET `/_/sandboxes/:id/sessions`** - List active SSH sessions
- **WS `/_/sandboxes/:id/tunnel`** - WebSocket SSH tunnel to sandbox pod

All admin routes (`/_/*`) are protected by JWT authentication middleware except those in `AuthIgnore` list (`/`, `/health`). All list endpoints support `?limit=N&offset=N` pagination.

## Logic Flow

### Request Flow

```
1. Request arrives at Express app
2. Winston logger logs the request
3. CORS middleware checks origin
4. Database connection validated
5. Router attempts to match endpoint:
   ├─ /_/* routes (accounts):
   │  ├─ express.json() parses body
   │  ├─ authenticate (JWT auth)
   │  ├─ setupSubscription (ensures free tier subscription exists)
   │  └─ Execute endpoint handler
   ├─ /ai/* routes (aiStream):
   │  ├─ express.json() parses body
   │  └─ Execute handler (session-token auth in handler)
   └─ /proxy/* routes:
      └─ Dispatch to endpoint type service via getEPService()
6. Response sent or error thrown
7. Error handler formats error response
```

### Authentication Flow

```
1. Request enters authenticate middleware (applied in accounts.ts)
2. Check if path should be ignored (shouldIgnore: /, /health)
   ├─ Yes: Skip to next middleware
   └─ No: Continue authentication
3. Extract Bearer token from Authorization header
4. Validate token with database (Neon Auth)
   ├─ Valid: Attach user to req.user
   └─ Invalid: Return 401 error
5. setupSubscription middleware ensures free tier subscription exists
6. Continue to endpoint handler
```

### Endpoint Registration Flow

```
1. setupEndpoints called with app and router
2. Iterate through endpoints object (aiStream, proxy, accounts)
3. For each endpoint:
   ├─ If builder function: Call with app
   └─ If config object: Use directly
4. Validate endpoint (method, path)
5. Auto-inject param validation for routes with :id or :xxxId params
6. Determine endpoint type:
   ├─ EPMethod.Use: Create nested router, recursively build children
   ├─ EPMethod.Proxy or has proxy config: Create proxy middleware via endpointProxy
   └─ Has action: Use action handler
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
  aiStream,   // Config object
}
// setupEndpoints(app, router) iterates and registers
```

### 3. Middleware Composition

Endpoints can specify middleware arrays:

```typescript
{
  path: '/_',
  middleware: [express.json(), authenticate],
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

## Constants

### Authentication
```typescript
AuthIgnore = ['/', '/health']
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

### Sandbox
```typescript
SBTcpTimeout = 10_000           // TCP connection timeout
SBBackpressureThreshold = 64KB  // Pause TCP when WS buffer exceeds this
SBBackpressureMaxWait = 30_000  // Max backpressure wait before force resume
SBTunnelPattern = /^\/_\/sandboxes\/([^/]+)\/tunnel$/
DefSBConfig = { timeoutMin: 30, maxWait: 120_000, pollInterval: 2_000, idleInterval: 60_000 }
```

## Integration Points

### Workspace Dependencies
- `@tdsk/domain` - Shared types and domain models (TApp, TRequest, TResponse, TABConfig)
- `@tdsk/database` - Database ORM (Drizzle) and services; stored on `app.locals.db`
- `@tdsk/logger` - Winston logging service
- `@tdsk/agent` - AI agent runtime, `AgentRunner.run()` for SSE streaming with tool use
- `@tdsk/sandbox` - Pluggable sandbox execution (E2b Firecracker microVMs or local just-bash + V8 isolate)

### LLM Integration
- `@mariozechner/pi-ai` provides unified multi-provider LLM streaming (used by streamChat for SSE proxy)
- Individual LLM SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`) are dependencies of `@tdsk/agent`, not the backend directly

### Auth-Proxy Communication
- Receives admin requests from Auth-Proxy at `/_/*` paths
- Proxies back to Auth-Proxy for unmatched routes via `setupProxy`
- Configured via `TDSK_BE_REMOTE` and `TDSK_BE_REMOTE_PORT`

### Debugging
- Set `TDSK_BE_LOGGER_LEVEL=debug` for verbose logs
- Use `TDSK_BE_LOGGER_PRETTY=true` for formatted logs

---

---
name: "Threaded Stack - Backend Repo"
description: "Knowledge base for the backend Core API repo"
tags: ["express", "nodejs", "api", "backend", "payments", "polar", "ai", "session", "proxy", "secrets", "pi-ai"]
---
# Backend Repo Skill

## Overview

The **Backend** repo (`repos/backend`) serves as the Core API server for Threaded Stack. It is built on Express 5.1.0 and acts as the central orchestration layer for:

- **Admin CRUD operations** - Organization, project, user, API key, secret, endpoint, provider, agent, thread, invitation, and subscription management
- **Proxy Engine** - Secure API proxying with secret injection, OAuth 2.0, retry logic, and header/body transforms via endpoint type services (ProxyEndpoint, AgentEndpoint, FaaSEndpoint)
- **AI Engine** - LLM proxy with SSE streaming via `@mariozechner/pi-ai`, session-based API key resolution, and AgentRunner integration
- **Payment Integration** - Polar.sh subscription management with quota tracking
- **Email Service** - Invitation and notification emails via Resend/Mailgun/Console

The backend receives all admin requests from the Auth-Proxy service at `/_/*` paths and handles internal business logic before interacting with the database or external services.

## Directory Structure

```
repos/backend/
├── configs/
│   ├── backend.config.ts    # Main configuration loader
│   ├── biome.json           # Linter/formatter config
│   ├── tsup.config.ts       # Build configuration
│   ├── vitest.config.ts     # Test configuration
│   └── aliases.ts           # Path aliases (@TBE/*, @TDM/*)
├── src/
│   ├── constants/           # Application constants
│   │   ├── envs.ts         # Environment variable names
│   │   ├── values.ts       # Static values (AuthIgnore, AllowedRetryCodes, DBPaging)
│   │   └── index.ts
│   ├── endpoints/           # API route definitions
│   │   ├── agents/         # 10 files: CRUD + runAgent (SSE streaming via AgentEndpoint)
│   │   ├── ai/             # 7 files: sessions + streamChat (SSE LLM proxy via pi-ai)
│   │   │   ├── ai.ts       # /_/ai group (JWT/API key auth, under accounts)
│   │   │   ├── stream.ts   # /ai group (top-level, no JWT auth — session-token only)
│   │   │   ├── createSession.ts  # POST /_/ai/sessions — creates LLM session
│   │   │   ├── streamChat.ts     # POST /ai/stream — SSE LLM proxy via pi-ai
│   │   │   └── index.ts
│   │   ├── apiKeys/        # CRUD with generation, scoping, rate limiting
│   │   ├── auth/           # Authentication endpoints
│   │   ├── base/           # Base + health endpoints
│   │   ├── domains/        # Domain CRUD
│   │   ├── endpoints/      # Endpoint definitions CRUD
│   │   ├── functions/      # Function CRUD
│   │   ├── invitations/    # Invitation CRUD + accept/revoke/pending
│   │   ├── orgs/           # Orgs CRUD + members + roles + quickstart + nested resources
│   │   │   ├── orgs.ts
│   │   │   ├── createOrg.ts, getOrg.ts, updateOrg.ts, deleteOrg.ts, listOrgs.ts
│   │   │   ├── listOrgMembers.ts, addOrgMember.ts, removeOrgMember.ts, updateMemberRole.ts
│   │   │   ├── updateOrgRole.ts, deleteOrgRole.ts
│   │   │   ├── inviteOrgUser.ts
│   │   │   ├── orgQuickstart.ts  # Single-transaction create (Provider+Secret+Project+Agent+Endpoint)
│   │   │   ├── orgAgents.ts, orgApiKeys.ts, orgDomains.ts, orgProjects.ts, orgProviders.ts, orgSecrets.ts, orgQuotas.ts
│   │   │   └── index.ts
│   │   ├── payments/       # Payment endpoints + webhook
│   │   ├── projects/       # Projects CRUD
│   │   ├── providers/      # Provider configurations
│   │   ├── proxy/          # Proxy endpoint routing (dispatches to endpoint type services)
│   │   │   ├── proxy.ts    # /proxy group
│   │   │   └── endpoint.ts # /proxy/:projectId/:endpointId — dispatches via getEPService
│   │   ├── quotas/         # Quota checking and limits
│   │   ├── secrets/        # Secrets with AES-256-GCM encryption
│   │   ├── subscriptions/  # Subscription management
│   │   ├── threads/        # Thread CRUD + messages + branching
│   │   ├── users/          # Users CRUD
│   │   ├── accounts.ts     # Main accounts routes (/_/*) — auth middleware applied here
│   │   ├── endpoints.ts    # Endpoint registry (aiStream, proxy, accounts)
│   │   └── index.ts
│   ├── middleware/          # Express middleware setup
│   │   ├── authorize.ts    # Authorization middleware
│   │   ├── setupAuth.ts    # JWT authentication (authenticate function)
│   │   ├── setupDatabase.ts # Database connection with validation
│   │   ├── setupEndpoints.ts # Dynamic route builder with UUID param auto-validation
│   │   ├── setupErrorHandler.ts # Error handling
│   │   ├── setupLogger.ts  # Winston logging
│   │   ├── setupProxy.ts   # Proxy to Auth-Proxy
│   │   ├── setupServer.ts  # CORS, base setup
│   │   ├── setupSubscription.ts # Auto-create free tier subscription
│   │   └── index.ts
│   ├── mocks/              # Test mocks
│   │   ├── endpoints.ts
│   │   └── index.ts
│   ├── server/              # Express app and server setup
│   │   ├── app.ts          # Express app instance
│   │   ├── router.ts       # Async router wrapper
│   │   ├── server.ts       # HTTP/HTTPS server creation
│   │   └── index.ts
│   ├── services/            # Service layer
│   │   ├── endpoints/      # Endpoint type services (polymorphic dispatch)
│   │   │   ├── base.ts           # BaseEndpoint abstract class (permissions, secrets, validation)
│   │   │   ├── agentEndpoint.ts  # AgentEndpoint — loads agent, resolves secrets, streams via AgentRunner
│   │   │   ├── proxyEndpoint.ts  # ProxyEndpoint — proxy requests with auth, transforms, retries
│   │   │   ├── faasEndpoint.ts   # FaaSEndpoint — FaaS function execution via sandbox
│   │   │   ├── getEPService.ts   # Singleton registry mapping endpoint type to service
│   │   │   └── index.ts
│   │   ├── functions/      # Function execution
│   │   │   └── functionExecutor.ts # FunctionExecutor — sandboxed function execution with esbuild transpile
│   │   ├── email/          # Email service with strategy pattern
│   │   │   ├── email.ts    # EmailService (Resend/Mailgun/Console)
│   │   │   ├── templates.ts # TemplatesService — Handlebars template compilation with caching
│   │   │   └── strategies/ # resend.ts, mailgun.ts, console.ts, base.ts
│   │   ├── payments/       # Payment services
│   │   │   ├── payments.ts # PaymentsService factory (Polar/Console)
│   │   │   └── strategies/ # polar.ts, console.ts, base.ts
│   │   ├── proxy/          # Proxy services
│   │   │   ├── proxyService.ts  # OAuth 2.0, auth types, domain validation, transforms
│   │   │   └── retryService.ts  # Exponential backoff retry logic
│   │   ├── secrets/        # Secret resolution services
│   │   │   └── secretResolver.ts # SecretResolver class ({{SECRET}} template substitution, 3-tier API key lookup)
│   │   ├── api.ts          # API service utilities
│   │   ├── invite.ts       # Invitation service
│   │   ├── sessionStore.ts # In-memory LLM session store with TTL
│   │   └── index.ts
│   ├── types/               # TypeScript type definitions
│   │   ├── agent.types.ts  # Agent execution options (TAgentExecOpts)
│   │   ├── api.types.ts    # API types
│   │   ├── backend.types.ts # Backend configuration
│   │   ├── email.types.ts  # Email strategy types
│   │   ├── endpoints.types.ts # Endpoint configs
│   │   ├── errors.types.ts # Error types
│   │   ├── pay.types.ts    # Payment types
│   │   ├── request.types.ts # Request/Response types
│   │   ├── retry.types.ts  # Retry configuration
│   │   ├── token.types.ts  # JWT token types
│   │   ├── simple-oauth2.d.ts # OAuth type declarations
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── api/            # API utilities (objToQuery, toFormData)
│   │   ├── auth/           # Auth utilities
│   │   │   ├── checkPermission.ts     # Permission checking
│   │   │   ├── generateInvitationToken.ts # Invitation token generation
│   │   │   ├── getBillingPeriod.ts    # Billing period calculation
│   │   │   ├── pxToBeHeader.ts        # Proxy→Backend header conversion
│   │   │   ├── requireResource.ts     # requireResourceWithPermission helper
│   │   │   ├── shouldIgnore.ts        # Auth ignore logic
│   │   │   ├── validateApiKey.ts      # API key validation
│   │   │   └── index.ts
│   │   ├── errors/         # Error handling (Exception, errorHandler, server, withEx)
│   │   ├── providers/      # Provider utilities
│   │   │   ├── resolveProviderType.ts  # Resolve LLM provider type from provider config
│   │   │   ├── validateProviderType.ts # Validate provider type string
│   │   │   ├── validateLLMProvider.ts  # Validate AI providers have valid ELLMProviderBrand
│   │   │   └── index.ts
│   │   ├── proxy/          # Proxy utilities (buildProxy, buildProxyUrl, endpointProxy, proxyError, proxyHeaders)
│   │   ├── validation/     # Validation utilities
│   │   │   ├── exclusiveArc.ts # Exclusive arc validation
│   │   │   └── uuid.ts     # UUID validation helper (auto-injected for :id/:xxxId params)
│   │   ├── logger.ts       # Winston logger instance
│   │   ├── paths.ts        # Path constants (public directory)
│   │   ├── pagination.ts   # List endpoint pagination
│   │   └── signals.ts      # Process signal handling
│   ├── index.ts            # Entry export (re-exports start.ts)
│   ├── start.ts            # Application bootstrap
│   └── main.ts             # Main initialization logic
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
- **`src/middleware/setupDatabase.ts`** - Initializes database connection with validation and error handling
- **`src/middleware/setupLogger.ts`** - Sets up Winston request/error logging
- **`src/middleware/setupServer.ts`** - Disables `x-powered-by`, sets up CORS
- **`src/middleware/setupAuth.ts`** - Exports `authenticate` function for JWT authentication via Neon Auth (used as middleware in `accounts.ts`)
- **`src/middleware/setupSubscription.ts`** - Exports `setupSubscription` for auto-creating free tier subscription for new users (used as middleware in `accounts.ts`)
- **`src/middleware/setupEndpoints.ts`** - Dynamically builds Express routes from endpoint configs with auto UUID param validation
- **`src/middleware/setupProxy.ts`** - Proxies remaining requests to Auth-Proxy service
- **`src/middleware/setupErrorHandler.ts`** - Error handling middleware
- **`src/middleware/authorize.ts`** - Role-based authorization middleware

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

**Key Methods:**
- `hasSecretRefs(values)` - Fast-path check: does any string value contain a `{{...}}` template?
- `replaceRefs(value, secrets)` - Replaces `{{secret-name}}` references in a string with actual secret values
- `replaceInHeaders(headers, secrets)` - Replaces secret references in all values of a headers object
- `replaceInObj(obj, secrets)` - Recursively replaces secret references in any object (used for bodyParams)
- `decrypt(secret, orgId)` - Decrypt a secret's encryptedValue using the appropriate scope owner ID (agent/provider/project/org)
- `resolveApiKey(agent)` - Resolve an API key from secrets using 3-tier fallback: agent-scoped → provider-scoped → org-scoped
- `loadAndDecrypt(scope)` - Loads provider-scoped + org-scoped secrets, deduplicates, and decrypts them
- `resolveHeaders(provider)` - Resolves `{{SECRET_NAME}}` templates in provider.headers using decrypted secrets
- `resolveBodyParams(provider)` - Resolves `{{SECRET_NAME}}` templates in provider.bodyParams (handles non-string values)

**Usage in Agent Execution:**
```typescript
const secrets = new SecretResolver(db)
const apiKey = await secrets.resolveApiKey(agent)  // 3-tier lookup
const headers = await secrets.resolveHeaders(provider)  // Template substitution
const bodyParams = await secrets.resolveBodyParams(provider)  // Template substitution
```

#### ProxyService (`src/services/proxy/proxyService.ts`)
Service for applying endpoint options to proxy requests. Handles OAuth token management, authentication, validation, and transformations.

**Key Features:**
- OAuth 2.0 token exchange with caching (5-minute buffer before expiration)
- Auth types: Bearer, Basic, API Key
- Domain whitelist validation with wildcard support (`*.example.com`)
- Path regex validation
- Request/response transforms with secret injection

**Key Methods:**
- `getOAuthToken(oauth, secrets)` - Fetches or refreshes an OAuth access token (cached)
- `clearOAuthCache(cacheKey?)` - Clears OAuth token cache (useful for testing or forced refresh)
- `applyAuth(proxyReq, auth, secrets)` - Applies endpoint authentication options to proxy request (Bearer/Basic/API Key)
- `applyOAuth(proxyReq, oauth, secrets)` - Applies OAuth authentication to proxy request
- `validateDomainWhitelist(requestOrigin, domainWhitelist)` - Validates incoming request origin against domain whitelist
- `validatePathRegex(requestPath, pathRegex)` - Validates request path against regex pattern
- `applyEndpointOptions(options, secrets)` - Applies all endpoint options to the proxy middleware configuration
- `applyEndpointOptionsAsync(proxyReq, options, secrets, requestOrigin, requestPath)` - Applies endpoint options that require async operations (auth, oauth)
- `applyTransform(body, transform, secrets)` - Applies transform options to request/response bodies

#### RetryService (`src/services/proxy/retryService.ts`)
Service for managing request retry logic with configurable backoff strategies. Handles retry metadata, delay calculation, and error classification.

**Key Features:**
- Exponential backoff (default: 2x multiplier)
- Configurable retries (default 3, max delay 30s)
- Retryable status codes: `[408, 429, 500, 502, 503, 504]`
- Per-request retry metadata tracking

**Key Methods:**
- `setup(options)` - Builds retry configuration from endpoint options
- `shouldRetry(error, statusCode)` - Determines if another retry attempt should be made
- `delayRetry()` - Executes a retry delay before the next attempt (exponential backoff)
- `logStatus(success)` - Logs retry completion statistics

#### EmailService (`src/services/email/email.ts`)
Provider-agnostic email service using the Strategy Pattern. Switches between Resend, Mailgun, or Console logging based on configuration.

**Supported Providers:**
- Resend (via REST API)
- Mailgun (via SMTP/nodemailer)
- Console (development logging)

**Key Methods:**
- `send(options)` - Send email via configured provider strategy
- `invitation(data)` - Send organization invitation email to new users
- `sendMemberNotification(data)` - Send notification email to existing users added to org

**Templates** (`src/services/email/templates.ts`):
- `TemplatesService` loads HTML templates from `public/templates/` directory
- Handlebars compilation with in-memory caching
- Templates: `invitation.html`, `member-notification.html`

#### PaymentsService (`src/services/payments/payments.ts`)
Provider-agnostic payments service using the Strategy Pattern. Switches between Polar or Console logging based on configuration.

**Supported Providers:**
- Polar (via REST API) - `strategies/polar.ts` (53 passing tests)
- Console (development logging) - `strategies/console.ts`

**Factory Pattern:**
```typescript
const service = new PaymentsService(config)
// service.service is one of: PolarService | ConsoleService
```

#### SessionStore (`src/services/sessionStore.ts`)
In-memory LLM session store with 1-hour TTL and periodic cleanup. Used by AI proxy endpoints to cache session configurations.

**Key Methods:**
- `create(data)` - Create new session, returns session token
- `get(token)` - Get session by token
- `delete(token)` - Delete session
- `cleanup()` - Remove expired sessions (runs every 5 minutes)

### Endpoints

#### Agent Execution (`src/endpoints/agents/runAgent.ts`)
**POST `/_/agents/:id/run`** - Run an agent with SSE streaming

The endpoint delegates to `AgentEndpoint.run()` from `services/endpoints/agentEndpoint.ts`.

**Request Flow:**
1. Load agent with provider and secrets (unsanitized to access secret values)
2. Select provider: explicit `providerId` override, or `agent.primaryProvider`
3. Resolve API key via `SecretResolver.resolveApiKey()` (3-tier lookup: agent → provider → org)
4. Resolve provider headers and bodyParams via `SecretResolver.resolveHeaders()` and `SecretResolver.resolveBodyParams()`
5. Load custom functions attached to agent via junction table
6. Get or create thread
7. Build LLM config with optional overrides (model, maxTokens, systemPrompt, tools, envVars)
8. Build sandbox config from agent environment
9. Stream SSE via `AgentRunner.run()` from `@tdsk/agent`, with `onExecuteFunction` callback for custom function execution via `FunctionExecutor`

**Body:**
- `prompt` (required) - User prompt
- `threadId` (optional) - Existing thread ID to continue conversation
- `providerId` (optional) - Override which provider to use

**Response:** Server-Sent Events stream from AgentRunner

#### Quickstart (`src/endpoints/orgs/orgQuickstart.ts`)
**POST `/_/orgs/:orgId/quickstart`** - Create Provider + Secret + Project + Agent + Endpoint in a single database transaction

**Request Flow:**
1. Validate required fields (template, apiKey, projectName, agentName)
2. Resolve provider template from `ProviderTemplates` (Anthropic/OpenAI/Google/Custom)
3. Create all resources in a single DB transaction:
   - Provider (name, type, baseUrl, headers)
   - Secret (encrypted API key, provider-scoped)
   - Project (name, orgId)
   - Agent (name, description, systemPrompt, providerId, projectId)
   - Endpoint (name, path, agentId, projectId)

**Body:**
- `template` (required) - Provider template key (anthropic/openai/google/custom)
- `apiKey` (required) - Provider API key
- `projectName` (required) - Project name
- `agentName` (required) - Agent name
- `model` (optional) - LLM model (defaults to template default)
- `maxTokens` (optional) - Max tokens per response
- `systemPrompt` (optional) - Agent system prompt
- `agentDescription` (optional) - Agent description
- `providerName` (optional) - Custom provider name (required if template=custom)
- `providerUrl` (optional) - Custom provider base URL (required if template=custom)

**Response:** `{ data: { provider, secret, project, agent, endpoint } }`

#### AI Session Creation (`src/endpoints/ai/createSession.ts`)
**POST `/_/ai/sessions`** - Creates LLM session, resolves API key server-side, returns session token

**Request Flow:**
1. Validate request (`agentId` required)
2. Load agent with provider and secrets (unsanitized)
3. Check permission to read agents in this org
4. Get primary provider from `agent.primaryProvider`
5. Resolve API key via `SecretResolver.resolveApiKey(agent, provider)`
6. Resolve provider type via `resolveProviderType(provider)`
7. Resolve provider headers and bodyParams via `SecretResolver`
8. Build LLM config (apiKey stays server-side, includes model, systemPrompt, maxTokens, temperature)
9. Create session via `sessionStore.create()`
10. Return session token + non-sensitive config (no apiKey)

**Body:** `{ agentId: string }`

**Auth:** JWT or API key (normal auth, under `/_/ai/sessions`)

#### AI Stream Proxy (`src/endpoints/ai/streamChat.ts`)
**POST `/ai/stream`** - SSE LLM proxy that streams LLM responses using cached session config via `@mariozechner/pi-ai`

**Request Flow:**
1. Extract session token from `Authorization: Session <token>` header
2. Load session from `sessionStore`
3. Validate `context.messages` array in request body
4. Get model via `getModel(provider, model)` from `pi-ai`
5. Build stream context with server-side system prompt + client messages/tools
6. Stream SSE via `streamSimple(model, context, options)` from `pi-ai`
7. Convert `AssistantMessageEvent` to `ProxyAssistantMessageEvent` (strips `partial` field for bandwidth)

**Body:** `{ model?: string, context: { messages: Array, tools?: Array }, options?: { maxTokens?, temperature? } }`

**Auth:** Session token only (no JWT/API key — session token already validated at creation time)

**Response:** Server-Sent Events stream with event types: `start`, `text_start`, `text_delta`, `text_end`, `thinking_start`, `thinking_delta`, `thinking_end`, `toolcall_start`, `toolcall_delta`, `toolcall_end`, `done`, `error`

#### Thread Management (`src/endpoints/threads/`)
- **GET `/_/threads`** - List threads
- **GET `/_/threads/:id`** - Get thread by ID
- **POST `/_/threads`** - Create thread
- **PATCH `/_/threads/:id`** - Update thread
- **DELETE `/_/threads/:id`** - Delete thread
- **POST `/_/threads/:id/branch`** - Branch thread from specific message
- **GET `/_/threads/:id/messages`** - List messages in thread
- **POST `/_/threads/:id/messages`** - Create message in thread
- **PATCH `/_/messages/:id`** - Update message
- **DELETE `/_/messages/:id`** - Delete message

#### Invitation Management (`src/endpoints/invitations/`)
- **GET `/_/invitations`** - List invitations (supports `?limit=N&offset=N`)
- **GET `/_/invitations/pending`** - Get pending invitations for current user
- **POST `/_/invitations/:id/accept`** - Accept invitation
- **DELETE `/_/invitations/:id/revoke`** - Revoke invitation (admin only)

### Utilities

#### `requireResourceWithPermission()` (`src/utils/auth/requireResource.ts`)
Permission check + resource fetch helper. Eliminates permission boilerplate from CRUD endpoints.

**Signature:**
```typescript
async function requireResourceWithPermission<T>(
  req: TRequest,
  service: { get: (id: string, opts?: any) => Promise<{ data?: T; error?: any }> },
  id: string,
  action: EPermAction,
  resource: EPermResource,
  resourceName: string,
  options?: any
): Promise<T>
```

**Usage:**
```typescript
const data = await requireResourceWithPermission(
  req, db.services.apiKey, id,
  EPermAction.read, EPermResource.apiKey, 'API key'
)
res.status(200).json({ data: data.sanitize() })
```

**Error Handling:**
- Throws 404 if resource not found
- Throws 403 if permission denied

#### `validateExclusiveArc()` (`src/utils/validation/exclusiveArc.ts`)
Exclusive arc validation utility. Ensures exactly one of multiple fields is set (e.g., orgId OR projectId OR providerId, not multiple).

**Signature:**
```typescript
function validateExclusiveArc(
  fields: Record<string, any>,
  fieldNames: string[],
  errorMessage?: string
): void
```

**Usage:**
```typescript
validateExclusiveArc(
  req.body,
  ['orgId', 'projectId', 'providerId'],
  'Secret must belong to exactly one scope'
)
```

**Error Handling:**
- Throws Exception(400) if 0 or 2+ fields are set

#### Provider Utilities (`src/utils/providers/`)
- **`resolveProviderType(provider)`** - Resolve LLM provider type (anthropic/openai/google) from provider config
- **`validateProviderType(type)`** - Validate provider type string
- **`validateLLMProvider(type, brand)`** - Validate AI-type providers have `brand` set to a valid `ELLMProviderBrand` value (non-AI provider types are not validated)

#### Auth Utilities (`src/utils/auth/`)
- **`checkPermission(req, action, resource, scope)`** - Check user permission for action on resource in scope
- **`generateInvitationToken()`** - Generate invitation token
- **`getBillingPeriod()`** - Calculate billing period start/end dates
- **`pxToBeHeader()`** - Convert Proxy-to-Backend headers
- **`shouldIgnore(path, method)`** - Determine if request should bypass auth
- **`validateApiKey()`** - API key validation logic

#### Pagination (`src/utils/pagination.ts`)
Parse pagination query parameters with defaults and max limits.

**Signature:**
```typescript
function parsePagination(req: TRequest): { limit: number; offset: number }
```

**Constants:**
- `DBPaging.default = 50`
- `DBPaging.max = 200`

**Usage:**
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

The middleware stack is set up in this critical order:

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

2. **Stream Proxy** (`/ai/stream`) - Session-token auth at top level (`stream.ts` exports `aiStream`)
   - Uses session token from `Authorization: Session <token>` header
   - Streams SSE from LLM via `@mariozechner/pi-ai` `streamSimple()` using cached session config
   - Converts `AssistantMessageEvent` to bandwidth-optimized `ProxyAssistantMessageEvent`
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
3. Resolve API key via `SecretResolver.resolveApiKey(agent, provider)`:
   - Try agent-scoped secrets first
   - Fall back to provider-scoped secrets
   - Fall back to org-scoped secrets
4. Resolve provider headers via `SecretResolver.resolveHeaders()`:
   - Load provider-scoped + org-scoped secrets
   - Decrypt each secret
   - Replace `{{SECRET_NAME}}` templates in headers
5. Resolve provider bodyParams via `SecretResolver.resolveBodyParams()`:
   - Same as headers, but handles non-string values (numbers, booleans, objects)
6. Load custom functions attached to agent via junction table (`db.services.function.listByAgent`)
7. Get or create thread
8. Build LLM config with optional overrides (model, maxTokens, systemPrompt, tools, envVars)
9. Build sandbox config from agent environment options
10. Stream SSE via `AgentRunner.run()` from `@tdsk/agent` with `onExecuteFunction` callback for custom function execution via `FunctionExecutor`

## API Routes

### Admin Routes (`/_/*`)

All admin API routes are mounted under the admin path prefix (configured via `TDSK_BE_API_ADMIN_PATH`, default `/_`):

**Organization Management:**
- **GET `/_/orgs`** - List all organizations for user — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:id`** - Get organization by ID
- **POST `/_/orgs`** - Create new organization
- **PATCH `/_/orgs/:id`** - Update organization
- **DELETE `/_/orgs/:id`** - Delete organization
- **GET `/_/orgs/:id/members`** - List organization members — Supports `?limit=N&offset=N`
- **POST `/_/orgs/:id/members`** - Add member to organization
- **DELETE `/_/orgs/:id/members/:userId`** - Remove member from organization
- **PATCH `/_/orgs/:orgId/members/:userId/role`** - Update member role
- **POST `/_/orgs/:id/invite`** - Send email invitation to join organization
- **PATCH `/_/orgs/:id/roles/:roleId`** - Update organization role
- **DELETE `/_/orgs/:id/roles/:roleId`** - Delete organization role
- **POST `/_/orgs/:orgId/quickstart`** - Single-transaction create (Provider + Secret + Project + Agent + Endpoint)

**Organization Nested Resources:**
- **GET `/_/orgs/:orgId/agents`** - List agents in organization — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:orgId/api-keys`** - List API keys in organization — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:orgId/domains`** - List domains in organization — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:orgId/projects`** - List projects in organization — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:orgId/providers`** - List providers in organization — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:orgId/secrets`** - List secrets in organization — Supports `?limit=N&offset=N`
- **GET `/_/orgs/:orgId/quotas`** - Get current period usage for organization
- **GET `/_/orgs/:orgId/quotas/limits`** - Get plan limits from owner's subscription

**User Management:**
- **GET `/_/users`** - List users — Supports `?limit=N&offset=N`
- **GET `/_/users/:id`** - Get user by ID
- **POST `/_/users`** - Create user
- **PATCH `/_/users/:id`** - Update user
- **DELETE `/_/users/:id`** - Delete user

**Project Management:**
- **GET `/_/projects`** - List projects (optionally by org) — Supports `?limit=N&offset=N`
- **GET `/_/projects/:id`** - Get project by ID
- **POST `/_/projects`** - Create project
- **PATCH `/_/projects/:id`** - Update project
- **DELETE `/_/projects/:id`** - Delete project

**API Key Management:**
- **GET `/_/api-keys`** - List API keys — Supports `?limit=N&offset=N`
- **GET `/_/api-keys/:id`** - Get API key by ID
- **POST `/_/api-keys`** - Generate new API key
- **PATCH `/_/api-keys/:id`** - Update API key (name, scopes, rate limits)
- **DELETE `/_/api-keys/:id`** - Revoke API key

**Secret Management:**
- **GET `/_/secrets`** - List secrets (by org or project scope) — Supports `?limit=N&offset=N`
- **GET `/_/secrets/:id`** - Get secret by ID
- **POST `/_/secrets`** - Create encrypted secret
- **PATCH `/_/secrets/:id`** - Update secret
- **DELETE `/_/secrets/:id`** - Delete secret

**Endpoint Management:**
- **GET `/_/endpoints`** - List endpoints — Supports `?limit=N&offset=N`
- **GET `/_/endpoints/:id`** - Get endpoint by ID
- **POST `/_/endpoints`** - Create endpoint
- **PATCH `/_/endpoints/:id`** - Update endpoint
- **DELETE `/_/endpoints/:id`** - Delete endpoint

**Provider Management:**
- **GET `/_/providers`** - List providers — Supports `?limit=N&offset=N`
- **GET `/_/providers/:id`** - Get provider by ID
- **POST `/_/providers`** - Create provider
- **PATCH `/_/providers/:id`** - Update provider
- **DELETE `/_/providers/:id`** - Delete provider

**Agent Management:**
- **GET `/_/agents`** - List agents — Supports `?limit=N&offset=N`
- **GET `/_/agents/:id`** - Get agent by ID
- **POST `/_/agents`** - Create agent
- **PATCH `/_/agents/:id`** - Update agent
- **DELETE `/_/agents/:id`** - Delete agent
- **POST `/_/agents/:id/run`** - Run agent with SSE streaming (body: `{ prompt, threadId? }`)

**Domain Management:**
- **GET `/_/domains`** - List domains — Supports `?limit=N&offset=N`
- **GET `/_/domains/:id`** - Get domain by ID
- **POST `/_/domains`** - Create domain
- **PATCH `/_/domains/:id`** - Update domain
- **DELETE `/_/domains/:id`** - Delete domain

**Function Management:**
- **GET `/_/functions`** - List functions — Supports `?limit=N&offset=N`
- **GET `/_/functions/:id`** - Get function by ID
- **POST `/_/functions`** - Create function
- **PATCH `/_/functions/:id`** - Update function
- **DELETE `/_/functions/:id`** - Delete function

**Thread Management:**
- **GET `/_/threads`** - List threads — Supports `?limit=N&offset=N`
- **GET `/_/threads/:id`** - Get thread by ID
- **POST `/_/threads`** - Create thread
- **PATCH `/_/threads/:id`** - Update thread
- **DELETE `/_/threads/:id`** - Delete thread
- **POST `/_/threads/:id/branch`** - Branch thread from specific message
- **GET `/_/threads/:id/messages`** - List messages in thread — Supports `?limit=N&offset=N`
- **POST `/_/threads/:id/messages`** - Create message in thread
- **PATCH `/_/messages/:id`** - Update message
- **DELETE `/_/messages/:id`** - Delete message

**Invitation Management:**
- **GET `/_/invitations`** - List invitations — Supports `?limit=N&offset=N`
- **GET `/_/invitations/pending`** - Get pending invitations for current user
- **POST `/_/invitations/:id/accept`** - Accept invitation
- **DELETE `/_/invitations/:id/revoke`** - Revoke invitation (admin only)

**Subscription Management:**
- **GET `/_/subscriptions/current`** - Get current user subscription
- **GET `/_/subscriptions/plans`** - List available payment plans
- **POST `/_/subscriptions/checkout`** - Create checkout session
- **POST `/_/subscriptions/portal`** - Create customer portal session
- **POST `/_/subscriptions/cancel`** - Cancel subscription

**Quota Management:**
- **POST `/_/quotas/check`** - Check if action would exceed quota
- **GET `/_/quotas/orgs/:orgId`** - Get current period usage
- **GET `/_/quotas/orgs/:orgId/limits`** - Get plan limits from owner's subscription

**Payment Processing:**
- **POST `/_/payments/webhook`** - Polar.sh webhook handler

**AI Session Management:**
- **POST `/_/ai/sessions`** - Create LLM session (JWT/API key auth)

**Base Routes:**
- **GET `/_/`** - Base endpoint, returns status message
- **GET `/_/health`** - Health check endpoint

Routes are protected by JWT authentication middleware except those in `AuthIgnore` list (`/`, `/health`).

### AI Routes (`/ai/*`)

**Stream Proxy:**
- **POST `/ai/stream`** - LLM proxy SSE stream via `pi-ai` (session token auth: `Authorization: Session <token>`)

### Proxy Engine Routes (`/proxy/*`)

**Endpoint Dispatch:**
- **ALL `/proxy/:projectId/:endpointId`** - Dispatches to appropriate endpoint type service (ProxyEndpoint, FaaSEndpoint, AgentEndpoint) via `getEPService()`

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
5. Auto-inject UUID param validation for routes with :id or :xxxId params
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
  // Wrap all HTTP methods with asyncHandler
  Router.get = (endpoint, ...args) =>
    Get(endpoint, ...args.map(handler => asyncHandler(handler)))
  // ... similar for post, put, patch, delete, all, use
  return Router
}
```

### 2. Configuration-Driven Endpoints

Endpoints are defined declaratively, then dynamically registered:

```typescript
// Define (src/endpoints/endpoints.ts)
export const endpoints = {
  proxy,
  accounts,   // Builder function
  aiStream,   // Config object
}

// Register
setupEndpoints(app, router) // Iterates and registers
```

### 3. Middleware Composition

Endpoints can specify middleware arrays that are composed:

```typescript
{
  path: '/_',
  middleware: [express.json(), authenticate],
  endpoints: { /* nested */ }
}
```

### 4. Proxy Configuration

Endpoints can be proxied by specifying proxy config:

```typescript
{
  path: '/api',
  method: EPMethod.All,
  proxy: {
    target: 'https://external-api.com',
    changeOrigin: true,
    pathRewrite: { '^/api': '' }
  }
}
```

### 5. Error Handling

Custom `Exception` class with HTTP status codes:

```typescript
throw new Exception(400, 'Invalid request', 'BAD_REQUEST')
```

Caught by global error handler that formats responses:

```typescript
res.status(status).json({ error: message, ...(code && { code }) })
```

### 6. Path Aliases

TypeScript path aliases for clean imports:

- `@TBE/*` → `repos/backend/src/*`
- `@TDM/*` → `repos/domain/src/*`
- `@TDB/*` → `repos/database/src/*`
- `@tdsk/logger` → `repos/logger/src`

### 7. Environment Configuration

Configuration loaded from `deploy/values.*.yml` via `@keg-hub/parse-config`:

```typescript
loadEnvs({ force: nodeEnv === 'local' })
```

Local development forces override, production uses system env vars.

### 8. Pagination Pattern

All list endpoints support pagination via query parameters:

```typescript
import { parsePagination } from '@TBE/utils/pagination'

const { limit, offset } = parsePagination(req)
// limit defaults to 50, max 200; offset defaults to 0
const { data } = await db.services.X.list({ where: {...}, limit, offset })
res.status(200).json({ data, limit, offset })
```

### 9. Permission Helper Pattern

CRUD endpoints use `requireResourceWithPermission()` to reduce boilerplate:

```typescript
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

const data = await requireResourceWithPermission(
  req, db.services.apiKey, id,
  EPermAction.read, EPermResource.apiKey, 'API key'
)
res.status(200).json({ data: data.sanitize() })
```

### 10. Strategy Pattern for Services

EmailService and PaymentsService use the Strategy Pattern to support multiple providers:

```typescript
// Email
const email = new EmailService({ type: 'resend', apiKey: '...' })
await email.invitation({ email, orgName, inviterName, ... })

// Payments
const payments = new PaymentsService({ type: 'polar', accessToken: '...' })
await payments.service.createCheckoutSession({ ... })
```

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | 5.1.0 | Web server framework |
| `express-async-handler` | 1.2.0 | Automatic error handling for async routes |
| `express-jwt` | 8.5.1 | JWT middleware |
| `jsonwebtoken` | 9.0.2 | JWT signing and verification |
| `http-proxy-middleware` | 3.0.5 | Proxy middleware for forwarding requests |
| `cors` | 2.8.5 | Cross-Origin Resource Sharing |
| `winston` | 3.17.0 | Logging framework |
| `axios` | 1.10.0 | HTTP client for OAuth token exchange |
| `nodemailer` | 7.0.12 | Email sending (Mailgun strategy) |
| `handlebars` | 4.7.8 | Email template rendering |
| `zod` | 4.3.5 | Schema validation |
| `date-fns` | 4.1.0 | Date utilities |
| `esbuild` | 0.27.3 | TypeScript transpilation for FaaS functions |

### LLM Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@mariozechner/pi-ai` | 0.52.12 | Unified multi-provider LLM streaming (used by streamChat for SSE proxy) |

**Note:** Individual LLM SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`) are dependencies of `@tdsk/agent`, not the backend directly. The backend's AI stream proxy uses `pi-ai` which provides its own unified interface.

### Payment Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@polar-sh/express` | 0.6.3 | Polar.sh Express middleware |
| `@polar-sh/sdk` | 0.42.5 | Polar.sh SDK |

### Workspace Dependencies

- `@tdsk/domain` - Shared types and domain models
- `@tdsk/database` - Database ORM (Drizzle) and services
- `@tdsk/logger` - Winston logging service
- `@tdsk/agent` - AI agent runtime and AgentRunner
- `@tdsk/sandbox` - Pluggable sandbox execution layer

### Development Dependencies

- `@biomejs/biome@2.1.2` - Linting and formatting
- `tsup@8.3.0` - TypeScript bundler for build
- `vitest@1.6.1` - Testing framework
- `typescript@5.7.3` - TypeScript compiler
- `supertest@7.0.0` - HTTP testing
- `nock@13.5.4` - HTTP mocking

## Commands

### Development

```bash
pnpm start          # Dev server with watch mode
                    # Watches: src, configs, domain, logger, database
                    # Runs: tsup build + node dist/index.cjs

pnpm serve          # Run built server (no watch)
```

### Build

```bash
pnpm build          # Production build via tsup
pnpm clean          # Remove dist folder
```

### Testing

```bash
pnpm test           # Run vitest test suite
```

### Commands Notes

* Linting and formatting are automatic, so `pnpm lint` and `pnpm format` commands should be ignored.

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
DBPaging = {
  max: 200,
  default: 50
}
```

## Integration Points

### Database Integration

- Initializes database connection in `setupDatabase` middleware
- Stores database instance on `app.locals.db`
- Uses `@tdsk/database` package for ORM operations
- Validates JWT tokens via `db.validate({ access_token })`

### Logger Integration

- Uses `@tdsk/logger` package for Winston-based logging
- Request and error logging via `setupLogger(app)`
- Logger instance configured from `config.logger`

### Domain Integration

- Imports shared types from `@tdsk/domain`
- Key types: `TApp`, `TRequest`, `TResponse`, `TABConfig`
- Extends Express types with custom properties

### Agent Integration

- Uses `@tdsk/agent` package for `AgentRunner` and `IAgentRunnerDB` interface
- `AgentRunner.run()` for SSE streaming execution with tool use, function callbacks, and sandbox config
- Backend creates `IAgentRunnerDB` adapter wrapping database services for message persistence
- Uses `@mariozechner/pi-ai` (`getModel`, `streamSimple`) for AI stream proxy endpoint (not `@tdsk/agent`)

### Sandbox Integration

- Uses `@tdsk/sandbox` package for pluggable sandbox execution
- E2bSandboxProvider (Firecracker microVMs) and LocalSandboxProvider (just-bash + V8 isolate)

### Proxy Integration

- Proxies unhandled requests to Auth-Proxy service
- Adds custom headers for internal communication
- Configured via `TDSK_BE_REMOTE` and `TDSK_BE_REMOTE_PORT`
- Uses `http-proxy-middleware` for proxying

### Auth-Proxy Communication

- Receives admin requests from Auth-Proxy at `/_/*` paths
- Proxies back to Auth-Proxy for unmatched routes
- Shares JWT validation logic via database
- Coordinates on allowed origins and public routes

## Environment Variables

Key environment variables loaded from `deploy/values.*.yml`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `TDSK_BE_PORT` | Server port | - |
| `TDSK_BE_REMOTE` | Auth-Proxy host | - |
| `TDSK_BE_REMOTE_PORT` | Auth-Proxy port | - |
| `TDSK_BE_API_ADMIN_PATH` | Admin path prefix | `/_` |
| `TDSK_BE_ALLOW_ORIGIN` | CORS origins (comma-separated) | - |
| `TDSK_BE_ENABLE_SSL` | Enable HTTPS | `false` |
| `TDSK_BE_SSL_CERT` | SSL certificate path | - |
| `TDSK_BE_SSL_KEY` | SSL key path | - |
| `TDSK_BE_PUBLIC_ROUTES` | Public routes (comma-separated) | - |
| `TDSK_DB_URL` | Database URL | - |
| `TDSK_DB_JWT_SCRT` | JWT secret | - |
| `TDSK_BE_LOGGER_LEVEL` | Log level | `info` |
| `TDSK_PAY_TYPE` | Payment provider type | `polar` |
| `TDSK_PAY_ACCESS_TOKEN` | Polar API token | - |
| `TDSK_PAY_WEBHOOK_SECRET` | Polar webhook secret | - |
| `TDSK_PAY_PLANS` | Payment plan product IDs | - |
| `TDSK_EMAIL_TYPE` | Email provider type | `console` |
| `TDSK_EMAIL_API_KEY` | Email API key (Resend) | - |
| `TDSK_EMAIL_FROM` | Email from address | - |

## Development Notes

### Adding a New Endpoint

1. Create endpoint file in `src/endpoints/`
2. Define endpoint config or builder function
3. Export from `src/endpoints/endpoints.ts`
4. Endpoint will be auto-registered on next restart

### Adding Middleware

1. Create middleware in `src/middleware/`
2. Add to appropriate setup function or create new setup function
3. Call setup function in `src/main.ts` in correct order

### Debugging

- Set `TDSK_BE_LOGGER_LEVEL=debug` for verbose logs
- Use `TDSK_BE_LOGGER_PRETTY=true` for formatted logs
- Check `dist/index.cjs.map` for source maps

### Watch Mode

The `pnpm start` command watches multiple packages:
- `./src` - Backend source
- `./configs` - Backend configs
- `../domain/src` - Domain package
- `../logger/src` - Logger package
- `../database/src` - Database package

Changes to any of these trigger automatic rebuild and server restart.

---

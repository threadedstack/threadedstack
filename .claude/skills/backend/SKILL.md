---
name: "Threaded Stack - Backend Repo"
description: "Knowledge base for the backend Core API repo"
version: "2.0.0"
tags: ["express", "nodejs", "api", "websocket", "backend", "payments", "polar", "ai", "session", "proxy", "secrets"]
---
# Backend Repo Skill

## Overview

The **Backend** repo (`repos/backend`) serves as the Core API server for Threaded Stack. It is built on Express 5.1.0 and acts as the central orchestration layer for:

- **Admin CRUD operations** - Organization, project, user, API key, secret, endpoint, provider, agent, thread, invitation, and subscription management
- **Proxy Engine** - Secure API proxying with secret injection, OAuth 2.0, retry logic, and header/body transforms
- **AI Engine** - LLM proxy with SSE streaming, session-based API key resolution, and AgentRunner integration
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
│   │   ├── agents/         # 9 files: CRUD + runAgent (SSE streaming)
│   │   ├── ai/             # 6 files: sessions + chatProxy (SSE LLM proxy)
│   │   │   ├── ai.ts       # Top-level /ai group (no JWT auth — session-token only)
│   │   │   ├── sessions.ts # /_/ai/sessions group (normal auth, under accounts)
│   │   │   ├── createSession.ts  # POST /sessions — creates LLM session
│   │   │   └── chatProxy.ts      # POST /chat — SSE LLM proxy
│   │   ├── apiKeys/        # 8 files: CRUD with generation, scoping, rate limiting
│   │   ├── auth/           # 3 files: Authentication endpoints
│   │   ├── base/           # 3 files: Base + health endpoints
│   │   ├── domains/        # 7 files: Domain CRUD
│   │   ├── endpoints/      # 8 files: Endpoint definitions CRUD
│   │   ├── functions/      # 8 files: Function CRUD
│   │   ├── invitations/    # 6 files: Invitation CRUD + accept/revoke/pending
│   │   ├── orgs/           # 23 files: Orgs CRUD + members + roles + quickstart + nested resources
│   │   │   ├── orgs.ts
│   │   │   ├── createOrg.ts, getOrg.ts, updateOrg.ts, deleteOrg.ts, listOrgs.ts
│   │   │   ├── listOrgMembers.ts, addOrgMember.ts, removeOrgMember.ts, updateMemberRole.ts
│   │   │   ├── updateOrgRole.ts, deleteOrgRole.ts
│   │   │   ├── inviteOrgUser.ts
│   │   │   ├── orgQuickstart.ts  # Single-transaction create (Provider+Secret+Project+Agent+Endpoint)
│   │   │   ├── orgAgents.ts, orgApiKeys.ts, orgDomains.ts, orgProjects.ts, orgProviders.ts, orgSecrets.ts, orgQuotas.ts
│   │   │   └── index.ts
│   │   ├── payments/       # 3 files: Payment endpoints + webhook
│   │   ├── projects/       # 8 files: Projects CRUD
│   │   ├── providers/      # 8 files: Provider configurations
│   │   ├── proxy/          # 3 files: Proxy endpoint routing
│   │   ├── quotas/         # 6 files: Quota checking and limits
│   │   ├── secrets/        # 8 files: Secrets with AES-256-GCM encryption
│   │   ├── subscriptions/  # 8 files: Subscription management
│   │   ├── threads/        # 11 files: Thread CRUD + messages + branching
│   │   ├── users/          # 8 files: Users CRUD
│   │   ├── accounts.ts     # Main accounts routes (/_/*)
│   │   ├── endpoints.ts    # Endpoint registry (ai, proxy, accounts)
│   │   └── index.ts
│   ├── middleware/          # Express middleware setup
│   │   ├── authorize.ts    # Authorization middleware (12 tests)
│   │   ├── setupAuth.ts    # JWT authentication
│   │   ├── setupDatabase.ts # Database connection with validation
│   │   ├── setupEndpoints.ts # Dynamic route builder
│   │   ├── setupErrorHandler.ts # Error handling
│   │   ├── setupLogger.ts  # Winston logging
│   │   ├── setupProxy.ts   # Proxy to Auth-Proxy
│   │   ├── setupServer.ts  # CORS, DB, base setup
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
│   │   ├── agent/          # Agent service
│   │   ├── email/          # Email service with strategy pattern
│   │   │   ├── email.ts    # EmailService (Resend/Mailgun/Console)
│   │   │   ├── templates/  # Handlebars templates (invitation, member-notification)
│   │   │   └── strategies/ # resend.ts, mailgun.ts, console.ts
│   │   ├── payments/       # Payment services
│   │   │   ├── payments.ts # PaymentsService factory (Polar/Console)
│   │   │   └── strategies/ # polar.ts (53 tests), console.ts, base.ts
│   │   ├── proxy/          # Proxy services
│   │   │   ├── proxyService.ts  # OAuth 2.0, auth types, domain validation, transforms
│   │   │   └── retryService.ts  # Exponential backoff retry logic
│   │   ├── secrets/        # Secret resolution services
│   │   │   └── secretResolver.ts # SecretResolver class ({{SECRET}} template substitution, 3-tier API key lookup)
│   │   ├── api.ts          # API service utilities
│   │   ├── invite.ts       # Invitation service
│   │   ├── llm.ts          # Spyable wrapper for createLLMAdapter
│   │   ├── sessionStore.ts # In-memory LLM session store with TTL (10 tests)
│   │   └── index.ts
│   ├── types/               # TypeScript type definitions
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
│   │   ├── api/            # API utilities
│   │   ├── auth/           # Auth utilities (6+ files)
│   │   │   ├── checkPermission.ts     # Permission checking (20 tests)
│   │   │   ├── generateApiKey.ts      # API key generation
│   │   │   ├── generateInvitationToken.ts # Invitation token generation
│   │   │   ├── getBillingPeriod.ts    # Billing period calculation
│   │   │   ├── pxToBeHeader.ts        # Proxy→Backend header conversion
│   │   │   ├── requireResource.ts     # requireResourceWithPermission helper (11 tests)
│   │   │   ├── shouldIgnore.ts        # Auth ignore logic
│   │   │   ├── validateApiKey.ts      # API key validation
│   │   │   └── index.ts
│   │   ├── errors/         # Error handling (Exception, errorHandler, withEx)
│   │   ├── providers/      # Provider utilities
│   │   │   ├── resolveProviderType.ts  # Resolve LLM provider type (anthropic/openai/google)
│   │   │   ├── validateProviderType.ts # Validate provider type
│   │   │   └── index.ts
│   │   ├── proxy/          # Proxy utilities (buildProxy, endpointProxy, proxyHeaders)
│   │   ├── secrets/        # Secret utilities
│   │   ├── validation/     # Validation utilities
│   │   │   ├── exclusiveArc.ts # Exclusive arc validation (13 tests)
│   │   │   └── uuid.ts     # UUID validation helper (14 tests)
│   │   ├── helpers.ts      # General utilities
│   │   ├── logger.ts       # Winston logger instance
│   │   ├── pagination.ts   # List endpoint pagination (10 tests)
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
- **`src/middleware/setupAuth.ts`** - JWT authentication middleware via Neon Auth
- **`src/middleware/setupSubscription.ts`** - Auto-creates free tier subscription for new users
- **`src/middleware/setupEndpoints.ts`** - Dynamically builds Express routes from endpoint configs
- **`src/middleware/setupProxy.ts`** - Proxies remaining requests to Auth-Proxy service
- **`src/middleware/setupErrorHandler.ts`** - Error handling middleware

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
- `invitation(data)` - Send organization invitation email to new users (uses Handlebars template: `templates/invitation.html`)
- `sendMemberNotification(data)` - Send notification email to existing users added to org (uses Handlebars template: `templates/member-notification.html`)

**Handlebars Templates:**
- `invitation.html` - Organization invitation email
- `member-notification.html` - Member added notification email

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

**Request Flow:**
1. Load agent with provider and secrets (unsanitized to access secret values)
2. Check permission to run agents in this org
3. Load provider
4. Resolve secrets via `SecretResolver.resolveApiKey()` (3-tier lookup: agent → provider → org)
5. Resolve provider type via `resolveProviderType(provider)`
6. Resolve provider headers and bodyParams via `SecretResolver.resolveHeaders()` and `SecretResolver.resolveBodyParams()`
7. Get or create thread
8. Stream SSE via `AgentRunner` from `@tdsk/agent`

**Body:**
- `prompt` (required) - User prompt
- `threadId` (optional) - Existing thread ID to continue conversation

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
1. Validate request (agentId, providerId, model required)
2. Load agent with provider and secrets (unsanitized)
3. Check permission to use agents in this org
4. Load provider
5. Resolve API key via `SecretResolver.resolveApiKey()`
6. Resolve provider headers and bodyParams via `SecretResolver`
7. Create session via `sessionStore.create()`
8. Return session token

**Auth:** JWT or API key (normal auth, under `/_/ai/sessions`)

#### AI Chat Proxy (`src/endpoints/ai/chatProxy.ts`)
**POST `/ai/chat`** - SSE LLM proxy that streams LLM responses using cached session config

**Request Flow:**
1. Extract session token from `Authorization: Session <token>` header
2. Load session from `sessionStore`
3. Create LLM adapter via `createLLMAdapter()` from `@tdsk/agent`
4. Stream SSE response from LLM

**Auth:** Session token only (no JWT/API key — session token already validated at creation time)

**Response:** Server-Sent Events stream

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

#### Auth Utilities (`src/utils/auth/`)
- **`generateApiKey()`** - Generate new API key with `tdsk_` prefix
- **`generateInvitationToken()`** - Generate invitation token
- **`getBillingPeriod()`** - Calculate billing period start/end dates
- **`checkPermission(req, action, resource, scope)`** - Check user permission for action on resource in scope
- **`shouldIgnore(path, method)`** - Determine if request should bypass auth

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
  ├─ setupLoggerReq(app)          # Request logging
  ├─ setupDatabase(app)           # DB connection with validation + error handling
  ├─ setupServer(app, router)     # CORS, router mount
  ├─ setupAuth(app)               # JWT authentication + ensureSubscription
  ├─ setupEndpoints(router, config) # Dynamic route building (includes setupProxy via EPMethod.All)
  ├─ setupLoggerErr(app)          # Error logging
  ├─ setupErrorHandler(app)       # Error middleware
  ├─ initServer()                 # HTTP/HTTPS server creation
  └─ signals(server)              # Graceful shutdown handlers
```

### Endpoint Definition Pattern

Endpoints are defined as configuration objects or builder functions:

```typescript
// Static endpoint
export const base: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req, res) => { /* handler */ }
}

// Dynamic endpoint with builder
export const accounts: TEndpointBuilder = (config) => ({
  method: EPMethod.Use,
  path: adminPath(config),  // e.g., /_
  middleware: [express.json(), authenticate],
  endpoints: { auth, base, health }
})
```

### Middleware Setup Order

The middleware stack is set up in this critical order:

1. **Logger Request** - Logs incoming requests (from `@tdsk/logger`)
2. **Database** - Database connection with validation
3. **Server Setup** - CORS, basic Express config
4. **Auth** - JWT authentication + `setupSubscription` (auto-create free tier)
5. **Endpoints** - Dynamic route registration from `endpoints/` directory
6. **Proxy** - Catch-all proxy to Auth-Proxy service for unhandled routes
7. **Logger Error** - Logs errors (from `@tdsk/logger`)
8. **Error Handler** - Formats and sends error responses

### AI Endpoint Architecture

AI endpoints are split into two groups with different auth mechanisms:

1. **Session Creation** (`/_/ai/sessions`) - Normal JWT/API key auth under accounts
   - Creates LLM session
   - Resolves API key server-side (API keys never leave the backend)
   - Returns session token

2. **Chat Proxy** (`/ai/chat`) - Session-token auth at top level (no JWT/API key)
   - Uses session token from `Authorization: Session <token>` header
   - Streams SSE from LLM using cached session config
   - No API key validation needed (already validated at session creation time)

**Rationale:**
- API keys are never sent over the wire to the client
- Session tokens are scoped to a single agent+provider+model configuration
- Session tokens expire after 1 hour (TTL in sessionStore)

### Agent Run Flow

When executing an agent via `POST /_/agents/:id/run`:

1. Load agent + provider + secrets (unsanitized to access encrypted values)
2. Resolve API key via `SecretResolver.resolveApiKey()`:
   - Try agent-scoped secrets first
   - Fall back to provider-scoped secrets
   - Fall back to org-scoped secrets
3. Resolve provider headers via `SecretResolver.resolveHeaders()`:
   - Load provider-scoped + org-scoped secrets
   - Decrypt each secret
   - Replace `{{SECRET_NAME}}` templates in headers
4. Resolve provider bodyParams via `SecretResolver.resolveBodyParams()`:
   - Same as headers, but handles non-string values (numbers, booleans, objects)
5. Create LLM adapter via `createLLMAdapter()` from `@tdsk/agent`
6. Stream SSE via `AgentRunner.run()` from `@tdsk/agent`

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

**Chat Proxy:**
- **POST `/ai/chat`** - LLM proxy SSE stream (session token auth: `Authorization: Session <token>`)

### Proxy Routes (`/**`)

All routes not matched by endpoints are proxied to the Auth-Proxy service configured via `TDSK_BE_REMOTE` and `TDSK_BE_REMOTE_PORT`.

## Logic Flow

### Request Flow

```
1. Request arrives at Express app
2. Winston request logger logs the request
3. Database connection validated
4. CORS middleware checks origin
5. JWT authentication (if not in AuthIgnore)
   └─ setupSubscription ensures free tier subscription exists
6. Router attempts to match endpoint
   ├─ If matched: Execute endpoint handler
   │  └─ If protected: User already authenticated
   └─ If not matched: Proxy to Auth-Proxy service
7. Response sent or error thrown
8. Winston error logger logs errors
9. Error handler formats error response
```

### Authentication Flow

```
1. Request enters authenticate middleware
2. Check if path should be ignored (shouldIgnore)
   ├─ Yes: Skip to next middleware
   └─ No: Continue authentication
3. Extract Bearer token from Authorization header
4. Validate token with database (Neon Auth)
   ├─ Valid: Attach user to res.locals.user
   └─ Invalid: Return 401 error
5. setupSubscription middleware ensures free tier subscription exists
6. Continue to endpoint handler
```

### Endpoint Registration Flow

```
1. setupEndpoints called with router and config
2. Iterate through endpoints object
3. For each endpoint:
   ├─ If builder function: Call with config
   └─ If config object: Use directly
4. Validate endpoint (method, path)
5. Determine endpoint type:
   ├─ EPMethod.Use: Create nested router
   ├─ Has proxy config: Create proxy middleware
   └─ Has action: Use action handler
6. Register with Express router
7. If public: Add to publicRoutes list
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
// Define
export const endpoints = {
  accounts,  // Builder function or config object
}

// Register
setupEndpoints(router, config) // Iterates and registers
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

### LLM Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.39.0 | Anthropic Claude API client |
| `openai` | ^4.77.0 | OpenAI API client |
| `@google/genai` | ^1.0.0 | Google Gemini API client |

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
                    # 790 tests across 44 test files
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
- Request logging via `setupLoggerReq(app)`
- Error logging via `setupLoggerErr(app)`
- Logger instance configured from `config.logger`

### Domain Integration

- Imports shared types from `@tdsk/domain`
- Key types: `TApp`, `TRequest`, `TResponse`, `TABConfig`
- Extends Express types with custom properties

### Agent Integration

- Uses `@tdsk/agent` package for AgentRunner and LLM adapters
- `AgentRunner.run()` for SSE streaming execution
- `createLLMAdapter()` for creating LLM clients (Anthropic/OpenAI/Google/Proxy)

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

**Last Updated:** 2026-02-15
**Version:** 2.0.0

### Changelog

#### v2.0.0 (2026-02-15)
- **BREAKING**: Removed configs endpoints — configs table deprecated
- **New**: `SecretResolver` service — `{{SECRET}}` template resolution in provider headers/bodyParams, 3-tier API key lookup (agent → provider → org), multi-scope decryption
- **New**: `ProxyService` — OAuth 2.0 token exchange, auth types (Bearer/Basic/API Key), domain whitelist validation, path regex, request/response transforms with secret injection
- **New**: `RetryService` — Exponential backoff, configurable retries (default 3), retryable status codes [408, 429, 500, 502, 503, 504]
- **New**: `EmailService` — Strategy pattern (mailgun, resend, console), Handlebars templates (invitation, member-notification)
- **New**: `PaymentsService` — Strategy pattern (polar, console)
- **New**: `POST /_/orgs/:orgId/quickstart` — Single-transaction create (Provider + Secret + Project + Agent + Endpoint)
- **New**: `POST /_/agents/:id/run` — SSE streaming agent execution with ReAct loop via AgentRunner
- **New**: Thread CRUD + messages + branching (11 files, 12 endpoints)
- **New**: Invitation management (accept, revoke, pending) (6 files, 4 endpoints)
- **New**: Org nested resources (agents, api-keys, domains, secrets, projects, providers under `/_/orgs/:orgId/`)
- **New**: `POST /_/orgs/:id/invite` — Email invitation
- **New**: `PATCH /_/orgs/:orgId/members/:userId/role` — Update member role
- **New**: `PATCH /_/orgs/:id/roles/:roleId` and `DELETE /_/orgs/:id/roles/:roleId`
- **New**: `POST /_/subscriptions/cancel` (was `DELETE /_/subscriptions/current`)
- **New**: Provider utilities: `resolveProviderType()`, `validateProviderType()`
- **New**: Auth utilities: `generateApiKey()`, `generateInvitationToken()`, `getBillingPeriod()`
- **Improved**: Subscription endpoints use PATCH/POST instead of PUT/DELETE
- **Improved**: AI endpoint split: `/_/ai/sessions` (JWT auth under accounts) vs `/ai/chat` (session-token auth at top level)
- **Improved**: Agent run flow: load agent + provider + secrets → SecretResolver.resolveApiKey → resolve headers/bodyParams → stream SSE via AgentRunner
- **Middleware**: Added `setupDatabase` and `setupLogger` to middleware list; `setupSubscription` auto-creates free tier
- **Dependencies**: Added `@tdsk/agent`, `@tdsk/sandbox`, `@anthropic-ai/sdk`, `@google/genai`, `openai`, `@polar-sh/express`, `@polar-sh/sdk`, `zod`, `date-fns`, `nodemailer`, `axios`
- **Testing**: 790/790 tests passing across 44 test files (was 745/745 across 44 in v1.5.0)
- **Directory**: Updated structure to reflect actual file layout (agents/, ai/, invitations/, orgs/, threads/, payments/, services/email/, services/proxy/, services/secrets/, utils/providers/)

#### v1.5.0 (2026-02-14)
- **New**: Session-based LLM proxy architecture — API keys never leave the backend
- **New**: `POST /_/ai/sessions` — Creates LLM session, resolves API key server-side, returns session token
- **New**: `POST /ai/chat` — SSE proxy that streams LLM responses using cached session config
- **New**: `sessionStore.ts` — In-memory session store with 1-hour TTL and periodic cleanup (10 tests)
- **New**: `llm.ts` — Spyable wrapper for `createLLMAdapter` (enables `vi.spyOn` in tests)
- **New**: `uuid.ts` — UUID validation utility (14 tests)
- **New**: `decryptSecret.ts` — Provider API key decryption utility
- **Removed**: `resolveAgent` endpoint — decrypted API keys no longer sent over the wire
- **Routing**: AI endpoints split: `/_/ai/sessions` (normal auth under accounts) + `/ai/chat` (session-token only at top level)
- **Testing**: 745/745 tests passing across 44 test files (was 584/584 across 36 files)

#### v1.4.0 (2026-02-08)
- **New**: Pagination for all 13 list endpoints (`?limit=N&offset=N`, default 50, max 200)
- **New**: `requireResourceWithPermission()` helper — eliminates permission boilerplate from ~15 endpoints
- **New**: `validateExclusiveArc()` utility — centralizes exclusive arc validation
- **New**: `agentId` scope support in secrets endpoints
- **Refactored**: BaseService to abstract class (REFACT-003)
- **Performance**: `fetchPlans()` parallelized with Promise.all
- **Performance**: PolarService product cache now has 5-minute TTL
- **New**: 153+ new tests (agents 25, domains 30, middleware 16, error utils 14, proxy utils 19, validation 13, pagination 10, permission 11, plus existing test updates)
- **Testing**: 584/584 tests passing across 36 test files (was 431/431 across 25 files)

#### v1.3.0 (2026-02-08)
- **Fixed**: 5 critical bugs (inverted validation, uninitialized token, subscription upsert, exclusive arc, price/product confusion)
- **Fixed**: 7 security vulnerabilities (Neon admin backdoor removed, timing attack, quota bypass, TOCTOU documented, body auth context removed, webhook replay protection, provider secret auth)
- **Fixed**: 2 performance issues (DB-level filtering for 5 list endpoints, N+1 batch query for listUsers)
- **Improved**: EPMethod enum simplified to PascalCase-only variants
- **Improved**: Delete responses standardized to `{ data: { success: true } }`
- **Improved**: Error handler includes error `code` in responses
- **Improved**: Graceful shutdown via signals()
- **Improved**: Database connection validation on startup
- **New**: `getCurrentPeriod()` utility for quota period calculation
- **New**: 85+ new tests (checkPermission, authorize, polar, database services)

#### v1.2.0 (2026-01-18)
- **New**: Payment integration via Polar.sh
- **New**: `PolarService` class with complete API integration (340 lines, 53 tests passing)
- **New**: Subscription endpoints (`/subscriptions/*`)
- **New**: Quota endpoints (`/quotas/*`)
- **New**: Payment webhook handler (`/payments/webhook`)
- **New**: `ensureSubscription` middleware for free-tier auto-assignment
- **New**: Methods: `fetchPlans()`, `createCheckoutSession()`, `cancelSubscription()`, `validateWebhookSignature()`
- **New**: Environment variables for Polar configuration

#### v1.1.0 (Previous)
- Organizations and Projects CRUD
- API Keys and Secrets management
- Endpoint and Provider management

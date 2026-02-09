---
name: "Threaded Stack - Backend Repo"
description: "Knowledge base for the backend Core API repo"
version: "1.4.0"
tags: ["express", "nodejs", "api", "websocket", "backend", "payments", "polar"]
---
# Backend Repo Skill

## Overview

The **Backend** repo (`repos/backend`) serves as the Core API server for Threaded Stack. It is built on Express 5 and acts as the central orchestration layer for:

- **Admin CRUD operations** - Organization, project, user, API key, secret, endpoint, and provider management
- **Proxy Engine** - Secure API proxying with secret injection and header transforms
- **FaaS (Functions-as-a-Service)** - Serverless compute execution
- **AI Engine** - LLM proxy with RAG and streaming capabilities

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
│   │   ├── values.ts       # Static values (AuthIgnore, sigs)
│   │   └── index.ts
│   ├── endpoints/           # API route definitions
│   │   ├── auth/           # Authentication endpoints
│   │   ├── base/           # Base/health endpoints
│   │   ├── payments/       # Payment endpoints
│   │   ├── subscriptions/  # Subscription endpoints
│   │   ├── quotas/         # Quota endpoints
│   │   ├── accounts.ts     # Main accounts routes (/_/*)
│   │   ├── endpoints.ts    # Endpoint registry
│   │   └── index.ts
│   ├── middleware/          # Express middleware setup
│   │   ├── authorize.ts    # Authorization middleware (12 tests)
│   │   ├── setupAuth.ts    # JWT authentication + ensureSubscription
│   │   ├── setupEndpoints.ts # Dynamic route builder
│   │   ├── setupErrorHandler.ts # Error handling
│   │   ├── setupProxy.ts   # Proxy to Auth-Proxy
│   │   ├── setupServer.ts  # CORS, DB, base setup
│   │   └── index.ts
│   ├── server/              # Express app and server setup
│   │   ├── app.ts          # Express app instance
│   │   ├── router.ts       # Async router wrapper
│   │   ├── server.ts       # HTTP/HTTPS server creation
│   │   └── index.ts
│   ├── services/            # Service layer
│   │   └── payments/       # Payment services
│   │       ├── polarService.ts # Polar.sh API integration (340 lines)
│   │       ├── polarService.test.ts # 53 passing tests
│   │       └── index.ts
│   ├── types/               # TypeScript type definitions
│   │   ├── endpoints.types.ts # Endpoint configs
│   │   ├── proxy.types.ts  # Proxy configuration
│   │   ├── request.types.ts # Request/Response types
│   │   ├── server.types.ts # Server configuration
│   │   ├── token.types.ts  # JWT token types
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── auth/           # Auth utilities (shouldIgnore, adminPath, parseToken, checkPermission - 20 tests)
│   │   │   └── requireResource.ts  # requireResourceWithPermission helper (11 tests)
│   │   ├── errors/         # Error handling (Exception, errorHandler, withEx)
│   │   ├── validation/      # Validation utilities
│   │   │   └── exclusiveArc.ts # Exclusive arc validation (13 tests)
│   │   ├── proxy/          # Proxy utilities (buildProxy, endpointProxy, proxyHeaders)
│   │   ├── getCurrentPeriod.ts # Billing period utility
│   │   ├── pagination.ts    # List endpoint pagination (10 tests)
│   │   ├── helpers.ts      # General utilities
│   │   ├── logger.ts       # Winston logger instance
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
- **`configs/backend.config.ts`** - Loads environment variables and builds the application config object with sections for `server`, `proxy`, `database`, and `logger`

### Application Core
- **`src/server/app.ts`** - Creates the Express app instance as a singleton
- **`src/server/server.ts`** - `initServer()` function creates HTTP or HTTPS server based on config
- **`src/server/router.ts`** - `createAsyncRouter()` wraps Express router methods with `express-async-handler` for automatic error handling

### Middleware Setup
- **`src/middleware/setupServer.ts`** - Initializes database connection, disables `x-powered-by`, sets up CORS
- **`src/middleware/setupAuth.ts`** - JWT authentication middleware via Neon Auth
- **`src/middleware/setupEndpoints.ts`** - Dynamically builds Express routes from endpoint configs
- **`src/middleware/setupProxy.ts`** - Proxies remaining requests to Auth-Proxy service
- **`src/middleware/setupErrorHandler.ts`** - Error handling middleware

### Endpoints
- **`src/endpoints/accounts.ts`** - Main admin API routes mounted at `/_/*` with JWT auth
- **`src/endpoints/base/base.ts`** - Base endpoint returning status message
- **`src/endpoints/base/health.ts`** - Health check endpoint
- **`src/endpoints/auth/auth.ts`** - Authentication endpoint structure
- **`src/endpoints/orgs/**`** - Organizations CRUD with member management
- **`src/endpoints/users/**`** - Users CRUD operations
- **`src/endpoints/projects/**`** - Projects CRUD (renamed from repos)
- **`src/endpoints/apiKeys/**`** - API Keys with generation, scoping, rate limiting
- **`src/endpoints/secrets/**`** - Secrets with AES-256-GCM encryption
- **`src/endpoints/endpoints/**`** - Endpoint definitions CRUD
- **`src/endpoints/providers/**`** - Provider configurations
- **`src/endpoints/subscriptions/**`** - Subscription management
- **`src/endpoints/quotas/**`** - Quota checking and limits
- **`src/endpoints/payments/**`** - Payment processing and webhooks
- **`src/services/payments/polarService.ts`** - Polar.sh integration (53 passing tests)

### Utilities
- **`src/utils/logger.ts`** - Winston logger configured from config
- **`src/utils/auth/shouldIgnore.ts`** - Determines if request should bypass auth
- **`src/utils/auth/adminPath.ts`** - Builds admin API path prefix
- **`src/utils/proxy/buildProxy.ts`** - Builds proxy middleware configuration
- **`src/utils/proxy/endpointProxy.ts`** - Creates proxy for specific endpoints
- **`src/utils/errors/errorHandler.ts`** - Express error handler middleware
- **`src/utils/errors/exception.ts`** - Custom Exception class for structured errors
- **`src/utils/auth/requireResource.ts`** - Permission check + resource fetch helper (11 tests)
- **`src/utils/validation/exclusiveArc.ts`** - Exclusive arc validation utility (13 tests)
- **`src/utils/pagination.ts`** - Pagination query parser (default limit=50, max=200) (10 tests)

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
2. **Server Setup** - Database connection, CORS, basic Express config
3. **Endpoints** - Dynamic route registration from `endpoints/` directory
4. **Proxy** - Catch-all proxy to Auth-Proxy service for unhandled routes
5. **Logger Error** - Logs errors (from `@tdsk/logger`)
6. **Error Handler** - Formats and sends error responses

## API Routes

### Admin Routes (`/_/*`)

All admin API routes are mounted under the admin path prefix (configured via `TDSK_BE_API_ADMIN_PATH`, default `/_`):

**Organization Management:**
- **GET `/_/orgs`** - List all organizations for user — Supports ?limit=N&offset=N
- **GET `/_/orgs/:id`** - Get organization by ID
- **POST `/_/orgs`** - Create new organization
- **PUT `/_/orgs/:id`** - Update organization
- **DELETE `/_/orgs/:id`** - Delete organization
- **GET `/_/orgs/:id/members`** - List organization members — Supports ?limit=N&offset=N
- **POST `/_/orgs/:id/members`** - Add member to organization
- **DELETE `/_/orgs/:id/members/:userId`** - Remove member from organization

**User Management:**
- **GET `/_/users`** - List users — Supports ?limit=N&offset=N
- **GET `/_/users/:id`** - Get user by ID
- **POST `/_/users`** - Create user
- **PUT `/_/users/:id`** - Update user
- **DELETE `/_/users/:id`** - Delete user

**Project Management:**
- **GET `/_/projects`** - List projects (optionally by org) — Supports ?limit=N&offset=N
- **GET `/_/projects/:id`** - Get project by ID
- **POST `/_/projects`** - Create project
- **PUT `/_/projects/:id`** - Update project
- **DELETE `/_/projects/:id`** - Delete project

**API Key Management:**
- **GET `/_/api-keys`** - List API keys — Supports ?limit=N&offset=N
- **GET `/_/api-keys/:id`** - Get API key by ID
- **POST `/_/api-keys`** - Generate new API key
- **PUT `/_/api-keys/:id`** - Update API key (name, scopes, rate limits)
- **DELETE `/_/api-keys/:id`** - Revoke API key

**Secret Management:**
- **GET `/_/secrets`** - List secrets (by org or project scope) — Supports ?limit=N&offset=N
- **GET `/_/secrets/:id`** - Get secret by ID
- **POST `/_/secrets`** - Create encrypted secret
- **PUT `/_/secrets/:id`** - Update secret
- **DELETE `/_/secrets/:id`** - Delete secret

**Endpoint Management:**
- **GET `/_/endpoints`** - List endpoints — Supports ?limit=N&offset=N
- **GET `/_/endpoints/:id`** - Get endpoint by ID
- **POST `/_/endpoints`** - Create endpoint
- **PUT `/_/endpoints/:id`** - Update endpoint
- **DELETE `/_/endpoints/:id`** - Delete endpoint

**Provider Management:**
- **GET `/_/providers`** - List providers — Supports ?limit=N&offset=N
- **GET `/_/providers/:id`** - Get provider by ID
- **POST `/_/providers`** - Create provider
- **PUT `/_/providers/:id`** - Update provider
- **DELETE `/_/providers/:id`** - Delete provider

**Agent Management:**
- **GET `/_/agents`** - List agents — Supports ?limit=N&offset=N
- **GET `/_/agents/:id`** - Get agent by ID
- **POST `/_/agents`** - Create agent
- **PUT `/_/agents/:id`** - Update agent
- **DELETE `/_/agents/:id`** - Delete agent

**Domain Management:**
- **GET `/_/domains`** - List domains — Supports ?limit=N&offset=N
- **GET `/_/domains/:id`** - Get domain by ID
- **POST `/_/domains`** - Create domain
- **PUT `/_/domains/:id`** - Update domain
- **DELETE `/_/domains/:id`** - Delete domain

**Config Management:**
- **GET `/_/configs`** - List configs — Supports ?limit=N&offset=N
- **GET `/_/configs/:id`** - Get config by ID
- **POST `/_/configs`** - Create config
- **PUT `/_/configs/:id`** - Update config
- **DELETE `/_/configs/:id`** - Delete config

**Function Management:**
- **GET `/_/functions`** - List functions — Supports ?limit=N&offset=N
- **GET `/_/functions/:id`** - Get function by ID
- **POST `/_/functions`** - Create function
- **PUT `/_/functions/:id`** - Update function
- **DELETE `/_/functions/:id`** - Delete function

**Invitation Management:**
- **GET `/_/invitations`** - List invitations — Supports ?limit=N&offset=N
- **GET `/_/invitations/:id`** - Get invitation by ID
- **POST `/_/invitations`** - Create invitation
- **PUT `/_/invitations/:id/accept`** - Accept invitation
- **DELETE `/_/invitations/:id`** - Delete invitation

**Subscription Management:**
- **GET `/_/subscriptions/current`** - Get current user subscription
- **GET `/_/subscriptions/plans`** - List available payment plans
- **POST `/_/subscriptions/checkout`** - Create checkout session
- **POST `/_/subscriptions/portal`** - Create customer portal session
- **DELETE `/_/subscriptions/current`** - Cancel subscription

**Quota Management:**
- **GET `/_/quotas/:orgId`** - Get current period usage
- **GET `/_/quotas/:orgId/limits`** - Get plan limits from owner's subscription
- **POST `/_/quotas/:orgId/check`** - Check if action would exceed quota

**Payment Processing:**
- **POST `/_/payments/webhook`** - Polar.sh webhook handler

**Base Routes:**
- **GET `/_/`** - Base endpoint, returns status message
- **GET `/_/health`** - Health check endpoint

Routes are protected by JWT authentication middleware except those in `AuthIgnore` list (`/`, `/health`).

### Proxy Routes (`/**`)

All routes not matched by endpoints are proxied to the Auth-Proxy service configured via `TDSK_BE_REMOTE` and `TDSK_BE_REMOTE_PORT`.

## Logic Flow

### Request Flow

```
1. Request arrives at Express app
2. Winston request logger logs the request
3. CORS middleware checks origin
4. Router attempts to match endpoint
   ├─ If matched: Execute endpoint handler
   │  └─ If protected: Run authenticate middleware
   └─ If not matched: Proxy to Auth-Proxy service
5. Response sent or error thrown
6. Winston error logger logs errors
7. Error handler formats error response
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
5. Continue to endpoint handler
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

## Dependencies

### Core Dependencies

| Package | Purpose |
|---------|---------|
| `express@5.1.0` | Web server framework |
| `express-async-handler` | Automatic error handling for async routes |
| `express-jwt` | JWT middleware |
| `jsonwebtoken` | JWT signing and verification |
| `http-proxy-middleware` | Proxy middleware for forwarding requests |
| `cors` | Cross-Origin Resource Sharing |
| `winston@3.17.0` | Logging framework |
| `axios` | HTTP client |

### Workspace Dependencies

- `@tdsk/domain` - Shared types and domain models
- `@tdsk/database` - Database ORM (Drizzle) and services
- `@tdsk/logger` - Winston logging service

### Development Dependencies

- `@biomejs/biome` - Linting and formatting
- `tsup` - TypeScript bundler for build
- `vitest` - Testing framework
- `typescript@5.7.3` - TypeScript compiler

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

* Linting and formatting are automatically, so `pnpm lint` and `pnpm format` commands should be ignored.

## Integration Points

### Database Integration

- Initializes database connection in `setupServer` middleware
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
- `../../domain/src` - Domain package
- `../../logger/src` - Logger package
- `../../database/src` - Database package

Changes to any of these trigger automatic rebuild and server restart.

---

**Last Updated:** 2026-02-08
**Version:** 1.4.0

### Changelog

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

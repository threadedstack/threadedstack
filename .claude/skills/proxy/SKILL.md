---
name: "Threaded Stack - Proxy Repo"
description: "Knowledge base for the Auth Gateway proxy repo"
tags: ["express", "jwt", "jwks", "proxy", "auth", "gateway", "typescript", "jose", "session"]
---
# Proxy Repo Skill

## Overview

The **proxy** repo (`@tdsk/proxy`) serves as the **Auth Gateway** and single entry point for all external traffic in the Threaded Stack platform. It is responsible for:

- **JWT Validation**: JWKS-based token verification via jose library (integrates with Neon Auth)
- **API Key Authentication**: Bearer token validation for `tdsk_*` API keys
- **Session Token Validation**: `Authorization: Session <token>` validation for session routes (`/ai/chat`, `/ai/stream`)
- **Request Proxying**: Forwarding authenticated requests to the backend API via http-proxy-middleware (admin routes `/_/*`, AI routes `/ai/*`, and proxy routes `/proxy/*`)
- **Certificate Pre-warming**: Caddy on_demand_tls integration for domain validation
- **Request Logging**: Structured request/response logging with timing via Winston
- **Signal Handling**: Graceful shutdown on SIGINT, SIGTERM, SIGQUIT

**Authentication Model**: Triple-auth system:
1. **JWT Auth** (Neon Auth via JWKS) -- validates JWT tokens for most routes
2. **API Key Auth** -- validates `tdsk_*` Bearer tokens for programmatic access
3. **Session Token Auth** -- validates `Authorization: Session <token>` for session routes only (`/ai/chat`, `/ai/stream`)

The proxy does not handle login/register/refresh -- those are managed by the Admin SPA directly with Neon Auth.

## Directory Structure

```
repos/proxy/
├── configs/                          # Build and app configurations
│   ├── aliases.ts                   # Path alias setup (alias-hq)
│   ├── biome.json                   # Biome linter/formatter config
│   ├── proxy.config.ts              # Main proxy config (Server, Backend, Logger, JWKS, Domains)
│   ├── proxy.config.test.ts         # Config validation tests (7 tests)
│   ├── tsup.config.ts              # Production build config (CJS bundle)
│   ├── tsdown.config.ts            # Alternative build config (tsdown)
│   └── vitest.config.ts            # Vitest test runner config
├── scripts/                          # Utility scripts
│   ├── loadEnvs.ts                  # Environment variable loader from YAML
│   └── addToProcess.ts             # Helper to inject envs into process.env
├── src/                              # Source code
│   ├── constants/                   # Static values
│   │   ├── values.ts               # ProcessSignals, PublicRoutes, SessionRoutes, ProxyForwardRoutes, LoggerIgnore
│   │   └── index.ts
│   ├── endpoints/                   # Route handlers
│   │   ├── health.ts               # GET /health — service health check
│   │   ├── health.test.ts          # Health endpoint test (1 test)
│   │   ├── auth/
│   │   │   ├── me.ts               # GET /auth/me — returns JWT user info
│   │   │   ├── me.test.ts          # Auth me tests (2 tests)
│   │   │   ├── logout.ts           # POST /auth/logout — logout acknowledgment
│   │   │   ├── logout.test.ts      # Logout test (1 test)
│   │   │   └── index.ts
│   │   ├── domains/
│   │   │   ├── validate.ts         # GET /domains/validate — Caddy domain validation
│   │   │   ├── validate.test.ts    # Domain validation tests (4 tests)
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── middleware/                   # Express middleware chain
│   │   ├── setupServer.ts          # CORS, x-powered-by, urlencoded, router mount
│   │   ├── setupAuth.ts            # JWT validation via JWKS, attaches req.user (skips session routes)
│   │   ├── setupAuth.test.ts       # JWT auth middleware tests (13 tests)
│   │   ├── setupApiKeyAuth.ts      # API key auth for tdsk_* tokens (skips session routes)
│   │   ├── setupApiKeyAuth.test.ts # API key auth tests (17 tests)
│   │   ├── setupSessionAuth.ts     # Session token auth for /ai/chat and /ai/stream
│   │   ├── setupSessionAuth.test.ts # Session auth middleware tests (9 tests)
│   │   ├── setupProxy.ts           # http-proxy-middleware → backend forwarding (/_/*, /ai/*, /proxy/*)
│   │   ├── setupProxy.test.ts      # Proxy middleware tests (20 tests)
│   │   ├── setupLogger.ts          # Request/response logging with timing
│   │   ├── setupLogger.test.ts     # Logger middleware tests (4 tests)
│   │   ├── setupDatabase.ts        # Database initialization on app.locals.db
│   │   ├── setupEndpoints.ts       # Route registration (4 endpoints)
│   │   ├── setupErrorHandler.ts    # Global error handler mount
│   │   ├── setupPrewarm.ts         # Caddy certificate pre-warming interceptor
│   │   └── index.ts
│   ├── server/                      # Server initialization
│   │   ├── app.ts                  # Express app instance (TProxyApp)
│   │   ├── router.ts              # Async router (wraps handlers with express-async-handler)
│   │   ├── server.ts              # HTTP/HTTPS server creation with SSL cert loading
│   │   └── index.ts
│   ├── services/                    # Business logic
│   │   ├── auth.ts                 # Auth class — JWKS client, token extraction, JWT verification
│   │   ├── auth.test.ts            # Auth service tests (16 tests)
│   │   └── index.ts
│   ├── types/                       # TypeScript type definitions
│   │   ├── proxy.types.ts          # TProxyApp = TApp<TProxyConfig>
│   │   ├── auth.types.ts           # EJWTError, TTokenPayload, TAuthUser, TJWTPayload, TJWTValidationResult
│   │   ├── config.types.ts         # TServerConfig, TBackendConfig, TLoggerConfig, TJWKSConfig, TDomainsConfig, TProxyConfig
│   │   ├── envs.types.ts           # TLogLevel union type
│   │   ├── express.types.ts        # Global Express Request.user extension
│   │   └── index.ts
│   ├── utils/                       # Utility functions
│   │   ├── logger.ts               # Winston logger factory via buildApiLogger()
│   │   ├── logger.test.ts          # Logger tests (11 tests)
│   │   ├── signals.ts              # Graceful shutdown on SIGINT/SIGTERM/SIGQUIT
│   │   ├── errors/
│   │   │   ├── errorHandler.ts     # Express error middleware — returns status/message/errorCode
│   │   │   ├── errorHandler.test.ts # Error handler tests (5 tests)
│   │   │   ├── exception.ts        # Custom Exception class with status code
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── proxy.ts                     # Main orchestrator — wires all middleware in order
│   ├── start.ts                     # Entry point — calls proxy(config) via ife()
│   └── index.ts                     # Re-exports start.ts
├── package.json
└── tsconfig.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Main orchestrator -- sets config on app.locals, calls setup functions in order |
| `src/start.ts` | Entry point -- loads config and calls `proxy(config)` |
| `src/services/auth.ts` | Auth class -- JWKS client init via jose, token extraction (Bearer + Session), JWT verification, public/session route checks |
| `src/middleware/setupAuth.ts` | JWT validation middleware -- skips public routes and session routes, verifies token, attaches `req.user` |
| `src/middleware/setupApiKeyAuth.ts` | API key validation middleware -- skips public routes and session routes, validates `tdsk_*` tokens |
| `src/middleware/setupSessionAuth.ts` | Session token validation middleware -- ONLY applies to session routes (`/ai/chat`, `/ai/stream`), requires `Authorization: Session <token>` |
| `src/middleware/setupProxy.ts` | http-proxy-middleware -- forwards `/_/*`, `/ai/*`, and `/proxy/*` routes to backend with auth headers |
| `src/middleware/setupServer.ts` | CORS, body parsing, router mount |
| `src/middleware/setupLogger.ts` | Request/response logging with request IDs and timing |
| `src/middleware/setupPrewarm.ts` | Caddy certificate pre-warming interceptor |
| `src/middleware/setupDatabase.ts` | Database initialization on `app.locals.db` |
| `src/middleware/setupEndpoints.ts` | Route registration for 4 endpoints |
| `src/server/router.ts` | Async router wrapping HTTP methods with express-async-handler |
| `src/server/server.ts` | HTTP/HTTPS server creation with SSL cert loading |
| `src/utils/errors/errorHandler.ts` | Global Express error handler |
| `src/utils/errors/exception.ts` | Custom Exception class with status code |
| `src/utils/signals.ts` | Graceful shutdown handlers |
| `src/constants/values.ts` | ProcessSignals, PublicRoutes, SessionRoutes, ProxyForwardRoutes, BearerPrefix, SessionPrefix, LoggerIgnore |
| `configs/proxy.config.ts` | Main config -- Server, Backend, Logger, JWKS, Domains |

## Constants (`src/constants/values.ts`)

```typescript
export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]
export const PublicRoutes = [`/health`, `/domains/validate`]
export const BearerPrefix = `Bearer `
export const SessionPrefix = `Session `
export const SessionRoutes = [`/ai/chat`, `/ai/stream`]
export const ProxyForwardRoutes = [`/ai`, `/proxy`]
export const LoggerIgnore = { methods: [`OPTIONS`], routes: [] }
```

## Endpoints

| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| GET | `/health` | Public | `health.ts` | Returns `{ status: "ok", service: "auth-proxy", timestamp }` |
| GET | `/auth/me` | Protected (JWT/API key) | `auth/me.ts` | Returns decoded JWT user from `req.user` |
| POST | `/auth/logout` | Protected (JWT/API key) | `auth/logout.ts` | Logout acknowledgment (client-side auth) |
| GET | `/domains/validate` | Public | `domains/validate.ts` | Caddy on_demand_tls domain validation via DB |
| `/_/*` | (proxied) | Protected (JWT/API key) | `setupProxy.ts` | All admin routes forwarded to backend |
| `/ai/*` | (proxied) | Session token (`/ai/chat`, `/ai/stream`) or JWT/API key (other `/ai/*`) | `setupProxy.ts` | AI routes forwarded to backend |
| `/proxy/*` | (proxied) | Protected (JWT/API key) | `setupProxy.ts` | Proxy engine routes forwarded to backend |

## Middleware Chain Order

Defined in `src/proxy.ts`:

```
1. setupLogger         → Request/response logging (skips OPTIONS)
2. setupServer         → CORS, urlencoded, router mount
3. setupDatabase       → Initialize DB singleton on app.locals.db
4. setupAuth           → JWT validation via JWKS (skips PublicRoutes + SessionRoutes)
5. setupApiKeyAuth     → API key validation for tdsk_* tokens (skips PublicRoutes + SessionRoutes)
6. setupSessionAuth    → Session token validation (ONLY SessionRoutes: /ai/chat, /ai/stream)
7. setupPrewarm        → Caddy cert pre-warming (returns 200 if prewarm header present)
8. setupEndpoints      → Register /health, /auth/me, /auth/logout, /domains/validate
9. setupProxy          → http-proxy-middleware for /_/*, /ai/*, /proxy/* → backend
10. setupErrorHandler  → Global error handler
```

### Auth Flow Decision Tree

The triple-auth system works as follows:

1. **Public Routes** (`/health`, `/domains/validate`) -- Skip all auth
2. **Session Routes** (`/ai/chat`, `/ai/stream`) -- Skip JWT + API key -- Require Session token
3. **All Other Routes** (`/_/*`, `/auth/me`, `/auth/logout`, `/proxy/*`, other `/ai/*`) -- JWT or API key required

**Auth Middleware Execution**:
- `setupAuth` -- Runs for all routes EXCEPT public + session routes
- `setupApiKeyAuth` -- Runs for all routes EXCEPT public + session routes (fallback if JWT fails)
- `setupSessionAuth` -- Runs ONLY for session routes (`/ai/chat`, `/ai/stream`)

**Result**: Each route gets exactly ONE auth mechanism applied, never multiple.

## Auth Service (`src/services/auth.ts`)

The `Auth` class manages JWKS-based JWT verification and route classification:

```typescript
class Auth {
  constructor(opts: { url: string })       // Initializes JWKS client via jose.createRemoteJWKSet()
  initialized(): boolean                   // Returns true if JWKS client is ready
  isPublic(path: string): boolean          // Checks path against PublicRoutes
  isSession(path: string): boolean         // Checks path against SessionRoutes (/ai/chat, /ai/stream)
  extract(req: Request): string|null       // Extracts token from Authorization header (Bearer or Session prefix)
  verify(token: string): Promise<TJWTValidationResult>  // Verifies JWT via JWKS
}
```

**Token extraction** (`extract`) handles both prefixes:
- `Authorization: Bearer <token>` -- returns token (JWT or API key)
- `Authorization: Session <token>` -- returns token (session token)

Error handling in `verify()` maps jose errors to structured results:
- `JWTExpired` -- `{ valid: false, expired: true, error: "Token expired" }`
- `JWTClaimValidationFailed` -- `{ valid: false, error: "Token claim validation failed: ..." }`
- `JWSSignatureVerificationFailed` -- `{ valid: false, error: "Invalid token signature" }`

## Session Auth Middleware (`src/middleware/setupSessionAuth.ts`)

The `setupSessionAuth` middleware validates session tokens for session routes:

**Behavior**:
- **Only runs on session routes** (`/ai/chat`, `/ai/stream`) -- all other routes skip this middleware
- Uses `app.locals.auth.isSession(req.path)` to check if route is a session route
- Extracts token via `app.locals.auth.extract(req)` (handles `Session` prefix)
- **Does NOT validate the token itself** -- backend validates it
- Returns 401 if missing or malformed

**Token Format**: `Authorization: Session <token>` (note "Session " prefix with space)

**Why separate from JWT/API key auth**:
- Session routes use ephemeral session tokens from backend's `/_/ai/sessions` endpoint
- Session tokens have different lifecycle than JWT/API keys
- Backend needs to validate session tokens with internal state (not JWKS)

## API Key Auth Middleware (`src/middleware/setupApiKeyAuth.ts`)

Validates `tdsk_*` API keys as a fallback when JWT auth does not set `req.user`:

**Flow**:
1. If `req.user` already set (JWT succeeded) -- skip
2. If route is public -- skip
3. If route is a session route -- skip
4. Extract token from `Authorization: Bearer tdsk_...`
5. Hash with `hashKey()` from `@tdsk/domain` and look up in database
6. Validate (active, not expired, has userId)
7. Set `req.user` with key's userId and scope-derived role
8. Fire-and-forget `touchLastUsed()` update

**Scope-to-role mapping**:
- `admin` scope -- `admin` role
- `write` scope -- `member` role
- All else -- `viewer` role

## Proxy Forwarding (`src/middleware/setupProxy.ts`)

Uses `http-proxy-middleware` to forward requests to the backend:

**Proxy Routes** (defined via `adminPath` + `ProxyForwardRoutes`):
1. **Admin Routes** (`/_/*`) -- Backend admin API (protected by JWT/API key)
2. **AI Routes** (`/ai/*`) -- Backend AI engine (session routes use session token, others use JWT/API key)
3. **Proxy Routes** (`/proxy/*`) -- Backend proxy engine (protected by JWT/API key)

**Proxy Configuration**:
- **Target**: Backend URL from config (supports Kubernetes service discovery)
- **Path Rewrite**: Preserves `req.originalUrl` (backend expects the original URL)
- **Custom Headers**: Sets `headerKey`/`headerValue` from config (shared secret)
- **Auth Headers**: Calls `setAuthHeaders(proxyReq, req)` from `@tdsk/domain` to inject `X-User-Id`, `X-User-Role`, `X-User-Email`
- **WebSocket**: Enabled (`ws: true`)
- **X-Forwarded**: Enabled (`xfwd: true`)
- **Change Origin**: Enabled (`changeOrigin: true`)
- **Error Handling**: Returns 502 with "Backend service unavailable" on proxy errors

**Implementation**: Single `createProxyMiddleware` call with path filter matching `/_` (from adminPath) plus `ProxyForwardRoutes` (`/ai`, `/proxy`).

## Architecture

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Express | 5.1.0 | Web framework |
| jose | 6.1.3 | JWKS-based JWT verification |
| http-proxy-middleware | 3.0.5 | Backend request proxying |
| express-async-handler | 1.2.0 | Async route wrapper |
| cors | 2.8.5 | CORS middleware |
| Winston | via `@tdsk/logger` | Structured logging |
| tsup | 8.3.6 | Production bundling (CJS) |
| tsdown | 0.20.2 | Dev build with watch |
| Vitest | 1.6.1 | Test runner |
| Biome | | Linting/formatting |

### Design Patterns

1. **Middleware Chain Pattern**: Each `setup*` function adds middleware to the Express app in a specific order
2. **Async Router Pattern**: All HTTP methods wrapped with `express-async-handler` for automatic error propagation
3. **Auth Service Pattern**: Singleton Auth class on `app.locals.auth` for JWKS validation, route classification, and token extraction
4. **Path Alias Pattern**: `@TPX/*` for proxy paths, `@TDM/*` for domain, `@TDB/*` for database
5. **Config Pattern**: Typed config object loaded from environment variables via `deploy/values.*.yml`
6. **Signal Handling Pattern**: Graceful shutdown on SIGINT/SIGTERM/SIGQUIT with `server.close()`

### Request Flow

```
Client Request
  ↓
setupLogger        → Log request (method, path, requestId, IP, UA)
  ↓
setupServer        → CORS validation, URL-encoded body parsing
  ↓
setupDatabase      → Initialize DB singleton on app.locals.db
  ↓
setupAuth          → Check PublicRoutes → Skip SessionRoutes → Extract Bearer token → Verify via JWKS → Attach req.user
  ↓
setupApiKeyAuth    → Skip if req.user set → Skip PublicRoutes + SessionRoutes → Validate tdsk_* Bearer tokens → Attach req.user
  ↓
setupSessionAuth   → ONLY SessionRoutes (/ai/chat, /ai/stream) → Extract Authorization: Session <token> → 401 if missing
  ↓
setupPrewarm       → If prewarm header present, return 200 early
  ↓
setupEndpoints     → Match /health, /auth/me, /auth/logout, /domains/validate
  ↓
setupProxy         → Forward /_/*, /ai/*, /proxy/* to backend with auth headers
  ↓
setupErrorHandler  → Catch errors, return status/message/errorCode
  ↓
Response logged via setupLogger's res.on('finish') listener
```

**Example Flows**:

1. **Admin API Request** (`GET /_/orgs`):
   - setupAuth -- JWT validated -- `req.user` set -- setupApiKeyAuth skipped (req.user exists) -- setupSessionAuth skipped (not session route) -- proxied to backend

2. **API Key Request** (`GET /_/orgs` with `Authorization: Bearer tdsk_abc123`):
   - setupAuth -- Token starts with `tdsk_`, calls next() -- setupApiKeyAuth -- API key validated -- `req.user` set -- setupSessionAuth skipped -- proxied to backend

3. **AI Chat Request** (`POST /ai/chat` with `Authorization: Session <token>`):
   - setupAuth -- Skipped (session route) -- setupApiKeyAuth -- Skipped (session route) -- setupSessionAuth -- Session token present -- proxied to backend

4. **AI Stream Request** (`POST /ai/stream` with `Authorization: Session <token>`):
   - setupAuth -- Skipped (session route) -- setupApiKeyAuth -- Skipped (session route) -- setupSessionAuth -- Session token present -- proxied to backend

5. **Public Request** (`GET /health`):
   - All auth middleware skipped -- setupEndpoints matches -- returns 200

## Configuration

### Config Structure (`configs/proxy.config.ts`)

```typescript
config = {
  server: { port, enableSSL, origins, certs },
  backend: { url, adminPath, headerKey, headerValue },
  logger: { label, level, pretty, silent, exceptions, rejections, exitOnError },
  jwks: { jwksUrl },
  domains: { prewarmHeader },
}
```

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `local` | Runtime environment (local/dev/prod) |
| `TDSK_PX_PORT` | number | `4000` | Server port |
| `TDSK_PX_ENABLE_SSL` | boolean | `false` | Enable HTTPS (non-production only) |
| `TDSK_PX_SSL_CA` | string | - | SSL CA certificate file path |
| `TDSK_PX_SSL_KEY` | string | - | SSL key file path |
| `TDSK_PX_SSL_CERT` | string | - | SSL cert file path |
| `TDSK_PX_ALLOW_ORIGIN` | string | `http://localhost:5887` | Comma-separated CORS origins |
| `TDSK_PX_LOG_LEVEL` | TLogLevel | `info` | Logger verbosity |
| `TDSK_PX_LOGGER_PRETTY` | boolean | `false` | Pretty-printed logs (dev) |
| `TDSK_PX_LOGGER_SILENT` | boolean | `false` | Disable all logging |
| `TDSK_BE_URL` | string | - | Backend URL (direct) |
| `TDSK_BE_HOST` | string | - | Backend host (fallback) |
| `TDSK_BE_PORT` | string | - | Backend port |
| `TDSK_BE_DEPLOYMENT` | string | - | Kubernetes deployment name |
| `TDSK_BE_HEADER_KEY` | string | - | Custom header key for proxy-to-backend |
| `TDSK_BE_HEADER_VALUE` | string | - | Custom header value for proxy-to-backend |
| `TDSK_BE_API_ADMIN_PATH` | string | `_` | Admin API path prefix |
| `TDSK_AUTH_JWKS` | string | `` | JWKS URL for JWT validation (Neon Auth) |
| `TDSK_CADDY_PREWARM_HEADER` | string | - | Header name for Caddy cert pre-warming |
| `TDSK_LOG_LEVEL` | string | `info` | Fallback log level (used if TDSK_PX_LOG_LEVEL not set) |

## Integration Points

### With Backend (`@tdsk/backend`)
- **Request Forwarding**: Proxy forwards `/_/*`, `/ai/*`, and `/proxy/*` routes to backend via http-proxy-middleware
- **Auth Headers**: `setAuthHeaders()` injects `X-User-Id`, `X-User-Role`, `X-User-Email`
- **Backend Secret**: `headerKey`/`headerValue` config provides proxy-to-backend identity verification
- **WebSocket**: Proxy forwards WebSocket connections (`ws: true`)
- **Session Tokens**: Session routes validated by proxy (presence check), but token itself is validated by backend

### With Domain (`@tdsk/domain`)
- `setAuthHeaders` -- Sets auth headers on proxied requests
- `adminPath` -- Returns `/_` path prefix for backend routing
- `loadEnvs` / `inKube` -- Environment loading and Kubernetes detection
- `hashKey` -- Hashes API keys for database lookup
- `ApiKeyPrefix` -- The `tdsk_` prefix constant for API key detection
- `TApp` -- Generic Express app type
- `TSSLCreds` -- SSL certificate file paths type

### With Database (`@tdsk/database`)
- `database()` -- Initialized once during startup in `setupDatabase()`, stored on `app.locals.db`
- Used by `/domains/validate` endpoint via `req.app.locals.db`
- Used by `setupApiKeyAuth` middleware to look up API keys via `db.services.apiKey.getByHash()`

### With Logger (`@tdsk/logger`)
- `buildApiLogger()` -- Creates Winston logger with label and level

### With Admin (`@tdsk/admin`)
- Admin SPA authenticates with Neon Auth, sends JWT to proxy
- Proxy validates JWT, forwards to backend with auth headers
- CORS configured to allow admin origin

## Commands

```bash
# Development
pnpm start              # Dev server with watch (tsup, watches src + domain + logger + database)
pnpm serve              # Run built bundle (node dist/index.cjs with http-proxy-middleware debug)

# Building
pnpm build              # Production build (tsup → dist/index.cjs)
pnpm d:build            # Alternative build (tsdown)
pnpm clean              # Remove dist/

# Testing
pnpm test               # Run tests (vitest run) — 110 tests, 13 files
pnpm test:watch         # Watch mode tests
```

### Commands Notes
* Linting and formatting run automatically via Biome -- `pnpm lint` and `pnpm format` should be ignored.
* `pnpm start` watches `../domain/src`, `../logger/src`, and `../database/src` for cross-repo changes.

## Testing

### Current Coverage (110 tests, 13 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `configs/proxy.config.test.ts` | 7 | Config shape, types, defaults, JWKS URL format |
| `src/endpoints/health.test.ts` | 1 | Health endpoint returns 200 with correct shape |
| `src/endpoints/auth/me.test.ts` | 2 | /auth/me happy path and 401 when no user |
| `src/endpoints/auth/logout.test.ts` | 1 | /auth/logout success response |
| `src/endpoints/domains/validate.test.ts` | 4 | Domain validation: 400/403/200/500 cases |
| `src/services/auth.test.ts` | 16 | Auth class: constructor, isPublic, isSession, extract (Bearer + Session), verify (all branches) |
| `src/middleware/setupAuth.test.ts` | 13 | Auth middleware: public routes, 401/500 cases, req.user attachment, session route skip |
| `src/middleware/setupApiKeyAuth.test.ts` | 17 | API key auth: validation, scope-to-role mapping, session route skip, expiry, revocation |
| `src/middleware/setupSessionAuth.test.ts` | 9 | Session auth: /ai/chat + /ai/stream validation, missing token 401, non-session-route passthrough, malformed headers |
| `src/middleware/setupProxy.test.ts` | 20 | Proxy: path normalization, middleware creation, headers, /_/* and /ai/* and /proxy/* routes |
| `src/middleware/setupLogger.test.ts` | 4 | Request logger: OPTIONS skip, logging, UUID requestId |
| `src/utils/logger.test.ts` | 11 | Logger creation, API methods, config integration |
| `src/utils/errors/errorHandler.test.ts` | 5 | Error handler: Exception/Error handling, logging, status codes |

## Path Aliases (tsconfig.json)

```json
{
  "@TPX": ["src"],
  "@TPX/*": ["src/*"],
  "@TPX/configs": ["configs"],
  "@TPX/configs/*": ["configs/*"],
  "@TDM": ["../domain/src"],
  "@TDM/*": ["../domain/src/*"],
  "@TDB": ["../database/src"],
  "@TDB/*": ["../database/src/*"],
  "@TDB/configs": ["../database/configs"],
  "@TDB/configs/*": ["../database/configs/*"],
  "@tdsk/domain": ["../domain/src"],
  "@tdsk/domain/*": ["../domain/src/*"],
  "@tdsk/database": ["../database/src"],
  "@tdsk/database/*": ["../database/src/*"],
  "@tdsk/logger": ["../logger/src"],
  "@tdsk/logger/*": ["../logger/src/*"],
  "@ROOT": ["../../"],
  "@ROOT/*": ["../../*"]
}
```

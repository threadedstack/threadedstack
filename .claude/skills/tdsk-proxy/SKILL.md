---
name: "tdsk-proxy"
description: "Knowledge base for the Auth Gateway proxy repo"
tags: ["express", "jwt", "jwks", "proxy", "auth", "gateway", "typescript", "jose", "session"]
---
# Proxy Repo Skill

## Overview

The **proxy** repo (`@tdsk/proxy`) serves as the **Auth Gateway** and single entry point for all external traffic in the Threaded Stack platform. It is responsible for:

- **JWT Validation**: JWKS-based token verification via jose library (integrates with Neon Auth)
- **API Key Authentication**: Bearer token validation for `tdsk_*` API keys
- **Session Token Validation**: `Authorization: Session <token>` validation for session routes (`/ai/ws`)
- **Request Proxying**: Forwarding authenticated requests to the backend API via http-proxy-middleware (admin routes `/_/*`, AI routes `/ai/*`, and proxy routes `/proxy/*`)
- **Certificate Pre-warming**: Caddy on_demand_tls integration for domain validation
- **Request Logging**: Structured request/response logging with timing via Winston
- **Signal Handling**: Graceful shutdown on SIGINT, SIGTERM, SIGQUIT

**Authentication Model**: Triple-auth system:
1. **JWT Auth** (Neon Auth via JWKS) -- validates JWT tokens for most routes
2. **API Key Auth** -- validates `tdsk_*` Bearer tokens for programmatic access
3. **Session Token Auth** -- validates `Authorization: Session <token>` for session routes only (`/ai/ws`)

The proxy does not handle login/register/refresh -- those are managed by the Admin SPA directly with Neon Auth.

## Directory Structure

```
repos/proxy/
├── configs/                          # Build and app configurations
│   ├── proxy.config.ts              # Main proxy config (Server, Backend, Logger, JWKS, Domains)
│   ├── proxy.config.test.ts         # Config validation tests (7 tests)
│   └── vitest.config.ts            # Vitest test runner config
├── src/
│   ├── constants/
│   │   └── values.ts               # ProcessSignals, PublicRoutes, SessionRoutes, ProxyForwardRoutes, LoggerIgnore
│   ├── endpoints/
│   │   ├── health.ts               # GET /health — service health check
│   │   ├── auth/
│   │   │   ├── me.ts               # GET /auth/me — returns JWT user info
│   │   │   └── logout.ts           # POST /auth/logout — logout acknowledgment
│   │   └── domains/
│   │       └── validate.ts         # GET /domains/validate — Caddy domain validation
│   ├── middleware/
│   │   ├── setupServer.ts          # CORS, x-powered-by, urlencoded, router mount
│   │   ├── setupAuth.ts            # JWT validation via JWKS, attaches req.user (skips session routes)
│   │   ├── setupApiKeyAuth.ts      # API key auth for tdsk_* tokens (skips session routes)
│   │   ├── setupSessionAuth.ts     # Session token auth for /ai/ws
│   │   ├── setupProxy.ts           # http-proxy-middleware → backend forwarding (/_/*, /ai/*, /proxy/*)
│   │   ├── setupLogger.ts          # Request/response logging with timing
│   │   ├── setupDatabase.ts        # Database initialization on app.locals.db
│   │   ├── setupEndpoints.ts       # Route registration (4 endpoints)
│   │   ├── setupErrorHandler.ts    # Global error handler mount
│   │   └── setupPrewarm.ts         # Caddy certificate pre-warming interceptor
│   ├── server/
│   │   ├── app.ts                  # Express app instance (TProxyApp)
│   │   ├── router.ts              # Async router (wraps handlers with express-async-handler)
│   │   └── server.ts              # HTTP/HTTPS server creation with SSL cert loading
│   ├── services/
│   │   └── auth.ts                 # Auth class — JWKS client, token extraction, JWT verification
│   ├── types/
│   │   ├── proxy.types.ts          # TProxyApp = TApp<TProxyConfig>
│   │   ├── auth.types.ts           # EJWTError, TTokenPayload, TAuthUser, TJWTPayload, TJWTValidationResult
│   │   ├── config.types.ts         # TServerConfig, TBackendConfig, TLoggerConfig, TJWKSConfig, TDomainsConfig, TProxyConfig
│   │   └── express.types.ts        # Global Express Request.user extension
│   ├── utils/
│   │   ├── logger.ts               # Winston logger factory via buildApiLogger()
│   │   ├── signals.ts              # Graceful shutdown on SIGINT/SIGTERM/SIGQUIT
│   │   └── errors/
│   │       ├── errorHandler.ts     # Express error middleware — returns status/message/errorCode
│   │       └── exception.ts        # Custom Exception class with status code
│   ├── proxy.ts                     # Main orchestrator — wires all middleware in order
│   └── start.ts                     # Entry point — calls proxy(config) via ife()
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
| `src/middleware/setupSessionAuth.ts` | Session token validation middleware -- ONLY applies to session routes (`/ai/ws`), requires `Authorization: Session <token>` |
| `src/middleware/setupProxy.ts` | http-proxy-middleware -- forwards `/_/*`, `/ai/*`, and `/proxy/*` routes to backend with auth headers |
| `src/constants/values.ts` | ProcessSignals, PublicRoutes, SessionRoutes, QueryTokenRoutes, DeferredAuthRoutes, ProxyForwardRoutes, BearerPrefix, LoggerIgnore, SandboxHostRx |
| `configs/proxy.config.ts` | Main config -- Server, Backend, Logger, JWKS, Domains |

## Constants (`src/constants/values.ts`)

```typescript
export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]
export const PublicRoutes = [`/health`, `/domains/validate`, `/echo`]
export const BearerPrefix = `Bearer `
export const SessionRoutes = [`/ai/ws`]
export const QueryTokenRoutes = [`/ai/ws`]
export const DeferredAuthRoutes = [`/proxy`]  // Auth deferred to backend (endpoint-level public flag)
export const ProxyForwardRoutes = [`/ai`, `/proxy`]
export const LoggerIgnore = { methods: [`OPTIONS`], routes: [] }
export const SandboxHostRx = /^\d+--sb-/  // Detects sandbox subdomain requests
```

## Endpoints

| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| GET | `/health` | Public | `health.ts` | Returns `{ status: "ok", service: "auth-proxy", timestamp }` |
| GET | `/auth/me` | Protected (JWT/API key) | `auth/me.ts` | Returns decoded JWT user from `req.user` |
| POST | `/auth/logout` | Protected (JWT/API key) | `auth/logout.ts` | Logout acknowledgment (client-side auth) |
| GET | `/domains/validate` | Public | `domains/validate.ts` | Caddy on_demand_tls domain validation via DB |
| `/_/*` | (proxied) | Protected (JWT/API key) | `setupProxy.ts` | All admin routes forwarded to backend |
| `/ai/*` | (proxied) | Session token (`/ai/ws`)or JWT/API key (other `/ai/*`) | `setupProxy.ts` | AI routes forwarded to backend |
| `/proxy/*` | (proxied) | Deferred (JWT/API key optional, backend decides) | `setupProxy.ts` | Proxy engine routes forwarded to backend |

## Middleware Chain Order

Defined in `src/proxy.ts`:

```
1. setupLogger         → Request/response logging (skips OPTIONS)
2. setupServer         → CORS, urlencoded, router mount
3. setupDatabase       → Initialize DB singleton on app.locals.db
4. setupAuth           → JWT validation via JWKS (skips PublicRoutes + SessionRoutes)
5. setupApiKeyAuth     → API key validation for tdsk_* tokens (skips PublicRoutes + SessionRoutes)
6. setupSessionAuth    → Session token validation (ONLY SessionRoutes: /ai/ws)
7. setupPrewarm        → Caddy cert pre-warming (returns 200 if prewarm header present)
8. setupEndpoints      → Register /health, /auth/me, /auth/logout, /domains/validate
9. setupProxy          → http-proxy-middleware for /_/*, /ai/*, /proxy/* → backend
10. setupErrorHandler  → Global error handler
```

### Auth Flow Decision Tree

The triple-auth system works as follows:

1. **Public Routes** (`/health`, `/domains/validate`, `/echo`) — Skip all auth
2. **Session Routes** (`/ai/ws`) — Skip JWT + API key — Require Session token
3. **Deferred Auth Routes** (`/proxy/*`) — JWT/API key attempted but not enforced; backend decides per-endpoint based on `public` flag
4. **All Other Routes** (`/_/*`, `/auth/me`, `/auth/logout`, other `/ai/*`) — JWT or API key required

**Deferred Auth**: For proxy routes, the proxy attempts JWT/API key validation but passes the request through even without valid credentials. The backend's proxy engine then checks if the target endpoint has `public: true` — if so, the request proceeds without auth. This allows public API endpoints to be served without requiring authentication at the proxy level.

**Auth Middleware Execution**:
- `setupAuth` — Runs for all routes EXCEPT public + session routes. For deferred auth routes, sets `req.user` if valid JWT but does NOT reject on failure
- `setupApiKeyAuth` — Runs for all routes EXCEPT public + session routes. For deferred auth routes, sets `req.user` if valid API key but does NOT reject on failure
- `setupSessionAuth` — Runs ONLY for session routes (`/ai/ws`)

**Result**: Each route gets exactly ONE auth mechanism applied, never multiple.

## Auth Service (`src/services/auth.ts`)

The `Auth` class manages JWKS-based JWT verification and route classification:

```typescript
class Auth {
  constructor(opts: { url: string })       // Initializes JWKS client via jose.createRemoteJWKSet()
  initialized(): boolean                   // Returns true if JWKS client is ready
  isPublic(path: string): boolean          // Checks path against PublicRoutes (/health, /domains/validate, /echo)
  isDeferred(path: string): boolean         // Checks path against DeferredAuthRoutes (/proxy)
  isSession(path: string): boolean         // Checks path against SessionRoutes (/ai/ws)
  extract(req: Request): string|null       // Extracts token from Authorization header (Bearer or Session prefix)
  verify(token: string): Promise<TJWTValidationResult>  // Verifies JWT via JWKS
}
```

**Token extraction** (`extract`) handles tokens from:
- `Authorization: Bearer <token>` -- returns token (JWT, API key, or session token)
- `?token=<token>` query param -- returns token (session token for WebSocket)

Error handling in `verify()` maps jose errors to structured results:
- `JWTExpired` -- `{ valid: false, expired: true, error: "Token expired" }`
- `JWTClaimValidationFailed` -- `{ valid: false, error: "Token claim validation failed: ..." }`
- `JWSSignatureVerificationFailed` -- `{ valid: false, error: "Invalid token signature" }`

## Session Auth Middleware (`src/middleware/setupSessionAuth.ts`)

**Behavior**:
- **Only runs on session routes** (`/ai/ws`)-- all other routes skip this middleware
- Extracts token via `app.locals.auth.extract(req)` (handles Bearer header and query param)
- **Does NOT validate the token itself** -- backend validates it
- Returns 401 if missing or malformed

**Token Format**: `?token=<token>` query param or `Authorization: Bearer <token>` header

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

## Request Flow Examples

1. **Admin API Request** (`GET /_/orgs`):
   - setupAuth -- JWT validated -- `req.user` set -- setupApiKeyAuth skipped (req.user exists) -- setupSessionAuth skipped (not session route) -- proxied to backend

2. **API Key Request** (`GET /_/orgs` with `Authorization: Bearer tdsk_abc123`):
   - setupAuth -- Token starts with `tdsk_`, calls next() -- setupApiKeyAuth -- API key validated -- `req.user` set -- setupSessionAuth skipped -- proxied to backend

3. **AI WebSocket** (`WS /ai/ws` with `?token=<token>`):
   - setupAuth -- Skipped (session route) -- setupApiKeyAuth -- Skipped (session route) -- setupSessionAuth -- Session token present -- upgraded to WebSocket

4. **Public Request** (`GET /health`):
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
- `hashKey` -- Hashes API keys for database lookup
- `ApiKeyPrefix` -- The `tdsk_` prefix constant for API key detection
- `TApp` -- Generic Express app type

### With Database (`@tdsk/database`)
- `database()` -- Initialized once during startup in `setupDatabase()`, stored on `app.locals.db`
- Used by `/domains/validate` endpoint via `req.app.locals.db`
- Used by `setupApiKeyAuth` middleware to look up API keys via `db.services.apiKey.getByHash()`

### With Admin (`@tdsk/admin`)
- Admin SPA authenticates with Neon Auth, sends JWT to proxy
- Proxy validates JWT, forwards to backend with auth headers
- CORS configured to allow admin origin

## Testing (110 tests, 13 files)

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
| `src/middleware/setupSessionAuth.test.ts` | 9 | Session auth: /ai/ws validation, missing token 401, non-session-route passthrough |
| `src/middleware/setupProxy.test.ts` | 20 | Proxy: path normalization, middleware creation, headers, /_/* and /ai/* and /proxy/* routes |
| `src/middleware/setupLogger.test.ts` | 4 | Request logger: OPTIONS skip, logging, UUID requestId |
| `src/utils/logger.test.ts` | 11 | Logger creation, API methods, config integration |
| `src/utils/errors/errorHandler.test.ts` | 5 | Error handler: Exception/Error handling, logging, status codes |

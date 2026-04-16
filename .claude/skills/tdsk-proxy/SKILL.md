---
name: "tdsk-proxy"
description: "Knowledge base for the Auth Gateway proxy repo"
tags: ["express", "jwt", "jwks", "proxy", "auth", "gateway", "typescript", "jose", "session", "sandbox"]
---
# Proxy Repo Skill

## Overview

The **proxy** repo (`@tdsk/proxy`) serves as the **Auth Gateway** and single entry point for all external traffic in the Threaded Stack platform. It is responsible for:

- **JWT Validation**: JWKS-based token verification via jose library (integrates with Neon Auth)
- **API Key Authentication**: Bearer token validation for `tdsk_*` API keys with fire-and-forget `touchLastUsed()` and optional `orgId`/`projectId` attachment from the API key record
- **Session Token Validation**: `Authorization: Bearer <token>` or `?token=<token>` query param fallback for WebSocket session routes (`/ai/ws`)
- **Dual-Proxy Forwarding**: Two `http-proxy-middleware` instances -- one for sandbox subdomains (preserves Host header) and one for standard backend routes (`/_/*`, `/ai/*`, `/proxy/*`)
- **WebSocket Upgrade Dispatch**: Manual `onUpgrade` handler routes WebSocket upgrades to the correct proxy (sandbox vs. backend). Both proxies use `ws: false` to avoid listener conflicts
- **Certificate Pre-warming**: Caddy on_demand_tls integration for domain validation
- **Echo Endpoint**: Public `GET/POST /echo` endpoint for dev/test that echoes request details
- **Request Logging**: Structured request/response logging with timing via Winston
- **Signal Handling**: Graceful shutdown on SIGINT, SIGTERM, SIGQUIT

**Authentication Model**: Triple-auth system:
1. **JWT Auth** (Neon Auth via JWKS) -- validates JWT tokens for most routes
2. **API Key Auth** -- validates `tdsk_*` Bearer tokens for programmatic access
3. **Session Token Auth** -- validates token from `Authorization: Bearer <token>` header or `?token=<token>` query param for session routes only (`/ai/ws`)

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
│   │   └── values.ts               # ProcessSignals, PublicRoutes, SessionRoutes, QueryTokenRoutes, DeferredAuthRoutes, ProxyForwardRoutes, LoggerIgnore, SandboxHostRx
│   ├── endpoints/
│   │   ├── health.ts               # GET /health — service health check
│   │   ├── echo.ts                 # GET|POST /echo — dev/test echo endpoint (public, echoes request details)
│   │   ├── echo.test.ts            # Echo endpoint tests (5 tests)
│   │   ├── auth/
│   │   │   ├── me.ts               # GET /auth/me — returns JWT user info
│   │   │   └── logout.ts           # POST /auth/logout — logout acknowledgment
│   │   └── domains/
│   │       └── validate.ts         # GET /domains/validate — Caddy domain validation
│   ├── middleware/
│   │   ├── setupServer.ts          # CORS, x-powered-by, urlencoded, router mount
│   │   ├── setupAuth.ts            # JWT validation via JWKS, attaches req.user (skips session routes)
│   │   ├── setupApiKeyAuth.ts      # API key auth for tdsk_* tokens (skips session routes), fire-and-forget touchLastUsed()
│   │   ├── setupSessionAuth.ts     # Session token auth for /ai/ws (Bearer header or ?token= query param)
│   │   ├── setupProxy.ts           # Dual-proxy system — sandbox forwarder + backend forwarder + WebSocket upgrade dispatch
│   │   ├── setupLogger.ts          # Request/response logging with timing
│   │   ├── setupDatabase.ts        # Database initialization on app.locals.db
│   │   ├── setupEndpoints.ts       # Route registration (5 endpoints: health, me, logout, validate, echo)
│   │   ├── setupErrorHandler.ts    # Global error handler mount
│   │   └── setupPrewarm.ts         # Caddy certificate pre-warming interceptor
│   ├── server/
│   │   ├── app.ts                  # Express app instance (TProxyApp)
│   │   ├── router.ts              # Async router (wraps handlers with express-async-handler)
│   │   └── server.ts              # HTTP/HTTPS server creation with SSL cert loading + onUpgrade registration
│   ├── services/
│   │   └── auth.ts                 # Auth class — JWKS client, token extraction (Bearer + query param), JWT verification, route classification
│   ├── types/
│   │   ├── proxy.types.ts          # TProxyApp = TApp<TProxyConfig>
│   │   ├── auth.types.ts           # EJWTError, TTokenPayload, TAuthUser, TJWTPayload, TJWTValidationResult
│   │   ├── config.types.ts         # TServerConfig, TBackendConfig, TLoggerConfig, TJWKSConfig, TDomainsConfig, TProxyConfig
│   │   ├── envs.types.ts           # TLogLevel = `debug` | `info` | `warn` | `error`
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
| `src/services/auth.ts` | Auth class -- JWKS client init via jose, token extraction (Bearer header + `?token=` query param), JWT verification, route classification (isPublic, isSession, isDeferredAuth, usesQueryToken) |
| `src/middleware/setupAuth.ts` | JWT validation middleware -- skips public routes and session routes, verifies token, attaches `req.user` |
| `src/middleware/setupApiKeyAuth.ts` | API key validation middleware -- skips public routes and session routes, validates `tdsk_*` tokens, attaches `orgId`/`projectId` from key record, fire-and-forget `touchLastUsed()` |
| `src/middleware/setupSessionAuth.ts` | Session token validation middleware -- ONLY applies to session routes (`/ai/ws`), accepts `Authorization: Bearer <token>` or `?token=<token>` query param |
| `src/middleware/setupProxy.ts` | Dual-proxy system -- `createSandboxForwarder()` (changeOrigin:false, preserves Host) + `createBackendProxy()` (changeOrigin:true) + manual `onUpgrade` WebSocket dispatch |
| `src/endpoints/echo.ts` | Echo endpoint -- returns method, path, headers, body, query as JSON (public, dev/test) |
| `src/constants/values.ts` | ProcessSignals, PublicRoutes, SessionRoutes, QueryTokenRoutes, DeferredAuthRoutes, ProxyForwardRoutes, BearerPrefix, LoggerIgnore, SandboxHostRx |
| `src/types/envs.types.ts` | TLogLevel type for logger configuration |
| `configs/proxy.config.ts` | Main config -- Server, Backend, Logger, JWKS, Domains; supports K8s service discovery via `inKube()` |

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
export const SandboxHostRx = /^\d+--sb-/  // Detects sandbox subdomain requests (e.g. "3000--sb-xxxx.local.threadedstack.app")
```

## Endpoints

| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| GET | `/health` | Public | `health.ts` | Returns `{ status: "ok", service: "auth-proxy", timestamp }` |
| GET | `/auth/me` | Protected (JWT/API key) | `auth/me.ts` | Returns decoded JWT user from `req.user` |
| POST | `/auth/logout` | Protected (JWT/API key) | `auth/logout.ts` | Logout acknowledgment (client-side auth) |
| GET | `/domains/validate` | Public | `domains/validate.ts` | Caddy on_demand_tls domain validation via DB |
| ALL | `/echo` | Public | `echo.ts` | Echoes request details (method, path, headers, body, query) for dev/test |
| `/_/*` | (proxied) | Protected (JWT/API key) | `setupProxy.ts` | All admin routes forwarded to backend |
| `/ai/*` | (proxied) | Session token (`/ai/ws`) or JWT/API key (other `/ai/*`) | `setupProxy.ts` | AI routes forwarded to backend |
| `/proxy/*` | (proxied) | Deferred (JWT/API key optional, backend decides) | `setupProxy.ts` | Proxy engine routes forwarded to backend |
| `*` (sandbox subdomain) | (proxied) | Inherits from path | `setupProxy.ts` | Sandbox subdomain requests forwarded with Host header preserved |

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
8. setupEndpoints      → Register /health, /auth/me, /auth/logout, /domains/validate, /echo
9. setupProxy          → Dual-proxy: sandbox forwarder + backend forwarder + onUpgrade dispatch
10. setupErrorHandler  → Global error handler
```

After middleware setup, `initServer()` creates the HTTP/HTTPS server and registers `app.locals.onUpgrade` as the server's `upgrade` event listener.

### Auth Flow Decision Tree

The triple-auth system works as follows:

1. **Public Routes** (`/health`, `/domains/validate`, `/echo`) — Skip all auth
2. **Session Routes** (`/ai/ws`) — Skip JWT + API key — Require Session token (Bearer header or `?token=` query param)
3. **Deferred Auth Routes** (`/proxy/*`) — JWT/API key attempted but not enforced; backend decides per-endpoint based on `public` flag
4. **All Other Routes** (`/_/*`, `/auth/me`, `/auth/logout`, other `/ai/*`) — JWT or API key required

**Deferred Auth**: For proxy routes, the proxy attempts JWT/API key validation but passes the request through even without valid credentials. The backend's proxy engine then checks if the target endpoint has `public: true` — if so, the request proceeds without auth. This allows public API endpoints to be served without requiring authentication at the proxy level.

**Auth Middleware Execution**:
- `setupAuth` — Runs for all routes EXCEPT public + session routes. For deferred auth routes, sets `req.user` if valid JWT but does NOT reject on failure
- `setupApiKeyAuth` — Runs for all routes EXCEPT public + session routes. For deferred auth routes, sets `req.user` if valid API key but does NOT reject on failure. On success, attaches `orgId` and `projectId` from the API key record to `req.user`
- `setupSessionAuth` — Runs ONLY for session routes (`/ai/ws`). Accepts token from `Authorization: Bearer <token>` header or `?token=<token>` query param

**Result**: Each route gets exactly ONE auth mechanism applied, never multiple.

## Auth Service (`src/services/auth.ts`)

The `Auth` class manages JWKS-based JWT verification and route classification:

```typescript
class Auth {
  constructor(opts: { url: string })       // Initializes JWKS client via jose.createRemoteJWKSet()
  initialized(): boolean                   // Returns true if JWKS client is ready
  isPublic(path: string): boolean          // Checks path against PublicRoutes (/health, /domains/validate, /echo)
  isDeferredAuth(path: string): boolean    // Checks path against DeferredAuthRoutes (/proxy)
  isSession(path: string): boolean         // Checks path against SessionRoutes (/ai/ws)
  usesQueryToken(path: string): boolean    // Checks path against QueryTokenRoutes (/ai/ws)
  extract(req: Request): string|null       // Extracts token from Authorization header (Bearer prefix) or ?token= query param
  verify(token: string): Promise<TJWTValidationResult>  // Verifies JWT via JWKS
}
```

**Token extraction** (`extract`) handles tokens from:
- `Authorization: Bearer <token>` -- returns token (JWT, API key, or session token)
- `?token=<token>` query param -- fallback for routes in `QueryTokenRoutes` (WebSocket connections)

Error handling in `verify()` maps jose errors to structured results:
- `JWTExpired` -- `{ valid: false, expired: true, error: "Token expired" }`
- `JWTClaimValidationFailed` -- `{ valid: false, error: "Token claim validation failed: ..." }`
- `JWSSignatureVerificationFailed` -- `{ valid: false, error: "Invalid token signature" }`

## Session Auth Middleware (`src/middleware/setupSessionAuth.ts`)

**Behavior**:
- **Only runs on session routes** (`/ai/ws`) -- all other routes skip this middleware
- Extracts token via `app.locals.auth.extract(req)` (handles Bearer header and `?token=` query param)
- **Does NOT validate the token itself** -- backend validates it
- Returns 401 if missing or malformed

**Token Format**: `Authorization: Bearer <token>` header or `?token=<token>` query param

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
7. Set `req.user` with key's userId, scope-derived role, optional `orgId`, optional `projectId`, and `apiKeyId`
8. Fire-and-forget `touchLastUsed()` update (non-blocking `.catch()` for error logging)

**Scope-to-role mapping**:
- `admin` scope -- `admin` role
- `write` scope -- `member` role
- All else -- `viewer` role

**req.user shape** (from API key):
```typescript
req.user = {
  email: ``,
  userId: apiKey.userId,
  role: scopeToRole(apiKey.scopes),
  orgId: apiKey.orgId,        // optional, from API key record
  projectId: apiKey.projectId, // optional, from API key record
  apiKeyId: apiKey.id,
}
```

## Proxy Forwarding (`src/middleware/setupProxy.ts`)

Uses a **dual-proxy architecture** with two `http-proxy-middleware` instances:

### 1. Sandbox Forwarder (`createSandboxForwarder`)

Intercepts requests whose hostname matches the `SandboxHostRx` regex (`/^\d+--sb-/`). This detects sandbox subdomain patterns like `3000--sb-xxxx.local.threadedstack.app`.

- **changeOrigin: false** -- preserves the original Host header so the backend's sandboxProxy middleware can parse the subdomain and route to the correct pod
- **ws: false** -- WebSocket upgrades handled manually via `onUpgrade`
- Mounted first via `app.use(sandboxProxy)` so it intercepts before path-based routing
- Non-sandbox requests pass through to `next()`

### 2. Backend Proxy (`createBackendProxy`)

Standard proxy for admin, AI, and proxy routes:

- **Path filter**: `/_/*` (via `adminPath`), `/ai/*`, `/proxy/*` (via `ProxyForwardRoutes`)
- **changeOrigin: true** -- rewrites Host to backend's internal hostname
- **ws: false** -- WebSocket upgrades handled manually via `onUpgrade`
- **Custom headers**: Sets `headerKey`/`headerValue` from config (shared secret)
- **Auth headers**: Calls `setAuthHeaders(proxyReq, req)` from `@tdsk/domain` to inject `X-User-Id`, `X-User-Role`, `X-User-Email`
- **Path rewrite**: Preserves `req.originalUrl` (backend expects the original URL)
- **xfwd: true** -- adds X-Forwarded-* headers
- **Error handling**: Returns 502 with "Backend service unavailable" on proxy errors

### 3. WebSocket Upgrade Dispatch

A single `onUpgrade` handler is registered on `app.locals.onUpgrade` and later attached to the HTTP server in `initServer()`. It routes WebSocket upgrade requests to the correct proxy based on hostname:

```typescript
const onUpgrade = (req, socket, head) => {
  const host = req.headers.host?.split(`:`)[0] || ``
  if (isSandboxHost(host)) sandboxProxy.upgrade?.(req, socket, head)
  else backendProxy.upgrade?.(req, socket, head)
}
```

Both proxies use `ws: false` to avoid auto-registering global upgrade listeners, which would conflict when there are multiple proxy instances. The manual dispatch pattern ensures exactly one upgrade listener per server.

## Request Flow Examples

1. **Admin API Request** (`GET /_/orgs`):
   - setupAuth -- JWT validated -- `req.user` set -- setupApiKeyAuth skipped (req.user exists) -- setupSessionAuth skipped (not session route) -- sandbox forwarder skipped (not sandbox host) -- backend proxy matches `/_` path -- proxied to backend

2. **API Key Request** (`GET /_/orgs` with `Authorization: Bearer tdsk_abc123`):
   - setupAuth -- Token starts with `tdsk_`, calls next() -- setupApiKeyAuth -- API key validated -- `req.user` set (with orgId/projectId from key) -- touchLastUsed() fired async -- setupSessionAuth skipped -- proxied to backend

3. **AI WebSocket** (`WS /ai/ws` with `?token=<token>`):
   - setupAuth -- Skipped (session route) -- setupApiKeyAuth -- Skipped (session route) -- setupSessionAuth -- Token extracted from query param -- onUpgrade dispatches to backend proxy

4. **Public Request** (`GET /health`):
   - All auth middleware skipped -- setupEndpoints matches -- returns 200

5. **Echo Request** (`POST /echo`):
   - All auth middleware skipped (public route) -- setupEndpoints matches -- returns 200 with request echo

6. **Sandbox Subdomain Request** (`GET /` on `3000--sb-xxxx.local.threadedstack.app`):
   - Auth middleware runs normally -- sandbox forwarder detects sandbox host -- proxied to backend with original Host header preserved (changeOrigin: false)

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

**Backend URL resolution** (via `backendUrl()` helper):
1. If `inKube()` and `TDSK_BE_DEPLOYMENT` set -- uses `http://<deployment>` (K8s service discovery)
2. Else if `TDSK_BE_URL` set -- uses it directly via `new URL()`
3. Else if `TDSK_BE_HOST` set -- builds URL from host (prepends `http://` if needed)
4. Appends `TDSK_BE_PORT` if set
5. Throws if no host/URL is available

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TDSK_PX_PORT` | number | `7118` | Server port |
| `TDSK_PX_ENABLE_SSL` | boolean | `false` | Enable HTTPS (non-production only) |
| `TDSK_PX_SSL_CA` | string | - | SSL CA certificate file path |
| `TDSK_PX_SSL_KEY` | string | - | SSL key file path |
| `TDSK_PX_SSL_CERT` | string | - | SSL cert file path |
| `TDSK_PX_ALLOW_ORIGIN` | string | `http://localhost:5887` | Comma-separated CORS origins |
| `TDSK_PX_LOG_LEVEL` | TLogLevel | `info` | Logger verbosity (`debug` \| `info` \| `warn` \| `error`) |
| `TDSK_PX_LOGGER_PRETTY` | boolean | `false` | Pretty-printed logs (dev) |
| `TDSK_PX_LOGGER_SILENT` | boolean | `false` | Disable all logging |
| `TDSK_BE_URL` | string | - | Backend URL (direct, used outside K8s) |
| `TDSK_BE_HOST` | string | - | Backend host (fallback when TDSK_BE_URL not set) |
| `TDSK_BE_PORT` | string | - | Backend port (appended to host/deployment URL) |
| `TDSK_BE_DEPLOYMENT` | string | - | K8s deployment name (used with `inKube()` for service discovery) |
| `TDSK_BE_HEADER_KEY` | string | - | Custom header key for proxy-to-backend |
| `TDSK_BE_HEADER_VALUE` | string | - | Custom header value for proxy-to-backend |
| `TDSK_BE_API_ADMIN_PATH` | string | `_` | Admin API path prefix |
| `TDSK_AUTH_JWKS` | string | `` | JWKS URL for JWT validation (Neon Auth) |
| `TDSK_CADDY_PREWARM_HEADER` | string | - | Header name for Caddy cert pre-warming |

## Integration Points

### With Backend (`@tdsk/backend`)
- **Request Forwarding**: Dual-proxy forwards requests to backend -- sandbox forwarder (Host preserved) and backend proxy (`/_/*`, `/ai/*`, `/proxy/*`)
- **Auth Headers**: `setAuthHeaders()` injects `X-User-Id`, `X-User-Role`, `X-User-Email`
- **Backend Secret**: `headerKey`/`headerValue` config provides proxy-to-backend identity verification
- **WebSocket**: Manual `onUpgrade` dispatch routes upgrades to correct proxy (sandbox vs. backend)
- **Session Tokens**: Session routes validated by proxy (presence check), but token itself is validated by backend
- **Sandbox Routing**: Sandbox subdomain requests (`SandboxHostRx`) forwarded with original Host header so backend's sandboxProxy middleware can parse subdomain and route to correct pod

### With Domain (`@tdsk/domain`)
- `setAuthHeaders` -- Sets auth headers on proxied requests
- `adminPath` -- Returns `/_` path prefix for backend routing
- `hashKey` -- Hashes API keys for database lookup
- `ApiKeyPrefix` -- The `tdsk_` prefix constant for API key detection
- `TApp` -- Generic Express app type
- `loadEnvs` -- Loads environment variables from config files
- `inKube` -- Detects Kubernetes environment for service discovery

### With Database (`@tdsk/database`)
- `database()` -- Initialized once during startup in `setupDatabase()`, stored on `app.locals.db`
- Used by `/domains/validate` endpoint via `req.app.locals.db`
- Used by `setupApiKeyAuth` middleware to look up API keys via `db.services.apiKey.getByHash()` and update last-used via `db.services.apiKey.touchLastUsed()`

### With Admin (`@tdsk/admin`)
- Admin SPA authenticates with Neon Auth, sends JWT to proxy
- Proxy validates JWT, forwards to backend with auth headers
- CORS configured to allow admin origin

## Testing (154 tests, 14 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `configs/proxy.config.test.ts` | 7 | Config shape, types, defaults, JWKS URL format, backend URL resolution |
| `src/endpoints/health.test.ts` | 1 | Health endpoint returns 200 with correct shape |
| `src/endpoints/echo.test.ts` | 5 | Echo endpoint: returns request details, reflects HTTP method, echoes query params, echoes headers, handles empty body |
| `src/endpoints/auth/me.test.ts` | 2 | /auth/me happy path and 401 when no user |
| `src/endpoints/auth/logout.test.ts` | 1 | /auth/logout success response |
| `src/endpoints/domains/validate.test.ts` | 4 | Domain validation: 400/403/200/500 cases |
| `src/services/auth.test.ts` | 25 | Auth class: constructor, isPublic, isSession, isDeferredAuth, usesQueryToken, extract (Bearer + query param), verify (all branches) |
| `src/middleware/setupAuth.test.ts` | 21 | Auth middleware: public routes, 401/500 cases, req.user attachment, session route skip, deferred auth passthrough |
| `src/middleware/setupApiKeyAuth.test.ts` | 24 | API key auth: validation, scope-to-role mapping, session route skip, deferred auth passthrough, expiry, revocation, orgId/projectId attachment, touchLastUsed |
| `src/middleware/setupSessionAuth.test.ts` | 13 | Session auth: /ai/ws validation, missing token 401, non-session-route passthrough, query param token extraction |
| `src/middleware/setupProxy.test.ts` | 26 | Proxy: path normalization, dual-proxy creation, sandbox host detection, headers, WebSocket upgrade dispatch, /_/* and /ai/* and /proxy/* routes |
| `src/middleware/setupLogger.test.ts` | 8 | Request logger: OPTIONS skip, logging, UUID requestId |
| `src/utils/logger.test.ts` | 11 | Logger creation, API methods, config integration |
| `src/utils/errors/errorHandler.test.ts` | 6 | Error handler: Exception/Error handling, logging, status codes |

---
name: "Threaded Stack - Proxy Repo"
description: "Knowledge base for the Auth Gateway proxy repo"
version: "2.2.0"
tags: ["express", "jwt", "jwks", "proxy", "auth", "gateway", "typescript", "jose", "session"]
---
# Proxy Repo Skill

## Overview

The **proxy** repo (`@tdsk/proxy`) serves as the **Auth Gateway** and single entry point for all external traffic in the Threaded Stack platform. It is responsible for:

- **JWT Validation**: JWKS-based token verification via jose library (integrates with Neon Auth)
- **Request Proxying**: Forwarding authenticated requests to the backend API via http-proxy-middleware
- **Certificate Pre-warming**: Caddy on_demand_tls integration for domain validation
- **Request Logging**: Structured request/response logging with timing via Winston
- **Signal Handling**: Graceful shutdown on SIGINT, SIGTERM, SIGQUIT

**Current Status**: Fully implemented (~960 lines across 38 source files). All middleware, endpoints, and services are functional.

**Authentication Model**: Client-side via Neon Auth. The proxy only *validates* JWT tokens using JWKS — it does not handle login/register/refresh. Those are managed by the Admin SPA directly with Neon Auth.

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
│   │   ├── values.ts               # ProcessSignals, PublicRoutes, LoggerIgnore
│   │   └── index.ts
│   ├── endpoints/                   # Route handlers
│   │   ├── health.ts               # GET /health — service health check
│   │   ├── health.test.ts          # Health endpoint test (1 test)
│   │   ├── auth/
│   │   │   ├── me.ts               # GET /auth/me — returns JWT user info
│   │   │   ├── logout.ts           # POST /auth/logout — logout acknowledgment
│   │   │   └── index.ts
│   │   ├── domains/
│   │   │   ├── validate.ts         # GET /domains/validate — Caddy domain validation
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── middleware/                   # Express middleware chain
│   │   ├── setupServer.ts          # CORS, x-powered-by, urlencoded, router mount
│   │   ├── setupAuth.ts            # JWT validation via JWKS, attaches req.user (skips /ai/chat)
│   │   ├── setupApiKeyAuth.ts      # API key auth for tdsk_* tokens (skips /ai/chat)
│   │   ├── setupSessionAuth.ts     # Session-token auth for /ai/chat (7 tests)
│   │   ├── setupProxy.ts           # http-proxy-middleware → backend forwarding (/_/* + /ai/*)
│   │   ├── setupLogger.ts          # Request/response logging with timing
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
│   │   ├── logger.test.ts          # Logger tests (11 tests — creation, API, config)
│   │   ├── signals.ts              # Graceful shutdown on SIGINT/SIGTERM/SIGQUIT
│   │   ├── errors/
│   │   │   ├── errorHandler.ts     # Express error middleware — returns status/message/errorCode
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
| `src/proxy.ts` | Main orchestrator — sets config on app.locals, calls setup functions in order |
| `src/start.ts` | Entry point — loads config and calls `proxy(config)` |
| `src/services/auth.ts` | Auth class — JWKS client init via jose, token extraction, JWT verification |
| `src/middleware/setupAuth.ts` | JWT validation middleware — skips public routes, verifies token, attaches `req.user` |
| `src/middleware/setupProxy.ts` | http-proxy-middleware — forwards `/_/*` routes to backend with auth headers |
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
| `src/constants/values.ts` | ProcessSignals, PublicRoutes, LoggerIgnore |
| `configs/proxy.config.ts` | Main config — Server, Backend, Logger, JWKS, Domains |

## Endpoints

| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| GET | `/health` | Public | `health.ts` | Returns `{ status: "ok", service: "auth-proxy", timestamp }` |
| GET | `/auth/me` | Protected | `auth/me.ts` | Returns decoded JWT user from `req.user` |
| POST | `/auth/logout` | Protected | `auth/logout.ts` | Logout acknowledgment (client-side auth) |
| GET | `/domains/validate` | Public | `domains/validate.ts` | Caddy on_demand_tls domain validation via DB |
| `/_/*` | (proxied) | Protected | `setupProxy.ts` | All admin routes forwarded to backend |

## Middleware Chain Order

Defined in `src/proxy.ts`:

```
1. setupLogger      → Request/response logging (skips OPTIONS)
2. setupServer      → CORS, urlencoded, router mount
3. setupDatabase    → Initialize DB singleton on app.locals.db
4. setupAuth        → JWT validation via JWKS (skips PublicRoutes)
5. setupPrewarm     → Caddy cert pre-warming (returns 200 if prewarm header present)
6. setupEndpoints   → Register /health, /auth/me, /auth/logout, /domains/validate
7. setupProxy       → http-proxy-middleware for /_/* → backend
8. setupErrorHandler → Global error handler
```

## Auth Service (`src/services/auth.ts`)

The `Auth` class manages JWKS-based JWT verification:

```typescript
class Auth {
  constructor(opts: { url: string })  // Initializes JWKS client via jose.createRemoteJWKSet()
  initialized(): boolean              // Returns true if JWKS client is ready
  isPublic(path: string): boolean     // Checks path against PublicRoutes
  extract(req: Request): string|null  // Extracts Bearer token from Authorization header
  verify(token: string): Promise<TJWTValidationResult>  // Verifies JWT via JWKS
}
```

Error handling in `verify()` maps jose errors to structured results:
- `JWTExpired` → `{ valid: false, expired: true, error: "Token expired" }`
- `JWTClaimValidationFailed` → `{ valid: false, error: "Token claim validation failed: ..." }`
- `JWSSignatureVerificationFailed` → `{ valid: false, error: "Invalid token signature" }`

## Proxy Forwarding (`src/middleware/setupProxy.ts`)

Uses `http-proxy-middleware` to forward requests to the backend:

- **Target**: Backend URL from config (supports Kubernetes service discovery)
- **Path Rewrite**: Preserves `req.originalUrl` (backend expects the original URL)
- **Custom Headers**: Sets `headerKey`/`headerValue` from config (shared secret)
- **Auth Headers**: Calls `setAuthHeaders(proxyReq, req)` from `@tdsk/domain` to inject `X-User-Id`, `X-User-Role`, `X-User-Email`
- **WebSocket**: Enabled (`ws: true`)
- **Error Handling**: Returns 502 with "Backend service unavailable" on proxy errors

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
3. **Auth Service Pattern**: Singleton Auth class on `app.locals.auth` for JWKS validation
4. **Path Alias Pattern**: `@TPX/*` for proxy paths, `@TDM/*` for domain, `@TDB/*` for database
5. **Config Pattern**: Typed config object loaded from environment variables via `deploy/values.*.yml`
6. **Signal Handling Pattern**: Graceful shutdown on SIGINT/SIGTERM/SIGQUIT with `server.close()`

### Request Flow

```
Client Request
  ↓
setupLogger     → Log request (method, path, requestId, IP, UA)
  ↓
setupServer     → CORS validation, URL-encoded body parsing
  ↓
setupDatabase   → Initialize DB singleton on app.locals.db
  ↓
setupAuth       → Check PublicRoutes → Skip /ai/chat → Extract Bearer token → Verify via JWKS → Attach req.user
  ↓
setupApiKeyAuth → Skip /ai/chat → Validate tdsk_* Bearer tokens → Attach req.user
  ↓
setupSessionAuth → Only /ai/chat paths → Require Authorization: Session <token> → 401 if missing
  ↓
setupPrewarm    → If prewarm header present, return 200 early
  ↓
setupEndpoints  → Match /health, /auth/me, /auth/logout, /domains/validate
  ↓
setupProxy      → Forward /_/* and /ai/* to backend with auth headers
  ↓
setupErrorHandler → Catch errors, return status/message/errorCode
  ↓
Response logged via setupLogger's res.on('finish') listener
```

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
| `TDSK_BE_HEADER_KEY` | string | - | Custom header key for proxy→backend |
| `TDSK_BE_HEADER_VALUE` | string | - | Custom header value for proxy→backend |
| `TDSK_BE_API_ADMIN_PATH` | string | `_` | Admin API path prefix |
| `TDSK_AUTH_JWKS` | string | `` | JWKS URL for JWT validation (Neon Auth) |
| `TDSK_CADDY_PREWARM_HEADER` | string | - | Header name for Caddy cert pre-warming |
| `TDSK_WITH_LB_PROXY` | boolean | - | Skip CORS when behind load balancer |

## Integration Points

### With Backend (`@tdsk/backend`)
- **Request Forwarding**: Proxy forwards all `/_/*` routes to backend via http-proxy-middleware
- **Auth Headers**: `setAuthHeaders()` injects `X-User-Id`, `X-User-Role`, `X-User-Email`
- **Backend Secret**: `headerKey`/`headerValue` config provides proxy→backend identity verification
- **WebSocket**: Proxy forwards WebSocket connections (`ws: true`)

### With Domain (`@tdsk/domain`)
- `setAuthHeaders` — Sets auth headers on proxied requests
- `adminPath` — Returns `/_` path prefix for backend routing
- `behindLBProxy` — Checks if behind load balancer (skip CORS)
- `loadEnvs` / `inKube` — Environment loading and Kubernetes detection
- `TApp` — Generic Express app type
- `TSSLCreds` — SSL certificate file paths type

### With Database (`@tdsk/database`)
- `database()` — Initialized once during startup in `setupDatabase()`, stored on `app.locals.db`
- Used by `/domains/validate` endpoint via `req.app.locals.db`

### With Logger (`@tdsk/logger`)
- `buildApiLogger()` — Creates Winston logger with label and level

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
pnpm test               # Run tests (vitest run) — 105 tests, 13 files
pnpm test:watch         # Watch mode tests
```

### Commands Notes
* Linting and formatting run automatically via Biome — `pnpm lint` and `pnpm format` should be ignored.
* `pnpm start` watches `../domain/src`, `../logger/src`, and `../database/src` for cross-repo changes.

## Testing

### Current Coverage (105 tests, 13 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `configs/proxy.config.test.ts` | 7 | Config shape, types, defaults, JWKS URL format |
| `src/endpoints/health.test.ts` | 1 | Health endpoint returns 200 with correct shape |
| `src/endpoints/auth/me.test.ts` | 2 | /auth/me happy path and 401 when no user |
| `src/endpoints/auth/logout.test.ts` | 1 | /auth/logout success response |
| `src/endpoints/domains/validate.test.ts` | 4 | Domain validation: 400/403/200/500 cases |
| `src/services/auth.test.ts` | 15 | Auth class: constructor, isPublic, extract, verify (all branches) |
| `src/middleware/setupAuth.test.ts` | 12 | Auth middleware: public routes, 401/500 cases, req.user attachment, /ai/chat skip |
| `src/middleware/setupApiKeyAuth.test.ts` | 16 | API key auth: validation, scope→role mapping, /ai/chat skip |
| `src/middleware/setupSessionAuth.test.ts` | 7 | Session auth: /ai/chat validation, missing token 401, non-/ai/chat passthrough |
| `src/middleware/setupProxy.test.ts` | 20 | Proxy: path normalization, middleware creation, headers, /ai route |
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
  "@TDM/*": ["../domain/src/*"],
  "@TDB/*": ["../database/src/*"],
  "@tdsk/domain": ["../domain/src"],
  "@tdsk/database": ["../database/src"],
  "@tdsk/logger": ["../logger/src"]
}
```

## Known Issues

See `repos/proxy/AUDIT.md` for full issue catalog. **All 14 issues fixed (2026-02-08)**:
- ~~Dead `adminPath` export in utils (C-1)~~ FIXED — removed
- ~~`express-rate-limit` installed but never configured (H-1)~~ FIXED — removed (Caddy handles rate limiting)
- ~~Error handler doesn't log errors (H-2)~~ FIXED — added logger.error()
- ~~Regex bug in pathFilter (M-1)~~ FIXED — corrected regex
- ~~`/domains/validate` not in PublicRoutes (M-2)~~ FIXED — added to PublicRoutes
- ~~Unused JWT config (M-3)~~ FIXED — removed entirely
- ~~Math.random() request IDs (M-4)~~ FIXED — uses crypto.randomUUID()
- ~~TProxyApp phantom generics (M-5)~~ FIXED — documented as accepted tradeoff
- ~~5 unused dependencies (L-1)~~ FIXED — all removed
- ~~Placeholder logger test (L-2)~~ FIXED — 11 real tests
- ~~me/logout unused _app param (L-3)~~ FIXED — converted to direct handlers
- ~~Error handler next() (L-4)~~ ACCEPTED — standard pattern

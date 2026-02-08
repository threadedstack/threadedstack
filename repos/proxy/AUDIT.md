# Proxy Repo Audit (`@tdsk/proxy`)

**Date**: 2026-02-08
**Auditor**: Claude Code (Opus 4.6)
**Repo**: `repos/proxy/` — Auth Gateway & Request Proxy

---

## Executive Summary

The proxy repo is a **fully implemented** auth gateway (~960 lines across 38 source files) that serves as the single entry point for all client traffic. It validates JWTs via JWKS (jose library), forwards authenticated requests to the backend via `http-proxy-middleware`, and exposes 4 endpoints (`/health`, `/auth/me`, `/auth/logout`, `/domains/validate`).

**Status**: Production-functional with notable gaps in body parsing, rate limiting, and test coverage.

### By the Numbers

| Metric | Value |
|--------|-------|
| Source files | 38 TypeScript files |
| Test files | 3 (10 tests, all passing) |
| Config files | 8 |
| Total issues | 19 (2 critical, 4 high, 7 medium, 6 low) |
| Unused dependencies | 5 |
| Estimated test coverage | ~7% |
| SKILL.md accuracy | ~20% (requires complete rewrite) |

---

## Architecture & Purpose

### Request Flow

```
Client Request
  ↓
setupLogger     → Request/response logging with timing
  ↓
setupServer     → CORS, urlencoded body parsing, router mount
  ↓
setupAuth       → JWT validation via JWKS (jose), attaches req.user
  ↓
setupPrewarm    → Caddy certificate pre-warming (X-Threaded-Stack-Prewarm)
  ↓
setupEndpoints  → /health, /auth/me, /auth/logout, /domains/validate
  ↓
setupProxy      → http-proxy-middleware → Backend (/_/* routes)
  ↓
setupErrorHandler → Global error handler
  ↓
Backend Server
```

### Key Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Express | 5.1.0 | Web framework |
| jose | 6.1.3 | JWKS-based JWT verification |
| http-proxy-middleware | 3.0.5 | Backend request proxying |
| Winston | via `@tdsk/logger` | Structured logging |
| tsup | 8.3.6 | Production bundling |

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | Public | Health check |
| GET | `/auth/me` | Protected | Return JWT user info |
| POST | `/auth/logout` | Protected | Logout acknowledgment |
| GET | `/domains/validate` | Protected* | Caddy on_demand_tls validation |
| `/_/*` | (proxied) | Protected | All admin routes forwarded to backend |

*`/domains/validate` is called by Caddy (no auth), but isn't in `PublicRoutes` — see M-2.

---

## File Inventory

### Source Files (`src/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 1 | Re-exports `start.ts` |
| `start.ts` | 5 | Entry point — calls `proxy(config)` via `ife()` |
| `proxy.ts` | 36 | Main orchestrator — wires all middleware in order |

#### Server (`src/server/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 3 | Barrel exports |
| `app.ts` | 8 | Creates Express app instance as `TProxyApp` |
| `router.ts` | 53 | Async router wrapping all HTTP methods with `express-async-handler` |
| `server.ts` | 82 | HTTP/HTTPS server creation with SSL cert loading |

#### Middleware (`src/middleware/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 6 | Barrel exports |
| `setupServer.ts` | 30 | CORS, `x-powered-by` disable, URL encoding, router mount |
| `setupAuth.ts` | 66 | JWT validation via JWKS — skips public routes, attaches `req.user` |
| `setupProxy.ts` | 77 | `http-proxy-middleware` — forwards `/_/*` to backend, sets auth headers |
| `setupLogger.ts` | 51 | Request/response logging with timing, request IDs |
| `setupEndpoints.ts` | 15 | Route registration for 4 endpoints |
| `setupErrorHandler.ts` | 9 | Mounts global error handler |
| `setupPrewarm.ts` | 30 | Caddy certificate pre-warming interceptor |

#### Endpoints (`src/endpoints/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 3 | Barrel exports |
| `health.ts` | 13 | `GET /health` — returns `{ status: "ok", service, timestamp }` |
| `health.test.ts` | 24 | 1 test — validates 200 response shape |
| `auth/index.ts` | 2 | Barrel exports |
| `auth/me.ts` | 42 | `GET /auth/me` — returns decoded JWT user from `req.user` |
| `auth/logout.ts` | 32 | `POST /auth/logout` — returns success message |
| `domains/index.ts` | 1 | Barrel exports |
| `domains/validate.ts` | 66 | `GET /domains/validate` — Caddy domain validation via DB lookup |

#### Services (`src/services/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 1 | Barrel exports |
| `auth.ts` | 107 | `Auth` class — JWKS client init, token extraction, JWT verification |

#### Types (`src/types/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 5 | Barrel exports |
| `proxy.types.ts` | 4 | `TProxyApp = TApp<TProxyConfig>` |
| `auth.types.ts` | 39 | `EJWTError`, `TTokenPayload`, `TAuthUser`, `TJWTPayload`, `TJWTValidationResult` |
| `config.types.ts` | 52 | `TJwtConfig`, `TServerConfig`, `TBackendConfig`, `TLoggerConfig`, `TJWKSConfig`, `TDomainsConfig`, `TProxyConfig` |
| `envs.types.ts` | 1 | `TLogLevel` union type |
| `express.types.ts` | 10 | Global Express `Request.user` extension |

#### Utils (`src/utils/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 3 | Barrel exports (includes dead `adminPath` re-export) |
| `logger.ts` | 4 | Winston logger factory via `buildApiLogger()` |
| `logger.test.ts` | 9 | 1 placeholder test (`expect(true).toBe(true)`) |
| `signals.ts` | 22 | Graceful shutdown on SIGINT/SIGTERM/SIGQUIT |
| `errors/index.ts` | 1 | Barrel exports |
| `errors/errorHandler.ts` | 21 | Express error middleware — returns status/message/errorCode |
| `errors/exception.ts` | 16 | Custom `Exception` class with status code |

#### Constants (`src/constants/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 1 | Barrel exports |
| `values.ts` | 12 | `ProcessSignals`, `PublicRoutes`, `LoggerIgnore` |

### Configuration Files (`configs/`)

| File | Lines | Purpose |
|------|-------|---------|
| `proxy.config.ts` | 96 | Main config — JWT, Server, Backend, Logger, JWKS, Domains |
| `proxy.config.test.ts` | 98 | 8 tests — validates config shape and types |
| `aliases.ts` | 2 | `alias-hq` path alias registration |
| `tsup.config.ts` | 39 | Production build (CJS bundle) |
| `tsdown.config.ts` | 40 | Alternative build with tsdown |
| `vitest.config.ts` | 25 | Vitest test runner config |
| `biome.json` | 123 | Biome linter/formatter rules |

### Other Files

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/loadEnvs.ts` | 69 | Environment variable loader from YAML |
| `scripts/addToProcess.ts` | 32 | Helper to inject envs into `process.env` |
| `package.json` | 60 | Dependencies, scripts |
| `tsconfig.json` | 64 | TypeScript config with path aliases |

---

## Issue Catalog

### Critical (2)

#### C-1: Missing `express.json()` middleware — JSON request bodies silently dropped

- **File**: `src/middleware/setupServer.ts:27`
- **Code**: Only `express.urlencoded({ extended: true })` is registered
- **Impact**: All POST/PUT/PATCH requests with JSON bodies arrive with `req.body === undefined`. Currently masked because `/auth/logout` doesn't read `req.body`, and `/domains/validate` uses query params. The validate endpoint does log `req.body` (line 30), which would always show `undefined`.
- **Fix**: Add `app.use(express.json())` before `app.use(router)`

#### C-2: Dead export — `src/utils/index.ts:3` exports nonexistent `./adminPath`

- **File**: `src/utils/index.ts:3` — `export * from './adminPath'`
- **Impact**: No file exists at `src/utils/adminPath.ts` (verified via glob). The proxy correctly imports `adminPath` from `@tdsk/domain` in `setupProxy.ts:7`. This dead re-export is confusing dead code and could cause build errors depending on bundler strictness (tsup currently silently ignores it).
- **Fix**: Remove line 3 from `src/utils/index.ts`

### High (4)

#### H-1: `express-rate-limit` installed but never configured

- **File**: `package.json:42` — dependency present, zero imports in `src/` (verified via grep)
- **Impact**: No rate limiting on any endpoint. Brute-force attacks on auth, DoS on the public `/health` and `/domains/validate` endpoints. The SKILL.md claimed rate limiting was "not yet integrated" — it was never integrated.
- **Fix**: Add rate limiting middleware, or remove dependency and document if rate limiting is handled externally (e.g., Caddy)

#### H-2: Domain validation creates new DB connection per request

- **File**: `src/endpoints/domains/validate.ts:53` — `const db = database()`
- **Impact**: Each request to `/domains/validate` creates a new database Pool. Under load this exhausts connection limits. The code has a TODO comment (lines 50-52) acknowledging this: "update this to be created on proxy app and added to app.locals"
- **Fix**: Initialize DB once during server startup, store in `app.locals.db`, pass via `app` parameter

#### H-3: 26 lines of `console.log` debug spam in production code

- **File**: `src/endpoints/domains/validate.ts:18-43`
- **Code**: Dumps `req.url`, `req.originalUrl`, `req.body`, `req.query`, `req.params`, `req.headers` to stdout on every request
- **Impact**: Leaks potentially sensitive info (headers include auth tokens). Pollutes logs. Uses `console.log` instead of the Winston logger.
- **Fix**: Remove all `console.log` blocks; use `logger.debug()` for necessary debugging

#### H-4: Error handler doesn't log errors before responding

- **File**: `src/utils/errors/errorHandler.ts:4-21`
- **Impact**: Errors caught by the global error handler are returned to the client but never logged server-side. Makes debugging production issues impossible. Compare: `handleProxyError` in `setupProxy.ts:33` correctly logs before responding.
- **Fix**: Add `logger.error()` call before `res.status().json()`

### Medium (7)

#### M-1: Regex bug in `pathFilter` — `/$\//` never matches

- **File**: `src/middleware/setupProxy.ts:42`
- **Code**: `loc.replace(/$\//, '')` — `$` anchors to end-of-string, so `/$\//` means "a `/` after end-of-string" which is impossible
- **Impact**: Trailing slashes on admin path are never stripped. Currently masked because default admin path is `_` (no trailing slash), but would break with custom paths like `admin/`.
- **Fix**: Change to `loc.replace(/\/$/, '')`

#### M-2: `/domains/validate` not in `PublicRoutes` list

- **File**: `src/constants/values.ts:7` — `PublicRoutes` only contains `["/health"]`
- **Impact**: Domain validation called by Caddy (no auth) goes through JWT validation middleware. Currently works because routes registered on the async router in `setupEndpoints` execute before the proxy catch-all `setupProxy`, and `setupAuth` runs as app-level middleware before the router — but the validate endpoint IS registered on the router which runs after auth. This means Caddy requests to `/domains/validate` without a JWT token will receive a 401. This endpoint may currently be broken for its intended use case.
- **Fix**: Add `/domains/validate` to `PublicRoutes` array

#### M-3: CORS allows wildcard `*` with `credentials: true`

- **File**: `src/middleware/setupServer.ts:21-24`
- **Code**:
  ```typescript
  cors({
    credentials: true,
    origin: origins.includes('*') ? '*' : origins,
  })
  ```
- **Impact**: If `TDSK_PX_ALLOW_ORIGIN` is `*`, CORS is configured with `origin: '*'` AND `credentials: true`. Browsers block this combination per CORS spec (`Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` is forbidden). Credentialed requests will fail silently.
- **Fix**: When `credentials: true`, validate origin against a whitelist instead of using `*`

#### M-4: JWT `secret` config has hardcoded default

- **File**: `configs/proxy.config.ts:59` — `secret: TDSK_PX_JWT_SECRET || 'tdsk-dev-secret-change-in-production'`
- **Impact**: The proxy validates via JWKS (asymmetric), not symmetric secrets. This `jwt.secret` field is never used anywhere in the codebase. It's a misleading config that could confuse developers into thinking JWTs are signed with this secret.
- **Fix**: Remove `jwt.secret` from config, or add a comment clarifying it's unused

#### M-5: Request ID uses `Math.random()` — not cryptographically unique

- **File**: `src/middleware/setupLogger.ts:18`
- **Code**: `` `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` ``
- **Impact**: Request IDs can collide under high concurrency. Not suitable for distributed tracing or audit trails.
- **Fix**: Use `crypto.randomUUID()`

#### M-6: `TProxyApp` inherits phantom DB/Payments/Email generics from `TApp`

- **File**: `src/types/proxy.types.ts:4` — `TApp<TProxyConfig>`
- **Impact**: `TApp` from `@tdsk/domain` accepts 4 generic params (Config, DB, Payments, Email). Proxy only provides Config, so `app.locals` includes phantom `db`, `payments`, `email` fields from default generics. This is misleading — the proxy doesn't use DB/payments/email in app.locals (except for the domain validation endpoint which creates its own DB connection).
- **Fix**: Either create a proxy-specific `TProxyApp` type, or accept the loose typing as a monorepo tradeoff

#### M-7: `trust proxy` commented out

- **File**: `src/middleware/setupServer.ts:15` — `//app.set('trust proxy', 1)`
- **Impact**: Express won't trust `X-Forwarded-For` headers from load balancers. `req.ip` will show the LB's IP, not the client's. Rate limiting by IP (if added per H-1) won't work correctly behind Caddy.
- **Fix**: Uncomment when running behind Caddy/LB. Should be configurable via env var.

### Low (6)

#### L-1: 5 unused dependencies in `package.json`

| Package | Version | Why Unused |
|---------|---------|-----------|
| `express-jwt` | 8.5.1 | Proxy uses `jose` for JWKS validation instead |
| `jsonwebtoken` | 9.0.2 | Never imported; `jose` handles all JWT operations |
| `express-winston` | 4.2.0 | Custom `requestLogger` middleware used instead |
| `express-rate-limit` | 7.5.0 | Installed but never configured or imported |
| `@neondatabase/neon-js` | 0.1.0-beta.21 | Not imported anywhere in proxy source |

Verified: `grep` across `src/` for all 5 packages returned zero results.

#### L-2: Placeholder logger test

- **File**: `src/utils/logger.test.ts:6` — `expect(true).toBe(true)` with `// TODO: add real test`
- **Impact**: Test provides zero value, inflates test count

#### L-3: Commented-out code in setupServer

- **File**: `src/middleware/setupServer.ts:14-15` — commented `etag` and `trust proxy`
- **Impact**: Code clutter

#### L-4: `me` and `logout` accept `app` param but don't use it

- **Files**: `src/endpoints/auth/me.ts:14` — `_app: TProxyApp`, `src/endpoints/auth/logout.ts:15` — `_app: TProxyApp`
- **Impact**: Unnecessary closure creation. Could be simplified to direct handler functions. The underscore prefix suppresses unused-var warnings.

#### L-5: Error handler doesn't call `next()`

- **File**: `src/utils/errors/errorHandler.ts:21`
- **Impact**: Express error middleware should call `next(err)` if it doesn't handle the error, to allow downstream error handlers. This handler always responds, so it's just a best-practice note.

#### L-6: Proxy error logs include stack trace

- **File**: `src/middleware/setupProxy.ts:33` — `logger.error('Proxy error: ${err.message}', { stack: err.stack })`
- **Impact**: Stack trace in logs could leak internal file paths. Minor since it's in server logs, not client responses.

---

## Unused Dependencies

| Package | Version | Why Unused | Recommendation |
|---------|---------|-----------|----------------|
| `express-jwt` | 8.5.1 | Proxy uses `jose` for JWKS validation | Remove |
| `jsonwebtoken` | 9.0.2 | Never imported; `jose` handles all JWT | Remove |
| `express-winston` | 4.2.0 | Custom `requestLogger` used instead | Remove |
| `express-rate-limit` | 7.5.0 | Never configured or imported | Remove or implement (see H-1) |
| `@neondatabase/neon-js` | 0.1.0-beta.21 | Not imported anywhere | Remove |
| `@types/jsonwebtoken` | 9.0.7 (devDep) | Types for unused `jsonwebtoken` | Remove |

---

## Cross-Repo Integration Analysis

### Proxy → Domain (correct, functioning)

| Import | File | Purpose |
|--------|------|---------|
| `setAuthHeaders` | `setupProxy.ts:7` | Sets `X-User-Id`, `X-Org-Id`, `X-User-Role`, `X-User-Email` on proxied requests |
| `adminPath` | `setupProxy.ts:7` | Returns `/_` path prefix for backend forwarding |
| `behindLBProxy` | `setupServer.ts:6` | Checks `TDSK_WITH_LB_PROXY` env to skip CORS |
| `loadEnvs` | `proxy.config.ts:3` | Loads env vars from `deploy/values.*.yml` |
| `inKube` | `proxy.config.ts:3` | Detects Kubernetes environment for backend URL |
| `TApp` | `proxy.types.ts:1` | Generic Express app type |
| `TSSLCreds` | `server.ts:2` | SSL certificate file paths type |

All imports are valid and functioning.

### Proxy → Backend (secure by design)

The proxy-backend trust model:
1. Proxy validates JWT via JWKS → attaches `req.user`
2. `setAuthHeaders()` injects `X-User-Id`, `X-Org-Id`, `X-User-Role`, `X-User-Email` headers
3. Backend reads headers via `fromAuthHeaders()` (domain utility)
4. Backend trusts these headers without re-validation (noted in backend audit as security concern)

**This is correct** assuming backend is only accessible via proxy (not public internet). The `backend.headerKey`/`headerValue` config provides a shared secret header for proxy→backend identity verification.

**Risk**: If backend is accidentally exposed directly, the header-trust model is exploitable. Anyone can forge `X-User-*` headers.

### Proxy → Database (direct coupling concern)

- `src/endpoints/domains/validate.ts:2` imports `database` from `@tdsk/database`
- Creates new connection per request (H-2)
- Only used for one endpoint — could be refactored to use `app.locals.db`

---

## Test Coverage Assessment

### Current Test Status

```
Test Files  3 passed (3)
     Tests  10 passed (10)
  Duration  693ms
```

### Coverage by Area

| Area | File(s) | Tests | Coverage | Priority |
|------|---------|-------|----------|----------|
| Config | `configs/proxy.config.test.ts` | 8 | Config shape validated | Adequate |
| Health endpoint | `src/endpoints/health.test.ts` | 1 | Fully tested | Adequate |
| Logger utility | `src/utils/logger.test.ts` | 1 placeholder | 0% (TODO) | Low |
| **Auth service** | `src/services/auth.ts` | **0** | **0%** | **Critical** |
| **Auth middleware** | `src/middleware/setupAuth.ts` | **0** | **0%** | **Critical** |
| **Proxy middleware** | `src/middleware/setupProxy.ts` | **0** | **0%** | **Critical** |
| Error handler | `src/utils/errors/errorHandler.ts` | 0 | 0% | High |
| Domain validation | `src/endpoints/domains/validate.ts` | 0 | 0% | High |
| Auth endpoints | `me.ts`, `logout.ts` | 0 | 0% | Medium |
| Request logger | `src/middleware/setupLogger.ts` | 0 | 0% | Medium |
| Server creation | `src/server/server.ts` | 0 | 0% | Low |
| Signals | `src/utils/signals.ts` | 0 | 0% | Low |
| Prewarm | `src/middleware/setupPrewarm.ts` | 0 | 0% | Low |

**Overall**: ~7% effective coverage. Security-critical code (auth service, auth middleware, proxy forwarding) has **0% coverage**.

---

## Test Plan

### Priority 1: Auth Service (`src/services/auth.ts`)

| # | Test | Description |
|---|------|-------------|
| 1 | `initialized()` returns true after construction | Verify JWKS client is created |
| 2 | `isPublic('/health')` returns true | Public route detection |
| 3 | `isPublic('/auth/me')` returns false | Protected route detection |
| 4 | `extract(req)` returns token from Bearer header | Happy path extraction |
| 5 | `extract(req)` returns null for missing header | Missing Authorization header |
| 6 | `extract(req)` returns null for non-Bearer header | Malformed Authorization header |
| 7 | `verify(token)` with valid JWT | Mock jose — return valid payload |
| 8 | `verify(token)` with expired JWT | Mock jose — throw JWTExpired |
| 9 | `verify(token)` with invalid signature | Mock jose — throw JWSSignatureVerificationFailed |
| 10 | `verify(token)` when JWKS not initialized | Returns `{ valid: false }` |

### Priority 2: Auth Middleware (`src/middleware/setupAuth.ts`)

| # | Test | Description |
|---|------|-------------|
| 1 | Skips auth for public routes | `/health` calls `next()` without checking token |
| 2 | Returns 401 for missing token | No Authorization header |
| 3 | Returns 500 when auth not initialized | `auth.initialized()` returns false |
| 4 | Returns 401 for invalid token | `auth.verify()` returns `{ valid: false }` |
| 5 | Returns 401 for expired token | `auth.verify()` returns `{ valid: false, expired: true }` |
| 6 | Attaches `req.user` on valid token | Valid token → `req.user` populated |
| 7 | Calls `next()` on success | Middleware chain continues |

### Priority 3: Error Handler (`src/utils/errors/errorHandler.ts`)

| # | Test | Description |
|---|------|-------------|
| 1 | Returns custom Exception status/message | `new Exception(404, 'Not found')` |
| 2 | Returns 500 for non-Exception errors | `new Error('something')` |
| 3 | Returns default message when empty | Error with no message |

### Priority 4: Auth Endpoints

| # | Test | Description |
|---|------|-------------|
| 1 | `/auth/me` returns user data from `req.user` | Happy path |
| 2 | `/auth/me` returns 401 when no user | `req.user` undefined |
| 3 | `/auth/logout` returns success message | Happy path |

### Priority 5: Domain Validation (`src/endpoints/domains/validate.ts`)

| # | Test | Description |
|---|------|-------------|
| 1 | Returns 400 for missing domain param | No `?domain=` query |
| 2 | Returns 403 for invalid domain | DB returns null |
| 3 | Returns 200 for valid domain | DB returns domain record |
| 4 | Returns 500 on DB error | DB throws exception |

### Priority 6: Request Logger (`src/middleware/setupLogger.ts`)

| # | Test | Description |
|---|------|-------------|
| 1 | Skips OPTIONS requests | `ignore()` returns true |
| 2 | Logs request with ID, method, path | `logger.info` called |
| 3 | Logs response with status and duration | `res.on('finish')` fires |

### Priority 7: Proxy Middleware (`src/middleware/setupProxy.ts`)

| # | Test | Description |
|---|------|-------------|
| 1 | Sets auth headers on proxy request | `setAuthHeaders` called with `proxyReq`, `req` |
| 2 | Sets backend headerKey/headerValue | Custom header set on proxied request |
| 3 | Handles proxy errors with 502 | `handleProxyError` returns 502 |

### Integration Tests

| # | Test | Description |
|---|------|-------------|
| 1 | Full request flow | Request → Auth → Proxy → Backend (mocked) |
| 2 | Public route bypasses auth | `/health` returns 200 without JWT |
| 3 | Invalid JWT rejected | Returns 401 at middleware level |
| 4 | Error propagation | Errors flow through middleware chain |

---

## SKILL.md Accuracy Assessment

The current SKILL.md is **~20% accurate**. It was written as if the proxy were empty stubs, when in fact it's fully implemented.

### Major Inaccuracies

| Claim in SKILL.md | Reality |
|--------------------|---------|
| "most files are empty stubs awaiting Phase 2" | FALSE — 38 source files, fully implemented |
| "proxy.ts contains only a TODO placeholder" | FALSE — 36-line orchestrator wiring 7 middleware |
| "Authentication middleware NOT YET IMPLEMENTED" | FALSE — 66-line JWKS auth via jose |
| "Route forwarding NOT YET IMPLEMENTED" | FALSE — 77-line http-proxy-middleware |
| "Only steps 2 (partial) and 8 are scaffolded" | FALSE — all 8 steps implemented |
| Express 4.21.2 | Express **5.1.0** |
| Vitest 1.4.0 | Vitest **1.6.1** |
| Uses `express-jwt` for auth | Uses **jose** for JWKS validation |
| Lists `src/constants/envs.ts` | File doesn't exist; `envs.types.ts` is in `types/` |
| Directory tree shows 15 files | Actually 38+ source files |
| Missing endpoints section | 4 endpoints: health, me, logout, validate |
| Missing services section | Auth service class with JWKS verification |
| TODO list shows everything unimplemented | Everything is implemented |

### What's Correct (~20%)
- Package name and purpose description
- Path alias pattern (`@TPX/*`)
- Signal handling description
- Logger factory description
- Environment variable loading via `@keg-hub/parse-config`
- Build tool (tsup)

**Recommendation**: Complete rewrite required — done as part of this audit.

---

## Recommendations

### Immediate (Critical/High fixes)

1. **Add `express.json()`** to `setupServer.ts` (C-1)
2. **Remove dead `adminPath` export** from `src/utils/index.ts` (C-2)
3. **Fix `/domains/validate` auth bypass** — add to `PublicRoutes` (M-2)
4. **Remove 26 lines of `console.log`** from `validate.ts` (H-3)
5. **Add error logging** to `errorHandler.ts` (H-4)
6. **Remove 5 unused dependencies** (L-1)

### Short-term (test coverage)

7. **Write auth service tests** — Priority 1 in test plan above
8. **Write auth middleware tests** — Priority 2
9. **Write error handler tests** — Priority 3
10. **Fix placeholder logger test** — replace with real assertions (L-2)

### Medium-term (hardening)

11. **Fix DB connection per request** — move to `app.locals.db` (H-2)
12. **Implement rate limiting** or remove dependency and document external handling (H-1)
13. **Fix regex bug** in `pathFilter` (M-1)
14. **Fix CORS wildcard + credentials** conflict (M-3)
15. **Use `crypto.randomUUID()`** for request IDs (M-5)
16. **Enable `trust proxy`** behind Caddy/LB (M-7)

### Long-term (architecture)

17. **Remove unused JWT config** — `jwt.secret`, `jwt.expiresIn`, `jwt.refreshExpiresIn` are vestigial (M-4)
18. **Create proxy-specific app type** — avoid inheriting phantom DB/Payments/Email generics (M-6)
19. **Add integration tests** — full request flow through middleware chain
20. **Rewrite SKILL.md** — completed as part of this audit

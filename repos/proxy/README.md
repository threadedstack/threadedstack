# Auth-Proxy (`@tdsk/proxy`)


The proxy repo is an auth gateway that serves as the single entry point for all client traffic. It validates JWTs via JWKS (jose library), forwards authenticated requests to the backend via proxy middleware.


## Architecture & Purpose

### Request Flow

```
Client Request
  ↓
setupLogger     → Request/response logging with timing
  ↓
setupServer     → CORS, urlencoded body parsing, router mount
  ↓
setupDatabase   → Initialize DB on app.locals.db (singleton, used by /domains/validate)
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
| GET | `/domains/validate` | Public | Caddy on_demand_tls validation |
| `/_/*` | (proxied) | Protected | All admin routes forwarded to backend |

### Design Notes

- **No `express.json()` middleware**: Intentional — the proxy forwards requests to the backend via `http-proxy-middleware`. Adding `express.json()` at the app or router level would consume the request body stream before the proxy can forward it. If JSON body parsing is needed for a specific proxy endpoint, it should be added as middleware directly on that endpoint.
- **Proxy runs behind Caddy**: The `trust proxy` and `etag` settings in `setupServer.ts` are commented out as reference for Caddy-proxied deployment configuration.
- **Stack traces in proxy error logs**: Intentional for debugging — written to server logs (Winston) only, never exposed in client responses.


## Mono-Repo Integration

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



### Proxy → Backend (secure by design)

The proxy-backend trust model:
1. Proxy validates JWT via JWKS → attaches `req.user`
2. `setAuthHeaders()` injects `X-User-Id`, `X-Org-Id`, `X-User-Role`, `X-User-Email` headers
3. Backend reads headers via `fromAuthHeaders()` (domain utility)
4. Backend trusts these headers without re-validation (noted in backend audit as security concern)

Backend is only accessible via proxy *(not public internet)*. The `backend.headerKey`/`headerValue` config provides a shared secret header for proxy→backend identity verification.


### Proxy → Database (via app.locals.db)

- DB is initialized once during proxy startup in `proxy.ts` via `setupDatabase()` and stored in `app.locals.db`
- `src/endpoints/domains/validate.ts` accesses `req.app.locals.db` for domain lookups
- Follows the same pattern used by the backend repo (`repos/backend/src/middleware/setupDatabase.ts`)

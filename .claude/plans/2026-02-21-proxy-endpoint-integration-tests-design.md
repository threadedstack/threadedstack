# Proxy Endpoint Integration Tests — Design

## Goal

Validate the full proxy endpoint lifecycle end-to-end: create a proxy-type endpoint, call it via the proxy engine route, verify the request is correctly forwarded to the target with headers/auth/body intact, then clean up all resources.

## Problem

Zero integration tests exist for `type: "proxy"` endpoints. The existing `faas-execution.test.ts` tests use the `/proxy/:projectId/:endpointId` route but only with `type: "faas"` endpoints. The core proxy forwarding flow — including header injection, secret template resolution, and auth configuration — is completely untested at the integration level.

## Approach

### Part 1: Echo Endpoint in Proxy Repo

Add a new public endpoint to the proxy service that echoes back incoming request details as JSON. Since the proxy is already running in K8s, the backend can reach it at its K8s service address without spinning up additional infrastructure.

**New file:** `repos/proxy/src/endpoints/echo.ts`

**Route:** `ALL /echo` (all HTTP methods)

**Public:** Added to `PublicRoutes` in `src/constants/values.ts`

**Response shape:**
```json
{
  "method": "POST",
  "path": "/echo",
  "headers": {
    "x-custom": "value",
    "authorization": "Bearer sk-test-..."
  },
  "body": { "test": "payload" },
  "query": { "key": "value" }
}
```

**Registration:** Added to `setupEndpoints.ts` alongside `/health`, `/auth/*`, `/domains/*`.

**Unit test:** `repos/proxy/src/endpoints/echo.test.ts` — validates response shape, method reflection, header passthrough, body echo, query param echo.

### Part 2: Integration Test File

**File:** `repos/integration/src/tier3/proxy-endpoint.test.ts`

**Echo target URL:** Configurable via `TDSK_IT_ECHO_URL` env var, defaulting to `http://tdsk-proxy:7118/echo` (K8s internal service address).

#### Setup Phase (`beforeAll`)

1. **Quickstart** — Creates project context (projectId, orgId, plus provider/secret/agent/endpoint from quickstart)
2. **Create a project-scoped secret** — Named `proxy-test-secret`, used for `{{proxy-test-secret}}` template injection testing
3. **Create 4 proxy endpoints:**

| Endpoint | Config | Purpose |
|----------|--------|---------|
| Basic proxy | `{ url: echoUrl }`, method: GET | Validates basic forwarding |
| Headers proxy | Endpoint headers: `{ "X-Test-Header": "static-value", "X-Secret-Header": "{{proxy-test-secret}}" }` | Validates header injection + secret resolution |
| Auth proxy | `options.auth: { type: "bearer", secretName: "proxy-test-secret" }` | Validates auth header injection |
| Public proxy | `public: true`, `{ url: echoUrl }` | Validates public access bypass |

#### Test Cases (~14 tests)

**Section 1: Endpoint CRUD Verification (3 tests)**
- Created endpoint has `type: "proxy"` and correct `options.url`
- Endpoint headers are stored as configured
- GET endpoint by ID returns full configuration

**Section 2: Basic Proxying (3 tests)**
- `POST /proxy/:projectId/:endpointId` returns 200 with echo JSON
- Echo response `method` matches the request method sent
- Echo response `body` matches the sent payload

**Section 3: Header & Secret Injection (3 tests)**
- Echo response `headers` contains static `x-test-header: static-value`
- Echo response `headers` contains resolved `x-secret-header` (not literal `{{proxy-test-secret}}`)
- Resolved secret value in echo matches the original secret plaintext

**Section 4: Auth Injection (2 tests)**
- Proxy with bearer auth config injects `Authorization` header (visible in echo response headers)
- Auth header value contains the resolved secret

**Section 5: Access Control (2 tests)**
- Request without auth token returns 401
- Public proxy endpoint works without auth (`noAuth: true`), echo returns 200

**Section 6: Error Handling (2 tests)**
- Non-existent endpoint ID returns 404
- Non-existent project ID returns 404

#### Cleanup Phase (`afterAll`)

Delete in reverse-dependency order:
1. All 4 proxy endpoints
2. Project-scoped secret (`proxy-test-secret`)
3. Quickstart resources: endpoint → agent → project → secret → provider

Best-effort deletion via `tryDelete()` — ignores errors if resources already gone.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `repos/proxy/src/endpoints/echo.ts` | Create | Echo endpoint handler |
| `repos/proxy/src/endpoints/echo.test.ts` | Create | Echo endpoint unit tests |
| `repos/proxy/src/endpoints/index.ts` | Modify | Export echo endpoint |
| `repos/proxy/src/constants/values.ts` | Modify | Add `/echo` to `PublicRoutes` |
| `repos/proxy/src/middleware/setupEndpoints.ts` | Modify | Register echo route |
| `repos/integration/src/tier3/proxy-endpoint.test.ts` | Create | Integration test file |
| `repos/integration/src/utils/env.ts` | Modify | Add `TDSK_IT_ECHO_URL` env var |

## Environment Configuration

Add to `~/.config/tdsk/values.yaml` (or `deploy/values.local.yaml`):
```yaml
TDSK_IT_ECHO_URL: "http://tdsk-proxy:7118/echo"
```

Default fallback in `env.ts`: `http://tdsk-proxy:7118/echo`

## Key Design Decisions

1. **Echo endpoint in proxy, not backend** — The proxy is the entry point; adding an echo there means the backend's ProxyEndpoint handler can reach it via K8s internal DNS without TLS or host-machine DNS dependencies.

2. **Public route** — The echo endpoint is public (no auth) so the backend's proxy handler can reach it without needing to authenticate. The integration test validates auth on the *inbound* side (test → Caddy → proxy → backend), not the *outbound* side (backend → echo target).

3. **Single test file** — Follows the established `faas-execution.test.ts` pattern: shared `beforeAll`/`afterAll`, sequential tests, `setupFailed` guard pattern.

4. **Configurable echo URL** — The K8s service name (`tdsk-proxy`) may differ across environments. Making it configurable via env var allows flexibility without code changes.

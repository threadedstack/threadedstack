# Auth & Security Hardening Design

## Problem

The platform is preparing for an end-of-month beta launch. A security audit identified several vulnerabilities across the proxy and backend that need to be fixed before production users are onboarded. The auth and encryption foundations are solid (JWT/JWKS, API key hashing, AES-256-GCM secrets, Drizzle parameterized queries), but there are gaps in defense-in-depth: mass assignment, no rate limiting, missing security headers, timing-unsafe comparisons, information-leaking error messages, and no WebSocket connection limits.

## Scope

Six hardening areas, prioritized by severity:

1. **Critical** — Mass assignment in 5 update endpoints
2. **High** — Per-IP rate limiting on proxy and backend
3. **High** — Security headers via helmet
4. **Medium** — Timing-safe proxy header comparison
5. **Medium** — Normalize shell token error messages
6. **Medium** — WebSocket connection limits

## What's Already Secure (No Action Needed)

- JWT/JWKS validation via `jose` with algorithm restriction
- API key hashing (SHA-256, no plaintext storage)
- Secret encryption (AES-256-GCM with HKDF key derivation, random IV)
- SQL injection prevention (Drizzle ORM parameterized queries)
- XSS prevention (React escaping, no unsafe HTML rendering)
- Sandbox pod isolation (unprivileged, no service account, egress proxy for secrets)
- Session tokens (HS256 JWT with derived key, short TTL, JTI for replay prevention)
- Error sanitization (SQL errors caught and replaced with generic messages)
- File upload validation (path traversal check, MIME whitelist, size limit)
- ID parameter validation (UUID/nanoid regex, auto-injected middleware)

## 1. Mass Assignment Fixes

### Problem

5 update endpoints spread the entire `req.body` into the database update without a field allowlist. An authenticated user could set arbitrary fields (e.g., overwrite `config`, `subscriptionTier`, or internal metadata) by including extra fields in the request body.

### Vulnerable Endpoints

| Endpoint | File | Allowed Fields |
|----------|------|----------------|
| `updateOrg` | `repos/backend/src/endpoints/orgs/updateOrg.ts` | `name`, `description`, `config` |
| `updateProject` | `repos/backend/src/endpoints/projects/updateProject.ts` | `name`, `description` |
| `updateProvider` | `repos/backend/src/endpoints/providers/updateProvider.ts` | `name`, `baseUrl`, `defaultModel`, `config` |
| `updateAgent` | `repos/backend/src/endpoints/agents/updateAgent.ts` | `name`, `description`, `instructions`, `model`, `temperature`, `maxTokens`, `systemPrompt`, `thinkingEnabled`, `thinkingBudget` |
| `updateUser` (admin path) | `repos/backend/src/endpoints/users/updateUser.ts` | `name`, `email`, `role` |

### Fix

Destructure only the allowed fields from `req.body` and conditionally build the update object. This matches the pattern already used by 15 other safe update endpoints in the codebase:

```typescript
const { name, description } = req.body
const updates: Record<string, unknown> = {}
if (name !== undefined) updates.name = name
if (description !== undefined) updates.description = description
await db.services.org.update({ ...updates, id: orgId })
```

The exact allowed fields for each endpoint need to be verified by reading the current code — the table above is the starting point. The implementer should read each endpoint and the corresponding database schema to confirm which fields are user-settable.

## 2. Per-IP Rate Limiting

### Problem

No rate limiting exists on any endpoint. Authentication endpoints are vulnerable to brute force attacks, and general API endpoints are vulnerable to abuse/DoS.

### Design

Add `express-rate-limit` to both the proxy and backend with tiered limits:

**Proxy:**

| Tier | Routes | Limit | Window |
|------|--------|-------|--------|
| Auth | `/auth/*` | 20 req | 1 minute |
| General API | `/_/*` | 200 req | 1 minute |
| Public | `/health`, `/echo` | No limit | — |

**Backend:**

| Tier | Routes | Limit | Window |
|------|--------|-------|--------|
| Auth | `/_/ai/sessions` | 20 req | 1 minute |
| General API | `/_/*` | 200 req | 1 minute |
| Public | `/health`, `/payments/webhooks` | No limit | — |

**Response:** `429 Too Many Requests` with `Retry-After` header and JSON body `{ error: "Too many requests, please try again later" }`.

**Store:** In-memory (default). Sufficient for single-replica beta. Swap to Redis store when scaling to multiple replicas.

**Implementation:** One rate limit middleware file per repo (`repos/proxy/src/middleware/rateLimit.ts`, `repos/backend/src/middleware/rateLimit.ts`). Each defines the tiered limiters and exports a setup function. Applied early in the middleware chain, after CORS but before auth.

**Dependency:** `express-rate-limit` — add to both `repos/proxy/package.json` and `repos/backend/package.json`.

## 3. Security Headers

### Problem

No security headers are set. Missing `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, and others.

### Design

Add `helmet` to both proxy and backend. Applied early in the middleware chain in `setupServer.ts`:

```typescript
import helmet from 'helmet'
app.use(helmet())
```

Helmet defaults provide:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (HSTS)
- `X-DNS-Prefetch-Control: off`
- `X-Permitted-Cross-Domain-Policies: none`
- Removes `X-Powered-By`

**CSP:** The default Content-Security-Policy is appropriate for the proxy and backend since they serve JSON only. The admin and threads SPAs are served by Vite dev servers (local) or static hosting (production) — not through the proxy/backend — so CSP does not need relaxing for them.

**Dependency:** `helmet` — add to both `repos/proxy/package.json` and `repos/backend/package.json`.

## 4. Timing-Safe Proxy Header Comparison

### Problem

`repos/backend/src/utils/auth/pxToBeHeader.ts:11` uses `!==` (strict inequality) to compare the proxy-to-backend secret header value. This is vulnerable to timing attacks where an attacker measures response time differences to guess the secret character by character.

### Fix

Replace with `crypto.timingSafeEqual()`:

```typescript
import { timingSafeEqual } from 'crypto'

const expected = Buffer.from(config.proxy.headerValue)
const received = Buffer.from(validate)
if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
  throw new Error('Invalid proxy validation')
}
```

The length check is required because `timingSafeEqual` throws on mismatched buffer lengths. Checking length first with `!==` is acceptable because the length alone does not reveal the secret value — and the attacker already knows the expected length (it is a fixed config value).

## 5. Normalize Shell Token Error Messages

### Problem

`repos/backend/src/endpoints/sandboxes/onShellConnect.ts:166` returns "Token sandbox mismatch" when a valid shell token is used against the wrong sandbox. This reveals that the token itself is valid, just for a different resource — enabling sandbox ID enumeration.

### Fix

Replace the mismatch message at line 166 with the same generic message used at line 162:

```
"Invalid or expired shell token"
```

Both error paths (invalid/expired token AND sandbox mismatch) return the same message. The server-side log can still differentiate — only the client-facing message is normalized.

## 6. WebSocket Connection Limits

### Problem

`repos/backend/src/server/wsServer.ts` accepts WebSocket connections unconditionally with no per-IP limits. An attacker could open thousands of connections to exhaust server resources.

### Design

Add per-IP connection tracking to the WebSocket server. When a new connection arrives:

1. Extract the client IP from the request
2. Check the count of active connections from that IP
3. If over the limit (20 concurrent connections per IP), close immediately with code `1008` (Policy Violation) and message `"Too many connections"`
4. Otherwise, increment the counter and register a close handler that decrements it

**Implementation:** A simple `Map<string, number>` in memory, managed in the `onConnection` handler in `wsServer.ts`. Applied to all three WebSocket paths (shell, AI, sandbox).

**Limit:** 20 concurrent connections per IP. This is generous for normal usage (a user might have multiple browser tabs with active sessions) but prevents abuse.

## Files

| Action | File | Purpose |
|--------|------|---------|
| Modify | `repos/backend/src/endpoints/orgs/updateOrg.ts` | Field allowlist |
| Modify | `repos/backend/src/endpoints/projects/updateProject.ts` | Field allowlist |
| Modify | `repos/backend/src/endpoints/providers/updateProvider.ts` | Field allowlist |
| Modify | `repos/backend/src/endpoints/agents/updateAgent.ts` | Field allowlist |
| Modify | `repos/backend/src/endpoints/users/updateUser.ts` | Field allowlist (admin path) |
| New | `repos/proxy/src/middleware/rateLimit.ts` | Proxy rate limiting |
| New | `repos/backend/src/middleware/rateLimit.ts` | Backend rate limiting |
| Modify | `repos/proxy/src/middleware/setupServer.ts` | Add helmet + rate limit setup |
| Modify | `repos/backend/src/middleware/setupServer.ts` | Add helmet + rate limit setup |
| Modify | `repos/backend/src/utils/auth/pxToBeHeader.ts` | Timing-safe comparison |
| Modify | `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | Normalize error message |
| Modify | `repos/backend/src/server/wsServer.ts` | Connection limits |
| Modify | `repos/proxy/package.json` | Add helmet, express-rate-limit |
| Modify | `repos/backend/package.json` | Add helmet, express-rate-limit |

~4 new files, ~12 modified files.

## Testing

- **Mass assignment:** Unit tests for each fixed endpoint verifying that extra fields in `req.body` are ignored.
- **Rate limiting:** Unit tests verifying 429 response after exceeding limits. Integration test hitting the proxy to confirm rate limiting works end-to-end.
- **Security headers:** Unit test verifying response includes expected headers (`x-content-type-options`, `strict-transport-security`, etc.).
- **Timing-safe comparison:** Unit test verifying the comparison works for matching and non-matching values.
- **Shell token error:** Unit test verifying both error paths return the same message.
- **WebSocket limits:** Unit test verifying connection rejection after limit exceeded and counter decrement on close.

## Out of Scope

- CSRF protection (admin is an SPA using Bearer tokens, not cookies — CSRF not applicable)
- Per-org encryption key isolation (master key rotation — post-launch)
- Zod schema validation across all endpoints (large refactor — post-launch)
- Redis-backed rate limiting (needed only at multi-replica scale)
- Per-API-key rate limiting (deferred — per-IP sufficient for beta)

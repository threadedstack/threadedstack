# Backend Repo Audit Report

**Date:** 2026-02-08
**Scope:** Full codebase review of `repos/backend/`
**Files Analyzed:** ~170+ source files, 23 test files

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Repo Purpose & Architecture](#repo-purpose--architecture)
3. [Critical Bugs](#critical-bugs)
4. [Security Vulnerabilities](#security-vulnerabilities)
5. [Code Quality Issues](#code-quality-issues)
6. [Cross-Repo Inconsistencies](#cross-repo-inconsistencies)
7. [Test Coverage Analysis](#test-coverage-analysis)
8. [Missing Features & Incomplete Work](#missing-features--incomplete-work)
9. [Performance Issues](#performance-issues)
10. [Refactoring Recommendations](#refactoring-recommendations)
11. [Test Plan](#test-plan)
12. [Priority Matrix](#priority-matrix)

---

## Executive Summary

The backend repo serves as the Core API for ThreadedStack, handling admin CRUD operations, proxy engine, FaaS, and AI orchestration. It is built on Express 5 and follows a configuration-driven endpoint pattern.

**Overall Assessment: Functional but fragile.** The core architecture is sound (strategy patterns, async router, configuration-driven routing), but the implementation has numerous bugs, security holes, and missing error handling left by the previous AI agent. Key problem areas:

- **4 critical functionality bugs** that completely break features (inverted validation, missing `id` in upserts, uninitialized tokens)
- **6 critical security vulnerabilities** (auth header trust, timing attacks, quota bypass, admin backdoors)
- **~75% of source files have no tests** (security-critical code is largely untested)
- **Multiple race conditions** in billing, subscriptions, and quota enforcement
- **5+ list endpoints fetch entire tables** then filter in-memory (performance/scalability)
- **Cross-repo type mismatches** between domain models and database schemas

---

## Repo Purpose & Architecture

### What It Does
The backend is the central API server receiving all admin requests from the Auth-Proxy at `/_/*` paths. It orchestrates:

- **Admin CRUD** - Orgs, Projects, Users, API Keys, Secrets, Endpoints, Providers, Agents, Domains, Configs, Invitations
- **Billing** - Subscriptions (via Polar.sh), Quotas, Payments/Webhooks
- **Proxy Engine** - Secure API proxying with secret injection and OAuth token management
- **Email** - Transactional email via Resend, Mailgun, or Console (strategy pattern)

### Bootstrap Flow
```
index.ts → start.ts → main.ts
  ├── Store config in app.locals
  ├── Initialize EmailService + PaymentsService
  ├── setupLogger(app)
  ├── setupServer(app, router)     [CORS, x-powered-by]
  ├── setupDatabase(app)           [No connection validation!]
  ├── setupEndpoints(app, router)  [Dynamic route registration]
  ├── // setupProxy(app, router)   [COMMENTED OUT]
  ├── setupErrorHandler(app)
  └── initServer()                 [HTTP only, no HTTPS]
```

### Key Patterns
- **Async Router**: All route handlers wrapped with `express-async-handler`
- **Configuration-Driven Endpoints**: Declarative endpoint configs dynamically registered
- **Strategy Pattern**: Used for payments (Polar/Console) and email (Resend/Mailgun/Console)
- **Exclusive Arc**: Secrets/Configs belong to exactly one scope (org XOR project XOR provider)

---

## Critical Bugs

### BUG-001: Inverted Validation in createEndpoint.ts [BLOCKS FEATURE]
**File:** `src/endpoints/endpoints/createEndpoint.ts:54-56`
```typescript
// WRONG - throws when headers IS an object (should be !isObj)
if (headers && isObj(headers)) throw new Exception(400, `Headers must be an object`)
if (options && isObj(options)) throw new Exception(400, `Options must be an object`)
```
**Impact:** Users cannot create endpoints with headers or options. The condition is inverted - it rejects valid objects instead of invalid ones. `updateEndpoint.ts` has the correct logic with `!isObj()`.
**Fix:** Change `isObj(headers)` to `!isObj(headers)` and same for options.

### BUG-002: Uninitialized Token in PolarService [BLOCKS PAYMENTS]
**File:** `src/services/payments/strategies/polar.ts:31-37`
```typescript
constructor(config: TPayConfig) {
  if (!config.token) throw new Exception(500, `Payments access token is required`)
  super(config)
  this.#service = new Polar({
    accessToken: this.#token,  // ❌ this.#token is NEVER assigned!
  })
}
```
**Impact:** All Polar API calls fail with 401 Unauthorized. The `config.token` is validated but never stored in `this.#token`.
**Fix:** Add `this.#token = config.token` before `new Polar(...)`.

### BUG-003: Subscription Upsert Missing Required `id` [BREAKS WEBHOOKS]
**File:** `src/services/payments/strategies/polar.ts:261-273`
The webhook handler calls `db.services.subscription.upsert({...})` without an `id` field, but the base database service's `upsert()` method requires `id` and throws `DBIdError` if missing. Additionally, the base upsert uses `id` as the conflict target, but the subscriptions table has a UNIQUE constraint on `userId`, not `id`.
**Impact:** All webhook-driven subscription updates fail. Subscriptions are never created or updated from Polar events.
**Fix:** Override `upsert()` in subscription service to use `userId` as conflict target, or use `findByUser()` + `create()`/`update()`.

### BUG-004: Incomplete Exclusive Arc Validation for Secrets
**File:** `src/endpoints/secrets/createSecret.ts:38-42`
```typescript
if ((hasOrg && hasProject) || (hasOrg && hasProvider && hasProject))
  throw new Exception(400, `Secret can only belong to one of: org, project, or provider`)
```
**Missing cases:** `orgId + providerId` and `projectId + providerId` are not caught.
**Impact:** Violates exclusive arc pattern - secrets can be created with multiple owners.
**Fix:**
```typescript
const count = [hasOrg, hasProject, hasProvider].filter(Boolean).length
if (count > 1) throw new Exception(400, ...)
```

### BUG-005: TRequest Type Parameter Order Swapped
**File:** `src/types/backend.types.ts:17`
```typescript
export type TRequest<ReqParams, ReqBody, ResBody> = TReq<TApp, ReqParams, ResBody, ReqBody>
//                                                                        ^^^^^^^ ^^^^^^^ SWAPPED
```
**Impact:** Response body type is passed where request body is expected and vice versa. All endpoint type annotations using TRequest with body types are incorrect.

### BUG-006: Product ID / Price ID Confusion in checkQuota and createCheckout
**Files:** `src/endpoints/quotas/checkQuota.ts:49-53`, `src/endpoints/subscriptions/createCheckout.ts:45`
The quota check uses `subscription.polarPriceId` as if it were a product ID when calling `fetchProduct()`. The checkout endpoint uses the product ID where a price ID is needed.
**Impact:** Wrong quota limits fetched for paid users. Checkout may fail or charge wrong amount.

---

## Security Vulnerabilities

### SEC-001: Authentication Trusts Headers Without JWT Validation [CRITICAL]
**File:** `src/middleware/setupAuth.ts:20`
The authenticate middleware reads user identity from `X-User-Id`, `X-Org-Id`, `X-User-Role`, `X-User-Email` headers via `fromAuthHeaders(req)` without validating a JWT token. Anyone who can reach the backend directly (bypassing the proxy) can impersonate any user by setting these headers.
**Mitigated by:** Proxy header validation (`pxToBeHeader`), but this is a simple string comparison that can be spoofed if the values are known.

### SEC-002: Neon Admin Backdoor in checkPermission.ts [HIGH]
**File:** `src/utils/auth/checkPermission.ts:27-34, 108-109, 130`
Three separate `if (isNeonAdmin(req.user)) return` checks allow platform admins to bypass ALL authorization. A TODO comment on line 108 says "remove this" and line 24-26 notes this is a "Major security issue."
**Impact:** Platform admins have unrestricted access to all customer data.

### SEC-003: Webhook Signature Timing Attack [MEDIUM]
**File:** `src/services/payments/strategies/polar.ts:208-211`
Uses `signature === expectedSignature` instead of `crypto.timingSafeEqual()` for webhook HMAC validation. Vulnerable to timing-based signature forgery.
**Note:** The `@polar-sh/express` middleware at the webhook endpoint may handle this correctly, but the custom `validateWebhook()` method does not.

### SEC-004: Quota Bypass via Negative Amounts [HIGH]
**File:** `src/endpoints/quotas/checkQuota.ts:66`
```typescript
const allowed = currentUsage + amount <= limit
```
If `amount` is negative (e.g., `-1000`), this check always passes. No validation that `amount >= 0`.

### SEC-005: TOCTOU Race Condition in Quota Checking [HIGH]
**File:** `src/endpoints/quotas/checkQuota.ts:32-66`
Quota check and quota increment are separate operations. Two concurrent requests can both pass the quota check and both increment, exceeding the limit.

### SEC-006: Authorization Context From Request Body [MEDIUM]
**File:** `src/middleware/authorize.ts:22-24`
Extracts `orgId`/`projectId` for authorization from `req.body` in addition to `req.params`. An attacker can send different IDs in the body vs URL to bypass org-level checks.

### SEC-007: Missing Webhook Timestamp/Replay Validation [MEDIUM]
**File:** `src/services/payments/strategies/polar.ts:204-218`
Custom webhook validation checks signature but not timestamp freshness. Old webhooks can be replayed.

### SEC-008: CORS credentials with wildcard origins [MEDIUM]
**File:** `src/middleware/setupServer.ts:22`
When `origins.includes('*')`, CORS is configured with `credentials: true` and `origin: '*'`. Browsers block this combination for security.

### SEC-009: Trust Proxy Disabled [MEDIUM]
**File:** `src/middleware/setupServer.ts:14` (commented out)
`app.set('trust proxy', 1)` is commented out. Behind a load balancer, `req.ip` returns the proxy IP, breaking rate limiting, logging, and security features.

### SEC-010: Missing Authorization for Provider Secrets [HIGH]
**File:** `src/endpoints/secrets/createSecret.ts:44-48`
When creating a secret with `providerId` but no `orgId`/`projectId`, the permission check receives `undefined` for both org and project context, effectively bypassing authorization.

---

## Code Quality Issues

### Dead Code
| File | Issue |
|------|-------|
| `src/main.ts:6,24` | `setupProxy` imported but commented out |
| `src/utils/signals.ts` | Exported but never called anywhere |
| `src/utils/helpers.ts` | `defaultTrue` function not exported/used |
| `src/types/request.types.ts` | 7 unused type definitions |
| `src/types/envs.types.ts` | `TLogLevel` never used |
| `src/types/secrets.types.ts` | `TResolvedSecret` never used |
| `src/types/endpoints.types.ts:9` | `TMethodType` never used |
| `src/constants/envs.ts` | Empty file |
| `src/constants/values.ts:15` | `DefUserProxyOpts` never used |
| `package.json` | `module-alias` possibly unused (uses `alias-hq`) |

### EPMethod Enum Redundancy
**File:** `src/types/endpoints.types.ts:28-53`
Every HTTP method has 3 case variants (e.g., `USE`, `use`, `Use` all equal `"use"`). This should be a single-case enum.

### Inconsistent Patterns
| Pattern | Where | Issue |
|---------|-------|-------|
| Error types | Throughout | Mix of `Error`, `Exception`, `OverrideError` |
| Logging | `services/invite.ts:115` | Uses `console.warn` instead of `logger.warn` |
| Delete responses | Multiple endpoints | Some return `{success, id}`, others just `{success}` |
| List responses | Multiple endpoints | Some include `total`, others don't |
| Error codes | errorHandler | `Exception.code` exists but not included in HTTP response |
| Abstract methods | Payment strategies | Uses `OverrideError` instead of TypeScript `abstract` |

### Code Duplication
1. **Permission check boilerplate** repeated in every endpoint (~15 times):
   ```typescript
   const { data: existing } = await db.services.X.get(id)
   if (!existing) throw new Exception(404, `X not found`)
   await checkPermission(req, action, resource, { orgId: existing.orgId })
   ```
2. **Exclusive Arc validation** repeated in secrets, configs, providers (3 times)
3. **Parameter extraction** (`orgId` from params/body/query) repeated in authorize.ts (4 times)
4. **Period calculation** (quota period string) duplicated in `checkQuota.ts` and `getOrgQuota.ts`

---

## Cross-Repo Inconsistencies

### Domain ↔ Database Schema Mismatches
| Issue | Domain | Database |
|-------|--------|----------|
| User model has `first`/`last` | `domain/src/models/user.ts:5-6` | Schema has NO such columns |
| Subscription model missing `seats` | `domain/src/models/subscription.ts` | Schema HAS `seats` column |
| Agent model has `agentId` | `domain/src/models/agent.ts:11` | Schema has NO such column |
| Secrets backend ignores `agentId` | `backend/endpoints/secrets/createSecret.ts` | Schema allows `agentId` scope |

### Backend ↔ Database Service Mismatches
| Issue | Backend Call | Database Reality |
|-------|-------------|------------------|
| Subscription upsert needs `id` | Calls `upsert({})` without `id` | Base `upsert()` requires `id` |
| List endpoints fetch all records | `db.services.X.list()` with no filter | `list()` supports `where` parameter |
| `findByUser` crashes on missing data | Returns `{ data: model(undefined) }` | Should return `{ data: null }` |

---

## Test Coverage Analysis

### Current State
| Metric | Value |
|--------|-------|
| Test files | 23 |
| Meaningful test files | 22 (1 stub) |
| Test cases | ~350+ |
| Estimated line coverage | 20-25% |
| Integration tests | 0 |
| E2E tests | 0 |

### What's Tested (Good)
- API Keys CRUD (22 tests) - scope validation, masking, exclusive arc
- Invitations workflow (33 tests) - state machine, expiry, acceptance
- Polar.sh integration (40+ tests) - API calls, webhook validation, plans
- Quotas (18 tests) - limits, enforcement logic
- All basic CRUD endpoints (10-15 tests each)

### What's NOT Tested (Critical Gaps)
| Category | Files | Risk |
|----------|-------|------|
| Auth middleware | `setupAuth.ts`, `authorize.ts` | CRITICAL |
| Permission logic | `checkPermission.ts` | CRITICAL |
| API key generation/validation | `generateApiKey.ts`, `validateApiKey.ts` | CRITICAL |
| Secret encryption | Mocked in tests, never actually tested | CRITICAL |
| Payment webhook handler | `payments/webhook.ts` | CRITICAL |
| Proxy engine | `proxyService.ts`, `replaceSecretRefs.ts` | HIGH |
| All middleware files | 7 files, 0 tests | HIGH |
| Agent endpoints | 6 files, 0 tests | HIGH |
| Domain endpoints | 7 files, 0 tests | HIGH |
| Error utilities | 5 files, 0 tests | MEDIUM |
| Signal handling | `signals.ts` | MEDIUM |

### Test Configuration Issues
- No coverage thresholds configured in `vitest.config.ts`
- No test setup file for shared fixtures
- Logger test is a stub: `expect(true).toBe(true)`

---

## Missing Features & Incomplete Work

### Unimplemented Endpoints
| Resource | Missing Operations | Impact |
|----------|-------------------|--------|
| Threads | Full CRUD | Core feature (AI conversations) |
| Messages | Full CRUD | Core feature (AI messages) |
| Assets | Full CRUD + upload/download | File management |
| Payments | History, Invoices, Refunds | Billing completeness |
| Subscriptions | Update/change plan | Users can't upgrade/downgrade |
| Quotas | Create, Update, Reset | No manual quota management |

### Unfinished TODOs in Code
| File | Line | TODO |
|------|------|------|
| `checkPermission.ts` | 108 | "remove this - update my user to be super-admin" |
| `checkPermission.ts` | 19-21 | "Need to add way for users to create orgs" |
| `checkPermission.ts` | 24-26 | "Need to change this... Major security issue" |
| `listProjects.ts` | 27-28 | "This is a security issue and probably not a good idea" |
| `listOrgs.ts` | 49-50 | "may want to switch this so it's always ERoleType.super" |
| `deleteUser.ts` | 41-42 | "move remove from org into its own endpoint" |
| `replaceSecretRefs.ts` | 37 | "could also throw error" |
| `backend.config.ts` | 41 | "figure out how this should be resolved" |
| `payments/console.ts` | 3-8 | Entire ConsoleService is unimplemented |

### Bootstrap Issues
- No graceful shutdown (signals utility exists but is never called)
- No database connection validation before starting server
- No HTTPS support (HTTP only)
- Service constructors can throw without error handling
- Return value from `main()` is discarded

---

## Performance Issues

### In-Memory Filtering (5 Endpoints)
These endpoints fetch **all records** from the database then filter in JavaScript:
1. `listEndpoints.ts` - all endpoints, filter by projectId
2. `listApiKeys.ts` - all keys, filter by orgId/projectId
3. `listSecrets.ts` - all secrets, filter by orgId/projectId/providerId
4. `listConfigs.ts` - all configs, filter by orgId/projectId/userId
5. `listFunctions.ts` - all functions, filter by endpointId/projectId

**Fix:** Use database-level `WHERE` clauses. The `list()` method already supports `{ where: {...} }`.

### No Pagination
Zero list endpoints support pagination. Will fail at scale.

### N+1 Query in listUsers
**File:** `src/endpoints/users/listUsers.ts:38-46`
Fetches users one-by-one in a loop instead of a batch query.

### Sequential API Calls in fetchPlans
**File:** `src/services/payments/strategies/polar.ts:64-85`
Fetches each product sequentially. Should use `Promise.all()`.

### Unbounded Caches
- Product cache in PolarService (no TTL, no eviction)
- OAuth token cache in ProxyService (no size limit)
- Template cache in EmailService (no expiry)

---

## Refactoring Recommendations

### High Priority Refactors

1. **Extract `requireResourceWithPermission()` helper**
   - Eliminates permission check boilerplate from all endpoints (~15 duplications)

2. **Extract `validateExclusiveArc()` utility**
   - Centralizes exclusive arc validation (secrets, configs, providers)

3. **Push filtering to database layer**
   - Change 5 list endpoints to use `db.services.X.list({ where: {...} })`

4. **Replace OverrideError with TypeScript `abstract`**
   - Payment strategy base class should use `abstract` methods

5. **Fix subscription service upsert**
   - Override base `upsert()` to use `userId` as conflict target

6. **Standardize error responses**
   - Include error `code` in HTTP response for frontend consumption
   - Standardize delete response format

### Medium Priority Refactors

7. **Add pagination to all list endpoints**
8. **Add request body validation (Zod/TypeBox)**
9. **Clean up dead code** (unused types, empty files, commented code)
10. **Consolidate period calculation utility** (for quota endpoints)
11. **Fix EPMethod enum** (remove 3x case redundancy)
12. **Enable TypeScript strict mode** (`noImplicitAny: true`, `strictNullChecks: true`)

---

## Test Plan

### Phase 1: Security-Critical Tests (Highest Priority)

#### 1.1 Authentication & Authorization
- Test `setupAuth.ts` middleware with valid/invalid/missing headers
- Test `checkPermission.ts` with all role combinations
- Test `authorize.ts` middleware parameter extraction
- Test `shouldIgnore.ts` route bypass logic
- Test `pxToBeHeader.ts` proxy validation
- Verify auth cannot be bypassed by setting custom headers

#### 1.2 API Key Security
- Test `generateApiKey.ts` key format and uniqueness
- Test `validateApiKey.ts` scope and expiration validation
- Test `hashApiKey.ts` consistency (same input → same hash)
- Test API key masking in list/get responses

#### 1.3 Secret Encryption
- **Remove mocks** from secrets tests
- Test actual `deriveKey`, `encryptValue`, `decryptValue`
- Verify encrypted values cannot be reversed without key
- Test secret masking in API responses

#### 1.4 Payment Webhooks
- Test webhook signature validation with known-good signatures
- Test webhook replay prevention (timestamp validation)
- Test idempotency (same event processed twice → single effect)
- Test all webhook event types (created, updated, cancelled)

### Phase 2: Core Functionality Tests

#### 2.1 CRUD Endpoints (Fill Gaps)
- Complete org management tests (create, update, delete, members)
- Add agent endpoint tests (all CRUD)
- Add domain endpoint tests (all CRUD)
- Test exclusive arc enforcement for secrets, configs

#### 2.2 Billing
- Test quota enforcement with concurrent requests
- Test subscription lifecycle (create → update → cancel)
- Test free tier auto-assignment
- Test quota period boundary handling

#### 2.3 Services
- Test ProxyService OAuth token management
- Test RetryService backoff logic
- Test EmailService template rendering
- Test PolarService plan fetching and caching

### Phase 3: Infrastructure Tests

#### 3.1 Middleware
- Test CORS configuration
- Test error handler with various error types
- Test endpoint registration
- Test database initialization error handling

#### 3.2 Utilities
- Test error utilities (Exception, errorHandler, withEx)
- Test proxy utilities (buildProxy, replaceSecretRefs)
- Test signal handling (graceful shutdown)

### Phase 4: Integration Tests

#### 4.1 Database Integration
- Test actual database queries (not mocked)
- Test transaction handling (createOrg + assign role)
- Test concurrent operations (quota race conditions)

#### 4.2 API Flow Tests
- Test complete request→response flow for key endpoints
- Test auth→authorize→handler→response chain
- Test error propagation through middleware stack

### Test Coverage Targets
| Area | Current | Target |
|------|---------|--------|
| Auth/Security | 0% | 90%+ |
| Endpoints | ~40% | 80%+ |
| Services | ~30% | 70%+ |
| Middleware | 0% | 60%+ |
| Utilities | ~10% | 60%+ |
| Overall | ~20-25% | 70%+ |

---

## Priority Matrix

### P0 - Fix Immediately (Blocks functionality / Security critical)

| ID | Issue | Type | File |
|----|-------|------|------|
| BUG-001 | Inverted validation in createEndpoint | Bug | `endpoints/endpoints/createEndpoint.ts:54-56` |
| BUG-002 | Uninitialized `#token` in PolarService | Bug | `services/payments/strategies/polar.ts:31-37` |
| BUG-003 | Subscription upsert missing `id` | Bug | `services/payments/strategies/polar.ts:261-273` |
| SEC-001 | Auth trusts headers without JWT | Security | `middleware/setupAuth.ts:20` |
| SEC-002 | Neon admin bypasses all auth | Security | `utils/auth/checkPermission.ts:27-34,108,130` |
| SEC-004 | Quota bypass via negative amounts | Security | `endpoints/quotas/checkQuota.ts:66` |

### P1 - Fix This Sprint (High impact bugs / Security)

| ID | Issue | Type | File |
|----|-------|------|------|
| BUG-004 | Incomplete exclusive arc validation | Bug | `endpoints/secrets/createSecret.ts:38-42` |
| BUG-005 | TRequest parameter order swapped | Bug | `types/backend.types.ts:17` |
| BUG-006 | ProductId/PriceId confusion | Bug | `endpoints/quotas/checkQuota.ts:49-53` |
| SEC-003 | Webhook timing attack | Security | `services/payments/strategies/polar.ts:208` |
| SEC-005 | Quota TOCTOU race condition | Security | `endpoints/quotas/checkQuota.ts:32-66` |
| SEC-006 | Auth context from request body | Security | `middleware/authorize.ts:22-24` |
| SEC-010 | Missing provider secret auth | Security | `endpoints/secrets/createSecret.ts:44-48` |
| PERF-001 | 5 endpoints fetch entire tables | Performance | Multiple list endpoints |

### P2 - Fix Next Sprint (Code quality / Medium bugs)

| ID | Issue | Type | File |
|----|-------|------|------|
| SEC-007 | Missing webhook replay protection | Security | `services/payments/strategies/polar.ts:204-218` |
| SEC-008 | CORS credentials + wildcard | Security | `middleware/setupServer.ts:22` |
| SEC-009 | Trust proxy disabled | Security | `middleware/setupServer.ts:14` |
| BUG-007 | Cancelled subscription loses access immediately | Bug | `services/payments/strategies/polar.ts:294-308` |
| BUG-008 | No graceful shutdown | Bug | `start.ts:5` |
| BUG-009 | No database connection validation | Bug | `middleware/setupDatabase.ts:5` |
| QUAL-001 | Standardize delete responses | Quality | Multiple endpoints |
| QUAL-002 | Add pagination to list endpoints | Quality | Multiple endpoints |
| TEST-001 | Add security-critical tests | Testing | Auth, crypto, payments |

### P3 - Backlog (Improvements / Low priority)

| ID | Issue | Type | File |
|----|-------|------|------|
| QUAL-003 | Clean up dead code | Quality | Multiple files |
| QUAL-004 | Fix EPMethod redundancy | Quality | `types/endpoints.types.ts:28-53` |
| QUAL-005 | Enable strict TypeScript | Quality | `tsconfig.json` |
| QUAL-006 | Add request body validation | Quality | All create/update endpoints |
| FEAT-001 | Implement Thread/Message CRUD | Feature | New endpoints needed |
| FEAT-002 | Implement Asset management | Feature | New endpoints needed |
| FEAT-003 | Add subscription update/change | Feature | `endpoints/subscriptions/` |
| FEAT-004 | Add payment history/invoices | Feature | `endpoints/payments/` |
| REFACT-001 | Extract permission helper | Refactor | All endpoints |
| REFACT-002 | Extract exclusive arc validator | Refactor | secrets/configs/providers |
| REFACT-003 | Replace OverrideError with abstract | Refactor | Payment strategies |
| PERF-002 | Add caching with TTL | Performance | Services |
| PERF-003 | Fix N+1 in listUsers | Performance | `endpoints/users/listUsers.ts` |

---

## Appendix: File Inventory

### Source Files by Category

**Entry Points (3):** `index.ts`, `start.ts`, `main.ts`
**Server (4):** `server/app.ts`, `server/router.ts`, `server/server.ts`, `server/index.ts`
**Middleware (8):** `setupAuth.ts`, `setupServer.ts`, `setupDatabase.ts`, `setupEndpoints.ts`, `setupErrorHandler.ts`, `setupLogger.ts`, `setupProxy.ts`, `setupSubscription.ts`, `authorize.ts`
**Endpoints (~90):** 15 endpoint groups × ~6 files each
**Services (~15):** api, invite, payments (3), email (5), proxy (2), templates
**Utilities (~20):** auth (6), errors (6), proxy (7), helpers, logger, signals, paths
**Types (~12):** api, backend, email, endpoints, envs, errors, pay, request, retry, secrets, token, simple-oauth2.d.ts
**Constants (3):** envs.ts (empty), values.ts, index.ts
**Config (5):** backend.config.ts, biome.json, tsup.config.ts, vitest.config.ts, aliases.ts

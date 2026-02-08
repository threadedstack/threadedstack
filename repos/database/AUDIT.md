# Database Repo (`repos/database`) - Full Audit

**Date**: 2026-02-08
**Auditor**: Claude Opus 4.6
**Repo Version**: 0.1.0
**Drizzle ORM**: 0.45.1

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Purpose & Architecture](#purpose--architecture)
3. [Current Status](#current-status)
4. [Critical Bugs](#critical-bugs)
5. [Schema Issues](#schema-issues)
6. [Service Issues](#service-issues)
7. [Type System Issues](#type-system-issues)
8. [Cross-Repo Mismatches](#cross-repo-mismatches)
9. [Infrastructure Issues](#infrastructure-issues)
10. [Security Concerns](#security-concerns)
11. [Test Coverage](#test-coverage)
12. [Fix Plan](#fix-plan)
13. [Test Plan](#test-plan)

---

## Executive Summary

The database repo is the ORM layer for the ThreadedStack platform, built on Drizzle ORM with PostgreSQL (Neon.com). It defines 18+ table schemas, a service-based CRUD API, and converts DB records to domain models.

### Severity Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 8 | Blocking - must fix before deployment |
| **HIGH** | 14 | Major functionality broken or data integrity at risk |
| **MEDIUM** | 22 | Incorrect behavior, inconsistencies, missing features |
| **LOW** | 12 | Code quality, documentation, minor inconsistencies |
| **TOTAL** | **56** | |

### Key Findings

- **~0% test coverage** - Only 1 test file with a placeholder `expect(true).toBe(true)`
- **8 critical bugs** including a column name collision, broken query method, missing relations, crashes on undefined access
- **No migration history** - Schema managed via `drizzle-kit push` only; no rollback capability
- **No connection cleanup** - Pool reference lost, no `disconnect()` export, scripts hang
- **19 cross-repo field mismatches** between DB schemas and domain models
- **Multiple missing constraints** - exclusive arcs, unique indexes, NOT NULL

---

## Purpose & Architecture

### What It Does

The database repo provides:
1. **Drizzle table schemas** for 18+ PostgreSQL tables
2. **Service layer** with CRUD operations (create, get, list, update, upsert, delete)
3. **Singleton database factory** with connection pooling
4. **Type-safe API** using Drizzle's inferred types
5. **Domain model conversion** (DB record → domain model instance)

### 3-Layer Architecture

```
Consumer Repos (backend, proxy)
    ↓ db.services.org.create({...})
Service Layer (src/services/)
    ↓ this.db.insert(this.table).values(data)
Schema Layer (src/schemas/)
    ↓ Drizzle SQL generation
PostgreSQL (Neon.com)
```

### Tables (18+)

| Table | Schema File | Service | Domain Model | Has Relations |
|-------|-------------|---------|-------------|---------------|
| `neon_auth.user` | `users.ts` | `User` | `User` | Yes |
| `organizations` | `orgs.ts` | `Org` | `Organization` | Yes |
| `projects` | `projects.ts` | `Project` | `Project` | Yes |
| `roles` | `roles.ts` | `Role` | `Role` | Yes |
| `api_keys` | `apiKeys.ts` | `ApiKey` | `ApiKey` | Yes |
| `secrets` | `secrets.ts` | `Secret` | `Secret` | Yes (INCOMPLETE) |
| `endpoints` | `endpoints.ts` | `Endpoint` | `Endpoint` | Yes |
| `functions` | `functions.ts` | `Function` | `Function` | Yes |
| `configs` | `configs.ts` | `Config` | `Config` | **NO** |
| `providers` | `providers.ts` | `Provider` | `Provider` | Yes |
| `threads` | `threads.ts` | `Thread` | `Thread` | Yes |
| `messages` | `messages.ts` | `Message` | `Message` | Yes |
| `assets` | `assets.ts` | `Asset` | `Asset` | Yes |
| `quotas` | `quotas.ts` | `Quota` | `Quota` | Yes |
| `subscriptions` | `subscriptions.ts` | `Subscription` | `Subscription` | Yes |
| `agents` | `agents.ts` | `Agent` | `Agent` | Yes |
| `agent_projects` | `agentProjects.ts` | (via Agent) | N/A (junction) | Yes |
| `invitations` | `invitations.ts` | `Invitation` | `Invitation` | Yes (BROKEN) |
| `domains` | `domains.ts` | `DomainService` | `Domain` | Yes |
| `caddy_certmagic_objects` | `certificates.ts` | (via Domain) | `Certificate` | Yes |

---

## Current Status

### What Works

- Basic schema definitions are mostly correct
- Service CRUD inheritance pattern is well-designed
- Exclusive arc pattern is correctly implemented on `secrets`, `configs`, `roles`, `assets`
- Quota service atomic `increment()` with upsert is a good pattern
- Domain model conversion exists in most services
- Path alias system (`@TDB/*`) works correctly

### What Doesn't Work

- `Base.by()` method is broken for object-argument calls (all `by({ field: value })` calls fail)
- `users.banExpires` maps to wrong DB column (`banReason` instead of `ban_expires`)
- `configs` schema has no relations (breaks all relational queries on configs)
- `secrets` relations missing `provider` (breaks provider-scoped secret lookups)
- `Agent.get()` and `Agent.by()` crash when called without opts (undefined access)
- `database()` factory ignores custom config for Pool connection
- No database disconnect capability (scripts hang, no graceful shutdown)
- Invitation relations have 3 `one(users)` without `relationName` (Drizzle ambiguity)

---

## Critical Bugs

### CRIT-01: `Base.by()` Inverted Property Extraction

**File**: `src/services/base.ts:72-76`
**Impact**: All `service.by({ fieldName: value })` calls silently query the wrong column

```typescript
// CURRENT (BROKEN):
property = prop[Object.keys(prop)[0]]  // Gets VALUE, not KEY
value = prop[property]                  // property is already a value

// Example: by({ orgId: "abc123" })
// property = "abc123" (should be "orgId")
// value = prop["abc123"] = undefined
// Query: eq(table["abc123"], undefined) → FAILS
```

**Fix**: `property = Object.keys(prop)[0]`

---

### CRIT-02: `users.banExpires` Column Name Collision

**File**: `src/schemas/users.ts:23-24`
**Impact**: User ban system completely broken; potential data corruption

```typescript
banReason: text(`banReason`),        // Line 23: maps to "banReason"
banExpires: timestamp(`banReason`),  // Line 24: ALSO maps to "banReason" ← BUG
```

Both fields map to the same DB column. `banExpires` never reads/writes the actual `ban_expires` column.

**Fix**: Change line 24 to `timestamp(\`ban_expires\`)`

---

### CRIT-03: `configs` Schema Missing Relations

**File**: `src/schemas/configs.ts`
**Impact**: All relational queries on configs fail; `db.query.configs.findFirst({ with: {...} })` broken

The configs schema defines the table and exclusive arc constraint but exports no `configsRelations`. Every other schema has relations defined.

**Fix**: Add:
```typescript
export const configsRelations = relations(configs, ({ one }) => ({
  user: one(users, { fields: [configs.userId], references: [users.id] }),
  org: one(orgs, { fields: [configs.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [configs.projectId], references: [projects.id] }),
}))
```

---

### CRIT-04: `secrets` Relations Missing `provider`

**File**: `src/schemas/secrets.ts:39-43`
**Impact**: `db.query.secrets.findFirst({ with: { provider: true } })` fails

```typescript
// CURRENT: Missing provider relation
export const secretsRelations = relations(secrets, ({ one }) => ({
  org: one(orgs, ...),
  project: one(projects, ...),
  agent: one(agents, ...),
  // MISSING: provider: one(providers, ...)
}))
```

The schema has `providerId` FK and includes it in the exclusive arc, but the relation is not defined.

**Fix**: Add `provider: one(providers, { fields: [secrets.providerId], references: [providers.id] })`

---

### CRIT-05: `Agent.get()` and `Agent.by()` Crash on Missing opts

**File**: `src/services/agent.ts:108,130`
**Impact**: TypeError crash when called without options argument

```typescript
// Line 108: opts is optional (?) but opts.with accessed without null check
async get(id: string, opts?: TAgentQueryOpts) {
  const result = await super.get(id, { ...opts, with: this.with(opts.with) })
  //                                                          ^^^^ TypeError if opts is undefined
}

// Line 130: Same issue
const result = await super.by(data, { ...opts, with: this.with(opts.with) })
```

**Fix**: Use optional chaining: `opts?.with`

---

### CRIT-06: `database()` Config Parameter Ignored for Pool

**File**: `src/database.ts:20`
**Impact**: Custom database configurations silently ignored for actual connection

```typescript
export const database = (cfg: TDBConfig = config) => {
  if (!_database) {
    _database = drizzle({
      client: new Pool({ connectionString: config.url }),  // Uses module-level config, NOT cfg!
      //                                    ^^^^^^ should be cfg.url
    })
    _database.services = ... new Service({ db: _database, config: cfg })  // Uses cfg correctly
  }
}
```

Pool uses imported `config`, services use passed `cfg`. Split-brain configuration.

**Fix**: Change to `cfg.url` (or `cfg?.url || config.url`)

---

### CRIT-07: Quota `increment()` Allows Negative Amounts

**File**: `src/services/quota.ts:58`
**Impact**: Security vulnerability - quota bypass via negative amounts

```typescript
async increment(orgId, period, key, amount = 1) {
  // No validation that amount > 0
  // amount: -1000000 would subtract from quotas
  set: { [key]: sql`${column} + ${amount}` }
}
```

**Fix**: Add `if (amount <= 0) throw new Error('Quota increment amount must be positive')`

---

### CRIT-08: Invitation Relations Missing `relationName`

**File**: `src/schemas/invitations.ts:48-58`
**Impact**: Drizzle cannot disambiguate multiple `one(users)` relations; relational queries may fail or return wrong data

```typescript
export const invitationsRelations = relations(invitations, ({ one }) => ({
  user: one(users, { ... }),     // users relation #1
  inviter: one(users, { ... }),  // users relation #2 - AMBIGUOUS
  revoker: one(users, { ... }), // users relation #3 - AMBIGUOUS
}))
```

**Fix**: Add `relationName` to each user relation

---

## Schema Issues

### Missing Exclusive Arc Constraints

| ID | Table | Issue | Severity |
|----|-------|-------|----------|
| S-01 | `providers` | No CHECK constraint on `userId/orgId/projectId` - allows zero or multiple owners | HIGH |
| S-02 | `domains` | Comment says "Only one should be set" but no CHECK constraint on `orgId/projectId` | HIGH |
| S-03 | `apiKeys` | No constraint on `orgId/projectId` - allows zero or multiple owners | MEDIUM |

### Missing Unique Constraints

| ID | Table | Columns | Issue | Severity |
|----|-------|---------|-------|----------|
| S-04 | `roles` | `(userId, orgId)` | User can have duplicate roles in same org | HIGH |
| S-05 | `roles` | `(userId, projectId)` | User can have duplicate roles in same project | HIGH |
| S-06 | `projects` | `(orgId, name)` | Duplicate project names within same org | HIGH |
| S-07 | `endpoints` | `(projectId, path, method)` | Duplicate endpoints per project | HIGH |
| S-08 | `orgs` | `name` | Duplicate org names allowed | MEDIUM |

### Missing NOT NULL Constraints

| ID | Table | Column | Issue | Severity |
|----|-------|--------|-------|----------|
| S-09 | `quotas` | All counter columns | `.default(0)` but no `.notNull()` - can be set to NULL via UPDATE | MEDIUM |
| S-10 | `endpoints` | `path` | Endpoint without path is not routable | HIGH |
| S-11 | `timestamps` | `updatedAt` | Global: nullable in base, should be `.notNull()` | MEDIUM |

### Missing Indexes

| ID | Table | Column(s) | Impact | Severity |
|----|-------|-----------|--------|----------|
| S-12 | `projects` | `orgId` | Full table scan for "list projects by org" | MEDIUM |
| S-13 | `endpoints` | `projectId` | Full table scan for "list endpoints by project" | MEDIUM |
| S-14 | `functions` | `projectId`, `endpointId` | Full table scan for FK lookups | MEDIUM |
| S-15 | `roles` | `userId`, `orgId`, `projectId` | Full table scan for membership queries | MEDIUM |
| S-16 | `secrets` | `orgId`, `projectId`, `providerId`, `agentId` | Full table scan for scope lookups | MEDIUM |
| S-17 | `threads` | `userId` | Full table scan for "list threads by user" | MEDIUM |
| S-18 | `invitations` | `orgId`, `email`, `status` | Full table scan for invitation lookups | MEDIUM |

### Missing Cascade Behavior

| ID | Table | FK Column | Issue | Severity |
|----|-------|-----------|-------|----------|
| S-19 | `assets` | `providerId` | No `onDelete` specified - defaults to RESTRICT | HIGH |
| S-20 | `threads` | `configId` | No `onDelete` specified | HIGH |
| S-21 | `threads` | `providerId` | No `onDelete` specified | HIGH |
| S-22 | `subscriptions` | `userId` | No `onDelete` specified - orphaned subscriptions on user delete | MEDIUM |

### Naming / Consistency Issues

| ID | Issue | Severity |
|----|-------|----------|
| S-23 | `users` schema uses `{ mode: 'string' }` for timestamps; all other schemas use default Date mode | MEDIUM |
| S-24 | `subscriptions` has `{ mode: 'string' }` on period timestamps but not on base timestamps | MEDIUM |
| S-25 | `users.orgs` and `users.roles` both point to `many(roles)` - confusing naming | LOW |
| S-26 | `assets` exclusive arc excludes `providerId` but it's an FK - unclear ownership semantics | MEDIUM |

### Security: SSL Private Key Storage

| ID | Issue | Severity |
|----|-------|----------|
| S-27 | `domains.sslPrivateKey` stored as plaintext text - should be encrypted at rest | HIGH |

---

## Service Issues

### Base Service (`src/services/base.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-01 | 72-76 | `by()` method: property extraction inverted (see CRIT-01) | CRITICAL |
| SV-02 | 129-144 | `update()` does not auto-set `updatedAt` - stale timestamps | MEDIUM |
| SV-03 | 146-157 | `upsert()` includes `id` in SET clause on conflict (wasteful) | LOW |
| SV-04 | 140,160,173 | `update()`, `upsert()`, `delete()` pass potentially undefined `resp[0]` to `model()` | MEDIUM |
| SV-05 | 48-53 | Default `model()` logs error but returns raw data as wrong type (should throw) | MEDIUM |

### Agent Service (`src/services/agent.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-06 | 108 | `get()` crashes on undefined `opts` (see CRIT-05) | CRITICAL |
| SV-07 | 130 | `by()` crashes on undefined `opts` and uses wrong variable (`opts` vs `normalizedOpts`) | CRITICAL |
| SV-08 | 91 | `model()` assumes `data.projects` exists - crashes without relation loaded | HIGH |
| SV-09 | 57 | `with()` computes unused `proj` variable | LOW |
| SV-10 | 70-81 | `#relations()` has no error handling for failed inserts | MEDIUM |

### Quota Service (`src/services/quota.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-11 | 58 | `increment()` allows negative amounts (see CRIT-07) | CRITICAL |
| SV-12 | 41 | `getUsage()` passes potentially undefined data to `model()` | MEDIUM |
| SV-13 | 117 | `initializePeriod()` returns undefined model on conflict (onConflictDoNothing) | MEDIUM |

### Subscription Service (`src/services/subscription.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-14 | 33 | `findByUser()` passes potentially undefined data to `model()` | MEDIUM |
| SV-15 | 49 | `findByPolarId()` same issue | MEDIUM |
| SV-16 | 12-16 | Missing 4th generic parameter (Model type) - incorrect TypeScript hints | LOW |

### User Service (`src/services/user.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-17 | ~25 | `byEmail()` passes potentially undefined `result[0]` to `model()` | MEDIUM |

### Domain Service (`src/services/domain.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-18 | 200-202 | Production `console.log` debug code in `validate()` | LOW |
| SV-19 | 230-255 | `enableSSL()` and `disableSSL()` missing try-catch; inconsistent response pattern | MEDIUM |
| SV-20 | 260 | `delete()` overrides base to delete by domain name instead of ID - breaks contract | MEDIUM |

### Invitation Service (`src/services/invitation.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-21 | 118-167 | `accept()` and `revoke()` don't validate current invitation state | MEDIUM |

### Role Service (`src/services/role.ts`)

| ID | Line | Issue | Severity |
|----|------|-------|----------|
| SV-22 | 200-228 | `removeFromOrg()`/`removeFromProject()` always return true even if 0 rows deleted | MEDIUM |

---

## Type System Issues

| ID | File | Issue | Severity |
|----|------|-------|----------|
| T-01 | `schema.types.ts:76-81` | `TDBInvitationInsert` wrapped in `Partial<>` - makes required fields optional | MEDIUM |
| T-02 | `schema.types.ts:88-93` | `TDBApiKeyInsert` wrapped in `Partial<>` - same issue | MEDIUM |
| T-03 | `schema.types.ts:100-105` | `TDBDomainsInsert` wrapped in `Partial<>` - same issue | MEDIUM |
| T-04 | `schema.types.ts:182-185` | `TDBApiRes` not discriminated union - allows both data+error or neither | MEDIUM |
| T-05 | `tsconfig.json:16,21` | `noImplicitAny: false` and `strictNullChecks: false` - defeats type safety in DB layer | MEDIUM |

---

## Cross-Repo Mismatches

### DB Schema Has Field, Domain Model Missing It

| Entity | DB Field | Impact |
|--------|----------|--------|
| Secret | `agentId` | Agent-scoped secrets lose scope identity in domain model | CRITICAL |
| Subscription | `seats` | Seat count silently dropped | HIGH |

### Domain Model Has Field, DB Schema Missing It

| Entity | Domain Field | Impact |
|--------|-------------|--------|
| User | `first`, `last` | Computed from `name`, cannot persist back | HIGH |
| User | `provider` | Never persists | MEDIUM |
| Agent | `agentId` | Phantom field, never persists | MEDIUM |
| Thread | `orgId`, `projectId` | Phantom fields, never persist | HIGH |
| Message | `orgId`, `projectId` | Phantom fields, never persist | HIGH |

### Type/Shape Mismatches

| Entity | Field | DB Type | Domain Type | Impact |
|--------|-------|---------|-------------|--------|
| Function | `defaultArgs` | jsonb default `[]` (array) | `Record<string, any>` (object) | Type conflict | HIGH |
| Endpoint | `name`, `path`, `headers`, `options` | Nullable | Required | Runtime undefined where TS expects string | MEDIUM |
| Invitation | `userId`, `invitedBy`, `revokedAt`, `acceptedAt`, `revokedBy` | Nullable | Required (no `?`) | Runtime null where TS expects string | MEDIUM |
| Domain | `verifiedAt` | Nullable | Required (no `?`) | Runtime null where TS expects string | LOW |

---

## Infrastructure Issues

### Database Factory (`src/database.ts`)

| ID | Issue | Severity |
|----|-------|----------|
| INF-01 | Config parameter ignored for Pool (see CRIT-06) | CRITICAL |
| INF-02 | Pool reference lost - no way to close connections | HIGH |
| INF-03 | No `disconnect()`/`close()` export - scripts hang, no graceful shutdown | HIGH |
| INF-04 | No Pool configuration (max connections, timeouts, SSL) | MEDIUM |
| INF-05 | Singleton prevents reconfiguration (no reset for testing) | MEDIUM |

### Migration State

| ID | Issue | Severity |
|----|-------|----------|
| INF-06 | Migration snapshot contains only 1 table (`users`) - 17+ tables missing | HIGH |
| INF-07 | Zero `.sql` migration files exist | HIGH |
| INF-08 | Schema managed via `push` only - no rollback capability | HIGH |
| INF-09 | `drizzle.config.ts` missing `proto` parameter in `buildDBUrl()` call | MEDIUM |

### Configuration

| ID | Issue | Severity |
|----|-------|----------|
| INF-10 | `db.config.ts` no validation that required env vars exist | MEDIUM |
| INF-11 | `getDialect()` can return undefined despite typed as `TDBDialect` | HIGH |

### Scripts

| ID | Issue | Severity |
|----|-------|----------|
| INF-12 | `seed.ts` and `purge.ts` never exit (Pool keeps event loop alive) | MEDIUM |
| INF-13 | `script.ts` is empty placeholder (`export {}`) | LOW |

### Package/Build

| ID | Issue | Severity |
|----|-------|----------|
| INF-14 | `package.json` main: `index.js` but only `index.ts` exists | LOW |
| INF-15 | No build script | LOW |
| INF-16 | Barrel exports incomplete (`utils/index.ts` only exports `crypto`) | LOW |

---

## Security Concerns

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| SEC-01 | Quota bypass via negative `increment()` amounts | `quota.ts:58` | CRITICAL |
| SEC-02 | SSL private keys stored as plaintext | `domains.ts:26` | HIGH |
| SEC-03 | `users.email` has no unique constraint - duplicate emails possible | `users.ts:19` | MEDIUM |
| SEC-04 | Roles table allows duplicate user-org assignments - ambiguous permissions | `roles.ts:8-29` | HIGH |

---

## Test Coverage

### Current State: ~0%

| Area | Test Files | Tests | Coverage |
|------|-----------|-------|----------|
| Schemas | 0 | 0 | 0% |
| Services | 0 | 0 | 0% |
| Database factory | 0 | 0 | 0% |
| Utilities | 1 (placeholder) | 1 (fake) | 0% |
| **Total** | **1** | **1** | **~0%** |

The only test file is `src/utils/database/getDialect.test.ts`:
```typescript
it(`should get the correct database dialect`, () => {
  // TODO: add real test
  expect(true).toBe(true)  // Always passes, tests nothing
})
```

---

## Fix Plan

### Priority 1: Critical Bugs (Fix Immediately)

These must be fixed before any other work - they cause runtime crashes or data corruption.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | `Base.by()` inverted property | `services/base.ts:72` | Change `prop[Object.keys(prop)[0]]` to `Object.keys(prop)[0]` |
| 2 | `banExpires` column name | `schemas/users.ts:24` | Change `banReason` to `ban_expires` |
| 3 | `configs` missing relations | `schemas/configs.ts` | Add `configsRelations` export |
| 4 | `secrets` missing provider relation | `schemas/secrets.ts:39-43` | Add `provider: one(providers, ...)` |
| 5 | `Agent.get()` crash | `services/agent.ts:108` | Change `opts.with` to `opts?.with` |
| 6 | `Agent.by()` crash + wrong var | `services/agent.ts:128-130` | Use `opts?.with` and use `normalizedOpts` |
| 7 | `database()` config ignored | `database.ts:20` | Change `config.url` to `cfg.url` |
| 8 | Quota negative bypass | `services/quota.ts:58` | Add `amount > 0` validation |

### Priority 2: Data Integrity (Fix Before Deployment)

| # | Issue | Fix |
|---|-------|-----|
| 9 | Add `providers` exclusive arc constraint | Add CHECK on `userId/orgId/projectId` |
| 10 | Add `domains` exclusive arc constraint | Add CHECK on `orgId/projectId` |
| 11 | Add `roles` unique constraint | Add unique on `(userId, orgId)` and `(userId, projectId)` |
| 12 | Add `projects` unique constraint | Add unique on `(orgId, name)` |
| 13 | Add `endpoints.path` NOT NULL | Change to `.notNull()` |
| 14 | Add `invitation` relation names | Add `relationName` to all 3 `one(users)` |
| 15 | Add missing `onDelete: cascade` | `assets.providerId`, `threads.configId`, `threads.providerId`, `subscriptions.userId` |
| 16 | Add database disconnect capability | Store Pool ref, export `disconnectDatabase()` |
| 17 | Fix `Agent.model()` undefined projects | Guard with `(data.projects || []).map(...)` |

### Priority 3: Cross-Repo Alignment

| # | Issue | Fix |
|---|-------|-----|
| 18 | Secret model missing `agentId` | Add `agentId?: string` to domain `Secret` model |
| 19 | Subscription model missing `seats` | Add `seats: number = 0` to domain `Subscription` model |
| 20 | Thread model has phantom `orgId/projectId` | Either add to DB schema or remove from domain |
| 21 | Message model has phantom `orgId/projectId` | Either add to DB schema or remove from domain |
| 22 | Function `defaultArgs` type mismatch | Align DB default with domain type (both should be `{}` or both `[]`) |

### Priority 4: Service Robustness

| # | Issue | Fix |
|---|-------|-----|
| 23 | Base `update()` auto-set `updatedAt` | Add `updatedAt: new Date()` to set clause |
| 24 | Null check before `model()` in `update/delete/upsert` | Return error if `resp[0]` is undefined |
| 25 | Null check in `findByUser/findByPolarId/getUsage` | Return error if data is undefined |
| 26 | `invitation.accept()` validate state | Check status is `pending` before accepting |
| 27 | Remove `console.log` from `domain.validate()` | Use logger or remove |
| 28 | `getDialect()` return undefined | Add fallback or throw |
| 29 | Fix `Partial<>` on Insert types | Remove `Partial<>` wrapper on `TDBInvitationInsert`, `TDBApiKeyInsert`, `TDBDomainsInsert` |

### Priority 5: Performance & Indexes

| # | Issue | Fix |
|---|-------|-----|
| 30 | Add index on `projects.orgId` | Schema change |
| 31 | Add index on `roles.userId, orgId, projectId` | Schema change |
| 32 | Add index on `secrets` arc columns | Schema change |
| 33 | Add index on `threads.userId` | Schema change |
| 34 | Add index on `invitations.orgId, email, status` | Schema change |
| 35 | Add index on `endpoints.projectId` | Schema change |

### Priority 6: Infrastructure

| # | Issue | Fix |
|---|-------|-----|
| 36 | Generate proper migration files | Run `drizzle-kit generate` |
| 37 | Fix `drizzle.config.ts` missing proto | Add `proto: TDSK_DB_PROTO` |
| 38 | Add db.config.ts env validation | Throw on missing required vars |
| 39 | Fix seed.ts/purge.ts exit | Call `process.exit()` after completion |
| 40 | Complete barrel exports | Fix `utils/index.ts` and sub-barrel files |

---

## Test Plan

### Strategy

Tests should use **Drizzle's mock/test utilities** or a **test database** for integration tests. Unit tests should mock the DB layer.

### Phase 1: Unit Tests (No DB Required)

#### 1.1 Utility Tests
```
src/utils/database/getDialect.test.ts     - Replace placeholder with real tests
src/utils/database/buildDBUrl.test.ts      - Test URL construction
src/utils/database/buildQuery.test.ts      - Test WHERE/ORDER BY construction
src/utils/error/error.test.ts              - Test error classes
src/utils/schema/base.test.ts              - Test base schema fields
```

**Test cases for `getDialect`**:
- Valid dialect returns correct value
- Proto fallback works
- Both missing returns default or throws
- All enum values map correctly

**Test cases for `buildDBUrl`**:
- Full URL passed through
- Parts assembled correctly
- Protocol normalization
- Missing parts handled

**Test cases for `buildQuery`**:
- `addWhere` with single value filter
- `addWhere` with array (IN) filter
- `addWhere` with null/undefined skipped
- `addWhere` with invalid column silently skipped (or errors)
- `addOrderBy` with valid column
- `addOrderBy` with invalid column returns undefined
- `addOrderBy` with missing opts.orderBy

**Test cases for error classes**:
- `DBError.throw()` throws with default message
- `DBError.throw('custom')` throws with custom message
- `DBIdError` has correct default message
- `DBValueError` constructs correct message with method name

#### 1.2 Database Factory Tests
```
src/database.test.ts                       - Test singleton, service init
```

**Test cases**:
- Returns same instance (singleton)
- Services are initialized with correct schemas
- Custom config is passed to Pool (after fix)
- Services have correct names
- `disconnect()` closes pool (after fix)

### Phase 2: Service Tests (Mock DB)

Each service should have a co-located test file: `src/services/<name>.test.ts`

#### 2.1 Base Service Tests
```
src/services/base.test.ts
```

**Test cases**:
- `create()` inserts and returns model
- `create()` catches and returns error
- `get()` by ID returns model
- `get()` with missing ID returns error
- `by()` with string prop+value
- `by()` with object `{ field: value }` (validates CRIT-01 fix)
- `by()` with object + opts
- `by()` with missing value returns error
- `list()` with empty opts returns all
- `list()` with where filter
- `list()` with limit/offset
- `list()` with orderBy
- `update()` sets updatedAt (after fix)
- `update()` with missing id throws
- `update()` with non-existent id returns error
- `upsert()` inserts new record
- `upsert()` updates existing record
- `delete()` removes and returns model
- `delete()` with non-existent id returns error

#### 2.2 Specific Service Tests

**Agent**: `src/services/agent.test.ts`
- `get()` without opts doesn't crash (validates CRIT-05 fix)
- `by()` without opts doesn't crash
- `model()` with undefined projects doesn't crash
- `create()` with projects creates associations
- `update()` replaces project associations
- `#relations()` handles empty/null projects

**Quota**: `src/services/quota.test.ts`
- `increment()` with positive amount succeeds
- `increment()` with negative amount throws (validates CRIT-07 fix)
- `increment()` with 0 throws
- `getUsage()` with missing data returns error
- `initializePeriod()` on conflict returns error/existing
- `findByOrgAndPeriod()` delegates to getUsage

**Subscription**: `src/services/subscription.test.ts`
- `findByUser()` with valid user returns model
- `findByUser()` with missing user returns error
- `findByPolarId()` with valid id returns model
- `findByPolarId()` with missing id returns error

**Role**: `src/services/role.test.ts`
- `getOrgRole()` returns correct role
- `getOrgOwner()` returns owner or undefined
- `removeFromOrg()` returns true/false based on rows deleted
- `getUserOrgs()` returns org IDs
- `isOrgMember()` returns boolean

**Invitation**: `src/services/invitation.test.ts`
- `accept()` validates pending status (after fix)
- `accept()` rejects expired invitations
- `revoke()` validates pending status
- `getByToken()` returns invitation or null
- `markExpired()` marks only pending+expired
- `isValid()` checks status and expiration

**Domain**: `src/services/domain.test.ts`
- `validate()` returns boolean (no console.log after fix)
- `delete()` by domain name works
- `enableSSL()` has try-catch (after fix)
- `find()` checks certificate validity (90-day window)

### Phase 3: Schema Validation Tests

```
src/schemas/schemas.test.ts                - Validate all schemas
```

**Test cases**:
- All schemas export table and relations
- Exclusive arc constraints exist on: secrets, configs, roles, assets
- Required fields have `.notNull()`
- FK references use `onDelete: 'cascade'`
- Base fields (id, createdAt, updatedAt) present on all tables
- Unique constraints exist where expected

### Phase 4: Integration Tests (Test DB)

```
src/integration/crud.test.ts               - End-to-end CRUD operations
src/integration/constraints.test.ts        - DB constraint validation
src/integration/cascade.test.ts            - Cascade deletion behavior
```

**Prerequisites**: Test database setup/teardown in `vitest.config.ts`

**Test cases**:
- Create org → create project → create endpoint → cascade delete org removes all
- Exclusive arc: insert secret with 0 owners fails
- Exclusive arc: insert secret with 2 owners fails
- Exclusive arc: insert secret with 1 owner succeeds
- Unique constraint: duplicate `(userId, orgId)` in roles rejected
- Quota increment: concurrent increments are atomic
- Quota increment: negative amount rejected

### Estimated Coverage Target

| Area | Target Coverage |
|------|----------------|
| Utilities | 90% |
| Base Service | 95% |
| Specific Services | 80% |
| Schema validation | 100% (structural) |
| Database factory | 85% |
| Integration | Key paths only |
| **Overall** | **~75-80%** |

---

## Appendix: Files Audited

### Schemas (18 files)
- `src/schemas/orgs.ts`
- `src/schemas/users.ts`
- `src/schemas/projects.ts`
- `src/schemas/roles.ts`
- `src/schemas/apiKeys.ts`
- `src/schemas/secrets.ts`
- `src/schemas/endpoints.ts`
- `src/schemas/functions.ts`
- `src/schemas/configs.ts`
- `src/schemas/providers.ts`
- `src/schemas/threads.ts`
- `src/schemas/messages.ts`
- `src/schemas/assets.ts`
- `src/schemas/quotas.ts`
- `src/schemas/subscriptions.ts`
- `src/schemas/agents.ts`
- `src/schemas/agentProjects.ts`
- `src/schemas/invitations.ts`
- `src/schemas/domains.ts`
- `src/schemas/certificates.ts`
- `src/schemas/schemas.ts` (export barrel)

### Services (18 files)
- `src/services/base.ts`
- `src/services/org.ts`
- `src/services/user.ts`
- `src/services/project.ts`
- `src/services/role.ts`
- `src/services/apiKey.ts`
- `src/services/secret.ts`
- `src/services/endpoint.ts`
- `src/services/function.ts`
- `src/services/config.ts`
- `src/services/provider.ts`
- `src/services/thread.ts`
- `src/services/message.ts`
- `src/services/asset.ts`
- `src/services/quota.ts`
- `src/services/subscription.ts`
- `src/services/agent.ts`
- `src/services/invitation.ts`
- `src/services/domain.ts`
- `src/services/index.ts` (export barrel)

### Types (4 files)
- `src/types/schema.types.ts`
- `src/types/db.types.ts`
- `src/types/helper.types.ts`
- `src/types/service.types.ts`
- `src/types/index.ts`

### Utilities (7 files)
- `src/utils/schema/base.ts`
- `src/utils/schema/timestamps.ts`
- `src/utils/database/buildDBUrl.ts`
- `src/utils/database/buildQuery.ts`
- `src/utils/database/getDialect.ts`
- `src/utils/database/getDialect.test.ts`
- `src/utils/error/error.ts`

### Infrastructure (10 files)
- `src/database.ts`
- `src/index.ts`
- `index.ts`
- `configs/db.config.ts`
- `configs/drizzle.config.ts`
- `configs/vitest.config.ts`
- `configs/aliases.ts`
- `scripts/addToProcess.ts`
- `scripts/loadEnvs.ts`
- `scripts/script.ts`
- `scripts/seed.ts`
- `scripts/purge.ts`
- `package.json`
- `tsconfig.json`

### Cross-repo (18 domain models compared)
- `repos/domain/src/models/user.ts`
- `repos/domain/src/models/organization.ts`
- `repos/domain/src/models/project.ts`
- `repos/domain/src/models/endpoint.ts`
- `repos/domain/src/models/function.ts`
- `repos/domain/src/models/secret.ts`
- `repos/domain/src/models/provider.ts`
- `repos/domain/src/models/config.ts`
- `repos/domain/src/models/thread.ts`
- `repos/domain/src/models/message.ts`
- `repos/domain/src/models/asset.ts`
- `repos/domain/src/models/role.ts`
- `repos/domain/src/models/apiKey.ts`
- `repos/domain/src/models/quota.ts`
- `repos/domain/src/models/subscription.ts`
- `repos/domain/src/models/agent.ts`
- `repos/domain/src/models/invitation.ts`
- `repos/domain/src/models/domain.ts`

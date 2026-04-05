---
name: "tdsk-database"
description: "Knowledge base for the database ORM & migrations repo"
tags: ["drizzle", "postgresql", "orm", "migrations", "database", "neon", "quotas", "subscriptions", "agents", "domains", "invitations"]
---
# Database Repo Skill

## Overview

The `repos/database` repository provides the **ORM layer and migration system** for the Threaded Stack platform. Built on **Drizzle ORM** and **PostgreSQL (Neon.com)**, it defines all database schemas, relationships, and provides a service-based API for database operations across all other repos.

**Key Responsibilities:**
- Define database schemas with Drizzle ORM (21 Drizzle-managed tables + 2 external)
- Provide type-safe database services (18 services with CRUD operations)
- Implement polymorphic relationships via "Exclusive Arc" pattern
- Handle database connection pooling via pg.Pool singleton
- Convert database records to domain models (Organization, Agent, Domain, etc.)
- Manage AI agent configurations with many-to-many project, function, and provider associations
- Handle custom domain management with SSL certificate storage
- Track organization invitations with status workflows

**Path Alias:** `@TDB/*`

## Directory Structure

```
repos/database/
├── configs/               # db.config.ts, drizzle.config.ts, vitest.config.ts, aliases.ts, biome.json
├── drizzle/               # Generated migrations (meta/ + *.sql)
├── scripts/               # seed.ts, purge.ts, script.ts, addToProcess.ts, addProviderSecretFk.ts
├── src/
│   ├── index.ts           # Main export (types + database)
│   ├── database.ts        # Database singleton factory + disconnectDatabase
│   ├── constants/         # DefDBProto constant
│   ├── schemas/           # 23 Drizzle table schemas (see Schema Overview)
│   ├── seeds/             # ids.seed.ts, fullorg.ts
│   ├── services/          # 17 service classes + base + tests
│   ├── types/             # db.types.ts, schema.types.ts, helper.types.ts, service.types.ts
│   └── utils/             # crypto.ts, logger.ts, database/, error/, schema/
├── index.ts               # Root re-export
├── package.json
└── tsconfig.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/database.ts` | Singleton database factory with Pool management + `disconnectDatabase()` |
| `src/schemas/schemas.ts` | Barrel for 19 Drizzle-managed tables (excludes users, certificates) |
| `src/schemas/index.ts` | Full barrel: schemas.ts + users + certificates |
| `src/services/base.ts` | `Base<TTable, S, I, M>` class with CRUD, `model()`, `with()` |
| `src/services/index.ts` | 17 named service exports |
| `src/types/schema.types.ts` | TDB*Select/Insert types via `$inferSelect`/`$inferInsert` |
| `src/types/db.types.ts` | TDatabase (NodePgDatabase + services), TDBConfig, TDBServices |
| `src/utils/crypto.ts` | `encryptSecret()` using domain's HKDF + AES-256-GCM |
| `configs/db.config.ts` | Connection config from env vars |

## Schema Overview

### Tables (23 total)

**21 Drizzle-managed tables** (defined in `schemas.ts`):
`orgs`, `roles`, `quotas`, `agents`, `agentProjects`, `agentFunctions`, `agentProviders`, `assets`, `threads`, `domains`, `secrets`, `apiKeys`, `messages`, `projects`, `functions`, `providers`, `endpoints`, `invitations`, `subscriptions`, `sandboxes`, `invoices`

**2 External tables** (read-only, not in Drizzle migrations):
- **`users`** -- Neon Auth managed, `pgSchema('neon_auth')`, table name `user`
- **`certificates`** (`caddy_certmagic_objects`) -- Caddy certmagic storage plugin

**3 Junction tables** (Drizzle-managed):
- **`agentProjects`** (`agent_projects`) -- Many-to-many agents-projects
- **`agentFunctions`** (`agent_functions`) -- Many-to-many agents-functions
- **`agentProviders`** (`agent_providers`) -- Many-to-many agents-providers (with priority ordering)

---

### Table Field Reference

#### `organizations` (variable: `orgs`)

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| description | text | nullable |
| ownerId | uuid FK->users | notNull, indexed |

Relations: owner(user), users(via roles), quotas, assets, agents, secrets, projects, providers, invitations

#### `users` (Neon Auth, pgSchema `neon_auth`, table `user`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | Neon-managed |
| name, email, image, role | text | nullable |
| banned | boolean | nullable |
| banReason, banExpires | text/timestamp | nullable |
| emailVerified | boolean | nullable |
| createdAt, updatedAt | timestamp | notNull |

Relations: orgs(via roles), roles, assets, threads, providers, subscription. **External**: Not managed by Drizzle migrations.

#### `roles`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | nullable |
| type | text | notNull |
| userId | uuid FK->users | notNull |
| orgId | uuid FK->orgs | exclusive arc with projectId |
| projectId | uuid FK->projects | exclusive arc with orgId |

Constraint: `orgId XOR projectId`. Unique indexes: `(userId, orgId)`, `(userId, projectId)`.

#### `invitations`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| email | text | notNull |
| userId | uuid FK->users | nullable (invitee) |
| roleType | text | notNull |
| orgId | uuid FK->orgs | notNull |
| invitedBy | uuid FK->users | onDelete set null |
| token | text | notNull, unique |
| status | text | notNull, default 'pending' (pending/accepted/expired/revoked) |
| expiresAt | timestamp | notNull |
| acceptedAt, revokedAt | timestamp | nullable |
| revokedBy | uuid FK->users | onDelete set null |

Indexes: `orgId`, `email`, `status`. Relations: org, user(invitee), inviter, revoker (3 separate user relations via `relationName`).

#### `agents`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| description | text | nullable |
| orgId | uuid FK->orgs | notNull |
| systemPrompt | text | nullable |
| model | text | nullable |
| maxTokens | integer | default 100000 |
| tools | jsonb | default [], typed string[] |
| envVars | jsonb | default {}, typed Record<string, string> |
| environment | jsonb | default {}, typed { timeout?, memory?, streaming?, ... } |
| active | boolean | default true |

Relations: org, secrets(many), threads(many), projects(many via agentProjects), functions(many via agentFunctions), providers(many via agentProviders). **No direct provider FK** -- uses junction table.

#### Junction Tables: `agentProjects`, `agentFunctions`, `agentProviders`

All have base fields + unique constraint on `(agentId, <entityId>)`:
- **`agentProjects`**: `agentId`, `projectId`, `alias`(nullable)
- **`agentFunctions`**: `agentId`(cascade), `functionId`(cascade)
- **`agentProviders`**: `agentId`(cascade), `providerId`(cascade), `priority`(integer default 0). Index: `(agentId, priority)`.

#### `threads`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | nullable |
| meta | jsonb | nullable |
| public | boolean | default false |
| parentThreadId | uuid self-ref | nullable (branching) |
| branchMessageId | uuid FK->messages | nullable (branching) |
| providerId | uuid FK->providers | onDelete set null |
| agentId | uuid FK->agents | onDelete set null |
| orgId | uuid FK->orgs | onDelete cascade |
| projectId | uuid FK->projects | onDelete cascade |
| userId | uuid FK->users | notNull, onDelete cascade |

Indexes: `userId`, `agentId`, `parentThreadId`. Supports thread branching via `parentThreadId` + `branchMessageId`.

#### `messages`

Base fields + `meta`(jsonb), `type`(notNull), `content`(jsonb notNull), `orgId`(FK), `projectId`(FK), `threadId`(notNull FK->threads).

#### `projects`

Base fields + `meta`(jsonb), `gitUrl`, `name`(notNull), `description`, `branch`(default 'main'), `orgId`(notNull FK->orgs, cascade). Unique: `(orgId, name)`.

#### `endpoints`

Base fields + `name`, `headers`(jsonb), `options`(jsonb), `path`(notNull), `public`(default false), `method`(varchar 10 default 'GET'), `type`(varchar 10 notNull default 'proxy'), `projectId`(notNull FK->projects). Unique: `(projectId, path, method)`.

#### `functions`

Base fields + `name`(notNull), `description`, `content`(text notNull), `branch`(default 'main'), `defaultArgs`(jsonb {}), `dependencies`(jsonb {}), `inputSchema`(jsonb [] typed TFunctionParam[]), `language`(varchar 50 default typescript), `endpointId`(FK cascade), `projectId`(notNull FK cascade). Indexes: `projectId`, `endpointId`.

#### `providers` -- ORG-SCOPED ONLY

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | nullable |
| type | text | notNull, typed EProvider |
| brand | text | typed TProviderBrand |
| options, headers, bodyParams | jsonb | nullable (bodyParams column: `body_params`) |
| secretId | uuid | nullable |
| orgId | uuid FK->orgs | notNull, onDelete cascade |

**NOT an exclusive arc** -- only has `orgId` (required).

#### `secrets` -- 4-WAY ARC + COMBO

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| description | text | nullable |
| hashKey | text | notNull |
| encryptedValue | text | notNull |
| orgId | uuid FK->orgs | arc column |
| projectId | uuid FK->projects | arc column |
| providerId | uuid FK->providers | arc column |
| agentId | uuid FK->agents | arc column |

**5 valid scope combinations** (see Exclusive Arc section). Encryption: AES-256-GCM with HKDF.

#### `apiKeys` (`api_keys`)

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| expiresAt, lastUsedAt | timestamp | nullable |
| scopes | text | default 'read' (NOT jsonb) |
| active | boolean | default true |
| rateLimit | integer | default 100 |
| keyHash | text | notNull, unique |
| keyPrefix | varchar(12) | notNull |
| orgId | uuid FK->orgs | nullable |
| projectId | uuid FK->projects | nullable |
| userId | uuid FK->users | nullable |

Both `orgId` and `projectId` are optional (no exclusive arc constraint). Indexes: `orgId`, `keyHash`, `projectId`, `userId`.

#### `assets` -- 5-WAY EXCLUSIVE ARC

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| url | text | nullable |
| meta, content | jsonb | nullable |
| name | text | notNull |
| type | text | notNull |
| providerId | uuid FK->providers | onDelete set null, NOT part of arc |
| orgId | uuid FK->orgs | arc column |
| userId | uuid FK->users | arc column |
| threadId | uuid FK->threads | arc column |
| projectId | uuid FK->projects | arc column |
| messageId | uuid FK->messages | arc column |

Constraint: Exactly ONE of orgId/projectId/userId/threadId/messageId must be set.

#### `domains`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| domain | text | notNull, unique |
| verifiedAt, sslExpiresAt | timestamp | nullable |
| sslPrivateKey, sslCertificate | text | nullable |
| verified | boolean | notNull, default false |
| sslEnabled | boolean | notNull, default false |
| orgId | uuid FK->orgs | exclusive arc with projectId |
| projectId | uuid FK->projects | exclusive arc with orgId |

Unique index: `(orgId, domain)`.

#### `certificates` (`caddy_certmagic_objects`) -- EXTERNAL

Composite PK `(parent, name)`. Fields: `isFile`(boolean notNull), `value`(bytea), `modified`(timestamp notNull). Constraint: `(isFile=true AND value IS NOT NULL) OR (isFile=false AND value IS NULL)`. **External**: Managed by caddy-storage-postgresql plugin.

#### `quotas`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| orgId | uuid FK->orgs | notNull |
| period | text | notNull |
| price, retention, organizations, projects, members, endpoints, threads, messages, functionCalls, runtime, orgSecrets, projectSecrets | integer | all default(0) notNull |

Unique index: `(orgId, period)`. Column names: `function_calls`, `org_secrets`, `project_secrets`.

#### `subscriptions`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| userId | uuid FK->users | notNull, unique, onDelete cascade |
| tier | text | notNull, default 'free' |
| status | text | notNull, default 'active' |
| stripeCustomerId, stripeSubscriptionId, stripePriceId | text | nullable (Stripe integration) |
| currentPeriodStart, currentPeriodEnd | timestamp | nullable |
| cancelAtPeriodEnd | boolean | default false |
| seats | integer | default 1 |

One subscription per user (userId is unique).

#### `sandboxes`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| orgId | varchar(10) FK->orgs | notNull, onDelete cascade |
| userId | uuid FK->users | onDelete set null |
| projectId | varchar(10) FK->projects | onDelete cascade, nullable |
| config | jsonb | notNull, typed `TKubeSandboxConfig` |

Indexes: `orgId`, `(orgId, userId)`, `projectId`. Relations: org, user, project.

#### `invoices`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| stripeInvoiceId | text | notNull, unique |

Stripe invoice tracking for payment history.

## Architecture

### 3-Layer Architecture

```
┌──────────────────────────────────────┐
│  Consumer Repos (backend, proxy)    │  Import: database, types
│  db.services.org.create()           │
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│  Service Layer (src/services/)       │  17 services extending Base
│  - Base<TTable, S, I, M> class      │  CRUD + model conversion
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│  Schema Layer (src/schemas/)         │  23 table definitions + relations
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│  PostgreSQL (Neon.com)               │  Connection via pg.Pool
└──────────────────────────────────────┘
```

### Database Singleton Pattern

```typescript
// src/database.ts
let _pool: Pool | null = null
let _database: TDatabase | null = null

export const database = (cfg: TDBConfig = config) => {
  if (!_database) {
    // Neon calls users table 'user' -- remap for consistency
    const { users, orgs, ...rest } = schema
    _pool = new Pool({ connectionString: cfg.url })
    _database = drizzle({
      client: _pool,
      schema: { ...rest, user: users, organizations: orgs },
    }) as unknown as TDatabase

    // Auto-initialize all 17 services
    _database.services = Object.entries(DBservices).reduce((acc, [name, Service]) => {
      acc[name] = new Service({ db: _database, config: cfg })
      return acc
    }, {} as TDBServices)
  }
  return _database
}

export const disconnectDatabase = async () => {
  if (_pool) { await _pool.end(); _pool = null }
  _database = null
}
```

**Usage in other repos:**
```typescript
import { database, disconnectDatabase } from '@tdsk/database'

const db = database()
const { data, error } = await db.services.org.create({ name: 'My Org' })
await disconnectDatabase()  // Closes Pool, resets singleton
```

## Services (18 total)

Exported from `services/index.ts`:

| Export Name | Class | Schema | Domain Model | Notable Methods |
|-------------|-------|--------|-------------|-----------------|
| `org` | `Org` | `orgs` | `Organization` | base CRUD |
| `role` | `Role` | `roles` | `Role` | `getOrgRole`, `getProjectRole`, `getUserRoles`, `getOrgMembers`, `getOrgOwner`, `getProjectMembers`, `isOrgMember`, `isProjectMember`, `updateOrgRole`, `updateProjectRole`, `removeFromOrg`, `removeFromProject`, `getUserOrgs`, `getUserProjects` |
| `user` | `User` | `users` | `User` | `byEmail()`, `getByIds()` |
| `asset` | `Asset` | `assets` | `Asset` | `listByThread()`, `listByMessage()` |
| `quota` | `Quota` | `quotas` | `Quota` | `getUsage`, `findByOrgAndPeriod`, `increment` (atomic SQL), `initializePeriod` |
| `agent` | `Agent` | `agents` | `Agent` | Auto-loads relations, junction management (add/remove project/function/provider), `setProviders`, sanitization |
| `apiKey` | `ApiKey` | `apiKeys` | -- | base CRUD |
| `secret` | `Secret` | `secrets` | -- | base CRUD |
| `thread` | `Thread` | `threads` | `Thread` | `listByAgent`, `listByUser`, `getWithMessages`, `branchThread` |
| `project` | `Project` | `projects` | -- | base CRUD |
| `message` | `Message` | `messages` | `Message` | `listByThread()`, `createBatch()` |
| `endpoint` | `Endpoint` | `endpoints` | -- | base CRUD |
| `function` | `Function` | `functions` | `Function` | Auto-loads agents, `listByAgent()`, `setAgents()`, `addAgent()`, `removeAgent()` |
| `provider` | `Provider` | `providers` | -- | base CRUD |
| `domain` | `DomainService` | `domains` | `Domain` | `find` (cert check), `validate`, `verified`, `enableSSL`, `disableSSL`, `owner`, custom cert storage via DB transactions |
| `invitation` | `Invitation` | `invitations` | `Invitation` | `getByToken`, `getByEmailAndOrg`, `getPendingByOrg`, `getAllByOrg`, `getPendingByEmail`, `accept`, `revoke`, `markExpired`, `isValid` |
| `subscription` | `Subscription` | `subscriptions` | `Subscription` | `findByUser`, `findByStripeId`, `upsertByUser` |
| `sandbox` | `Sandbox` | `sandboxes` | `Sandbox` | `listByOrg(orgId)`, `listByProject(projectId)` |

### Base Service Class

```typescript
class Base<
  TTable extends TTableSchema,
  S extends TDBEntitySelect = TDBEntitySelect,
  I extends TDBEntityInsert = TDBEntityInsert,
  M extends BaseModel = BaseModel,
> implements IDBApi<M, I> {

  name: string       // camelCase table name
  title: string      // Capitalized singular table name
  table: TTable
  db: TDatabase
  config: Record<string, any>

  // Override in subclasses for domain model conversion
  model(data: S, ...args: any[]): M

  // Override in subclasses to configure default relation loading
  with<T extends TDBWithRecord>(opts: T): TDBWithRecord

  // CRUD methods -- all return Promise<TDBApiRes<M>> or Promise<TDBApiRes<M[]>>
  create(data: I): Promise<TDBApiRes<M>>
  get(id: string, opts?: Pick<TDBQueryOpts, 'with'>): Promise<TDBApiRes<M>>
  by(prop: string | Record<string, any>, value?, opts?): Promise<TDBApiRes<M>>
  list(opts?: TDBQueryOpts): Promise<TDBApiRes<M[]>>  // supports { where, limit, offset, orderBy, with }
  update(data: I): Promise<TDBApiRes<M>>               // auto-sets updatedAt
  upsert(data: I): Promise<TDBApiRes<M>>               // onConflictDoUpdate by id
  delete(id: string): Promise<TDBApiRes<M>>
}
```

**Return pattern**: All methods return `{ data, error }` -- never throw.

### Agent Service Details

The most complex service (425 lines). Auto-loads secrets, projects, functions, and providers via `with()` override. Sorts providers by priority. Sanitizes secrets by default (strips `encryptedValue`).

```typescript
// Extended insert type
type TAgentInsertOpts = TDBAgentInsert & {
  functionIds?: string[]
  providerIds?: string[]
  projects?: Array<Partial<ProjectModel>>
}
```

`create`/`update`/`upsert` handle agentProjects, agentFunctions, agentProviders junction tables automatically. Pass `opts.sanitize = false` to skip secret sanitization on reads.

### Quota Service: Atomic Increment

```typescript
increment(orgId, period, key: TIncrementKey, amount = 1)
// Uses INSERT ... ON CONFLICT DO UPDATE with SQL: column + amount
// TIncrementKey: 'members' | 'threads' | 'runtime' | 'messages' | 'projects' |
//   'endpoints' | 'orgSecrets' | 'organizations' | 'functionCalls' | 'projectSecrets'
```

### Thread Service: Branching

```typescript
branchThread(threadId, messageId, userId)
// Transaction: copies thread + messages up to branchpoint
// Sets parentThreadId and branchMessageId on new thread
```

### Invitation Service: Status Workflow

Status flow: `pending` -> `accepted` | `expired` | `revoked`. Methods `accept` and `revoke` validate `status=pending` first. `markExpired()` bulk-updates past-expiration pending invites.

## Exclusive Arc Pattern

**Polymorphic relationships** ensuring a record belongs to exactly ONE parent entity, enforced at the database level via CHECK constraints.

### Tables Using Exclusive Arc

| Table | Arc Columns | Constraint Style |
|-------|------------|------------------|
| `secrets` | orgId, projectId, providerId, agentId | 4-way + combo (orgId+providerId allowed) |
| `assets` | orgId, projectId, userId, threadId, messageId | 5-way strict (exactly one) |
| `roles` | orgId, projectId | 2-way strict (exactly one) |
| `domains` | orgId, projectId | 2-way strict (exactly one) |

### Secrets: 4-Way Arc + Combo

```sql
-- CHECK constraint: secret_scope_check
(org_id IS NOT NULL AND project_id IS NULL AND provider_id IS NULL AND agent_id IS NULL) OR
(org_id IS NULL AND project_id IS NOT NULL AND provider_id IS NULL AND agent_id IS NULL) OR
(org_id IS NULL AND project_id IS NULL AND provider_id IS NOT NULL AND agent_id IS NULL) OR
(org_id IS NULL AND project_id IS NULL AND provider_id IS NULL AND agent_id IS NOT NULL) OR
(org_id IS NOT NULL AND provider_id IS NOT NULL AND project_id IS NULL AND agent_id IS NULL)
```

### Assets: 5-Way Strict Arc

```sql
-- CHECK constraint: asset_owner_check
(
  (org_id IS NOT NULL)::int +
  (project_id IS NOT NULL)::int +
  (user_id IS NOT NULL)::int +
  (thread_id IS NOT NULL)::int +
  (message_id IS NOT NULL)::int
) = 1
```

**Note**: `assets.providerId` is NOT part of the arc -- it is an independent nullable FK (onDelete set null).

### Tables NOT Using Exclusive Arc

- **`providers`**: org-scoped only (`orgId` notNull, no other scope columns)
- **`apiKeys`**: both `orgId` and `projectId` are optional, no constraint enforcing exclusivity
- **`agents`**: org-scoped only (`orgId` notNull), providers associated via junction table

## Key Patterns

### Base Schema Pattern

```typescript
// src/utils/schema/base.ts
export const base = {
  id: uuid('id').defaultRandom().primaryKey(),
  ...timestamps,
}
// src/utils/schema/timestamps.ts
export const timestamps = {
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}
```

### Service Inheritance Pattern

```typescript
// Minimal service (e.g., org.ts)
export class Org extends Base<typeof orgs, TDBOrgSelect, TDBOrgInsert, OrgModel> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: orgs })
  }
  model = (data: TDBOrgSelect) => new OrgModel(data)
}
```

Services with custom behavior override `model()`, `with()`, `get()`, `list()`, etc.

### Type Inference Pattern

```typescript
// src/types/schema.types.ts
type TInferDates<T> = Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type TDBOrgSelect = TInferDates<typeof orgs.$inferSelect>
export type TDBOrgInsert = TInferDates<typeof orgs.$inferInsert>

// Special types with extra date fields
export type TDBApiKeySelect = TInferDateProps<
  typeof apiKeys.$inferSelect,
  'createdAt' | 'updatedAt' | 'expiresAt' | 'lastUsedAt'
>
```

### Schema Barrel Organization

Two-level barrel separates Drizzle-managed from external:

```typescript
// schemas/schemas.ts -- 19 Drizzle-managed tables only (used for migrations)
export { orgs, orgsRelations } from '@TDB/schemas/orgs'
// ... 18 more

// schemas/index.ts -- full export including external read-only tables
export * from '@TDB/schemas/schemas'
export { users, usersRelations } from '@TDB/schemas/users'
export { certificates, certificatesRelations } from '@TDB/schemas/certificates'
```

### Cascade Deletion Pattern

```typescript
// Hard delete: child deleted when parent is deleted
orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'cascade' })

// Soft unlink: FK set to null when parent is deleted
providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'set null' })
```

## Commands

### Drizzle Kit Commands

```bash
pnpm push                # Push schema to DB (INTERACTIVE -- requires manual confirmation)
pnpm generate            # Generate migration files from schema changes
pnpm migrate             # Apply pending migrations
pnpm introspect          # Introspect existing DB schema
pnpm studio              # Launch Drizzle Studio (visual DB browser)
pnpm check               # Check migration consistency
pnpm drop                # Drop a migration
pnpm export              # Export schema as SQL
pnpm dup                 # drizzle-kit up (update migration format)
pnpm dk <command>        # Direct drizzle-kit access
pnpm seed                # Run database seeder
pnpm purge               # Purge database data
pnpm script              # Run utility scripts with aliases
pnpm types               # TypeScript type checking (tsc --noEmit)
```

> **Note**: `pnpm push` runs `drizzle-kit push` which is interactive. Claude cannot run this automatically.

### Environment Variables

Required in `deploy/values.*.yml`:

| Variable | Purpose |
|----------|---------|
| `TDSK_DB_URL` | Full connection URL (preferred) |
| `TDSK_DB_NAME` | Database name |
| `TDSK_DB_USER` / `TDSK_DB_PASS` | Credentials |
| `TDSK_DB_PROTO` | Protocol (postgres/postgresql) |
| `TDSK_DB_DIALECT` / `TDSK_DB_TYPE` | Drizzle dialect |
| `TDSK_DB_LOG_LEVEL` / `TDSK_DB_LOG_LABEL` | Optional logging |

## Integration Points

### Export Surface

```typescript
// Main exports from @tdsk/database (src/index.ts)
export * from './types'      // All TypeScript types
export * from './database'   // database(), disconnectDatabase()
```

**Note**: Schemas and services are NOT directly exported from the package index. They are accessed via the `database()` singleton's `.services` property.

## Common Workflows

### Adding a New Table

1. Create schema file: `src/schemas/newtable.ts`
2. Add relations if needed
3. Export from `src/schemas/schemas.ts` (or `index.ts` if external)
4. Add types to `src/types/schema.types.ts`
5. Create service: `src/services/newtable.ts` extending `Base`
6. Export service from `src/services/index.ts`
7. Run `pnpm generate` to create migration
8. Ask user to run `pnpm push` (interactive)

### Modifying Existing Schema

1. Edit the schema file in `src/schemas/`
2. Update types in `src/types/schema.types.ts` if needed
3. Ask the user to sync the schema with the remote database via `pnpm push`

> **drizzle-kit push limitation**: Cannot modify existing CHECK constraints -- must drop+recreate via manual SQL. Known issue: GitHub drizzle-team/drizzle-kit-mirror#3520

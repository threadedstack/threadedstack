---
name: "tdsk-database"
description: "Knowledge base for the database ORM & migrations repo"
tags: ["drizzle", "postgresql", "orm", "migrations", "database", "neon", "quotas", "subscriptions", "agents", "domains", "invitations", "sandboxes", "skills", "schedules"]
---
# Database Repo Skill

## Overview

The `repos/database` repository provides the **ORM layer and migration system** for the Threaded Stack platform. Built on **Drizzle ORM** and **PostgreSQL (Neon.com)**, it defines all database schemas, relationships, and provides a service-based API for database operations across all other repos.

**Key Responsibilities:**
- Define database schemas with Drizzle ORM (25 Drizzle-managed tables + 2 external)
- Provide type-safe database services (20 services with CRUD operations)
- Implement polymorphic relationships via "Exclusive Arc" pattern
- Handle database connection pooling via pg.Pool singleton
- Convert database records to domain models (Organization, Agent, Domain, etc.)
- Manage AI agent configurations with many-to-many project, function, provider, and skill associations
- Handle custom domain management with SSL certificate storage
- Track organization invitations with status workflows
- Manage sandbox lifecycle with project and provider junction tables
- Support cron-based agent execution via schedules

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
│   ├── schemas/           # 27 Drizzle table schemas (see Schema Overview)
│   ├── seeds/             # ids.seed.ts, fullorg.ts
│   ├── services/          # 20 service classes + base + tests
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
| `src/schemas/schemas.ts` | Barrel for 25 Drizzle-managed tables (excludes users, certificates) |
| `src/schemas/index.ts` | Full barrel: schemas.ts + users + certificates |
| `src/services/base.ts` | `Base<TTable, S, I, M>` class with CRUD, `model()`, `with()` |
| `src/services/index.ts` | 20 named service exports |
| `src/types/schema.types.ts` | TDB*Select/Insert types via `$inferSelect`/`$inferInsert` |
| `src/types/db.types.ts` | TDatabase (NodePgDatabase + services), TDBConfig, TDBServices |
| `src/utils/crypto.ts` | `encryptSecret()` using domain's HKDF + AES-256-GCM |
| `configs/db.config.ts` | Connection config from env vars |

## Schema Overview

### Tables (27 total)

**25 Drizzle-managed tables** (defined in `schemas.ts`):
`orgs`, `roles`, `quotas`, `agents`, `agentProjects`, `agentFunctions`, `agentProviders`, `agentSkills`, `assets`, `threads`, `domains`, `secrets`, `apiKeys`, `messages`, `projects`, `functions`, `providers`, `endpoints`, `invitations`, `subscriptions`, `sandboxes`, `sandboxProjects`, `sandboxProviders`, `invoices`, `skills`, `schedules`

**2 External tables** (read-only, not in Drizzle migrations):
- **`users`** -- Neon Auth managed, `pgSchema('neon_auth')`, table name `user`
- **`certificates`** (`caddy_certmagic_objects`) -- Caddy certmagic storage plugin

**8 Junction tables** (Drizzle-managed):
- **`agentProjects`** (`agent_projects`) -- Many-to-many agents-projects with per-project overrides
- **`agentFunctions`** (`agent_functions`) -- Many-to-many agents-functions
- **`agentProviders`** (`agent_providers`) -- Many-to-many agents-providers (with priority ordering)
- **`agentSkills`** (`agent_skills`) -- Many-to-many agents-skills
- **`sandboxProjects`** (`sandbox_projects`) -- Many-to-many sandboxes-projects with per-project config
- **`sandboxProviders`** (`sandbox_providers`) -- Many-to-many sandboxes-providers with priority and model

---

### Table Field Reference

#### `organizations` (variable: `orgs`)

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| description | text | nullable |
| config | jsonb | nullable, typed `TOrgConfig` (guiConfig and other org-level settings) |
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
| orgId | varchar(10) FK->orgs | notNull, onDelete cascade |
| systemPrompt | text | nullable |
| model | text | nullable |
| maxTokens | integer | default 100000 |
| tools | jsonb | default [], typed string[] |
| envVars | jsonb | default {}, typed Record<string, string> |
| environment | jsonb | default {}, typed TAgentEnvironment |
| active | boolean | default true |

Relations: org, secrets(many), threads(many), projects(many via agentProjects), providers(many via agentProviders), skills(many via agentSkills), schedules(many). **No direct provider FK** -- uses junction table.

#### Junction Tables: `agentProjects`, `agentFunctions`, `agentProviders`, `agentSkills`

All have base fields + unique constraint on `(agentId, <entityId>)`:
- **`agentProjects`**: `agentId`(cascade), `projectId`(cascade), `alias`(nullable), `model`(nullable), `maxTokens`(nullable integer), `systemPrompt`(nullable), `tools`(jsonb nullable), `functionIds`(jsonb nullable), `envVars`(jsonb nullable), `environment`(jsonb nullable), `enabled`(boolean default true). Per-project overrides: NULL fields inherit from base agent config, non-null fields override.
- **`agentFunctions`**: `agentId`(cascade), `functionId`(cascade)
- **`agentProviders`**: `agentId`(cascade), `providerId`(cascade), `priority`(integer default 0). Index: `(agentId, priority)`.
- **`agentSkills`**: `agentId`(cascade), `skillId`(cascade). Unique: `(agentId, skillId)`.

#### `skills`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | notNull |
| description | text | notNull |
| instructions | text | notNull |
| triggerKeywords | jsonb | default [], typed string[] |
| tools | jsonb | default [], typed string[] |
| alwaysActive | boolean | notNull, default false |
| orgId | varchar(10) FK->orgs | notNull, onDelete cascade, indexed |

Relations: org, agents(many via agentSkills). Org-scoped AI skill definitions that can be linked to agents.

#### `schedules`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| agentId | varchar(10) FK->agents | notNull, onDelete cascade |
| orgId | varchar(10) FK->orgs | notNull, onDelete cascade |
| cronExpression | varchar(255) | notNull |
| prompt | text | notNull |
| enabled | boolean | notNull, default true |
| lastRunAt | timestamp | nullable |
| nextRunAt | timestamp | nullable |
| threadId | varchar(10) FK->threads | onDelete set null |
| createThread | boolean | notNull, default true |
| maxConsecutiveErrors | integer | notNull, default 5 |
| consecutiveErrors | integer | notNull, default 0 |

Indexes: `orgId`, `agentId`, `(enabled, nextRunAt)`. Relations: agent, org, thread. Cron-based agent execution with error tracking and auto-disable.

#### `threads`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| name | text | nullable |
| meta | jsonb | nullable |
| public | boolean | default false |
| parentThreadId | varchar(10) self-ref | nullable (branching) |
| branchMessageId | varchar(10) FK->messages | nullable (branching) |
| providerId | varchar(10) FK->providers | onDelete set null |
| agentId | varchar(10) FK->agents | onDelete set null |
| orgId | varchar(10) FK->orgs | onDelete cascade |
| projectId | varchar(10) FK->projects | onDelete cascade |
| userId | uuid FK->users | notNull, onDelete cascade |
| sandboxId | varchar(10) FK->sandboxes | onDelete set null |
| ptyBuffer | bytea (custom type) | nullable, stores terminal PTY ring buffer data |

Indexes: `userId`, `agentId`, `parentThreadId`, `orgId`, `projectId`, `sandboxId`. Supports thread branching via `parentThreadId` + `branchMessageId`.

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
| orgId | varchar(10) FK->orgs | nullable, onDelete cascade |
| projectId | varchar(10) FK->projects | nullable, onDelete cascade |
| userId | uuid FK->users | nullable, onDelete cascade |

CHECK constraint (`api_key_scope_check`): allows both NULL, orgId XOR projectId -- `(orgId IS NOT NULL AND projectId IS NULL) OR (orgId IS NULL AND projectId IS NOT NULL) OR (orgId IS NULL AND projectId IS NULL)`. Indexes: `orgId`, `keyHash`, `projectId`, `userId`.

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
| orgId | varchar(10) FK->orgs | notNull, onDelete cascade |
| period | text | notNull |
| projects | integer | default 0, notNull |
| compute | integer | default 0, notNull |
| threads | integer | default 0, notNull |
| messages | integer | default 0, notNull |
| endpoints | integer | default 0, notNull |
| secrets | integer | default 0, notNull |

Unique index: `(orgId, period)`. Six resource counters: projects, compute, threads, messages, endpoints, secrets.

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
| id | varchar(10) PK | Custom nanoid with lowercase alphabet (`0-9a-z`), prefixed with `SandboxIdPrefix` |
| createdAt, updatedAt | timestamps | standard |
| name | text | notNull |
| orgId | varchar(10) FK->orgs | notNull, onDelete cascade |
| userId | uuid FK->users | onDelete set null |
| config | jsonb | notNull, typed `TKubeSandboxConfig` (includes `runtime`, `runtimeCommand`, `initScript` fields) |
| builtIn | boolean | notNull, default false. True for presets seeded during org creation |

Custom ID generation: uses `customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 7)` from nanoid because sandbox IDs are used in SSH connections which enforce lowercase.

Indexes: `orgId`, `(orgId, userId)`. Relations: org, user, threads(many), projects(many via sandboxProjects), providers(many via sandboxProviders).

#### Junction Tables: `sandboxProjects`, `sandboxProviders`

- **`sandboxProjects`** (`sandbox_projects`): `sandboxId`(cascade), `projectId`(cascade), `alias`(nullable text), `enabled`(boolean default true), `config`(jsonb nullable, typed `Partial<TKubeSandboxConfig>`). Unique: `(sandboxId, projectId)`. Per-project config overrides -- NULL config inherits base sandbox config, non-null is deep-merged (project wins).
- **`sandboxProviders`** (`sandbox_providers`): `sandboxId`(cascade), `providerId`(restrict), `model`(nullable text), `priority`(integer default 0). Unique: `(sandboxId, providerId)`. Indexes: `sandboxId`, `(sandboxId, priority)`. Priority 0 = primary provider.

#### `invoices`

| Field | Type | Notes |
|-------|------|-------|
| id, createdAt, updatedAt | base | standard |
| userId | uuid FK->users | notNull, onDelete cascade |
| stripeInvoiceId | text | notNull, unique |
| amount | integer | notNull, default 0 |
| currency | text | notNull, default 'usd' |
| status | text | notNull |
| invoiceUrl | text | nullable |
| period | text | notNull |

Relations: user. Stripe invoice tracking for payment history with amount/currency/status details.

## Architecture

### 3-Layer Architecture

```
┌──────────────────────────────────────┐
│  Consumer Repos (backend, proxy)    │  Import: database, types
│  db.services.org.create()           │
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│  Service Layer (src/services/)       │  20 services extending Base
│  - Base<TTable, S, I, M> class      │  CRUD + model conversion
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│  Schema Layer (src/schemas/)         │  27 table definitions + relations
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

    // Auto-initialize all 20 services
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

## Services (20 total)

Exported from `services/index.ts`:

| Export Name | Class | Schema | Domain Model | Notable Methods |
|-------------|-------|--------|-------------|-----------------|
| `org` | `Org` | `orgs` | `Organization` | base CRUD |
| `role` | `Role` | `roles` | `Role` | `getOrgRole`, `getProjectRole`, `getUserRoles`, `getOrgMembers`, `getOrgOwner`, `getProjectMembers`, `isOrgMember`, `isProjectMember`, `updateOrgRole`, `updateProjectRole`, `removeFromOrg`, `removeFromProject`, `getUserOrgs`, `getUserProjects` |
| `user` | `User` | `users` | `User` | `byEmail()`, `getByIds()` |
| `asset` | `Asset` | `assets` | `Asset` | `listByThread()`, `listByMessage()` |
| `quota` | `Quota` | `quotas` | `Quota` | `getUsage`, `findByOrgAndPeriod`, `increment` (atomic SQL), `decrement` (atomic, floor 0), `initializePeriod` |
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
| `sandbox` | `Sandbox` | `sandboxes` | `Sandbox` | `listByOrg(orgId)`, `addProject`, `removeProject`, `upsertProjectConfig`, `getProjectConfig`, `addProvider`, `removeProvider`, `setProviders` |
| `skill` | `Skill` | `skills` | `Skill` | `addAgent(skillId, agentId)`, `listForAgent(agentId)`, `removeAgent(skillId, agentId)` |
| `schedule` | `Schedule` | `schedules` | `Schedule` | `listDue()`, `markRun(id, nextRunAt)`, `incrementErrors(id)` |
| `invoice` | `Invoice` | `invoices` | `Invoice` | `findByUserId(userId)`, `upsertByStripeId(stripeInvoiceId, data)` |

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

The most complex service (425 lines). Auto-loads secrets, projects, functions, providers, and skills via `with()` override. Sorts providers by priority. Sanitizes secrets by default (strips `encryptedValue`).

```typescript
// Extended insert type
type TAgentInsertOpts = TDBAgentInsert & {
  functionIds?: string[]
  providerIds?: string[]
  projects?: Array<Partial<ProjectModel>>
}
```

`create`/`update`/`upsert` handle agentProjects, agentFunctions, agentProviders junction tables automatically. Pass `opts.sanitize = false` to skip secret sanitization on reads.

### Sandbox Service Details

Auto-loads projects (via sandboxProjects with nested project) and providers (via sandboxProviders with nested provider) via `with()` override. Sorts providers by priority. The `model()` method maps junction data to `SandboxModel` with `projects`, `projectConfigs`, and `providerLinks` arrays.

Key methods:
- `addProject(sandboxId, projectId, alias?)` -- links sandbox to project
- `removeProject(sandboxId, projectId)` -- unlinks sandbox from project
- `upsertProjectConfig(sandboxId, projectId, config)` -- updates per-project overrides (alias, enabled, config)
- `getProjectConfig(sandboxId, projectId)` -- returns per-project config as `TSandboxProjectConfig`
- `addProvider(sandboxId, providerId, priority?, model?)` -- links provider with priority/model
- `removeProvider(sandboxId, providerId)` -- unlinks provider
- `setProviders(sandboxId, inputs)` -- atomic replace: deletes removed, upserts remaining (transactional)

### Skill Service Details

Manages org-scoped AI skill definitions and agent-skill associations via the `agentSkills` junction table.

Key methods:
- `addAgent(skillId, agentId)` -- links skill to agent (onConflictDoNothing)
- `listForAgent(agentId)` -- returns all skills for an agent (queries agentSkills with skill relation)
- `removeAgent(skillId, agentId)` -- unlinks skill from agent

### Schedule Service Details

Manages cron-based agent execution schedules with error tracking and auto-disable.

Key methods:
- `listDue()` -- finds all enabled schedules where `nextRunAt <= now`
- `markRun(id, nextRunAt)` -- updates `lastRunAt` to now, sets `nextRunAt`, resets `consecutiveErrors` to 0
- `incrementErrors(id)` -- atomically increments `consecutiveErrors`; auto-disables schedule when `consecutiveErrors >= maxConsecutiveErrors`

### Quota Service: Atomic Increment/Decrement

```typescript
increment(orgId, period, key: TIncrementKey, amount = 1)
// Uses INSERT ... ON CONFLICT DO UPDATE with SQL: column + amount
// TIncrementKey: 'projects' | 'compute' | 'threads' | 'messages' | 'endpoints' | 'secrets'

decrement(orgId, period, key: TIncrementKey, amount = 1)
// Uses GREATEST(column - amount, 0) to prevent negative values
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
- **`apiKeys`**: CHECK allows both NULL, orgId XOR projectId -- not a strict arc
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
// schemas/schemas.ts -- 25 Drizzle-managed tables only (used for migrations)
export { orgs, orgsRelations } from '@TDB/schemas/orgs'
// ... 24 more

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

// Restrict: prevent parent deletion while children exist
providerId: varchar('provider_id').references(() => providers.id, { onDelete: 'restrict' })
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

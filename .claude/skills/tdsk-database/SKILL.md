---
name: "tdsk-database"
description: "Knowledge base for the database ORM & migrations repo"
tags: ["drizzle", "postgresql", "orm", "migrations", "database", "neon", "quotas", "subscriptions", "agents", "domains", "invitations"]
---
# Database Repo Skill

## Overview

The `repos/database` repository provides the **ORM layer and migration system** for the Threaded Stack platform. Built on **Drizzle ORM** and **PostgreSQL (Neon.com)**, it defines all database schemas, relationships, and provides a service-based API for database operations across all other repos.

**Key Responsibilities:**
- Define database schemas with Drizzle ORM (19 Drizzle-managed tables + 2 external)
- Provide type-safe database services (17 services with CRUD operations)
- Implement polymorphic relationships via "Exclusive Arc" pattern
- Handle database connection pooling via pg.Pool singleton
- Convert database records to domain models (Organization, Agent, Domain, etc.)
- Manage AI agent configurations with many-to-many project, function, and provider associations
- Handle custom domain management with SSL certificate storage
- Track organization invitations with status workflows

**Database Provider:** Neon.com (PostgreSQL)
**ORM:** Drizzle ORM v0.45.1
**Package Version:** 0.1.0
**Path Alias:** `@TDB/*`

## Directory Structure

```
repos/database/
├── configs/               # Configuration files
│   ├── aliases.ts         # Path alias setup (alias-hq)
│   ├── biome.json         # Biome linter config
│   ├── db.config.ts       # Database connection config
│   ├── drizzle.config.ts  # Drizzle Kit configuration
│   └── vitest.config.ts   # Vitest test configuration
├── drizzle/               # Generated migrations
│   ├── meta/              # Migration metadata
│   └── *.sql              # Generated SQL migration files
├── scripts/               # Utility scripts
│   ├── addToProcess.ts    # Process environment helper
│   ├── addProviderSecretFk.ts  # Provider secret FK migration script
│   ├── seed.ts            # Database seeder
│   ├── purge.ts           # Database purge
│   └── script.ts          # General script runner
├── src/
│   ├── index.ts           # Main export (types + database)
│   ├── database.ts        # Database singleton factory + disconnectDatabase
│   ├── constants/
│   │   ├── index.ts
│   │   └── values.ts      # DefDBProto constant
│   ├── schemas/           # Drizzle table schemas (23 files)
│   │   ├── schemas.ts     # Drizzle-managed schema barrel (19 tables)
│   │   ├── index.ts       # Full schema barrel (schemas.ts + users + certificates)
│   │   ├── orgs.ts
│   │   ├── roles.ts
│   │   ├── users.ts           # External: Neon Auth managed (pgSchema 'neon_auth')
│   │   ├── agents.ts
│   │   ├── agentProjects.ts   # Junction: agent-project many-to-many
│   │   ├── agentFunctions.ts  # Junction: agent-function many-to-many
│   │   ├── agentProviders.ts  # Junction: agent-provider many-to-many (with priority)
│   │   ├── assets.ts
│   │   ├── apiKeys.ts
│   │   ├── certificates.ts   # External: Caddy certmagic storage
│   │   ├── domains.ts
│   │   ├── endpoints.ts
│   │   ├── functions.ts
│   │   ├── invitations.ts
│   │   ├── messages.ts
│   │   ├── projects.ts
│   │   ├── providers.ts
│   │   ├── quotas.ts
│   │   ├── secrets.ts
│   │   ├── subscriptions.ts
│   │   └── threads.ts
│   ├── seeds/             # 3 seed files
│   │   ├── index.ts
│   │   ├── ids.seed.ts
│   │   └── fullorg.ts
│   ├── services/          # 17 service classes + base + tests
│   │   ├── base.ts        # Base<TTable, S, I, M> class
│   │   ├── org.ts
│   │   ├── role.ts        # 14 specialized queries
│   │   ├── user.ts        # byEmail(), getByIds()
│   │   ├── agent.ts       # 425 lines, secrets+projects+functions+providers auto-loading
│   │   ├── apiKey.ts
│   │   ├── asset.ts       # listByThread(), listByMessage()
│   │   ├── domain.ts      # DomainService, 299 lines
│   │   ├── endpoint.ts
│   │   ├── function.ts    # listByAgent(), setAgents(), addAgent(), removeAgent()
│   │   ├── invitation.ts  # 243 lines, status workflow
│   │   ├── message.ts     # listByThread(), createBatch()
│   │   ├── project.ts
│   │   ├── provider.ts
│   │   ├── quota.ts       # Atomic SQL increment
│   │   ├── secret.ts
│   │   ├── subscription.ts # upsertByUser
│   │   ├── thread.ts      # branchThread, listByAgent/User
│   │   ├── index.ts       # Barrel: 17 named exports
│   │   ├── *.test.ts      # 8 test files
│   │   └── base.test.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── db.types.ts        # TDatabase, TDBServices, TDBConfig, EDBDialects
│   │   ├── schema.types.ts    # TDB*Select/Insert for all 18 entity types
│   │   ├── helper.types.ts
│   │   └── service.types.ts   # TServiceOpts
│   └── utils/
│       ├── index.ts
│       ├── crypto.ts          # encryptSecret() helper
│       ├── logger.ts          # buildApiLogger wrapper
│       ├── database/
│       │   ├── buildDBUrl.ts
│       │   ├── buildDBUrl.test.ts
│       │   ├── buildQuery.ts      # addWhere(), addOrderBy()
│       │   ├── buildQuery.test.ts
│       │   ├── getDialect.ts
│       │   └── getDialect.test.ts
│       ├── error/
│       │   ├── error.ts       # DBError, DBIdError, DBValueError
│       │   └── error.test.ts
│       └── schema/
│           ├── base.ts        # { id, ...timestamps }
│           └── timestamps.ts  # { createdAt, updatedAt } both notNull
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
| `configs/db.config.ts` | Connection config from env vars via `@keg-hub/parse-config` |

## Schema Overview

### Tables (23 total)

**19 Drizzle-managed tables** (defined in `schemas.ts`):
`orgs`, `roles`, `quotas`, `agents`, `agentProjects`, `agentFunctions`, `agentProviders`, `assets`, `threads`, `domains`, `secrets`, `apiKeys`, `messages`, `projects`, `functions`, `providers`, `endpoints`, `invitations`, `subscriptions`

**2 External tables** (read-only, not in Drizzle migrations):
- **`users`** -- Neon Auth managed, `pgSchema('neon_auth')`, table name `user`
- **`certificates`** (`caddy_certmagic_objects`) -- Caddy certmagic storage plugin

**3 Junction tables** (Drizzle-managed):
- **`agentProjects`** (`agent_projects`) -- Many-to-many agents-projects
- **`agentFunctions`** (`agent_functions`) -- Many-to-many agents-functions
- **`agentProviders`** (`agent_providers`) -- Many-to-many agents-providers (with priority ordering)

---

### User & Organization Management

#### `organizations` (variable: `orgs`)
- Fields: `id`, `name`(notNull), `description`, `ownerId`(notNull FK->users), `createdAt`, `updatedAt`
- Index: `ownerId`
- Relations: owner(user), users(via roles), quotas, assets, agents, secrets, projects, providers, invitations

#### `users` (Neon Auth, pgSchema `neon_auth`, table `user`)
- Fields: `id`(PK), `name`, `email`, `image`, `role`, `banned`, `banReason`, `banExpires`, `emailVerified`, `createdAt`(notNull), `updatedAt`(notNull)
- Relations: orgs(via roles), roles, assets, threads, providers, subscription
- **External**: Not managed by Drizzle migrations

#### `roles`
- Fields: `id`, `name`, `type`(notNull), `userId`(notNull FK->users), `orgId`(FK->orgs), `projectId`(FK->projects), `createdAt`, `updatedAt`
- Constraint: Exclusive arc -- `orgId XOR projectId` (exactly one must be set)
- Unique indexes: `(userId, orgId)`, `(userId, projectId)`
- Relations: user, org, project

#### `invitations`
- Fields: `id`, `email`(notNull), `userId`(FK->users), `roleType`(notNull), `orgId`(notNull FK->orgs), `invitedBy`(FK->users, onDelete set null), `token`(notNull unique), `status`(notNull default 'pending'), `expiresAt`(notNull), `acceptedAt`, `revokedAt`, `revokedBy`(FK->users, onDelete set null), `createdAt`, `updatedAt`
- Status enum: `pending`, `accepted`, `expired`, `revoked` (from `EInviteStatus`)
- Indexes: `orgId`, `email`, `status`
- Relations: org, user(invitee), inviter, revoker (3 separate user relations via `relationName`)

### AI & Agent Management

#### `agents`
- Fields: `id`, `name`(notNull), `description`, `orgId`(notNull FK->orgs), `systemPrompt`, `model`, `maxTokens`(default 100000), `tools`(jsonb default []), `envVars`(jsonb default {}), `environment`(jsonb default {}), `active`(boolean default true), `createdAt`, `updatedAt`
- Relations: org, secrets(many), threads(many), projects(many via agentProjects), functions(many via agentFunctions), providers(many via agentProviders)
- **No direct provider FK** -- providers are associated via the `agentProviders` junction table

#### `agentProjects` (`agent_projects`)
- Fields: `id`, `agentId`(notNull FK->agents), `projectId`(notNull FK->projects), `alias`, `createdAt`, `updatedAt`
- Constraint: `unique(agentId, projectId)`
- Relations: agent, project
- **Junction table** for many-to-many agent-project relationships

#### `agentFunctions` (`agent_functions`)
- Fields: `id`, `agentId`(notNull FK->agents, onDelete cascade), `functionId`(notNull FK->functions, onDelete cascade), `createdAt`, `updatedAt`
- Constraint: `unique(agentId, functionId)`
- Relations: agent, function
- **Junction table** for many-to-many agent-function relationships

#### `agentProviders` (`agent_providers`)
- Fields: `id`, `agentId`(notNull FK->agents, onDelete cascade), `providerId`(notNull FK->providers, onDelete cascade), `priority`(integer default 0), `createdAt`, `updatedAt`
- Constraint: `unique(agentId, providerId)`
- Index: `(agentId, priority)`
- Relations: agent, provider
- **Junction table** for many-to-many agent-provider relationships with priority ordering (0 = primary/default)

#### `threads`
- Fields: `id`, `name`, `meta`(jsonb), `public`(boolean default false), `parentThreadId`(uuid self-ref), `branchMessageId`(uuid FK->messages), `providerId`(FK->providers, onDelete set null), `agentId`(FK->agents, onDelete set null), `orgId`(FK->orgs, onDelete cascade), `projectId`(FK->projects, onDelete cascade), `userId`(notNull FK->users, onDelete cascade), `createdAt`, `updatedAt`
- Indexes: `userId`, `agentId`, `parentThreadId`
- Relations: messages(many), user, provider, agent, org, project, parentThread(self), branches(self many), branchMessage
- Supports thread branching via `parentThreadId` + `branchMessageId`

#### `messages`
- Fields: `id`, `meta`(jsonb), `type`(notNull), `content`(jsonb notNull), `orgId`(FK->orgs), `projectId`(FK->projects), `threadId`(notNull FK->threads), `createdAt`, `updatedAt`
- Relations: assets(many), thread, org, project

### Project & Code Management

#### `projects`
- Fields: `id`, `meta`(jsonb), `gitUrl`, `name`(notNull), `description`, `branch`(default 'main'), `orgId`(notNull FK->orgs, onDelete cascade), `createdAt`, `updatedAt`
- Unique index: `(orgId, name)`
- Index: `orgId`
- Relations: assets, secrets, providers, endpoints, agents(via agentProjects), org

#### `endpoints`
- Fields: `id`, `name`, `headers`(jsonb), `options`(jsonb), `path`(notNull), `public`(boolean default false), `method`(varchar 10 default 'GET'), `type`(varchar 10 notNull default 'proxy'), `projectId`(notNull FK->projects), `createdAt`, `updatedAt`
- Unique index: `(projectId, path, method)`
- Relations: functions(many), project

#### `functions`
- Fields: `id`, `name`(notNull), `description`, `content`(text notNull), `branch`(default 'main'), `defaultArgs`(jsonb default {}), `dependencies`(jsonb default {}), `inputSchema`(jsonb default [], typed as `TFunctionParam[]`), `language`(varchar 50 default EFunLanguage.typescript), `endpointId`(FK->endpoints, onDelete cascade), `projectId`(notNull FK->projects, onDelete cascade), `createdAt`, `updatedAt`
- Indexes: `projectId`, `endpointId`
- Relations: endpoint, project, agents(many via agentFunctions)

### Configuration & Secrets

#### `providers` -- ORG-SCOPED ONLY
- Fields: `id`, `name`, `type`(notNull, typed as `EProvider`), `brand`(typed as `TProviderBrand`), `options`(jsonb), `headers`(jsonb), `bodyParams`(jsonb, column `body_params`), `secretId`(uuid), `orgId`(notNull FK->orgs, onDelete cascade), `createdAt`, `updatedAt`
- Relations: org, agents(many via agentProviders)
- **NOT an exclusive arc** -- only has `orgId` (required). No `userId` or `projectId`.

#### `secrets` -- 4-WAY ARC + COMBO
- Fields: `id`, `name`(notNull), `description`, `hashKey`(notNull), `encryptedValue`(notNull), `orgId`(FK->orgs), `projectId`(FK->projects), `providerId`(FK->providers), `agentId`(FK->agents), `createdAt`, `updatedAt`
- **5 valid scope combinations** (CHECK constraint `secret_scope_check`):
  1. `orgId` only
  2. `projectId` only
  3. `providerId` only
  4. `agentId` only
  5. `orgId` + `providerId` together (combo scope)
- Indexes: `orgId`, `projectId`, `providerId`, `agentId`
- Relations: org, project, provider, agent
- Encryption: AES-256-GCM with HKDF key derivation (via `@tdsk/domain`)

#### `apiKeys` (`api_keys`)
- Fields: `id`, `name`(notNull), `expiresAt`(timestamp), `lastUsedAt`(timestamp), `scopes`(text default 'read'), `active`(boolean default true), `rateLimit`(integer default 100), `keyHash`(notNull unique), `keyPrefix`(varchar 12 notNull), `orgId`(FK->orgs), `projectId`(FK->projects), `userId`(FK->users), `createdAt`, `updatedAt`
- **Note**: `scopes` is `text` type (NOT jsonb array)
- Indexes: `orgId`, `keyHash`, `projectId`, `userId`
- Relations: org, project, user
- `orgId` and `projectId` are both optional (no exclusive arc constraint)

### File & Asset Management

#### `assets` -- 5-WAY EXCLUSIVE ARC
- Fields: `id`, `url`, `meta`(jsonb), `content`(jsonb), `name`(notNull), `type`(notNull), `providerId`(FK->providers, onDelete set null), `orgId`(FK->orgs), `userId`(FK->users), `threadId`(FK->threads), `projectId`(FK->projects), `messageId`(FK->messages), `createdAt`, `updatedAt`
- Constraint: Exactly ONE of `orgId`, `projectId`, `userId`, `threadId`, `messageId` must be set
- `providerId` is **not** part of the arc (nullable, independent)
- Relations: org, project, user, thread, message, provider

### Domain Management

#### `domains`
- Fields: `id`, `domain`(notNull unique), `verifiedAt`(timestamp), `sslPrivateKey`, `sslCertificate`, `sslExpiresAt`(timestamp), `verified`(boolean notNull default false), `sslEnabled`(boolean notNull default false), `orgId`(FK->orgs), `projectId`(FK->projects), `createdAt`, `updatedAt`
- Constraint: Exclusive arc -- `orgId XOR projectId`
- Unique index: `(orgId, domain)`
- Relations: org, project, certificates(many)

#### `certificates` (`caddy_certmagic_objects`) -- EXTERNAL
- Fields: `parent`(notNull), `name`(notNull), `isFile`(boolean notNull), `value`(bytea), `modified`(timestamp notNull defaultNow)
- Primary key: composite `(parent, name)`
- Constraint: `(isFile=true AND value IS NOT NULL) OR (isFile=false AND value IS NULL)`
- Relations: domain (via parent->domains.domain)
- **External**: Managed by caddy-storage-postgresql plugin, not Drizzle migrations

### Billing & Quotas

#### `quotas`
- Fields: `id`, `orgId`(notNull FK->orgs), `period`(notNull), then 12 counter columns all `integer default(0) notNull`:
  `price`, `retention`, `organizations`, `projects`, `members`, `endpoints`, `threads`, `messages`, `functionCalls`(column `function_calls`), `runtime`, `orgSecrets`(column `org_secrets`), `projectSecrets`(column `project_secrets`)
- Unique index: `(orgId, period)`
- Relations: org

#### `subscriptions`
- Fields: `id`, `userId`(notNull FK->users, unique, onDelete cascade), `tier`(notNull default 'free'), `status`(notNull default 'active'), `polarId`, `polarCustomerId`, `polarPriceId`, `currentPeriodStart`(timestamp), `currentPeriodEnd`(timestamp), `cancelAtPeriodEnd`(boolean default false), `seats`(integer default 0), `createdAt`, `updatedAt`
- Relations: user
- One subscription per user (userId is unique)

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
│  - Specialized services              │  Custom queries
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│  Schema Layer (src/schemas/)         │  23 table definitions
│  - Drizzle table definitions         │  + relations
│  - schemas.ts (19 managed)           │
│  - index.ts (+ users + certs)        │
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

// Graceful shutdown
await disconnectDatabase()  // Closes Pool, resets singleton
```

## Services (17 total)

Exported from `services/index.ts`:

| Export Name | Class | Schema | Domain Model | Notable Methods |
|-------------|-------|--------|-------------|-----------------|
| `org` | `Org` | `orgs` | `Organization` | Inherits base CRUD |
| `role` | `Role` | `roles` | `Role` | `getOrgRole`, `getProjectRole`, `getUserRoles`, `getOrgMembers`, `getOrgOwner`, `getProjectMembers`, `isOrgMember`, `isProjectMember`, `updateOrgRole`, `updateProjectRole`, `removeFromOrg`, `removeFromProject`, `getUserOrgs`, `getUserProjects` |
| `user` | `User` | `users` | `User` | `byEmail()`, `getByIds()` |
| `asset` | `Asset` | `assets` | `Asset` | `listByThread()`, `listByMessage()` |
| `quota` | `Quota` | `quotas` | `Quota` | `getUsage`, `findByOrgAndPeriod`, `increment` (atomic SQL), `initializePeriod` |
| `agent` | `Agent` | `agents` | `Agent` | Auto-loads secrets+projects+functions+providers, `create`/`update`/`upsert` with junction associations, `addProject`, `removeProject`, `addFunction`, `removeFunction`, `addProvider`, `removeProvider`, `setProviders`, sanitization |
| `apiKey` | `ApiKey` | `apiKeys` | -- | Inherits base CRUD |
| `secret` | `Secret` | `secrets` | -- | Inherits base CRUD |
| `thread` | `Thread` | `threads` | `Thread` | `listByAgent`, `listByUser`, `getWithMessages`, `branchThread` |
| `project` | `Project` | `projects` | -- | Inherits base CRUD |
| `message` | `Message` | `messages` | `Message` | `listByThread()`, `createBatch()` |
| `endpoint` | `Endpoint` | `endpoints` | -- | Inherits base CRUD |
| `function` | `Function` | `functions` | `Function` | Auto-loads agents relation, `listByAgent()`, `setAgents()`, `addAgent()`, `removeAgent()` |
| `provider` | `Provider` | `providers` | -- | Inherits base CRUD |
| `domain` | `DomainService` | `domains` | `Domain` | `find` (cert check), `validate`, `verified`, `enableSSL`, `disableSSL`, `owner`, custom cert storage via DB transactions |
| `invitation` | `Invitation` | `invitations` | `Invitation` | `getByToken`, `getByEmailAndOrg`, `getPendingByOrg`, `getAllByOrg`, `getPendingByEmail`, `accept`, `revoke`, `markExpired`, `isValid` |
| `subscription` | `Subscription` | `subscriptions` | `Subscription` | `findByUser`, `findByPolarId`, `upsertByUser` |

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

### Agent Service (425 lines)

The Agent service is the most complex, with automatic relation loading for secrets, projects, functions, and providers, plus secret sanitization:

```typescript
class Agent extends Base<typeof agents, TAgentSelectOpts, TDBAgentInsert, AgentModel> {
  // with() override: always loads secrets, projects (nested), functions (nested), providers (nested)
  with = (opts) => ({
    secrets: true,
    ...opts,
    projects: { with: { project: true } },
    functions: { with: { function: true } },
    providers: { with: { provider: true } },
  })

  // model() maps junction records, sorts providers by priority, sanitizes secrets by default
  model = (data, sanitizeOpts?) => { ... }

  // get/by/list all auto-load relations and sanitize
  async get(id, opts?: TAgentQueryOpts)    // opts.sanitize = false to skip
  async by(prop, value?, opts?)
  async list(opts?: TAgentQueryOpts)

  // create/update/upsert handle agentProjects, agentFunctions, agentProviders junction tables
  async create(data: TAgentInsertOpts)     // data.projects, data.functionIds, data.providerIds
  async update(data: TAgentInsertOpts)     // replaces all junction associations
  async upsert(data: TAgentInsertOpts)

  // Direct junction management -- projects
  async addProject(agentId, projectId, alias?)
  async removeProject(agentId, projectId)

  // Direct junction management -- functions
  async addFunction(agentId, functionId)
  async removeFunction(agentId, functionId)

  // Direct junction management -- providers
  async addProvider(agentId, providerId, priority?)
  async removeProvider(agentId, providerId)
  async setProviders(agentId, providerIds: string[])  // replaces all, sets priority by array order
}

// Extended insert type
type TAgentInsertOpts = TDBAgentInsert & {
  functionIds?: string[]
  providerIds?: string[]
  projects?: Array<Partial<ProjectModel>>
}
```

### Function Service (130 lines)

Manages functions with agent junction table associations:

```typescript
class Function extends Base<typeof functions, TDBFunctionSelect, TDBFunctionInsert, FunctionModel> {
  // with() override: always loads agents relation
  with = (opts?) => ({ agents: true, ...opts })

  // model() maps junction records to agentIds array
  model = (data) => { ... }

  // get/list auto-load agent relations
  async get(id, opts?)
  async list(opts?)

  // Agent association management
  async listByAgent(agentId)              // list functions for a specific agent
  async setAgents(functionId, agentIds)   // replace all agent associations
  async addAgent(functionId, agentId)     // add single agent association
  async removeAgent(functionId, agentId)  // remove single agent association
}
```

### Message Service (53 lines)

```typescript
class Message extends Base<typeof messages, ...> {
  async listByThread(threadId, opts?)      // ordered by createdAt asc
  async createBatch(data: TDBMessageInsert[])  // bulk insert with returning
}
```

### Asset Service (36 lines)

```typescript
class Asset extends Base<typeof assets, ...> {
  async listByThread(threadId)
  async listByMessage(messageId)
}
```

### DomainService (299 lines)

Manages custom domains with SSL certificate storage via the external `caddy_certmagic_objects` table:

```typescript
class DomainService extends Base<typeof domains, TDBDomainsSelect, TDBDomainsInsert, DomainModel> {
  async get(id)                  // includes certificates relation
  async by(prop, value?)         // includes certificates relation
  async create(data)             // optionally stores custom SSL cert
  async update(data)             // optionally updates custom SSL cert
  async find(domain: string)     // checks for valid cert (< 90 days old)
  async validate(domain: string) // checks domain exists + verified (for Caddy on_demand_tls)
  async verified(domain: string) // marks domain as verified
  async enableSSL(domain)
  async disableSSL(domain)
  async delete(domain: string)   // deletes by domain name (not id)
  async owner(domain, orgId?, projectId?)  // authorization check
}
```

### Invitation Service (243 lines)

Status workflow: `pending` -> `accepted` | `expired` | `revoked`

```typescript
class Invitation extends Base<typeof invitations, ...> {
  async getByToken(token)
  async getByEmailAndOrg(email, orgId)
  async getPendingByOrg(orgId)
  async getAllByOrg(orgId)
  async getPendingByEmail(email)
  async accept(invitationId, userId)    // validates status=pending first
  async revoke(invitationId, revokedBy) // validates status=pending first
  async markExpired()                   // bulk update past-expiration pending invites
  async isValid(invitationId)           // checks status=pending AND not expired
}
```

### Role Service (270 lines)

14 specialized query methods for org/project role management:

```typescript
class Role extends Base<typeof roles, ...> {
  async getOrgRole(userId, orgId)
  async getProjectRole(userId, projectId)
  async getUserRoles(userId)           // all roles across orgs and projects
  async getOrgMembers(orgId)
  async getOrgOwner(orgId)             // finds type='owner'
  async getProjectMembers(projectId)
  async isOrgMember(userId, orgId)     // returns boolean
  async isProjectMember(userId, projectId)
  async updateOrgRole(userId, orgId, roleType)
  async updateProjectRole(userId, projectId, roleType)
  async removeFromOrg(userId, orgId)
  async removeFromProject(userId, projectId)
  async getUserOrgs(userId)            // returns string[] of orgIds
  async getUserProjects(userId)        // returns string[] of projectIds
}
```

### Quota Service (130 lines)

Atomic SQL increment for usage tracking:

```typescript
class Quota extends Base<typeof quotas, ...> {
  async getUsage(orgId, period)
  async findByOrgAndPeriod(orgId, period)  // alias for getUsage
  async increment(orgId, period, key: TIncrementKey, amount = 1)
    // Rejects amount <= 0
    // Uses INSERT ... ON CONFLICT DO UPDATE with SQL: column + amount
    // TIncrementKey: 'members' | 'threads' | 'runtime' | 'messages' | 'projects' |
    //   'endpoints' | 'orgSecrets' | 'organizations' | 'functionCalls' | 'projectSecrets'
  async initializePeriod(orgId, period, price, retention)
    // INSERT ... ON CONFLICT DO NOTHING, falls back to getUsage on conflict
}
```

### Thread Service (136 lines)

```typescript
class Thread extends Base<typeof threads, ...> {
  async listByAgent(agentId, opts?)      // ordered by createdAt desc
  async listByUser(userId, opts?)        // ordered by createdAt desc
  async getWithMessages(id)              // includes messages relation
  async branchThread(threadId, messageId, userId)
    // Transaction: copies thread + messages up to branchpoint
    // Sets parentThreadId and branchMessageId on new thread
}
```

### Subscription Service (101 lines)

```typescript
class Subscription extends Base<typeof subscriptions, ...> {
  findByUser(userId)
  findByPolarId(polarId)
  upsertByUser(data: { userId, ...rest })  // find-then-update or create
}
```

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

The secrets table allows 5 valid scope combinations:

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

### 1. Base Schema Pattern

All tables share common fields via spread operator:

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

### 2. Service Inheritance Pattern

All 17 services extend `Base<TTable, S, I, M>`:

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

### 3. Type Inference Pattern

Types are inferred from schemas with date normalization:

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

### 4. Relation Definition Pattern

Relations defined separately from table schemas:

```typescript
export const agentsRelations = relations(agents, ({ one, many }) => ({
  org: one(orgs, { fields: [agents.orgId], references: [orgs.id] }),
  secrets: many(secrets),
  threads: many(threads),
  projects: many(agentProjects),     // via junction table
  functions: many(agentFunctions),   // via junction table
  providers: many(agentProviders),   // via junction table
}))
```

### 5. Cascade Deletion Pattern

Foreign keys use appropriate cascade behaviors:

```typescript
// Hard delete: child deleted when parent is deleted
orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'cascade' })

// Soft unlink: FK set to null when parent is deleted
providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'set null' })
```

### 6. JSONB for Flexible Data

```typescript
// Agent configuration
tools: jsonb('tools').default('[]').$type<string[]>()
envVars: jsonb('env_vars').default({}).$type<Record<string, string>>()
environment: jsonb('environment').default({}).$type<{ timeout?, memory?, streaming?, ... }>()

// Function input schema
inputSchema: jsonb('input_schema').default([]).$type<TFunctionParam[]>()

// Provider extras
headers: jsonb('headers')
bodyParams: jsonb('body_params')
options: jsonb('options')
```

### 7. Schema Barrel Organization

Two-level barrel pattern separates Drizzle-managed from external:

```typescript
// schemas/schemas.ts -- 19 Drizzle-managed tables only (used for migrations)
export { orgs, orgsRelations } from '@TDB/schemas/orgs'
export { agentFunctions, agentFunctionsRelations } from '@TDB/schemas/agentFunctions'
export { agentProviders, agentProvidersRelations } from '@TDB/schemas/agentProviders'
// ... 16 more

// schemas/index.ts -- full export including external read-only tables
export * from '@TDB/schemas/schemas'
export { users, usersRelations } from '@TDB/schemas/users'
export { certificates, certificatesRelations } from '@TDB/schemas/certificates'
```

## Dependencies

### Core Dependencies
- **`drizzle-orm`** (0.45.1): Type-safe ORM for PostgreSQL
- **`pg`** (8.16.3): PostgreSQL client for Node.js (Pool-based)
- **`@tdsk/domain`** (workspace): Shared domain models, crypto, utilities
- **`@tdsk/logger`** (workspace): Winston-based logging via `buildApiLogger`
- **`@keg-hub/parse-config`** (2.2.0): Environment configuration loader
- **`@keg-hub/jsutils`** (10.0.0): JavaScript utilities (isObj, isStr, exists, etc.)
- **`alias-hq`** (6.2.4): Path alias management
- **`module-alias`** (2.2.3): Runtime module aliasing

### Dev Dependencies
- **`drizzle-kit`** (0.31.8): Migration generation and management CLI
- **`tsx`** (4.21.0): TypeScript execution for scripts
- **`vitest`** (1.6.1): Unit testing framework
- **`vite-tsconfig-paths`** (4.3.2): Path alias resolution for Vite/Vitest

## Commands

### Package Scripts

```bash
# Testing
pnpm test                # Run vitest with configs/vitest.config.ts

# Drizzle Kit
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

# Seeding
pnpm seed                # Run database seeder
pnpm purge               # Purge database data

# Utility
pnpm script              # Run utility scripts with aliases
pnpm clean               # Remove node_modules
pnpm types               # TypeScript type checking (tsc --noEmit)
```

> **Note**: `pnpm push` runs `drizzle-kit push` which is interactive and requires manual confirmation for destructive changes. Claude cannot run this automatically.

> **Note**: Linting and formatting run automatically via Biome. Do not run `pnpm lint` or `pnpm format` manually.

### Environment Variables

Required in `deploy/values.*.yml`:

```yaml
TDSK_DB_URL: "postgresql://..."       # Full connection URL (preferred)
TDSK_DB_NAME: "threaded_stack"        # Database name
TDSK_DB_USER: "username"              # Database user
TDSK_DB_PASS: "password"              # Database password
TDSK_DB_PROTO: "postgres"             # Protocol (postgres/postgresql)
TDSK_DB_DIALECT: "postgresql"         # Drizzle dialect
TDSK_DB_TYPE: "postgresql"            # Database type
TDSK_DB_JWT_SCRT: "secret"            # JWT secret (optional)
TDSK_DB_SRV_ROLE: "service"           # Service role (optional)
TDSK_DB_PUBLIC_KEY: "key"             # Public key (optional)
TDSK_DB_PROJECT_ID: "..."             # Neon project ID (optional)
TDSK_DB_LOG_LEVEL: "info"             # Log level override (optional)
TDSK_DB_LOG_LABEL: "TDSK - Database"  # Log label (optional)
```

## Tests

**312 tests passing across 13 test files:**

| Test File | Count | Location |
|-----------|-------|----------|
| `database.test.ts` | 13 | `src/` |
| `base.test.ts` | 15 | `src/services/` |
| `role.test.ts` | 46 | `src/services/` |
| `user.test.ts` | 17 | `src/services/` |
| `agent.test.ts` | 37 | `src/services/` |
| `domain.test.ts` | 52 | `src/services/` |
| `invitation.test.ts` | 45 | `src/services/` |
| `subscription.test.ts` | 19 | `src/services/` |
| `quota.test.ts` | 22 | `src/services/` |
| `buildDBUrl.test.ts` | 13 | `src/utils/database/` |
| `buildQuery.test.ts` | 14 | `src/utils/database/` |
| `getDialect.test.ts` | 6 | `src/utils/database/` |
| `error.test.ts` | 13 | `src/utils/error/` |

Run tests: `pnpm test` from `repos/database/`

## Integration Points

### Consumed By

**Backend** (`repos/backend`):
```typescript
import { database } from '@tdsk/database'

const db = database()
const { data, error } = await db.services.org.create({ name: 'Acme Corp' })
const { data: agent } = await db.services.agent.get(agentId, { sanitize: false })
```

**Proxy** (`repos/proxy`):
```typescript
import { database } from '@tdsk/database'

const db = database()
const { data: apiKey } = await db.services.apiKey.by({ keyHash })
```

### Export Surface

```typescript
// Main exports from @tdsk/database (src/index.ts)
export * from './types'      // All TypeScript types
export * from './database'   // database(), disconnectDatabase()

// Types are the primary cross-repo interface:
// TDatabase, TDBServices, TDBConfig
// TDB*Select, TDB*Insert for all 18 entity types
// TDBApiRes<M>, TDBApiResType<T>, TDBQueryOpts, IDBApi
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

## Best Practices

### Schema Design
- Use `base` spread for all tables (id, createdAt, updatedAt -- both notNull)
- Define relations separately from tables (Drizzle convention)
- Use JSONB with `.$type<T>()` for typed flexible data
- Add unique indexes for lookup fields
- Use `onDelete: 'cascade'` for parent-child, `onDelete: 'set null'` for optional refs
- Keep external schemas (users, certificates) out of `schemas.ts` (only in `index.ts`)

### Service Implementation
- Extend `Base` class for standard CRUD
- Override `model()` for domain model conversion
- Override `with()` to configure default relation loading
- Always return `{ data, error }` pattern -- never throw from service methods
- Use `TServiceOpts` for constructor params

### Type Safety
- Let Drizzle infer types (`$inferSelect`, `$inferInsert`)
- Use `TInferDates` wrapper for date field normalization
- Export types from `schema.types.ts`
- Use generic `Base<TTable, S, I, M>` for full type safety

### Security
- Never commit database credentials
- Use environment variables via `@keg-hub/parse-config`
- Store secrets encrypted in `secrets` table (AES-256-GCM + HKDF)
- Use `encryptSecret()` helper from `utils/crypto.ts` for seeding
- Agent service sanitizes secrets by default (strips `encryptedValue`)

## Related Documentation

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Neon Database Docs](https://neon.tech/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Drizzle Kit CLI](https://orm.drizzle.team/kit-docs/overview)

# Sandbox-Project Many-to-Many Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE (applies to ALL subagents):** NEVER run `git commit`, `git push`, `git reset`, `git revert`, `git rebase`, `git cherry-pick`, `git stash`, `git merge`. Only `git add`, `git status`, `git diff`, `git log`, `git branch`, `git show` are allowed. The user handles all commits manually.

**Goal:** Convert Sandbox-Project from one-to-many (direct FK) to many-to-many (junction table) with per-project config overrides, exactly mirroring the Agent-Project pattern.

**Architecture:** New `sandbox_projects` junction table with `alias`, `enabled`, and a single `config` JSONB override column (`Partial<TKubeSandboxConfig>`). The Sandbox domain model gains `projects: Project[]`, `projectConfigs: TSandboxProjectConfig[]`, and `getEffectiveConfig(projectId)`. Backend gets dual-path routing (org-scoped + project-scoped). Admin state becomes context-keyed (`Record<string, Record<string, Sandbox>>`).

**Tech Stack:** Drizzle ORM, PostgreSQL, Express 5, TypeScript, React, Jotai, MUI

**Spec:** `docs/superpowers/specs/2026-04-10-sandbox-project-many-to-many-design.md`

---

### Task 1: Create `sandbox_projects` Junction Table Schema

**Files:**
- Create: `repos/database/src/schemas/sandboxProjects.ts`

This file already exists with the sandbox_providers junction table pattern. We're adding a NEW file for the sandbox_projects junction. Do NOT confuse with `sandboxProviders.ts`.

- [ ] **Step 1: Create the junction table schema**

Create `repos/database/src/schemas/sandboxProjects.ts`:

```typescript
import type { TKubeSandboxConfig } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { text, jsonb, boolean, pgTable, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * Sandbox-Projects junction table
 * Enables many-to-many relationship between sandboxes and projects
 * One sandbox can be associated with multiple projects
 * One project can have multiple sandboxes
 *
 * Also stores per-project override configuration for the sandbox.
 * NULL config = inherit base sandbox config entirely.
 * Non-null config is deep-merged with base config (project wins).
 */
export const sandboxProjects = pgTable(
  `sandbox_projects`,
  {
    ...base,
    /** Sandbox reference */
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),

    /** Project reference */
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),

    /** Optional display name for this sandbox in the project context */
    alias: text(`alias`),

    /** Whether this sandbox is enabled in this project (default: true) */
    enabled: boolean(`enabled`).default(true),

    /**
     * Per-project config override (deep-merged with base sandbox config)
     * NULL = inherit from base sandbox config
     * Top-level fields replace, nested objects (envVars, resources, ports) are shallow-merged
     */
    config: jsonb(`config`).$type<Partial<TKubeSandboxConfig> | null>(),
  },
  (table) => [
    unique(`unique_sandbox_project`).on(table.sandboxId, table.projectId),
  ]
)

export const sandboxProjectsRelations = relations(sandboxProjects, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [sandboxProjects.sandboxId],
    references: [sandboxes.id],
  }),
  project: one(projects, {
    fields: [sandboxProjects.projectId],
    references: [projects.id],
  }),
}))
```

- [ ] **Step 2: Verify file compiles**

Run: `cd repos/database && pnpm types`
Expected: Clean type check (no errors related to the new file)

---

### Task 2: Update `sandboxes` Schema — Remove `projectId`, Update Relations

**Files:**
- Modify: `repos/database/src/schemas/sandboxes.ts`

- [ ] **Step 1: Remove `projectId` column and update relations**

In `repos/database/src/schemas/sandboxes.ts`:

Remove the `projects` import:
```typescript
// REMOVE this import
import { projects } from '@TDB/schemas/projects'
```

Add the `sandboxProjects` import:
```typescript
import { sandboxProjects } from '@TDB/schemas/sandboxProjects'
```

Remove the `projectId` column from the table definition:
```typescript
// REMOVE these lines from the table columns:
projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
  onDelete: `cascade`,
}),
```

Remove the `projectId` index:
```typescript
// REMOVE this line from the table indexes:
index(`sandboxes_project_idx`).on(table.projectId),
```

Update the relations — replace the `project: one(...)` with `projects: many(...)`:
```typescript
export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  threads: many(threads),
  org: one(orgs, {
    references: [orgs.id],
    fields: [sandboxes.orgId],
  }),
  user: one(users, {
    references: [users.id],
    fields: [sandboxes.userId],
  }),
  projects: many(sandboxProjects),
  providers: many(sandboxProviders),
}))
```

- [ ] **Step 2: Verify file compiles**

Run: `cd repos/database && pnpm types`
Expected: Clean (some downstream errors expected until other files updated)

---

### Task 3: Update `projects` Schema Back-Reference

**Files:**
- Modify: `repos/database/src/schemas/projects.ts`

- [ ] **Step 1: Update the sandboxes relation import and back-reference**

In `repos/database/src/schemas/projects.ts`:

Replace the sandboxes import:
```typescript
// REMOVE:
import { sandboxes } from '@TDB/schemas/sandboxes'

// ADD:
import { sandboxProjects } from '@TDB/schemas/sandboxProjects'
```

In the `projectsRelations`, update the sandboxes relation:
```typescript
// CHANGE:
sandboxes: many(sandboxes),
// TO:
sandboxes: many(sandboxProjects),
```

- [ ] **Step 2: Verify file compiles**

Run: `cd repos/database && pnpm types`

---

### Task 4: Export New Schema from `schemas.ts`

**Files:**
- Modify: `repos/database/src/schemas/schemas.ts`

- [ ] **Step 1: Add the export**

Add this line to `repos/database/src/schemas/schemas.ts` (after the `sandboxes` export, around line 22):

```typescript
export {
  sandboxProjects,
  sandboxProjectsRelations,
} from '@TDB/schemas/sandboxProjects'
```

- [ ] **Step 2: Verify full database types**

Run: `cd repos/database && pnpm types`
Expected: Clean type check

---

### Task 5: Add `TSandboxProjectConfig` Domain Type

**Files:**
- Modify: `repos/domain/src/types/sandbox.types.ts`

- [ ] **Step 1: Add the type definition**

Add at the end of `repos/domain/src/types/sandbox.types.ts` (before the final line or after `ESBState`):

```typescript
/**
 * Per-project sandbox configuration overrides.
 * Stored on the sandboxProjects junction table.
 * NULL config = inherit from base sandbox config.
 */
export type TSandboxProjectConfig = {
  sandboxId: string
  projectId: string
  alias?: string | null
  enabled?: boolean
  config?: Partial<TKubeSandboxConfig> | null
}
```

- [ ] **Step 2: Verify domain types**

Run: `cd repos/domain && pnpm types`
Expected: Clean type check

---

### Task 6: Update Sandbox Domain Model

**Files:**
- Modify: `repos/domain/src/models/sandbox.ts`

- [ ] **Step 1: Add project fields and methods**

Replace the full contents of `repos/domain/src/models/sandbox.ts`:

```typescript
import type { TProviderLink, TKubeSandboxConfig, TSandboxProjectConfig } from '@TDM/types'

import { Base } from '@TDM/models/base'
import { Project } from '@TDM/models/project'
import type { Provider } from '@TDM/models/provider'
import { toProviderLinks } from '@TDM/utils/providers/toProviderLinks'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  builtIn: boolean = false
  config: TKubeSandboxConfig
  providerLinks: TProviderLink[] = []
  projects: Project[] = []
  projectConfigs: TSandboxProjectConfig[] = []

  constructor(data: TSandboxData) {
    super()

    const { projects, providerLinks, projectConfigs, ...rest } = data

    Object.assign(this, {
      ...rest,
      projects:
        projects?.map((project) =>
          project instanceof Project ? project : new Project(project)
        ) || [],
      providerLinks: toProviderLinks(providerLinks),
      projectConfigs: projectConfigs || [],
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
  }

  getProjectConfig(projectId: string): TSandboxProjectConfig | undefined {
    return this.projectConfigs?.find((c) => c.projectId === projectId)
  }

  getEffectiveConfig(projectId?: string): Sandbox {
    if (!projectId) return this
    const pc = this.getProjectConfig(projectId)
    if (!pc?.config) return this

    const overrideConfig = pc.config

    return new Sandbox({
      ...this,
      projects: this.projects,
      projectConfigs: this.projectConfigs,
      providerLinks: this.providerLinks,
      config: {
        ...this.config,
        ...overrideConfig,
        // Deep-merge nested objects (project wins)
        envVars: { ...this.config.envVars, ...(overrideConfig.envVars || {}) },
        resources: {
          limits: {
            ...this.config.resources?.limits,
            ...overrideConfig.resources?.limits,
          },
          requests: {
            ...this.config.resources?.requests,
            ...overrideConfig.resources?.requests,
          },
        },
        ports: { ...this.config.ports, ...(overrideConfig.ports || {}) },
      },
    })
  }
}
```

- [ ] **Step 2: Verify domain types**

Run: `cd repos/domain && pnpm types`
Expected: Clean type check

---

### Task 7: Update Database Sandbox Service

**Files:**
- Modify: `repos/database/src/services/sandbox.ts`

This is the largest change. The service needs to:
1. Load project junction data in `with()`
2. Extract projects/projectConfigs in `model()`
3. Handle project associations in `create()`/`update()`
4. Add `addProject()`, `removeProject()`, `upsertProjectConfig()`, `getProjectConfig()`

- [ ] **Step 1: Replace the full service file**

Replace `repos/database/src/services/sandbox.ts`:

```typescript
import type { TProviderInput, TProviderLink, TSandboxProjectConfig } from '@tdsk/domain'
import type {
  TDBUpdate,
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBSandboxSelect,
  TDBSandboxInsert,
  TDBProviderSelect,
  TDBProjectSelect,
} from '@TDB/types'

import { eq, and, sql, notInArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { logger } from '@TDB/utils/logger'
import { DBError } from '@TDB/utils/error/error'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { Sandbox as SandboxModel, Project as ProjectModel } from '@tdsk/domain'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { sandboxProjects } from '@TDB/schemas/sandboxProjects'
import { addWhere, addOrderBy } from '@TDB/utils/database/buildQuery'

export type TSandboxSelectOpts = TDBSandboxSelect & {
  projects?: {
    alias?: string
    sandboxId: string
    projectId: string
    enabled?: boolean
    config?: Record<string, any> | null
    project: ProjectModel | TDBProjectSelect
  }[]
  providers?: {
    priority: number
    sandboxId: string
    providerId: string
    model?: string | null
    provider: TDBProviderSelect
  }[]
}

type TSandboxProviderMeta = {
  providerLinks?: TProviderLink[]
  providerInputs?: TProviderInput[]
}

type TSandboxProjectMeta = {
  projects?: Array<Partial<ProjectModel>>
}

export type TSandboxInsertOpts = TDBSandboxInsert &
  TSandboxProviderMeta &
  TSandboxProjectMeta

type TSandboxRelations = {
  id: string
  providerInputs?: TProviderInput[]
  projects?: Array<Partial<ProjectModel>>
}

export class Sandbox extends Base<
  typeof sandboxes,
  TSandboxSelectOpts,
  TDBSandboxInsert,
  SandboxModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxes })
  }

  with = (opts: TDBWithRecord) => {
    return {
      ...opts,
      projects: {
        with: {
          project: true,
        },
      },
      providers: {
        with: {
          provider: true,
        },
      },
    } as TDBWithRecord
  }

  model = (data: TSandboxSelectOpts) => {
    const { providers, projects: projectLinksRaw, ...rest } = data

    const projectLinks = projectLinksRaw || []

    return new SandboxModel({
      ...rest,
      projects: projectLinks.map((link) => link.project),
      projectConfigs: projectLinks.map((link) => ({
        sandboxId: link.sandboxId,
        projectId: link.projectId,
        alias: link.alias ?? null,
        enabled: link.enabled ?? true,
        config: link.config ?? null,
      })),
      providerLinks: (providers || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => ({
          provider: link.provider,
          model: link.model ?? null,
          priority: link.priority ?? 0,
        })),
    })
  }

  #relations = async (opts: TSandboxRelations) => {
    const { id, projects, providerInputs } = opts

    if (projects?.length) {
      const rows = projects
        .filter((p) => p?.id)
        .map((proj) => ({
          sandboxId: id,
          alias: proj.name,
          projectId: proj.id!,
        }))
      if (rows.length)
        await this.db.insert(sandboxProjects).values(rows).onConflictDoNothing()
    }

    if (providerInputs !== undefined) await this.#upsertProviders(id, providerInputs)
  }

  async get(id: string, opts?: TDBQueryOpts) {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      if (!row) return { error: new DBError(`${this.title} not found`) }

      return { data: this.model(row as TSandboxSelectOpts) }
    } catch (error: any) {
      return { error }
    }
  }

  async list(opts: TDBQueryOpts = {}) {
    const { where, limit, offset, orderBy } = opts

    try {
      const found = await this.db.query[this.name].findMany({
        limit,
        offset,
        with: this.with(opts?.with),
        orderBy: orderBy ? addOrderBy(this.table, opts) : undefined,
        where: where ? and(...addWhere(this.table, opts)) : undefined,
      })

      if (!found?.length) return { data: [] as SandboxModel[] }

      return {
        data: found.map((row) => this.model(row as TSandboxSelectOpts)) as SandboxModel[],
      }
    } catch (error: any) {
      return { error }
    }
  }

  async create(data: TSandboxInsertOpts | (TDBSandboxInsert & Record<string, any>)) {
    const { providerLinks, providerInputs, projects, ...sandboxData } =
      data as TSandboxInsertOpts
    const result = await super.create(sandboxData as TDBSandboxInsert)

    if (
      result.data &&
      (projects?.length || providerInputs?.length)
    ) {
      try {
        await this.#relations({
          projects,
          providerInputs,
          id: result.data.id,
        })
        const updated = await this.get(result.data.id)
        result.data = updated.data
      } catch (err) {
        await this.db
          .delete(sandboxes)
          .where(eq(sandboxes.id, result.data.id))
          .catch((cleanupErr) => {
            logger.error(
              `Failed to cleanup sandbox ${result.data!.id} after relation error`,
              {
                error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
              }
            )
          })
        throw err
      }
    }

    return result
  }

  async update(data: TDBUpdate<TSandboxInsertOpts>) {
    const { providerInputs, providerLinks, projects, ...sandboxData } = data

    if (!sandboxData.id)
      return { data: null, error: new DBError(`Sandbox ID is required for update`) }

    const result = await super.update(sandboxData)

    if (
      result.data &&
      (projects?.length || providerInputs !== undefined)
    ) {
      try {
        // Projects use delete+re-insert pattern (same as Agent)
        if (projects?.length)
          await this.db
            .delete(sandboxProjects)
            .where(eq(sandboxProjects.sandboxId, sandboxData.id))

        await this.#relations({
          projects,
          id: sandboxData.id,
          providerInputs,
        })
        const updated = await this.get(sandboxData.id)
        result.data = updated.data
      } catch (error: any) {
        return { data: undefined, error }
      }
    }

    return result
  }

  async listByOrg(orgId: string) {
    return this.list({ where: { orgId } })
  }

  /**
   * Add a sandbox to a project
   */
  async addProject(sandboxId: string, projectId: string, alias?: string) {
    const [result] = await this.db
      .insert(sandboxProjects)
      .values({
        alias,
        sandboxId,
        projectId,
      })
      .returning()

    return { data: result, error: null }
  }

  /**
   * Remove a sandbox from a project
   */
  async removeProject(sandboxId: string, projectId: string) {
    await this.db
      .delete(sandboxProjects)
      .where(
        and(
          eq(sandboxProjects.sandboxId, sandboxId),
          eq(sandboxProjects.projectId, projectId)
        )
      )

    return { data: null, error: null }
  }

  /**
   * Upsert project-level config overrides for a sandbox
   */
  async upsertProjectConfig(
    sandboxId: string,
    projectId: string,
    config: Partial<Omit<TSandboxProjectConfig, 'sandboxId' | 'projectId'>>
  ) {
    try {
      const [result] = await this.db
        .update(sandboxProjects)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sandboxProjects.sandboxId, sandboxId),
            eq(sandboxProjects.projectId, projectId)
          )
        )
        .returning()

      if (!result) return { error: new DBError(`Sandbox is not linked to this project`) }

      return { data: result }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get project-level config overrides for a sandbox
   */
  async getProjectConfig(sandboxId: string, projectId: string) {
    try {
      const result = await this.db.query.sandboxProjects.findFirst({
        where: and(
          eq(sandboxProjects.sandboxId, sandboxId),
          eq(sandboxProjects.projectId, projectId)
        ),
      })

      if (!result) return { error: new DBError(`Sandbox is not linked to this project`) }

      return {
        data: {
          sandboxId: result.sandboxId,
          projectId: result.projectId,
          alias: result.alias ?? null,
          enabled: result.enabled ?? true,
          config: result.config ?? null,
        } as TSandboxProjectConfig,
      }
    } catch (error: any) {
      return { error }
    }
  }

  async addProvider(
    sandboxId: string,
    providerId: string,
    priority: number = 0,
    model?: string | null
  ) {
    const [result] = await this.db
      .insert(sandboxProviders)
      .values({
        sandboxId,
        priority,
        providerId,
        model: model ?? null,
      })
      .returning()

    return { data: result, error: null }
  }

  async removeProvider(sandboxId: string, providerId: string) {
    await this.db
      .delete(sandboxProviders)
      .where(
        and(
          eq(sandboxProviders.sandboxId, sandboxId),
          eq(sandboxProviders.providerId, providerId)
        )
      )

    return { data: null, error: null }
  }

  async setProviders(sandboxId: string, inputs: TProviderInput[]) {
    await this.#upsertProviders(sandboxId, inputs)
    return { data: null, error: null }
  }

  #upsertProviders = async (sandboxId: string, inputs: TProviderInput[]) => {
    if (!inputs) return

    const rows = inputs
      .filter((p) => p.id)
      .map((p, i) => ({
        providerId: p.id,
        priority: i,
        sandboxId,
        model: p.model ?? null,
      }))

    await this.db.transaction(async (tx) => {
      if (rows.length) {
        await tx.delete(sandboxProviders).where(
          and(
            eq(sandboxProviders.sandboxId, sandboxId),
            notInArray(
              sandboxProviders.providerId,
              rows.map((r) => r.providerId)
            )
          )
        )
      } else {
        await tx.delete(sandboxProviders).where(eq(sandboxProviders.sandboxId, sandboxId))
      }

      if (rows.length) {
        await tx
          .insert(sandboxProviders)
          .values(rows)
          .onConflictDoUpdate({
            target: [sandboxProviders.sandboxId, sandboxProviders.providerId],
            set: {
              priority: sql`excluded.priority`,
              model: sql`excluded.model`,
            },
          })
      }
    })
  }
}
```

- [ ] **Step 2: Verify database types**

Run: `cd repos/database && pnpm types`
Expected: Clean type check

---

### Task 8: Update Backend `listSandboxes` Endpoint

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/listSandboxes.ts`

- [ ] **Step 1: Update to match `listAgents` pattern**

Replace `repos/backend/src/endpoints/sandboxes/listSandboxes.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { parsePagination } from '@TBE/utils/pagination'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  Exception,
  ERoleType,
  hasMinRole,
  EPermAction,
  EPermResource,
} from '@tdsk/domain'

export const listSandboxes: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.params.orgId || (req.query.orgId as string)
    const projectId = (req.params.projectId || req.query.projectId) as string | undefined

    if (!orgId) throw new Exception(400, `orgId is required`)

    await checkPermission(req, EPermAction.read, EPermResource.sandbox, { orgId })

    const userRole = await getUserRole(req, { orgId })
    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.sandbox.list({
      limit,
      offset,
      where: { orgId },
    })
    if (error) throw new Exception(500, error.message)

    let filteredData = data || []

    // Non-admins only see sandboxes in projects they are members of
    if (!hasMinRole(userRole, ERoleType.admin)) {
      const userId = req.user?.id
      if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

      const { data: userProjectIds, error: projErr } =
        await db.services.role.getUserProjects(userId)
      if (projErr) throw new Exception(500, `Failed to retrieve user projects`)

      const projectIdSet = new Set(userProjectIds || [])
      filteredData = filteredData.filter((sandbox) =>
        sandbox.projects?.some((p) => projectIdSet.has(p.id))
      )
    }

    // Further filter by specific projectId if requested
    if (projectId) {
      filteredData = filteredData.filter((sandbox) =>
        sandbox.projects?.some((p) => p.id === projectId)
      )
      // Merge project overrides into each sandbox
      filteredData = filteredData.map((sandbox) => sandbox.getEffectiveConfig(projectId))
    }

    res.status(200).json({ data: filteredData, limit, offset })
  },
}
```

- [ ] **Step 2: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 9: Update Backend `createSandbox` Endpoint

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/createSandbox.ts`

- [ ] **Step 1: Accept `projectIds` array, mirror `createAgent`**

Replace `repos/backend/src/endpoints/sandboxes/createSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EProvider, Sandbox, Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const createSandbox: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, config, projectIds = [], providerInputs } = req.body
    const orgId = req.params.orgId || req.body.orgId

    if (!name) throw new Exception(400, `Sandbox name is required`)
    if (!config?.image) throw new Exception(400, `Sandbox config.image is required`)
    if (!orgId) throw new Exception(400, `orgId is required`)
    if (config?.idleTimeoutMinutes != null && config.idleTimeoutMinutes < 1)
      throw new Exception(400, `idleTimeoutMinutes must be at least 1`)
    if (config?.gitBranch && !config?.gitRepo)
      throw new Exception(400, `gitBranch requires gitRepo to be set`)

    await checkPermission(req, EPermAction.create, EPermResource.sandbox, { orgId })

    const pins = await db.services.provider.validate({
      orgId,
      type: EProvider.ai,
      inputs: providerInputs,
    })

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds } })
      : { data: [] }

    if (projErr) throw new Exception(500, projErr.message)

    const sb = new Sandbox({
      name,
      orgId,
      config,
      builtIn: false,
      userId: req.user?.id,
    })

    const { data, error } = await db.services.sandbox.create({
      ...sb,
      ...(pins?.length ? { providerInputs: pins } : {}),
      ...(projects?.length ? { projects } : {}),
    })
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
```

- [ ] **Step 2: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 10: Update Backend `updateSandbox` Endpoint

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/updateSandbox.ts`

- [ ] **Step 1: Accept `projectIds` array, add project-context override path**

Replace `repos/backend/src/endpoints/sandboxes/updateSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EProvider, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const updateSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const existing = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    // Project context: update project-level overrides, not the base sandbox
    const { projectId } = req.params
    if (projectId) {
      const { alias, enabled, config } = req.body

      const overrides = Object.fromEntries(
        Object.entries({ alias, enabled, config }).filter(([, v]) => v !== undefined)
      )

      await db.services.sandbox.upsertProjectConfig(id, projectId, overrides)

      const { data: updatedSandbox } = await db.services.sandbox.get(id)
      if (!updatedSandbox) throw new Exception(500, `Failed to load updated sandbox`)

      const effectiveSandbox = updatedSandbox.getEffectiveConfig(projectId)
      res.status(200).json({ data: effectiveSandbox })
      return
    }

    const { name, config, projectIds = [], providerInputs } = req.body

    if (config?.idleTimeoutMinutes != null && config.idleTimeoutMinutes < 1)
      throw new Exception(400, `idleTimeoutMinutes must be at least 1`)
    if (config?.gitBranch && !config?.gitRepo)
      throw new Exception(400, `gitBranch requires gitRepo to be set`)

    const pins = await db.services.provider.validate({
      type: EProvider.ai,
      orgId: existing.orgId,
      inputs: providerInputs,
    })

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds } })
      : { data: [] }

    if (projErr) throw new Exception(500, projErr.message)

    const { data, error } = await db.services.sandbox.update({
      id,
      ...(name !== undefined && { name }),
      ...(config !== undefined && { config }),
      ...(pins !== undefined && { providerInputs: pins }),
      ...(projects?.length ? { projects } : {}),
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
```

- [ ] **Step 2: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 11: Create Sandbox Project Config Endpoints

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/sandboxProjectConfig.ts`

- [ ] **Step 1: Create the config endpoints (matching `agentProjectConfig.ts`)**

Create `repos/backend/src/endpoints/sandboxes/sandboxProjectConfig.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:sandboxId/config - Get sandbox project-level config overrides
 */
export const getSandboxProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    await checkPermission(req, EPermAction.read, EPermResource.sandbox, {
      orgId: sandbox.orgId,
    })

    const { data: config, error } = await db.services.sandbox.getProjectConfig(
      sandboxId,
      projectId
    )

    if (error)
      throw new Exception(
        404,
        `No config found for sandbox ${sandboxId} in project ${projectId}`
      )

    res.status(200).json({ data: config })
  },
}

/**
 * PUT /:sandboxId/config - Upsert sandbox project-level config overrides
 */
export const upsertSandboxProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    await checkPermission(req, EPermAction.update, EPermResource.sandbox, {
      orgId: sandbox.orgId,
    })

    const { alias, enabled, config } = req.body

    const overrides = Object.fromEntries(
      Object.entries({ alias, enabled, config }).filter(([, v]) => v !== undefined)
    )

    const { error: upsertError } = await db.services.sandbox.upsertProjectConfig(
      sandboxId,
      projectId,
      overrides
    )

    if (upsertError) throw new Exception(500, upsertError.message)

    const { data: updatedSandbox, error: refetchError } =
      await db.services.sandbox.get(sandboxId)
    if (refetchError || !updatedSandbox)
      throw new Exception(500, `Failed to fetch updated sandbox`)

    const effectiveSandbox = updatedSandbox.getEffectiveConfig(projectId)

    res.status(200).json({ data: effectiveSandbox })
  },
}

/**
 * DELETE /:sandboxId/config - Reset sandbox project-level config overrides
 */
export const deleteSandboxProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    await checkPermission(req, EPermAction.update, EPermResource.sandbox, {
      orgId: sandbox.orgId,
    })

    const { error } = await db.services.sandbox.upsertProjectConfig(sandboxId, projectId, {
      alias: null,
      enabled: true,
      config: null,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { id: sandboxId, configReset: true } })
  },
}
```

- [ ] **Step 2: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 12: Update Backend `copySandbox` Endpoint

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/copySandbox.ts`

- [ ] **Step 1: Remove `projectId` reference, copy project associations**

In `repos/backend/src/endpoints/sandboxes/copySandbox.ts`, update the Sandbox construction:

Replace:
```typescript
    const copy = new Sandbox({
      name,
      builtIn: false,
      orgId: original.orgId,
      userId: req.user?.id,
      config: { ...original.config },
      projectId: req.body.projectId ?? original.projectId,
    })

    const { data, error } = await db.services.sandbox.create(copy)
```

With:
```typescript
    const copy = new Sandbox({
      name,
      builtIn: false,
      orgId: original.orgId,
      userId: req.user?.id,
      config: { ...original.config },
    })

    const { data, error } = await db.services.sandbox.create({
      ...copy,
      ...(original.projects?.length ? { projects: original.projects } : {}),
    })
```

- [ ] **Step 2: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 13: Update Backend `startSandbox` Endpoint

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/startSandbox.ts`

- [ ] **Step 1: Update `projectId` resolution**

In `repos/backend/src/endpoints/sandboxes/startSandbox.ts`, update the projectId resolution:

Replace:
```typescript
    const projectId = req.body.projectId || sandbox.projectId
```

With:
```typescript
    const projectId = req.body.projectId || req.params.projectId || sandbox.projects?.[0]?.id
```

This uses: request body first, then URL param (for project-scoped routes), then falls back to the first linked project.

- [ ] **Step 2: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 14: Mount Sandboxes Under Projects in Backend Routing

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgProjects.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/sandboxes.ts`

- [ ] **Step 1: Add sandbox config and project-scoped sandboxes to orgProjects**

In `repos/backend/src/endpoints/orgs/orgProjects.ts`, add imports:

```typescript
import { getSandbox } from '@TBE/endpoints/sandboxes/getSandbox'
import { stopSandbox } from '@TBE/endpoints/sandboxes/stopSandbox'
import { copySandbox } from '@TBE/endpoints/sandboxes/copySandbox'
import { listSessions } from '@TBE/endpoints/sandboxes/listSessions'
import { startSandbox } from '@TBE/endpoints/sandboxes/startSandbox'
import { listSandboxes } from '@TBE/endpoints/sandboxes/listSandboxes'
import { execInSandbox } from '@TBE/endpoints/sandboxes/execInSandbox'
import { createSandbox } from '@TBE/endpoints/sandboxes/createSandbox'
import { updateSandbox } from '@TBE/endpoints/sandboxes/updateSandbox'
import { deleteSandbox } from '@TBE/endpoints/sandboxes/deleteSandbox'
import { connectSandbox } from '@TBE/endpoints/sandboxes/connectSandbox'
import { getSandboxStatus } from '@TBE/endpoints/sandboxes/getSandboxStatus'
import { listSandboxThreads } from '@TBE/endpoints/sandboxes/listSandboxThreads'
import {
  getSandboxProjectConfig,
  upsertSandboxProjectConfig,
  deleteSandboxProjectConfig,
} from '@TBE/endpoints/sandboxes/sandboxProjectConfig'
```

Add the sandbox config and project sandbox route configs (after `projectAgentConfig`):

```typescript
const projectSandboxConfig: TEndpointConfig = {
  path: `/:sandboxId/config`,
  method: EPMethod.Use,
  endpoints: {
    getSandboxProjectConfig,
    upsertSandboxProjectConfig,
    deleteSandboxProjectConfig,
  },
}

const projectSandboxes: TEndpointConfig = {
  path: `/:projectId/sandboxes`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    getSandbox,
    listSandboxes,
    createSandbox,
    updateSandbox,
    deleteSandbox,
    copySandbox,
    stopSandbox,
    startSandbox,
    execInSandbox,
    connectSandbox,
    listSessions,
    getSandboxStatus,
    listSandboxThreads,
    projectSandboxConfig,
  },
}
```

Add `projectSandboxes` to the `orgProjects` endpoints:

```typescript
export const orgProjects: TEndpointConfig = {
  path: `/:orgId/projects`,
  method: EPMethod.Use,
  endpoints: {
    // ... existing endpoints ...
    projectSandboxes,
  },
}
```

- [ ] **Step 2: Update the sandboxes.ts endpoints file to include config**

In `repos/backend/src/endpoints/sandboxes/sandboxes.ts`, add the import and endpoint registration for `sandboxProjectConfig` (these are for standalone `/sandboxes` route, not project-scoped):

No change needed here — the standalone `/sandboxes` route doesn't need project config endpoints since those require a `projectId` context.

- [ ] **Step 3: Verify backend types**

Run: `cd repos/backend && pnpm types`

---

### Task 15: Update Admin State — Context-Keyed Sandboxes

**Files:**
- Modify: `repos/admin/src/state/sandboxes.ts`

- [ ] **Step 1: Rewrite to match agents state pattern**

Replace `repos/admin/src/state/sandboxes.ts`:

```typescript
import type { Sandbox } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const sandboxesState = atomWithReset<Record<string, Record<string, Sandbox>>>(
  undefined
)

// Derived: org-level sandboxes
export const orgSandboxesState = atom((get) => get(sandboxesState)?.['org'])

// Derived: project-level sandboxes
export const projectSandboxesState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(sandboxesState)?.[projectId] : undefined
})

// Derived: active sandbox across all scopes
export const activeSandboxState = atom((get) => {
  const all = get(sandboxesState)
  if (!all) return undefined
  // Search all scopes for a sandbox — useful for detail views
  for (const scope of Object.values(all)) {
    if (scope) {
      const entries = Object.values(scope)
      if (entries.length) return entries[0]
    }
  }
  return undefined
})
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 16: Update Admin State Accessors

**Files:**
- Modify: `repos/admin/src/state/accessors.ts`

- [ ] **Step 1: Replace flat sandbox accessors with context-keyed ones**

In `repos/admin/src/state/accessors.ts`:

Find the sandbox accessor lines (around lines 125-128):
```typescript
export const getSandboxes = () => store.get(sandboxesState)
export const resetSandboxes = () => store.set(sandboxesState, undefined)
export const setSandboxes = (sandboxes: Record<string, Sandbox>) =>
  store.set(sandboxesState, sandboxes)
```

Replace with:
```typescript
export const getSandboxes = () => store.get(sandboxesState)
export const resetSandboxes = () => store.set(sandboxesState, undefined)
export const setSandboxes = (sandboxes: Record<string, Record<string, Sandbox>>) =>
  store.set(sandboxesState, sandboxes)
```

Then add context-keyed helpers at the bottom of the file (near `getContextAgents`/`setContextAgents`, around line 320+):

```typescript
export const getContextSandboxes = (key: string) => getSandboxes()?.[key]
export const setContextSandboxes = (key: string, sandboxes: Record<string, Sandbox>) => {
  const all = getSandboxes() || {}
  setSandboxes({ ...all, [key]: sandboxes })
}
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 17: Update Admin State Selectors

**Files:**
- Modify: `repos/admin/src/state/selectors.ts`

- [ ] **Step 1: Update sandbox selectors**

In `repos/admin/src/state/selectors.ts`:

Find the `useSandboxes` line (around line 118):
```typescript
export const useSandboxes = () => useRecState(sandboxesState)
```

This stays as-is (it returns the full context-keyed map).

Find the `useProjectSandboxes` line (around line 223-224):
```typescript
export const useProjectSandboxes = () =>
  useDerivedState<Record<string, Sandbox>>(projectSandboxesState)
```

This stays as-is (the derived state now comes from context key, not client-side filtering).

Add `useOrgSandboxes` near the other org-scoped selectors (around line 197, near `useOrgAgents`):

```typescript
export const useOrgSandboxes = () =>
  useDerivedState<Record<string, Sandbox>>(orgSandboxesState)
```

Add the import for `orgSandboxesState` at the top of the file, in the sandbox state imports:
```typescript
import { sandboxesState, orgSandboxesState, projectSandboxesState } from '@TAF/state/sandboxes'
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 18: Update Admin Sandbox API Service

**Files:**
- Modify: `repos/admin/src/services/sandboxApi.ts`

- [ ] **Step 1: Add dual-path routing and config endpoints**

In `repos/admin/src/services/sandboxApi.ts`:

Add `TSandboxProjectConfig` import:
```typescript
import type { TSandboxConnectResponse, TSandboxSession, TSandboxProjectConfig } from '@tdsk/domain'
```

Update `#path` for dual-path routing:
```typescript
  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/sandboxes`
      : `/orgs/${orgId}/sandboxes`
  }

  #configPath(orgId: string, projectId: string, sandboxId: string) {
    return `/orgs/${orgId}/projects/${projectId}/sandboxes/${sandboxId}/config`
  }
```

Update `list()` to accept optional `projectId`:
```typescript
  async list(
    orgId: string,
    projectId?: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Sandbox[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Sandbox[]>({
      data: rest,
      path: this.#path(orgId, projectId),
      queryKey: queryKey || this.cache.list(orgId, projectId || `org`),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Sandbox configs list`))

    return {
      ...resp,
      data: resp?.data?.map?.((s) => new Sandbox(s)) || [],
    }
  }
```

Update `get()` to accept optional `projectId`:
```typescript
  async get(orgId: string, id: string, projectId?: string): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.get<Sandbox>({
      path: `${this.#path(orgId, projectId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Sandbox config`))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }
```

Update `create()` to accept optional `projectId`:
```typescript
  async create(
    orgId: string,
    data: Partial<Sandbox>,
    projectId?: string
  ): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.post<Sandbox>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Sandbox config`))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }
```

Update `update()` to accept optional `projectId`:
```typescript
  async update(
    orgId: string,
    id: string,
    data: Partial<Sandbox>,
    projectId?: string
  ): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.put<Sandbox>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Sandbox config`))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }
```

Add config methods at the end of the class (before `copy()`):
```typescript
  async getConfig(
    orgId: string,
    projectId: string,
    sandboxId: string
  ): Promise<TApiRes<TSandboxProjectConfig>> {
    const resp = await this.api.get<TSandboxProjectConfig>({
      path: this.#configPath(orgId, projectId, sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load sandbox config`))

    return resp
  }

  async upsertConfig(
    orgId: string,
    projectId: string,
    sandboxId: string,
    data: Partial<TSandboxProjectConfig>
  ): Promise<TApiRes<TSandboxProjectConfig>> {
    const resp = await this.api.put<TSandboxProjectConfig>({
      data,
      path: this.#configPath(orgId, projectId, sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to save sandbox config`))

    return resp
  }

  async deleteConfig(
    orgId: string,
    projectId: string,
    sandboxId: string
  ): Promise<TApiRes<TSandboxProjectConfig>> {
    const resp = await this.api.delete<TSandboxProjectConfig>({
      path: this.#configPath(orgId, projectId, sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to reset sandbox config`))

    return resp
  }
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 19: Update Admin Sandbox Actions

**Files:**
- Modify: `repos/admin/src/actions/sandboxes/api/fetchSandboxes.ts`
- Modify: `repos/admin/src/actions/sandboxes/local/setSandboxes.ts`
- Modify: `repos/admin/src/actions/sandboxes/local/upsertSandbox.ts`
- Modify: `repos/admin/src/actions/sandboxes/api/createSandbox.ts`
- Modify: `repos/admin/src/actions/sandboxes/api/updateSandbox.ts`

- [ ] **Step 1: Update `fetchSandboxes`**

Replace `repos/admin/src/actions/sandboxes/api/fetchSandboxes.ts`:

```typescript
import { sandboxApi } from '@TAF/services'
import { setSandboxes } from '@TAF/actions/sandboxes/local/setSandboxes'

export type TFetchSandboxesOpts = {
  orgId: string
  projectId?: string
}

export const fetchSandboxes = async (opts: TFetchSandboxesOpts) => {
  const { orgId, projectId } = opts
  const resp = await sandboxApi.list(orgId, projectId)

  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && setSandboxes(contextKey, resp.data)
  return resp
}
```

- [ ] **Step 2: Update `setSandboxes`**

Replace `repos/admin/src/actions/sandboxes/local/setSandboxes.ts`:

```typescript
import type { Sandbox } from '@tdsk/domain'
import { setContextSandboxes } from '@TAF/state/accessors'

export const setSandboxes = (contextKey: string, sandboxes: Sandbox[]) => {
  const map = Object.fromEntries(sandboxes.map((s) => [s.id, s])) as Record<
    string,
    Sandbox
  >
  setContextSandboxes(contextKey, map)
}
```

- [ ] **Step 3: Update `upsertSandbox`**

Replace `repos/admin/src/actions/sandboxes/local/upsertSandbox.ts`:

```typescript
import type { Sandbox } from '@tdsk/domain'
import { getContextSandboxes, setContextSandboxes } from '@TAF/state/accessors'

export const upsertSandbox = (contextKey: string, sandbox: Sandbox) => {
  const current = getContextSandboxes(contextKey) || {}
  setContextSandboxes(contextKey, { ...current, [sandbox.id]: sandbox })
}
```

- [ ] **Step 4: Update `createSandbox`**

Replace `repos/admin/src/actions/sandboxes/api/createSandbox.ts`:

```typescript
import type { Sandbox } from '@tdsk/domain'

import { sandboxApi } from '@TAF/services'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export type TCreateSandboxOpts = {
  orgId: string
  projectId?: string
  data: Partial<Sandbox>
}

export const createSandbox = async (opts: TCreateSandboxOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await sandboxApi.create(orgId, data, projectId)

  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertSandbox(contextKey, resp.data)

  return resp
}
```

- [ ] **Step 5: Update `updateSandbox`**

Replace `repos/admin/src/actions/sandboxes/api/updateSandbox.ts`:

```typescript
import type { Sandbox } from '@tdsk/domain'

import { sandboxApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export type TUpdateSandboxOpts = {
  id: string
  orgId: string
  projectId?: string
  data: Partial<Sandbox>
}

export const updateSandbox = async (opts: TUpdateSandboxOpts) => {
  const { orgId, id, projectId, data } = opts
  const resp = await sandboxApi.update(orgId, id, data, projectId)

  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertSandbox(contextKey, resp.data)
  resp.data && query.upsertListCache(sandboxApi.cache.list(orgId, contextKey), resp.data)
  resp.data && query.updateDetailCache(sandboxApi.cache.detail(id), resp.data)

  return resp
}
```

- [ ] **Step 6: Update `deleteSandbox` to use contextKey**

Read `repos/admin/src/actions/sandboxes/api/deleteSandbox.ts` first, then update it to remove from the correct context scope. The delete action needs to remove the sandbox from whichever context scope it exists in. Since we don't know the context at delete time, we should search all scopes:

Replace `repos/admin/src/actions/sandboxes/api/deleteSandbox.ts` (read it first to see the current pattern, then adapt):

```typescript
import { sandboxApi } from '@TAF/services'
import { getSandboxes, setSandboxes } from '@TAF/state/accessors'

export type TDeleteSandboxOpts = {
  id: string
  orgId: string
}

export const deleteSandbox = async (opts: TDeleteSandboxOpts) => {
  const { orgId, id } = opts
  const resp = await sandboxApi.delete(orgId, id)

  if (resp.error) return { error: resp.error }

  // Remove from all context scopes
  const allScopes = getSandboxes()
  if (allScopes) {
    const updated = { ...allScopes }
    for (const [key, scope] of Object.entries(updated)) {
      if (scope?.[id]) {
        const { [id]: _, ...rest } = scope
        updated[key] = rest
      }
    }
    setSandboxes(updated)
  }

  return resp
}
```

- [ ] **Step 7: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 20: Update Admin Loaders

**Files:**
- Modify: `repos/admin/src/routes/loaders.ts`

- [ ] **Step 1: Update sandbox loaders to use context-keyed state**

In `repos/admin/src/routes/loaders.ts`:

Add `getContextSandboxes` to the import from `@TAF/state/accessors` (replace `getSandboxes` with `getContextSandboxes`):

```typescript
// In the import at the top, replace getSandboxes with getContextSandboxes:
getContextSandboxes,
```

Update `orgSandboxesLoader` (around line 121):

```typescript
export const orgSandboxesLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getProviders()) safeFetch(() => fetchProviders({ orgId }))

  if (!getContextSandboxes('org')) safeFetch(() => fetchSandboxes({ orgId }))

  return null
}
```

Update `projectSandboxesLoader` (around line 291):

```typescript
export const projectSandboxesLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  if (!getProviders()) safeFetch(() => fetchProviders({ orgId }))

  if (!getContextSandboxes(projectId))
    safeFetch(() => fetchSandboxes({ orgId, projectId }))

  return null
}
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 21: Update Admin `startSandbox` Action

**Files:**
- Modify: `repos/admin/src/actions/sandboxes/api/startSandbox.ts`

- [ ] **Step 1: Update to use sandbox's first linked project if no projectId provided**

In `repos/admin/src/actions/sandboxes/api/startSandbox.ts`, the current code passes `projectId` from the caller. The Sandboxes component currently uses `sandbox.projectId` — update to use `sandbox.projects?.[0]?.id`:

No change needed to this file — the caller (`Sandboxes.tsx`) is what needs updating. The `startSandbox` action already accepts an optional `projectId`. We'll update the component call in Task 22.

---

### Task 22: Update Admin Sandboxes Component

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/Sandboxes.tsx`

- [ ] **Step 1: Remove client-side projectId filtering, update project column**

In `repos/admin/src/components/Sandboxes/Sandboxes.tsx`:

Update the `filteredSandboxes` memo — remove the `projectId` client-side filter since data now comes pre-filtered from context-keyed state:

```typescript
  const filteredSandboxes = useMemo(() => {
    const sandboxArray = sandboxes ? Object.values(sandboxes) : []

    if (!searchQuery.trim()) return sandboxArray

    const query = searchQuery.toLowerCase()
    return sandboxArray.filter(
      (sandbox) =>
        sandbox.name?.toLowerCase().includes(query) ||
        sandbox.config?.image?.toLowerCase().includes(query)
    )
  }, [sandboxes, searchQuery])
```

Update the `sandboxCount` memo:

```typescript
  const sandboxCount = useMemo(() => {
    return sandboxes ? Object.values(sandboxes).length : 0
  }, [sandboxes])
```

Remove `isProjectContext` and `isOrgContext` variables (no longer needed for filtering).

Update the "Project" column in org context — show project names from `sandbox.projects` instead of `sandbox.projectId`:

```typescript
    ...(projectId
      ? []
      : [
          {
            id: `project`,
            label: `Projects`,
            render: (sandbox: Sandbox) => (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {sandbox.projects?.length
                  ? sandbox.projects.map((p) => p.name).join(', ')
                  : `—`}
              </Typography>
            ),
          } as TDataTableColumn<Sandbox>,
        ]),
```

Update the `onStartSandbox` handler — replace `sandbox.projectId` with `sandbox.projects?.[0]?.id`:

```typescript
    const result = await startSandbox({
      orgId,
      sandboxId: sandbox.id,
      projectId: sandbox.projects?.[0]?.id,
    })
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 23: Update Admin SandboxDrawer — Add Project Multi-Select

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`

- [ ] **Step 1: Add project multi-select (matching AgentDrawer pattern)**

In `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`:

Add `useProjects` to the selectors import:
```typescript
import { useProviders, useProjects, useOrgSecrets, useProjectSecrets } from '@TAF/state/selectors'
```

Add `Autocomplete` and `TextField` to the MUI imports:
```typescript
import {
  Box,
  Chip,
  Alert,
  Button,
  Switch,
  Accordion,
  TextField,
  Typography,
  Autocomplete,
  FormControlLabel,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
```

Add project state inside the component (after the provider linking section):

```typescript
  // Project linking
  const [projectsMap] = useProjects()
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])

  const orgProjects = useMemo(
    () => Object.values(projectsMap || {}).map((p) => ({ id: p.id, name: p.name })),
    [projectsMap]
  )
```

Update the `useEffect` that populates form in edit mode — add project initialization after the existing `setProviderIds` line:

```typescript
      // After setProviderIds line:
      setSelectedProjectIds(
        sandbox.projects?.map((p) => p.id) || (projectId ? [projectId] : [])
      )
```

Add `setSelectedProjectIds([])` to the `reset()` function.

Update `sandboxData` in the `onSave` handler — add `projectIds`:

```typescript
    const sandboxData = {
      name: name.trim(),
      projectIds: selectedProjectIds,
      providerInputs: providerIds.map((id) => ({
        id,
        model: providerModels[id] || null,
      })),
      config: {
        // ... existing config ...
      },
    }
```

Add the project selector JSX after the Name `TextInput` (around line 465):

```typescript
          {/* Projects */}
          <Autocomplete
            multiple
            id='sandbox-projects'
            value={selectedProjectIds}
            options={orgProjects.map((p) => p.id)}
            getOptionLabel={(id) =>
              orgProjects.find((p) => p.id === id)?.name || id
            }
            onChange={(_, updates) => setSelectedProjectIds(updates)}
            disabled={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label='Projects'
                placeholder='Select projects...'
                size='small'
              />
            )}
          />
```

- [ ] **Step 2: Verify admin types**

Run: `cd repos/admin && pnpm types`

---

### Task 24: Run Full Type Checks

**Files:** None (validation only)

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: All repos pass type checks

- [ ] **Step 2: Run unit tests**

Run: `pnpm test`
Expected: All existing unit tests pass (some may need updates if they reference `sandbox.projectId`)

- [ ] **Step 3: Fix any type errors or test failures**

If any tests reference `sandbox.projectId`, update them to use `sandbox.projects` instead.

---

### Task 25: Database Schema Push

**Files:** None (manual operation)

> **NOTE:** This step requires manual user intervention. Claude cannot run `pnpm push` as it's interactive.

- [ ] **Step 1: Inform user to push schema**

The user must run from `repos/database/`:
```bash
cd repos/database && pnpm push
```

This will:
1. Create the `sandbox_projects` table
2. Drop the `projectId` column from `sandboxes`
3. Drop the `sandboxes_project_idx` index

**Data migration:** If any existing sandboxes have a non-null `projectId`, the user should first run a manual SQL query to create corresponding `sandbox_projects` rows before the column drop:

```sql
INSERT INTO sandbox_projects (id, sandbox_id, project_id, alias, created_at, updated_at)
SELECT
  concat('sp', substr(md5(random()::text), 1, 7)),
  id,
  project_id,
  name,
  NOW(),
  NOW()
FROM sandboxes
WHERE project_id IS NOT NULL;
```

Then proceed with `pnpm push`.

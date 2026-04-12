# Sandbox-Project Many-to-Many with Per-Project Config Override

**Date:** 2026-04-10
**Status:** Draft
**Scope:** database, domain, backend, admin

## Problem

Sandboxes currently use a one-to-many relationship with projects via a direct `projectId` FK on the `sandboxes` table. This means each sandbox belongs to at most one project. Agents, by contrast, use a many-to-many relationship via the `agent_projects` junction table, allowing one agent to be shared across multiple projects with per-project configuration overrides.

Sandboxes should match the Agent pattern exactly: one org to many sandboxes, many projects to many sandboxes, with per-project config overrides stored on the junction table.

## Design

### Junction Table: `sandbox_projects`

New junction table mirroring `agent_projects`, with a single JSONB config override column instead of individual override columns. This is cleaner for sandboxes because the base sandbox config is already a JSONB blob (`TKubeSandboxConfig`).

**Schema columns:**
- `...base` (id, createdAt, updatedAt)
- `sandboxId` — FK to sandboxes, cascade delete, NOT NULL
- `projectId` — FK to projects, cascade delete, NOT NULL
- `alias` — text, nullable (display name override for sandbox in project context)
- `enabled` — boolean, default true (whether sandbox is active in this project)
- `config` — jsonb, nullable (`Partial<TKubeSandboxConfig>`) — per-project config override, deep-merged with base config (project wins)

**Constraints:**
- `unique(sandboxId, projectId)` — one link per sandbox-project pair

**Relations:**
- `sandbox: one(sandboxes)` via `sandboxId`
- `project: one(projects)` via `projectId`

### Schema Changes to `sandboxes` Table

- **Remove** `projectId` column and its FK/index
- **Replace** `project: one(projects)` relation with `projects: many(sandboxProjects)`

### Schema Changes to `projects` Table

- **Replace** `sandboxes: many(sandboxes)` with `sandboxes: many(sandboxProjects)`

### Domain Model: `Sandbox`

Update to match Agent's pattern:

```typescript
class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  // REMOVE: projectId?: string
  builtIn: boolean = false
  config: TKubeSandboxConfig
  providerLinks: TProviderLink[] = []
  projects: Project[] = []                      // NEW: associated projects
  projectConfigs: TSandboxProjectConfig[] = []   // NEW: per-project overrides
}
```

**New methods (matching Agent):**
- `getProjectConfig(projectId: string): TSandboxProjectConfig | undefined`
- `getEffectiveConfig(projectId?: string): Sandbox` — returns new Sandbox with project config deep-merged into base config. Merge rules: `alias` replaces name display, `config` is deep-merged (project values win, nested objects like `resources`, `envVars` are merged)

### Domain Type: `TSandboxProjectConfig`

New type in `repos/domain/src/types/sandbox.types.ts`:

```typescript
export type TSandboxProjectConfig = {
  sandboxId: string
  projectId: string
  alias?: string | null
  enabled?: boolean
  config?: Partial<TKubeSandboxConfig> | null
}
```

### Database Service: `Sandbox`

Mirror Agent service patterns:

**`with()` update:**
```typescript
with = (opts) => ({
  ...opts,
  projects: { with: { project: true } },
  providers: { with: { provider: true } },
})
```

**`model()` update:**
Extract junction records into `projects` and `projectConfigs` arrays (like Agent service does).

**New methods:**
- `addProject(sandboxId, projectId, alias?)` — insert junction record
- `removeProject(sandboxId, projectId)` — delete junction record
- `upsertProjectConfig(sandboxId, projectId, config)` — update junction record override fields

**`create()` / `update()` updates:**
Accept `projects` array in input. On create, insert junction records. On update, delete+re-insert junction records (same pattern as Agent's `#relations`).

**Remove:** `listByProject(projectId)` — no longer needed; project filtering moves to the junction table relation.

### Backend Endpoints

#### `listSandboxes` (GET `/`)

Update to match `listAgents` pattern:
1. Fetch all org sandboxes with junction data loaded
2. For non-admins: filter to sandboxes in projects the user is a member of
3. If `projectId` param provided: further filter to sandboxes linked to that project, apply `getEffectiveConfig(projectId)`

#### `createSandbox` (POST `/`)

Accept `projectIds: string[]` (replaces `projectId: string`). After creating sandbox, insert junction records for each project. Load projects from DB to validate they exist and belong to the org.

#### `updateSandbox` (PUT `/:id`)

Accept `projectIds: string[]` (replaces `projectId: string`). On update, delete existing junction records and re-insert (same pattern as Agent update).

#### Mount under projects

Add `projectSandboxes` config in `orgProjects.ts`, matching `projectAgents`:

```typescript
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
    startSandbox,
    stopSandbox,
    connectSandbox,
    listSessions,
    execInSandbox,
    getSandboxStatus,
    listSandboxThreads,
  },
}
```

This provides dual-path routing:
- Org-scoped: `GET /orgs/:orgId/sandboxes`
- Project-scoped: `GET /orgs/:orgId/projects/:projectId/sandboxes`

#### Sandbox Project Config Endpoints

New endpoints matching `agentProjectConfig.ts`:
- `GET /:sandboxId/config` — get per-project config for a sandbox
- `PUT /:sandboxId/config` — upsert per-project config
- `DELETE /:sandboxId/config` — reset per-project config to null (inherit base)

These are mounted under `projectSandboxes` as a sub-router.

### Admin UI

#### State (`state/sandboxes.ts`)

Change from flat map to context-keyed map (matching `state/agents.ts`):

```typescript
// Keyed by contextKey (projectId or 'org')
export const sandboxesState = atomWithReset<Record<string, Record<string, Sandbox>>>()

// Derived: org-level sandboxes
export const orgSandboxesState = atom(get => get(sandboxesState)?.['org'])

// Derived: project-level sandboxes
export const projectSandboxesState = atom(get => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(sandboxesState)?.[projectId] : undefined
})

// Derived: active sandbox across all scopes
export const activeSandboxState = atom(get => {
  const sandboxId = get(activeSandboxIdState)
  if (!sandboxId) return undefined
  const all = get(sandboxesState)
  if (!all) return undefined
  for (const scope of Object.values(all)) {
    if (scope?.[sandboxId]) return scope[sandboxId]
  }
  return undefined
})
```

#### State Accessors

Add context-keyed accessors (matching agents):
- `getContextSandboxes(key: string)` → `getSandboxes()?.[key]`
- `setContextSandboxes(key: string, sandboxes: Record<string, Sandbox>)` — merges into state

#### API Service (`services/sandboxApi.ts`)

Update `#path()` for dual-path routing:
```typescript
#path(orgId: string, projectId?: string) {
  return projectId
    ? `/orgs/${orgId}/projects/${projectId}/sandboxes`
    : `/orgs/${orgId}/sandboxes`
}
```

Update `list()`, `create()`, `update()`, `get()` to accept optional `projectId`.

Add config endpoints (matching `agentsApi`):
- `getConfig(orgId, projectId, sandboxId)`
- `upsertConfig(orgId, projectId, sandboxId, data)`
- `deleteConfig(orgId, projectId, sandboxId)`

#### Actions

**`fetchSandboxes`**: Accept `projectId`, use `contextKey` pattern:
```typescript
export const fetchSandboxes = async ({ orgId, projectId }) => {
  const resp = await sandboxApi.list(orgId, projectId)
  const contextKey = projectId || 'org'
  resp.data && setSandboxes(contextKey, resp.data)
  return resp
}
```

**`setSandboxes`**: Accept `contextKey` parameter.

**`upsertSandbox`**: Accept `contextKey` parameter.

**`createSandbox` / `updateSandbox`**: Pass `projectIds` array instead of single `projectId`.

#### Loaders (`routes/loaders.ts`)

**`orgSandboxesLoader`**: Use `getContextSandboxes('org')` check.

**`projectSandboxesLoader`**: Use `getContextSandboxes(projectId)` check, fetch with `projectId`.

#### Components

**`Sandboxes` component**: Remove client-side `projectId` filtering. Data comes pre-filtered from the context-keyed state. Update org-level "Project" column to show `sandbox.projects` names.

**`SandboxDrawer`**: Add multi-project selector (like AgentDrawer). On create, send `projectIds` array. In project context, show per-project config override UI.

### Config Merge Strategy

`getEffectiveConfig(projectId)` creates a new Sandbox instance with merged config:

```typescript
getEffectiveConfig(projectId?: string): Sandbox {
  if (!projectId) return this
  const pc = this.getProjectConfig(projectId)
  if (!pc) return this

  return new Sandbox({
    ...this,
    projects: this.projects,
    projectConfigs: this.projectConfigs,
    providerLinks: this.providerLinks,
    config: {
      ...this.config,
      ...(pc.config || {}),
      // Deep-merge nested objects
      envVars: { ...this.config.envVars, ...(pc.config?.envVars || {}) },
      resources: {
        limits: { ...this.config.resources?.limits, ...pc.config?.resources?.limits },
        requests: { ...this.config.resources?.requests, ...pc.config?.resources?.requests },
      },
      ports: { ...this.config.ports, ...(pc.config?.ports || {}) },
    },
  })
}
```

Top-level config fields (image, runtime, initScript, etc.) are replaced. Nested objects (envVars, resources, ports) are shallow-merged with project values winning.

### Migration Notes

- The `projectId` column is removed from `sandboxes`. Existing sandbox-project associations need to be migrated to `sandbox_projects` junction records.
- Since this is a dev environment using `drizzle-kit push`, no formal migration script is needed — but the user must run `pnpm push` from `repos/database/` and manually confirm the schema changes.
- Existing data: any sandbox with a non-null `projectId` should get a corresponding `sandbox_projects` row created before the column is dropped. This can be done via a manual SQL query before push, or by accepting that the dev environment can be re-seeded.

### Files Changed

| Repo | File | Change |
|------|------|--------|
| database | `schemas/sandboxProjects.ts` | NEW — junction table schema |
| database | `schemas/sandboxes.ts` | Remove `projectId` column, update relations |
| database | `schemas/projects.ts` | Update back-reference relation |
| database | `schemas/schemas.ts` | Export new schema |
| database | `services/sandbox.ts` | Add project methods, update model/with/create/update |
| database | `types/` | Update select/insert types |
| domain | `types/sandbox.types.ts` | Add `TSandboxProjectConfig` type |
| domain | `models/sandbox.ts` | Add `projects`, `projectConfigs`, `getEffectiveConfig()`, `getProjectConfig()` |
| backend | `endpoints/sandboxes/listSandboxes.ts` | Add junction-based filtering + effective config |
| backend | `endpoints/sandboxes/createSandbox.ts` | Accept `projectIds` array |
| backend | `endpoints/sandboxes/updateSandbox.ts` | Accept `projectIds` array |
| backend | `endpoints/sandboxes/sandboxProjectConfig.ts` | NEW — get/upsert/delete per-project config |
| backend | `endpoints/orgs/orgProjects.ts` | Mount `projectSandboxes` sub-router |
| admin | `state/sandboxes.ts` | Context-keyed state atoms |
| admin | `state/accessors.ts` | Add context-keyed sandbox accessors |
| admin | `services/sandboxApi.ts` | Dual-path routing, config endpoints |
| admin | `actions/sandboxes/api/fetchSandboxes.ts` | Accept `projectId`, context key |
| admin | `actions/sandboxes/local/setSandboxes.ts` | Accept `contextKey` |
| admin | `actions/sandboxes/local/upsertSandbox.ts` | Accept `contextKey` |
| admin | `actions/sandboxes/api/createSandbox.ts` | `projectIds` array |
| admin | `actions/sandboxes/api/updateSandbox.ts` | `projectIds` array |
| admin | `routes/loaders.ts` | Context-keyed sandbox loader checks |
| admin | `components/Sandboxes/Sandboxes.tsx` | Remove client-side filtering, use context state |
| admin | `components/Sandboxes/SandboxDrawer.tsx` | Multi-project selector, config override UI |

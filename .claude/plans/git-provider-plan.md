## Context

Git-related config is scattered across the codebase as ad-hoc fields (`gitRepo`, `gitBranch`, `gitTokenSecretId` on sandbox config; `gitUrl`, `branch` on projects) with no connection to the Provider system. AI and Docker Providers have full integration: templates, brand validation, junction tables, credential injection, UI support.

This plan promotes Git Providers to first-class citizens following the same patterns as AI and Docker Providers. Each Git Provider is a complete **repo + auth unit** — it carries the repo URL, branch, and authentication token. Multiple git providers can be linked to projects and sandboxes, enabling multi-repo cloning.

**Changes since original plan (`.claude/plans/git-provider-plan.md`):**
1. **Docker providers now exist** — `EDockerProviderBrand`, `TDockerProviderTemplate`, `DockerRegistryDefaults`, `validateDocker` establish the exact pattern Git should follow
2. **LLM naming persists** — `ELLMProviderBrand`, `TLLMProviderBrand`, `LLMProviderTemplates`, `TProviderTemplate` still use LLM/generic names; user wants these renamed to AI-prefixed to align with `EProvider.ai`
3. **SandboxDrawer was split** — Now `OrgSandboxDrawer` + `ProjectSandboxDrawer` + shared `useSandboxForm` hook; both use `SandboxProviderAccordion` component for provider linking
4. **`ERuntimeBrand`** enum in `sandbox.types.ts` directly references `ELLMProviderBrand` enum values — must be updated in the rename phase

**Key design decisions:**
- Each Git Provider = one repo + auth unit. `options` stores `repoUrl` and `branch`, `secretId` stores the auth token
- New `project_providers` junction table links **multiple** git providers to a project (many-to-many) — this defines the **available pool** of repos for the project
- Existing `sandbox_providers` junction links git providers to sandboxes — this defines **which repos a specific sandbox actually clones**
- New nullable `projectId` column on `sandbox_providers` — scopes provider links to a project context. Git providers saved from a project context get `projectId` set; AI/Docker providers keep `projectId = null` (always included regardless of project context)
- Project `gitUrl`/`branch` columns removed — replaced entirely by linked git providers
- Sandbox config `gitRepo`/`gitBranch`/`gitTokenSecretId` fields removed — same replacement
- No automatic inheritance — each sandbox explicitly selects its repos

**Multi-repo cloning flow:**
1. A project links to N git providers via `project_providers` (e.g., main app repo + shared lib repo + config repo). This is the project's repo pool.
2. When creating/editing a project sandbox, the UI shows the project's git providers as selectable options. The user picks which repos this sandbox should clone (e.g., main app + shared lib, but not config).
3. Selected git providers are saved as `sandbox_providers` links with `projectId` set to the current project. This scopes the selection — if the sandbox is shared across projects, each project's git selections are isolated.
4. Org-level sandboxes (no project) link git providers with `projectId = null`.
5. On sandbox startup, `startPod` receives the current `projectId` and filters `sandbox_providers`:
   - Links with `projectId = null` → always included (AI providers, Docker registries, org-level git repos)
   - Links with `projectId` matching current project → included
   - Links with `projectId` not matching → skipped
6. Included git providers are converted to indexed env vars:
   - `TDSK_GIT_COUNT=N`
   - `TDSK_GIT_0_REPO`, `TDSK_GIT_0_BRANCH`, `TDSK_GIT_0_TOKEN`, `TDSK_GIT_0_BRAND`
   - `TDSK_GIT_1_REPO`, `TDSK_GIT_1_BRANCH`, `TDSK_GIT_1_TOKEN`, `TDSK_GIT_1_BRAND`
   - ...etc
7. The init container reads these indexed vars and clones all selected repos into the sandbox workspace

---

## Phase 0: LLM-to-AI Rename (Mechanical, Isolated)

No new features. Pure rename refactor. Can ship independently before any git provider work.

### Task 0.1 — Rename enum, type, and constant definitions in domain

**`repos/domain/src/types/ai.types.ts`**
- Rename `ELLMProviderBrand` → `EAIProviderBrand` (line 118)
- Rename `TLLMProviderBrand` → `TAIProviderBrand` (line 145)
- Comments referencing "LLM" updated to "AI"

**`repos/domain/src/types/provider.types.ts`**
- Rename `TProviderTemplate` → `TAIProviderTemplate` (line 79)
- Update `TAIProviderTemplate.id` type: `TLLMProviderBrand` → `TAIProviderBrand` (line 82)
- Update import on line 3: `TLLMProviderBrand` → `TAIProviderBrand`
- Update `TProviderBrand` union on line 35: `TLLMProviderBrand` → `TAIProviderBrand`

**`repos/domain/src/types/sandbox.types.ts`**
- Update import on line 4: `ELLMProviderBrand` → `EAIProviderBrand`
- Update `ERuntimeBrand` enum values (lines 14-24): all `ELLMProviderBrand.*` → `EAIProviderBrand.*`
- Update comment block (lines 7-11): "LLM provider" → "AI provider"

**`repos/domain/src/constants/providers.ts`**
- Rename `LLMProviderTemplates` → `AIProviderTemplates` (line 53)
- Update type annotation: `Partial<Record<ELLMProviderBrand, TProviderTemplate>>` → `Partial<Record<EAIProviderBrand, TAIProviderTemplate>>`
- Update all `ELLMProviderBrand.*` references (lines 55-103) → `EAIProviderBrand.*`
- Update imports (lines 1-2)

### Task 0.2 — Update all consumers

**Database:**
- `repos/database/src/services/provider.ts` — update imports (lines 3, 16), `validLLMProviders` → `validAIProviders` (line 22), `validateLLM` → `validateAI` (line 66), `resolveLLMBrand` → `resolveAIBrand` (line 94), all `ELLMProviderBrand` → `EAIProviderBrand`
- `repos/database/src/seeds/fullorg.ts` — update import (line 30), 6 brand references (lines 240-302)

**Backend:**
- `repos/backend/src/endpoints/providers/fetchModels.ts` — update imports (line 8), `validBrands` (line 10), all `ELLMProviderBrand` references (lines 29-60), `LLMProviderTemplates` → `AIProviderTemplates` (line 42)
- `repos/backend/src/endpoints/providers/createProvider.ts` — `validateLLM` → `validateAI`
- `repos/backend/src/endpoints/providers/updateProvider.ts` — `validateLLM` → `validateAI`

**Admin:**
- `repos/admin/src/types/onboarding.types.ts` — `TLLMProviderBrand` → `TAIProviderBrand` (lines 1, 18, 87)
- `repos/admin/src/constants/providers.ts` — `ELLMProviderBrand` → `EAIProviderBrand` (lines 8, 33, 40-46)
- `repos/admin/src/components/Providers/ProviderDrawer.tsx` — `TLLMProviderBrand` → `TAIProviderBrand` (line 8), `ELLMProviderBrand` → `EAIProviderBrand` (line 14), `LLMProviderTemplates` → `AIProviderTemplates` (line 15), `LLMProviderOptions` rename (line 45), all downstream references
- `repos/admin/src/components/Agents/ModelSelect.tsx` — `TLLMProviderBrand` → `TAIProviderBrand` (lines 1, 16)
- `repos/admin/src/components/Onboarding/steps/ProviderStep.tsx` — `TLLMProviderBrand` → `TAIProviderBrand` (lines 1, 23, 48, 65), `LLMProviderTemplates` → `AIProviderTemplates` (lines 7, 22, 24, 257-258)

**TSA:**
- `repos/tsa/src/types/session.types.ts` — `TLLMProviderBrand` → `TAIProviderBrand` (lines 1, 7, 24)

**Integration:**
- `repos/integration/src/utils/fixtures.ts` — `TLLMProviderBrand` → `TAIProviderBrand` (lines 1, 16)

### Task 0.3 — Verification

- `grep -rn "ELLMProviderBrand\|TLLMProviderBrand\|LLMProviderTemplates\|TProviderTemplate[^B]" repos/ --include="*.ts" --include="*.tsx" | grep -v node_modules` returns zero hits
- `pnpm types` from root — all repos pass
- `pnpm test` in domain, database, backend
- `pnpm build` for backend, admin

---

## Phase 1: Domain Type & Constant Foundation

No database or backend changes. Establishes the type system for git providers.

### Task 1.1 — Expand `EGitProvider` enum

**File:** `repos/domain/src/types/git.types.ts`

Currently only `github` and `gitlab`. Add `bitbucket`, `azureDevops`, `gitea`, `custom`:
```typescript
export enum EGitProvider {
  gitea = `gitea`,
  github = `github`,
  gitlab = `gitlab`,
  custom = `custom`,
  bitbucket = `bitbucket`,
  azureDevops = `azure-devops`,
}
```

### Task 1.2 — Remove legacy git fields and update domain types

**`repos/domain/src/types/sandbox.types.ts`**
- Remove `gitRepo`, `gitBranch`, `gitTokenSecretId` from `TKubeSandboxConfig`

**`repos/domain/src/types/provider.types.ts`**
- Add optional `projectId` to `TProviderLink`:
  ```typescript
  export type TProviderLink = {
    priority: number
    provider: Provider
    model?: string | null
    projectId?: string | null
  }
  ```
- Add optional `projectId` to `TProviderInput`:
  ```typescript
  export type TProviderInput = {
    id: string
    model?: string | null
    projectId?: string | null
  }
  ```

**`repos/domain/src/models/project.ts`**
- Remove direct `gitUrl` and `branch` fields
- Add `providerLinks: TProviderLink[] = []`
- Add derived getters:
  ```typescript
  get providers(): Provider[] { return this.providerLinks.map(l => l.provider) }
  get gitProviders(): Provider[] { return this.providers.filter(p => p.type === 'git') }
  get primaryGitProvider(): Provider | undefined { return this.gitProviders[0] }
  get gitUrl(): string | undefined { return this.primaryGitProvider?.options?.repoUrl as string | undefined }
  get branch(): string { return (this.primaryGitProvider?.options?.branch as string) || 'main' }
  ```

### Task 1.3 — Create `TGitProviderTemplate` type

**File:** `repos/domain/src/types/provider.types.ts`

Add new type following `TDockerProviderTemplate` pattern (lines 88-93):
```typescript
export type TGitProviderTemplate = {
  name: string
  id: TGitBrand
  gitDomain: string
  apiUrlBase: string
  tokenPattern?: string
  tokenPlaceholder: string
  defaultSecretName: string
}
```

### Task 1.3 — Create `GitProviderTemplates` constant

**File:** `repos/domain/src/constants/gitProviders.ts` (new)

Following `DockerRegistryDefaults` pattern in `repos/domain/src/constants/providers.ts` (lines 12-46):
```typescript
export const GitProviderTemplates: Partial<Record<EGitProvider, TGitProviderTemplate>> = {
  [EGitProvider.github]:      { id: 'github',       name: 'GitHub',       gitDomain: 'github.com',    apiUrlBase: 'https://api.github.com',       defaultSecretName: 'GITHUB_TOKEN',       tokenPlaceholder: 'ghp_...',                     tokenPattern: '^(ghp_|github_pat_)' },
  [EGitProvider.gitlab]:      { id: 'gitlab',       name: 'GitLab',       gitDomain: 'gitlab.com',    apiUrlBase: 'https://gitlab.com/api/v4',    defaultSecretName: 'GITLAB_TOKEN',       tokenPlaceholder: 'glpat-...',                   tokenPattern: '^glpat-' },
  [EGitProvider.bitbucket]:   { id: 'bitbucket',    name: 'Bitbucket',    gitDomain: 'bitbucket.org', apiUrlBase: 'https://api.bitbucket.org/2.0', defaultSecretName: 'BITBUCKET_TOKEN',    tokenPlaceholder: 'Enter Bitbucket app password...' },
  [EGitProvider.azureDevops]: { id: 'azure-devops', name: 'Azure DevOps', gitDomain: 'dev.azure.com', apiUrlBase: 'https://dev.azure.com',        defaultSecretName: 'AZURE_DEVOPS_TOKEN', tokenPlaceholder: 'Enter Azure DevOps PAT...' },
  [EGitProvider.gitea]:       { id: 'gitea',        name: 'Gitea',        gitDomain: '',              apiUrlBase: '',                              defaultSecretName: 'GITEA_TOKEN',        tokenPlaceholder: 'Enter Gitea access token...' },
  [EGitProvider.custom]:      { id: 'custom',       name: 'Custom',       gitDomain: '',              apiUrlBase: '',                              defaultSecretName: 'CUSTOM_GIT_TOKEN',   tokenPlaceholder: 'Enter access token...' },
}
```

Export from `repos/domain/src/constants/index.ts`.

### Task 1.4 — Add git brand domains to `ProviderBrandDomains`

**File:** `repos/domain/src/constants/providerDomains.ts`

Add after existing AI brands (line 24):
```typescript
github: ['github.com', 'api.github.com'],
gitlab: ['gitlab.com'],
bitbucket: ['bitbucket.org', 'api.bitbucket.org'],
'azure-devops': ['dev.azure.com'],
```

### Task 1.5 — Add git provider icons and options to admin constants

**File:** `repos/admin/src/constants/providers.ts`

Add `GitProviderOptions` array (parallel to `DockerProviderOptions` at line 26):
```typescript
export const GitProviderOptions = Object.values(EGitProvider).map((value) => ({
  value,
  label: GitProviderTemplates[value]?.name || wordCaps(value),
}))
```

Add git brand entries to `ProviderIcons`:
```typescript
github: GitHubIcon,  // @mui/icons-material/GitHub
gitlab: CodeIcon,
bitbucket: CodeIcon,
'azure-devops': CodeIcon,
gitea: CodeIcon,
```

### Task 1.6 — Unit tests for new constants

**File:** `repos/domain/src/constants/gitProviders.test.ts` (new)

Test all git provider templates have required fields (name, id, defaultSecretName, tokenPlaceholder).

---

## Phase 2: Database Schema

### Task 2.1 — Create `project_providers` junction table

**File:** `repos/database/src/schemas/projectProviders.ts` (new)

Following `sandboxProviders.ts` pattern:
```typescript
export const projectProviders = pgTable('project_providers', {
  ...base,
  projectId: varchar('project_id', { length: 10 })
    .references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  providerId: varchar('provider_id', { length: 10 })
    .references(() => providers.id, { onDelete: 'restrict' }).notNull(),
  priority: integer('priority').default(0),
}, (table) => [
  unique('unique_project_provider').on(table.projectId, table.providerId),
  index('idx_project_provider_project').on(table.projectId),
])
```

Add `projectProvidersRelations` with `one(projects)` and `one(providers)`.

No `model` column — git providers don't have model selection.

### Task 2.2 — Add nullable `projectId` to `sandbox_providers`

**File:** `repos/database/src/schemas/sandboxProviders.ts`

Add nullable `projectId` column:
```typescript
projectId: varchar('project_id', { length: 10 })
  .references(() => projects.id, { onDelete: 'cascade' }),
```

This scopes provider links to a project context. When `null`, the link applies regardless of project (AI, Docker, org-level git). When set, the link only applies when the sandbox is used in that project's context.

Add relation: `project: one(projects)` to `sandboxProvidersRelations`.

### Task 2.3 — Register project_providers schema and update relations

- `repos/database/src/schemas/schemas.ts` — export `projectProviders` and `projectProvidersRelations`
- `repos/database/src/schemas/projects.ts` — replace stale `providers: many(providers)` relation with `providerLinks: many(projectProviders)`, import `projectProviders`
- `repos/database/src/schemas/providers.ts` — add `projects: many(projectProviders)` to `providersRelations`

### Task 2.4 — Remove `gitUrl` and `branch` columns from projects table

**File:** `repos/database/src/schemas/projects.ts`

Remove `gitUrl` (line 17) and `branch` (line 20) columns. Full transition — no legacy columns retained.

### Task 2.5 — Update Project DB service to auto-load providers

**File:** `repos/database/src/services/project.ts`

Currently minimal (47 lines). Following the sandbox and agent service patterns, the project service should **automatically load linked providers** on every query:
- Add `with` method that includes `providerLinks: { with: { provider: true } }` — so every `get`/`list` call returns provider links without the caller needing to request them
- Update `model` factory to populate `providerLinks` on the Project model (sort by priority, map to `TProviderLink`)
- Add `#upsertProviders` private method (diff-based upsert, same transaction pattern as sandbox service)
- Accept `providerInputs` in `create`/`update` methods

This mirrors how the sandbox service auto-loads `sandboxProviders → provider` and the agent service auto-loads `agentProviders → provider`.

### Task 2.6 — Update Sandbox DB service for projectId-aware provider loading

**File:** `repos/database/src/services/sandbox.ts`

Update the `with` method to also load `projectId` from sandbox_providers (it's already loading provider links, just add the new column to the result). Update `model` factory to include `projectId` on each provider link item so `startPod` can filter.

### Task 2.7 — Manual DB push

User runs `pnpm push` from `repos/database/` after code changes.

---

## Phase 3: Backend Validation & Endpoints

### Task 3.1 — Add `validateGit` to Provider service

**File:** `repos/database/src/services/provider.ts`

Following `validateDocker` pattern exactly (lines 77-86):
```typescript
const validGitBrands = Object.values(EGitProvider) as string[]

validateGit = (type?: string, brand?: string | null) => {
  if (type !== EProvider.git) return
  if (!brand || !isStr(brand) || !validGitBrands.includes(brand))
    throw new Exception(400,
      `Git providers require brand to be one of: ${validGitBrands.join(', ')}` +
        (brand ? `. Got: "${brand}"` : ``))
}
```

### Task 3.2 — Call `validateGit` in provider create/update endpoints

- `repos/backend/src/endpoints/providers/createProvider.ts` — add `db.services.provider.validateGit(providerData.type, providerData.brand)` after `validateDocker` call (line 27)
- `repos/backend/src/endpoints/providers/updateProvider.ts` — add `db.services.provider.validateGit(effectiveType, effectiveBrand)` after `validateDocker` call (line 30)

### Task 3.3 — Update project create/update endpoints for providerInputs

**`repos/backend/src/endpoints/projects/createProject.ts`**
- Extract `providerInputs` from `req.body`
- Validate with `db.services.provider.validate({ orgId, inputs: providerInputs, type: EProvider.git })`
- Pass to project service create

**`repos/backend/src/endpoints/projects/updateProject.ts`**
- Currently only handles `name` and `description` (line 20)
- Add `providerInputs` extraction and validation
- Pass to project service update

### Task 3.4 — Update sandbox create/update to accept git providers

**`repos/backend/src/endpoints/sandboxes/createSandbox.ts`**
- Change provider type validation at lines 48-52 from `type: [EProvider.ai, EProvider.docker]` to `type: [EProvider.ai, EProvider.docker, EProvider.git]`
- Remove `gitBranch requires gitRepo` validation (lines 45-46) — legacy fields no longer exist

**`repos/backend/src/endpoints/sandboxes/updateSandbox.ts`**
- Same changes: update type array at lines 30-34 to include `EProvider.git`, remove gitBranch/gitRepo validation (lines 27-28)

---

## Phase 4: Sandbox Startup — Multi-Repo Git Resolution

### Task 4.1 — Create `resolveGitProviderEnv` utility

**File:** `repos/backend/src/utils/sandbox/resolveGitProviderEnv.ts` (new)

Dedicated function for git provider → indexed env var resolution:
```
For each git provider (sorted by priority, indexed i=0..n):
  TDSK_GIT_{i}_REPO   = provider.options.repoUrl
  TDSK_GIT_{i}_BRANCH = provider.options.branch || 'main'
  TDSK_GIT_{i}_BRAND  = provider.brand
  If provider.secretId:
    Create MITM placeholder token (same pattern as resolveProviderEnv)
    TDSK_GIT_{i}_TOKEN = placeholder
    Add to placeholders map
Set TDSK_GIT_COUNT = total number of git providers
```

### Task 4.2 — Refactor `startPod` for provider-based git injection

**File:** `repos/backend/src/services/sandboxes/sandbox.ts`

`startPod` receives a `projectId` (from the connect request context). First, filter all provider links by project scope:
```
// Filter links by project context
const activeLinks = allLinks.filter(link =>
  link.projectId === null || link.projectId === projectId
)
```

Then split into three categories:
```
const aiProviderLinks = activeLinks.filter(l => l.provider.type === EProvider.ai)
const dockerProviderLinks = activeLinks.filter(l => l.provider.type === EProvider.docker)
const gitProviderLinks = activeLinks.filter(l => l.provider.type === EProvider.git)
```

For git providers — the sandbox's own `sandbox_providers` links (where type=git AND projectId matches or is null) are the source of truth. Call `resolveGitProviderEnv(gitProviderLinks, secrets, orgId)` for indexed env vars.

Remove the legacy `sandbox.config.gitRepo/gitBranch/gitTokenSecretId` env var injection (lines 225-235) — these fields no longer exist on `TKubeSandboxConfig`.

Pass only `aiProviderLinks` (not all non-docker) to `resolveProviderEnv`.

### Task 4.3 — Update `resolveProviderEnv` to skip git-type providers

**File:** `repos/backend/src/utils/sandbox/resolveProviderEnv.ts`

Add `type?: string` to `TProviderWithSecret` (line 11). Add early `continue` for `provider.type === 'git'` in the main provider loop. Currently git-type providers would silently not match any `RuntimeProviderEnvMap` entry — making this explicit prevents confusion.

---

## Phase 5: Admin UI — ProviderDrawer Git Support

### Task 5.1 — Add git type support to ProviderDrawer

**File:** `repos/admin/src/components/Providers/ProviderDrawer.tsx`

Following the Docker pattern (lines 379-490):
- Add `isGitType = type === EProvider.git` check (parallel to `isDockerType` at line 101)
- Add git brand `SelectInput` using `GitProviderOptions` when `isGitType`
- Add `TextInput` for Repo URL (`options.repoUrl`) when `isGitType`
- Add `TextInput` for Branch (`options.branch`, default 'main') when `isGitType`
- Extend auth accordion condition to include `isGitType` (currently only `isAiType || isDockerType`)
- Add template auto-fill when git brand changes (name, token placeholder) — parallel to Docker auto-fill at lines 198-206
- Update type selector guard (line 361): don't clear brand when git type is selected (add `EProvider.git` alongside `EProvider.docker`)
- Update `onSave` validation: require brand for git type

### Task 5.2 — Update ProviderSelector for type-aware labels

**File:** `repos/admin/src/components/Selectors/ProviderSelector.tsx`

Add optional `type?: TProviderType` prop. Dynamic labels:
- `type='ai'` → "AI Providers" (current hardcoded default at lines 42, 68)
- `type='git'` → "Git Providers"
- `type='docker'` → "Docker Registries"
- No type → "Providers"

---

## Phase 6: Admin UI — Sandbox & Project Git Integration

### Task 6.1 — Add git provider state to useSandboxForm

**File:** `repos/admin/src/hooks/sandboxes/useSandboxForm.ts`

Remove legacy git state (`gitRepo`, `gitBranch`, `gitTokenSecretId`, `newGitTokenValue`, `gitTokenMode`) and all related logic in `reset()`, `populateFromSandbox()`, `onSave()`, and the return object.

Add git provider state following the Docker pattern:
- `gitProviderIds` state + setter
- `orgGitProviders` memo (filter by `type === EProvider.git`)
- `linkedGitProviders` memo
- `availableGitProviders` memo
- Update `reset()` to clear `gitProviderIds`
- Update `populateFromSandbox()` to populate from links where `type === EProvider.git` AND `projectId` matches (or is null)
- Update `onSave()`: include git provider IDs in `providerInputs` alongside AI and Docker IDs. When saving from a project context, include `projectId` on git provider inputs so the backend sets it on `sandbox_providers`

### Task 6.2 — Replace git fields in ProjectSandboxDrawer with git provider selector

**File:** `repos/admin/src/components/Sandboxes/ProjectSandboxDrawer.tsx`

Remove the "Git Repository" section (lines 110-160: gitRepo TextInput, gitBranch TextInput, SecretSelector). Replace with `SandboxProviderAccordion` for git providers (same component already used for AI at line 163 and Docker at line 213).

The available git providers should be scoped to the **project's git providers** — loaded from `project.providerLinks` where `type === EProvider.git`. This way the user selects which of the project's repos to clone into this specific sandbox. The user can also create new git providers inline (via the accordion's "Create" button), which links the new provider to both the project and the sandbox.

```tsx
<SandboxProviderAccordion
  orgId={orgId}
  title='Git Repositories'
  defaultType={EProvider.git}
  addLabel='Add Git Repository'
  createLabel='Create Git Provider'
  providers={form.linkedGitProviders...}
  availableProviders={projectGitProviders.filter(notAlreadyLinked)...}
  onAdd={...}
  onRemove={...}
  infoText='Select which of the project's git repos to clone into this sandbox.'
  ...
/>
```

### Task 6.3 — Add git provider accordion to OrgSandboxDrawer

**File:** `repos/admin/src/components/Sandboxes/OrgSandboxDrawer.tsx`

Add third `SandboxProviderAccordion` for git providers between Docker (line 208) and GUI sections. For org-level sandboxes (no project), the available providers are all org git providers (same pattern as AI/Docker — no project scoping).

### Task 6.4 — Update ProjectSettings to use git providers

**File:** `repos/admin/src/pages/Projects/ProjectSettings.tsx`

Remove `gitUrl` and `branch` fields from `SettingsFormCard` (lines 121-133). Add a git provider link/unlink section. Load project's provider links, provide selector for git providers, save via `updateProject` with `providerInputs`.

### Task 6.5 — Update CreateProjectDrawer

**File:** `repos/admin/src/components/Projects/CreateProjectDrawer.tsx`

Remove `gitUrl` (lines 115-123) and `branch` (lines 125-133) fields and their state (lines 21-22). Add optional git provider selector. Send `providerInputs` in create request.

### Task 6.6 — Update ProjectCard display

**File:** `repos/admin/src/components/Projects/ProjectCard.tsx`

Update git display (lines 76-101) to use computed getters from the Project model: `project.gitUrl` (now derived from `primaryGitProvider?.options?.repoUrl`) and `project.branch` (derived from `primaryGitProvider?.options?.branch`). The getters provide the same interface — the card just works.

### Task 6.7 — Update Projects search

**File:** `repos/admin/src/components/Projects/Projects.tsx`

Update search (line 51) to check `project.gitUrl` — this now uses the computed getter from the primary git provider.

---

## Phase 7: Threads UI Updates

### Task 7.1 — Update GitInfo component

**File:** `repos/threads/src/components/Project/GitInfo.tsx`

Accept `brand?: TGitBrand` prop for icon selection instead of URL-sniffing (line 11). Use `ProviderIcons[brand]` when available.

### Task 7.2 — Update Project component

**File:** `repos/threads/src/components/Project/Project.tsx`

Update lines 64-69 to use computed getters:
```typescript
const gitUrl = project.gitUrl  // computed from primaryGitProvider
const branch = project.branch  // computed from primaryGitProvider
const brand = project.primaryGitProvider?.brand as TGitBrand | undefined
```

---

## Phase 8: Tests

### Task 8.1 — Unit tests for validateGit

**File:** `repos/database/src/services/provider.test.ts`

Valid brands pass, invalid brands throw 400, non-git types are ignored.

### Task 8.2 — Integration tests for git provider CRUD

**File:** `repos/integration/src/tier1/provider-git.test.ts` (new)

- Create git provider with brand=github, options.repoUrl, secretId → 201
- Create with invalid brand → 400
- Create without brand → 400
- GET/PUT/DELETE git provider
- Verify options.repoUrl and options.branch persist

### Task 8.3 — Integration tests for project-provider linking

**File:** `repos/integration/src/tier1/project-providers.test.ts` (new)

- Create project with providerInputs (git providers) → verify providerLinks in response
- Update project providerInputs → verify links changed
- Multiple git providers on one project
- Delete linked provider → verify restrict behavior

### Task 8.4 — Integration tests for sandbox git provider flow

**File:** `repos/integration/src/tier1/sandbox-git-providers.test.ts` (new)

- Create sandbox with git provider in providerInputs → verify in response
- Sandbox startup with git provider → verify TDSK_GIT_0_* env vars
- Multiple git providers on sandbox → verify TDSK_GIT_COUNT and indexed vars
- Project with 3 git providers, sandbox selects 2 → verify only 2 appear in pod env (TDSK_GIT_COUNT=2)

### Task 8.5 — Update existing tests

- `repos/integration/src/tier1/sandbox-config-crud.test.ts` — remove git field tests (lines 366-435)
- `repos/integration/src/tier1/sandbox-copy.test.ts` — update gitRepo/gitBranch references (lines 31-32, 120-121) to use provider-based approach
- Playwright tests if they reference git fields

### Task 8.6 — Type check and build

`pnpm types` across all repos. `pnpm build` for backend, admin. Fix any remaining type errors.

---

## Dependency Order

```
Phase 0 (LLM→AI rename) ← no dependencies, ships independently
  ↓
Phase 1 (Domain types/constants) ← depends on Phase 0 (uses new AI-prefixed names)
  ↓
Phase 2 (Database schema) ← depends on Phase 1
  ↓
Phase 3 (Backend validation/endpoints) ← depends on Phases 1, 2
  ↓
Phase 4 (Sandbox startup) ← depends on Phases 1, 2, 3
  ↓
Phase 5 (Admin UI - ProviderDrawer) ← depends on Phase 1 (can parallel with Phases 2-4)
  ↓
Phase 6 (Admin UI - Sandbox/Project) ← depends on Phases 1, 3, 5
  ↓
Phase 7 (Threads UI) ← depends on Phase 1 (can parallel with Phases 2-6)
  ↓
Phase 8 (Tests) ← depends on all above
```

Phase 5 can start in parallel with Phases 2-4 (frontend/backend concurrency).

---

## Files to Modify (Complete List)

### Phase 0 — LLM→AI Rename
| File | Action |
|------|--------|
| `repos/domain/src/types/ai.types.ts` | Rename ELLMProviderBrand → EAIProviderBrand, TLLMProviderBrand → TAIProviderBrand |
| `repos/domain/src/types/provider.types.ts` | Rename TProviderTemplate → TAIProviderTemplate, update id type |
| `repos/domain/src/types/sandbox.types.ts` | Update ERuntimeBrand: ELLMProviderBrand → EAIProviderBrand (lines 4, 14-24) |
| `repos/domain/src/constants/providers.ts` | Rename LLMProviderTemplates → AIProviderTemplates, update type annotation |
| `repos/database/src/services/provider.ts` | validateLLM → validateAI, resolveLLMBrand → resolveAIBrand |
| `repos/database/src/seeds/fullorg.ts` | Update 6 ELLMProviderBrand references |
| `repos/backend/src/endpoints/providers/fetchModels.ts` | Update imports + all ELLMProviderBrand/LLMProviderTemplates refs |
| `repos/backend/src/endpoints/providers/createProvider.ts` | validateLLM → validateAI |
| `repos/backend/src/endpoints/providers/updateProvider.ts` | validateLLM → validateAI |
| `repos/admin/src/types/onboarding.types.ts` | TLLMProviderBrand → TAIProviderBrand |
| `repos/admin/src/constants/providers.ts` | ELLMProviderBrand → EAIProviderBrand |
| `repos/admin/src/components/Providers/ProviderDrawer.tsx` | All LLM imports → AI |
| `repos/admin/src/components/Agents/ModelSelect.tsx` | TLLMProviderBrand → TAIProviderBrand |
| `repos/admin/src/components/Onboarding/steps/ProviderStep.tsx` | All LLM refs → AI |
| `repos/tsa/src/types/session.types.ts` | TLLMProviderBrand → TAIProviderBrand |
| `repos/integration/src/utils/fixtures.ts` | TLLMProviderBrand → TAIProviderBrand |

### Phase 1 — Domain Types/Constants
| File | Action |
|------|--------|
| `repos/domain/src/types/git.types.ts` | Expand EGitProvider (add 4 values) |
| `repos/domain/src/types/provider.types.ts` | Add TGitProviderTemplate type |
| `repos/domain/src/constants/gitProviders.ts` | **NEW** — GitProviderTemplates |
| `repos/domain/src/constants/gitProviders.test.ts` | **NEW** — tests |
| `repos/domain/src/constants/providerDomains.ts` | Add git brand domains |
| `repos/domain/src/constants/index.ts` | Export gitProviders |
| `repos/admin/src/constants/providers.ts` | Add GitProviderOptions, git ProviderIcons |

### Phase 1 — Domain Types/Constants (also)
| File | Action |
|------|--------|
| `repos/domain/src/types/sandbox.types.ts` | Remove gitRepo/gitBranch/gitTokenSecretId from TKubeSandboxConfig |
| `repos/domain/src/models/project.ts` | Remove gitUrl/branch fields; add providerLinks, computed getters |

### Phase 2 — Database Schema
| File | Action |
|------|--------|
| `repos/database/src/schemas/projectProviders.ts` | **NEW** — junction table |
| `repos/database/src/schemas/sandboxProviders.ts` | Add nullable `projectId` column (FK to projects) |
| `repos/database/src/schemas/schemas.ts` | Export new schema |
| `repos/database/src/schemas/projects.ts` | Remove gitUrl/branch columns; fix providers relation → providerLinks via projectProviders |
| `repos/database/src/schemas/providers.ts` | Add projects relation via projectProviders |
| `repos/database/src/services/project.ts` | Auto-load providers via with(), model update, #upsertProviders, providerInputs |
| `repos/database/src/services/sandbox.ts` | Include projectId in provider link model output |

### Phase 3 — Backend Validation/Endpoints
| File | Action |
|------|--------|
| `repos/database/src/services/provider.ts` | Add validateGit method |
| `repos/backend/src/endpoints/providers/createProvider.ts` | Add validateGit call |
| `repos/backend/src/endpoints/providers/updateProvider.ts` | Add validateGit call |
| `repos/backend/src/endpoints/projects/createProject.ts` | Accept providerInputs |
| `repos/backend/src/endpoints/projects/updateProject.ts` | Accept providerInputs |
| `repos/backend/src/endpoints/sandboxes/createSandbox.ts` | Add EProvider.git to type array; remove gitBranch/gitRepo validation |
| `repos/backend/src/endpoints/sandboxes/updateSandbox.ts` | Add EProvider.git to type array; remove gitBranch/gitRepo validation |

### Phase 4 — Sandbox Startup
| File | Action |
|------|--------|
| `repos/backend/src/utils/sandbox/resolveGitProviderEnv.ts` | **NEW** — indexed git env resolution |
| `repos/backend/src/services/sandboxes/sandbox.ts` | Filter by projectId, three-way provider split, remove legacy git env injection |
| `repos/backend/src/utils/sandbox/resolveProviderEnv.ts` | Skip git-type providers explicitly |

### Phase 5 — Admin UI (ProviderDrawer)
| File | Action |
|------|--------|
| `repos/admin/src/components/Providers/ProviderDrawer.tsx` | Git brand selector, repoUrl + branch fields, auth |
| `repos/admin/src/components/Selectors/ProviderSelector.tsx` | Add type-aware labels |

### Phase 6 — Admin UI (Sandbox/Project)
| File | Action |
|------|--------|
| `repos/admin/src/hooks/sandboxes/useSandboxForm.ts` | Add git provider state; remove legacy git fields (gitRepo, gitBranch, gitTokenSecretId, etc.) |
| `repos/admin/src/components/Sandboxes/ProjectSandboxDrawer.tsx` | Replace git fields with SandboxProviderAccordion |
| `repos/admin/src/components/Sandboxes/OrgSandboxDrawer.tsx` | Add git SandboxProviderAccordion |
| `repos/admin/src/pages/Projects/ProjectSettings.tsx` | Replace gitUrl/branch with git provider selector |
| `repos/admin/src/components/Projects/CreateProjectDrawer.tsx` | Remove gitUrl/branch; add git provider selector |
| `repos/admin/src/components/Projects/ProjectCard.tsx` | Update to use provider-derived gitUrl |
| `repos/admin/src/components/Projects/Projects.tsx` | Update search |

### Phase 7 — Threads UI
| File | Action |
|------|--------|
| `repos/threads/src/components/Project/GitInfo.tsx` | Accept brand prop for icon |
| `repos/threads/src/components/Project/Project.tsx` | Use computed getters from primary git provider |

### Phase 8 — Tests
| File | Action |
|------|--------|
| `repos/database/src/services/provider.test.ts` | Unit tests for validateGit |
| `repos/integration/src/tier1/provider-git.test.ts` | **NEW** — git provider CRUD |
| `repos/integration/src/tier1/project-providers.test.ts` | **NEW** — project-provider linking |
| `repos/integration/src/tier1/sandbox-git-providers.test.ts` | **NEW** — sandbox git flow |
| `repos/integration/src/tier1/sandbox-config-crud.test.ts` | Remove legacy git tests (lines 366-435) |
| `repos/integration/src/tier1/sandbox-copy.test.ts` | Update git references (lines 31-32, 120-121) |

---

## Verification

1. **Type check**: `pnpm types` from root — all repos pass
2. **Unit tests**: `pnpm test` in domain, database, backend
3. **Build**: `pnpm build` for domain → database → logger → backend → admin
4. **DB push**: User runs `pnpm push` from repos/database/
5. **Integration**: `pnpm test` from repos/integration/
6. **Health checks**: `curl -sf https://px.local.threadedstack.app/health` and `/_/health`
7. **Manual E2E**: Create git provider (GitHub + PAT + repoUrl) → link to project → create project sandbox selecting that git provider → start sandbox → verify `TDSK_GIT_COUNT=1`, `TDSK_GIT_0_REPO`, `TDSK_GIT_0_BRANCH`, `TDSK_GIT_0_TOKEN` env vars in pod
8. **Multi-repo**: Link 3 git providers to project, select 2 for sandbox → verify TDSK_GIT_COUNT=2 and indexed vars for only the selected 2
9. **Org sandbox**: Create org sandbox (no project), link git providers directly → verify cloning works
10. **No legacy fields**: `grep -rn "gitRepo\|gitBranch\|gitTokenSecretId" repos/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."` returns zero hits in production code

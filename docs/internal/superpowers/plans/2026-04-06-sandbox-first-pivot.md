# Sandbox-First Platform Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shift the platform's primary experience from agent-first to sandbox-first, making managed sandboxes with configurable AI tool runtimes the hero feature across all surfaces (admin UI, REPL, backend).

**Architecture:** Add `ESandboxRuntime` enum and runtime/initScript fields to sandbox config. Pre-seed orgs with built-in sandbox configs. Reorder admin UI navigation to promote sandboxes. Build a unified workspace dashboard. Add `tsa run` command to REPL. Agents remain functional but deprioritized.

**Tech Stack:** TypeScript, Drizzle ORM, Express 5, React/Vite/MUI/Jotai (admin), Ink/React TUI (repl), K8s pod manifests

**Spec:** `docs/superpowers/specs/2026-04-06-sandbox-first-pivot-design.md`

**CRITICAL RULES FOR ALL TASKS:**
- **NEVER** run `git commit`, `git push`, or any git write command. Only `git add`, `git status`, `git diff`, `git log` are allowed.
- **NEVER** add TODO/FIXME comments. Implement fully or explain why you can't.
- **Exported types** go in the repo's `types/` directory, never co-located.
- **NEVER** re-export from another package. Update all callsites directly.
- Constants use PascalCase (e.g. `SandboxPresets`). SCREAMING_SNAKE is for env vars only.

---

## File Structure

### Domain (`repos/domain/src/`)
- **Modify:** `types/sandbox.types.ts` — add `ESandboxRuntime` enum, `runtime`, `runtimeCommand`, `initScript` fields to `TKubeSandboxConfig`
- **Modify:** `constants/sandbox.ts` — add `SandboxRuntimeConfigs`, `SandboxPresets` constants
- **Modify:** `models/sandbox.ts` — add `builtIn` property to `Sandbox` class

### Database (`repos/database/src/`)
- **Modify:** `schemas/sandboxes.ts` — add `builtIn` boolean column

### Backend (`repos/backend/src/`)
- **Create:** `endpoints/sandboxes/copySandbox.ts` — `POST /sandboxes/:id/copy`
- **Modify:** `endpoints/sandboxes/sandboxes.ts` — register copy endpoint
- **Modify:** `endpoints/orgs/createOrg.ts` — seed default sandboxes on org creation

### Sandbox (`repos/sandbox/src/`)
- **Modify:** `kube/podManifest.ts` — runtime-aware container start command in `buildSandboxContainer()`

### Admin (`repos/admin/src/`)
- **Modify:** `constants/nav.tsx` — reorder nav groups (sandboxes first, agents last)
- **Create:** `pages/Projects/ProjectWorkspace.tsx` — unified workspace dashboard
- **Modify:** `routes/Routes.tsx` — add workspace route as project landing
- **Modify:** `components/Sandboxes/SandboxDrawer.tsx` — add runtime, runtimeCommand, initScript fields
- **Modify:** `components/Sandboxes/Sandboxes.tsx` — add copy action

### REPL (`repos/repl/src/`)
- **Create:** `utils/tasks/resolveOrgId.ts` — shared org resolution with multi-org handling
- **Create:** `utils/tasks/sandboxConnect.ts` — shared sandbox connect + SSH key injection
- **Create:** `utils/tasks/sandboxSync.ts` — shared auto-start/stop sync logic
- **Create:** `utils/tasks/spawnSsh.ts` — shared SSH process spawning with ProxyCommand
- **Create:** `tasks/run.ts` — `tsa run` command (composed from shared utilities)
- **Modify:** `tasks/ssh.ts` — refactor to use shared utilities
- **Modify:** `tasks/index.ts` — register `run` task, reorder exports

---

## Task 1: Domain — ESandboxRuntime Enum and Config Types

**Files:**
- Modify: `repos/domain/src/types/sandbox.types.ts:7-10` (add enum after ESandboxType)
- Modify: `repos/domain/src/types/sandbox.types.ts:125-147` (add fields to TKubeSandboxConfig)

- [ ] **Step 1: Add ESandboxRuntime enum**

Add after the `ESandboxType` enum (line 10) in `repos/domain/src/types/sandbox.types.ts`:

```typescript
export enum ESandboxRuntime {
  claudeCode = `claude-code`,
  codex = `codex`,
  openCode = `opencode`,
  custom = `custom`,
}

export type TSandboxRuntime_Type = `${ESandboxRuntime}`
```

- [ ] **Step 2: Add new fields to TKubeSandboxConfig**

Add these fields to `TKubeSandboxConfig` in `repos/domain/src/types/sandbox.types.ts` (inside the type, after the existing `resources` field at line 146):

```typescript
  /** Which AI tool runtime to activate (claude-code, codex, opencode, or custom) */
  runtime?: TSandboxRuntime_Type
  /** Shell command executed by `tsa run` after SSH connect to launch the AI tool */
  runtimeCommand?: string
  /** Shell script that runs after container start + built-in setup, before sandbox is "ready" */
  initScript?: string
```

Note: `runtime` is optional (not required) because existing sandboxes in the DB won't have it. The backend treats missing runtime as `custom` behavior (use image defaults).

- [ ] **Step 3: Run domain type check**

Run: `cd repos/domain && pnpm types`
Expected: PASS — new fields are optional, no breaking changes

- [ ] **Step 4: Stage changes**

```bash
git add repos/domain/src/types/sandbox.types.ts
```

---

## Task 2: Domain — SandboxRuntimeConfigs and SandboxPresets Constants

**Files:**
- Modify: `repos/domain/src/constants/sandbox.ts:1-18`

- [ ] **Step 1: Add runtime config and preset constants**

Replace the contents of `repos/domain/src/constants/sandbox.ts` with:

```typescript
import { EImagePullPolicy, ESandboxRuntime } from '@TDM/types'
import type { TKubeSandboxConfig } from '@TDM/types'

export const SBImagePullPolicyOptions = [
  { value: EImagePullPolicy.Never, label: EImagePullPolicy.Never },
  { value: EImagePullPolicy.Always, label: EImagePullPolicy.Always },
  { value: EImagePullPolicy.IfNotPresent, label: EImagePullPolicy.IfNotPresent },
]

export const SBRuntimeOptions = [
  { value: `node`, label: `Node.js` },
  { value: `python`, label: `Python` },
]

export const SBImagePresets = [
  { label: `Claude Code`, value: `tdsk-sandbox-claude` },
  { label: `Codex`, value: `tdsk-sandbox-codex` },
  { label: `OpenCode`, value: `tdsk-sandbox-opencode` },
]

export const SandboxRuntimeOptions = [
  { value: ESandboxRuntime.claudeCode, label: `Claude Code` },
  { value: ESandboxRuntime.codex, label: `Codex` },
  { value: ESandboxRuntime.openCode, label: `OpenCode` },
  { value: ESandboxRuntime.custom, label: `Custom` },
]

/**
 * Maps each built-in runtime to its container start command and runtime command.
 * - command/args: what the container runs on startup (SSH + idle wait)
 * - runtimeCommand: what `tsa run` executes after SSH connect
 * - initScript: default setup script for this runtime
 */
export const SandboxRuntimeConfigs: Record<string, {
  command?: string[]
  args?: string[]
  runtimeCommand?: string
  initScript?: string
}> = {
  [ESandboxRuntime.claudeCode]: {
    runtimeCommand: `claude`,
    initScript: `echo "Claude Code sandbox ready"`,
  },
  [ESandboxRuntime.codex]: {
    runtimeCommand: `codex`,
    initScript: `echo "Codex sandbox ready"`,
  },
  [ESandboxRuntime.openCode]: {
    runtimeCommand: `opencode`,
    initScript: `echo "OpenCode sandbox ready"`,
  },
  [ESandboxRuntime.custom]: {},
}

const DefaultSandboxImage = `tdsk/sandbox:latest`

const DefaultResources = {
  requests: { cpu: `500m`, memory: `1Gi` },
  limits: { cpu: `2`, memory: `4Gi` },
}

/**
 * Pre-configured sandbox configs seeded per org on creation.
 * Each creates a real sandbox row that is immediately startable.
 */
export const SandboxPresets: Record<string, {
  name: string
  description: string
  config: Partial<TKubeSandboxConfig>
}> = {
  [ESandboxRuntime.claudeCode]: {
    name: `Claude Code`,
    description: `Anthropic Claude Code AI assistant`,
    config: {
      runtime: ESandboxRuntime.claudeCode,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.claudeCode].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.claudeCode].initScript,
      image: DefaultSandboxImage,
      sshEnabled: true,
      resources: DefaultResources,
      idleTimeoutMinutes: 30,
    },
  },
  [ESandboxRuntime.codex]: {
    name: `Codex`,
    description: `OpenAI Codex AI coding assistant`,
    config: {
      runtime: ESandboxRuntime.codex,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.codex].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.codex].initScript,
      image: DefaultSandboxImage,
      sshEnabled: true,
      resources: DefaultResources,
      idleTimeoutMinutes: 30,
    },
  },
  [ESandboxRuntime.openCode]: {
    name: `OpenCode`,
    description: `OpenCode AI coding assistant`,
    config: {
      runtime: ESandboxRuntime.openCode,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.openCode].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.openCode].initScript,
      image: DefaultSandboxImage,
      sshEnabled: true,
      resources: DefaultResources,
      idleTimeoutMinutes: 30,
    },
  },
  [ESandboxRuntime.custom]: {
    name: `Base`,
    description: `Base sandbox with SSH — bring your own runtime`,
    config: {
      runtime: ESandboxRuntime.custom,
      image: DefaultSandboxImage,
      sshEnabled: true,
      resources: DefaultResources,
      idleTimeoutMinutes: 30,
    },
  },
}
```

- [ ] **Step 2: Run domain type check**

Run: `cd repos/domain && pnpm types`
Expected: PASS

- [ ] **Step 3: Stage changes**

```bash
git add repos/domain/src/constants/sandbox.ts
```

---

## Task 3: Domain — Add builtIn to Sandbox Model

**Files:**
- Modify: `repos/domain/src/models/sandbox.ts:1-18`

- [ ] **Step 1: Add builtIn property**

Edit `repos/domain/src/models/sandbox.ts` to add the `builtIn` field:

```typescript
import type { TKubeSandboxConfig } from '@TDM/types'

import { Base } from './base'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string
  builtIn: boolean = false
  config: TKubeSandboxConfig

  constructor(data: TSandboxData) {
    super()
    Object.assign(this, data)
  }
}
```

- [ ] **Step 2: Run domain type check**

Run: `cd repos/domain && pnpm types`
Expected: PASS

- [ ] **Step 3: Stage changes**

```bash
git add repos/domain/src/models/sandbox.ts
```

---

## Task 4: Database — Add builtIn Column to Sandboxes Schema

**Files:**
- Modify: `repos/database/src/schemas/sandboxes.ts:20-43`

- [ ] **Step 1: Add builtIn column**

Edit `repos/database/src/schemas/sandboxes.ts`. Add `boolean` to the drizzle-orm/pg-core import, then add the `builtIn` column after `config`:

```typescript
import { text, jsonb, uuid, varchar, index, boolean, pgTable } from 'drizzle-orm/pg-core'
```

Add this column inside the table definition, after the `config` line:

```typescript
    builtIn: boolean(`built_in`).notNull().default(false),
```

- [ ] **Step 2: Run database type check**

Run: `cd repos/database && pnpm types`
Expected: PASS

- [ ] **Step 3: Stage changes**

```bash
git add repos/database/src/schemas/sandboxes.ts
```

> **Note:** After staging, the user must manually run `cd repos/database && pnpm push` to push the schema change to the database. This is interactive and cannot be automated.

---

## Task 5: Backend — Copy Sandbox Endpoint

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/copySandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/sandboxes.ts`

- [ ] **Step 1: Create the copy endpoint**

Create `repos/backend/src/endpoints/sandboxes/copySandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Sandbox, Exception } from '@tdsk/domain'
import { checkPermission } from '@TBE/middleware/permissions'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /sandboxes/:id/copy - Deep-copy a sandbox config
 * Creates a new sandbox with the same config, builtIn: false
 */
export const copySandbox: TEndpointConfig = {
  path: `/:id/copy`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!id) throw new Exception(400, `Sandbox ID is required`)

    await checkPermission(req, EPermAction.create, EPermResource.sandbox, { orgId })

    const { data: original, error: getError } = await db.services.sandbox.get(id)
    if (getError || !original) {
      throw new Exception(404, `Sandbox not found`)
    }

    const name = req.body.name || `${original.name} (copy)`
    const copy = new Sandbox({
      name,
      orgId: original.orgId,
      userId: req.user?.id,
      projectId: req.body.projectId ?? original.projectId,
      builtIn: false,
      config: { ...original.config },
    })

    const { data, error } = await db.services.sandbox.create(copy)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
```

- [ ] **Step 2: Register the copy endpoint in the sandbox router**

Read `repos/backend/src/endpoints/sandboxes/sandboxes.ts` and add the import and registration for `copySandbox`. The copy endpoint should be added alongside the other sandbox endpoints in the router configuration.

Import:
```typescript
import { copySandbox } from './copySandbox'
```

Add `copySandbox` to the endpoints array in the router.

- [ ] **Step 3: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS

- [ ] **Step 4: Stage changes**

```bash
git add repos/backend/src/endpoints/sandboxes/copySandbox.ts repos/backend/src/endpoints/sandboxes/sandboxes.ts
```

---

## Task 6: Backend — Seed Default Sandboxes on Org Creation

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/createOrg.ts:1-49`

- [ ] **Step 1: Add sandbox seeding after org creation**

Edit `repos/backend/src/endpoints/orgs/createOrg.ts` to seed default sandboxes after the owner role is assigned. Add the import at the top:

```typescript
import { SandboxPresets, Sandbox } from '@tdsk/domain'
```

Then, after the role creation block (after line 44, before the response), add:

```typescript
    // Seed default sandbox configs for the new org
    const presetEntries = Object.values(SandboxPresets)
    for (const preset of presetEntries) {
      const sandbox = new Sandbox({
        orgId: data.id,
        name: preset.name,
        builtIn: true,
        config: {
          image: preset.config.image || `tdsk/sandbox:latest`,
          sshEnabled: true,
          ...preset.config,
        } as TKubeSandboxConfig,
      })
      const { error: seedError } = await db.services.sandbox.create(sandbox)
      if (seedError) {
        logger.warn(`Failed to seed sandbox "${preset.name}" for org ${data.id}:`, seedError)
      }
    }
```

Add the type import at the top:
```typescript
import type { TKubeSandboxConfig } from '@tdsk/domain'
```

Seeding failures are warnings, not fatal — the org is still created successfully.

- [ ] **Step 2: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS

- [ ] **Step 3: Stage changes**

```bash
git add repos/backend/src/endpoints/orgs/createOrg.ts
```

---

## Task 7: Sandbox — Runtime-Aware Pod Manifest Builder

**Files:**
- Modify: `repos/sandbox/src/kube/podManifest.ts:122-171` (buildSandboxContainer function)

- [ ] **Step 1: Update buildSandboxContainer to handle runtime**

Edit the `buildSandboxContainer` function in `repos/sandbox/src/kube/podManifest.ts`. Import `SandboxRuntimeConfigs` and `ESandboxRuntime` at the top:

```typescript
import { SandboxRuntimeConfigs, ESandboxRuntime } from '@tdsk/domain'
```

Then modify `buildSandboxContainer` (starting at line 122) to resolve container start command from runtime config:

```typescript
const buildSandboxContainer = (
  config: TKubeSandboxConfig,
  extraEnv?: Record<string, string>
): V1Container => {
  const env: V1EnvVar[] = [
    { name: `NODE_EXTRA_CA_CERTS`, value: CACertMountPath },
    ...buildEnvVars(config.envVars),
    ...buildEnvVars(extraEnv),
  ]

  // Set TDSK_RUNTIME env var so tsa run can discover the runtime
  if (config.runtime) {
    env.push({ name: `TDSK_RUNTIME`, value: config.runtime })
  }
  if (config.runtimeCommand) {
    env.push({ name: `TDSK_RUNTIME_CMD`, value: config.runtimeCommand })
  }

  const ports = buildPorts(config.ports)
  if (config.sshEnabled !== false) {
    const hasSSHPort = ports.some((p) => p.containerPort === 2222)
    if (!hasSSHPort) {
      ports.push({ protocol: `TCP`, containerPort: 2222 })
    }
  }

  const container: V1Container = {
    env,
    ports,
    name: `sandbox`,
    image: config.image,
    resources: config.resources || {},
    workingDir: config.workdir || DefaultWorkdir,
    securityContext: {
      privileged: false,
      allowPrivilegeEscalation: false,
    },
    volumeMounts: [
      {
        subPath: `tls.crt`,
        name: VolumeMountName,
        mountPath: CACertMountPath,
      },
    ],
  }

  // Resolve container start command based on runtime
  const runtime = config.runtime
  const runtimeConfig = runtime && runtime !== ESandboxRuntime.custom
    ? SandboxRuntimeConfigs[runtime]
    : undefined

  if (runtimeConfig?.command) {
    // Built-in runtime: use the runtime's container start command
    container.command = runtimeConfig.command
    if (runtimeConfig.args) container.args = runtimeConfig.args
  } else if (config.command) {
    // Custom runtime with explicit start command
    container.command = config.command
    if (config.args) container.args = config.args
  } else if (!config.command) {
    // No command specified: idle with sleep infinity
    container.args = [`sleep`, `infinity`]
  }

  if (config.imagePullPolicy) container.imagePullPolicy = config.imagePullPolicy

  return container
}
```

- [ ] **Step 2: Run sandbox type check**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

- [ ] **Step 3: Stage changes**

```bash
git add repos/sandbox/src/kube/podManifest.ts
```

---

## Task 8: Admin UI — Navigation Reorder

**Files:**
- Modify: `repos/admin/src/constants/nav.tsx:202-241` (OrgSubNavGroups and ProjectSubNavGroups)

- [ ] **Step 1: Reorder OrgSubNavGroups**

Edit `repos/admin/src/constants/nav.tsx`. Change the `OrgSubNavGroups` array (lines 202-221) to put Sandboxes first and Agents last:

```typescript
export const OrgSubNavGroups: TSubNavGroup[] = [
  {
    label: `Resources`,
    items: [
      OrgSubNav.Projects,
      OrgSubNav.Sandboxes,
      OrgSubNav.Providers,
      OrgSubNav.Skills,
    ],
  },
  {
    label: `Security`,
    items: [OrgSubNav.Secrets, OrgSubNav.APIKeys, OrgSubNav.Domains],
  },
  {
    label: `Management`,
    items: [OrgSubNav.Members, OrgSubNav.Schedules, OrgSubNav.Usage, OrgSubNav.Settings],
  },
  {
    label: `AI`,
    items: [OrgSubNav.Agents],
  },
]
```

- [ ] **Step 2: Reorder ProjectSubNavGroups**

Change the `ProjectSubNavGroups` array (lines 223-241) to put Sandboxes first and Agents last:

```typescript
export const ProjectSubNavGroups: TSubNavGroup[] = [
  {
    label: `Development`,
    items: [
      ProjectSubNav.Sandboxes,
      ProjectSubNav.Endpoints,
      ProjectSubNav.Functions,
    ],
  },
  {
    label: `Security`,
    items: [ProjectSubNav.Secrets, ProjectSubNav.APIKeys, ProjectSubNav.Domains],
  },
  {
    label: `Management`,
    items: [ProjectSubNav.Members, ProjectSubNav.Settings],
  },
  {
    label: `AI`,
    items: [ProjectSubNav.Agents],
  },
]
```

- [ ] **Step 3: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: PASS

- [ ] **Step 4: Stage changes**

```bash
git add repos/admin/src/constants/nav.tsx
```

---

## Task 9: Admin UI — SandboxDrawer Runtime Fields

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`

- [ ] **Step 1: Read the full SandboxDrawer component**

Read `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx` in full to understand the current form structure, state management pattern, and how existing fields are rendered.

- [ ] **Step 2: Add runtime dropdown field**

Add a `SelectInput` for the runtime field in the drawer form. Use `SandboxRuntimeOptions` from `@tdsk/domain` for the options. Place it prominently in the basic info section (near the image field). Import:

```typescript
import { SandboxRuntimeOptions, SandboxRuntimeConfigs, ESandboxRuntime } from '@tdsk/domain'
```

Add to the form state:
```typescript
const [runtime, setRuntime] = useState(sandbox?.config?.runtime || ESandboxRuntime.custom)
```

Render after the image field:
```typescript
<SelectInput
  label="Runtime"
  value={runtime}
  options={SandboxRuntimeOptions}
  onChange={(e) => setRuntime(e.target.value)}
/>
```

- [ ] **Step 3: Add runtimeCommand field (visible when custom OR read-only for built-in)**

For built-in runtimes, show `runtimeCommand` as read-only text resolved from `SandboxRuntimeConfigs`. For custom, show an editable `TextInput`.

```typescript
const isCustom = runtime === ESandboxRuntime.custom
const resolvedRuntimeCmd = !isCustom
  ? SandboxRuntimeConfigs[runtime]?.runtimeCommand || ``
  : ``

const [runtimeCommand, setRuntimeCommand] = useState(
  sandbox?.config?.runtimeCommand || resolvedRuntimeCmd
)
```

Render conditionally:
```typescript
{isCustom ? (
  <TextInput
    label="Runtime Command"
    helperText="Shell command executed by tsa run (e.g. claude, codex)"
    value={runtimeCommand}
    onChange={(e) => setRuntimeCommand(e.target.value)}
  />
) : (
  <TextInput
    label="Runtime Command"
    value={resolvedRuntimeCmd}
    disabled
    helperText="Resolved from runtime preset"
  />
)}
```

- [ ] **Step 4: Add initScript Monaco editor field**

Use the `Code` component (Monaco editor wrapper at `@TAF/components/Code/Code`) for the init script, matching the pattern used for FaaS function inputs and agent system prompts. Show for all runtimes — built-in presets pre-fill it, custom starts empty.

```typescript
import { Code } from '@TAF/components/Code/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
```

State:
```typescript
const defaultInitScript = !isCustom
  ? SandboxRuntimeConfigs[runtime]?.initScript || ``
  : ``

const [initScript, setInitScript] = useState(
  sandbox?.config?.initScript || defaultInitScript
)
```

Render:
```typescript
<Code
  id="sandbox-init-script-editor"
  label="Init Script"
  language="shell"
  options={MonacoOptions}
  defaultValue={initScript}
  onChange={(value) => setInitScript(value || ``)}
  tooltip="Shell script that runs after container starts — install deps, configure tools, prepare workspace"
/>
```

- [ ] **Step 5: Add custom start command fields (visible only for custom runtime)**

Show command/args fields only when `runtime === 'custom'`:

```typescript
{isCustom && (
  <>
    <TextInput
      label="Start Command"
      helperText="Container entrypoint override (optional — image default if empty)"
      value={command}
      onChange={(e) => setCommand(e.target.value)}
    />
    <TextInput
      label="Start Args"
      helperText="Container CMD override (optional)"
      value={args}
      onChange={(e) => setArgs(e.target.value)}
    />
  </>
)}
```

- [ ] **Step 6: Include new fields in the save handler**

Update the save/submit handler to include the new fields in the config object sent to the API:

```typescript
const config = {
  ...existingConfig,
  runtime,
  runtimeCommand: isCustom ? runtimeCommand : resolvedRuntimeCmd,
  initScript: initScript || undefined,
  command: isCustom && command ? command.split(`,`).map(s => s.trim()) : undefined,
  args: isCustom && args ? args.split(`,`).map(s => s.trim()) : undefined,
}
```

- [ ] **Step 7: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: PASS

- [ ] **Step 8: Stage changes**

```bash
git add repos/admin/src/components/Sandboxes/SandboxDrawer.tsx
```

---

## Task 10: Admin UI — Copy Action on Sandboxes

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/Sandboxes.tsx`

- [ ] **Step 1: Read the full Sandboxes component**

Read `repos/admin/src/components/Sandboxes/Sandboxes.tsx` to understand the action buttons pattern and data table structure.

- [ ] **Step 2: Add copy API action**

Create or find the sandbox actions file (likely `repos/admin/src/actions/sandboxes/`). Add a `copySandbox` action:

```typescript
export const copySandbox = async (orgId: string, sandboxId: string, name?: string) => {
  const api = getApiService()
  return api.invoke(`sandboxes/${sandboxId}/copy`, {
    method: `POST`,
    body: { orgId, name },
  })
}
```

- [ ] **Step 3: Add Copy button to sandbox row actions**

In `Sandboxes.tsx`, add a Copy button alongside the existing Edit/Delete/Connect buttons in the action column. When clicked, call `copySandbox`, then refresh the sandbox list:

```typescript
<IconButton
  title="Copy"
  onClick={async () => {
    const { data, error } = await copySandbox(orgId, sandbox.id)
    if (!error && data) {
      onRefresh?.()
    }
  }}
>
  <ContentCopyIcon />
</IconButton>
```

Import `ContentCopy as ContentCopyIcon` from `@mui/icons-material`.

- [ ] **Step 4: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: PASS

- [ ] **Step 5: Stage changes**

```bash
git add repos/admin/src/components/Sandboxes/Sandboxes.tsx
```

---

## Task 11: Admin UI — Unified Workspace Dashboard

**Files:**
- Create: `repos/admin/src/pages/Projects/ProjectWorkspace.tsx`
- Modify: `repos/admin/src/routes/Routes.tsx`

This is the most ambitious UI task. The workspace dashboard has four panels: Sandboxes, Recent Threads, Quick Actions, and Activity Feed.

- [ ] **Step 1: Read the current project route structure**

Read `repos/admin/src/routes/Routes.tsx` to understand how project routes are structured, what loaders exist, and what the current project index/landing route is.

Also read `repos/admin/src/pages/Projects/Project.tsx` to understand the current project landing page.

- [ ] **Step 2: Create the ProjectWorkspace page component**

Create `repos/admin/src/pages/Projects/ProjectWorkspace.tsx`:

```typescript
import { useMemo } from 'react'
import { Box, Typography, Button, Chip, Stack, Paper, IconButton } from '@mui/material'
import {
  Add as AddIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Terminal as ConnectIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import { useAtomValue } from 'jotai'
import { DrawingBoxIcon } from '@tdsk/components'
import { ESBState } from '@tdsk/domain'
import { projectSandboxesState } from '@TAF/state/sandboxes'
import { activeProjectIdState } from '@TAF/state/projects'
import { activeOrgIdState } from '@TAF/state/orgs'
import { nav } from '@TAF/services/nav'
import { ERoutePath } from '@TAF/types'
import { buildRoute } from '@TAF/utils/nav/buildRoute'

export const ProjectWorkspace = () => {
  const orgId = useAtomValue(activeOrgIdState)
  const projectId = useAtomValue(activeProjectIdState)
  const sandboxes = useAtomValue(projectSandboxesState)

  const sandboxList = useMemo(
    () => Object.values(sandboxes || {}),
    [sandboxes]
  )

  return (
    <Box sx={{ p: 3, display: `flex`, flexDirection: `column`, gap: 3 }}>
      {/* Quick Actions Bar */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Workspace
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => nav.to(buildRoute(ERoutePath.ProjectSandboxes))}
          >
            New Sandbox
          </Button>
          <Button
            variant="outlined"
            startIcon={<ConnectIcon />}
            onClick={() => nav.to(buildRoute(ERoutePath.ProjectSandboxes))}
          >
            Connect
          </Button>
        </Stack>
      </Paper>

      {/* Sandboxes Panel */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Sandboxes
        </Typography>
        {sandboxList.length === 0 ? (
          <Typography color="text.secondary">
            No sandboxes configured for this project yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {sandboxList.map((sb) => (
              <Box
                key={sb.id}
                sx={{
                  display: `flex`,
                  alignItems: `center`,
                  gap: 2,
                  p: 1.5,
                  borderRadius: 1,
                  border: `1px solid`,
                  borderColor: `divider`,
                }}
              >
                <DrawingBoxIcon />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {sb.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sb.config?.runtime || `custom`} &middot; {sb.config?.image}
                  </Typography>
                </Box>
                {sb.builtIn && (
                  <Chip label="Built-in" size="small" variant="outlined" />
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Recent Threads Panel */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Recent Threads
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Thread activity will appear here.
        </Typography>
      </Paper>
    </Box>
  )
}
```

- [ ] **Step 3: Register as project landing route**

In `repos/admin/src/routes/Routes.tsx`, add the workspace as the project index route. Find the project route children and add:

```typescript
import { ProjectWorkspace } from '@TAF/pages/Projects/ProjectWorkspace'
```

Add as the index route for the project:
```typescript
{
  index: true,
  loader: projectSandboxesLoader,
  Component: () => <SuspensePage Component={ProjectWorkspace} />,
},
```

This makes the workspace the default page when navigating to a project.

- [ ] **Step 4: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: PASS

- [ ] **Step 5: Stage changes**

```bash
git add repos/admin/src/pages/Projects/ProjectWorkspace.tsx repos/admin/src/routes/Routes.tsx
```

---

## Task 12: REPL — Extract Shared Sandbox Utilities

The current `ssh.ts` and `sync.ts` tasks duplicate org resolution, sandbox connection, SSH key injection, sync lifecycle, and SSH process spawning. Extract these into shared utilities so both existing tasks and the new `tsa run` can reuse them.

**Files:**
- Create: `repos/repl/src/utils/tasks/resolveOrgId.ts`
- Create: `repos/repl/src/utils/tasks/sandboxConnect.ts`
- Create: `repos/repl/src/utils/tasks/sandboxSync.ts`
- Create: `repos/repl/src/utils/tasks/spawnSsh.ts`
- Modify: `repos/repl/src/tasks/ssh.ts` — refactor to use shared utilities

- [ ] **Step 1: Create resolveOrgId utility**

The existing `resolveOrg` at `repos/repl/src/utils/api/resolveOrg.ts` only handles single-org auto-detection and throws on multiple orgs. Both `ssh.ts` (lines 40-57) and `sync.ts` (lines 185-201) duplicate a broader pattern: check params first, fall back to auto-detect, handle errors with themed output. Extract this.

Create `repos/repl/src/utils/tasks/resolveOrgId.ts`:

```typescript
import { themed } from '@TRL/theme'
import type { ApiClient } from '@TRL/services/api'

/**
 * Resolve org ID from explicit param or auto-detect from user's orgs.
 * Exits with error if no orgs found or multiple orgs without explicit param.
 */
export const resolveOrgId = async (
  client: ApiClient,
  explicitOrgId?: string
): Promise<string> => {
  if (explicitOrgId) return explicitOrgId

  const { data: orgs, error } = await client.listOrgs()
  if (error || !orgs) {
    process.stdout.write(`${themed(`error`, `Error:`)} ${error?.message || `Failed to list organizations`}\n`)
    process.exit(1)
  }
  if (orgs.length === 0) {
    process.stdout.write(`${themed(`error`, `No organizations found`)}\n`)
    process.exit(1)
  }
  if (orgs.length > 1) {
    process.stdout.write(`${themed(`warning`, `Multiple orgs found. Use --org <id> to specify.`)}\n`)
    process.exit(1)
  }
  return orgs[0].id
}
```

- [ ] **Step 2: Create sandboxConnect utility**

Extract the connect + SSH key injection flow shared between `ssh.ts` (lines 59-91) and the planned `run.ts`.

Create `repos/repl/src/utils/tasks/sandboxConnect.ts`:

```typescript
import type { TSandboxConnectResponse } from '@tdsk/domain'

import { themed } from '@TRL/theme'
import type { ApiClient } from '@TRL/services/api'
import { ensureSshConfig, getPublicKey } from '@TRL/services/sync/sshConfig'

/**
 * Connect to a sandbox (starts pod if needed) and inject SSH key.
 * Returns the connect response with podName.
 * Exits on failure.
 */
export const sandboxConnect = async (
  client: ApiClient,
  orgId: string,
  sandboxId: string
): Promise<TSandboxConnectResponse> => {
  process.stdout.write(`${themed(`muted`, `Connecting to sandbox "${sandboxId}"...`)}\n`)

  const { data: connectResp, error } = await client.connectSandbox(orgId, sandboxId)
  if (error || !connectResp) {
    process.stdout.write(`${themed(`error`, `Error:`)} ${error?.message || `Failed to connect`}\n`)
    process.exit(1)
  }

  const { podName } = connectResp
  if (!podName) {
    process.stdout.write(`${themed(`error`, `Error: No pod name returned from server`)}\n`)
    process.exit(1)
  }

  ensureSshConfig()
  const publicKey = getPublicKey()
  const { error: sshError } = await client.injectSshKey(orgId, sandboxId, podName, publicKey)
  if (sshError) {
    process.stdout.write(`${themed(`error`, `Error:`)} ${sshError.message}\n`)
    process.exit(1)
  }

  process.stdout.write(`${themed(`muted`, `SSH session ready.`)}\n`)
  return connectResp
}
```

- [ ] **Step 3: Create sandboxSync utility**

Extract the auto-start/stop sync logic from `ssh.ts` (lines 94-147, 191-203).

Create `repos/repl/src/utils/tasks/sandboxSync.ts`:

```typescript
import type { Sandbox } from '@tdsk/domain'

import { existsSync } from 'fs'
import { themed } from '@TRL/theme'
import type { ApiClient } from '@TRL/services/api'
import { CliDriver } from '@TRL/services/sync/mutagenClient'
import { SyncManager } from '@TRL/services/sync/syncManager'
import { mergeRules, resolveSourcePath } from '@TRL/services/sync/configLoader'

export type TSyncContext = {
  manager: SyncManager
  started: boolean
}

/**
 * Create a sync context with a fresh SyncManager.
 */
export const createSyncContext = (): TSyncContext => ({
  manager: new SyncManager(new CliDriver()),
  started: false,
})

/**
 * Auto-start file sync if configured. Best-effort — sync failure does not block SSH.
 * Mutates syncCtx.started to track state.
 */
export const autoStartSync = async (
  syncCtx: TSyncContext,
  syncConfig: any,
  orgId: string,
  sandboxId: string,
  sandbox?: Sandbox | null
): Promise<void> => {
  if (!syncConfig?.autoStart || !syncConfig?.rules?.length) return

  try {
    const overrides = syncConfig.sandboxes?.[sandboxId]?.rules
    const rules = mergeRules(syncConfig.rules, sandbox?.config?.sync, overrides)
    const cwd = process.cwd()
    for (const rule of rules) {
      rule.source = resolveSourcePath(rule.source, cwd)
    }
    const validRules = rules.filter((rule: any) => existsSync(rule.source))

    if (validRules.length) {
      const sessions = await syncCtx.manager.startAll(
        sandboxId, orgId, validRules, sandbox?.config?.sync, syncConfig.defaultIgnores
      )
      if (sessions.length) {
        syncCtx.started = true
        process.stdout.write(
          `${themed(`success`, `File sync started (${sessions.length} rule${sessions.length !== 1 ? `s` : ``})`)}\n`
        )
      }
    }
  } catch (err) {
    const msg = (err as Error).message
    const isAuthError = msg.includes(`(401)`) || msg.includes(`Not logged in`)
    if (isAuthError) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }
    process.stderr.write(
      `${themed(`warning`, `Warning: auto-sync failed:`)} ${msg}\n` +
        `${themed(`muted`, `SSH session will continue without file sync. Run "tsa sync" to retry.`)}\n`
    )
  }
}

/**
 * Stop sync sessions for a sandbox. Best-effort cleanup.
 */
export const stopSync = async (
  syncCtx: TSyncContext,
  sandboxId: string
): Promise<void> => {
  if (!syncCtx.started) return
  try {
    await syncCtx.manager.stopAll(sandboxId)
    process.stdout.write(`${themed(`muted`, `File sync stopped`)}\n`)
  } catch (err) {
    process.stderr.write(
      `Warning: could not stop sync sessions: ${(err as Error).message}\n` +
        `Run "tsa sync stop ${sandboxId}" to clean up manually.\n`
    )
  }
}
```

- [ ] **Step 4: Create spawnSsh utility**

Extract SSH process spawning from `ssh.ts` (lines 149-188).

Create `repos/repl/src/utils/tasks/spawnSsh.ts`:

```typescript
import { spawn } from 'child_process'
import { themed } from '@TRL/theme'

/**
 * Build the ProxyCommand string for SSH using tsa proxy.
 */
export const buildProxyCommand = (sandboxId: string): string => {
  const tsaBin = process.argv[0] || `tsa`
  const tsaScript = process.argv[1] || ``
  return tsaScript
    ? `${tsaBin} ${tsaScript} proxy ${sandboxId}`
    : `${tsaBin} proxy ${sandboxId}`
}

/**
 * Spawn an SSH process to a sandbox pod.
 * @param sandboxId - The sandbox to connect to
 * @param remoteCommand - Optional command to execute after connecting (e.g. runtime command)
 */
export const spawnSsh = async (
  sandboxId: string,
  remoteCommand?: string
): Promise<void> => {
  const proxyCmd = buildProxyCommand(sandboxId)

  const sshArgs = [
    `-o`, `ProxyCommand=${proxyCmd}`,
    `-o`, `StrictHostKeyChecking=no`,
    `-o`, `UserKnownHostsFile=/dev/null`,
    `-o`, `LogLevel=ERROR`,
    `sandbox@${sandboxId}`,
  ]

  // -t forces PTY allocation for interactive tools
  if (remoteCommand) {
    sshArgs.splice(sshArgs.length - 1, 0, `-t`)
    sshArgs.push(`--`, remoteCommand)
  }

  try {
    const sshProc = spawn(`ssh`, sshArgs, { stdio: `inherit` })

    await new Promise<void>((resolve, reject) => {
      sshProc.on(`close`, (code) => {
        if (code && code !== 0) reject(new Error(`SSH exited with code ${code}`))
        else resolve()
      })
      sshProc.on(`error`, (err: any) => {
        if (err.code === `ENOENT`) reject(new Error(`ssh not found. Install OpenSSH to connect to sandboxes.`))
        else reject(err)
      })
    })
  } catch (err) {
    process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
  }
}
```

- [ ] **Step 5: Refactor ssh.ts to use shared utilities**

Rewrite `repos/repl/src/tasks/ssh.ts` to use the extracted utilities:

```typescript
import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { spawnSsh } from '@TRL/utils/tasks/spawnSsh'
import { stopSync, autoStartSync, createSyncContext } from '@TRL/utils/tasks/sandboxSync'
import { resolveOrgId } from '@TRL/utils/tasks/resolveOrgId'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'
import { sandboxConnect } from '@TRL/utils/tasks/sandboxConnect'

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox-id> [--org <id>]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = params.sandbox || options?.[0]
    if (!sandboxId) {
      process.stdout.write(`${themed(`warning`, `Usage: tsa ssh <sandbox-id> [--org <id>]`)}\n`)
      process.exit(1)
    }

    const client = new ApiClient(auth)
    const orgId = await resolveOrgId(client, params.org as string | undefined)

    await sandboxConnect(client, orgId, sandboxId)

    const syncCtx = createSyncContext()
    const syncConfig = config?.sync
    if (syncConfig?.autoStart && syncConfig?.rules?.length) {
      const { data: sandbox } = await client.getSandbox(orgId, sandboxId)
      await autoStartSync(syncCtx, syncConfig, orgId, sandboxId, sandbox)
    }

    try {
      await spawnSsh(sandboxId)
    } finally {
      await stopSync(syncCtx, sandboxId)
    }
  }),
}
```

- [ ] **Step 6: Run REPL type check**

Run: `cd repos/repl && pnpm types`
Expected: PASS

- [ ] **Step 7: Run REPL tests**

Run: `cd repos/repl && pnpm test`
Expected: All existing tests PASS

- [ ] **Step 8: Stage changes**

```bash
git add repos/repl/src/utils/tasks/resolveOrgId.ts repos/repl/src/utils/tasks/sandboxConnect.ts repos/repl/src/utils/tasks/sandboxSync.ts repos/repl/src/utils/tasks/spawnSsh.ts repos/repl/src/tasks/ssh.ts
```

---

## Task 13: REPL — New `tsa run` Command

Now that shared utilities exist, `tsa run` is a thin composition layer.

**Files:**
- Create: `repos/repl/src/tasks/run.ts`
- Modify: `repos/repl/src/tasks/index.ts`

- [ ] **Step 1: Create the run task**

Create `repos/repl/src/tasks/run.ts`:

```typescript
import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { spawnSsh } from '@TRL/utils/tasks/spawnSsh'
import { resolveOrgId } from '@TRL/utils/tasks/resolveOrgId'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'
import { sandboxConnect } from '@TRL/utils/tasks/sandboxConnect'
import { stopSync, autoStartSync, createSyncContext } from '@TRL/utils/tasks/sandboxSync'

export const run: TTask = {
  name: `run`,
  alias: [],
  description: `Start and connect to a sandbox with its AI runtime (recommended)`,
  example: `tsa run <sandbox-id> [--org <id>] [--no-sync]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
    noSync: {
      example: `--no-sync`,
      description: `Disable file sync even if configured`,
      alias: [`nosync`],
    },
    list: {
      example: `--list`,
      description: `List available sandboxes and pick interactively`,
      alias: [`ls`],
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const client = new ApiClient(auth)
    const orgId = await resolveOrgId(client, params.org as string | undefined)

    // Resolve sandbox ID (or list available)
    let sandboxId = params.sandbox || options?.[0]

    if (params.list || !sandboxId) {
      const { data: sandboxList, error } = await client.listSandboxes(orgId)
      if (error || !sandboxList?.length) {
        process.stdout.write(`${themed(`warning`, `No sandboxes found. Create one in the admin UI.`)}\n`)
        process.exit(1)
      }

      process.stdout.write(`\n${themed(`muted`, `Available sandboxes:`)}\n`)
      for (const sb of sandboxList) {
        const runtime = sb.config?.runtime || `custom`
        process.stdout.write(`  ${sb.id}  ${sb.name}  (${runtime})\n`)
      }
      process.stdout.write(`\n${themed(`muted`, `Run: tsa run <sandbox-id>`)}\n`)
      process.exit(0)
    }

    await sandboxConnect(client, orgId, sandboxId)

    // Resolve runtime command from sandbox config
    const { data: sandbox } = await client.getSandbox(orgId, sandboxId)
    const runtimeCommand = sandbox?.config?.runtimeCommand

    if (runtimeCommand) {
      process.stdout.write(`${themed(`success`, `Launching runtime:`)} ${runtimeCommand}\n`)
    } else {
      process.stdout.write(`${themed(`muted`, `No runtime command configured — opening shell`)}\n`)
    }

    // Auto-start sync (unless --no-sync)
    const syncCtx = createSyncContext()
    const noSync = params.noSync || params.nosync
    if (!noSync) {
      const syncConfig = config?.sync
      await autoStartSync(syncCtx, syncConfig, orgId, sandboxId, sandbox)
    }

    try {
      await spawnSsh(sandboxId, runtimeCommand)
    } finally {
      await stopSync(syncCtx, sandboxId)
    }
  }),
}
```

- [ ] **Step 2: Register the run task and reorder exports**

Edit `repos/repl/src/tasks/index.ts` to add `run` at the top (controls help output order):

```typescript
import type { TTasks } from '@TRL/types'

import { run } from './run'
import { ssh } from './ssh'
import { sync } from './sync'
import { help } from './help'
import { login } from './login'
import { proxy } from './proxy'
import { logout } from './logout'
import { status } from './status'
import { sandboxes } from './sandboxes'
import { chat } from './chat'
import { agents } from './agents'
import { threads } from './threads'

export const tasks: TTasks = {
  run,
  sandboxes,
  ssh,
  sync,
  help,
  login,
  proxy,
  logout,
  status,
  chat,
  agents,
  threads,
}
```

- [ ] **Step 3: Run REPL type check**

Run: `cd repos/repl && pnpm types`
Expected: PASS

- [ ] **Step 4: Stage changes**

```bash
git add repos/repl/src/tasks/run.ts repos/repl/src/tasks/index.ts
```

---

## Task 14: Cross-Repo Type Checks and Build Validation

**Files:** None created — validation only

- [ ] **Step 1: Run full type checks across all modified repos**

Run in dependency order:

```bash
cd repos/domain && pnpm types
cd repos/database && pnpm types
cd repos/sandbox && pnpm types
cd repos/backend && pnpm types
cd repos/admin && pnpm types
cd repos/repl && pnpm types
```

Expected: All PASS

- [ ] **Step 2: Run builds for repos that have build scripts**

```bash
cd repos/backend && pnpm build
cd repos/admin && pnpm build
```

Expected: Both PASS

- [ ] **Step 3: Run unit tests**

```bash
cd repos/domain && pnpm test
cd repos/database && pnpm test
cd repos/sandbox && pnpm test
cd repos/backend && pnpm test
cd repos/admin && pnpm test
cd repos/repl && pnpm test
```

Expected: All existing tests continue to PASS. New fields are optional, so no existing tests should break.

- [ ] **Step 4: Stage all remaining changes**

```bash
git add -A
git status
```

Review staged files to ensure no secrets, temp files, or root-level files are included.

---

## Task 15: Integration Testing

**Files:** None created — validation only

> **Note:** Integration tests require K8s services running (`tdsk dev start --clean`).

- [ ] **Step 1: Push database schema changes**

The user must manually run:
```bash
cd repos/database && pnpm push
```

This is interactive and requires confirmation for the new `built_in` column.

- [ ] **Step 2: Restart K8s services**

```bash
tdsk dev start --clean
```

Wait for all pods to be ready.

- [ ] **Step 3: Run integration test suite**

```bash
cd repos/integration && pnpm test
```

Expected: All existing tests PASS. The new `builtIn` column defaults to `false`, so existing sandbox records are unaffected.

- [ ] **Step 4: Manual validation — org creation seeds sandboxes**

Create a new org via the API and verify default sandboxes are seeded:

```bash
curl -s -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Test Org"}' \
  https://px.local.threadedstack.app/_/orgs | jq
```

Then list sandboxes for the new org:
```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://px.local.threadedstack.app/_/orgs/<new-org-id>/sandboxes" | jq
```

Expected: 4 sandboxes returned (Claude Code, Codex, OpenCode, Base), all with `builtIn: true`.

- [ ] **Step 5: Manual validation — copy sandbox**

```bash
curl -s -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"orgId":"<org-id>"}' \
  "https://px.local.threadedstack.app/_/sandboxes/<sandbox-id>/copy" | jq
```

Expected: New sandbox returned with `builtIn: false` and same config as original.

---

## Deferred: Docker Base Image

The spec calls for a `tdsk/sandbox` base image with Claude Code, Codex, and OpenCode pre-installed. This is a DevOps/infrastructure task handled through the `repos/cli` Docker build system (`tdsk doc build`). It is not part of this code plan because:

1. The image content depends on external tool releases (Claude Code binary, Codex CLI, OpenCode CLI)
2. Building and publishing Docker images requires registry credentials and CI/CD
3. The code changes in this plan work with any Docker image — the runtime resolution just sets env vars and passes commands

The Docker image build should be planned separately once the code changes are deployed and validated. Until then, the existing `tdsk/sandbox` image works — sandboxes will start but the runtime commands won't resolve to installed binaries.

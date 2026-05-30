# Provider Links Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three parallel provider arrays on Sandbox/Agent models with a single `providerLinks: TProviderLink[]` field, unify junction types, and bring sandbox admin UI to parity with agent provider management.

**Architecture:** Bottom-up: unified type → domain models → DB services → backend consumers → admin UI. Each layer builds on the previous. Tests updated alongside each model change.

**Tech Stack:** TypeScript, Vitest, React (MUI), Drizzle ORM, Express 5

**Spec:** `docs/superpowers/specs/2026-04-09-provider-links-refactor-design.md`

**CRITICAL GIT RULES (applies to ALL tasks and subagents):**
- **ALLOWED**: `git add`, `git status`, `git diff`, `git log`, `git branch`, `git show`
- **NEVER** run: `git commit`, `git push`, `git reset`, `git revert`, `git rebase`, `git cherry-pick`, `git stash`, `git merge`
- User handles all commits manually. No exceptions.

---

## File Map

### Creates
- None — all changes modify existing files

### Modifies
| File | Responsibility |
|------|---------------|
| `repos/domain/src/types/provider.types.ts` | Add `TProviderLink` type |
| `repos/domain/src/types/sandbox.types.ts` | Remove `TSandboxProvider` |
| `repos/domain/src/types/agent.types.ts` | Remove `TAgentProvider` |
| `repos/domain/src/models/sandbox.ts` | Replace parallel arrays with `providerLinks` |
| `repos/domain/src/models/agent.ts` | Replace parallel arrays with `providerLinks` |
| `repos/domain/src/models/agent.test.ts` | Update tests for new structure |
| `repos/database/src/services/sandbox.ts` | Update `model()` factory and insert types |
| `repos/database/src/services/agent.ts` | Update `model()` factory and insert types |
| `repos/backend/src/services/sandboxes/sandbox.ts` | `sandboxProviders` → `providerLinks` |
| `repos/admin/src/components/Agents/AgentDrawer.tsx` | `agentProviders` → `providerLinks` |
| `repos/admin/src/components/Endpoints/Tabs/AgentConfigTab.tsx` | `agentProviders` → `providerLinks` |
| `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx` | Add model/priority support, wire `ProviderLinkList` fully |

---

### Task 1: Add `TProviderLink` Unified Type

**Files:**
- Modify: `repos/domain/src/types/provider.types.ts`
- Modify: `repos/domain/src/types/sandbox.types.ts:46-50`
- Modify: `repos/domain/src/types/agent.types.ts:1-13`

- [ ] **Step 1: Add `TProviderLink` to `provider.types.ts`**

Add at the end of `repos/domain/src/types/provider.types.ts`:

```typescript
import type { Provider } from '@TDM/models/provider'

/**
 * A provider linked to an agent or sandbox with junction metadata.
 * Priority 0 = primary provider, 1+ = fallback providers.
 */
export type TProviderLink = {
  priority: number
  provider: Provider
  model?: string | null
}
```

Note: The file already has imports at line 1-2. Add the `Provider` import alongside existing imports, and add the type after line 27.

- [ ] **Step 2: Remove `TSandboxProvider` from `sandbox.types.ts`**

In `repos/domain/src/types/sandbox.types.ts`, delete lines 41-50 (the `TSandboxProvider` type and its doc comment):

```typescript
// DELETE this block:
/**
 * Sandbox-Provider relationship with priority.
 * Priority 0 = primary provider, 1+ = fallback providers.
 * Stored in sandboxProviders junction table.
 */
export type TSandboxProvider = {
  priority: number
  provider: Provider
  model?: string | null
}
```

Also remove the `Provider` import if it was only used by `TSandboxProvider` (check other usages in the file first).

- [ ] **Step 3: Remove `TAgentProvider` from `agent.types.ts`**

In `repos/domain/src/types/agent.types.ts`, delete lines 1-13 (the import and `TAgentProvider` type):

```typescript
// DELETE these lines:
import type { Provider } from '@TDM/models'
import type { TAgentEnvVars, TAgentEnvironment } from './ai.types'

/**
 * Agent-Provider relationship with priority.
 * Priority 0 = primary provider, 1+ = fallback providers.
 * Stored in agentProviders junction table.
 */
export type TAgentProvider = {
  priority: number
  provider: Provider
  model?: string | null
}
```

Keep the `import type { TAgentEnvVars, TAgentEnvironment } from './ai.types'` line since `TAgentProjectConfig` (line 20) uses those types. Only remove the `Provider` import.

- [ ] **Step 4: Verify types compile**

Run: `cd repos/domain && pnpm types`

Expected: Type errors in files that still import `TSandboxProvider` or `TAgentProvider`. These will be fixed in subsequent tasks. At this point, only confirm `provider.types.ts` itself compiles cleanly — the cascade of errors is expected and correct.

---

### Task 2: Refactor Sandbox Domain Model

**Files:**
- Modify: `repos/domain/src/models/sandbox.ts`

- [ ] **Step 1: Replace the Sandbox model**

Replace the entire content of `repos/domain/src/models/sandbox.ts` with:

```typescript
import type { TProviderLink, TKubeSandboxConfig } from '@TDM/types'

import { Base } from '@TDM/models/base'
import { Provider } from '@TDM/models/provider'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string
  builtIn: boolean = false
  config: TKubeSandboxConfig
  providerLinks: TProviderLink[] = []

  constructor(data: TSandboxData) {
    super()

    const { providerLinks, ...rest } = data

    Object.assign(this, {
      ...rest,
      providerLinks: (providerLinks || []).map((link) => ({
        ...link,
        provider:
          link.provider instanceof Provider
            ? link.provider
            : new Provider(link.provider),
      })),
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
  }
}
```

- [ ] **Step 2: Verify the model compiles in isolation**

Run: `cd repos/domain && pnpm types`

Expected: Errors from other files referencing old fields — that's fine. The model file itself should be clean.

---

### Task 3: Refactor Agent Domain Model

**Files:**
- Modify: `repos/domain/src/models/agent.ts`

- [ ] **Step 1: Replace the Agent model**

Replace the entire content of `repos/domain/src/models/agent.ts` with:

```typescript
import type {
  TProviderLink,
  TAgentEnvVars,
  TAgentEnvironment,
  TAgentProjectConfig,
} from '@TDM/types'

import { Base } from '@TDM/models/base'
import { Secret } from '@TDM/models/secret'
import { Project } from '@TDM/models/project'
import { Provider } from '@TDM/models/provider'

export class Agent extends Base {
  name: string
  orgId: string
  model?: string
  maxTokens?: number
  description?: string
  tools: string[] = []
  systemPrompt?: string
  active: boolean = true
  secrets: Secret[] = []
  projects: Project[] = []
  envVars: TAgentEnvVars = {}
  providerLinks: TProviderLink[] = []
  environment: TAgentEnvironment = {}
  projectConfigs: TAgentProjectConfig[] = []

  constructor(agent: Partial<Agent>) {
    super()

    const {
      secrets,
      projects,
      providerLinks,
      projectConfigs,
      ...rest
    } = agent

    Object.assign(this, {
      ...rest,
      secrets:
        secrets?.map((secret) =>
          secret instanceof Secret ? secret : new Secret(secret)
        ) || [],
      projects:
        projects?.map((project) =>
          project instanceof Project ? project : new Project(project)
        ) || [],
      providerLinks: (providerLinks || []).map((link) => ({
        ...link,
        provider:
          link.provider instanceof Provider
            ? link.provider
            : new Provider(link.provider),
      })),
      projectConfigs: projectConfigs || [],
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
  }

  /**
   * Get the project config for a specific project
   */
  getProjectConfig(projectId: string): TAgentProjectConfig | undefined {
    return this.projectConfigs?.find((c) => c.projectId === projectId)
  }

  /**
   * Resolve the model for a given provider ID using the 3-tier hierarchy:
   *   1. Per-provider junction model (from providerLinks.model)
   *   2. Agent-level model (agent.model)
   *   3. Provider default model (provider.options.model)
   * Returns undefined if no model is configured at any tier.
   */
  resolveModel(providerId: string, providerDefaultModel?: string): string | undefined {
    const link = this.providerLinks?.find((l) => l.provider.id === providerId)
    return link?.model || this.model || providerDefaultModel || undefined
  }

  /**
   * Get the effective agent config for a specific project context.
   * Merges base agent config with project-level overrides.
   * NULL override fields = inherit from base agent.
   * envVars and environment are deep merged (project keys win).
   * Returns a new Agent instance with merged config.
   */
  getEffectiveConfig(projectId?: string): Agent {
    if (!projectId) return this
    const config = this.getProjectConfig(projectId)
    if (!config) return this

    return new Agent({
      ...this,
      model: config.model ?? this.model,
      tools: config.tools ?? this.tools,
      projectConfigs: this.projectConfigs,
      providerLinks: this.providerLinks,
      maxTokens: config.maxTokens ?? this.maxTokens,
      systemPrompt: config.systemPrompt ?? this.systemPrompt,
      envVars: { ...this.envVars, ...(config.envVars || {}) },
      environment: { ...this.environment, ...(config.environment || {}) },
    })
  }

  sanitize() {
    return new Agent({
      ...this,
      providerLinks: this.providerLinks,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
```

- [ ] **Step 2: Verify the model compiles**

Run: `cd repos/domain && pnpm types`

Expected: Remaining type errors in consumer files. Model file itself should be clean.

---

### Task 4: Update Agent Model Tests

**Files:**
- Modify: `repos/domain/src/models/agent.test.ts`

- [ ] **Step 1: Rewrite the test file**

Replace the entire content of `repos/domain/src/models/agent.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import { Agent } from './agent'
import { Provider } from './provider'

describe(`Agent model`, () => {
  describe(`constructor`, () => {
    it(`should create agent with full data`, () => {
      const agent = new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        model: `gpt-4`,
        description: `A test agent`,
        active: true,
        tools: [`tool1`],
      })
      expect(agent.id).toBe(`agent-1`)
      expect(agent.name).toBe(`Test Agent`)
      expect(agent.orgId).toBe(`org-1`)
      expect(agent.active).toBe(true)
      expect(agent.tools).toEqual([`tool1`])
    })

    it(`should default to empty providerLinks array`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.providerLinks).toEqual([])
      expect(agent.providers).toEqual([])
      expect(agent.primaryProvider).toBeUndefined()
    })

    it(`should wrap raw provider objects in Provider class`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: { id: `prov-1`, type: `openai` } as any, priority: 0, model: null },
          { provider: { id: `prov-2`, type: `anthropic` } as any, priority: 1, model: null },
        ],
      })
      expect(agent.providerLinks).toHaveLength(2)
      expect(agent.providerLinks[0]?.provider).toBeInstanceOf(Provider)
      expect(agent.providerLinks[0]?.provider.id).toBe(`prov-1`)
      expect(agent.providerLinks[1]?.provider).toBeInstanceOf(Provider)
      expect(agent.providerLinks[1]?.provider.id).toBe(`prov-2`)
    })

    it(`should preserve Provider instances as-is`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [{ provider: prov, priority: 0, model: null }],
      })
      expect(agent.providerLinks[0]?.provider).toBe(prov)
      expect(agent.providerLinks[0]?.provider).toBeInstanceOf(Provider)
    })

    it(`should have correct defaults`, () => {
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
      })
      expect(agent.active).toBe(true)
      expect(agent.tools).toEqual([])
      expect(agent.secrets).toEqual([])
      expect(agent.projects).toEqual([])
      expect(agent.providerLinks).toEqual([])
      expect(agent.envVars).toEqual({})
      expect(agent.environment).toEqual({})
    })
  })

  describe(`providers getter`, () => {
    it(`should derive providers from providerLinks`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0, model: null },
          { provider: prov2, priority: 1, model: `gpt-4o` },
        ],
      })
      expect(agent.providers).toHaveLength(2)
      expect(agent.providers[0]).toBe(prov1)
      expect(agent.providers[1]).toBe(prov2)
    })

    it(`should return primary provider (first in array)`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0, model: null },
          { provider: prov2, priority: 1, model: null },
        ],
      })
      expect(agent.primaryProvider).toBe(prov1)
    })
  })

  describe(`providerLinks`, () => {
    it(`should store priority and model metadata`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0, model: null },
          { provider: prov2, priority: 5, model: `claude-sonnet` },
        ],
      })
      expect(agent.providerLinks).toHaveLength(2)
      expect(agent.providerLinks[0]?.provider).toBe(prov1)
      expect(agent.providerLinks[0]?.priority).toBe(0)
      expect(agent.providerLinks[0]?.model).toBeNull()
      expect(agent.providerLinks[1]?.provider).toBe(prov2)
      expect(agent.providerLinks[1]?.priority).toBe(5)
      expect(agent.providerLinks[1]?.model).toBe(`claude-sonnet`)
    })

    it(`should return empty array when no providers`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.providerLinks).toEqual([])
    })
  })

  describe(`resolveModel`, () => {
    it(`should return per-provider model when set`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        model: `agent-default`,
        providerLinks: [{ provider: prov, priority: 0, model: `per-provider-model` }],
      })
      expect(agent.resolveModel(`prov-1`, `provider-default`)).toBe(`per-provider-model`)
    })

    it(`should fall back to agent model when no per-provider model`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        model: `agent-default`,
        providerLinks: [{ provider: prov, priority: 0, model: null }],
      })
      expect(agent.resolveModel(`prov-1`, `provider-default`)).toBe(`agent-default`)
    })

    it(`should fall back to provider default when no agent model`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        providerLinks: [{ provider: prov, priority: 0, model: null }],
      })
      expect(agent.resolveModel(`prov-1`, `provider-default`)).toBe(`provider-default`)
    })

    it(`should return undefined when no model at any tier`, () => {
      const agent = new Agent({ name: `Test`, orgId: `org-1` })
      expect(agent.resolveModel(`prov-1`)).toBeUndefined()
    })
  })

  describe(`projectConfigs`, () => {
    it(`should default to empty array`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.projectConfigs).toEqual([])
    })

    it(`should store projectConfigs from constructor`, () => {
      const configs = [
        { agentId: `agent-1`, projectId: `proj-1`, model: `gpt-4o` },
        { agentId: `agent-1`, projectId: `proj-2`, model: `claude-3` },
      ]
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: configs,
      })
      expect(agent.projectConfigs).toHaveLength(2)
      expect(agent.projectConfigs[0]?.projectId).toBe(`proj-1`)
      expect(agent.projectConfigs[1]?.projectId).toBe(`proj-2`)
    })

    it(`should handle undefined projectConfigs gracefully`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: undefined,
      })
      expect(agent.projectConfigs).toEqual([])
    })
  })

  describe(`getProjectConfig`, () => {
    const configs = [
      { agentId: `agent-1`, projectId: `proj-1`, model: `gpt-4o`, maxTokens: 1000 },
      { agentId: `agent-1`, projectId: `proj-2`, model: `claude-3`, tools: [`search`] },
    ]

    it(`should return matching config by projectId`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: configs,
      })
      const result = agent.getProjectConfig(`proj-1`)
      expect(result).toBeDefined()
      expect(result?.projectId).toBe(`proj-1`)
      expect(result?.model).toBe(`gpt-4o`)
      expect(result?.maxTokens).toBe(1000)
    })

    it(`should return undefined when no matching config`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: configs,
      })
      const result = agent.getProjectConfig(`proj-nonexistent`)
      expect(result).toBeUndefined()
    })

    it(`should return undefined when projectConfigs is empty`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      const result = agent.getProjectConfig(`proj-1`)
      expect(result).toBeUndefined()
    })
  })

  describe(`getEffectiveConfig`, () => {
    const baseAgent = () =>
      new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        model: `gpt-4`,
        maxTokens: 2000,
        systemPrompt: `You are helpful`,
        tools: [`tool-a`, `tool-b`],
        envVars: { API_URL: `https://base.example.com`, SHARED_KEY: `base-value` },
        environment: { temperature: 0.5, streaming: true },
        providerLinks: [
          { provider: { id: `prov-1`, type: `openai` } as any, priority: 0, model: null },
        ],
        projectConfigs: [
          {
            agentId: `agent-1`,
            projectId: `proj-1`,
            model: `claude-3-opus`,
            maxTokens: 4000,
            systemPrompt: `You are a project assistant`,
            tools: [`tool-c`],
            envVars: { SHARED_KEY: `project-value`, PROJECT_VAR: `proj-only` },
            environment: { temperature: 1, streaming: false },
          },
          {
            agentId: `agent-1`,
            projectId: `proj-2`,
            model: null,
            maxTokens: null,
            systemPrompt: null,
            tools: null,
            envVars: null,
            environment: null,
          },
        ],
      })

    it(`should return self when no projectId provided`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig()
      expect(result).toBe(agent)
    })

    it(`should return self when projectId has no matching config`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-unknown`)
      expect(result).toBe(agent)
    })

    it(`should override model when config has non-null model`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.model).toBe(`claude-3-opus`)
    })

    it(`should keep base model when config model is null`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-2`)
      expect(result.model).toBe(`gpt-4`)
    })

    it(`should override maxTokens, systemPrompt, tools`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.maxTokens).toBe(4000)
      expect(result.systemPrompt).toBe(`You are a project assistant`)
      expect(result.tools).toEqual([`tool-c`])
    })

    it(`should deep merge envVars (project keys win)`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.envVars).toEqual({
        API_URL: `https://base.example.com`,
        SHARED_KEY: `project-value`,
        PROJECT_VAR: `proj-only`,
      })
    })

    it(`should deep merge environment (project keys win)`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.environment).toEqual({
        temperature: 1,
        streaming: false,
      })
    })

    it(`should preserve projectConfigs on effective config`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.projectConfigs).toEqual(agent.projectConfigs)
      expect(result.projectConfigs).toHaveLength(2)
    })

    it(`should preserve providerLinks on effective config`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.providerLinks).toHaveLength(1)
      expect(result.providerLinks[0]?.provider.id).toBe(`prov-1`)
    })

    it(`should return a new Agent instance (not mutate original)`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result).not.toBe(agent)
      expect(result).toBeInstanceOf(Agent)
      expect(agent.model).toBe(`gpt-4`)
      expect(agent.maxTokens).toBe(2000)
      expect(agent.systemPrompt).toBe(`You are helpful`)
      expect(agent.tools).toEqual([`tool-a`, `tool-b`])
      expect(agent.envVars).toEqual({
        API_URL: `https://base.example.com`,
        SHARED_KEY: `base-value`,
      })
    })
  })

  describe(`removed fields`, () => {
    it(`should NOT have a functions property`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(`functions` in agent).toBe(false)
      expect((agent as any).functions).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `cd repos/domain && pnpm test`

Expected: All tests pass. If there are compile errors from other files in the domain package being picked up, run only the agent test: `cd repos/domain && npx vitest run src/models/agent.test.ts`

---

### Task 5: Update Sandbox DB Service

**Files:**
- Modify: `repos/database/src/services/sandbox.ts`

- [ ] **Step 1: Update `TSandboxProviderMeta` and `model()` factory**

In `repos/database/src/services/sandbox.ts`, make three changes:

**Change 1** — Update the `TSandboxProviderMeta` type (lines 30-35). Replace:

```typescript
type TSandboxProviderMeta = {
  providerIds?: string[]
  providers: ProviderModel[]
  providerPriorities?: number[]
  providerModels?: Record<string, string>
}
```

With:

```typescript
type TSandboxProviderMeta = {
  providerIds?: string[]
  providerModels?: Record<string, string>
  providerLinks?: any[]
}
```

**Change 2** — Update the `model()` factory (lines 60-71). Replace:

```typescript
  model = (data: TSandboxSelectOpts) => {
    const sortedProviders = (data.providers || []).sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
    )

    return new SandboxModel({
      ...data,
      providers: sortedProviders.map((link) => link.provider),
      providerModels: sortedProviders.map((link) => link.model ?? null),
      providerPriorities: sortedProviders.map((link) => link.priority ?? 0),
    })
  }
```

With:

```typescript
  model = (data: TSandboxSelectOpts) => {
    return new SandboxModel({
      ...data,
      providerLinks: (data.providers || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => ({
          provider: link.provider,
          model: link.model ?? null,
          priority: link.priority ?? 0,
        })),
    })
  }
```

**Change 3** — Update destructuring in `create()` (line 111-117). Replace:

```typescript
    const {
      providers,
      providerIds,
      providerModels,
      providerPriorities,
      ...sandboxData
    } = data as TSandboxInsertOpts
```

With:

```typescript
    const {
      providerIds,
      providerModels,
      providerLinks,
      ...sandboxData
    } = data as TSandboxInsertOpts
```

**Change 4** — Update destructuring in `update()` (line 130). Replace:

```typescript
    const { providerIds, providerModels, ...sandboxData } = data
```

With:

```typescript
    const { providerIds, providerModels, providerLinks, ...sandboxData } = data
```

Also remove the `import type { Provider as ProviderModel } from '@tdsk/domain'` at line 1 if it's no longer used anywhere in the file.

- [ ] **Step 2: Run sandbox DB tests**

Run: `cd repos/database && pnpm test`

Expected: Tests pass (the sandbox DB service tests in `repos/backend/src/services/sandboxes/sandbox.test.ts` test the backend service, not the DB service directly, so they'll be addressed later).

---

### Task 6: Update Agent DB Service

**Files:**
- Modify: `repos/database/src/services/agent.ts`

- [ ] **Step 1: Update the `model()` factory**

In `repos/database/src/services/agent.ts`, replace the `model()` factory (lines 182-217):

Replace lines 189-208 (inside the `new AgentModel({...})` call):

```typescript
      providers: sortedProviders.map((link) => link.provider),
      providerModels: sortedProviders.map((link) => link.model ?? null),
      providerPriorities: sortedProviders.map((link) => link.priority ?? 0),
```

With:

```typescript
      providerLinks: sortedProviders.map((link) => ({
        provider: link.provider,
        model: link.model ?? null,
        priority: link.priority ?? 0,
      })),
```

The rest of the `model()` factory (projectLinks mapping, sanitization) stays the same.

- [ ] **Step 2: Verify types compile**

Run: `cd repos/database && pnpm types`

Expected: Clean compile. The `TAgentInsertOpts` type already has `providerIds` and `providerModels` as DB-layer fields, so no changes needed there — they don't reference the domain model's removed fields.

---

### Task 7: Update Backend Sandbox Service

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts:210-216`

- [ ] **Step 1: Replace `sandboxProviders` getter usage**

In `repos/backend/src/services/sandboxes/sandbox.ts`, replace lines 210-216:

```typescript
    const sbProviders = sandbox.sandboxProviders
    if (sbProviders?.length) {
      const providerLinks = sbProviders.map((sp) => ({
        provider: sp.provider,
        priority: sp.priority ?? 0,
        model: sp.model ?? undefined,
      }))
```

With:

```typescript
    if (sandbox.providerLinks?.length) {
      const providerLinks = sandbox.providerLinks.map((link) => ({
        provider: link.provider,
        priority: link.priority ?? 0,
        model: link.model ?? undefined,
      }))
```

The rest of the block (SecretResolver, resolveProviderEnv call, error check, Object.assign) stays unchanged.

- [ ] **Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`

Expected: Tests pass. The sandbox.test.ts file tests `startPod` behavior via mocks — check that no mock references `sandboxProviders`.

- [ ] **Step 3: Run type check**

Run: `cd repos/backend && pnpm types`

Expected: Clean compile.

---

### Task 8: Update Admin Agent Components

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx:122-128`
- Modify: `repos/admin/src/components/Endpoints/Tabs/AgentConfigTab.tsx:207-222`

- [ ] **Step 1: Update AgentDrawer.tsx**

In `repos/admin/src/components/Agents/AgentDrawer.tsx`, replace lines 122-128:

```typescript
      // Build providerModels from agent.agentProviders junction data
      const models: Record<string, string> = {}
      if (agent.agentProviders?.length) {
        for (const ap of agent.agentProviders) {
          if (ap.model) models[ap.provider.id] = ap.model
        }
      }
```

With:

```typescript
      // Build providerModels from agent.providerLinks junction data
      const models: Record<string, string> = {}
      if (agent.providerLinks?.length) {
        for (const link of agent.providerLinks) {
          if (link.model) models[link.provider.id] = link.model
        }
      }
```

- [ ] **Step 2: Update AgentConfigTab.tsx**

In `repos/admin/src/components/Endpoints/Tabs/AgentConfigTab.tsx`, replace lines 207-213:

```typescript
    // Build providerModels from agent.agentProviders junction data
    const models: Record<string, string> = {}
    if (selectedAgent.agentProviders?.length) {
      for (const ap of selectedAgent.agentProviders) {
        if (ap.model) models[ap.provider.id] = ap.model
      }
    }
```

With:

```typescript
    // Build providerModels from agent.providerLinks junction data
    const models: Record<string, string> = {}
    if (selectedAgent.providerLinks?.length) {
      for (const link of selectedAgent.providerLinks) {
        if (link.model) models[link.provider.id] = link.model
      }
    }
```

- [ ] **Step 3: Run admin type check**

Run: `cd repos/admin && pnpm types`

Expected: Clean compile (may show sandbox drawer issues — those are fixed in Task 9).

---

### Task 9: Bring Sandbox Drawer to Provider Parity

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`

- [ ] **Step 1: Add `providerModels` state**

In `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`, after line 135 (`const [providerIds, setProviderIds] = useState<string[]>([])`), add:

```typescript
  const [providerModels, setProviderModels] = useState<Record<string, string>>({})
```

- [ ] **Step 2: Update edit-mode pre-population**

Replace line 249:

```typescript
      setProviderIds(sandbox.providers?.map((p) => p.id) || [])
```

With:

```typescript
      setProviderIds(sandbox.providerLinks?.map((l) => l.provider.id) || [])
      const models: Record<string, string> = {}
      for (const link of sandbox.providerLinks || []) {
        if (link.model) models[link.provider.id] = link.model
      }
      setProviderModels(models)
```

- [ ] **Step 3: Update `reset()` to clear `providerModels`**

In the `reset()` function (line 193-222), add after `setProviderIds([])` (line 203):

```typescript
    setProviderModels({})
```

- [ ] **Step 4: Wire `ProviderLinkList` with full props**

Replace the `ProviderLinkList` usage (lines 809-831) with:

```tsx
                  <ProviderLinkList
                    reorderable
                    loading={!providersMap}
                    disabled={loading}
                    providers={linkedProviders.map((p) => ({
                      id: p.id,
                      name: p.name || p.id,
                      brand: p.brand,
                      model: providerModels[p.id] ?? null,
                    }))}
                    availableProviders={availableProviders.map((p) => ({
                      id: p.id,
                      name: p.name || p.id,
                      brand: p.brand,
                    }))}
                    onAdd={(p) =>
                      onAddProvider({
                        id: p.id,
                        brand: p.brand,
                        name: p.name,
                        type: 'ai',
                      } as Provider)
                    }
                    onReorder={(items) => setProviderIds(items.map((p) => p.id))}
                    onModelChange={(id, model) =>
                      setProviderModels((prev) => ({ ...prev, [id]: model }))
                    }
                    onRemove={(id) => {
                      onRemoveProvider(id)
                      setProviderModels((prev) => {
                        const updated = { ...prev }
                        delete updated[id]
                        return updated
                      })
                    }}
                  />
```

- [ ] **Step 5: Include `providerModels` in API payload**

In the `sandboxData` object (line 373-398), add `providerModels` after `providerIds`:

```typescript
    const sandboxData: Partial<Sandbox> = {
      name: name.trim(),
      providerIds,
      providerModels,
      config: {
        // ... rest stays the same
```

Note: `providerIds` is sent as a plain property in the request body — it no longer needs to be a field on the Sandbox model class since the backend endpoint destructures it from `req.body`.

- [ ] **Step 6: Run admin type check and build**

Run: `cd repos/admin && pnpm types && pnpm build`

Expected: Clean compile and successful build.

---

### Task 10: Full Validation

**Files:** None (validation only)

- [ ] **Step 1: Run all domain tests**

Run: `cd repos/domain && pnpm test`

Expected: All tests pass.

- [ ] **Step 2: Run all database tests**

Run: `cd repos/database && pnpm test`

Expected: All tests pass.

- [ ] **Step 3: Run all backend tests**

Run: `cd repos/backend && pnpm test`

Expected: All tests pass. If sandbox.test.ts fails due to mocks referencing old fields (`sandboxProviders`, `providerModels`, `providerPriorities`), update the mocks to use `providerLinks` instead.

- [ ] **Step 4: Run full type check across all repos**

Run: `pnpm types` (from root)

Expected: All repos type-check clean. If any repo has lingering references to `TSandboxProvider`, `TAgentProvider`, `agentProviders`, `sandboxProviders`, `providerPriorities`, or `providerModels` (as model fields), grep and fix:

```bash
# Search for any remaining references to old types/fields
rg "TSandboxProvider|TAgentProvider|agentProviders|sandboxProviders|providerPriorities|providerModels" repos/ --type ts -l
```

Note: `providerModels` is still valid as a local variable name in UI components (form state) and as a DB insert field — only references to it as a **model class property** (e.g., `agent.providerModels`, `sandbox.providerModels`) need fixing.

- [ ] **Step 5: Build all repos**

Run: `pnpm build` (from root, or in dependency order):

```bash
cd repos/domain && pnpm build
cd repos/database && pnpm build
cd repos/backend && pnpm build
cd repos/admin && pnpm build
```

Expected: All builds succeed.

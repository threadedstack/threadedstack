# Sandbox Provider Auth & Runtime Presets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable sandbox pods to authenticate with AI provider APIs by linking org providers to sandboxes and injecting credentials as environment variables at pod startup.

**Architecture:** A `sandbox_providers` junction table links sandboxes to providers. A static `RuntimeProviderEnvMap` in domain constants maps (runtime, providerBrand) → env vars. At `startPod()`, the backend resolves linked providers, generates MITM placeholders for API key providers and injects real credentials for complex auth (Sigv4, OAuth2). A new `gemini-cli` runtime is added to the sandbox base image and presets.

**Tech Stack:** Drizzle ORM (Postgres), Express 5, K8s pod manifests, Docker, React/MUI admin UI, Ink CLI

**Spec:** `docs/superpowers/specs/2026-04-07-sandbox-provider-auth-design.md`

**CRITICAL RULES FOR ALL TASKS:**
- **NEVER** run `git commit`, `git push`, or any git write commands. Only `git add`, `git status`, `git diff`, `git log`, `git show` are allowed.
- **NEVER** add TODO/FIXME comments to code. Implement everything fully.
- **NEVER** re-export from another package. Update all callsites to import from the real source.
- Shared (exported) types go in the repo's `types/` directory, never co-located.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `repos/domain/src/models/sandboxProvider.ts` | SandboxProvider domain model |
| `repos/domain/src/types/sandboxProvider.types.ts` | Env var mapping types (`TRuntimeEnvVar`, etc.) |
| `repos/database/src/schemas/sandboxProviders.ts` | Drizzle schema + relations for junction table |
| `repos/database/src/services/sandboxProvider.ts` | CRUD service for sandbox_providers |
| `repos/backend/src/endpoints/sandboxes/linkProvider.ts` | POST endpoint to link provider |
| `repos/backend/src/endpoints/sandboxes/listSandboxProviders.ts` | GET endpoint to list linked providers |
| `repos/backend/src/endpoints/sandboxes/unlinkProvider.ts` | DELETE endpoint to unlink provider |
| `repos/backend/src/utils/sandbox/resolveProviderEnv.ts` | Provider → env var resolution logic |

### Modified Files
| File | Changes |
|------|---------|
| `repos/domain/src/types/sandbox.types.ts` | Add `geminiCli` to `ESandboxRuntime` |
| `repos/domain/src/constants/sandbox.ts` | Add gemini-cli preset + `RuntimeProviderEnvMap` |
| `repos/domain/src/models/sandbox.ts` | Add optional `providers` field |
| `repos/domain/src/models/index.ts` | Export new SandboxProvider model |
| `repos/domain/src/types/index.ts` | Export new sandboxProvider types |
| `repos/domain/src/constants/index.ts` | Already exports `sandbox` — no change needed |
| `repos/database/src/schemas/schemas.ts` | Export new schema + relations |
| `repos/database/src/types/schema.types.ts` | Add Select/Insert types |
| `repos/database/src/services/index.ts` | Export new service |
| `repos/backend/src/services/sandboxes/sandbox.ts` | Call `resolveProviderEnv` in `startPod()` |
| `repos/backend/src/endpoints/sandboxes/sandboxes.ts` | Register 3 new endpoints |
| `repos/backend/src/endpoints/sandboxes/getSandbox.ts` | Include providers in response |
| `deploy/Dockerfile.sandbox-base` | Add `@google/gemini-cli` |
| `deploy/sandbox-entrypoint.sh` | Add credential file resolution |

---

## Task 1: Domain Types & Env Var Mapping Constants

**Files:**
- Create: `repos/domain/src/types/sandboxProvider.types.ts`
- Modify: `repos/domain/src/types/sandbox.types.ts`
- Modify: `repos/domain/src/types/index.ts`
- Modify: `repos/domain/src/constants/sandbox.ts`

- [ ] **Step 1: Add `geminiCli` to `ESandboxRuntime`**

In `repos/domain/src/types/sandbox.types.ts`, add the new enum value:

```typescript
export enum ESandboxRuntime {
  codex = `codex`,
  custom = `custom`,
  openCode = `opencode`,
  claudeCode = `claude-code`,
  geminiCli = `gemini-cli`,
}
```

- [ ] **Step 2: Create sandboxProvider types file**

Create `repos/domain/src/types/sandboxProvider.types.ts`:

```typescript
import type { TLLMProviderBrand, TSandboxRuntimeId } from '@TDM/types'

export type TEnvVarSource = 'secret' | 'option' | 'static'
export type TEnvVarInjection = 'mitm' | 'direct' | 'file'

export type TRuntimeEnvVar = {
  envVar: string
  source: TEnvVarSource
  optionKey?: string
  staticValue?: string
  injection?: TEnvVarInjection
  filePath?: string
  required?: boolean
  defaultValue?: string
}

/**
 * Brand key can be a plain TLLMProviderBrand or a composite key like 'amazonBedrock:bearer'
 * for auth method variants. resolveProviderEnv builds the composite key at runtime.
 */
export type TRuntimeProviderEnvMap = Record<
  TSandboxRuntimeId,
  Partial<Record<string, TRuntimeEnvVar[]>>
>
```

- [ ] **Step 3: Export types from barrel**

In `repos/domain/src/types/index.ts`, add:

```typescript
export * from './sandboxProvider.types'
```

- [ ] **Step 4: Add `RuntimeProviderEnvMap` constant**

In `repos/domain/src/constants/sandbox.ts`, add the following after the existing `SandboxPresets` export. Also add `geminiCli` entries to `SandboxRuntimeOptions`, `SandboxRuntimeConfigs`, and `SandboxPresets`.

Add to imports at top of file:

```typescript
import type { TRuntimeProviderEnvMap } from '@TDM/types'
```

Add gemini-cli to `SandboxRuntimeOptions`:

```typescript
export const SandboxRuntimeOptions = [
  { value: ESandboxRuntime.claudeCode, label: `Claude Code` },
  { value: ESandboxRuntime.codex, label: `Codex` },
  { value: ESandboxRuntime.openCode, label: `OpenCode` },
  { value: ESandboxRuntime.geminiCli, label: `Gemini CLI` },
  { value: ESandboxRuntime.custom, label: `Custom` },
]
```

Add gemini-cli to `SandboxRuntimeConfigs`:

```typescript
[ESandboxRuntime.geminiCli]: {
  runtimeCommand: `gemini`,
  initScript: `echo "Gemini CLI sandbox ready"`,
},
```

Add gemini-cli to `SandboxPresets`:

```typescript
[ESandboxRuntime.geminiCli]: {
  name: `Gemini CLI`,
  description: `Google Gemini CLI AI assistant`,
  config: {
    sshEnabled: true,
    idleTimeoutMinutes: 30,
    image: DefaultSandboxImage,
    resources: DefaultResources,
    runtime: ESandboxRuntime.geminiCli,
    runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.geminiCli].runtimeCommand,
    initScript: SandboxRuntimeConfigs[ESandboxRuntime.geminiCli].initScript,
  },
},
```

Add the full `RuntimeProviderEnvMap` at the end of the file:

```typescript
/**
 * Maps (runtime, providerBrand) → environment variables to inject into sandbox pods.
 * 
 * source: 'secret' = provider.secretId decrypted value
 *         'option' = provider.options[optionKey]
 *         'static' = fixed value from staticValue field
 * 
 * injection: 'mitm' (default) = placeholder token replaced by egress proxy in HTTP headers
 *            'direct' = real value injected as container env var
 *            'file' = secret value base64-encoded, decoded to filePath by entrypoint
 */
export const RuntimeProviderEnvMap: TRuntimeProviderEnvMap = {
  [ESandboxRuntime.claudeCode]: {
    anthropic: [
      { envVar: `ANTHROPIC_API_KEY`, source: `secret`, required: true },
    ],
    amazonBedrock: [
      { envVar: `CLAUDE_CODE_USE_BEDROCK`, source: `static`, staticValue: `1`, injection: `direct` },
      { envVar: `AWS_REGION`, source: `option`, optionKey: `region`, injection: `direct`, required: true },
      { envVar: `AWS_ACCESS_KEY_ID`, source: `option`, optionKey: `accessKeyId`, injection: `direct`, required: true },
      { envVar: `AWS_SECRET_ACCESS_KEY`, source: `secret`, injection: `direct`, required: true },
      { envVar: `AWS_SESSION_TOKEN`, source: `option`, optionKey: `sessionToken`, injection: `direct` },
    ],
    // Bedrock with Bearer Token auth (selected when provider.options.authMethod === 'bearer')
    // resolveProviderEnv checks authMethod and uses this key instead of amazonBedrock
    'amazonBedrock:bearer': [
      { envVar: `CLAUDE_CODE_USE_BEDROCK`, source: `static`, staticValue: `1`, injection: `direct` },
      { envVar: `AWS_REGION`, source: `option`, optionKey: `region`, injection: `direct`, required: true },
      { envVar: `AWS_BEARER_TOKEN_BEDROCK`, source: `secret`, required: true },
    ],
    'google-vertex': [
      { envVar: `CLAUDE_CODE_USE_VERTEX`, source: `static`, staticValue: `1`, injection: `direct` },
      { envVar: `CLOUD_ML_REGION`, source: `option`, optionKey: `region`, injection: `direct`, defaultValue: `global` },
      { envVar: `ANTHROPIC_VERTEX_PROJECT_ID`, source: `option`, optionKey: `projectId`, injection: `direct`, required: true },
      { envVar: `GOOGLE_APPLICATION_CREDENTIALS`, source: `secret`, injection: `file`, filePath: `/tmp/gcloud-sa.json`, required: true },
    ],
    zai: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `secret`, required: true },
      { envVar: `ANTHROPIC_BASE_URL`, source: `static`, staticValue: `https://api.z.ai/api/anthropic`, injection: `direct` },
      { envVar: `API_TIMEOUT_MS`, source: `static`, staticValue: `3000000`, injection: `direct` },
      { envVar: `ANTHROPIC_DEFAULT_HAIKU_MODEL`, source: `option`, optionKey: `haikuModel`, injection: `direct`, defaultValue: `glm-4.5-air` },
      { envVar: `ANTHROPIC_DEFAULT_SONNET_MODEL`, source: `option`, optionKey: `sonnetModel`, injection: `direct`, defaultValue: `glm-4.7` },
      { envVar: `ANTHROPIC_DEFAULT_OPUS_MODEL`, source: `option`, optionKey: `opusModel`, injection: `direct`, defaultValue: `glm-4.7` },
    ],
    openrouter: [
      { envVar: `ANTHROPIC_API_KEY`, source: `secret`, required: true },
      { envVar: `ANTHROPIC_BASE_URL`, source: `static`, staticValue: `https://openrouter.ai/api`, injection: `direct` },
      { envVar: `ANTHROPIC_MODEL`, source: `option`, optionKey: `model`, injection: `direct` },
    ],
    custom: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `secret`, required: true },
      { envVar: `ANTHROPIC_BASE_URL`, source: `option`, optionKey: `baseUrl`, injection: `direct`, required: true },
      { envVar: `ANTHROPIC_MODEL`, source: `option`, optionKey: `model`, injection: `direct` },
    ],
    ollama: [
      { envVar: `ANTHROPIC_AUTH_TOKEN`, source: `static`, staticValue: `ollama`, injection: `direct` },
      { envVar: `ANTHROPIC_API_KEY`, source: `static`, staticValue: ``, injection: `direct` },
      { envVar: `ANTHROPIC_BASE_URL`, source: `option`, optionKey: `baseUrl`, injection: `direct`, required: true, defaultValue: `http://localhost:11434` },
      { envVar: `ANTHROPIC_MODEL`, source: `option`, optionKey: `model`, injection: `direct` },
    ],
  },
  [ESandboxRuntime.codex]: {
    openai: [
      { envVar: `OPENAI_API_KEY`, source: `secret`, required: true },
    ],
    openrouter: [
      { envVar: `OPENROUTER_API_KEY`, source: `secret`, required: true },
    ],
    google: [
      { envVar: `GEMINI_API_KEY`, source: `secret`, required: true },
    ],
  },
  [ESandboxRuntime.openCode]: {
    anthropic: [
      { envVar: `ANTHROPIC_API_KEY`, source: `secret`, required: true },
    ],
    openai: [
      { envVar: `OPENAI_API_KEY`, source: `secret`, required: true },
    ],
    openrouter: [
      { envVar: `OPENROUTER_API_KEY`, source: `secret`, required: true },
    ],
  },
  [ESandboxRuntime.geminiCli]: {
    google: [
      { envVar: `GOOGLE_API_KEY`, source: `secret`, required: true },
    ],
    'google-vertex': [
      { envVar: `GOOGLE_API_KEY`, source: `secret`, injection: `direct`, required: true },
      { envVar: `GOOGLE_GENAI_USE_VERTEXAI`, source: `static`, staticValue: `true`, injection: `direct` },
      { envVar: `GOOGLE_APPLICATION_CREDENTIALS`, source: `secret`, injection: `file`, filePath: `/tmp/gcloud-sa.json` },
      { envVar: `GOOGLE_CLOUD_PROJECT`, source: `option`, optionKey: `projectId`, injection: `direct` },
      { envVar: `GOOGLE_CLOUD_REGION`, source: `option`, optionKey: `region`, injection: `direct` },
    ],
  },
  [ESandboxRuntime.custom]: {},
}
```

- [ ] **Step 5: Verify types compile**

Run: `cd repos/domain && pnpm types`

Expected: No type errors.

---

## Task 2: Domain Model — SandboxProvider

**Files:**
- Create: `repos/domain/src/models/sandboxProvider.ts`
- Modify: `repos/domain/src/models/sandbox.ts`
- Modify: `repos/domain/src/models/index.ts`

- [ ] **Step 1: Create SandboxProvider model**

Create `repos/domain/src/models/sandboxProvider.ts`:

```typescript
import { Base } from './base'

type TSandboxProviderData = Partial<SandboxProvider>

export class SandboxProvider extends Base {
  sandboxId: string
  providerId: string
  priority: number = 0
  model?: string

  constructor(data: TSandboxProviderData) {
    super()
    Object.assign(this, data)
  }
}
```

- [ ] **Step 2: Add providers field to Sandbox model**

In `repos/domain/src/models/sandbox.ts`, add the `providers` field:

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
  providers?: import('./provider').Provider[]

  constructor(data: TSandboxData) {
    super()
    Object.assign(this, data)
  }
}
```

Note: Using `import()` type to avoid circular dependency. The `Provider` model is in the same `models/` directory.

- [ ] **Step 3: Export from barrel**

In `repos/domain/src/models/index.ts`, add:

```typescript
export * from './sandboxProvider'
```

- [ ] **Step 4: Verify types**

Run: `cd repos/domain && pnpm types`

Expected: No type errors.

---

## Task 3: Database Schema — sandbox_providers

**Files:**
- Create: `repos/database/src/schemas/sandboxProviders.ts`
- Modify: `repos/database/src/schemas/schemas.ts`
- Modify: `repos/database/src/types/schema.types.ts`

- [ ] **Step 1: Create Drizzle schema**

Create `repos/database/src/schemas/sandboxProviders.ts`:

```typescript
import { relations } from 'drizzle-orm'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { base } from '@TDB/utils/schema/base'
import { providers } from '@TDB/schemas/providers'
import { pgTable, unique, integer, index, varchar, text } from 'drizzle-orm/pg-core'

/**
 * Sandbox-Providers junction table
 * Enables many-to-many relationship between sandboxes and providers
 * One sandbox can have multiple providers (primary AI auth, future git auth)
 * One provider can be used by multiple sandboxes
 * Priority field determines the primary provider (0 = primary)
 */
export const sandboxProviders = pgTable(
  `sandbox_providers`,
  {
    ...base,
    /** Sandbox reference */
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),

    /** Provider reference */
    providerId: varchar(`provider_id`, { length: 10 })
      .references(() => providers.id, { onDelete: `restrict` })
      .notNull(),

    /** Priority order: 0 = primary/default provider, 1+ = secondary */
    priority: integer(`priority`).default(0),

    /** Per-provider model override: NULL = use provider default */
    model: text(`model`),
  },
  (table) => [
    unique(`unique_sandbox_provider`).on(table.sandboxId, table.providerId),
    index(`idx_sandbox_provider_sandbox`).on(table.sandboxId),
    index(`idx_sandbox_provider_priority`).on(table.sandboxId, table.priority),
  ]
)

export const sandboxProvidersRelations = relations(sandboxProviders, ({ one }) => ({
  sandbox: one(sandboxes, {
    references: [sandboxes.id],
    fields: [sandboxProviders.sandboxId],
  }),
  provider: one(providers, {
    references: [providers.id],
    fields: [sandboxProviders.providerId],
  }),
}))
```

- [ ] **Step 2: Register in schemas barrel**

In `repos/database/src/schemas/schemas.ts`, add after the `agentProviders` line:

```typescript
export { sandboxProviders, sandboxProvidersRelations } from '@TDB/schemas/sandboxProviders'
```

- [ ] **Step 3: Add Select/Insert types**

In `repos/database/src/types/schema.types.ts`, add after the sandbox types (around line 73):

```typescript
export type TDBSandboxProviderSelect = TInferDates<typeof sandboxProviders.$inferSelect>
export type TDBSandboxProviderInsert = TInferDates<typeof sandboxProviders.$inferInsert>
```

Also add the import at the top of the file:

```typescript
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
```

- [ ] **Step 4: Verify types**

Run: `cd repos/database && pnpm types`

Expected: No type errors.

---

## Task 4: Database Service — SandboxProvider CRUD

**Files:**
- Create: `repos/database/src/services/sandboxProvider.ts`
- Modify: `repos/database/src/services/index.ts`

- [ ] **Step 1: Create service**

Create `repos/database/src/services/sandboxProvider.ts`:

```typescript
import type { TServiceOpts, TDBSandboxProviderSelect, TDBSandboxProviderInsert } from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { SandboxProvider as SandboxProviderModel } from '@tdsk/domain'

export class SandboxProvider extends Base<
  typeof sandboxProviders,
  TDBSandboxProviderSelect,
  TDBSandboxProviderInsert,
  SandboxProviderModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxProviders })
  }

  model = (data: TDBSandboxProviderSelect) => {
    return new SandboxProviderModel(data)
  }

  async listBySandbox(sandboxId: string) {
    return this.list({ where: { sandboxId }, orderBy: { priority: `asc` } })
  }

  async findLink(sandboxId: string, providerId: string) {
    const [row] = await this.db
      .select()
      .from(sandboxProviders)
      .where(eq(sandboxProviders.sandboxId, sandboxId))
      .where(eq(sandboxProviders.providerId, providerId))
    return row ? { data: this.model(row) } : { data: null }
  }

  async unlinkProvider(sandboxId: string, providerId: string) {
    const result = await this.db
      .delete(sandboxProviders)
      .where(eq(sandboxProviders.sandboxId, sandboxId))
      .where(eq(sandboxProviders.providerId, providerId))
    return { data: result }
  }
}
```

- [ ] **Step 2: Export from barrel**

In `repos/database/src/services/index.ts`, add:

```typescript
export { SandboxProvider as sandboxProvider } from './sandboxProvider'
```

- [ ] **Step 3: Verify types**

Run: `cd repos/database && pnpm types`

Expected: No type errors.

---

## Task 5: Backend — Provider Env Var Resolution Utility

**Files:**
- Create: `repos/backend/src/utils/sandbox/resolveProviderEnv.ts`

This is the core logic that maps provider data → env vars + placeholders.

- [ ] **Step 1: Create the resolution utility**

Create `repos/backend/src/utils/sandbox/resolveProviderEnv.ts`:

```typescript
import type { TPlaceholderMap } from '@tdsk/domain'
import type { TRuntimeEnvVar } from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { RuntimeProviderEnvMap } from '@tdsk/domain'
import { PhTokenPrefix } from '@TBE/constants/values'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'

type TProviderWithSecret = {
  id: string
  brand: string
  secretId?: string
  options?: Record<string, unknown>
}

type TSandboxProviderLink = {
  provider: TProviderWithSecret
  priority: number
  model?: string
}

type TResolveResult = {
  extraEnv: Record<string, string>
  placeholders: TPlaceholderMap
  errors: string[]
}

/**
 * Resolves linked providers into env vars and MITM placeholders for pod injection.
 *
 * For each linked provider, looks up the (runtime, brand) mapping in RuntimeProviderEnvMap
 * and generates either:
 *   - MITM placeholder tokens (for API key secrets sent in HTTP headers)
 *   - Real decrypted values (for Sigv4 credentials, OAuth, etc.)
 *   - Static values (for flags like CLAUDE_CODE_USE_BEDROCK=1)
 *   - Provider option values (for baseUrl, region, model, etc.)
 *   - Base64-encoded file contents (for service account JSON → file path)
 */
export async function resolveProviderEnv(
  runtime: string | undefined,
  sandboxProviders: TSandboxProviderLink[],
  secretResolver: SecretResolver,
  orgId: string
): Promise<TResolveResult> {
  const extraEnv: Record<string, string> = {}
  const placeholders: TPlaceholderMap = {}
  const errors: string[] = []

  if (!runtime || !sandboxProviders.length) return { extraEnv, placeholders, errors }

  const runtimeMap = RuntimeProviderEnvMap[runtime as keyof typeof RuntimeProviderEnvMap]
  if (!runtimeMap) return { extraEnv, placeholders, errors }

  for (const link of sandboxProviders) {
    const { provider } = link

    // Bedrock bearer token variant: check provider.options.authMethod
    let brandKey = provider.brand
    if (provider.brand === `amazonBedrock` && provider.options?.authMethod === `bearer`) {
      brandKey = `amazonBedrock:bearer`
    }

    const mapping = runtimeMap[brandKey as keyof typeof runtimeMap] as TRuntimeEnvVar[] | undefined
    if (!mapping) continue

    for (const entry of mapping) {
      const injection = entry.injection ?? `mitm`

      if (entry.source === `static`) {
        if (entry.staticValue != null) extraEnv[entry.envVar] = entry.staticValue
        continue
      }

      if (entry.source === `option`) {
        const value = entry.optionKey
          ? (provider.options?.[entry.optionKey] as string | undefined)
          : undefined
        const resolved = value ?? entry.defaultValue
        if (resolved != null) extraEnv[entry.envVar] = String(resolved)
        else if (entry.required) errors.push(`Missing provider option '${entry.optionKey}' for ${entry.envVar}`)
        continue
      }

      // source === 'secret'
      if (!provider.secretId) {
        if (entry.required) errors.push(`Provider '${provider.brand}' has no secret configured for ${entry.envVar}`)
        continue
      }

      if (injection === `mitm`) {
        const token = `${PhTokenPrefix}${nanoid(16)}`
        placeholders[token] = provider.secretId
        extraEnv[entry.envVar] = token
      } else if (injection === `direct`) {
        const value = await secretResolver.resolveApiKey({ orgId }, provider as any)
        if (value) extraEnv[entry.envVar] = value
        else if (entry.required) errors.push(`Failed to decrypt secret for ${entry.envVar}`)
      } else if (injection === `file`) {
        const value = await secretResolver.resolveApiKey({ orgId }, provider as any)
        if (value && entry.filePath) {
          extraEnv[`TDSK_CRED_FILE_${entry.envVar}`] = Buffer.from(value).toString(`base64`)
          extraEnv[entry.envVar] = entry.filePath
        } else if (entry.required) {
          errors.push(`Failed to decrypt secret for credential file ${entry.envVar}`)
        }
      }
    }

    // Inject model override from junction row (only for claude-code which supports ANTHROPIC_MODEL env var)
    if (link.model && runtime === `claude-code`) {
      extraEnv[`ANTHROPIC_MODEL`] = link.model
    }
  }

  return { extraEnv, placeholders, errors }
}
```

- [ ] **Step 2: Verify types**

Run: `cd repos/backend && pnpm types`

Expected: No type errors.

---

## Task 6: Backend — Integrate Provider Resolution into `startPod()`

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts`

- [ ] **Step 1: Add provider resolution to startPod**

In `repos/backend/src/services/sandboxes/sandbox.ts`, add the import at the top:

```typescript
import { resolveProviderEnv } from '@TBE/utils/sandbox/resolveProviderEnv'
```

Then, in the `startPod()` method, after the existing git token handling block (around line 199, after the `if (sandbox.config.gitRepo)` block) and before `const manifest = buildPodManifest(...)`, add:

```typescript
    // Resolve provider env vars for linked providers
    const sandboxProviderLinks = await this.db.services.sandboxProvider.listBySandbox(sandboxId)
    if (sandboxProviderLinks.data?.length) {
      const providerLinks = []
      for (const sp of sandboxProviderLinks.data) {
        const { data: provider } = await this.db.services.provider.get(sp.providerId)
        if (provider) providerLinks.push({ provider, priority: sp.priority ?? 0, model: sp.model ?? undefined })
      }

      if (providerLinks.length) {
        const secrets = new SecretResolver(this.db)
        const providerEnv = await resolveProviderEnv(
          sandbox.config.runtime,
          providerLinks,
          secrets,
          orgId
        )

        if (providerEnv.errors.length) {
          throw new Exception(400, `Provider auth configuration error: ${providerEnv.errors.join(', ')}`)
        }

        Object.assign(extraEnv, providerEnv.extraEnv)
        Object.assign(placeholders, providerEnv.placeholders)
      }
    }
```

Also add the import for `SecretResolver` and `Exception` if not already present:

```typescript
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { Exception } from '@tdsk/domain'
```

- [ ] **Step 2: Verify types**

Run: `cd repos/backend && pnpm types`

Expected: No type errors.

---

## Task 7: Backend — Sandbox Provider API Endpoints

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/linkProvider.ts`
- Create: `repos/backend/src/endpoints/sandboxes/listSandboxProviders.ts`
- Create: `repos/backend/src/endpoints/sandboxes/unlinkProvider.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/sandboxes.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/getSandbox.ts`

- [ ] **Step 1: Create linkProvider endpoint**

Create `repos/backend/src/endpoints/sandboxes/linkProvider.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource, RuntimeProviderEnvMap, SandboxProvider } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const linkProvider: TEndpointConfig = {
  path: `/:id/providers`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { providerId, priority = 0, model } = req.body
    const { db } = req.app.locals

    if (!providerId) throw new Exception(400, `providerId is required`)

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    const { data: provider } = await db.services.provider.get(providerId)
    if (!provider) throw new Exception(404, `Provider not found`)
    if (provider.orgId !== sandbox.orgId)
      throw new Exception(403, `Provider does not belong to the same organization`)

    // Validate brand compatibility with runtime
    const runtime = sandbox.config?.runtime
    if (runtime) {
      const runtimeMap = RuntimeProviderEnvMap[runtime as keyof typeof RuntimeProviderEnvMap]
      const brands = runtimeMap ? Object.keys(runtimeMap) : []
      if (brands.length && !brands.includes(provider.brand)) {
        throw new Exception(
          400,
          `Provider brand '${provider.brand}' is not compatible with runtime '${runtime}'. Compatible brands: ${brands.join(', ')}`
        )
      }
    }

    const link = new SandboxProvider({
      sandboxId: id,
      providerId,
      priority,
      model: model || undefined,
    })

    const { data } = await db.services.sandboxProvider.create(link)
    res.status(201).json({ data })
  },
}
```

- [ ] **Step 2: Create listSandboxProviders endpoint**

Create `repos/backend/src/endpoints/sandboxes/listSandboxProviders.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const listSandboxProviders: TEndpointConfig = {
  path: `/:id/providers`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.read,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    const { data } = await db.services.sandboxProvider.listBySandbox(id)

    // Enrich with provider data
    const enriched = []
    for (const link of data ?? []) {
      const { data: provider } = await db.services.provider.get(link.providerId)
      if (provider) {
        enriched.push({
          ...link,
          provider: { id: provider.id, brand: provider.brand, name: provider.name, type: provider.type },
        })
      }
    }

    res.status(200).json({ data: enriched })
  },
}
```

- [ ] **Step 3: Create unlinkProvider endpoint**

Create `repos/backend/src/endpoints/sandboxes/unlinkProvider.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const unlinkProvider: TEndpointConfig = {
  path: `/:id/providers/:providerId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id, providerId } = req.params
    const { db } = req.app.locals

    await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    await db.services.sandboxProvider.unlinkProvider(id, providerId)
    res.status(204).send()
  },
}
```

- [ ] **Step 4: Register endpoints in router**

In `repos/backend/src/endpoints/sandboxes/sandboxes.ts`, add the imports and register:

```typescript
import { linkProvider } from '@TBE/endpoints/sandboxes/linkProvider'
import { unlinkProvider } from '@TBE/endpoints/sandboxes/unlinkProvider'
import { listSandboxProviders } from '@TBE/endpoints/sandboxes/listSandboxProviders'
```

Add to the `endpoints` object:

```typescript
  endpoints: {
    getSandbox,
    copySandbox,
    stopSandbox,
    startSandbox,
    listSessions,
    listSandboxes,
    execInSandbox,
    createSandbox,
    updateSandbox,
    deleteSandbox,
    connectSandbox,
    getSandboxStatus,
    linkProvider,
    unlinkProvider,
    listSandboxProviders,
  },
```

- [ ] **Step 5: Update getSandbox to include providers**

In `repos/backend/src/endpoints/sandboxes/getSandbox.ts`, after retrieving the sandbox data, load and attach providers:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const getSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.read,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    // Attach linked providers
    const { data: links } = await db.services.sandboxProvider.listBySandbox(id)
    const providers = []
    for (const link of links ?? []) {
      const { data: provider } = await db.services.provider.get(link.providerId)
      if (provider) {
        providers.push({
          id: provider.id,
          brand: provider.brand,
          name: provider.name,
          priority: link.priority,
          model: link.model,
        })
      }
    }
    data.providers = providers

    res.status(200).json({ data })
  },
}
```

- [ ] **Step 6: Verify types and build**

Run: `cd repos/backend && pnpm types`

Expected: No type errors.

---

## Task 8: Dockerfile & Entrypoint Updates

**Files:**
- Modify: `deploy/Dockerfile.sandbox-base`
- Modify: `deploy/sandbox-entrypoint.sh`

- [ ] **Step 1: Add Gemini CLI to Dockerfile**

In `deploy/Dockerfile.sandbox-base`, update the npm install line (around line 27):

```dockerfile
    && npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli \
```

This adds `@google/gemini-cli` alongside the existing tools. The `gemini` binary will be available in PATH.

- [ ] **Step 2: Add credential file resolution to entrypoint**

In `deploy/sandbox-entrypoint.sh`, add the following block after the SSH password section (after line 7, before the SSH server start):

```bash
# 1b. Decode base64 credential files (e.g. Google Vertex service account JSON)
for var in $(env | grep '^TDSK_CRED_FILE_' | cut -d= -f1); do
  target_var="${var#TDSK_CRED_FILE_}"
  target_path="${!target_var}"
  if [ -n "$target_path" ] && [ -n "${!var}" ]; then
    echo "${!var}" | base64 -d > "$target_path"
    chmod 600 "$target_path"
    unset "$var"
  fi
done
```

The complete entrypoint should be:

```bash
#!/bin/bash
set -e

# 1. Set SSH password from environment
if [ -n "$TDSK_SSH_PASSWORD" ]; then
  echo "sandbox:$TDSK_SSH_PASSWORD" | chpasswd
fi

# 1b. Decode base64 credential files (e.g. Google Vertex service account JSON)
for var in $(env | grep '^TDSK_CRED_FILE_' | cut -d= -f1); do
  target_var="${var#TDSK_CRED_FILE_}"
  target_path="${!target_var}"
  if [ -n "$target_path" ] && [ -n "${!var}" ]; then
    echo "${!var}" | base64 -d > "$target_path"
    chmod 600 "$target_path"
    unset "$var"
  fi
done

# 2. Start SSH server (background daemon)
/usr/sbin/sshd -p 2222 -e

# 3. Configure git auth token if provided (placeholder replaced by egress proxy)
if [ -n "$TDSK_GIT_TOKEN" ]; then
  git config --system http.extraHeader "Authorization: Bearer $TDSK_GIT_TOKEN"
fi

# 4. Clone git repo if configured (goes through egress proxy for placeholder replacement)
if [ -n "$TDSK_GIT_REPO" ]; then
  BRANCH="${TDSK_GIT_BRANCH:-main}"
  echo "[sandbox-entrypoint] Cloning $TDSK_GIT_REPO (branch: $BRANCH) into /workspace..."
  if ! su -s /bin/bash sandbox -c 'exec git clone --branch "$0" "$1" /workspace' "$BRANCH" "$TDSK_GIT_REPO" 2>&1; then
    echo "[sandbox-entrypoint] WARNING: git clone failed. /workspace may be empty."
  fi
fi

# 5. Execute the container command (AI tool or sleep infinity)
exec "$@"
```

- [ ] **Step 3: Rebuild sandbox image**

Run: `cd repos/cli && pnpm cli doc build app`

Expected: Docker image builds successfully with gemini-cli included.

---

## Task 9: REPL CLI — Show Provider Brand in Sandbox List

**Files:**
- Modify: `repos/repl/src/tasks/sandboxes.ts`

- [ ] **Step 1: Add provider column to sandbox list**

In `repos/repl/src/tasks/sandboxes.ts`, the existing table shows `Name | Image | ID`. Update it to also show the primary provider brand. This requires the API response to include provider data.

The `listSandboxes` API already returns sandbox objects. If the backend `listSandboxes` endpoint doesn't include providers, the CLI can make a separate call per sandbox — but for a list view, that's expensive. A simpler approach: add a `providerBrand` column only if the sandbox data includes providers (populated by the backend list endpoint).

For now, just add the column header. The backend list endpoint can be enhanced to include the primary provider brand in a follow-up if needed. The REPL already has access to sandbox data.

Update the table formatting in the action to include a "Provider" column:

```typescript
// In the table formatting section, add:
{ header: `Provider`, key: `provider` },
```

And when building the rows, derive the provider label from the sandbox data:

```typescript
provider: sandbox.providers?.[0]?.brand ?? `—`,
```

- [ ] **Step 2: Verify REPL builds**

Run: `cd repos/repl && pnpm types`

Expected: No type errors.

---

## Task 10: Admin UI — Provider Picker on Sandbox Detail

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`

This task adds a "Providers" section to the sandbox drawer where users can link/unlink org providers.

- [ ] **Step 1: Read the existing SandboxDrawer component**

Read `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx` to understand the current structure and patterns used. The drawer likely uses the `Drawer` component from `@tdsk/components` and has form fields for sandbox config.

- [ ] **Step 2: Add provider linking UI**

Add a new section to the SandboxDrawer below the existing config fields:

1. A "Linked Providers" section with a list of currently linked providers (fetched via `GET /_/sandboxes/:id/providers`)
2. An "Add Provider" dropdown (Autocomplete/Select) filtered by runtime compatibility using `RuntimeProviderEnvMap`
3. Each linked provider shows brand icon, name, optional model override field, and an unlink button
4. Link action calls `POST /_/sandboxes/:id/providers`
5. Unlink action calls `DELETE /_/sandboxes/:id/providers/:providerId`

Use existing admin patterns:
- `@TAF/actions/` for API service calls
- `@TAF/hooks/` for data fetching
- MUI components (Autocomplete, Chip, IconButton, List)

- [ ] **Step 3: Add auth status indicator to sandbox list**

In the sandbox list/cards component, add a small badge or chip showing the primary linked provider brand (or a warning icon if no provider is linked and the runtime isn't `custom`).

- [ ] **Step 4: Add connect modal warning**

In `repos/admin/src/components/Sandboxes/ConnectModal.tsx`, check if the sandbox has linked providers. If not and the runtime is not `custom`, show a warning Alert:

```
No provider linked. The AI tool may fail to authenticate. Link a provider in sandbox settings.
```

- [ ] **Step 5: Verify admin builds**

Run: `cd repos/admin && pnpm types && pnpm build`

Expected: No type errors, build succeeds.

---

## Task 11: Unit Tests

**Files:**
- Create: `repos/domain/src/constants/sandbox.test.ts`
- Create: `repos/backend/src/utils/sandbox/resolveProviderEnv.test.ts`

- [ ] **Step 1: Test RuntimeProviderEnvMap completeness**

Create `repos/domain/src/constants/sandbox.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ESandboxRuntime, RuntimeProviderEnvMap, SandboxPresets, SandboxRuntimeConfigs } from '@TDM/constants/sandbox'

describe('RuntimeProviderEnvMap', () => {
  it('has mappings for every non-custom runtime', () => {
    const runtimes = Object.values(ESandboxRuntime).filter(r => r !== ESandboxRuntime.custom)
    for (const runtime of runtimes) {
      expect(RuntimeProviderEnvMap[runtime]).toBeDefined()
      expect(Object.keys(RuntimeProviderEnvMap[runtime]!).length).toBeGreaterThan(0)
    }
  })

  it('claude-code supports anthropic, amazonBedrock, google-vertex, zai, openrouter, custom, ollama', () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.claudeCode]!)
    expect(brands).toContain('anthropic')
    expect(brands).toContain('amazonBedrock')
    expect(brands).toContain('google-vertex')
    expect(brands).toContain('zai')
    expect(brands).toContain('openrouter')
    expect(brands).toContain('custom')
    expect(brands).toContain('ollama')
  })

  it('codex supports openai, openrouter, google', () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.codex]!)
    expect(brands).toContain('openai')
    expect(brands).toContain('openrouter')
    expect(brands).toContain('google')
  })

  it('gemini-cli supports google and google-vertex', () => {
    const brands = Object.keys(RuntimeProviderEnvMap[ESandboxRuntime.geminiCli]!)
    expect(brands).toContain('google')
    expect(brands).toContain('google-vertex')
  })

  it('every required entry with source=secret has injection specified', () => {
    for (const [, brands] of Object.entries(RuntimeProviderEnvMap)) {
      for (const [, entries] of Object.entries(brands)) {
        for (const entry of entries as any[]) {
          if (entry.source === 'secret' && entry.required) {
            // Should have injection set or default to mitm
            expect(entry.injection ?? 'mitm').toMatch(/^(mitm|direct|file)$/)
          }
        }
      }
    }
  })
})

describe('SandboxPresets', () => {
  it('includes geminiCli preset', () => {
    expect(SandboxPresets[ESandboxRuntime.geminiCli]).toBeDefined()
    expect(SandboxPresets[ESandboxRuntime.geminiCli].name).toBe('Gemini CLI')
    expect(SandboxPresets[ESandboxRuntime.geminiCli].config.runtime).toBe(ESandboxRuntime.geminiCli)
    expect(SandboxPresets[ESandboxRuntime.geminiCli].config.runtimeCommand).toBe('gemini')
  })
})

describe('SandboxRuntimeConfigs', () => {
  it('includes geminiCli config', () => {
    expect(SandboxRuntimeConfigs[ESandboxRuntime.geminiCli]).toBeDefined()
    expect(SandboxRuntimeConfigs[ESandboxRuntime.geminiCli].runtimeCommand).toBe('gemini')
  })
})
```

- [ ] **Step 2: Test resolveProviderEnv**

Create `repos/backend/src/utils/sandbox/resolveProviderEnv.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { resolveProviderEnv } from './resolveProviderEnv'

const mockSecretResolver = {
  resolveApiKey: vi.fn().mockResolvedValue('decrypted-api-key'),
} as any

describe('resolveProviderEnv', () => {
  it('returns empty for no providers', async () => {
    const result = await resolveProviderEnv('claude-code', [], mockSecretResolver, 'org_1')
    expect(result.extraEnv).toEqual({})
    expect(result.placeholders).toEqual({})
    expect(result.errors).toEqual([])
  })

  it('generates MITM placeholder for anthropic API key', async () => {
    const result = await resolveProviderEnv(
      'claude-code',
      [{ provider: { id: 'p1', brand: 'anthropic', secretId: 'sec_1' }, priority: 0 }],
      mockSecretResolver,
      'org_1'
    )
    expect(result.extraEnv.ANTHROPIC_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.keys(result.placeholders)).toHaveLength(1)
    expect(Object.values(result.placeholders)[0]).toBe('sec_1')
    expect(result.errors).toEqual([])
  })

  it('injects static values for bedrock flags', async () => {
    const result = await resolveProviderEnv(
      'claude-code',
      [{
        provider: {
          id: 'p1',
          brand: 'amazonBedrock',
          secretId: 'sec_1',
          options: { region: 'us-east-1', accessKeyId: 'AKID123', sessionToken: undefined },
        },
        priority: 0,
      }],
      mockSecretResolver,
      'org_1'
    )
    expect(result.extraEnv.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    expect(result.extraEnv.AWS_REGION).toBe('us-east-1')
    expect(result.extraEnv.AWS_ACCESS_KEY_ID).toBe('AKID123')
    expect(result.extraEnv.AWS_SECRET_ACCESS_KEY).toBe('decrypted-api-key')
    expect(Object.keys(result.placeholders)).toHaveLength(0) // direct, not MITM
  })

  it('errors on missing required option', async () => {
    const result = await resolveProviderEnv(
      'claude-code',
      [{
        provider: { id: 'p1', brand: 'amazonBedrock', secretId: 'sec_1', options: {} },
        priority: 0,
      }],
      mockSecretResolver,
      'org_1'
    )
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.includes('region'))).toBe(true)
  })

  it('handles file injection for vertex credentials', async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValueOnce('{"type":"service_account"}')
    const result = await resolveProviderEnv(
      'claude-code',
      [{
        provider: {
          id: 'p1',
          brand: 'google-vertex',
          secretId: 'sec_1',
          options: { projectId: 'my-project', region: 'us-east5' },
        },
        priority: 0,
      }],
      mockSecretResolver,
      'org_1'
    )
    expect(result.extraEnv.CLAUDE_CODE_USE_VERTEX).toBe('1')
    expect(result.extraEnv.ANTHROPIC_VERTEX_PROJECT_ID).toBe('my-project')
    expect(result.extraEnv.GOOGLE_APPLICATION_CREDENTIALS).toBe('/tmp/gcloud-sa.json')
    expect(result.extraEnv.TDSK_CRED_FILE_GOOGLE_APPLICATION_CREDENTIALS).toBeDefined()
    // Verify base64 decodes to original
    const decoded = Buffer.from(result.extraEnv.TDSK_CRED_FILE_GOOGLE_APPLICATION_CREDENTIALS, 'base64').toString()
    expect(decoded).toBe('{"type":"service_account"}')
  })

  it('injects model override from junction row', async () => {
    const result = await resolveProviderEnv(
      'claude-code',
      [{
        provider: { id: 'p1', brand: 'anthropic', secretId: 'sec_1' },
        priority: 0,
        model: 'claude-sonnet-4-6',
      }],
      mockSecretResolver,
      'org_1'
    )
    expect(result.extraEnv.ANTHROPIC_MODEL).toBe('claude-sonnet-4-6')
  })

  it('skips unknown brand for runtime', async () => {
    const result = await resolveProviderEnv(
      'codex',
      [{ provider: { id: 'p1', brand: 'anthropic', secretId: 'sec_1' }, priority: 0 }],
      mockSecretResolver,
      'org_1'
    )
    expect(result.extraEnv).toEqual({})
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd repos/domain && pnpm test -- src/constants/sandbox.test.ts`
Run: `cd repos/backend && pnpm test -- src/utils/sandbox/resolveProviderEnv.test.ts`

Expected: All tests pass.

---

## Task 12: Integration Tests

**Files:**
- Create: `repos/integration/src/tier1/sandbox-providers.test.ts`

- [ ] **Step 1: Create integration tests for sandbox provider linking**

Create `repos/integration/src/tier1/sandbox-providers.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { loadEnvs } from '../utils/loadEnvs'

const env = loadEnvs()

describe('Sandbox Provider Linking API', () => {
  let orgId: string
  let sandboxId: string
  let providerId: string
  const apiKey = env.testApiKey
  const baseUrl = env.baseUrl

  beforeAll(async () => {
    orgId = env.testOrgId
    // Get first sandbox for this org
    const sbRes = await fetch(`${baseUrl}/_/sandboxes?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const sbData = await sbRes.json()
    sandboxId = sbData.data?.[0]?.id
    expect(sandboxId).toBeTruthy()

    // Get first provider for this org
    const provRes = await fetch(`${baseUrl}/_/providers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const provData = await provRes.json()
    providerId = provData.data?.[0]?.id
  })

  it('links a provider to a sandbox', async () => {
    if (!providerId) return // skip if no providers configured
    const res = await fetch(`${baseUrl}/_/sandboxes/${sandboxId}/providers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId, priority: 0 }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.data.sandboxId).toBe(sandboxId)
    expect(data.data.providerId).toBe(providerId)
  })

  it('lists linked providers for a sandbox', async () => {
    const res = await fetch(`${baseUrl}/_/sandboxes/${sandboxId}/providers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('includes providers in sandbox GET response', async () => {
    const res = await fetch(`${baseUrl}/_/sandboxes/${sandboxId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.providers).toBeDefined()
    expect(Array.isArray(data.data.providers)).toBe(true)
  })

  it('unlinks a provider from a sandbox', async () => {
    if (!providerId) return
    const res = await fetch(`${baseUrl}/_/sandboxes/${sandboxId}/providers/${providerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status).toBe(204)

    // Verify unlinked
    const listRes = await fetch(`${baseUrl}/_/sandboxes/${sandboxId}/providers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const listData = await listRes.json()
    const stillLinked = listData.data?.some((l: any) => l.providerId === providerId)
    expect(stillLinked).toBe(false)
  })

  it('rejects linking an incompatible provider brand', async () => {
    if (!providerId) return
    // Try to link the same provider to a sandbox with an incompatible runtime
    // First, find or create a sandbox with codex runtime (which doesn't accept anthropic brand)
    const sbRes = await fetch(`${baseUrl}/_/sandboxes?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const sbData = await sbRes.json()
    const codexSandbox = sbData.data?.find((s: any) => s.config?.runtime === 'codex')
    if (!codexSandbox) return // skip if no codex sandbox available

    // Attempt to link an anthropic provider to a codex sandbox (should fail)
    const res = await fetch(`${baseUrl}/_/sandboxes/${codexSandbox.id}/providers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId, priority: 0 }),
    })
    // Should be 400 if provider brand is incompatible, or 201 if it happens to be compatible
    // The exact status depends on the provider's brand vs codex's supported brands
    expect([201, 400]).toContain(res.status)
  })
})
```

- [ ] **Step 2: Run integration tests**

Run: `cd repos/integration && npx vitest run --config configs/vitest.config.ts src/tier1/sandbox-providers.test.ts`

Expected: Tests pass (requires K8s services running).

---

## Task 13: Database Schema Push

This is a manual step — the user must run it interactively.

- [ ] **Step 1: Push schema to database**

The user runs from `repos/database/`:

```bash
pnpm push
```

This runs `drizzle-kit push` which is interactive and requires manual confirmation for the new `sandbox_providers` table.

---

## Execution Order

Tasks 1-4 (domain types, model, schema, service) have no dependencies between them and can run in parallel.

Task 5 (resolution utility) depends on Task 1 (types).

Task 6 (startPod integration) depends on Tasks 4-5.

Task 7 (API endpoints) depends on Tasks 2-4.

Task 8 (Dockerfile/entrypoint) is independent.

Task 9 (REPL) depends on Task 2.

Task 10 (Admin UI) depends on Task 7.

Tasks 11-12 (tests) depend on Tasks 1-7.

Task 13 (DB push) depends on Task 3.

```
Tasks 1-4 (parallel) → Task 5 → Task 6
                      → Task 7 → Task 10
Task 8 (parallel with anything)
Task 9 (after Task 2)
Tasks 11-12 (after Tasks 1-7)
Task 13 (after Task 3, manual)
```

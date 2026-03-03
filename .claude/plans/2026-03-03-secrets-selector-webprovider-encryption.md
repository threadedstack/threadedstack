# SecretsSelector Fix & webProvider Encryption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the SecretsSelector MUI Autocomplete errors in AgentDrawer and encrypt webProvider.apiKey using the existing secrets infrastructure.

**Architecture:** SecretsSelector fix is a single-file data-merge fix in AgentDrawer.tsx. webProvider encryption replaces the plaintext `apiKey` field with a `secretId` reference on `TWebProviderConfig`, decrypted at runtime by the backend's `SecretResolver` before passing to the agent runner. No backward compatibility needed.

**Tech Stack:** TypeScript, React, MUI, Vitest, SecretResolver (AES-256-GCM + HKDF)

**CRITICAL GIT RULES (applies to all subagents):**
- **NEVER** commit, amend, revert, or change git history
- **NEVER** run: `git add`, `git commit`, `git push`, `git reset`, `git revert`
- Read-only git operations ONLY: `git status`, `git diff`, `git log`

---

## Task 1: Fix SecretsSelector errors in AgentDrawer

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx`

### Step 1: Fix secretsList merge in loadData effect

In `AgentDrawer.tsx`, the `loadData` async function (lines 80-126) fetches org+project secrets but doesn't include the agent's own secrets. After the fetch completes, merge `agent.secrets` into the list.

**Current code (lines 84-92):**
```typescript
const [orgSecretsResult, projectSecretsResult] = await Promise.all([
  fetchSecrets({ orgId }),
  fetchSecrets({ orgId, projectId }),
])

setSecretsList([
  ...(orgSecretsResult.data || []),
  ...(projectSecretsResult.data || []),
])
```

**Replace with:**
```typescript
const [orgSecretsResult, projectSecretsResult] = await Promise.all([
  fetchSecrets({ orgId }),
  fetchSecrets({ orgId, projectId }),
])

// Merge org + project secrets, then add agent's own secrets (dedup by ID)
const fetched = [
  ...(orgSecretsResult.data || []),
  ...(projectSecretsResult.data || []),
]
const fetchedIds = new Set(fetched.map((s) => s.id))
const agentOnly = (agent?.secrets || []).filter((s) => s.id && !fetchedIds.has(s.id))
setSecretsList([...fetched, ...agentOnly])
```

### Step 2: Simplify selectedSecrets mapping

**Current code (lines 182-184):**
```typescript
setSelectedSecrets(
  (agent.secrets || []).map((s) => s.id || s.name || s.hashKey || '')
)
```

**Replace with:**
```typescript
setSelectedSecrets(
  (agent.secrets || []).filter((s) => s.id).map((s) => s.id)
)
```

The fallback chain is unnecessary — `agent.secrets` are full `Secret` objects that always have `id`.

### Step 3: Remove unnecessary seeding

**Delete lines 187-189:**
```typescript
// Seed secretsList from agent data to avoid UUID flash before async fetch
if (agent.secrets?.length) {
  setSecretsList((prev) => (prev?.length ? prev : agent.secrets!))
}
```

This seeding is now unnecessary because the `loadData` effect merges agent secrets into the fetched list directly. The seeding was the source of the bug — it temporarily set `secretsList` to agent-scoped secrets, which were then overwritten by the async fetch.

### Step 4: Run type checks

```bash
cd repos/admin && pnpm types
```

Expected: No type errors.

---

## Task 2: Domain type change — TWebProviderConfig

**Files:**
- Modify: `repos/domain/src/types/ai.types.ts`

### Step 1: Update TWebProviderConfig type

**Current code (lines 142-152):**
```typescript
/**
 * Web search/fetch provider configuration.
 *
 * @security apiKey is stored in plaintext within the agent environment JSONB.
 * TODO: Migrate to a secretRef pattern (store as a Secret entity, decrypt at runtime)
 * to match the AES-256-GCM encryption used for other secrets in the platform.
 */
export type TWebProviderConfig = {
  type?: TWebProviderBrand
  apiKey?: string
}
```

**Replace with:**
```typescript
/**
 * Web search/fetch provider configuration.
 * The API key is stored as an encrypted secret (secretId → secrets table).
 * Decrypted at runtime by SecretResolver in the backend before passing to the agent runner.
 */
export type TWebProviderConfig = {
  type?: TWebProviderBrand
  /** Reference to an encrypted secret containing the provider API key */
  secretId?: string
}
```

### Step 2: Run type checks to see what breaks

```bash
cd repos/domain && pnpm types
```

Expected: Type errors in agent and integration repos where `apiKey` was used. These will be fixed in subsequent tasks.

---

## Task 3: Agent runner — accept decrypted key via init opts

**Files:**
- Modify: `repos/agent/src/types/runner.types.ts`
- Modify: `repos/agent/src/tools/definitions/web/webProvider.ts`
- Modify: `repos/agent/src/tools/definitions/web/webProvider.test.ts`
- Modify: `repos/agent/src/runner/runner.ts`

### Step 1: Add webProviderApiKey to TAgentInitOpts

In `repos/agent/src/types/runner.types.ts`, add to `TAgentInitOpts` (after `environment?` field, around line 66):

```typescript
/** Decrypted web provider API key (resolved by backend from webProvider.secretId) */
webProviderApiKey?: string
```

### Step 2: Update createWebProvider factory signature

In `repos/agent/src/tools/definitions/web/webProvider.ts`, change from config-based to explicit params:

**Current:**
```typescript
import type { IWebProvider } from '@TAG/types'
import type { TWebProviderConfig } from '@tdsk/domain'

import { JinaWebProvider } from './jinaWebProvider'

export const createWebProvider = (config?: TWebProviderConfig): IWebProvider => {
  const type = config?.type ?? `jina`

  switch (type) {
    case `jina`:
      return new JinaWebProvider({ apiKey: config?.apiKey })
    default:
      throw new Error(`Unknown web provider: ${type}`)
  }
}
```

**Replace with:**
```typescript
import type { IWebProvider } from '@TAG/types'
import type { TWebProviderBrand } from '@tdsk/domain'

import { JinaWebProvider } from './jinaWebProvider'

export const createWebProvider = (type?: TWebProviderBrand, apiKey?: string): IWebProvider => {
  const resolvedType = type ?? `jina`

  switch (resolvedType) {
    case `jina`:
      return new JinaWebProvider({ apiKey })
    default:
      throw new Error(`Unknown web provider: ${resolvedType}`)
  }
}
```

### Step 3: Update webProvider unit tests

In `repos/agent/src/tools/definitions/web/webProvider.test.ts`, update to match new signature:

```typescript
import { describe, it, expect } from 'vitest'
import { createWebProvider } from './webProvider'
import { JinaWebProvider } from './jinaWebProvider'

describe(`createWebProvider`, () => {
  it(`should return JinaWebProvider when no args are provided`, () => {
    const provider = createWebProvider()
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when type is jina`, () => {
    const provider = createWebProvider(`jina`)
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when type is undefined`, () => {
    const provider = createWebProvider(undefined, `some-key`)
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should throw for unknown provider type`, () => {
    expect(() => createWebProvider(`unknown-provider` as any)).toThrow(
      `Unknown web provider: unknown-provider`
    )
  })

  it(`should return provider with type discriminant`, () => {
    const provider = createWebProvider()
    expect(provider.type).toBe(`jina`)
  })
})
```

### Step 4: Update runner.ts to use new createWebProvider signature

In `repos/agent/src/runner/runner.ts`:

**Add a private field** (after `#sandbox` around line 60):
```typescript
#webProviderApiKey?: string
```

**Update init() (line 103):**

Current:
```typescript
const webProvider = createWebProvider(opts.environment?.webProvider)
```

Replace with:
```typescript
this.#webProviderApiKey = opts.webProviderApiKey
const webProvider = createWebProvider(opts.environment?.webProvider?.type, this.#webProviderApiKey)
```

**Update updateConfig() (line 443):**

Current:
```typescript
const configWebProvider = createWebProvider(this.#opts?.environment?.webProvider)
```

Replace with:
```typescript
const configWebProvider = createWebProvider(
  this.#opts?.environment?.webProvider?.type,
  this.#webProviderApiKey,
)
```

### Step 5: Run unit tests

```bash
cd repos/agent && pnpm test
```

Expected: All agent unit tests pass.

### Step 6: Run type checks

```bash
cd repos/agent && pnpm types
```

Expected: No type errors.

---

## Task 4: Backend — decrypt webProvider secret in resolveSession

**Files:**
- Modify: `repos/backend/src/endpoints/ai/onWSConnect.ts`

### Step 1: Add webProvider decryption to resolveSession

In `repos/backend/src/endpoints/ai/onWSConnect.ts`, after the existing secret resolution (line 83: `resolveBodyParams`), add webProvider secret resolution before the return statement (line 85):

```typescript
// Resolve web provider API key from encrypted secret
let webProviderApiKey: string | undefined
const webProviderSecretId = agent.environment?.webProvider?.secretId
if (webProviderSecretId) {
  const { data: wpSecret } = await db.services.secret.get(webProviderSecretId)
  if (wpSecret?.encryptedValue) {
    const decrypted = await secrets.decrypt(wpSecret, agent.orgId)
    if (decrypted) webProviderApiKey = decrypted
    else logger.warn(`Failed to decrypt webProvider secret`, { secretId: webProviderSecretId })
  }
}
```

### Step 2: Include webProviderApiKey in session return

In the return object (line 85-105), add `webProviderApiKey` field:

**Add after line 92 (after `customFunctions`):**
```typescript
webProviderApiKey,
```

### Step 3: Run type checks

```bash
cd repos/backend && pnpm types
```

Expected: No type errors. The `Websocket.handlePrompt()` method receives the session object and passes it to `AgentRunner.init()` which now accepts `webProviderApiKey` via `TAgentInitOpts`.

### Step 4: Run backend unit tests

```bash
cd repos/backend && pnpm test
```

Expected: All backend tests pass.

---

## Task 5: Update integration tests

**Files:**
- Modify: `repos/integration/src/tier1/web-tools-config.test.ts`

### Step 1: Update tests that use apiKey to use secretId

The integration tests currently set `apiKey` directly on the webProvider config. Since apiKey no longer exists on the type, update the tests to:
1. Create a secret first
2. Reference the secret via `secretId` in the webProvider config

**In `web-tools-config.test.ts`:**

Replace the test `'agent update with webProvider apiKey'` (lines 108-130) with:

```typescript
test('agent update with webProvider secretId referencing encrypted secret', async () => {
  if (setupFailed) return expect(setupFailed).toBe(false)

  // Create a secret to reference
  const secretRes = await post<{ data: { id: string } }>(
    `/orgs/${orgId}/secrets`,
    { name: 'jina-api-key', value: 'jina_test_key_123' }
  )

  expect(secretRes.status).toBe(201)
  const secretId = secretRes.data.data.id

  const updateRes = await put<{
    data: { id: string; environment: Record<string, any> }
  }>(agentPath(), {
    environment: { webProvider: { type: 'jina', secretId } },
  })

  expect(updateRes.status).toBe(200)
  expect(updateRes.ok).toBe(true)

  const getRes = await get<{
    data: { id: string; environment: Record<string, any> }
  }>(agentPath())

  expect(getRes.status).toBe(200)
  const webProvider = getRes.data.data.environment?.webProvider
  expect(webProvider).toBeDefined()
  expect(webProvider.type).toBe('jina')
  expect(webProvider.secretId).toBe(secretId)
})
```

Also update the `'removing webProvider from environment'` test to clean up the secret if needed, and update the session test to account for the new secretId pattern.

### Step 2: Run integration tests

```bash
cd repos/integration && pnpm test -- --testPathPattern tier1/web-tools-config
```

Expected: All tier1 web tools config tests pass against live K8s.

---

## Task 6: Admin UI — add webProvider section to AgentDrawer

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx`

### Step 1: Add webProvider state

Add new state variables after `selectedSecrets` (line 76):

```typescript
const [webProviderType, setWebProviderType] = useState<string>('')
const [webProviderSecretId, setWebProviderSecretId] = useState<string>('')
```

### Step 2: Populate from agent data

In the agent pre-population effect (after line 183, where selectedSecrets is set):

```typescript
// Set web provider config
setWebProviderType(agent.environment?.webProvider?.type || '')
setWebProviderSecretId(agent.environment?.webProvider?.secretId || '')
```

In the reset block (after line 209):

```typescript
setWebProviderType('')
setWebProviderSecretId('')
```

### Step 3: Include in save payload

In `onSave`, update the `environment` field (line 258):

```typescript
environment: {
  streaming,
  temperature,
  ...(webProviderType
    ? {
        webProvider: {
          type: webProviderType,
          ...(webProviderSecretId ? { secretId: webProviderSecretId } : {}),
        },
      }
    : {}),
},
```

### Step 4: Add UI section

After the `KeyValueEditor` for Environment Variables (line 492) and before the SecretsSelector section (line 494), add a webProvider configuration section:

```tsx
<Divider />

<Box>
  <Typography
    variant='subtitle2'
    sx={{ fontWeight: 600, mb: 2 }}
  >
    Web Provider
  </Typography>
  <Stack spacing={2}>
    <Autocomplete
      id='web-provider-type'
      disabled={loading}
      value={webProviderType || null}
      options={['jina']}
      getOptionLabel={(opt) => opt.charAt(0).toUpperCase() + opt.slice(1)}
      onChange={(_, val) => setWebProviderType(val || '')}
      renderInput={(params) => (
        <TextField
          {...params}
          size='small'
          placeholder='Select provider...'
        />
      )}
    />
    {webProviderType && (
      <Autocomplete
        id='web-provider-secret'
        disabled={loading}
        value={webProviderSecretId || null}
        options={secretsList.map((s) => s.id)}
        getOptionLabel={(id) => {
          const secret = secretsList.find((s) => s.id === id)
          return secret?.name || id
        }}
        onChange={(_, val) => setWebProviderSecretId(val || '')}
        renderInput={(params) => (
          <TextField
            {...params}
            size='small'
            placeholder='Select API key secret...'
          />
        )}
      />
    )}
  </Stack>
</Box>
```

**Note:** Add `TextField` to the existing MUI imports at line 25 (already imported).

### Step 5: Run type checks

```bash
cd repos/admin && pnpm types
```

Expected: No type errors.

---

## Task 7: Full validation

### Step 1: Run all type checks

```bash
pnpm types
```

Expected: Zero type errors across all repos.

### Step 2: Run all unit tests

```bash
pnpm test
```

Expected: All unit tests pass.

### Step 3: Run integration tests

```bash
cd repos/integration && pnpm test
```

Expected: All tier1 and tier3 integration tests pass against live K8s.

---

## File Change Summary

| File | Change |
|------|--------|
| `repos/admin/src/components/Agents/AgentDrawer.tsx` | Merge agent.secrets into fetched list, simplify selectedSecrets mapping, remove seeding hack, add webProvider UI section |
| `repos/domain/src/types/ai.types.ts` | `TWebProviderConfig`: `apiKey` → `secretId` |
| `repos/agent/src/types/runner.types.ts` | Add `webProviderApiKey` to `TAgentInitOpts` |
| `repos/agent/src/tools/definitions/web/webProvider.ts` | Change `createWebProvider` signature to `(type?, apiKey?)` |
| `repos/agent/src/tools/definitions/web/webProvider.test.ts` | Update tests for new signature |
| `repos/agent/src/runner/runner.ts` | Store `#webProviderApiKey`, use new `createWebProvider` call |
| `repos/backend/src/endpoints/ai/onWSConnect.ts` | Decrypt webProvider.secretId in `resolveSession`, pass `webProviderApiKey` |
| `repos/integration/src/tier1/web-tools-config.test.ts` | Use `secretId` instead of `apiKey` |

# Provider Links Refactor — Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Scope:** Domain models, DB services, backend, admin UI, type unification

## Problem

Both `Sandbox` and `Agent` domain models store provider-junction data as three parallel arrays:

```typescript
providers: Provider[] = []
providerPriorities: number[] = []
providerModels: (string | null)[] = []
```

These arrays are implicitly correlated by index — `providers[2]`, `providerPriorities[2]`, and `providerModels[2]` all describe the same link. Each model then has a getter (`sandboxProviders` / `agentProviders`) that reassembles them into structured objects. The DB service `model()` factory explodes junction-table rows into three arrays, and the getter reverses that explosion. This round-trip adds no information and creates fragility: any sort, filter, or splice on one array silently corrupts the correlation.

Additionally:
- `TSandboxProvider` and `TAgentProvider` are identical types maintained separately.
- `providerIds` lives on the Sandbox domain model but is only used as API request input.
- The sandbox admin UI lacks model-override and priority-reorder support that agents already have, despite the backend and `ProviderLinkList` component fully supporting it.

## Solution

Replace three parallel arrays with a single `providerLinks: TProviderLink[]` field on both models. Unify the junction types. Remove `providerIds` from domain models. Bring sandbox UI to parity with agent UI for provider management.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Both Sandbox and Agent | Identical patterns; doing both avoids inconsistency and avoids touching downstream code twice |
| `providerIds` | Remove from domain models, keep in DB insert types | Domain models represent state, not request shapes |
| Naming | `providerLinks` with `providers` getter | Self-describing name for structured data; getter preserves backward compat for `sandbox.providers` access |
| Type unification | Single `TProviderLink` replaces both `TSandboxProvider` and `TAgentProvider` | Types are identical; split when they diverge, not before |
| Sandbox UI | Bring to parity with agent UI | Backend already supports model/priority for sandboxes; UI should expose it |

## Unified Type

New type in `repos/domain/src/types/provider.types.ts`:

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

`TSandboxProvider` in `sandbox.types.ts` and `TAgentProvider` in `agent.types.ts` are deleted. All imports update to `TProviderLink` from `@TDM/types`.

## Model Changes

### Sandbox (`repos/domain/src/models/sandbox.ts`)

**Remove:**
- `providers: Provider[]` field
- `providerPriorities: number[]` field
- `providerModels: (string | null)[]` field
- `providerIds?: string[]` field
- `sandboxProviders` getter

**Add:**
- `providerLinks: TProviderLink[]` field (source of truth)
- `providers` getter (derives `Provider[]` from `providerLinks`)
- `primaryProvider` getter (unchanged behavior, reads from `providerLinks[0]`)

```typescript
export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string
  builtIn: boolean = false
  config: TKubeSandboxConfig
  providerLinks: TProviderLink[] = []

  constructor(data: Partial<Sandbox>) {
    super()
    const { providerLinks, ...rest } = data
    Object.assign(this, {
      ...rest,
      providerLinks: (providerLinks || []).map(link => ({
        ...link,
        provider: link.provider instanceof Provider
          ? link.provider
          : new Provider(link.provider),
      })),
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map(l => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
  }
}
```

### Agent (`repos/domain/src/models/agent.ts`)

Same structural change. Additionally:

- `agentProviders` getter removed (callers update to `providerLinks`)
- `resolveModel` updated to read from `providerLinks`:

```typescript
resolveModel(providerId: string, providerDefaultModel?: string): string | undefined {
  const link = this.providerLinks.find(l => l.provider.id === providerId)
  return link?.model || this.model || providerDefaultModel || undefined
}
```

- `getEffectiveConfig` passes through `providerLinks` instead of parallel arrays.

## DB Service Changes

### Sandbox Service (`repos/database/src/services/sandbox.ts`)

**`model()` factory** — constructs `providerLinks` instead of three arrays:

```typescript
model = (data: TSandboxSelectOpts) => {
  return new SandboxModel({
    ...data,
    providerLinks: (data.providers || [])
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map(link => ({
        provider: link.provider,
        model: link.model ?? null,
        priority: link.priority ?? 0,
      })),
  })
}
```

**`TSandboxProviderMeta`** — cleaned up to only contain DB-layer input fields:

```typescript
type TSandboxProviderMeta = {
  providerIds?: string[]
  providerModels?: Record<string, string>
  // Stripped during destructure to prevent leaking into DB insert:
  providerLinks?: TProviderLink[]
}

export type TSandboxInsertOpts = TDBSandboxInsert & TSandboxProviderMeta
```

Removed from the old type: `providers: ProviderModel[]` (no longer a field on domain model) and `providerPriorities?: number[]` (no longer a field). Added `providerLinks` so it can be destructured out when callers spread a domain model into the insert.

**`create()` / `update()`** — destructure list updated to strip `providerLinks` instead of `providers`/`providerPriorities`:

```typescript
const { providerIds, providerModels, providerLinks, ...sandboxData } = data
```

**`#setProviders()`** — no functional changes. Still receives `providerIds` + `providerModels` map, still writes junction rows.

### Agent Service (`repos/database/src/services/agent.ts`)

Same pattern change to `model()` factory. Insert types similarly scoped to DB layer.

## Backend Changes

### Sandbox Service (`repos/backend/src/services/sandboxes/sandbox.ts`)

In `startPod()`, replace:
```typescript
const sbProviders = sandbox.sandboxProviders
```
With:
```typescript
const sbProviders = sandbox.providerLinks
```

The `resolveProviderEnv` call site maps from `TProviderLink` — same shape, just renamed field access.

### Endpoints

No changes. Endpoints destructure `providerIds` and `providerModels` from `req.body`, not from the domain model. They pass these to the DB service's `create()`/`update()`. Response serialization (`res.json({ data })`) will now include `providerLinks` instead of the three parallel arrays.

## API Wire Format Change

**Before:**
```json
{
  "providers": [{ "id": "prov_abc", "brand": "anthropic" }],
  "providerPriorities": [0],
  "providerModels": [null]
}
```

**After:**
```json
{
  "providerLinks": [
    { "provider": { "id": "prov_abc", "brand": "anthropic" }, "priority": 0, "model": null }
  ]
}
```

`providers` becomes a getter and is not included in `JSON.stringify()` output (no `toJSON()` on models). Clients that construct domain model instances from API responses (`new Sandbox(data)`, `new Agent(data)`) will receive `providerLinks` in the JSON, and the getter provides `providers` after construction.

## Client Changes

### Admin — Agent Components

**`AgentDrawer.tsx`** — Replace `agent.agentProviders` reads with `agent.providerLinks`:

```typescript
// Before:
if (agent.agentProviders?.length) {
  for (const ap of agent.agentProviders) {
    if (ap.model) models[ap.provider.id] = ap.model
  }
}

// After:
if (agent.providerLinks?.length) {
  for (const link of agent.providerLinks) {
    if (link.model) models[link.provider.id] = link.model
  }
}
```

**`AgentConfigTab.tsx`** — Same pattern: `selectedAgent.agentProviders` → `selectedAgent.providerLinks`.

**`BasicInfoForm.tsx`** — No changes. It receives `providerIds` and `providerModels` as props from the drawer; it doesn't access domain model getters.

**Display pages** (`ProjectAgents.tsx`, `OrgAgents.tsx`, `ProjectAgent.tsx`, `AgentDetailTab.tsx`, `ThreadsTab.tsx`) — No changes. They access `agent.primaryProvider` and `agent.providers`, both of which are getters that work unchanged.

### Admin — Sandbox Components

**`SandboxDrawer.tsx`** — Bring to parity with agent provider management:

1. Add `providerModels` state:
   ```typescript
   const [providerModels, setProviderModels] = useState<Record<string, string>>({})
   ```

2. Update edit-mode pre-population (line 249) to read from `providerLinks`:
   ```typescript
   setProviderIds(sandbox.providerLinks?.map(l => l.provider.id) || [])
   const models: Record<string, string> = {}
   for (const link of sandbox.providerLinks || []) {
     if (link.model) models[link.provider.id] = link.model
   }
   setProviderModels(models)
   ```

3. Update `reset()` to clear `providerModels`:
   ```typescript
   setProviderModels({})
   ```

4. Wire `ProviderLinkList` with full props (replacing the current non-reorderable usage):
   ```tsx
   <ProviderLinkList
     reorderable
     loading={!providersMap}
     disabled={loading}
     providers={linkedProviders.map(p => ({
       id: p.id,
       name: p.name || p.id,
       brand: p.brand,
       model: providerModels[p.id] ?? null,
     }))}
     availableProviders={availableProviders.map(p => ({
       id: p.id,
       name: p.name || p.id,
       brand: p.brand,
     }))}
     onAdd={(p) => onAddProvider({
       id: p.id,
       brand: p.brand,
       name: p.name,
       type: 'ai',
     } as Provider)}
     onReorder={(items) => setProviderIds(items.map(p => p.id))}
     onModelChange={(id, model) =>
       setProviderModels(prev => ({ ...prev, [id]: model }))
     }
     onRemove={(id) => {
       onRemoveProvider(id)
       setProviderModels(prev => {
         const updated = { ...prev }
         delete updated[id]
         return updated
       })
     }}
   />
   ```

5. Include `providerModels` in API payload (line 374):
   ```typescript
   const sandboxData = {
     name: name.trim(),
     providerIds,
     providerModels,
     config: { ... },
   }
   ```

**`Sandboxes.tsx`** — No changes. The auth column reads `sandbox.providers` (getter works).

**`ConnectModal.tsx`** — No changes. Reads `sandbox.providers` (getter works).

### REPL

No changes needed. Only accesses `agent.primaryProvider` (getter, works unchanged). No access to parallel arrays, `agentProviders`, or `sandboxProviders`.

## What Does NOT Change

- **Database schemas** — `sandbox_providers` and `agent_providers` junction tables are unchanged.
- **`#setProviders()` logic** — Still receives `providerIds` + `providerModels` map, still writes junction rows.
- **`resolveProviderEnv()`** — Receives provider link array with same shape.
- **Provider validation** in create/update endpoints — Still validates provider IDs from request body.
- **`ProviderLinkList` component** — Already supports all needed props.
- **`ModelSelect` component** — Already works for sandbox provider brands.

## Type Cleanup Summary

| Old Type | Location | Action |
|----------|----------|--------|
| `TSandboxProvider` | `domain/types/sandbox.types.ts` | Delete, replace with `TProviderLink` |
| `TAgentProvider` | `domain/types/agent.types.ts` | Delete, replace with `TProviderLink` |
| `TProviderLink` | `domain/types/provider.types.ts` | New unified type |
| `TSandboxProviderMeta` | `database/services/sandbox.ts` | Keep (DB insert concern, remove `providers` field) |

## Files Changed

### Domain (`repos/domain/`)
- `src/models/sandbox.ts` — Replace parallel arrays with `providerLinks`, add `providers` getter
- `src/models/agent.ts` — Same, remove `agentProviders` getter, update `resolveModel` and `getEffectiveConfig`
- `src/types/provider.types.ts` — New `TProviderLink` type
- `src/types/sandbox.types.ts` — Remove `TSandboxProvider`
- `src/types/agent.types.ts` — Remove `TAgentProvider`
- `src/types/index.ts` — Update barrel exports

### Database (`repos/database/`)
- `src/services/sandbox.ts` — Update `model()` factory, clean up `TSandboxProviderMeta`
- `src/services/agent.ts` — Update `model()` factory
- `src/types/schema.types.ts` — Update if it references removed types

### Backend (`repos/backend/`)
- `src/services/sandboxes/sandbox.ts` — `sandbox.sandboxProviders` → `sandbox.providerLinks`

### Admin (`repos/admin/`)
- `src/components/Sandboxes/SandboxDrawer.tsx` — Add `providerModels` state, wire `ProviderLinkList` with reorder/model props, update edit pre-population, include `providerModels` in payload
- `src/components/Agents/AgentDrawer.tsx` — `agent.agentProviders` → `agent.providerLinks`
- `src/components/Endpoints/Tabs/AgentConfigTab.tsx` — `selectedAgent.agentProviders` → `selectedAgent.providerLinks`

### No Changes Required
- `repos/repl/` — Only uses `primaryProvider` getter
- `repos/admin/src/components/Agents/BasicInfoForm.tsx` — Receives props, doesn't read model getters
- `repos/admin/src/components/Sandboxes/Sandboxes.tsx` — Reads `providers` getter
- `repos/admin/src/components/Sandboxes/ConnectModal.tsx` — Reads `providers` getter
- All agent display pages — Read `primaryProvider` and `providers` getters
- `repos/admin/src/components/Providers/ProviderLinkList.tsx` — Already supports all needed props

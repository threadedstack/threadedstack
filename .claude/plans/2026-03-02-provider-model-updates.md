# P1: Per-Provider Model Configuration in AgentDrawer

## Context

An agent can have multiple AI providers (OpenAI + Anthropic), but the drawer has only a single `model` text field. There's no way to set which model to use per provider. The backend stores a single `model` on the `agents` table. If an agent has OpenAI + Anthropic providers, only one model string can be set — but those ecosystems have completely different model IDs.

**Goal**: Add a `model` column to the `agentProviders` junction table so each provider linked to an agent gets its own model selector. Extract the QuickStart's existing model-select logic into a reusable component.

**Unblocks**: P2 "Model field dropdown" task and P2 "SecretsSelector errors" task.

---

## Architecture Decision: Per-Provider Model on Junction Table

- Add nullable `model` column to `agentProviders` — NULL means "inherit from provider default"
- Model resolution becomes: `junctionModel > agent.model > provider.options.model`
- Backward compatible: existing agents keep working (NULL junction models fall through to existing resolution)
- The admin UI moves model selection INTO each provider row in the priority list

---

## Implementation Steps

### Step 1: Database Schema — `repos/database`

**File**: `repos/database/src/schemas/agentProviders.ts`

Add nullable `model` column:
```typescript
model: text(`model`),  // nullable — NULL = inherit from provider/agent default
```

> User must manually run `cd repos/database && pnpm push` after this change (interactive).

---

### Step 2: Domain Types & Model — `repos/domain`

**File**: `repos/domain/src/types/agent.types.ts`

Add `model` to `TAgentProvider`:
```typescript
export type TAgentProvider = {
  provider: Provider
  priority: number
  model?: string | null  // per-provider model override
}
```

**File**: `repos/domain/src/models/agent.ts`

- Add `providerModels: (string | null)[] = []` field (parallel array, same pattern as `providerPriorities`)
- Destructure and assign in constructor
- Update `agentProviders` getter to include `model: this.providerModels[index] ?? null`

---

### Step 3: Database Service — `repos/database`

**File**: `repos/database/src/services/agent.ts`

1. Update `TAgentSelectOpts.providers[]` shape to include `model?: string | null`
2. Update `TAgentRelations` to include `providerModels?: Record<string, string>`
3. In `model()` factory: extract `providerModels` from sorted junction rows alongside `providerPriorities`
4. In `#relations()`: write `model: providerModels?.[providerId] ?? null` when inserting junction rows
5. Update `create()`, `update()`, `upsert()` to destructure and pass `providerModels`
6. Update `setProviders()` to accept optional models map

---

### Step 4: Backend Endpoints — `repos/backend`

**File**: `repos/backend/src/endpoints/agents/createAgent.ts`

- Extract `providerModels` from `providersWithPriority` array (each item can now have `{id, priority, model}`)
- Build `providerModels` map: `{ [p.id]: p.model }` for items with model
- Pass `agent.providerModels = providerModels` to DB service

**File**: `repos/backend/src/endpoints/agents/updateAgent.ts`

- Same pattern as createAgent

**File**: `repos/backend/src/endpoints/ai/onWSConnect.ts` (line 85)

Update `resolveSession()` model resolution:
```typescript
// Current:
model: agent.model || provider.options?.model

// New:
const junctionModel = agent.agentProviders?.[0]?.model
// ...
model: junctionModel || agent.model || provider.options?.model
```

---

### Step 5: Admin UI — New ModelSelect Component

**New file**: `repos/admin/src/components/Agents/ModelSelect.tsx`

Extracted from `ProviderStep.tsx` lines 103-317. A reusable component that:
- Takes `{ brand, model, disabled?, size?, onChange }` props
- Fetches models via `fetchProviderModels({ brand })` when `brand` changes
- Renders `SelectInput` dropdown when models are available
- Falls back to `TextInput` for custom brand or empty model lists
- Shows `CircularProgress` while loading

**Reuses existing**:
- `fetchProviderModels` action (`repos/admin/src/actions/providers/fetchProviderModels.ts`)
- `DynamicBrands` constant (`repos/admin/src/constants/providers.ts`)
- `SelectInput`, `TextInput` from `@tdsk/components`

---

### Step 6: Admin UI — Update ProviderPriorityList

**File**: `repos/admin/src/components/Agents/ProviderPriorityList.tsx`

Props changes:
- `aiProviders` type: `Array<{ id; name }>` → `Array<{ id; name; brand }>`
- Add `providerModels: Record<string, string>` prop
- Add `onModelChange: (models: Record<string, string>) => void` prop

Component changes:
- Add `getProviderBrand(id)` helper
- Render `<ModelSelect>` below each provider name in the list
- Clean up removed provider's model from `providerModels` in `onRemove`

---

### Step 7: Admin UI — Update BasicInfoForm

**File**: `repos/admin/src/components/Agents/BasicInfoForm.tsx`

- Add `providerModels` and `onModelChange` to `TBasicInfoFormProps`
- Update `aiProviders` type to include `brand`
- Pass new props through to `ProviderPriorityList`

---

### Step 8: Admin UI — Update ModelConfigForm

**File**: `repos/admin/src/components/Agents/ModelConfigForm.tsx`

- Remove `model` and `onModelChange` from props type
- Remove the model `TextInput`
- Rename section title to "Response Configuration"
- Keep maxTokens and temperature controls

---

### Step 9: Admin UI — Update AgentDrawer

**File**: `repos/admin/src/components/Agents/AgentDrawer.tsx`

State changes:
- Remove `model` state → replace with `providerModels: Record<string, string>` state
- Update `aiProviders` state type to `Array<{ id; name; brand }>`
- Update provider loading to include `brand` from fetched provider data

Pre-population (edit mode):
- Build `providerModels` map from `agent.agentProviders` (each now has `model`)
- Backward compat: if no per-provider models but `agent.model` exists, assign to primary provider

Save payload:
- Send `providers: providerIds.map((id, i) => ({ id, priority: i, model: providerModels[id] || null }))`
- Keep `model: providerModels[providerIds[0]] || ''` for backward compat
- Remove `providerIds` from payload (replaced by `providers` array — backend already supports this format)

Update `BasicInfoForm` usage: pass `providerModels` + `onModelChange`
Update `ModelConfigForm` usage: remove `model`/`onModelChange` props

---

### Step 10: (Optional) Refactor QuickStart ProviderStep

**File**: `repos/admin/src/components/Quickstart/ProviderStep.tsx`

Replace inline model fetching/rendering (lines 103-317) with `<ModelSelect>`. Keep provider card grid, API key input, and Ollama URL field. Only the model selection portion is replaced.

---

## Critical Files

| File | Change |
|------|--------|
| `repos/database/src/schemas/agentProviders.ts` | Add `model` column |
| `repos/domain/src/types/agent.types.ts` | Add `model` to `TAgentProvider` |
| `repos/domain/src/models/agent.ts` | Add `providerModels` parallel array |
| `repos/database/src/services/agent.ts` | Model factory, `#relations()`, CRUD methods |
| `repos/backend/src/endpoints/agents/createAgent.ts` | Extract providerModels from payload |
| `repos/backend/src/endpoints/agents/updateAgent.ts` | Same as createAgent |
| `repos/backend/src/endpoints/ai/onWSConnect.ts` | Model resolution hierarchy |
| **New**: `repos/admin/src/components/Agents/ModelSelect.tsx` | Reusable model selector |
| `repos/admin/src/components/Agents/ProviderPriorityList.tsx` | Inline ModelSelect per provider |
| `repos/admin/src/components/Agents/BasicInfoForm.tsx` | Pass-through new props |
| `repos/admin/src/components/Agents/ModelConfigForm.tsx` | Remove model field |
| `repos/admin/src/components/Agents/AgentDrawer.tsx` | State + save payload changes |
| `repos/admin/src/components/Quickstart/ProviderStep.tsx` | Optional refactor to use ModelSelect |

---

## Verification

1. **Type checks**: `pnpm types` from root (all repos)
2. **Unit tests**: `pnpm --filter @tdsk/admin test`, `pnpm --filter @tdsk/backend test`, `pnpm --filter @tdsk/domain test`
3. **Schema push**: User runs `cd repos/database && pnpm push`
4. **Manual UI verification**:
   - Open AgentDrawer, add 2 providers (e.g., OpenAI + Anthropic)
   - Verify model dropdown appears per provider with correct model lists
   - Save agent, reopen drawer, verify models persisted
   - Create a chat session — verify correct model is used for primary provider
5. **Integration tests**: Run relevant integration tests against live K8s

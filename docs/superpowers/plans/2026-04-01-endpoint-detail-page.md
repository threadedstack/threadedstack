# Endpoint Detail Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an endpoint detail page with tabbed navigation (Endpoint / Config / Test) that enables editing endpoint metadata and the linked function/agent from a single page, eliminating the need for multiple browser tabs.

**Architecture:** Mirrors the existing `AgentLayout` pattern — `EndpointLayout` wraps nested routes with MUI Tabs. Each tab is a separate route component with its own form state and save action. Child tabs read state from Jotai atoms directly (via `useActiveEndpoint()`, `useActiveOrgId()`, `useActiveProjectId()`) — the same pattern used by `AgentDetailTab` and other agent child routes. The FaaS and Agent config tabs combine endpoint configuration with the linked entity's full editor, saving to both APIs in parallel.

**Tech Stack:** React, React Router 7 (`react-router` v7.1.1), MUI, Jotai, Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-endpoint-detail-page-design.md`

**Skill:** Load `.claude/skills/tdsk-admin/SKILL.md` before starting implementation.

**Important codebase conventions:**
- All router imports use `from 'react-router'` (NOT `react-router-dom`)
- The `Endpoint` domain model uses `endpoint.type` (NOT `endpoint.endpointType`); `endpointType` only exists in local form state types
- Lazy imports in `Routes.tsx` use default exports: `lazy(() => import('...'))`
- Child routes read from Jotai selectors directly — Outlet context is NOT used in this codebase

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `repos/admin/src/components/Endpoints/EndpointLayout.tsx` | Layout wrapper: breadcrumbs, header, tabs, Outlet (default export) |
| `repos/admin/src/components/Endpoints/EndpointBreadcrumbs.tsx` | Breadcrumb navigation for endpoint detail |
| `repos/admin/src/components/Endpoints/Tabs/EndpointTab.tsx` | Directly editable endpoint metadata form (default export) |
| `repos/admin/src/components/Endpoints/Tabs/EndpointConfigTab.tsx` | Wrapper: renders ProxyConfigTab, FaasConfigTab, or AgentConfigTab (default export) |
| `repos/admin/src/components/Endpoints/Tabs/ProxyConfigTab.tsx` | Proxy endpoint configuration |
| `repos/admin/src/components/Endpoints/Tabs/FaasConfigTab.tsx` | FaaS endpoint config + full function editor |
| `repos/admin/src/components/Endpoints/Tabs/AgentConfigTab.tsx` | Agent endpoint config + full agent editor |
| `repos/admin/src/components/Endpoints/Tabs/EndpointTestTab.tsx` | Test panel wrapper (default export) |
| `repos/admin/src/hooks/endpoints/useUnsavedChangesGuard.ts` | Hook: dirty state tracking + navigation blocking |
| `repos/admin/src/types/endpointDetail.types.ts` | Types: EEndpointDetailTab enum |

### Modified Files

| File | Change |
|------|--------|
| `repos/admin/src/state/endpoints.ts` | Add `activeEndpointState` derived atom |
| `repos/admin/src/state/selectors.ts` | Add `useActiveEndpoint` selector hook |
| `repos/admin/src/types/routes.types.ts` | Add `ProjectEndpointConfig`, `ProjectEndpointTest` to ERoutePath |
| `repos/admin/src/types/index.ts` | Re-export new endpoint detail types |
| `repos/admin/src/routes/Routes.tsx` | Add nested endpoint routes under EndpointLayout |
| `repos/admin/src/components/Endpoints/Endpoints.tsx` | Remove edit drawer behavior, create-only, add `onSuccess` prop to drawer |
| `repos/admin/src/components/Endpoints/EndpointsTable.tsx` | Row click navigates, edit button navigates |
| `repos/admin/src/components/Endpoints/EndpointDrawer.tsx` | Create-only, `onSuccess` passes created endpoint |
| `repos/admin/src/hooks/endpoints/useEndpoints.ts` | Remove `onEdit`/edit drawer state, add navigation |

---

## Chunk 1: Foundation (State, Types, Routes)

### Task 1: Add activeEndpointState Derived Atom

**Files:**
- Modify: `repos/admin/src/state/endpoints.ts`
- Modify: `repos/admin/src/state/selectors.ts`

- [ ] **Step 1: Add the derived atom to endpoints.ts**

Open `repos/admin/src/state/endpoints.ts`. Add `activeEndpointState` after `projectEndpointsState`, mirroring the `activeAgentState` pattern from `repos/admin/src/state/agents.ts:24-34`:

```typescript
import { atom } from 'jotai'

export const activeEndpointState = atom((get) => {
  const endpointId = get(activeEndpointIdState)
  if (!endpointId) return undefined

  const all = get(endpointsState)
  if (!all) return undefined

  for (const scope of Object.values(all)) {
    if (scope?.[endpointId]) return scope[endpointId]
  }

  return undefined
})
```

- [ ] **Step 2: Add useActiveEndpoint selector to selectors.ts**

Open `repos/admin/src/state/selectors.ts`. Near the existing endpoint selectors (around line 140-141), add:

```typescript
import { activeEndpointState } from './endpoints'

export const useActiveEndpoint = () => useDerivedState<Endpoint>(activeEndpointState)
```

This mirrors the existing `useActiveAgent` pattern at line 165.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: No type errors related to the new atom/selector.


---

### Task 2: Add Detail Page Types

**Files:**
- Create: `repos/admin/src/types/endpointDetail.types.ts`
- Modify: `repos/admin/src/types/routes.types.ts`
- Modify: `repos/admin/src/types/index.ts`

- [ ] **Step 1: Create endpoint detail types file**

Create `repos/admin/src/types/endpointDetail.types.ts`:

```typescript
export enum EEndpointDetailTab {
  endpoint = 'endpoint',
  config = 'config',
  test = 'test',
}

export type TEndpointDetailTab = `${EEndpointDetailTab}`
```

- [ ] **Step 2: Re-export from types barrel**

Open `repos/admin/src/types/index.ts`. Add re-export following the pattern used for `TAgentDetailTab`:

```typescript
export * from './endpointDetail.types'
```

- [ ] **Step 3: Add route entries to ERoutePath**

Open `repos/admin/src/types/routes.types.ts`. The existing endpoint entries are around lines 81-94. Add two new entries near the endpoint group, using PascalCase convention:

```typescript
ProjectEndpointConfig = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId/config`,
ProjectEndpointTest = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId/test`,
```

- [ ] **Step 4: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 3: Add Nested Endpoint Routes

**Files:**
- Modify: `repos/admin/src/routes/Routes.tsx`

- [ ] **Step 1: Study existing agent route pattern**

Read `repos/admin/src/routes/Routes.tsx` around lines 192-224 to see how agent nested routes work with `AgentLayout`. The endpoint routes follow the same pattern.

- [ ] **Step 2: Create placeholder components with default exports**

All components must use `export default` so lazy imports work with the standard `lazy(() => import(...))` pattern used throughout Routes.tsx.

`repos/admin/src/components/Endpoints/EndpointLayout.tsx`:
```typescript
import { Outlet } from 'react-router'

const EndpointLayout = () => {
  return <Outlet />
}

export default EndpointLayout
```

`repos/admin/src/components/Endpoints/Tabs/EndpointTab.tsx`:
```typescript
const EndpointTab = () => <div>Endpoint Tab</div>
export default EndpointTab
```

`repos/admin/src/components/Endpoints/Tabs/EndpointConfigTab.tsx`:
```typescript
const EndpointConfigTab = () => <div>Config Tab</div>
export default EndpointConfigTab
```

`repos/admin/src/components/Endpoints/Tabs/EndpointTestTab.tsx`:
```typescript
const EndpointTestTab = () => <div>Test Tab</div>
export default EndpointTestTab
```

- [ ] **Step 3: Add endpoint detail routes**

Find the existing endpoints route in `Routes.tsx`. Add a sibling route for the detail page. Use the standard lazy import pattern:

```typescript
const EndpointLayout = lazy(() => import('@TAF/components/Endpoints/EndpointLayout'))
const EndpointTab = lazy(() => import('@TAF/components/Endpoints/Tabs/EndpointTab'))
const EndpointConfigTab = lazy(() => import('@TAF/components/Endpoints/Tabs/EndpointConfigTab'))
const EndpointTestTab = lazy(() => import('@TAF/components/Endpoints/Tabs/EndpointTestTab'))
```

Add the route definition as a sibling to the existing `endpoints` list route:

```typescript
{
  path: 'endpoints/:endpointId',
  Component: () => <SuspensePage Component={EndpointLayout} />,
  children: [
    {
      index: true,
      Component: () => <SuspensePage Component={EndpointTab} />,
    },
    {
      path: 'config',
      Component: () => <SuspensePage Component={EndpointConfigTab} />,
    },
    {
      path: 'test',
      Component: () => <SuspensePage Component={EndpointTestTab} />,
    },
  ],
},
```

- [ ] **Step 4: Verify build compiles**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

## Chunk 2: Layout & Navigation

### Task 4: Build EndpointBreadcrumbs

**Files:**
- Create: `repos/admin/src/components/Endpoints/EndpointBreadcrumbs.tsx`

Reference: `repos/admin/src/components/Agents/AgentBreadcrumbs.tsx`

- [ ] **Step 1: Implement EndpointBreadcrumbs**

Simpler than `AgentBreadcrumbs` — no nested thread/chat views. Shows: `Endpoints / endpoint-name`.

```typescript
import { useParams, useNavigate } from 'react-router'
import { useActiveEndpoint } from '@TAF/state/selectors'
```

Match the exact MUI components, sx styles, and separator icons used in `AgentBreadcrumbs`. Use `useParams()` for `orgId`/`projectId` and `useActiveEndpoint()` for the endpoint name.

- [ ] **Step 2: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 5: Build EndpointLayout

**Files:**
- Modify: `repos/admin/src/components/Endpoints/EndpointLayout.tsx` (replace placeholder)

Reference: `repos/admin/src/components/Agents/AgentLayout.tsx`

- [ ] **Step 1: Implement EndpointLayout**

Key responsibilities:

**1. Sync endpointId to Jotai** (mirror AgentLayout lines 47-53):
```typescript
import { useParams, useNavigate, useLocation, Outlet } from 'react-router'

const { endpointId, orgId, projectId } = useParams()
const [, setActiveEndpointId] = useActiveEndpointId()

useEffect(() => {
  if (endpointId) setActiveEndpointId(endpointId)
}, [endpointId])
```

**2. Data fetching** (mirror AgentLayout lines 55-58 — ensures deep links work):
```typescript
const [endpoints] = useProjectEndpoints()

useEffect(() => {
  if (orgId && projectId && !endpoints) {
    fetchEndpoints({ orgId, projectId })
  }
}, [orgId, projectId, endpoints])
```

**3. Read endpoint from Jotai:**
```typescript
const [endpoint] = useActiveEndpoint()
```

**4. URL-to-tab mapping:**
```typescript
const getActiveTab = (pathname: string): EEndpointDetailTab => {
  if (pathname.endsWith('/config')) return EEndpointDetailTab.config
  if (pathname.endsWith('/test')) return EEndpointDetailTab.test
  return EEndpointDetailTab.endpoint
}

const getConfigTabLabel = (type?: string): string => {
  switch (type) {
    case EEndpointType.proxy: return 'Proxy'
    case EEndpointType.faas: return 'Function'
    case EEndpointType.agent: return 'Agent'
    default: return 'Config'
  }
}
```

**5. Tab disabling via derived state** (no upward data flow needed):

Instead of passing `setTabsDisabled` to children, derive the disabled state by comparing the endpoint's saved type against a Jotai atom tracking the form's pending type. However, since the type change + save flow is contained within `EndpointTab`, a simpler approach: store a `pendingTypeChange` flag in a shared Jotai atom that `EndpointLayout` reads. Or simplest: use a local state in `EndpointLayout` and pass the setter down as a ref, but since this codebase avoids Outlet context, use a small Jotai atom:

Add to `repos/admin/src/state/endpoints.ts`:
```typescript
export const endpointTabsDisabledState = atomWithReset(false)
```

Add to `repos/admin/src/state/selectors.ts`:
```typescript
export const useEndpointTabsDisabled = () => useRecState(endpointTabsDisabledState)
```

Then in `EndpointLayout`, read `useEndpointTabsDisabled()` to disable Config/Test tabs. In `EndpointTab`, set it when type changes and clear it on save.

**6. Tab change handler:**
```typescript
const navigate = useNavigate()
const location = useLocation()

const tabRoutes: Record<EEndpointDetailTab, string> = {
  [EEndpointDetailTab.endpoint]: '',
  [EEndpointDetailTab.config]: 'config',
  [EEndpointDetailTab.test]: 'test',
}

const onTabChange = (_: unknown, newTab: EEndpointDetailTab) => {
  const route = tabRoutes[newTab]
  const base = `/orgs/${orgId}/projects/${projectId}/endpoints/${endpointId}`
  navigate(route ? `${base}/${route}` : base)
}
```

**7. Header:** Endpoint name, chips for type/method/visibility, Delete button with confirmation.

**8. Error state:** If endpoint is not found, show error with link back to list (mirror AgentLayout lines 102-119).

**9. Outlet:** Simple `<Outlet />` — no context passed. Child routes read from Jotai directly.

Must use `export default EndpointLayout`.

- [ ] **Step 2: Add endpointTabsDisabledState atom and selector**

Add the atom to `repos/admin/src/state/endpoints.ts` and the selector to `repos/admin/src/state/selectors.ts` as described above.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 6: Modify EndpointsTable for Navigation

**Files:**
- Modify: `repos/admin/src/components/Endpoints/EndpointsTable.tsx`

- [ ] **Step 1: Read current EndpointsTable**

Read the file to understand the `onEdit` prop pattern and action buttons.

- [ ] **Step 2: Replace onEdit with onNavigate**

- Rename `onEdit` prop to `onNavigate` in the type and component
- `onRowClick` handler (line ~154): Call `onNavigate(endpoint)`
- Edit action button (line ~129-132): Call `onNavigate(endpoint)`
- Delete action button: Keep as-is

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 7: Modify Endpoints Component and Hook

**Files:**
- Modify: `repos/admin/src/hooks/endpoints/useEndpoints.ts`
- Modify: `repos/admin/src/components/Endpoints/Endpoints.tsx`

- [ ] **Step 1: Read current useEndpoints hook and Endpoints component**

Read both files to understand the current drawer/edit state management.

- [ ] **Step 2: Update useEndpoints hook**

- Remove `onEdit` handler and the `endpoint` state used for edit mode
- Add `useNavigate` from `react-router`
- Add `onNavigate` handler that navigates to the detail page:

```typescript
import { useNavigate } from 'react-router'

const navigate = useNavigate()

const onNavigate = useCallback((endpoint: Endpoint) => {
  navigate(`/orgs/${orgId}/projects/${projectId}/endpoints/${endpoint.id}`)
}, [navigate, orgId, projectId])
```

- Rename `dialogOpen` to `createDrawerOpen` for clarity
- Return `onNavigate` instead of `onEdit`

- [ ] **Step 3: Update Endpoints component**

- Pass `onNavigate` to `EndpointsTable` instead of `onEdit`
- `EndpointDrawer` always receives `endpoint={null}` (create mode)
- **Add `onSuccess` prop** to `EndpointDrawer` — this is currently NOT passed. Wire it to a handler that navigates to the new endpoint:

```typescript
const onCreateSuccess = useCallback((endpoint?: Endpoint) => {
  setCreateDrawerOpen(false)
  if (endpoint?.id) {
    navigate(`/orgs/${orgId}/projects/${projectId}/endpoints/${endpoint.id}`)
  }
}, [navigate, orgId, projectId])

// In render:
<EndpointDrawer
  orgId={orgId}
  open={createDrawerOpen}
  endpoint={null}
  projectId={projectId}
  onClose={onCreateClose}
  onSuccess={onCreateSuccess}
/>
```

- [ ] **Step 4: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 8: Update EndpointDrawer for Create-Only + Navigation

**Files:**
- Modify: `repos/admin/src/components/Endpoints/EndpointDrawer.tsx`

- [ ] **Step 1: Read current EndpointDrawer**

Read the file, paying attention to the `onSave` handler (lines 152-233) and the `onClose`/`onSuccessCB` call ordering (lines 231-233).

- [ ] **Step 2: Update onSuccess to pass created endpoint**

Change the `onSuccess` prop type from `() => void` to `(endpoint?: Endpoint) => void`.

In `onSave`, after a successful `createEndpoint` call, pass the created endpoint to `onSuccess` **before** calling `onClose` (otherwise state may reset and lose the data):

```typescript
// After successful createEndpoint:
const result = await createEndpoint({ orgId, projectId, data })
if (result?.data) {
  onSuccessCB?.(result.data)  // Pass data BEFORE onClose resets state
  onClose()
}
```

Check the current ordering of `onClose()` vs `onSuccessCB()` at lines 231-233 and ensure the endpoint data is passed before any state reset.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

## Chunk 3: Tab Implementations

### Task 9: Build EndpointTab (Metadata Form)

**Files:**
- Modify: `repos/admin/src/components/Endpoints/Tabs/EndpointTab.tsx` (replace placeholder)

Reference: `repos/admin/src/components/Endpoints/EndpointFormBase.tsx` for field inputs.

- [ ] **Step 1: Read EndpointFormBase to understand field patterns**

Read `repos/admin/src/components/Endpoints/EndpointFormBase.tsx` and note the input components, option constants, and validation used.

- [ ] **Step 2: Implement the endpoint metadata form**

**Read state from Jotai** (NOT Outlet context):
```typescript
import { useActiveEndpoint, useActiveOrgId, useActiveProjectId, useEndpointTabsDisabled } from '@TAF/state/selectors'

const [endpoint] = useActiveEndpoint()
const [orgId] = useActiveOrgId()
const [projectId] = useActiveProjectId()
const [, setTabsDisabled] = useEndpointTabsDisabled()
```

**Form state** (note: `endpoint.type` not `endpoint.endpointType`):
```typescript
const [name, setName] = useState(endpoint.name)
const [type, setType] = useState(endpoint.type)
const [method, setMethod] = useState(endpoint.method)
const [path, setPath] = useState(endpoint.path)
const [isPublic, setIsPublic] = useState(endpoint.public)
```

**Type change confirmation** (only for existing endpoints):
When `type` changes, show a MUI Dialog:
> "Changing from [current] to [new] will unlink the current configuration. Any unsaved changes on the configuration tab will also be discarded. Are you sure?"

- If confirmed: update `type` state, call `setTabsDisabled(true)`
- If cancelled: revert to original value

**Save handler:**
```typescript
const onSave = async () => {
  const errors = vep.shared(name, path)
  if (errors) { setError(errors); return }

  setLoading(true)
  const result = await updateEndpoint({
    orgId, projectId,
    id: endpoint.id,
    data: { name, type, method, path, public: isPublic }  // Note: field is 'type', not 'endpointType'
  })
  setLoading(false)

  if (result?.error) { setError(result.error); return }
  setTabsDisabled(false)  // Re-enable tabs after type change is saved
}
```

**Layout:** Use `AgentSection` for card-based grouping. Use same input components as `EndpointFormBase`.

Must use `export default EndpointTab`.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 10: Build ProxyConfigTab

**Files:**
- Create: `repos/admin/src/components/Endpoints/Tabs/ProxyConfigTab.tsx`

Reference:
- `repos/admin/src/components/Endpoints/Proxy/EndpointProxy.tsx` — the parent component to reuse
- `repos/admin/src/components/Endpoints/EndpointDrawer.tsx` lines 74-79, 117-131, 152-166 — the ref/callback wiring pattern

- [ ] **Step 1: Read EndpointProxy and EndpointDrawer to understand the validation/config pattern**

The `EndpointProxy` component uses `TEndpointFormProps<TProxyEndpointConfig>` which requires:
- `onConfigChange: (config: T) => void` — callback that receives the built config
- `onValidate: (error: string | null) => void` — callback reporting validation status continuously as form state changes
- `loading: boolean`
- `endpoint: Endpoint`
- Plus `availableSecrets` and other data props

**Note:** `TEndpointFormProps` does NOT include a `validateTrigger` prop. Validation is triggered continuously by the `useEndpointForm` hook inside each type-specific component — it calls `onValidate()` on every state change. The parent reads the latest validation error from a ref on save. This is the pattern used in `EndpointDrawer` (lines 78-79, 129-131, 160-165).

- [ ] **Step 2: Implement ProxyConfigTab**

Replicate the ref/callback pattern from `EndpointDrawer`:

```typescript
import { useRef, useState } from 'react'
import { useActiveEndpoint, useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { EndpointProxy } from '@TAF/components/Endpoints/Proxy/EndpointProxy'

export const ProxyConfigTab = () => {
  const [endpoint] = useActiveEndpoint()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  const configRef = useRef<TProxyEndpointConfig | null>(null)
  const validationErrorRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onConfigChange = (config: TProxyEndpointConfig) => {
    configRef.current = config
  }

  // Called continuously by useEndpointForm as form state changes
  const onValidate = (error: string | null) => {
    validationErrorRef.current = error
  }

  const onSave = async () => {
    // Read latest validation error (already populated by onValidate callback)
    if (validationErrorRef.current) return
    if (!configRef.current) return

    setLoading(true)
    await updateEndpoint({
      orgId, projectId,
      id: endpoint.id,
      data: { options: configRef.current }
    })
    setLoading(false)
  }

  return (
    <AgentSection title="Proxy Configuration">
      <EndpointProxy
        endpoint={endpoint}
        loading={loading}
        onConfigChange={onConfigChange}
        onValidate={onValidate}
        // Pass availableSecrets — load from useProjectSecrets() Jotai state
      />
      {/* Save button */}
    </AgentSection>
  )
}
```

**Important:** Load `availableSecrets` via `useProjectSecrets()` from Jotai state. Check what other data props `EndpointProxy` needs by reading its prop type definition. The same pattern (no `validateTrigger` prop, read validation error from ref on save) applies to `FaasConfigTab` and `AgentConfigTab` as well.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 11: Build FaasConfigTab

**Files:**
- Create: `repos/admin/src/components/Endpoints/Tabs/FaasConfigTab.tsx`

Reference:
- `repos/admin/src/components/Endpoints/Faas/EndpointFass.tsx` — FaaS endpoint config
- `repos/admin/src/components/Functions/FunctionDrawer.tsx` — Function editor fields

- [ ] **Step 1: Read FunctionDrawer to understand function form state and sub-component dependencies**

Read `repos/admin/src/components/Functions/FunctionDrawer.tsx`. Identify:
- All state fields managed by the function editor
- How it initializes from an existing function
- How it maps form state to API payload
- Sub-components used: `Code`, `ParamsEditor`, `KeyValueEditor`
- Whether any sub-components have drawer-specific dependencies (close handlers, drawer state) that would need handling when used outside a drawer

- [ ] **Step 2: Implement FaasConfigTab**

Two sections:

**Section 1: Endpoint Configuration**
- Use the FaaS endpoint form components (from `EndpointFass`/`FaasInputs`)
- Wire with refs/callbacks same as ProxyConfigTab (Task 10 pattern)
- Fields: function selector, memory, timeout, secrets, env vars, arguments

**Section 2: Function Editor** (visible when a function is selected):
- Read selected function from `useProjectFunctions()` Jotai state
- Initialize function form state from the selected function entity
- Render: function name, language, description, `Code` (Monaco), `ParamsEditor`, `KeyValueEditor`
- If sub-components have drawer-specific dependencies, wrap them or provide the expected props

**Empty state:** When no function is selected, Section 2 shows: "Select a function above to edit its configuration."

**Dual save handler:**
```typescript
const onSave = async () => {
  // 1. Validate endpoint config (via refs)
  // 2. Validate function fields
  // 3. Parallel save
  const [endpointResult, functionResult] = await Promise.all([
    updateEndpoint({ orgId, projectId, id: endpoint.id, data: { options: faasConfig } }),
    selectedFunctionId
      ? updateFunction({
          orgId, projectId, id: selectedFunctionId,
          data: { name: funcName, language, description, content, inputSchema: parsedSchema, dependencies: parsedDeps }
        })
      : Promise.resolve(null)
  ])
  // Show errors if either fails
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 12: Build AgentConfigTab

**Files:**
- Create: `repos/admin/src/components/Endpoints/Tabs/AgentConfigTab.tsx`

Reference:
- `repos/admin/src/components/Endpoints/Agent/EndpointAgent.tsx` — Agent endpoint config
- `repos/admin/src/components/Agents/AgentDrawer.tsx` — Agent editor fields

- [ ] **Step 1: Read AgentDrawer to understand agent form state and sub-component dependencies**

Read `repos/admin/src/components/Agents/AgentDrawer.tsx`. Identify:
- All state fields for agent configuration
- How it initializes from an existing agent
- Sub-components: `BasicInfoForm`, `ModelConfigForm`, `AgentSettingsForm`, `WebProviderSettings`, `ProviderPriorityList`, `ToolsSelector`, `Code` (system prompt)
- Whether any sub-components have drawer-specific dependencies

- [ ] **Step 2: Implement AgentConfigTab**

Two sections:

**Section 1: Endpoint Configuration**
- Use `EndpointAgent`/`AgentInputs` (same ref/callback pattern as Tasks 10-11)
- Fields: agent selector, endpoint-specific overrides (max tokens, secrets, functions, env vars)

**Section 2: Agent Configuration** (visible when an agent is selected):
- Read selected agent from Jotai state
- Core agent fields from `AgentDrawer`: provider/model selection, streaming, system prompt, tools
- Components: `BasicInfoForm`, `ModelConfigForm`, `AgentSettingsForm`, `WebProviderSettings`, `ToolsSelector`, `Code`
- If sub-components have drawer-specific dependencies, wrap them appropriately

**No threads, skills, or schedules** — those stay on the Agent detail page.

**Empty state:** "Select an agent above to edit its configuration."

**Dual save:** `PUT /endpoints/:id` + `PUT /agents/:id` in parallel.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 13: Build EndpointConfigTab Wrapper

**Files:**
- Modify: `repos/admin/src/components/Endpoints/Tabs/EndpointConfigTab.tsx` (replace placeholder)

- [ ] **Step 1: Implement EndpointConfigTab**

Simple type-switching wrapper that reads from Jotai:

```typescript
import { EEndpointType } from '@tdsk/domain'
import { useActiveEndpoint } from '@TAF/state/selectors'
import { ProxyConfigTab } from './ProxyConfigTab'
import { FaasConfigTab } from './FaasConfigTab'
import { AgentConfigTab } from './AgentConfigTab'

const EndpointConfigTab = () => {
  const [endpoint] = useActiveEndpoint()

  switch (endpoint?.type) {  // Note: endpoint.type, not endpoint.endpointType
    case EEndpointType.proxy:
      return <ProxyConfigTab />
    case EEndpointType.faas:
      return <FaasConfigTab />
    case EEndpointType.agent:
      return <AgentConfigTab />
    default:
      return null
  }
}

export default EndpointConfigTab
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 14: Build EndpointTestTab

**Files:**
- Modify: `repos/admin/src/components/Endpoints/Tabs/EndpointTestTab.tsx` (replace placeholder)

- [ ] **Step 1: Read EndpointTestPanel props**

Read `repos/admin/src/components/Endpoints/EndpointTestPanel.tsx` to understand its prop interface.

- [ ] **Step 2: Implement EndpointTestTab**

Read from Jotai and pass as props:

```typescript
import { useActiveEndpoint, useActiveProjectId } from '@TAF/state/selectors'
import { EndpointTestPanel } from '@TAF/components/Endpoints/EndpointTestPanel'

const EndpointTestTab = () => {
  const [endpoint] = useActiveEndpoint()
  const [projectId] = useActiveProjectId()

  if (!endpoint || !projectId) return null

  return <EndpointTestPanel endpoint={endpoint} projectId={projectId} />
}

export default EndpointTestTab
```

Check if `EndpointTestPanel` requires additional props and provide them.

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

## Chunk 4: Safeguards & Polish

### Task 15: Implement Unsaved Changes Guard

**Files:**
- Create: `repos/admin/src/hooks/endpoints/useUnsavedChangesGuard.ts`

- [ ] **Step 1: Check React Router v7 useBlocker API**

The project uses `react-router` v7.1.1. Verify `useBlocker` is available and check its API signature. In React Router v7, `useBlocker` accepts a boolean or function. Confirm the `blocker.proceed()` / `blocker.reset()` API is still valid.

Run: `cd repos/admin && grep -r "useBlocker" src/` to check if it's already used anywhere.

- [ ] **Step 2: Implement the hook**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router'

export const useUnsavedChangesGuard = (isDirty: boolean) => {
  const [showDialog, setShowDialog] = useState(false)
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowDialog(true)
    }
  }, [blocker.state])

  // Browser navigation (tab close, refresh)
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const onConfirmLeave = useCallback(() => {
    setShowDialog(false)
    if (blocker.state === 'blocked') blocker.proceed?.()
  }, [blocker])

  const onCancelLeave = useCallback(() => {
    setShowDialog(false)
    if (blocker.state === 'blocked') blocker.reset?.()
  }, [blocker])

  return { showDialog, onConfirmLeave, onCancelLeave }
}
```

- [ ] **Step 3: Integrate into EndpointTab**

```typescript
const isDirty = name !== endpoint.name
  || type !== endpoint.type
  || method !== endpoint.method
  || path !== endpoint.path
  || isPublic !== endpoint.public

const { showDialog, onConfirmLeave, onCancelLeave } = useUnsavedChangesGuard(isDirty)
// Render MUI Dialog when showDialog is true
```

- [ ] **Step 4: Integrate into config tabs**

Add `useUnsavedChangesGuard` to `FaasConfigTab`, `AgentConfigTab`, and `ProxyConfigTab` with their respective dirty state checks.

- [ ] **Step 5: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: PASS


---

### Task 16: Final Integration Testing

- [ ] **Step 1: Run full admin type check**

Run: `cd repos/admin && pnpm types`
Expected: PASS

- [ ] **Step 2: Run admin unit tests**

Run: `cd repos/admin && pnpm test`
Expected: All existing tests pass.

- [ ] **Step 3: Manual verification checklist**

Start the admin dev server and verify:

1. Endpoints list page loads normally
2. Row click navigates to endpoint detail page (not drawer)
3. Create button opens drawer with all existing fields
4. Create submit creates endpoint and navigates to detail page
5. Endpoint tab shows editable form, Save works
6. Type change shows confirmation dialog, disables other tabs until save
7. Proxy config tab shows proxy fields, Save works
8. FaaS config tab shows endpoint config + function editor, single Save updates both
9. Agent config tab shows endpoint config + agent editor, single Save updates both
10. Test tab shows test panel, request/response works
11. Breadcrumbs "Endpoints" link navigates back to list
12. Switching tabs with dirty form shows unsaved changes dialog
13. Delete confirmation dialog works, navigates to list
14. Direct URL navigation (`/endpoints/:id/config`) loads correct tab


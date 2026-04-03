# Endpoint Detail Page Design

## Problem

Editing FaaS and Agent endpoints requires opening two browser tabs — one for the endpoint configuration and one for the linked function or agent. This creates a fragmented editing experience. The endpoint list page uses a drawer for all CRUD, which lacks the space and structure for complex multi-entity editing.

## Solution

Create an endpoint detail page with tabbed navigation, mirroring the existing Agent detail page pattern (`AgentLayout`). The page provides directly editable forms across three tabs, with the middle tab dynamically adapting based on endpoint type. For FaaS and Agent endpoints, the type-specific tab combines endpoint configuration with the full linked entity editor, eliminating the need for multiple browser tabs.

## Routing

New nested routes under the existing endpoints path:

```
/orgs/:orgId/projects/:projectId/endpoints              → ProjectEndpoints (list — unchanged)
/orgs/:orgId/projects/:projectId/endpoints/:endpointId   → EndpointLayout (wrapper)
  └─ index                                                → EndpointTab (metadata form)
  └─ /config                                              → EndpointConfigTab (Proxy/Function/Agent)
  └─ /test                                                → EndpointTestTab
```

`ERoutePath` enum updates:
- Reuse existing `ProjectEndpoint` entry for the detail page route (`/endpoints/:endpointId`)
- Add `ProjectEndpointConfig` — `/endpoints/:endpointId/config`
- Add `ProjectEndpointTest` — `/endpoints/:endpointId/test`

### Navigation Behavior

- **Edit flow**: Click row on endpoints list → navigates to `/endpoints/:endpointId` (Endpoint tab)
- **Create flow**: Click "Create Endpoint" → opens existing drawer (unchanged, all current fields) → on save, navigates to the new detail page. `EndpointDrawer.onSuccess` must be updated to accept the created endpoint (or its ID) so the parent `Endpoints` component can build the navigation URL.
- The drawer is **create-only**. Existing endpoints are always edited on the detail page.

### Endpoints Table Changes

- Row click navigates to the detail page instead of opening the drawer
- The per-row Edit action button navigates to the detail page (same as row click)
- The per-row Delete action button remains for quick delete from the list

## EndpointLayout Component

Wrapper component mirroring `AgentLayout`. Responsibilities:

- Reads `endpointId` from URL params
- Loads endpoint data from Jotai state via `activeEndpointState` derived atom (see State Management)
- Determines endpoint type for dynamic tab labeling
- Passes endpoint data to child routes via React Router's Outlet context

### Structure

```
EndpointLayout
  ├── EndpointBreadcrumbs (Endpoints / endpoint-name)
  ├── Header (name + type chip + method chip + visibility + Delete button)
  ├── MUI Tabs (URL-driven, derived from pathname)
  │   ├── "Endpoint" → index route
  │   ├── "Proxy" | "Function" | "Agent" → /config route (label based on type)
  │   └── "Test" → /test route
  └── <Outlet context={{ endpoint, orgId, projectId }} /> (renders active tab component)
```

No conditional tab hiding (unlike AgentLayout which hides tabs in thread/chat views).

## Tab 1: Endpoint Tab (Index Route)

Directly editable form for endpoint metadata. Reuses the individual input components from `EndpointFormBase` (name, type, method, path, public fields), but the type change confirmation logic lives in the `EndpointTab` wrapper — not inside `EndpointFormBase` — so the drawer's simpler behavior is preserved.

Fields:
- Endpoint Name (TextInput)
- Endpoint Type (SelectInput — **editable**, changing type is allowed)
- HTTP Method (SelectInput)
- Endpoint Path (TextInput)
- Public/Private (SwitchInput with info alert)
- Save button → `PUT /endpoints/:id`

Validation reuses `vep.shared()`.

### Type Change Safeguards

When the endpoint type is changed on an existing endpoint:

1. **Confirmation dialog** appears warning the user: "Changing from [current type] to [new type] will unlink the current configuration. Any unsaved changes on the configuration tab will also be discarded. Are you sure?"
2. If confirmed, the type updates in the form
3. **Config and Test tabs become disabled** until the endpoint is saved
4. After save, tabs re-enable with the new type's editor and label

## Tab 2: Config Tab (Type-Specific)

Dynamic tab — content and label change based on endpoint type. Each variant has two sections: "Endpoint Configuration" (the endpoint's type-specific settings) and the linked entity editor.

### No Linked Entity State

When a FaaS endpoint has no function selected, or an Agent endpoint has no agent selected, the entity editor section shows an empty state prompting the user to select one from the selector dropdown. The Save button only saves the endpoint config in this case — no entity API call is made. Once a function/agent is selected, the editor section populates with that entity's data.

### Proxy Config (tab label: "Proxy")

- Single section: all proxy configuration fields
- Reuses `EndpointProxy` component (which internally renders `ProxyInputs`, `EndpointHeaders`, `EndpointAuth`, `EndpointOAuth`, `EndpointBasicOptions`, `EndpointTransform`, `EndpointWhitelist`) and `useProxyFormState` hook
- Fields: URL, headers, auth/OAuth, retry config, transforms, domain whitelist
- Save → `PUT /endpoints/:id` (proxy config only)

### FaaS Config (tab label: "Function")

Two sections on one tab:

**Endpoint Configuration section:**
- Function selector, memory, timeout, secrets, env vars, arguments
- Reuses `FaasInputs` / `useFaasFormState`

**Function Editor section** (visible when a function is selected):
- Function name, language selector, description
- Monaco code editor (full function source)
- Input schema editor (name, type, description, required)
- Dependencies editor (package/version pairs)
- Components extracted from `FunctionDrawer`

Save → `PUT /endpoints/:id` + `PUT /functions/:id` (parallel API calls). If no function is selected, only the endpoint config is saved.

### Agent Config (tab label: "Agent")

Two sections on one tab:

**Endpoint Configuration section:**
- Agent selector, endpoint-specific overrides (max tokens, secrets, functions, env vars)
- Reuses `AgentInputs` / `useAgentFormState` — this component already handles agent selection and endpoint-level overrides

**Agent Configuration section** (visible when an agent is selected):
- Core agent fields not covered by `AgentInputs`: provider, model, streaming toggle, system prompt, tools
- These fields are extracted from `AgentDrawer` form components (`BasicInfoForm`, `ModelConfigForm`, etc.)
- Editing these fields modifies the Agent entity itself, not endpoint config

Save → `PUT /endpoints/:id` + `PUT /agents/:id` (parallel API calls). If no agent is selected, only the endpoint config is saved.

No threads, skills, or schedules — those remain exclusively on the Agent detail page.

## Tab 3: Test Tab

Existing `EndpointTestPanel` component, modified minimally to read endpoint data and projectId from Outlet context (via `useOutletContext()`) instead of receiving them as direct props. Functionality unchanged.

## Save Behavior

Each tab has its own Save button. Single click saves all entities on that tab.

| Tab | API Calls |
|-----|-----------|
| Endpoint | `PUT /endpoints/:id` |
| Proxy | `PUT /endpoints/:id` |
| Function | `PUT /endpoints/:id` + `PUT /functions/:id` (parallel) |
| Agent | `PUT /endpoints/:id` + `PUT /agents/:id` (parallel) |
| Test | N/A |

### Error Handling

- Both succeed → success feedback, refresh Jotai state
- One fails → show which part failed, keep form dirty for retry
- Saves are independent (not transactional) — if the function update succeeds but endpoint config fails, function changes are kept

### Unsaved Changes Guard

Navigating away from a tab with unsaved changes (switching tabs or leaving the page) triggers a confirmation dialog: "You have unsaved changes. Discard and continue?"

## State Management

- Existing Jotai atoms stay as-is: `endpointsState`, `projectEndpointsState`, `proxyFormState`, `faasFormState`, `agentFormState`
- **New**: `activeEndpointState` derived atom in `state/endpoints.ts` — resolves the active endpoint from `endpointsState` + `activeEndpointIdState`, mirroring the `activeAgentState` pattern
- `EndpointLayout` syncs `endpointId` URL param to `activeEndpointIdState` on mount
- Each tab initializes form state from endpoint data; resets on unmount
- Endpoint data is passed to child routes via React Router's Outlet context

## Components

### New

| Component | Purpose |
|-----------|---------|
| `EndpointLayout` | Wrapper: breadcrumbs, header, tabs, outlet (mirrors `AgentLayout`) |
| `EndpointBreadcrumbs` | Breadcrumb navigation (mirrors `AgentBreadcrumbs`) |
| `EndpointTab` | Directly editable endpoint metadata form (type change confirmation logic here) |
| `EndpointConfigTab` | Wrapper rendering type-specific config based on endpoint type |
| `FaasConfigTab` | FaaS endpoint config + full function editor |
| `AgentConfigTab` | Agent endpoint config + full agent editor |
| `ProxyConfigTab` | Proxy endpoint config (thin wrapper around existing components) |
| `EEndpointDetailTab` | Enum: `endpoint`, `config`, `test` |
| `activeEndpointState` | Derived Jotai atom resolving active endpoint by ID |

### Reused As-Is

| Component | Usage |
|-----------|-------|
| `AgentSection` | Card-based section layout for form groups |
| Validation utilities | `vep.shared`, `vep.proxy`, `vep.faas`, `vep.agent` |

### Reused with Adaptation

| Component | Adaptation |
|-----------|------------|
| `EndpointProxy` / `useProxyFormState` | Used inside `ProxyConfigTab` |
| `FaasInputs` / `useFaasFormState` | Used inside `FaasConfigTab` |
| `AgentInputs` / `useAgentFormState` | Used inside `AgentConfigTab` |
| Function editor components from `FunctionDrawer` | Extracted into `FaasConfigTab` |
| Agent form fields from `AgentDrawer` | Extracted into `AgentConfigTab` |

### Modified

| Component | Change |
|-----------|--------|
| `Endpoints.tsx` | Remove drawer-for-edit, keep drawer-for-create only |
| `EndpointsTable` | Row click and Edit button navigate to detail page; Delete button stays |
| `EndpointDrawer` | Create-only; `onSuccess` updated to accept created endpoint/ID for navigation |
| `EndpointTestPanel` | Read endpoint data from Outlet context instead of direct props |
| `Routes.tsx` | Add nested endpoint routes under `EndpointLayout` |
| `state/endpoints.ts` | Add `activeEndpointState` derived atom |

## Future Work (Out of Scope)

- Update the Agent detail page to be directly editable (same pattern as this endpoint page) instead of read-only with edit drawer

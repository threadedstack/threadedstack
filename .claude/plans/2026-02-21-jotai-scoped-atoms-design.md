# Jotai Scoped Atoms — Design Document

**Date**: 2026-02-21
**Status**: Approved
**Scope**: Admin SPA (`repos/admin`) + Integration tests (`repos/integration`)

## Problem

Jotai atoms for project-scoped entities store all data in flat `Record<id, T>` maps. When navigating between projects, data from previous projects bleeds into the current view. Components work around this with manual `.filter()` by `projectId` or `orgId`, but some forget or filter incorrectly.

**P0 bugs caused by this architecture:**
1. Endpoints page shows infinite spinner when switching projects (stale data guard skips fetch)
2. EndpointDrawer function-select MUI error (functions from wrong project)
3. ProjectAgents shows all org agents (filters by orgId instead of projectId)

## Solution

Migrate all project-related atoms from flat maps to **scope-keyed maps**: `Record<scopeKey, Record<id, T>>`. Add derived atoms that auto-extract data for the active scope. Components consume derived atoms and never filter manually.

## Atom Migration

### Keyed by `projectId`

| Atom | Before | After |
|------|--------|-------|
| `endpointsState` | `Record<id, Endpoint>` | `Record<projectId, Record<id, Endpoint>>` |
| `functionsState` | `Record<id, Function>` | `Record<projectId, Record<id, Function>>` |
| `secretsState` | `Record<id, Secret>` | `Record<projectId, Record<id, Secret>>` |

These entities always have a required `projectId` foreign key.

### Keyed by `projectId` or `'org'`

| Atom | Before | After |
|------|--------|-------|
| `agentsState` | `Record<id, Agent>` | `Record<contextKey, Record<id, Agent>>` |
| `domainsState` | `Record<id, Domain>` | `Record<contextKey, Record<id, Domain>>` |
| `threadsState` | `Record<id, Thread>` | `Record<contextKey, Record<id, Thread>>` |
| `assetsState` | `Record<id, Asset>` | `Record<contextKey, Record<id, Asset>>` |

These entities can exist at both org and project level. When fetched in org context, `contextKey = 'org'`. When fetched in project context, `contextKey = projectId`.

### Keyed by `threadId`

| Atom | Before | After |
|------|--------|-------|
| `messagesState` | `Record<id, Message>` | `Record<threadId, Record<id, Message>>` |

Messages are always fetched and displayed per-thread.

### Not migrated (already correct)

- `orgSecretsState` — separate atom, org-only
- `providersState` — org-only, no project variant
- `apiKeysState`, `projectsState`, `orgUsersState` — org-only
- `subscriptionState`, `paymentPlansState`, `orgQuotaState`, `orgLimitsState` — org-only
- Active ID atoms (`activeEndpointIdState`, etc.) — simple strings, no keying needed
- Form state atoms (`faasFormState`, etc.) — ephemeral, reset on drawer close

## Architecture Layers

### Layer 1: State Atoms

Each migrated atom gets a derived atom for the active scope:

```typescript
// State (keyed by projectId)
export const endpointsState = atomWithReset<Record<string, Record<string, Endpoint>>>(undefined)

// Derived (auto-filters to active project)
export const projectEndpointsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  const all = get(endpointsState)
  return projectId && all?.[projectId] ? all[projectId] : undefined
})
```

For dual-context atoms (agents, domains, threads, assets):

```typescript
export const agentsState = atomWithReset<Record<string, Record<string, Agent>>>(undefined)

export const orgAgentsState = atom((get) => get(agentsState)?.['org'])
export const projectAgentsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(agentsState)?.[projectId] : undefined
})
```

For messages:

```typescript
export const messagesState = atomWithReset<Record<string, Record<string, Message>>>(undefined)

export const threadMessagesState = atom((get) => {
  const threadId = get(activeThreadIdState)
  return threadId ? get(messagesState)?.[threadId] : undefined
})
```

### Layer 2: Accessors

Add scope-keyed get/set helpers alongside existing ones:

```typescript
// Project-keyed endpoints
export const getProjectEndpoints = (projectId: string) => getEndpoints()?.[projectId]
export const setProjectEndpoints = (projectId: string, eps: Record<string, Endpoint>) => {
  const all = getEndpoints() || {}
  setEndpoints({ ...all, [projectId]: eps })
}

// Context-keyed agents
export const getContextAgents = (key: string) => getAgents()?.[key]
export const setContextAgents = (key: string, agents: Record<string, Agent>) => {
  const all = getAgents() || {}
  setAgents({ ...all, [key]: agents })
}

// Thread-keyed messages
export const getThreadMessages = (threadId: string) => getMessages()?.[threadId]
export const setThreadMessages = (threadId: string, msgs: Record<string, Message>) => {
  const all = getMessages() || {}
  setMessages({ ...all, [threadId]: msgs })
}
```

### Layer 3: Selectors (React Hooks)

```typescript
// Project-scoped derived selectors
export const useProjectEndpoints = () => useDerivedState<Record<string, Endpoint>>(projectEndpointsState)
export const useProjectFunctions = () => useDerivedState<Record<string, FunctionModel>>(projectFunctionsState)
export const useProjectSecrets = () => useDerivedState<Record<string, Secret>>(projectSecretsState)
export const useProjectDomains = () => useDerivedState<Record<string, Domain>>(projectDomainsState)
export const useProjectAgents = () => useDerivedState<Record<string, Agent>>(projectAgentsState)
export const useProjectThreads = () => useDerivedState<Record<string, Thread>>(projectThreadsState)
export const useProjectAssets = () => useDerivedState<Record<string, Asset>>(projectAssetsState)

// Org-scoped derived selectors (for dual-context atoms)
export const useOrgAgents = () => useDerivedState<Record<string, Agent>>(orgAgentsState)
export const useOrgDomains = () => useDerivedState<Record<string, Domain>>(orgDomainsState)
export const useOrgThreads = () => useDerivedState<Record<string, Thread>>(orgThreadsState)
export const useOrgAssets = () => useDerivedState<Record<string, Asset>>(orgAssetsState)

// Thread-scoped messages
export const useThreadMessages = () => useDerivedState<Record<string, Message>>(threadMessagesState)
```

### Layer 4: Upsert/Fetch Actions

All upsert actions gain a scope key parameter:

```typescript
// Endpoints (projectId required)
export const upsertEndpoints = (projectId: string, endpoints: Endpoint[]) => {
  const current = getProjectEndpoints(projectId) || {}
  const mapped = endpoints.reduce((acc, ep) => { acc[ep.id] = ep; return acc }, {})
  setProjectEndpoints(projectId, { ...current, ...mapped })
}

// Agents (contextKey = projectId or 'org')
export const upsertAgents = (contextKey: string, agents: Agent[]) => {
  const current = getContextAgents(contextKey) || {}
  const mapped = agents.reduce((acc, a) => { acc[a.id] = a; return acc }, {})
  setContextAgents(contextKey, { ...current, ...mapped })
}

// Messages (threadId)
export const upsertMessages = (threadId: string, messages: Message[]) => {
  const current = getThreadMessages(threadId) || {}
  const mapped = messages.reduce((acc, m) => { acc[m.id] = m; return acc }, {})
  setThreadMessages(threadId, { ...current, ...mapped })
}
```

Fetch actions pass the scope key through:

```typescript
export const fetchEndpoints = async ({ orgId, projectId }) => {
  const resp = await endpointsApi.list(orgId, projectId)
  if (resp.data) upsertEndpoints(projectId, resp.data)
  return resp
}

export const fetchAgents = async ({ orgId, projectId }) => {
  const resp = await agentsApi.list(orgId, projectId)
  const contextKey = projectId || 'org'
  if (resp.data) upsertAgents(contextKey, resp.data)
  return resp
}
```

### Layer 5: Component Migration

Components switch from raw atoms + manual filtering to derived selectors:

```typescript
// Before (ProjectAgents.tsx)
const [agents] = useAgents()
const agentsList = useMemo(() => {
  return Object.values(agents || {}).filter(a => a.orgId === orgId)
}, [agents, orgId])

// After
const [agents] = useProjectAgents()
const agentsList = useMemo(() => {
  return Object.values(agents || {})
}, [agents])
```

### Layer 6: Org-Switch Cleanup

When org changes, all keyed atoms reset entirely (all project keys are stale):

```typescript
// unsetActiveProject.ts (called by setOrgActive)
export const unsetActiveProject = () => {
  resetProjects()
  resetActiveProjectId()
  // Reset all keyed atoms (clears all project + org keys)
  resetEndpoints()
  resetFunctions()
  resetAgents()
  resetSecrets()
  resetDomains()
  resetThreads()
  resetMessages()
  resetAssets()
}
```

## P0 Bug Fixes

### Bug 1: Endpoints spinner forever
- `useEndpoints.ts` switches to `useProjectEndpoints()`
- `projectEndpointsState` returns `undefined` for unvisited projects
- Remove `!exists(endpoints)` guard — always fetch when orgId/projectId present
- `useEndpointFilter.ts` removes `projectId` filter (data already scoped)

### Bug 2: Function-select MUI error
- `EndpointDrawer.tsx` switches to `useProjectFunctions()`
- Add `useEffect` to fetch functions when drawer opens
- `FaasInputs.tsx` guards select value: if `functionId` not in options, use `''`

### Bug 3: Project agents shows all org agents
- `ProjectAgents.tsx` switches to `useProjectAgents()`
- Remove `.filter(a => a.orgId === orgId)` — data already scoped
- `OrgAgents.tsx` switches to `useOrgAgents()` — same cleanup

## Files Changed

### New Files
- `repos/admin/src/actions/projects/local/resetProjectState.ts` (if needed for unsetActiveProject)

### State Layer
- `repos/admin/src/state/endpoints.ts` — type change + derived atom
- `repos/admin/src/state/functions.ts` — type change + derived atom
- `repos/admin/src/state/agents.ts` — type change + derived atoms (org + project)
- `repos/admin/src/state/secrets.ts` — type change + derived atom
- `repos/admin/src/state/domains.ts` — type change + derived atoms
- `repos/admin/src/state/threads.ts` — type change + derived atoms
- `repos/admin/src/state/messages.ts` — type change + derived atom (threadId)
- `repos/admin/src/state/assets.ts` — type change + derived atoms
- `repos/admin/src/state/accessors.ts` — scope-keyed get/set helpers
- `repos/admin/src/state/selectors.ts` — new derived selectors

### Action Layer
- `repos/admin/src/actions/endpoints/local/upsertEndpoints.ts` — add projectId param
- `repos/admin/src/actions/endpoints/api/fetchEndpoints.ts` — pass projectId
- `repos/admin/src/actions/agents/local/upsertAgents.ts` — add contextKey param
- `repos/admin/src/actions/agents/api/fetchAgents.ts` — pass contextKey
- `repos/admin/src/actions/functions/local/*.ts` — add projectId param
- `repos/admin/src/actions/functions/api/fetchFunctions.ts` — pass projectId
- `repos/admin/src/actions/secrets/local/setSecrets.ts` — add projectId param
- `repos/admin/src/actions/secrets/api/fetchSecrets.ts` — pass projectId
- `repos/admin/src/actions/domains/local/*.ts` — add contextKey param
- `repos/admin/src/actions/domains/api/fetchDomains.ts` — pass contextKey
- `repos/admin/src/actions/threads/local/*.ts` — add contextKey param
- `repos/admin/src/actions/threads/api/*.ts` — pass contextKey
- `repos/admin/src/actions/messages/local/*.ts` — add threadId param
- `repos/admin/src/actions/messages/api/*.ts` — pass threadId
- `repos/admin/src/actions/assets/local/*.ts` — add contextKey param
- `repos/admin/src/actions/assets/api/*.ts` — pass contextKey
- `repos/admin/src/actions/projects/local/unsetActiveProject.ts` — reset all keyed atoms

### Hook Layer
- `repos/admin/src/hooks/endpoints/useEndpoints.ts` — switch to useProjectEndpoints, remove guard
- `repos/admin/src/hooks/endpoints/useEndpointFilter.ts` — remove projectId filter
- `repos/admin/src/hooks/project/useProjectSecrets.ts` — switch to useProjectSecrets

### Component/Page Layer (remove manual filtering)
- `repos/admin/src/pages/Projects/ProjectAgents.tsx` — useProjectAgents
- `repos/admin/src/pages/Projects/ProjectSecrets.tsx` — useProjectSecrets
- `repos/admin/src/pages/Projects/ProjectDomains.tsx` — useProjectDomains
- `repos/admin/src/pages/Projects/ProjectThreads.tsx` — useProjectThreads
- `repos/admin/src/pages/Projects/Project.tsx` — all derived selectors, simplify counts
- `repos/admin/src/pages/Orgs/OrgAgents.tsx` — useOrgAgents
- `repos/admin/src/pages/Orgs/OrgDomains.tsx` — useOrgDomains
- `repos/admin/src/components/Endpoints/EndpointDrawer.tsx` — useProjectFunctions, fetch on open
- `repos/admin/src/components/Endpoints/Faas/FaasInputs.tsx` — guard select value
- `repos/admin/src/components/AI/ThreadsTab.tsx` — useProjectThreads or useOrgThreads
- `repos/admin/src/components/AI/MessagesTab.tsx` — useThreadMessages
- Any other components consuming these atoms (audit during implementation)

### Integration Tests
- `repos/integration/src/tier1/project-state-scoping.test.ts` — NEW: API validation that project endpoints/agents/functions return correct data per project
- `repos/integration/playwright/tier2/project-navigation.spec.ts` — NEW: Navigate between projects, verify no stale data in endpoint/agent lists

## Testing Strategy

### Unit Tests (vitest, in-repo)
- State atoms: derived atoms return correct data for active scope, return undefined for unvisited
- Accessors: scope-keyed get/set operate independently per key
- Upsert actions: merge within scope, don't affect other scopes
- Component hooks: useProjectEndpoints returns only active project data

### Integration Tests (repos/integration)

**Tier 1 — API contract + state scoping:**
1. Create resources in Project A (endpoint, function, agent assignment)
2. Create resources in Project B
3. Verify GET endpoints for Project A returns only Project A's resources
4. Verify GET endpoints for Project B returns only Project B's resources
5. Verify org-level agent list returns all agents

**Tier 2 — UI navigation (Playwright):**
1. Navigate to Project A endpoints page, verify correct list
2. Navigate to Project B endpoints page, verify no Project A data
3. Navigate back to Project A, verify data is still cached (no re-fetch spinner)
4. Open EndpointDrawer, verify function selector shows correct project's functions

## Migration Safety

- The `useEndpoints()`, `useFunctions()`, `useAgents()` raw selectors remain available for any code that needs the full keyed map
- Derived selectors are additive — no breaking changes to existing hooks
- TypeScript will catch all type mismatches when atom shapes change
- Integration tests validate end-to-end behavior post-migration

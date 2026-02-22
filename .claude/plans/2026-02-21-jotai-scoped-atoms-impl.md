# Jotai Scoped Atoms — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate 8 Jotai atoms from flat `Record<id, T>` to scope-keyed `Record<scopeKey, Record<id, T>>` with derived atoms, eliminating cross-project data bleed and fixing 3 P0 bugs.

**Architecture:** Each migrated atom stores data keyed by scope (projectId, contextKey, or threadId). Derived atoms auto-extract data for the active scope. Components consume derived atoms — no manual filtering. Actions pass scope keys when writing data. On org switch, all keyed atoms reset.

**Tech Stack:** Jotai (atomWithReset, atom), React 18, TypeScript, Vitest, Playwright

**Design Doc:** `docs/plans/2026-02-21-jotai-scoped-atoms-design.md`

**CRITICAL GIT RULE:** NEVER commit, push, or change git history. Read-only git only. User handles all commits.

---

## Overview

8 atoms migrate across 6 layers. The plan is organized bottom-up: state atoms first, then accessors, selectors, actions, components, and finally integration tests.

**Atoms migrated:**

| Atom | Scope Key | Derived Atoms |
|------|-----------|---------------|
| `endpointsState` | `projectId` | `projectEndpointsState` |
| `functionsState` | `projectId` | `projectFunctionsState` |
| `secretsState` | `projectId` | `projectSecretsState` |
| `agentsState` | `projectId \| 'org'` | `projectAgentsState`, `orgAgentsState` |
| `domainsState` | `projectId \| 'org'` | `projectDomainsState`, `orgDomainsState` |
| `threadsState` | `projectId \| 'org'` | `projectThreadsState`, `orgThreadsState` |
| `messagesState` | `threadId` | `threadMessagesState` |
| `assetsState` | `projectId \| 'org'` | `projectAssetsState`, `orgAssetsState` |

**Key concepts:**
- `projectId` — scope key for entities that always belong to a project
- `contextKey` — `projectId` or `'org'` for dual-scope entities
- `threadId` — scope key for messages

---

## Task 1: Migrate State Atoms

**Files:**
- Modify: `repos/admin/src/state/endpoints.ts`
- Modify: `repos/admin/src/state/functions.ts`
- Modify: `repos/admin/src/state/agents.ts`
- Modify: `repos/admin/src/state/secrets.ts`
- Modify: `repos/admin/src/state/domains.ts`
- Modify: `repos/admin/src/state/threads.ts`
- Modify: `repos/admin/src/state/messages.ts`
- Modify: `repos/admin/src/state/assets.ts`

**Step 1: Update `endpoints.ts`**

Change the atom type and add a derived atom:

```typescript
// repos/admin/src/state/endpoints.ts
import type { Endpoint } from '@tdsk/domain'
import type { TAgentFormState, TFaasFormState, TProxyFormState } from '@TAF/types'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { DefFaasState, DefProxyState, DefAgentState } from '@TAF/constants/endpoints'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId
export const endpointsState = atomWithReset<Record<string, Record<string, Endpoint>>>(undefined)
export const activeEndpointIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `endpoints` && part))
)

// Derived: auto-filters to active project
export const projectEndpointsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  const all = get(endpointsState)
  return projectId && all?.[projectId] ? all[projectId] : undefined
})

export const faasFormState = atomWithReset<TFaasFormState>(DefFaasState)
export const proxyFormState = atomWithReset<TProxyFormState>(DefProxyState)
export const agentFormState = atomWithReset<TAgentFormState>(DefAgentState)
```

**Step 2: Update `functions.ts`**

```typescript
// repos/admin/src/state/functions.ts
import type { Function as FunctionModel } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId
export const functionsState = atomWithReset<Record<string, Record<string, FunctionModel>>>(undefined)
export const activeFunctionIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `functions` && part))
)

// Derived: auto-filters to active project
export const projectFunctionsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  const all = get(functionsState)
  return projectId && all?.[projectId] ? all[projectId] : undefined
})
```

**Step 3: Update `agents.ts`**

```typescript
// repos/admin/src/state/agents.ts
import type { Agent } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const agentsState = atomWithReset<Record<string, Record<string, Agent>>>(undefined)
export const activeAgentIdState = atomWithReset<string>(
  getParamValue((part, before) =>
    Boolean(before === `agents` && part && part !== `chat` && part !== `threads`)
  )
)

// Derived: org-level agents
export const orgAgentsState = atom((get) => get(agentsState)?.['org'])

// Derived: project-level agents
export const projectAgentsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(agentsState)?.[projectId] : undefined
})

// Derived: active agent (searches all scopes)
export const activeAgentState = atom((get) => {
  const agentId = get(activeAgentIdState)
  if (!agentId) return undefined
  const all = get(agentsState)
  if (!all) return undefined
  for (const scope of Object.values(all)) {
    if (scope?.[agentId]) return scope[agentId]
  }
  return undefined
})
```

**Step 4: Update `secrets.ts`**

```typescript
// repos/admin/src/state/secrets.ts
import type { Secret } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId
export const secretsState = atomWithReset<Record<string, Record<string, Secret>>>(undefined)
export const activeSecretIdState = atomWithReset<string>(undefined)

// orgSecretsState stays flat — org-only, no project variant
export const orgSecretsState = atomWithReset<Record<string, Secret>>(undefined)
export const activeOrgSecretIdState = atomWithReset<string>(undefined)

// Derived: auto-filters to active project
export const projectSecretsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  const all = get(secretsState)
  return projectId && all?.[projectId] ? all[projectId] : undefined
})
```

**Step 5: Update `domains.ts`**

```typescript
// repos/admin/src/state/domains.ts
import type { Domain } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const domainsState = atomWithReset<Record<string, Record<string, Domain>>>(undefined)
export const activeDomainIdState = atomWithReset<string>(undefined)

// Derived: org-level domains
export const orgDomainsState = atom((get) => get(domainsState)?.['org'])

// Derived: project-level domains
export const projectDomainsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(domainsState)?.[projectId] : undefined
})
```

**Step 6: Update `threads.ts`**

```typescript
// repos/admin/src/state/threads.ts
import type { Thread } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const threadsState = atomWithReset<Record<string, Record<string, Thread>>>(undefined)
export const activeThreadIdState = atomWithReset<string>(undefined)

// Derived: org-level threads
export const orgThreadsState = atom((get) => get(threadsState)?.['org'])

// Derived: project-level threads
export const projectThreadsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(threadsState)?.[projectId] : undefined
})
```

**Step 7: Update `messages.ts`**

```typescript
// repos/admin/src/state/messages.ts
import type { Message } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeThreadIdState } from '@TAF/state/threads'

// Keyed by threadId
export const messagesState = atomWithReset<Record<string, Record<string, Message>>>(undefined)
export const activeMessageIdState = atomWithReset<string>(undefined)

// Derived: auto-filters to active thread
export const threadMessagesState = atom((get) => {
  const threadId = get(activeThreadIdState)
  return threadId ? get(messagesState)?.[threadId] : undefined
})
```

**Step 8: Update `assets.ts`**

```typescript
// repos/admin/src/state/assets.ts
import type { Asset } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const assetsState = atomWithReset<Record<string, Record<string, Asset>>>(undefined)
export const activeAssetIdState = atomWithReset<string>(undefined)

// Derived: org-level assets
export const orgAssetsState = atom((get) => get(assetsState)?.['org'])

// Derived: project-level assets
export const projectAssetsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(assetsState)?.[projectId] : undefined
})
```

---

## Task 2: Update Accessors

**Files:**
- Modify: `repos/admin/src/state/accessors.ts`

**Step 1: Update type signatures for existing get/set/reset**

The existing `getEndpoints`, `setEndpoints`, `resetEndpoints` (and equivalent for all 8 atoms) now operate on the nested type `Record<string, Record<string, T>>`. TypeScript will enforce this automatically since they call `store.get()`/`store.set()` on the updated atoms. No code changes needed for existing accessors — types flow from the atoms.

**Step 2: Add scope-keyed helpers**

Add these new accessors after the existing ones in `accessors.ts`:

```typescript
// --- Scope-keyed accessors ---

// Project-keyed: endpoints, functions, secrets
export const getProjectEndpoints = (projectId: string) => getEndpoints()?.[projectId]
export const setProjectEndpoints = (projectId: string, eps: Record<string, Endpoint>) => {
  const all = getEndpoints() || {}
  setEndpoints({ ...all, [projectId]: eps })
}

export const getProjectFunctions = (projectId: string) => getFunctions()?.[projectId]
export const setProjectFunctions = (projectId: string, fns: Record<string, FunctionModel>) => {
  const all = getFunctions() || {}
  setFunctions({ ...all, [projectId]: fns })
}

export const getProjectSecrets = (projectId: string) => getSecrets()?.[projectId]
export const setProjectSecrets = (projectId: string, secs: Record<string, Secret>) => {
  const all = getSecrets() || {}
  setSecrets({ ...all, [projectId]: secs })
}

// Context-keyed: agents, domains, threads, assets
export const getContextAgents = (key: string) => getAgents()?.[key]
export const setContextAgents = (key: string, agents: Record<string, Agent>) => {
  const all = getAgents() || {}
  setAgents({ ...all, [key]: agents })
}

export const getContextDomains = (key: string) => getDomains()?.[key]
export const setContextDomains = (key: string, domains: Record<string, Domain>) => {
  const all = getDomains() || {}
  setDomains({ ...all, [key]: domains })
}

export const getContextThreads = (key: string) => getThreads()?.[key]
export const setContextThreads = (key: string, threads: Record<string, Thread>) => {
  const all = getThreads() || {}
  setThreads({ ...all, [key]: threads })
}

export const getContextAssets = (key: string) => getAssets()?.[key]
export const setContextAssets = (key: string, assets: Record<string, Asset>) => {
  const all = getAssets() || {}
  setAssets({ ...all, [key]: assets })
}

// Thread-keyed: messages
export const getThreadMessages = (threadId: string) => getMessages()?.[threadId]
export const setThreadMessages = (threadId: string, msgs: Record<string, Message>) => {
  const all = getMessages() || {}
  setMessages({ ...all, [threadId]: msgs })
}
```

Add the necessary type imports at the top of `accessors.ts`:

```typescript
import type { Domain, Thread, Message } from '@tdsk/domain'
```

(These types are already imported: `Asset`, `Agent`, `Secret`, `Endpoint`, `Function as FunctionModel`)

---

## Task 3: Update Selectors

**Files:**
- Modify: `repos/admin/src/state/selectors.ts`

**Step 1: Import new derived atoms**

Add imports for all new derived atoms:

```typescript
import {
  projectEndpointsState,
  // existing imports...
} from '@TAF/state/endpoints'
import { projectFunctionsState } from '@TAF/state/functions'
import {
  agentsState,
  activeAgentIdState,
  activeAgentState,
  orgAgentsState,
  projectAgentsState,
} from '@TAF/state/agents'
import { projectSecretsState } from '@TAF/state/secrets'
import { orgDomainsState, projectDomainsState } from '@TAF/state/domains'
import { orgThreadsState, projectThreadsState } from '@TAF/state/threads'
import { threadMessagesState } from '@TAF/state/messages'
import { orgAssetsState, projectAssetsState } from '@TAF/state/assets'
```

**Step 2: Add derived selector hooks**

Add after the existing selectors:

```typescript
// Project-scoped derived selectors
export const useProjectEndpoints = () => useDerivedState<Record<string, Endpoint>>(projectEndpointsState)
export const useProjectFunctions = () => useDerivedState<Record<string, FunctionModel>>(projectFunctionsState)
export const useProjectSecrets = () => useDerivedState<Record<string, Secret>>(projectSecretsState)
export const useProjectAgents = () => useDerivedState<Record<string, Agent>>(projectAgentsState)
export const useProjectDomains = () => useDerivedState<Record<string, Domain>>(projectDomainsState)
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

Add type imports at the top:

```typescript
import type { Agent, Organization, Project, Endpoint, Secret, Domain, Thread, Message, Asset, Function as FunctionModel } from '@tdsk/domain'
```

**Note:** The existing `useEndpoints()`, `useFunctions()`, etc. remain — they expose the full keyed map for any code that needs it. New code should use the project-scoped variants.

---

## Task 4: Migrate Endpoint Actions

**Files:**
- Modify: `repos/admin/src/actions/endpoints/local/upsertEndpoints.ts`
- Modify: `repos/admin/src/actions/endpoints/local/upsertEndpoint.ts`
- Modify: `repos/admin/src/actions/endpoints/local/removeEndpoint.ts`
- Modify: `repos/admin/src/actions/endpoints/api/fetchEndpoints.ts`
- Modify: `repos/admin/src/actions/endpoints/api/fetchEndpoint.ts`
- Modify: `repos/admin/src/actions/endpoints/api/createEndpoint.ts`
- Modify: `repos/admin/src/actions/endpoints/api/updateEndpoint.ts`
- Modify: `repos/admin/src/actions/endpoints/api/deleteEndpoint.ts`

**Step 1: Update `upsertEndpoints.ts`**

```typescript
import type { Endpoint } from '@tdsk/domain'
import { getProjectEndpoints, setProjectEndpoints } from '@TAF/state/accessors'

export const upsertEndpoints = (projectId: string, endpoints: Endpoint[]) => {
  const current = getProjectEndpoints(projectId) || {}
  const endpointsMap = endpoints?.reduce(
    (acc, endpoint: Endpoint) => {
      acc[endpoint.id] = endpoint
      return acc
    },
    {} as Record<string, Endpoint>
  ) || {}

  setProjectEndpoints(projectId, { ...current, ...endpointsMap })
}
```

**Step 2: Update `upsertEndpoint.ts`**

```typescript
import type { Endpoint } from '@tdsk/domain'
import { getProjectEndpoints, setProjectEndpoints } from '@TAF/state/accessors'

export const upsertEndpoint = (projectId: string, endpoint: Endpoint) => {
  const current = getProjectEndpoints(projectId) || {}
  setProjectEndpoints(projectId, { ...current, [endpoint.id]: endpoint })
}
```

**Step 3: Update `removeEndpoint.ts`**

```typescript
import { getProjectEndpoints, setProjectEndpoints } from '@TAF/state/accessors'

export const removeEndpoint = (projectId: string, id: string) => {
  const current = getProjectEndpoints(projectId) || {}
  const { [id]: removed, ...eps } = current
  setProjectEndpoints(projectId, eps)
}
```

**Step 4: Update `fetchEndpoints.ts`**

```typescript
import type { Endpoint } from '@tdsk/domain'
import { endpointsApi } from '@TAF/services'
import { upsertEndpoints } from '@TAF/actions/endpoints/local/upsertEndpoints'

export type TFetchEndpointsOpts = {
  orgId: string
  projectId: string
}

export type TFetchEndpointsResult = {
  endpoints?: Record<string, Endpoint>
  error?: Error
}

export const fetchEndpoints = async (opts: TFetchEndpointsOpts) => {
  const { orgId, projectId } = opts
  const resp = await endpointsApi.list(orgId, projectId)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoints(projectId, resp.data)

  return resp
}
```

**Step 5: Update `fetchEndpoint.ts`**

```typescript
import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TFetchEndpointOpts = {
  orgId: string
  projectId: string
  id: string
}

export const fetchEndpoint = async (opts: TFetchEndpointOpts) => {
  const { orgId, projectId, id } = opts
  const resp = await endpointsApi.get(orgId, projectId, id)
  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(projectId, resp.data)

  return resp
}
```

**Step 6: Update `createEndpoint.ts`**

```typescript
import type { Endpoint } from '@tdsk/domain'
import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TCreateEndpointOpts = {
  orgId: string
  projectId: string
  data: Partial<Endpoint>
}

export type TCreateEndpointResult = {
  data?: Endpoint
  error?: Error
}

export const createEndpoint = async (opts: TCreateEndpointOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await endpointsApi.create(orgId, projectId, data)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(projectId, resp.data)

  return resp
}
```

**Step 7: Update `updateEndpoint.ts`**

```typescript
import type { Endpoint } from '@tdsk/domain'
import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TUpdateEndpointOpts = {
  orgId: string
  projectId: string
  id: string
  data: Partial<Endpoint>
}

export const updateEndpoint = async (opts: TUpdateEndpointOpts) => {
  const { orgId, projectId, id, data } = opts
  const resp = await endpointsApi.update(orgId, projectId, id, data)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(projectId, resp.data)

  return resp
}
```

**Step 8: Update `deleteEndpoint.ts`**

```typescript
import { endpointsApi } from '@TAF/services'
import { removeEndpoint } from '@TAF/actions/endpoints/local/removeEndpoint'

export type TDeleteEndpointOpts = {
  orgId: string
  projectId: string
  id: string
}

export const deleteEndpoint = async (opts: TDeleteEndpointOpts) => {
  const { orgId, projectId, id } = opts
  const resp = await endpointsApi.delete(orgId, projectId, id)
  if (resp.error) return { error: resp.error }
  removeEndpoint(projectId, id)

  return resp
}
```

---

## Task 5: Migrate Functions Actions

**Files:**
- Modify: `repos/admin/src/actions/functions/fetchFunctions.ts`
- Modify: `repos/admin/src/actions/functions/fetchFunction.ts`
- Modify: `repos/admin/src/actions/functions/createFunction.ts`
- Modify: `repos/admin/src/actions/functions/updateFunction.ts`
- Modify: `repos/admin/src/actions/functions/deleteFunction.ts`

Functions actions use `setFunctions`/`getFunctions` directly (no local action layer). Migrate to use `getProjectFunctions`/`setProjectFunctions`.

**Step 1: Update `fetchFunctions.ts`**

```typescript
import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TFetchFunctionsOpts = {
  orgId: string
  projectId: string
}

export type TFetchFunctionsResult = {
  functions?: Record<string, FunctionModel>
  error?: Error
}

export const fetchFunctions = async (
  opts: TFetchFunctionsOpts
): Promise<TFetchFunctionsResult> => {
  const { orgId, projectId } = opts
  const resp = await functionsApi.list(orgId, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  const functionsMap =
    resp.data?.reduce((acc: Record<string, FunctionModel>, func: FunctionModel) => {
      acc[func.id] = func
      return acc
    }, {}) || {}

  const current = getProjectFunctions(projectId) || {}
  setProjectFunctions(projectId, { ...current, ...functionsMap })
  return { functions: functionsMap }
}
```

**Step 2: Update `fetchFunction.ts`**

```typescript
import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TFetchFunctionOpts = {
  orgId: string
  projectId: string
  id: string
}

export type TFetchFunctionResult = {
  function?: FunctionModel
  error?: Error
}

export const fetchFunction = async (
  opts: TFetchFunctionOpts
): Promise<TFetchFunctionResult> => {
  const { orgId, projectId, id } = opts
  const resp = await functionsApi.get(orgId, projectId, id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    const current = getProjectFunctions(projectId) || {}
    setProjectFunctions(projectId, { ...current, [resp.data.id]: resp.data })
  }

  return { function: resp.data }
}
```

**Step 3: Update `createFunction.ts`**

```typescript
import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TCreateFunctionOpts = {
  orgId: string
  projectId: string
  data: Partial<FunctionModel>
}

export const createFunction = async (opts: TCreateFunctionOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await functionsApi.create(orgId, projectId, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const current = getProjectFunctions(projectId) || {}
    setProjectFunctions(projectId, { ...current, [resp.data.id]: resp.data })
  }

  return resp
}
```

**Step 4: Update `updateFunction.ts`**

```typescript
import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TUpdateFunctionOpts = {
  orgId: string
  projectId: string
  id: string
  data: Partial<FunctionModel>
}

export const updateFunction = async (opts: TUpdateFunctionOpts) => {
  const { orgId, projectId, id, data } = opts
  const resp = await functionsApi.update(orgId, projectId, id, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const current = getProjectFunctions(projectId) || {}
    setProjectFunctions(projectId, { ...current, [resp.data.id]: resp.data })
  }

  return resp
}
```

**Step 5: Update `deleteFunction.ts`**

```typescript
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TDeleteFunctionOpts = {
  orgId: string
  projectId: string
  id: string
}

export type TDeleteFunctionResult = {
  success?: boolean
  error?: Error
}

export const deleteFunction = async (
  opts: TDeleteFunctionOpts
): Promise<TDeleteFunctionResult> => {
  const { orgId, projectId, id } = opts
  const resp = await functionsApi.delete(orgId, projectId, id)

  if (resp.error) return { error: resp.error }

  const current = getProjectFunctions(projectId) || {}
  const { [id]: removed, ...remaining } = current
  setProjectFunctions(projectId, remaining)

  return { success: true }
}
```

---

## Task 6: Migrate Agents Actions

**Files:**
- Modify: `repos/admin/src/actions/agents/local/upsertAgents.ts`
- Modify: `repos/admin/src/actions/agents/local/upsertAgent.ts`
- Modify: `repos/admin/src/actions/agents/local/removeAgent.ts`
- Modify: `repos/admin/src/actions/agents/api/fetchAgents.ts`
- Modify: `repos/admin/src/actions/agents/api/fetchAgent.ts`
- Modify: `repos/admin/src/actions/agents/api/createAgent.ts`
- Modify: `repos/admin/src/actions/agents/api/updateAgent.ts`
- Modify: `repos/admin/src/actions/agents/api/deleteAgent.ts`

**Step 1: Update `upsertAgents.ts`**

```typescript
import type { Agent } from '@tdsk/domain'
import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const upsertAgents = (contextKey: string, agents: Agent[]) => {
  const current = getContextAgents(contextKey) || {}
  const agentsMap = agents.reduce(
    (acc, agent) => {
      acc[agent.id] = agent
      return acc
    },
    {} as Record<string, Agent>
  )

  setContextAgents(contextKey, { ...current, ...agentsMap })
}
```

**Step 2: Update `upsertAgent.ts`**

```typescript
import type { Agent } from '@tdsk/domain'
import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const upsertAgent = (contextKey: string, agent: Agent) => {
  const current = getContextAgents(contextKey) || {}
  setContextAgents(contextKey, { ...current, [agent.id]: agent })
}
```

**Step 3: Update `removeAgent.ts`**

```typescript
import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const removeAgent = (contextKey: string, id: string) => {
  const current = getContextAgents(contextKey) || {}
  const { [id]: _, ...rest } = current
  setContextAgents(contextKey, rest)
}
```

**Step 4: Update `fetchAgents.ts`**

```typescript
import { agentsApi } from '@TAF/services'
import { upsertAgents } from '@TAF/actions/agents/local/upsertAgents'

export type TFetchAgentsOpts = {
  orgId: string
  projectId?: string
}

export const fetchAgents = async (opts: TFetchAgentsOpts) => {
  const { orgId, projectId } = opts
  const resp = await agentsApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  upsertAgents(contextKey, resp.data)

  return resp
}
```

**Step 5: Update `fetchAgent.ts`**

```typescript
import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TFetchAgentOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const fetchAgent = async (opts: TFetchAgentOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await agentsApi.get(orgId, id, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertAgent(contextKey, resp.data)

  return resp
}
```

**Step 6: Update `createAgent.ts`**

```typescript
import type { Agent } from '@tdsk/domain'
import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TCreateAgentOpts = {
  orgId: string
  data: Partial<Agent>
  projectId?: string
}

export const createAgent = async (opts: TCreateAgentOpts) => {
  const { orgId, data, projectId } = opts
  const resp = await agentsApi.create(orgId, data, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertAgent(contextKey, resp.data)

  return resp
}
```

**Step 7: Update `updateAgent.ts`**

```typescript
import type { Agent } from '@tdsk/domain'
import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TUpdateAgentOpts = {
  orgId: string
  id: string
  data: Partial<Agent>
  projectId?: string
}

export const updateAgent = async (opts: TUpdateAgentOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await agentsApi.update(orgId, id, data, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertAgent(contextKey, resp.data)

  return resp
}
```

**Step 8: Update `deleteAgent.ts`**

```typescript
import { agentsApi } from '@TAF/services'
import { removeAgent } from '@TAF/actions/agents/local/removeAgent'

export type TDeleteAgentOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteAgent = async (opts: TDeleteAgentOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await agentsApi.delete(orgId, id, projectId)

  if (resp.error) return { error: resp.error }
  const contextKey = projectId || 'org'
  removeAgent(contextKey, id)

  return resp
}
```

---

## Task 7: Migrate Secrets Actions

**Files:**
- Modify: `repos/admin/src/actions/secrets/local/setSecrets.ts`
- Modify: `repos/admin/src/actions/secrets/local/upsertSecret.ts`
- Modify: `repos/admin/src/actions/secrets/local/removeSecret.ts`
- Modify: `repos/admin/src/actions/secrets/api/fetchSecrets.ts`
- Modify: `repos/admin/src/actions/secrets/api/fetchSecret.ts`
- Modify: `repos/admin/src/actions/secrets/api/createSecret.ts`
- Modify: `repos/admin/src/actions/secrets/api/updateSecret.ts`
- Modify: `repos/admin/src/actions/secrets/api/deleteSecret.ts`

**Note:** `orgSecretsState` stays flat (org-only). Only `secretsState` (project secrets) migrates.

**Step 1: Update `setSecrets.ts`**

```typescript
import type { Secret } from '@tdsk/domain'
import { setProjectSecrets } from '@TAF/state/accessors'
import { setOrgSecrets as setOrgSecs } from '@TAF/state/accessors'

export const setSecrets = (projectId: string, secrets: Secret[]) => {
  const mapped = secrets.reduce(
    (acc, secret) => {
      acc[secret.id] = secret
      return acc
    },
    {} as Record<string, Secret>
  )
  setProjectSecrets(projectId, mapped)
}

export const setOrgSecrets = (secrets: Secret[]) => {
  const mapped = secrets.reduce(
    (acc, secret) => {
      acc[secret.id] = secret
      return acc
    },
    {} as Record<string, Secret>
  )
  setOrgSecs(mapped)
}
```

**Step 2: Update `upsertSecret.ts`**

```typescript
import type { Secret } from '@tdsk/domain'
import {
  getProjectSecrets,
  setProjectSecrets,
  getOrgSecrets,
  setOrgSecrets,
} from '@TAF/state/accessors'

export const upsertSecret = (projectId: string, secret: Secret) => {
  const current = getProjectSecrets(projectId) || {}
  setProjectSecrets(projectId, { ...current, [secret.id]: secret })
}

export const upsertOrgSecret = (secret: Secret) => {
  setOrgSecrets({
    ...getOrgSecrets(),
    [secret.id]: secret,
  })
}
```

**Step 3: Update `removeSecret.ts`**

```typescript
import {
  getProjectSecrets,
  setProjectSecrets,
  getOrgSecrets,
  setOrgSecrets,
} from '@TAF/state/accessors'

export const removeSecret = (projectId: string, id: string) => {
  const current = getProjectSecrets(projectId) || {}
  const { [id]: removed, ...secrets } = current
  setProjectSecrets(projectId, secrets)
}

export const removeOrgSecret = (id: string) => {
  const current = getOrgSecrets() || {}
  const { [id]: removed, ...secrets } = current
  setOrgSecrets(secrets)
}
```

**Step 4: Update `fetchSecrets.ts`**

```typescript
import { secretsApi } from '@TAF/services'
import { setSecrets, setOrgSecrets } from '@TAF/actions/secrets/local/setSecrets'

export type TFetchSecretsOpts = {
  orgId: string
  projectId?: string
}

export const fetchSecrets = async (opts: TFetchSecretsOpts) => {
  const { orgId, projectId } = opts
  const resp = await secretsApi.list(orgId, projectId)
  if (resp.data) projectId ? setSecrets(projectId, resp.data) : setOrgSecrets(resp.data)

  return resp
}
```

**Step 5: Update `fetchSecret.ts`**

```typescript
import { secretsApi } from '@TAF/services'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TFetchSecretOpts = {
  id: string
  orgId: string
  projectId?: string
}

export const fetchSecret = async (opts: TFetchSecretOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await secretsApi.get(orgId, id, projectId)
  if (resp.data) projectId ? upsertSecret(projectId, resp.data) : upsertOrgSecret(resp.data)

  return resp
}
```

**Step 6: Update `createSecret.ts`**

```typescript
import { secretsApi } from '@TAF/services'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TCreateSecretOpts = {
  orgId: string
  name: string
  value: string
  projectId?: string
  providerId?: string
  description?: string
}

export const createSecret = async (opts: TCreateSecretOpts) => {
  const { orgId, projectId, ...data } = opts
  const resp = await secretsApi.create(orgId, data, projectId)
  if (resp.data) projectId ? upsertSecret(projectId, resp.data) : upsertOrgSecret(resp.data)

  return resp
}
```

**Step 7: Update `updateSecret.ts`**

```typescript
import type { Secret } from '@tdsk/domain'
import { secretsApi } from '@TAF/services'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TUpdateSecretOpts = {
  orgId: string
  id: string
  data: Partial<Secret>
  projectId?: string
}

export const updateSecret = async (opts: TUpdateSecretOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await secretsApi.update(orgId, id, data, projectId)
  if (resp.data) projectId ? upsertSecret(projectId, resp.data) : upsertOrgSecret(resp.data)

  return resp
}
```

**Step 8: Update `deleteSecret.ts`**

```typescript
import { secretsApi } from '@TAF/services'
import { removeSecret, removeOrgSecret } from '@TAF/actions/secrets/local/removeSecret'

export type TDeleteSecretOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteSecret = async (opts: TDeleteSecretOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await secretsApi.delete(orgId, id, projectId)
  if (resp.error) return { error: resp.error }

  projectId ? removeSecret(projectId, id) : removeOrgSecret(id)
  return { success: true }
}
```

---

## Task 8: Migrate Domains Actions

**Files:**
- Modify: `repos/admin/src/actions/domains/local/upsertDomains.ts`
- Modify: `repos/admin/src/actions/domains/local/upsertDomain.ts`
- Modify: `repos/admin/src/actions/domains/local/removeDomain.ts`
- Modify: `repos/admin/src/actions/domains/api/fetchDomains.ts`
- Modify: `repos/admin/src/actions/domains/api/fetchDomain.ts`
- Modify: `repos/admin/src/actions/domains/api/createDomain.ts`
- Modify: `repos/admin/src/actions/domains/api/updateDomain.ts`
- Modify: `repos/admin/src/actions/domains/api/deleteDomain.ts`

**Step 1: Update `upsertDomains.ts`**

```typescript
import type { Domain } from '@tdsk/domain'
import { getContextDomains, setContextDomains } from '@TAF/state/accessors'

export const upsertDomains = (contextKey: string, domains: Record<string, Domain>) =>
  setContextDomains(contextKey, {
    ...getContextDomains(contextKey),
    ...domains,
  })
```

**Step 2: Update `upsertDomain.ts`**

```typescript
import type { Domain } from '@tdsk/domain'
import { getContextDomains, setContextDomains } from '@TAF/state/accessors'

export const upsertDomain = (contextKey: string, domain: Domain) =>
  setContextDomains(contextKey, {
    ...getContextDomains(contextKey),
    [domain.id]: domain,
  })
```

**Step 3: Update `removeDomain.ts`**

```typescript
import { getContextDomains, setContextDomains } from '@TAF/state/accessors'

export const removeDomain = (contextKey: string, id: string) => {
  const { [id]: removed, ...remaining } = getContextDomains(contextKey) || {}
  setContextDomains(contextKey, remaining)
}
```

**Step 4: Update `fetchDomains.ts`**

```typescript
import type { Domain } from '@tdsk/domain'
import { domainsApi } from '@TAF/services'
import { upsertDomains } from '@TAF/actions/domains/local/upsertDomains'

export type TFetchDomainsOpts = {
  orgId: string
  projectId?: string
}

export const fetchDomains = async (opts: TFetchDomainsOpts) => {
  const { orgId, projectId } = opts
  const resp = await domainsApi.list(orgId, projectId)

  if (resp.error) return resp

  const domainsMap =
    resp.data?.reduce((acc: Record<string, Domain>, domain: Domain) => {
      acc[domain.id] = domain
      return acc
    }, {}) || {}

  const contextKey = projectId || 'org'
  upsertDomains(contextKey, domainsMap)

  return { ...resp, data: domainsMap }
}
```

**Step 5: Update `fetchDomain.ts`**

```typescript
import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TFetchDomainOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const fetchDomain = async (opts: TFetchDomainOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await domainsApi.get(orgId, id, projectId)
  const contextKey = projectId || 'org'
  resp.data && upsertDomain(contextKey, resp.data)

  return resp
}
```

**Step 6: Update `createDomain.ts`**

```typescript
import type { Domain } from '@tdsk/domain'
import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TCreateDomainOpts = {
  orgId: string
  data: Partial<Domain>
  projectId?: string
}

export const createDomain = async (opts: TCreateDomainOpts) => {
  const { orgId, data, projectId } = opts
  const resp = await domainsApi.create(orgId, data, projectId)

  if (resp.error) return resp
  const contextKey = projectId || 'org'
  resp.data && upsertDomain(contextKey, resp.data)

  return resp
}
```

**Step 7: Update `updateDomain.ts`**

```typescript
import type { Domain } from '@tdsk/domain'
import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TUpdateDomainOpts = {
  orgId: string
  id: string
  data: Partial<Domain>
  projectId?: string
}

export const updateDomain = async (opts: TUpdateDomainOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await domainsApi.update(orgId, id, data, projectId)

  if (resp.error) return resp
  const contextKey = projectId || 'org'
  resp.data && upsertDomain(contextKey, resp.data)

  return resp
}
```

**Step 8: Update `deleteDomain.ts`**

```typescript
import { domainsApi } from '@TAF/services'
import { removeDomain } from '@TAF/actions/domains/local/removeDomain'

export type TDeleteDomainOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteDomain = async (opts: TDeleteDomainOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await domainsApi.delete(orgId, id, projectId)

  if (resp.error) return resp
  const contextKey = projectId || 'org'
  removeDomain(contextKey, id)

  return resp
}
```

---

## Task 9: Migrate Threads Actions

**Files:**
- Modify: `repos/admin/src/actions/threads/local/upsertThreads.ts`
- Modify: `repos/admin/src/actions/threads/local/upsertThread.ts`
- Modify: `repos/admin/src/actions/threads/local/removeThread.ts`
- Modify: `repos/admin/src/actions/threads/api/fetchThreads.ts`
- Modify: `repos/admin/src/actions/threads/api/createThread.ts`
- Modify: `repos/admin/src/actions/threads/api/updateThread.ts`
- Modify: `repos/admin/src/actions/threads/api/deleteThread.ts`
- Modify: `repos/admin/src/actions/threads/api/branchThread.ts`

Threads are dual-context (can belong to org or project). The contextKey comes from the caller.

**Step 1: Update `upsertThreads.ts`**

```typescript
import type { Thread } from '@tdsk/domain'
import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const upsertThreads = (contextKey: string, threads: Thread[]) => {
  const current = getContextThreads(contextKey) || {}
  const threadsMap = threads.reduce(
    (acc, thread) => {
      acc[thread.id] = thread
      return acc
    },
    {} as Record<string, Thread>
  )

  setContextThreads(contextKey, { ...current, ...threadsMap })
}
```

**Step 2: Update `upsertThread.ts`**

```typescript
import type { Thread } from '@tdsk/domain'
import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const upsertThread = (contextKey: string, thread: Thread) => {
  const current = getContextThreads(contextKey) || {}
  setContextThreads(contextKey, { ...current, [thread.id]: thread })
}
```

**Step 3: Update `removeThread.ts`**

```typescript
import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const removeThread = (contextKey: string, id: string) => {
  const current = getContextThreads(contextKey) || {}
  const { [id]: _, ...rest } = current
  setContextThreads(contextKey, rest)
}
```

**Step 4: Update `fetchThreads.ts`**

```typescript
import { threadsApi } from '@TAF/services'
import { upsertThreads } from '@TAF/actions/threads/local/upsertThreads'

export type TFetchThreadsOpts = {
  orgId: string
  agentId: string
  contextKey?: string
}

export const fetchThreads = async (opts: TFetchThreadsOpts) => {
  const { orgId, agentId, contextKey = 'org' } = opts
  const resp = await threadsApi.list(orgId, agentId)
  if (resp.error) return { error: resp.error }
  upsertThreads(contextKey, resp.data)

  return resp
}
```

**Step 5: Update `createThread.ts`**

```typescript
import type { Thread } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'

export const createThread = async (
  orgId: string,
  agentId: string,
  data: Partial<Thread>,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.create(orgId, agentId, data)
  if (resp.error) return { error: resp.error }

  resp.data && upsertThread(contextKey, resp.data)

  return resp
}
```

**Step 6: Update `updateThread.ts`**

```typescript
import type { Thread } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'

export const updateThread = async (
  orgId: string,
  agentId: string,
  id: string,
  data: Partial<Thread>,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.update(orgId, agentId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertThread(contextKey, resp.data)

  return resp
}
```

**Step 7: Update `deleteThread.ts`**

```typescript
import { threadsApi } from '@TAF/services'
import { removeThread } from '@TAF/actions/threads/local/removeThread'

export const deleteThread = async (
  orgId: string,
  agentId: string,
  id: string,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.delete(orgId, agentId, id)
  if (resp.error) return { error: resp.error }
  resp.data?.success && removeThread(contextKey, id)

  return resp
}
```

**Step 8: Update `branchThread.ts`**

```typescript
import { Message } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'
import { upsertMessages } from '@TAF/actions/messages/local/upsertMessages'

export type TBranchThreadOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
  contextKey?: string
}

export const branchThread = async (opts: TBranchThreadOpts) => {
  const { orgId, agentId, threadId, messageId, contextKey = 'org' } = opts
  const resp = await threadsApi.branch(orgId, agentId, threadId, messageId)
  if (resp.error) return { error: resp.error }

  if (resp.data) {
    upsertThread(contextKey, resp.data)
    const messages = (resp.data as any).messages
    if (messages?.length) {
      // Use the new thread's ID as the threadId key for messages
      upsertMessages(resp.data.id, messages.map((m: any) => new Message(m)))
    }
  }

  return resp
}
```

---

## Task 10: Migrate Messages Actions

**Files:**
- Modify: `repos/admin/src/actions/messages/local/upsertMessages.ts`
- Modify: `repos/admin/src/actions/messages/local/upsertMessage.ts`
- Modify: `repos/admin/src/actions/messages/local/removeMessage.ts`
- Modify: `repos/admin/src/actions/messages/api/fetchMessages.ts`
- Modify: `repos/admin/src/actions/messages/api/updateMessage.ts`
- Modify: `repos/admin/src/actions/messages/api/deleteMessage.ts`

**Step 1: Update `upsertMessages.ts`**

```typescript
import type { Message } from '@tdsk/domain'
import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const upsertMessages = (threadId: string, messages: Message[]) => {
  const current = getThreadMessages(threadId) || {}
  const messagesMap = messages.reduce(
    (acc, message) => {
      acc[message.id] = message
      return acc
    },
    {} as Record<string, Message>
  )
  setThreadMessages(threadId, { ...current, ...messagesMap })
}
```

**Step 2: Update `upsertMessage.ts`**

```typescript
import type { Message } from '@tdsk/domain'
import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const upsertMessage = (threadId: string, message: Message) => {
  const current = getThreadMessages(threadId) || {}
  setThreadMessages(threadId, { ...current, [message.id]: message })
}
```

**Step 3: Update `removeMessage.ts`**

```typescript
import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const removeMessage = (threadId: string, id: string) => {
  const current = getThreadMessages(threadId) || {}
  const { [id]: _, ...rest } = current
  setThreadMessages(threadId, rest)
}
```

**Step 4: Update `fetchMessages.ts`**

```typescript
import { messagesApi } from '@TAF/services'
import { upsertMessages } from '@TAF/actions/messages/local/upsertMessages'

export type TFetchMessagesOpts = {
  orgId: string
  agentId: string
  threadId: string
}

export const fetchMessages = async (opts: TFetchMessagesOpts) => {
  const { orgId, agentId, threadId } = opts
  const resp = await messagesApi.listByThread(orgId, agentId, threadId)
  if (resp.error) return { error: resp.error }
  upsertMessages(threadId, resp.data)

  return resp
}
```

**Step 5: Update `updateMessage.ts`**

```typescript
import { messagesApi } from '@TAF/services'
import { upsertMessage } from '@TAF/actions/messages/local/upsertMessage'

export type TUpdateMessageOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
  data: Record<string, any>
}

export const updateMessage = async (opts: TUpdateMessageOpts) => {
  const { orgId, agentId, threadId, messageId, data } = opts
  const resp = await messagesApi.update(orgId, agentId, threadId, messageId, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertMessage(threadId, resp.data)

  return resp
}
```

**Step 6: Update `deleteMessage.ts`**

```typescript
import { messagesApi } from '@TAF/services'
import { removeMessage } from '@TAF/actions/messages/local/removeMessage'

export type TDeleteMessageOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
}

export const deleteMessage = async (opts: TDeleteMessageOpts) => {
  const { orgId, agentId, threadId, messageId } = opts
  const resp = await messagesApi.delete(orgId, agentId, threadId, messageId)
  if (resp.error) return { error: resp.error }
  removeMessage(threadId, messageId)

  return resp
}
```

---

## Task 11: Migrate Assets Actions

**Files:**
- Modify: `repos/admin/src/actions/assets/local/upsertAssets.ts`
- Modify: `repos/admin/src/actions/assets/local/upsertAsset.ts`
- Modify: `repos/admin/src/actions/assets/local/removeAsset.ts`
- Modify: `repos/admin/src/actions/assets/api/fetchAssets.ts`
- Modify: `repos/admin/src/actions/assets/api/deleteAsset.ts`

**Step 1: Update `upsertAssets.ts`**

```typescript
import type { Asset } from '@tdsk/domain'
import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const upsertAssets = (contextKey: string, assets: Asset[]) => {
  const current = getContextAssets(contextKey) || {}
  const assetsMap = assets.reduce(
    (acc, asset) => {
      acc[asset.id] = asset
      return acc
    },
    {} as Record<string, Asset>
  )

  setContextAssets(contextKey, { ...current, ...assetsMap })
}
```

**Step 2: Update `upsertAsset.ts`**

```typescript
import type { Asset } from '@tdsk/domain'
import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const upsertAsset = (contextKey: string, asset: Asset) => {
  const current = getContextAssets(contextKey) || {}
  setContextAssets(contextKey, { ...current, [asset.id]: asset })
}
```

**Step 3: Update `removeAsset.ts`**

```typescript
import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const removeAsset = (contextKey: string, id: string) => {
  const current = getContextAssets(contextKey) || {}
  const { [id]: _, ...rest } = current
  setContextAssets(contextKey, rest)
}
```

**Step 4: Update `fetchAssets.ts`**

```typescript
import { assetsApi } from '@TAF/services'
import { upsertAssets } from '@TAF/actions/assets/local/upsertAssets'

export const fetchAssets = async (contextKey: string, data?: Record<string, any>) => {
  const resp = await assetsApi.list(data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertAssets(contextKey, resp.data)

  return resp
}
```

**Step 5: Update `deleteAsset.ts`**

```typescript
import { assetsApi } from '@TAF/services'
import { removeAsset } from '@TAF/actions/assets/local/removeAsset'

export const deleteAsset = async (contextKey: string, id: string) => {
  const resp = await assetsApi.delete(id)
  if (resp.error) return { error: resp.error }
  resp.data?.success && removeAsset(contextKey, id)

  return resp
}
```

---

## Task 12: Update Org-Switch Cleanup

**Files:**
- Modify: `repos/admin/src/actions/projects/local/unsetActiveProject.ts`
- Modify: `repos/admin/src/actions/auth/local/reset.ts`

**Step 1: Update `unsetActiveProject.ts`**

Reset all keyed atoms when project context is cleared (called by `setOrgActive` on org change):

```typescript
import { nav } from '@TAF/services/nav'
import {
  getActiveOrgId,
  resetProjects,
  resetActiveProjectId,
  resetEndpoints,
  resetFunctions,
  resetAgents,
  resetSecrets,
  resetDomains,
  resetThreads,
  resetMessages,
  resetAssets,
} from '@TAF/state/accessors'

export const unsetActiveProject = (navigate?: boolean) => {
  resetProjects()
  resetActiveProjectId()
  // Reset all scope-keyed atoms (clears all project + org keys)
  resetEndpoints()
  resetFunctions()
  resetAgents()
  resetSecrets()
  resetDomains()
  resetThreads()
  resetMessages()
  resetAssets()

  if (!navigate) return

  const orgId = getActiveOrgId()
  nav.to(`/orgs/${orgId}/projects`)
}
```

**Step 2: Verify `reset.ts`**

The auth `reset.ts` already calls `resetEndpoints()`, `resetFunctions()`, `resetAgents()`, `resetSecrets()`, `resetDomains()`, `resetThreads()`, `resetMessages()`, `resetAssets()` — these still work since the accessors call `store.set(atom, undefined)`. No changes needed, but verify `resetOrgSecrets` is included. If missing, add it.

---

## Task 13: Migrate Component Layer — Endpoints (P0 Bug Fix)

**Files:**
- Modify: `repos/admin/src/hooks/endpoints/useEndpoints.ts`
- Modify: `repos/admin/src/hooks/endpoints/useEndpointFilter.ts`
- Modify: `repos/admin/src/components/Endpoints/EndpointDrawer.tsx`
- Modify: `repos/admin/src/components/Endpoints/Faas/FaasInputs.tsx`

**Step 1: Update `useEndpoints.ts`** — Fix P0 Bug 1 (infinite spinner)

```typescript
import type { Endpoint } from '@tdsk/domain'

import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'
import { fetchEndpoints } from '@TAF/actions/endpoints/api/fetchEndpoints'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { useEndpointFilter } from '@TAF/hooks/endpoints/useEndpointFilter'
import {
  useProjectEndpoints,
  useActiveProjectId,
  useActiveOrgId,
} from '@TAF/state/selectors'

export const useEndpoints = () => {
  const [endpoints] = useProjectEndpoints()
  const [orgId] = useActiveOrgId()
  const [query, setQuery] = useState(``)
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(true)
  const [deleteError, setDeleteError] = useState(``)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null)

  // Always fetch when orgId/projectId are present — no stale data guard
  useEffect(() => {
    if (!orgId || !projectId) return
    ife(async () => {
      try {
        setLoading(true)
        await fetchEndpoints({ orgId, projectId })
      } finally {
        setLoading(false)
      }
    })
  }, [orgId, projectId])

  const {
    count,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  } = useEndpointFilter({
    query,
    endpoints,
  })

  const onDelete = async (id: string) => {
    const result = await deleteEndpoint({ orgId, projectId, id })
    result.error && setDeleteError(`Failed to delete endpoint: ${result.error.message}`)
  }

  const onCreate = () => {
    setEndpoint(null)
    setDialogOpen(true)
  }

  const onEdit = (endpoint: Endpoint) => {
    setEndpoint(endpoint)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setEndpoint(null)
  }

  return {
    orgId,
    query,
    count,
    onEdit,
    loading,
    setQuery,
    onDelete,
    endpoint,
    onCreate,
    projectId,
    dialogOpen,
    deleteError,
    methodFilter,
    onDialogClose,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  }
}
```

**Step 2: Update `useEndpointFilter.ts`** — Remove projectId filter (data already scoped)

```typescript
import type { Endpoint } from '@tdsk/domain'

import { useState, useMemo } from 'react'

export type THEndpointFilter = {
  query: string
  endpoints: Record<string, Endpoint>
}

export const useEndpointFilter = (props: THEndpointFilter) => {
  const { query, endpoints } = props

  const [methodFilter, setMethodFilter] = useState<string>(`all`)
  const [visibilityFilter, setVisibilityFilter] = useState<string>(`all`)

  const { count, filtered } = useMemo(() => {
    if (!endpoints) return { filtered: [], count: 0 }

    const eps = Object.values(endpoints)
    const count = eps.length

    let filtered = [...eps]

    if (methodFilter !== `all`)
      filtered = filtered.filter((endpoint) => endpoint.method === methodFilter)

    if (visibilityFilter !== `all`) {
      const isPublic = visibilityFilter === `public`
      filtered = filtered.filter((endpoint) => endpoint.public === isPublic)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(
        (endpoint) =>
          endpoint.name?.toLowerCase().includes(q) ||
          endpoint.path?.toLowerCase().includes(q) ||
          endpoint.id?.toLowerCase().includes(q)
      )
    }

    return { filtered, count }
  }, [query, endpoints, methodFilter, visibilityFilter])

  return {
    count,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  }
}
```

**Step 3: Update `EndpointDrawer.tsx`** — Fix P0 Bug 2

Change `useFunctions()` to `useProjectFunctions()` and add fetch-on-open:

In imports, change:
```typescript
// Before
import { useSecrets, useFunctions } from '@TAF/state/selectors'
// After
import { useProjectSecrets, useProjectFunctions, useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
```

In the component body, change:
```typescript
// Before
const [secrets] = useSecrets()
const [functions] = useFunctions()
// After
const [secrets] = useProjectSecrets()
const [functions] = useProjectFunctions()
const [orgId] = useActiveOrgId()
const [projectId] = useActiveProjectId()
```

Add useEffect to fetch functions when drawer opens:
```typescript
import { fetchFunctions } from '@TAF/actions/functions/fetchFunctions'

useEffect(() => {
  if (open && orgId && projectId) {
    fetchFunctions({ orgId, projectId })
  }
}, [open, orgId, projectId])
```

**Step 4: Update `FaasInputs.tsx`** — Guard select value

Add value guard so MUI Select doesn't error on stale functionId:

```typescript
// In the component, before the return statement:
const safeFunctionId = availableFunctions?.some(f => f.id === functionId)
  ? functionId
  : ''

// Then in the SelectInput:
value={safeFunctionId}
```

(The exact location depends on how `functionId` reaches this component — it comes from props. The guard should be applied at the point where `functionId` is passed to the SelectInput.)

---

## Task 14: Migrate Component Layer — Project Pages

**Files:**
- Modify: `repos/admin/src/pages/Projects/Project.tsx`
- Modify: `repos/admin/src/pages/Projects/ProjectAgents.tsx`
- Modify: `repos/admin/src/pages/Projects/ProjectSecrets.tsx`
- Modify: `repos/admin/src/pages/Projects/ProjectDomains.tsx` (via Domains component)
- Modify: `repos/admin/src/pages/Projects/ProjectThreads.tsx` (via ThreadsTab/MessagesTab)

**Step 1: Update `Project.tsx`** — Simplify counts

Change imports:
```typescript
// Before
import { useAgents, useEndpoints, useFunctions, ... } from '@TAF/state/selectors'
// After
import { useProjectAgents, useProjectEndpoints, useProjectFunctions, ... } from '@TAF/state/selectors'
```

Simplify count calculations:
```typescript
// Before
const endpointCount = useMemo(
  () => endpoints ? Object.values(endpoints).filter((e) => e.projectId === projectId).length : 0,
  [endpoints, projectId]
)
// After
const endpointCount = useMemo(
  () => endpoints ? Object.keys(endpoints).length : 0,
  [endpoints]
)
```

Same pattern for `functionCount` and `agentCount`.

**Step 2: Update `ProjectAgents.tsx`** — Fix P0 Bug 3

Change to `useProjectAgents()`, remove `.filter(agent => agent.orgId === orgId)`:

```typescript
// Before
const [agents] = useAgents()
// After
const [agents] = useProjectAgents()

// Before
const agentsList = useMemo(() => {
  const list = Object.values(agents || {}).filter((agent) => agent.orgId === orgId)
  // ...
// After
const agentsList = useMemo(() => {
  const list = Object.values(agents || {})
  // ...

// Before
const totalCount = useMemo(
  () => Object.values(agents || {}).filter((agent) => agent.orgId === orgId).length,
  [agents, orgId]
)
// After
const totalCount = useMemo(
  () => Object.keys(agents || {}).length,
  [agents]
)
```

**Step 3: Update `useProjectSecrets.ts`**

```typescript
import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'
import { useProjectSecrets as useProjectSecretsSelector } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'

export type THOrgSecrets = {
  orgId?: string
  projectId?: string
}

export const useProjectSecrets = (props: THOrgSecrets) => {
  const { orgId, projectId } = props

  const [secrets] = useProjectSecretsSelector()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!orgId || !projectId) return

    ife(async () => {
      setLoading(true)
      setError(null)
      const result = await fetchSecrets({ orgId, projectId })
      result.error && setError(result.error)
      setLoading(false)
    })
  }, [orgId, projectId])

  return {
    error,
    secrets,
    loading,
    setError,
    setLoading,
  }
}
```

---

## Task 15: Migrate Component Layer — Org Pages

**Files:**
- Modify: `repos/admin/src/pages/Orgs/OrgAgents.tsx`
- Modify: `repos/admin/src/components/Domains/Domains.tsx`

**Step 1: Update `OrgAgents.tsx`**

Change `useAgents()` to `useOrgAgents()` and remove manual filtering.

**Step 2: Update `Domains.tsx`**

Change `useDomains()` to use derived selectors based on context:

```typescript
// Before
const [domains] = useDomains()
// After — use the raw atom but consume via the appropriate derived selector
import { useProjectDomains, useOrgDomains } from '@TAF/state/selectors'

// In component:
const [projectDomains] = useProjectDomains()
const [orgDomains] = useOrgDomains()
const domains = isProjectContext ? projectDomains : orgDomains
```

Remove manual filtering from `filteredDomains` and `domainsCount`:

```typescript
// Before
const contextFilteredDomains = domainsArray.filter((domain) => { ... })
// After — data is already scoped, just apply search filter
const contextFilteredDomains = domainsArray
```

---

## Task 16: Migrate Component Layer — AI Components

**Files:**
- Modify: `repos/admin/src/components/AI/ThreadsTab.tsx`
- Modify: `repos/admin/src/components/AI/MessagesTab.tsx`

**Step 1: Update `ThreadsTab.tsx`**

The ThreadsTab fetches threads by agentId. Change `useThreads()` to use context-aware selectors:

```typescript
// Before
const [threads] = useThreads()
// After
// ThreadsTab receives contextKey from parent (ProjectThreads passes projectId)
// Use useProjectThreads() or useOrgThreads() based on context
```

Update `fetchThreads` calls to pass `contextKey`:
```typescript
// Before
fetchThreads({ orgId, agentId: activeAgentId })
// After
fetchThreads({ orgId, agentId: activeAgentId, contextKey: projectId || 'org' })
```

**Step 2: Update `MessagesTab.tsx`**

Change `useMessages()` to `useThreadMessages()`:

```typescript
// Before
const [messages] = useMessages()
// After
const [messages] = useThreadMessages()
```

Update `branchThread` calls to pass `contextKey`:
```typescript
// Before
branchThread({ orgId, agentId, threadId, messageId })
// After
branchThread({ orgId, agentId, threadId, messageId, contextKey: projectId || 'org' })
```

---

## Task 17: Build Validation

**Step 1: Build admin**

Run: `cd /Users/lancetipton/keg-hub/external/apps/threadedstack && pnpm --filter @tdsk/admin build`

Expected: Build succeeds with 0 TypeScript errors.

If errors occur, fix each one. Common issues:
- Callers not passing the new scope key parameter
- Type mismatches where `Record<string, T>` is expected but `Record<string, Record<string, T>>` is received
- Missing imports for new derived atoms/selectors

**Step 2: Audit for remaining consumers**

Search for any remaining direct usage of `useEndpoints`, `useFunctions`, `useAgents`, `useSecrets`, `useDomains`, `useThreads`, `useMessages`, `useAssets` in components that should use derived selectors:

Run: `grep -r "useEndpoints\|useFunctions\|useAgents\|useSecrets\|useDomains\|useThreads\|useMessages\|useAssets" repos/admin/src/pages/ repos/admin/src/components/ repos/admin/src/hooks/ --include="*.ts" --include="*.tsx" | grep -v "useProject\|useOrg\|useThread\|node_modules"`

Fix any remaining direct atom consumers in project/org context.

---

## Task 18: Integration Tests — API Contract Validation

**Files:**
- Create: `repos/integration/src/tier1/project-state-scoping.test.ts`

This test validates that the backend API returns correctly scoped data per project — the foundation that the frontend scoping depends on.

```typescript
// repos/integration/src/tier1/project-state-scoping.test.ts
import { describe, test, expect, beforeAll } from 'vitest'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Project State Scoping', () => {
  const ctx = readContext()
  let projectAId: string
  let projectBId: string
  let endpointAId: string
  let endpointBId: string

  beforeAll(async () => {
    // Create two test projects
    const projA = await post<{ data: { id: string } }>(`/projects`, {
      orgId: ctx.orgId,
      name: `scoping-test-a-${Date.now()}`,
    })
    expect(projA.ok).toBe(true)
    projectAId = projA.data.data.id

    const projB = await post<{ data: { id: string } }>(`/projects`, {
      orgId: ctx.orgId,
      name: `scoping-test-b-${Date.now()}`,
    })
    expect(projB.ok).toBe(true)
    projectBId = projB.data.data.id

    // Create an endpoint in each project
    const epA = await post<{ data: { id: string } }>(
      `/endpoints`,
      {
        name: 'ep-in-a',
        path: '/test-a',
        method: 'GET',
        type: 'proxy',
        targetUrl: 'https://example.com/a',
        projectId: projectAId,
        orgId: ctx.orgId,
      }
    )
    expect(epA.ok).toBe(true)
    endpointAId = epA.data.data.id

    const epB = await post<{ data: { id: string } }>(
      `/endpoints`,
      {
        name: 'ep-in-b',
        path: '/test-b',
        method: 'GET',
        type: 'proxy',
        targetUrl: 'https://example.com/b',
        projectId: projectBId,
        orgId: ctx.orgId,
      }
    )
    expect(epB.ok).toBe(true)
    endpointBId = epB.data.data.id
  })

  test('GET /endpoints for Project A returns only Project A endpoints', async () => {
    const res = await get<{ data: { id: string; projectId: string }[] }>(
      `/endpoints?orgId=${ctx.orgId}&projectId=${projectAId}`
    )
    expect(res.ok).toBe(true)
    const endpoints = res.data.data
    expect(endpoints.some(e => e.id === endpointAId)).toBe(true)
    expect(endpoints.every(e => e.projectId === projectAId)).toBe(true)
    expect(endpoints.some(e => e.id === endpointBId)).toBe(false)
  })

  test('GET /endpoints for Project B returns only Project B endpoints', async () => {
    const res = await get<{ data: { id: string; projectId: string }[] }>(
      `/endpoints?orgId=${ctx.orgId}&projectId=${projectBId}`
    )
    expect(res.ok).toBe(true)
    const endpoints = res.data.data
    expect(endpoints.some(e => e.id === endpointBId)).toBe(true)
    expect(endpoints.every(e => e.projectId === projectBId)).toBe(true)
    expect(endpoints.some(e => e.id === endpointAId)).toBe(false)
  })

  test('endpoints from different projects are isolated', async () => {
    const resA = await get<{ data: { id: string }[] }>(
      `/endpoints?orgId=${ctx.orgId}&projectId=${projectAId}`
    )
    const resB = await get<{ data: { id: string }[] }>(
      `/endpoints?orgId=${ctx.orgId}&projectId=${projectBId}`
    )

    const idsA = new Set(resA.data.data.map(e => e.id))
    const idsB = new Set(resB.data.data.map(e => e.id))

    // No overlap
    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false)
    }
  })

  // Cleanup
  test.afterAll(async () => {
    if (endpointAId) await del(`/endpoints/${endpointAId}?orgId=${ctx.orgId}&projectId=${projectAId}`)
    if (endpointBId) await del(`/endpoints/${endpointBId}?orgId=${ctx.orgId}&projectId=${projectBId}`)
    if (projectAId) await del(`/projects/${projectAId}?orgId=${ctx.orgId}`)
    if (projectBId) await del(`/projects/${projectBId}?orgId=${ctx.orgId}`)
  })
})
```

**Step 1: Run the test**

Run: `cd /Users/lancetipton/keg-hub/external/apps/threadedstack/repos/integration && pnpm test:api -- --testPathPattern=project-state-scoping`

Expected: All tests pass, confirming backend returns correctly scoped data.

---

## Task 19: Integration Tests — UI Navigation Scoping (Playwright)

**Files:**
- Create: `repos/integration/playwright/tier2/project-navigation.spec.ts`

This test validates that navigating between projects in the UI shows correct, non-stale data.

```typescript
// repos/integration/playwright/tier2/project-navigation.spec.ts
import { test, expect } from '../fixtures/auth'

test.describe('Project Navigation State Scoping', () => {
  test('navigating between projects shows correct endpoint data', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // Navigate to org's projects page
    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    // Verify projects page renders
    await expect(page.locator('body').first()).toBeVisible()

    // If a project is available, navigate to its endpoints
    if (ctx.projectId) {
      await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
      await page.waitForLoadState('networkidle')

      // Verify endpoint page renders without infinite spinner
      // The page should either show endpoints or an empty state — NOT a loading spinner after network idle
      const spinner = page.locator('[role="progressbar"]')
      const hasSpinner = await spinner.isVisible().catch(() => false)

      // After networkidle, spinner should be gone
      if (hasSpinner) {
        // Wait a bit more for React state to settle
        await page.waitForTimeout(2000)
        await expect(spinner).not.toBeVisible()
      }
    }

    expect(errors).toEqual([])
  })

  test('endpoint function select does not produce MUI errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    if (!ctx.projectId) return

    // Navigate to endpoints page
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')

    // No MUI "out of range" console errors should appear
    const muiErrors = errors.filter(e => e.includes('out of range') || e.includes('MUI'))
    expect(muiErrors).toEqual([])
  })
})
```

**Step 1: Run the test**

Run: `cd /Users/lancetipton/keg-hub/external/apps/threadedstack/repos/integration && pnpm test:ui -- --grep "Project Navigation"`

Expected: All tests pass. No infinite spinners, no MUI errors.

---

## Task 20: Final Validation

**Step 1: Run admin build**

Run: `pnpm --filter @tdsk/admin build`

Expected: Build succeeds, 0 errors.

**Step 2: Run all integration tests**

Run: `cd repos/integration && pnpm test:api`

Expected: All existing tier1 + tier3 tests still pass. New `project-state-scoping` tests pass.

**Step 3: Run Playwright tests**

Run: `cd repos/integration && pnpm test:ui`

Expected: All existing tier2 tests pass. New `project-navigation.spec.ts` tests pass.

---

## Appendix: Full File Change List

### State Layer (8 files modified)
- `repos/admin/src/state/endpoints.ts`
- `repos/admin/src/state/functions.ts`
- `repos/admin/src/state/agents.ts`
- `repos/admin/src/state/secrets.ts`
- `repos/admin/src/state/domains.ts`
- `repos/admin/src/state/threads.ts`
- `repos/admin/src/state/messages.ts`
- `repos/admin/src/state/assets.ts`

### Accessor/Selector Layer (2 files modified)
- `repos/admin/src/state/accessors.ts`
- `repos/admin/src/state/selectors.ts`

### Action Layer (30+ files modified)
- `repos/admin/src/actions/endpoints/local/upsertEndpoints.ts`
- `repos/admin/src/actions/endpoints/local/upsertEndpoint.ts`
- `repos/admin/src/actions/endpoints/local/removeEndpoint.ts`
- `repos/admin/src/actions/endpoints/api/fetchEndpoints.ts`
- `repos/admin/src/actions/endpoints/api/fetchEndpoint.ts`
- `repos/admin/src/actions/endpoints/api/createEndpoint.ts`
- `repos/admin/src/actions/endpoints/api/updateEndpoint.ts`
- `repos/admin/src/actions/endpoints/api/deleteEndpoint.ts`
- `repos/admin/src/actions/functions/fetchFunctions.ts`
- `repos/admin/src/actions/functions/fetchFunction.ts`
- `repos/admin/src/actions/functions/createFunction.ts`
- `repos/admin/src/actions/functions/updateFunction.ts`
- `repos/admin/src/actions/functions/deleteFunction.ts`
- `repos/admin/src/actions/agents/local/upsertAgents.ts`
- `repos/admin/src/actions/agents/local/upsertAgent.ts`
- `repos/admin/src/actions/agents/local/removeAgent.ts`
- `repos/admin/src/actions/agents/api/fetchAgents.ts`
- `repos/admin/src/actions/agents/api/fetchAgent.ts`
- `repos/admin/src/actions/agents/api/createAgent.ts`
- `repos/admin/src/actions/agents/api/updateAgent.ts`
- `repos/admin/src/actions/agents/api/deleteAgent.ts`
- `repos/admin/src/actions/secrets/local/setSecrets.ts`
- `repos/admin/src/actions/secrets/local/upsertSecret.ts`
- `repos/admin/src/actions/secrets/local/removeSecret.ts`
- `repos/admin/src/actions/secrets/api/fetchSecrets.ts`
- `repos/admin/src/actions/secrets/api/fetchSecret.ts`
- `repos/admin/src/actions/secrets/api/createSecret.ts`
- `repos/admin/src/actions/secrets/api/updateSecret.ts`
- `repos/admin/src/actions/secrets/api/deleteSecret.ts`
- `repos/admin/src/actions/domains/local/upsertDomains.ts`
- `repos/admin/src/actions/domains/local/upsertDomain.ts`
- `repos/admin/src/actions/domains/local/removeDomain.ts`
- `repos/admin/src/actions/domains/api/fetchDomains.ts`
- `repos/admin/src/actions/domains/api/fetchDomain.ts`
- `repos/admin/src/actions/domains/api/createDomain.ts`
- `repos/admin/src/actions/domains/api/updateDomain.ts`
- `repos/admin/src/actions/domains/api/deleteDomain.ts`
- `repos/admin/src/actions/threads/local/upsertThreads.ts`
- `repos/admin/src/actions/threads/local/upsertThread.ts`
- `repos/admin/src/actions/threads/local/removeThread.ts`
- `repos/admin/src/actions/threads/api/fetchThreads.ts`
- `repos/admin/src/actions/threads/api/createThread.ts`
- `repos/admin/src/actions/threads/api/updateThread.ts`
- `repos/admin/src/actions/threads/api/deleteThread.ts`
- `repos/admin/src/actions/threads/api/branchThread.ts`
- `repos/admin/src/actions/messages/local/upsertMessages.ts`
- `repos/admin/src/actions/messages/local/upsertMessage.ts`
- `repos/admin/src/actions/messages/local/removeMessage.ts`
- `repos/admin/src/actions/messages/api/fetchMessages.ts`
- `repos/admin/src/actions/messages/api/updateMessage.ts`
- `repos/admin/src/actions/messages/api/deleteMessage.ts`
- `repos/admin/src/actions/assets/local/upsertAssets.ts`
- `repos/admin/src/actions/assets/local/upsertAsset.ts`
- `repos/admin/src/actions/assets/local/removeAsset.ts`
- `repos/admin/src/actions/assets/api/fetchAssets.ts`
- `repos/admin/src/actions/assets/api/deleteAsset.ts`

### Cleanup Layer (2 files modified)
- `repos/admin/src/actions/projects/local/unsetActiveProject.ts`
- `repos/admin/src/actions/auth/local/reset.ts` (verify only)

### Hook/Component Layer (10+ files modified)
- `repos/admin/src/hooks/endpoints/useEndpoints.ts`
- `repos/admin/src/hooks/endpoints/useEndpointFilter.ts`
- `repos/admin/src/hooks/project/useProjectSecrets.ts`
- `repos/admin/src/pages/Projects/Project.tsx`
- `repos/admin/src/pages/Projects/ProjectAgents.tsx`
- `repos/admin/src/pages/Projects/ProjectSecrets.tsx` (if needed)
- `repos/admin/src/pages/Orgs/OrgAgents.tsx`
- `repos/admin/src/components/Endpoints/EndpointDrawer.tsx`
- `repos/admin/src/components/Endpoints/Faas/FaasInputs.tsx`
- `repos/admin/src/components/Domains/Domains.tsx`
- `repos/admin/src/components/AI/ThreadsTab.tsx`
- `repos/admin/src/components/AI/MessagesTab.tsx`

### Integration Tests (2 files created)
- `repos/integration/src/tier1/project-state-scoping.test.ts`
- `repos/integration/playwright/tier2/project-navigation.spec.ts`

**Total: ~60 files modified, 2 files created**

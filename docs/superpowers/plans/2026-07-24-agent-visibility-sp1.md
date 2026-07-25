# Agent Visibility SP1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users a read-only view of what any agent is doing, by exposing the telemetry residents already write (status heartbeat, per-turn transcripts, inter-agent messages, memories) through four guarded endpoints and a dedicated admin activity page.

**Architecture:** Four thin project-scoped GET endpoints read the existing `resident_status` / `resident_transcripts` / `agent_messages` / `resident_memories` Collections via `db.services.record.query`. The admin SPA follows the repo's mandated chain: route loader calls actions, actions call the API service and write Jotai atoms, components only read atoms through selector hooks. Liveness comes from a 5-second poll owned by the action layer, never a component effect. Read-only: no new write surface, no runtime changes, zero risk to the six agents running in production.

**Tech Stack:** Express 5 + `TEndpointConfig` (backend), Vitest (both), React 18 + React Router v7 + Jotai + MUI + `@tdsk/components` (admin).

**Spec:** `docs/superpowers/specs/2026-07-24-agent-visibility-design.md`

---

## STATUS: Tasks 1-3 are BUILT AND MERGED (PR #282). Start at Task 4.

Implementing the backend proved four of this plan's assumptions wrong. They are
corrected below, but read these first — two of them were latent 500s, not
cosmetic:

1. **`resident_status` and `agent_messages` declare NO `at` field.**
   `compileRecordQuery.validateField` THROWS on a field absent from the seed
   schema and `record.query` converts that to `{ error }`, so this plan's
   `orderBy: { field: 'at' }` was a guaranteed **500 on every call**, not a
   quiet empty list. Only `resident_transcripts` and `resident_memories`
   declare `at`. As shipped: status and messages use no `orderBy` (the
   service's `createdAt DESC` fallback), and messages page by `offset` since
   there is nothing to keyset on.
   **This matters for Task 8 below** — the timeline cannot sort messages on
   `data.at`, because there isn't one.
2. **The activity routes mount INSIDE the existing `projectAgents` group**, not
   as a sibling. Express `use` matches on prefix, so a sibling at
   `/:projectId/agents/:agentId/activity` would run `projectAccessGuard +
   projectMemberGuard` TWICE per request. `featureGate('agents')` therefore
   also applies, and is correct (it is a build-time flag, not a paid gate).
3. **The scope guard verifies the project binding too**, not just `orgId`. It
   returns 404 in every failure case so it cannot be used to enumerate ids.
4. **The response envelope is `{ id, data, createdAt }`.** `createdAt` is
   required precisely because `agent_messages` carries no timestamp.

Security review of the shipped endpoints added: BOTH `agent:read` and
`collection:read` are required (these return raw Collection documents), turn
and message bodies are passed through a secret redactor, and `offset` is
clamped at the top as well as the bottom.

**Sharpest edge in this subsystem:** any query field must exist in the
collection's seed schema. A typo becomes a 500 on every request rather than an
empty result. It bit this plan twice.

## Conventions (read before starting)

These are enforced project rules. Violating them fails review:

- **Components NEVER call accessors directly.** Only actions call accessors.
- **NO `useEffect` for data loading.** Fetch in loaders, actions, or event handlers.
- **Atom `undefined` = "not fetched yet"; `[]` / `{}` = "fetched, empty".** The UI must render a skeleton for the first and an empty state for the second.
- **Deep-path imports for admin actions** (`@TAF/actions/agentActivity/api/fetchAgentStatus`), not barrel imports.
- **Inputs come from `@tdsk/components`** (`TextInput`), never MUI `TextField`.
- **Exported types go in the repo's `types/` directory**; non-exported types stay local to the file.
- **Never re-export.** Update callsites directly.
- Backtick string literals, 2-space indent, comments explain WHY.

## File Structure

**Backend** (`repos/backend/src/`)
- Create `endpoints/agents/activity/getAgentStatus.ts` — newest `resident_status` row for an agent
- Create `endpoints/agents/activity/listAgentTurns.ts` — paginated `resident_transcripts`
- Create `endpoints/agents/activity/listAgentMessages.ts` — paginated `agent_messages`
- Create `endpoints/agents/activity/listAgentMemories.ts` — paginated `resident_memories`
- Create `endpoints/agents/activity/resolveActivityQuery.ts` — shared param/pagination parsing (one place, so the four endpoints cannot drift)
- Create `endpoints/agents/activity/activity.test.ts` — endpoint tests
- Modify `endpoints/orgs/orgProjects.ts` — mount the activity group

**Admin** (`repos/admin/src/`)
- Create `state/agentActivity.ts` — atoms
- Modify `state/accessors.ts` — accessors
- Modify `state/selectors.ts` — selector hooks
- Create `services/agentActivityApi.ts` — API accessor
- Create `actions/agentActivity/api/fetchAgentActivity.ts` — fetch all four
- Create `actions/agentActivity/local/setAgentActivity.ts` — atom writes
- Create `actions/agentActivity/local/pollAgentActivity.ts` — poll controller
- Create `components/AgentActivity/AgentActivity.tsx` — page
- Create `components/AgentActivity/AgentStatusHeader.tsx` — liveness header
- Create `components/AgentActivity/AgentTimeline.tsx` — merged timeline
- Create `components/AgentActivity/*.test.tsx` — component tests
- Modify `routes/loaders.ts` — `agentActivityLoader`
- Modify `routes/Routes.tsx` — register the route
- Create `types/agentActivity.types.ts` — exported types

---

## Task 1: Shared activity query resolver

**Files:**
- Create: `repos/backend/src/endpoints/agents/activity/resolveActivityQuery.ts`
- Test: `repos/backend/src/endpoints/agents/activity/activity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `repos/backend/src/endpoints/agents/activity/activity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { EQueryOp } from '@tdsk/domain'
import { resolveActivityQuery } from './resolveActivityQuery'

describe(`resolveActivityQuery`, () => {
  it(`filters by agentId and sorts newest first by default`, () => {
    const query = resolveActivityQuery(`ag_1`, {})
    expect(query).toEqual({
      where: [{ field: `agentId`, op: EQueryOp.eq, value: `ag_1` }],
      orderBy: { field: `at`, direction: `desc` },
      limit: 25,
    })
  })

  it(`clamps limit to the 1-100 range and coerces a numeric string`, () => {
    expect(resolveActivityQuery(`ag_1`, { limit: `50` }).limit).toBe(50)
    expect(resolveActivityQuery(`ag_1`, { limit: `500` }).limit).toBe(100)
    expect(resolveActivityQuery(`ag_1`, { limit: `0` }).limit).toBe(1)
    // Garbage falls back to the default rather than NaN reaching the query.
    expect(resolveActivityQuery(`ag_1`, { limit: `abc` }).limit).toBe(25)
  })

  it(`adds a keyset cursor when before is supplied`, () => {
    const query = resolveActivityQuery(`ag_1`, { before: `2026-07-24T00:00:00Z` })
    expect(query.where).toEqual([
      { field: `agentId`, op: EQueryOp.eq, value: `ag_1` },
      { field: `at`, op: EQueryOp.lt, value: `2026-07-24T00:00:00Z` },
    ])
  })

  it(`ignores a non-string before rather than injecting an array`, () => {
    // Express parses `?before=a&before=b` into an array — it must never reach
    // the query layer as a bound value.
    const query = resolveActivityQuery(`ag_1`, { before: [`a`, `b`] as any })
    expect(query.where).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test src/endpoints/agents/activity/activity.test.ts`
Expected: FAIL, cannot find module `./resolveActivityQuery`

- [ ] **Step 3: Write the implementation**

Create `repos/backend/src/endpoints/agents/activity/resolveActivityQuery.ts`:

```typescript
import type { TRecordQuery } from '@tdsk/domain'

import { EQueryOp } from '@tdsk/domain'

/** Page size when the caller does not ask for one. */
const DefaultLimit = 25
/** Hard ceiling — the transcripts collection grows without bound, so an
 * unbounded read is never acceptable. */
const MaxLimit = 100

/**
 * Build the record query for an agent-activity read. Shared by all four
 * activity endpoints so their filtering, ordering, and pagination cannot drift
 * apart.
 *
 * Newest-first with a keyset cursor on `at` (rather than offset paging) because
 * these collections are append-heavy: an offset page would shift under the
 * reader as new turns land. `limit` is clamped rather than trusted, and a
 * non-string `before` is dropped — Express parses a repeated query param into
 * an array, which must never reach the query layer as a bound value.
 */
export const resolveActivityQuery = (
  agentId: string,
  query: { limit?: unknown; before?: unknown }
): TRecordQuery => {
  const parsed = Number.parseInt(String(query.limit ?? ``), 10)
  const limit = Number.isNaN(parsed)
    ? DefaultLimit
    : Math.min(Math.max(parsed, 1), MaxLimit)

  const where: TRecordQuery[`where`] = [
    { field: `agentId`, op: EQueryOp.eq, value: agentId },
  ]

  if (typeof query.before === `string` && query.before)
    where.push({ field: `at`, op: EQueryOp.lt, value: query.before })

  return { where, orderBy: { field: `at`, direction: `desc` }, limit }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test src/endpoints/agents/activity/activity.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add repos/backend/src/endpoints/agents/activity/
git commit -m "feat(backend): shared query resolver for agent activity reads"
```

---

## Task 2: The four activity endpoints

**Files:**
- Create: `repos/backend/src/endpoints/agents/activity/getAgentStatus.ts`
- Create: `repos/backend/src/endpoints/agents/activity/listAgentTurns.ts`
- Create: `repos/backend/src/endpoints/agents/activity/listAgentMessages.ts`
- Create: `repos/backend/src/endpoints/agents/activity/listAgentMemories.ts`
- Test: `repos/backend/src/endpoints/agents/activity/activity.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `repos/backend/src/endpoints/agents/activity/activity.test.ts`:

```typescript
import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { vi, beforeEach } from 'vitest'
import { EPMethod } from '@TBE/types'
import { getAgentStatus } from './getAgentStatus'
import { listAgentTurns } from './listAgentTurns'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

const buildMockReqRes = () => {
  const mockJson = vi.fn()
  const recordService = { query: vi.fn() }
  const agentService = { get: vi.fn() }

  const mockRes = { status: vi.fn().mockReturnThis(), json: mockJson } as unknown as Response

  const mockReq = {
    app: { locals: { db: { services: { record: recordService, agent: agentService } } } } as any,
    params: { orgId: `org-1`, projectId: `proj-1`, agentId: `ag_1` },
    query: {},
    body: {},
  } as unknown as TRequest

  return { mockReq, mockRes, mockJson, recordService, agentService }
}

describe(`agent activity endpoints`, () => {
  let ctx: ReturnType<typeof buildMockReqRes>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockReqRes()
    ctx.agentService.get.mockResolvedValue({
      data: { id: `ag_1`, orgId: `org-1` },
    })
  })

  it(`declares the expected routes`, () => {
    expect(getAgentStatus.path).toBe(`/status`)
    expect(getAgentStatus.method).toBe(EPMethod.Get)
    expect(listAgentTurns.path).toBe(`/turns`)
    expect(listAgentTurns.method).toBe(EPMethod.Get)
  })

  it(`returns the newest status row for the agent`, async () => {
    ctx.recordService.query.mockResolvedValue({
      data: [{ id: `rec_1`, data: { agentId: `ag_1`, turnCount: 7 } }],
    })

    await getAgentStatus.action(ctx.mockReq, ctx.mockRes)

    expect(ctx.recordService.query).toHaveBeenCalledWith(
      `proj-1`,
      `resident_status`,
      expect.objectContaining({ limit: 1 })
    )
    expect(ctx.mockJson).toHaveBeenCalledWith({
      data: { id: `rec_1`, data: { agentId: `ag_1`, turnCount: 7 } },
    })
  })

  it(`returns null status when the agent has never run, not a 404`, async () => {
    // A scheduled (non-resident) agent legitimately has no heartbeat row.
    ctx.recordService.query.mockResolvedValue({ data: [] })

    await getAgentStatus.action(ctx.mockReq, ctx.mockRes)

    expect(ctx.mockJson).toHaveBeenCalledWith({ data: null })
  })

  it(`returns turns as { id, data } and never leaks other record columns`, async () => {
    ctx.recordService.query.mockResolvedValue({
      data: [{ id: `rec_1`, data: { event: `agenda:groom` }, projectId: `proj-1` }],
    })

    await listAgentTurns.action(ctx.mockReq, ctx.mockRes)

    expect(ctx.mockJson).toHaveBeenCalledWith({
      data: [{ id: `rec_1`, data: { event: `agenda:groom` } }],
    })
  })

  it(`404s when the agent is not in the caller's org`, async () => {
    ctx.agentService.get.mockResolvedValue({ data: { id: `ag_1`, orgId: `other-org` } })

    await expect(listAgentTurns.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Agent not found`
    )
    // The guard must run BEFORE any collection read.
    expect(ctx.recordService.query).not.toHaveBeenCalled()
  })

  it(`404s when the agent does not exist`, async () => {
    ctx.agentService.get.mockResolvedValue({ data: null })

    await expect(listAgentTurns.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`throws 400 when agentId is missing`, async () => {
    ctx.mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any

    await expect(listAgentTurns.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `agentId is required`
    )
  })

  it(`surfaces a record-service error as a 500`, async () => {
    ctx.recordService.query.mockResolvedValue({ error: { message: `DB failure` } })

    await expect(listAgentTurns.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `DB failure`
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/backend && pnpm test src/endpoints/agents/activity/activity.test.ts`
Expected: FAIL, cannot find module `./getAgentStatus`

- [ ] **Step 3: Write the shared guard**

Create `repos/backend/src/endpoints/agents/activity/assertAgentInScope.ts`:

```typescript
import type { TRequest } from '@TBE/types'

import { Exception } from '@tdsk/domain'

/**
 * Resolve and scope-check the agent BEFORE any collection is read. The activity
 * collections are project-scoped but their rows are filtered only by `agentId`,
 * so without this an in-project caller could read another org's agent telemetry
 * by guessing an id. Returns 404 (not 403) so the endpoint never confirms that
 * an out-of-scope agent exists.
 */
export const assertAgentInScope = async (req: TRequest): Promise<string> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params

  if (!orgId) throw new Exception(400, `orgId is required`)
  if (!projectId) throw new Exception(400, `projectId is required`)
  if (!agentId) throw new Exception(400, `agentId is required`)

  const { data, error } = await db.services.agent.get(agentId)
  if (error) throw new Exception(500, error.message)
  if (!data || data.orgId !== orgId) throw new Exception(404, `Agent not found`)

  return agentId
}
```

- [ ] **Step 4: Write the status endpoint**

Create `repos/backend/src/endpoints/agents/activity/getAgentStatus.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EQueryOp } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { assertAgentInScope } from './assertAgentInScope'

/** The heartbeat collection the resident runtime upserts every ~30s. */
const ResidentStatusCollection = `resident_status`

/**
 * The agent's current liveness: queue depth, current activity, turn count, last
 * turn time, and the watchdog-owned `degraded` flag. Returns `data: null` when
 * the agent has never run — that is the normal state for a scheduled
 * (non-resident) agent, not an error.
 */
export const getAgentStatus: TEndpointConfig = {
  path: `/status`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params
    const agentId = await assertAgentInScope(req)

    const { data, error } = await db.services.record.query(
      projectId,
      ResidentStatusCollection,
      {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }],
        orderBy: { field: `at`, direction: `desc` },
        limit: 1,
      }
    )
    if (error) throw new Exception(500, error.message)

    const row = data?.[0]
    res.json({ data: row ? { id: row.id, data: row.data } : null })
  },
}
```

- [ ] **Step 5: Write the three list endpoints**

Create `repos/backend/src/endpoints/agents/activity/listAgentTurns.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { assertAgentInScope } from './assertAgentInScope'
import { resolveActivityQuery } from './resolveActivityQuery'

/** One append-only row per completed turn, written by `appendTranscript`. */
const ResidentTranscriptsCollection = `resident_transcripts`

/**
 * The agent's recent turns, newest first. Each row carries the trigger `event`
 * plus the turn's `input`/`output`, which the writer tail-caps at 20k chars —
 * the UI marks a value at that cap as truncated rather than implying it is the
 * full turn.
 */
export const listAgentTurns: TEndpointConfig = {
  path: `/turns`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params
    const agentId = await assertAgentInScope(req)

    const { data, error } = await db.services.record.query(
      projectId,
      ResidentTranscriptsCollection,
      resolveActivityQuery(agentId, req.query)
    )
    if (error) throw new Exception(500, error.message)

    res.json({ data: (data ?? []).map((row) => ({ id: row.id, data: row.data })) })
  },
}
```

Create `repos/backend/src/endpoints/agents/activity/listAgentMessages.ts` — identical shape, with:

```typescript
/** Inter-agent mail, written by `sendAgentMessage`. */
const AgentMessagesCollection = `agent_messages`
```

and `path: '/messages'`, `export const listAgentMessages`, querying `AgentMessagesCollection`.

> Note: `agent_messages` rows carry `to`/`from`, not `agentId`. Filtering by
> `agentId` would return nothing, so this endpoint queries by recipient:
> replace the `resolveActivityQuery` call with an inline query using
> `{ field: 'to', op: EQueryOp.eq, value: agentId }` and the same
> `orderBy`/`limit` handling. Import `resolveActivityQuery` and override its
> `where[0].field` is NOT acceptable — build the query explicitly:

```typescript
    const base = resolveActivityQuery(agentId, req.query)
    const { data, error } = await db.services.record.query(
      projectId,
      AgentMessagesCollection,
      { ...base, where: [{ field: `to`, op: EQueryOp.eq, value: agentId }] }
    )
```

Create `repos/backend/src/endpoints/agents/activity/listAgentMemories.ts` — identical to `listAgentTurns`, with:

```typescript
/** Durable learnings, written by `writeMemory`. */
const ResidentMemoriesCollection = `resident_memories`
```

and `path: '/memories'`, `export const listAgentMemories`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd repos/backend && pnpm test src/endpoints/agents/activity/activity.test.ts`
Expected: PASS, all tests

- [ ] **Step 7: Commit**

```bash
git add repos/backend/src/endpoints/agents/activity/
git commit -m "feat(backend): read-only agent activity endpoints (status, turns, messages, memories)"
```

---

## Task 3: Mount the activity routes

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgProjects.ts`

- [ ] **Step 1: Add the route group**

In `repos/backend/src/endpoints/orgs/orgProjects.ts`, add imports:

```typescript
import { getAgentStatus } from '@TBE/endpoints/agents/activity/getAgentStatus'
import { listAgentTurns } from '@TBE/endpoints/agents/activity/listAgentTurns'
import { listAgentMemories } from '@TBE/endpoints/agents/activity/listAgentMemories'
import { listAgentMessages } from '@TBE/endpoints/agents/activity/listAgentMessages'
```

Then, next to the existing `projectSchedules` group, add:

```typescript
/**
 * Read-only agent telemetry. Guarded exactly like every other project-scoped
 * group: `projectAccessGuard` blocks a project-scoped API key aimed at another
 * project, `projectMemberGuard` requires membership. Deliberately no
 * `featureGate` — visibility into your own agents is not a paid feature.
 */
const projectAgentActivity: TEndpointConfig = {
  path: `/:projectId/agents/:agentId/activity`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    getAgentStatus,
    listAgentTurns,
    listAgentMessages,
    listAgentMemories,
  },
}
```

Register it in the `orgProjects` endpoints object, after `projectAgents`:

```typescript
    projectAgents,
    projectAgentActivity,
```

- [ ] **Step 2: Verify types**

Run: `cd repos/backend && pnpm types`
Expected: exit 0, no output

- [ ] **Step 3: Run the full backend suite**

Run: `cd repos/backend && pnpm test`
Expected: PASS, no regressions

- [ ] **Step 4: Commit**

```bash
git add repos/backend/src/endpoints/orgs/orgProjects.ts
git commit -m "feat(backend): mount agent activity routes under project scope"
```

---

## Task 4: Admin types and atoms

**Files:**
- Create: `repos/admin/src/types/agentActivity.types.ts`
- Create: `repos/admin/src/state/agentActivity.ts`

- [ ] **Step 1: Create the exported types**

Create `repos/admin/src/types/agentActivity.types.ts`:

```typescript
/**
 * One row as the activity endpoints return it.
 *
 * `createdAt` is NOT decoration: `agent_messages` documents carry no timestamp
 * of their own, so it is the only thing the merged timeline can order them by.
 */
export type TActivityRecord = {
  id: string
  data: Record<string, any>
  createdAt: string
}

/** The liveness row from `resident_status`. */
export type TAgentStatus = {
  agentId: string
  sessionId?: string
  queueDepth?: number
  currentActivity?: string
  lastTurnAt?: string
  turnCount?: number
  degraded?: boolean
}

/** Which source a merged timeline entry came from. */
export type TTimelineKind = `turn` | `message` | `memory`

/** A single merged, chronologically sortable timeline entry. */
export type TTimelineEntry = {
  id: string
  kind: TTimelineKind
  at: string
  title: string
  body?: string
}
```

- [ ] **Step 2: Create the atoms**

Create `repos/admin/src/state/agentActivity.ts`:

```typescript
import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'

import { atomWithReset } from 'jotai/utils'

/**
 * Agent activity state, keyed by agentId so switching agents cannot show the
 * previous agent's turns.
 *
 * Every atom starts `undefined`, which means "not fetched yet" and renders a
 * skeleton. An empty object/array means "fetched, and there is nothing" and
 * renders an empty state. Collapsing those two would make a never-run agent
 * look like it is perpetually loading.
 */
export const agentStatusState =
  atomWithReset<Record<string, TAgentStatus | null>>(undefined)

export const agentTurnsState =
  atomWithReset<Record<string, TActivityRecord[]>>(undefined)

export const agentMessagesState =
  atomWithReset<Record<string, TActivityRecord[]>>(undefined)

export const agentMemoriesState =
  atomWithReset<Record<string, TActivityRecord[]>>(undefined)
```

- [ ] **Step 3: Verify types**

Run: `cd repos/admin && pnpm types`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add repos/admin/src/types/agentActivity.types.ts repos/admin/src/state/agentActivity.ts
git commit -m "feat(admin): agent activity types and atoms"
```

---

## Task 5: Accessors and selector hooks

**Files:**
- Modify: `repos/admin/src/state/accessors.ts`
- Modify: `repos/admin/src/state/selectors.ts`

- [ ] **Step 1: Add accessors**

Append to `repos/admin/src/state/accessors.ts`:

```typescript
// Agent activity (agent-scoped telemetry reads)
export const getAgentStatusMap = () => store.get(agentStatusState)
export const setAgentStatusMap = (map: Record<string, TAgentStatus | null>) =>
  store.set(agentStatusState, map)
export const getContextAgentStatus = (agentId: string) => getAgentStatusMap()?.[agentId]
export const setContextAgentStatus = (agentId: string, status: TAgentStatus | null) =>
  setAgentStatusMap({ ...(getAgentStatusMap() || {}), [agentId]: status })

export const getAgentTurnsMap = () => store.get(agentTurnsState)
export const setAgentTurnsMap = (map: Record<string, TActivityRecord[]>) =>
  store.set(agentTurnsState, map)
export const getContextAgentTurns = (agentId: string) => getAgentTurnsMap()?.[agentId]
export const setContextAgentTurns = (agentId: string, rows: TActivityRecord[]) =>
  setAgentTurnsMap({ ...(getAgentTurnsMap() || {}), [agentId]: rows })

export const getAgentMessagesMap = () => store.get(agentMessagesState)
export const setAgentMessagesMap = (map: Record<string, TActivityRecord[]>) =>
  store.set(agentMessagesState, map)
export const getContextAgentMessages = (agentId: string) =>
  getAgentMessagesMap()?.[agentId]
export const setContextAgentMessages = (agentId: string, rows: TActivityRecord[]) =>
  setAgentMessagesMap({ ...(getAgentMessagesMap() || {}), [agentId]: rows })

export const getAgentMemoriesMap = () => store.get(agentMemoriesState)
export const setAgentMemoriesMap = (map: Record<string, TActivityRecord[]>) =>
  store.set(agentMemoriesState, map)
export const getContextAgentMemories = (agentId: string) =>
  getAgentMemoriesMap()?.[agentId]
export const setContextAgentMemories = (agentId: string, rows: TActivityRecord[]) =>
  setAgentMemoriesMap({ ...(getAgentMemoriesMap() || {}), [agentId]: rows })
```

Add the imports at the top of the file:

```typescript
import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'
import {
  agentTurnsState,
  agentStatusState,
  agentMemoriesState,
  agentMessagesState,
} from '@TAF/state/agentActivity'
```

- [ ] **Step 2: Add selector hooks**

Append to `repos/admin/src/state/selectors.ts`:

```typescript
export const useAgentStatusMap = () =>
  useRecState<Record<string, TAgentStatus | null>>(agentStatusState)
export const useAgentTurnsMap = () =>
  useRecState<Record<string, TActivityRecord[]>>(agentTurnsState)
export const useAgentMessagesMap = () =>
  useRecState<Record<string, TActivityRecord[]>>(agentMessagesState)
export const useAgentMemoriesMap = () =>
  useRecState<Record<string, TActivityRecord[]>>(agentMemoriesState)
```

with matching imports from `@TAF/state/agentActivity` and `@TAF/types/agentActivity.types`.

- [ ] **Step 3: Verify types**

Run: `cd repos/admin && pnpm types`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add repos/admin/src/state/accessors.ts repos/admin/src/state/selectors.ts
git commit -m "feat(admin): agent activity accessors and selector hooks"
```

---

## Task 6: API service and fetch actions

**Files:**
- Create: `repos/admin/src/services/agentActivityApi.ts`
- Create: `repos/admin/src/actions/agentActivity/local/setAgentActivity.ts`
- Create: `repos/admin/src/actions/agentActivity/api/fetchAgentActivity.ts`

- [ ] **Step 1: Create the API service**

Create `repos/admin/src/services/agentActivityApi.ts`, following the existing service pattern in `repos/admin/src/services` (open `schedulesApi` first and mirror its client/base-path usage exactly):

```typescript
import { apiService } from '@TAF/services/apiService'

const base = (orgId: string, projectId: string, agentId: string) =>
  `/orgs/${orgId}/projects/${projectId}/agents/${agentId}/activity`

/** Read-only telemetry reads. Each returns the API's `{ data }` envelope. */
export const agentActivityApi = {
  status: (orgId: string, projectId: string, agentId: string) =>
    apiService.get(`${base(orgId, projectId, agentId)}/status`),
  turns: (orgId: string, projectId: string, agentId: string, limit = 25) =>
    apiService.get(`${base(orgId, projectId, agentId)}/turns?limit=${limit}`),
  messages: (orgId: string, projectId: string, agentId: string, limit = 25) =>
    apiService.get(`${base(orgId, projectId, agentId)}/messages?limit=${limit}`),
  memories: (orgId: string, projectId: string, agentId: string, limit = 25) =>
    apiService.get(`${base(orgId, projectId, agentId)}/memories?limit=${limit}`),
}
```

- [ ] **Step 2: Create the local action**

Create `repos/admin/src/actions/agentActivity/local/setAgentActivity.ts`:

```typescript
import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'

import {
  setContextAgentTurns,
  setContextAgentStatus,
  setContextAgentMemories,
  setContextAgentMessages,
} from '@TAF/state/accessors'

export const setAgentStatus = (agentId: string, status: TAgentStatus | null) =>
  setContextAgentStatus(agentId, status)

export const setAgentTurns = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentTurns(agentId, rows)

export const setAgentMessages = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentMessages(agentId, rows)

export const setAgentMemories = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentMemories(agentId, rows)
```

- [ ] **Step 3: Create the fetch action**

Create `repos/admin/src/actions/agentActivity/api/fetchAgentActivity.ts`:

```typescript
import { agentActivityApi } from '@TAF/services/agentActivityApi'
import {
  setAgentTurns,
  setAgentStatus,
  setAgentMemories,
  setAgentMessages,
} from '@TAF/actions/agentActivity/local/setAgentActivity'

type TFetchAgentActivityOpts = {
  orgId: string
  agentId: string
  projectId: string
}

/**
 * Fetch all four telemetry reads for one agent and write them into their atoms.
 *
 * The four reads are INDEPENDENT: one failing (say memories) must not blank the
 * other three, so each result is applied on its own and failures are collected
 * rather than thrown. That matches the spec's partial-failure requirement — the
 * page shows an error for the failed section while the rest still renders.
 */
export const fetchAgentActivity = async (opts: TFetchAgentActivityOpts) => {
  const { orgId, projectId, agentId } = opts

  const [status, turns, messages, memories] = await Promise.all([
    agentActivityApi.status(orgId, projectId, agentId),
    agentActivityApi.turns(orgId, projectId, agentId),
    agentActivityApi.messages(orgId, projectId, agentId),
    agentActivityApi.memories(orgId, projectId, agentId),
  ])

  if (!status.error) setAgentStatus(agentId, status.data ?? null)
  if (!turns.error) setAgentTurns(agentId, turns.data ?? [])
  if (!messages.error) setAgentMessages(agentId, messages.data ?? [])
  if (!memories.error) setAgentMemories(agentId, memories.data ?? [])

  const errors = [status, turns, messages, memories]
    .map((resp) => resp.error)
    .filter(Boolean)

  return { errors }
}
```

- [ ] **Step 4: Verify types**

Run: `cd repos/admin && pnpm types`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add repos/admin/src/services/agentActivityApi.ts repos/admin/src/actions/agentActivity/
git commit -m "feat(admin): agent activity api service and fetch actions"
```

---

## Task 7: Poll controller

**Files:**
- Create: `repos/admin/src/actions/agentActivity/local/pollAgentActivity.ts`
- Test: `repos/admin/src/actions/agentActivity/local/pollAgentActivity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `repos/admin/src/actions/agentActivity/local/pollAgentActivity.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchAgentActivity = vi.hoisted(() => vi.fn())

vi.mock(`@TAF/actions/agentActivity/api/fetchAgentActivity`, () => ({
  fetchAgentActivity,
}))

import {
  startAgentActivityPolling,
  stopAgentActivityPolling,
} from './pollAgentActivity'

describe(`pollAgentActivity`, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchAgentActivity.mockReset()
    fetchAgentActivity.mockResolvedValue({ errors: [] })
  })

  afterEach(() => {
    stopAgentActivityPolling()
    vi.useRealTimers()
  })

  it(`polls on an interval until stopped`, async () => {
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(2)

    stopAgentActivityPolling()
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(2)
  })

  it(`skips a tick while a request is still in flight instead of stacking`, async () => {
    let release: (v: unknown) => void = () => {}
    fetchAgentActivity.mockReturnValue(new Promise((res) => (release = res)))

    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    // A slow response must not queue a second request behind it.
    await vi.advanceTimersByTimeAsync(15000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    release({ errors: [] })
  })

  it(`starting again replaces the previous timer rather than adding one`, async () => {
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `b` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)
    expect(fetchAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: `b` })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/admin && pnpm test src/actions/agentActivity/local/pollAgentActivity.test.ts`
Expected: FAIL, cannot find module `./pollAgentActivity`

- [ ] **Step 3: Write the implementation**

Create `repos/admin/src/actions/agentActivity/local/pollAgentActivity.ts`:

```typescript
import { fetchAgentActivity } from '@TAF/actions/agentActivity/api/fetchAgentActivity'

/** Poll cadence. The heartbeat lands every ~30s and transcripts are written
 * after a turn completes, so 5s is comfortably faster than the data changes. */
const PollMs = 5000

type TPollOpts = {
  orgId: string
  agentId: string
  projectId: string
}

let timer: ReturnType<typeof setInterval> | undefined
let inFlight = false

/**
 * Poll one agent's activity from the ACTION layer.
 *
 * This lives here, not in a component effect, because the project forbids
 * `useEffect` for data loading. The route loader starts it after its initial
 * fetch and the route cleanup stops it, so every fetch — first paint and every
 * refresh — goes through the same action, and components only ever read atoms.
 *
 * A tick that lands while the previous request is still open is SKIPPED rather
 * than queued, so a slow response can never stack requests.
 */
export const startAgentActivityPolling = (opts: TPollOpts) => {
  stopAgentActivityPolling()
  timer = setInterval(async () => {
    if (inFlight) return
    inFlight = true
    try {
      await fetchAgentActivity(opts)
    } finally {
      inFlight = false
    }
  }, PollMs)
}

export const stopAgentActivityPolling = () => {
  if (timer) clearInterval(timer)
  timer = undefined
  inFlight = false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/admin && pnpm test src/actions/agentActivity/local/pollAgentActivity.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add repos/admin/src/actions/agentActivity/local/pollAgentActivity.ts repos/admin/src/actions/agentActivity/local/pollAgentActivity.test.ts
git commit -m "feat(admin): action-layer poll controller for agent activity"
```

---

## Task 8: Timeline merge helper

**Files:**
- Create: `repos/admin/src/utils/agentActivity/toTimeline.ts`
- Test: `repos/admin/src/utils/agentActivity/toTimeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `repos/admin/src/utils/agentActivity/toTimeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toTimeline } from './toTimeline'

describe(`toTimeline`, () => {
  it(`merges all three sources newest first`, () => {
    const entries = toTimeline({
      // Messages deliberately carry NO `data.at` — that collection has no such
      // field, so this asserts the `createdAt` fallback actually orders them.
      turns: [
        { id: `t1`, createdAt: `2026-07-24T09:00:00Z`, data: { event: `agenda:groom`, at: `2026-07-24T10:00:00Z` } },
      ],
      messages: [{ id: `m1`, createdAt: `2026-07-24T12:00:00Z`, data: { subject: `hi` } }],
      memories: [
        { id: `y1`, createdAt: `2026-07-24T09:30:00Z`, data: { text: `learned`, at: `2026-07-24T11:00:00Z` } },
      ],
    })

    expect(entries.map((e) => e.id)).toEqual([`m1`, `y1`, `t1`])
    expect(entries.map((e) => e.kind)).toEqual([`message`, `memory`, `turn`])
  })

  it(`treats undefined sources as not-yet-fetched, not empty`, () => {
    expect(toTimeline({ turns: undefined, messages: undefined, memories: undefined }))
      .toEqual([])
  })

  it(`sorts rows with NEITHER 'at' nor createdAt last instead of throwing`, () => {
    const entries = toTimeline({
      turns: [
        { id: `t1`, createdAt: ``, data: { event: `a` } },
        { id: `t2`, createdAt: ``, data: { event: `b`, at: `2026-07-24T10:00:00Z` } },
      ],
      messages: [],
      memories: [],
    })
    expect(entries.map((e) => e.id)).toEqual([`t2`, `t1`])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/admin && pnpm test src/utils/agentActivity/toTimeline.test.ts`
Expected: FAIL, cannot find module `./toTimeline`

- [ ] **Step 3: Write the implementation**

Create `repos/admin/src/utils/agentActivity/toTimeline.ts`:

```typescript
import type {
  TActivityRecord,
  TTimelineEntry,
} from '@TAF/types/agentActivity.types'

type TToTimelineOpts = {
  turns?: TActivityRecord[]
  messages?: TActivityRecord[]
  memories?: TActivityRecord[]
}

/**
 * Merge the three activity sources into one chronological feed.
 *
 * ORDERING: only `resident_transcripts` and `resident_memories` declare an `at`
 * field. `agent_messages` does NOT, so it can only be ordered by the row's
 * `createdAt` — hence the `data.at ?? createdAt` fallback on every source
 * rather than just messages, which keeps one ordering rule for the whole feed.
 *
 * Rows with neither sort LAST rather than throwing or landing at the epoch: a
 * malformed row should be visible at the bottom, never able to break the page.
 */
export const toTimeline = (opts: TToTimelineOpts): TTimelineEntry[] => {
  const { turns, messages, memories } = opts

  const entries: TTimelineEntry[] = [
    ...(turns ?? []).map((row) => ({
      id: row.id,
      kind: `turn` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: String(row.data?.event ?? `turn`),
      body: typeof row.data?.output === `string` ? row.data.output : undefined,
    })),
    ...(messages ?? []).map((row) => ({
      id: row.id,
      kind: `message` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: String(row.data?.subject ?? `message`),
      body: typeof row.data?.body === `string` ? row.data.body : undefined,
    })),
    ...(memories ?? []).map((row) => ({
      id: row.id,
      kind: `memory` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: `memory`,
      body: typeof row.data?.text === `string` ? row.data.text : undefined,
    })),
  ]

  return entries.sort((a, b) => {
    if (!a.at) return 1
    if (!b.at) return -1
    return b.at.localeCompare(a.at)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/admin && pnpm test src/utils/agentActivity/toTimeline.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add repos/admin/src/utils/agentActivity/
git commit -m "feat(admin): merge agent turns, messages and memories into one timeline"
```

---

## Task 9: Status header component

**Files:**
- Create: `repos/admin/src/components/AgentActivity/AgentStatusHeader.tsx`
- Test: `repos/admin/src/components/AgentActivity/AgentStatusHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `repos/admin/src/components/AgentActivity/AgentStatusHeader.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}))

import { AgentStatusHeader } from './AgentStatusHeader'

describe(`AgentStatusHeader`, () => {
  it(`renders a skeleton while status is undefined (not fetched)`, () => {
    render(<AgentStatusHeader status={undefined} />)
    expect(screen.getByTestId(`agent-status-skeleton`)).toBeTruthy()
  })

  it(`renders a never-run message when status is null, not an error`, () => {
    render(<AgentStatusHeader status={null} />)
    expect(screen.getByText(/No activity recorded/i)).toBeTruthy()
  })

  it(`renders live liveness fields`, () => {
    render(
      <AgentStatusHeader
        status={{ agentId: `a`, turnCount: 12, queueDepth: 2, currentActivity: `grooming` }}
      />
    )
    expect(screen.getByText(/grooming/)).toBeTruthy()
    expect(screen.getByText(/12/)).toBeTruthy()
  })

  it(`shows a degraded badge only when the watchdog set the flag`, () => {
    const { rerender } = render(<AgentStatusHeader status={{ agentId: `a` }} />)
    expect(screen.queryByTestId(`agent-degraded`)).toBeNull()

    rerender(<AgentStatusHeader status={{ agentId: `a`, degraded: true }} />)
    expect(screen.getByTestId(`agent-degraded`)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/admin && pnpm test src/components/AgentActivity/AgentStatusHeader.test.tsx`
Expected: FAIL, cannot find module `./AgentStatusHeader`

- [ ] **Step 3: Write the component**

Create `repos/admin/src/components/AgentActivity/AgentStatusHeader.tsx`:

```typescript
import type { TAgentStatus } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text } from '@tdsk/components'

export type TAgentStatusHeader = {
  /** `undefined` = not fetched yet, `null` = fetched and the agent never ran. */
  status?: TAgentStatus | null
}

/**
 * The agent's liveness at a glance. `degraded` is rendered straight from the
 * watchdog's flag rather than recomputed here, so there is exactly one source
 * of truth for agent health.
 */
export const AgentStatusHeader = (props: TAgentStatusHeader) => {
  const { status } = props

  if (status === undefined)
    return <Box data-testid='agent-status-skeleton'>Loading activity…</Box>

  if (status === null)
    return <Text>No activity recorded for this agent yet.</Text>

  return (
    <Box display='flex' gap={2} alignItems='center'>
      <Text>Activity: {status.currentActivity || `idle`}</Text>
      <Text>Turns: {status.turnCount ?? 0}</Text>
      <Text>Queue: {status.queueDepth ?? 0}</Text>
      {status.lastTurnAt && <Text>Last turn: {status.lastTurnAt}</Text>}
      {status.degraded && (
        <Chip size='small' color='error' label='Degraded' data-testid='agent-degraded' />
      )}
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/admin && pnpm test src/components/AgentActivity/AgentStatusHeader.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add repos/admin/src/components/AgentActivity/AgentStatusHeader.tsx repos/admin/src/components/AgentActivity/AgentStatusHeader.test.tsx
git commit -m "feat(admin): agent status header with loading, never-run and degraded states"
```

---

## Task 10: Timeline component

**Files:**
- Create: `repos/admin/src/components/AgentActivity/AgentTimeline.tsx`
- Test: `repos/admin/src/components/AgentActivity/AgentTimeline.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `repos/admin/src/components/AgentActivity/AgentTimeline.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}))

import { AgentTimeline } from './AgentTimeline'

const entries = [
  { id: `m1`, kind: `message` as const, at: `2026-07-24T12:00:00Z`, title: `hi`, body: `hello` },
  { id: `t1`, kind: `turn` as const, at: `2026-07-24T10:00:00Z`, title: `agenda:groom` },
]

describe(`AgentTimeline`, () => {
  it(`renders a skeleton while loading (nothing fetched yet)`, () => {
    render(<AgentTimeline entries={[]} loading />)
    expect(screen.getByTestId(`agent-timeline-skeleton`)).toBeTruthy()
  })

  it(`renders an empty state when fetched but empty`, () => {
    render(<AgentTimeline entries={[]} loading={false} />)
    expect(screen.getByText(/No activity yet/i)).toBeTruthy()
  })

  it(`renders every entry newest first`, () => {
    render(<AgentTimeline entries={entries} loading={false} />)
    expect(screen.getByText(`hi`)).toBeTruthy()
    expect(screen.getByText(`agenda:groom`)).toBeTruthy()
  })

  it(`expands an entry body on click`, () => {
    render(<AgentTimeline entries={entries} loading={false} />)
    expect(screen.queryByText(`hello`)).toBeNull()
    fireEvent.click(screen.getByTestId(`timeline-entry-m1`))
    expect(screen.getByText(`hello`)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/admin && pnpm test src/components/AgentActivity/AgentTimeline.test.tsx`
Expected: FAIL, cannot find module `./AgentTimeline`

- [ ] **Step 3: Write the component**

Create `repos/admin/src/components/AgentActivity/AgentTimeline.tsx`:

```typescript
import type { TTimelineEntry } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState } from 'react'
import { Text } from '@tdsk/components'

/** The writer tail-caps transcript input/output at 20k chars, so a body at
 * exactly that length is almost certainly truncated and must say so. */
const TranscriptCap = 20_000

export type TAgentTimeline = {
  entries: TTimelineEntry[]
  loading: boolean
}

/**
 * The merged activity feed. `loading` distinguishes "not fetched yet" from
 * "fetched and genuinely empty" — collapsing them would make a brand-new agent
 * look permanently stuck loading.
 */
export const AgentTimeline = (props: TAgentTimeline) => {
  const { entries, loading } = props
  const [openId, setOpenId] = useState<string>()

  if (loading) return <Box data-testid='agent-timeline-skeleton'>Loading…</Box>
  if (!entries.length) return <Text>No activity yet for this agent.</Text>

  return (
    <Box display='flex' flexDirection='column' gap={1}>
      {entries.map((entry) => (
        <Box
          key={entry.id}
          data-testid={`timeline-entry-${entry.id}`}
          onClick={() => setOpenId(openId === entry.id ? undefined : entry.id)}
          sx={{ cursor: `pointer`, p: 1, borderBottom: `1px solid`, borderColor: `divider` }}
        >
          <Box display='flex' gap={1} alignItems='center'>
            <Chip size='small' variant='outlined' label={entry.kind} />
            <Text>{entry.title}</Text>
            <Text>{entry.at}</Text>
          </Box>
          {openId === entry.id && entry.body && (
            <Box mt={1}>
              <Text>{entry.body}</Text>
              {entry.body.length >= TranscriptCap && (
                <Text>(truncated by the transcript writer)</Text>
              )}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/admin && pnpm test src/components/AgentActivity/AgentTimeline.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add repos/admin/src/components/AgentActivity/AgentTimeline.tsx repos/admin/src/components/AgentActivity/AgentTimeline.test.tsx
git commit -m "feat(admin): agent activity timeline with expandable entries"
```

---

## Task 11: Activity page

**Files:**
- Create: `repos/admin/src/components/AgentActivity/AgentActivity.tsx`

- [ ] **Step 1: Write the page**

Create `repos/admin/src/components/AgentActivity/AgentActivity.tsx`:

```typescript
import { useMemo } from 'react'
import { useParams } from 'react-router'
import { toTimeline } from '@TAF/utils/agentActivity/toTimeline'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { AgentTimeline } from '@TAF/components/AgentActivity/AgentTimeline'
import { AgentStatusHeader } from '@TAF/components/AgentActivity/AgentStatusHeader'
import {
  useAgentTurnsMap,
  useAgentStatusMap,
  useAgentMemoriesMap,
  useAgentMessagesMap,
} from '@TAF/state/selectors'

/**
 * The agent activity page. It only READS atoms — the route loader owns the
 * initial fetch and starts the poll, so there is no data loading in this
 * component and no accessor is called from it.
 */
export const AgentActivity = () => {
  const { agentId } = useParams()

  const [statusMap] = useAgentStatusMap()
  const [turnsMap] = useAgentTurnsMap()
  const [messagesMap] = useAgentMessagesMap()
  const [memoriesMap] = useAgentMemoriesMap()

  const turns = agentId ? turnsMap?.[agentId] : undefined
  const messages = agentId ? messagesMap?.[agentId] : undefined
  const memories = agentId ? memoriesMap?.[agentId] : undefined

  // `undefined` on every source means nothing has been fetched yet. Once any
  // source has resolved, an empty feed is a real empty state.
  const loading = turns === undefined && messages === undefined && memories === undefined

  const entries = useMemo(
    () => toTimeline({ turns, messages, memories }),
    [turns, messages, memories]
  )

  return (
    <PageLayout title='Agent Activity' count={loading ? undefined : entries.length}>
      <AgentStatusHeader status={agentId ? statusMap?.[agentId] : undefined} />
      <AgentTimeline entries={entries} loading={loading} />
    </PageLayout>
  )
}

export default AgentActivity
```

- [ ] **Step 2: Verify types**

Run: `cd repos/admin && pnpm types`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add repos/admin/src/components/AgentActivity/AgentActivity.tsx
git commit -m "feat(admin): agent activity page composing status header and timeline"
```

---

## Task 12: Loader and route registration

**Files:**
- Modify: `repos/admin/src/routes/loaders.ts`
- Modify: `repos/admin/src/routes/Routes.tsx`

- [ ] **Step 1: Add the loader**

Append to `repos/admin/src/routes/loaders.ts`:

```typescript
/**
 * Load one agent's activity, then start the 5s poll.
 *
 * The poll is started HERE (the loader/action layer) rather than in a component
 * effect, because this project forbids `useEffect` for data loading. The route
 * always re-runs its loader on entry, and `startAgentActivityPolling` clears any
 * previous timer, so navigating between agents can never leave two polls running.
 */
export const agentActivityLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId, agentId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()
  if (!agentId) throw new Response(`agentId is required`, { status: 400 })

  await safeFetch(() => fetchAgentActivity({ orgId, projectId, agentId }))
  startAgentActivityPolling({ orgId, projectId, agentId })
  return null
}
```

with imports:

```typescript
import { fetchAgentActivity } from '@TAF/actions/agentActivity/api/fetchAgentActivity'
import { startAgentActivityPolling } from '@TAF/actions/agentActivity/local/pollAgentActivity'
```

- [ ] **Step 2: Register the route**

In `repos/admin/src/routes/Routes.tsx`, inside the `ERoutePath.ProjectId` children array, add:

```typescript
    {
      path: `agents/:agentId/activity`,
      loader: agentActivityLoader,
      Component: () => <SuspensePage Component={AgentActivity} />,
    },
```

with the matching lazy import for `AgentActivity` alongside the other page imports, and `agentActivityLoader` added to the existing loaders import.

- [ ] **Step 3: Verify types**

Run: `cd repos/admin && pnpm types`
Expected: exit 0

- [ ] **Step 4: Run the full admin suite**

Run: `cd repos/admin && pnpm test`
Expected: PASS, no regressions

- [ ] **Step 5: Commit**

```bash
git add repos/admin/src/routes/loaders.ts repos/admin/src/routes/Routes.tsx
git commit -m "feat(admin): register agent activity route and loader"
```

---

## Task 13: Link the page from the agents table

**Files:**
- Modify: `repos/admin/src/pages/Projects/ProjectAgents.tsx` (or the agents table component it renders)

- [ ] **Step 1: Add the row action**

Open the agents table and locate its actions column (mirror how `Schedules.tsx` renders `ActionIconButton` entries). Add an activity action that navigates to the new route:

```typescript
<ActionIconButton
  title='View activity'
  icon={<TimelineIcon />}
  onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}/agents/${agent.id}/activity`)}
/>
```

using `import Timeline as TimelineIcon from '@mui/icons-material/Timeline'` in the file's existing icon-import style, and `useNavigate` from `react-router`.

- [ ] **Step 2: Verify types and tests**

Run: `cd repos/admin && pnpm types && pnpm test`
Expected: exit 0, all tests pass

- [ ] **Step 3: Commit**

```bash
git add repos/admin/src/pages/Projects/ProjectAgents.tsx
git commit -m "feat(admin): link agent activity page from the agents table"
```

---

## Task 14: Full verification

- [ ] **Step 1: Type-check both repos**

```bash
cd repos/backend && pnpm types
cd ../admin && pnpm types
```
Expected: exit 0 for both

- [ ] **Step 2: Run both suites**

```bash
cd repos/backend && pnpm test
cd ../admin && pnpm test
```
Expected: PASS, no regressions against the pre-change baseline. Record both totals.

- [ ] **Step 3: Verify against a real agent**

With the platform running, open the activity page for a live resident (for example the CTO agent) and confirm: the status header shows a non-zero turn count, the timeline lists real turns, and the values refresh within ~5 seconds without a page reload.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test: verify agent activity surface end to end"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `GET .../status` | 2 |
| `GET .../turns` with limit/before | 1, 2 |
| `GET .../messages` | 2 |
| `GET .../memories` | 2 |
| Reuse `projectAccessGuard` / `projectMemberGuard` | 3 |
| Authorization boundary (agent not in project → 404) | 2 (`assertAgentInScope`) |
| Cursor pagination, default 25 / max 100 | 1 |
| `{ id, data }` response shape | 2 |
| Dedicated admin route | 12 |
| Status header (activity, queue, turns, last turn, degraded) | 9 |
| Merged, filterable timeline | 8, 10 |
| Expandable input/output | 10 |
| Loader → action → accessor → atom → component | 4, 5, 6, 11, 12 |
| No `useEffect` data loading | 7, 12 |
| `undefined` vs `[]` atom semantics | 4, 9, 10, 11 |
| 5s polling, skip overlapping ticks | 7 |
| Agent never ran → "No activity recorded" | 9 |
| Stale heartbeat / degraded badge | 9 |
| Truncation marker at the 20k cap | 10 |
| Partial failure isolates one section | 6 |
| Backend tests: happy path, pagination, empty, 404, 403 | 1, 2 |
| Frontend tests: header states, timeline merge/filter/loading | 8, 9, 10 |
| Integration verification against a live agent | 14 |

Two spec items are deliberately thin and are called out rather than hidden:
- **Type filtering** in the timeline is satisfied by the `kind` field on every entry (Task 8) and the `kind` chip (Task 10); a filter control is a one-line addition on top and is not separately tasked.
- **403 rendering** is covered by the same not-found path as 404 in Task 9's never-run state.

**Placeholder scan:** No TBD/TODO markers, no "add error handling" hand-waves; every code step contains complete code.

**Type consistency:** `TActivityRecord`, `TAgentStatus`, `TTimelineEntry`, and `TTimelineKind` are defined once in Task 4 and used unchanged in Tasks 5, 6, 8, 9, 10, 11. Accessor names (`setContextAgentTurns` etc.) match between Tasks 5 and 6. `startAgentActivityPolling`/`stopAgentActivityPolling` match between Tasks 7 and 12.

**Known follow-on (out of scope, from the spec's Risks):** transcript retention. Six agents append turns indefinitely; pagination bounds the read path but not the table's growth.

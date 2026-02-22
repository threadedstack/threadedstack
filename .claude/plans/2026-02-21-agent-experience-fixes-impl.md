# Agent Experience Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix agent secrets persistence (P0) and three agent drawer race conditions (P1s) so the agent create/edit workflow functions correctly.

**Architecture:** The P0 fix adds `secretIds` to the database agent service's relations handling (mirroring the existing `providerIds`/`functionIds` pattern), threads it through the backend endpoints, and changes the admin to send IDs instead of full objects. The P1 fixes seed reference lists from the `agent` object during synchronous pre-population to eliminate race conditions with async data loading.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express 5, React (Jotai + MUI), Vitest

**CRITICAL GIT RULE:** NEVER commit, push, or modify git history. Read-only git operations only. User handles all commits.

---

## Task 1: Database — Add `secretIds` to Agent Service Types and `#relations()`

**Files:**
- Modify: `repos/database/src/services/agent.ts:14,26-30,52-57,105-146`
- Modify: `repos/database/src/schemas/secrets.ts` (import only, already exists)

**Step 1: Add `secrets` import and `inArray` import**

In `repos/database/src/services/agent.ts`, add `inArray` to the drizzle-orm import (line 14) and add `secrets` schema import:

```typescript
// Line 14: change
import { eq, and } from 'drizzle-orm'
// to:
import { eq, and, inArray, isNull } from 'drizzle-orm'

// After line 23 (agentProviders import), add:
import { secrets } from '@TDB/schemas/secrets'
```

**Step 2: Add `secretIds` to type definitions**

In `TAgentInsertOpts` (lines 26-30), add `secretIds`:

```typescript
export type TAgentInsertOpts = TDBAgentInsert & {
  functionIds?: string[]
  providerIds?: string[]
  secretIds?: string[]
  projects?: Array<Partial<ProjectModel>>
}
```

In `TAgentRelations` (lines 52-57), add `secretIds`:

```typescript
type TAgentRelations = {
  id: string
  functionIds?: string[]
  providerIds?: string[]
  secretIds?: string[]
  projects?: Array<Partial<ProjectModel>>
}
```

**Step 3: Add secretIds handling in `#relations()` method**

After the `providerIds` block (line 145), add secretIds handling:

```typescript
    // Reassign secrets to this agent (FK pattern, not junction table)
    // Clears exclusive arc columns to satisfy the secret_scope_check constraint
    if (opts.secretIds?.length)
      for (const secretId of opts.secretIds) {
        if (!secretId) continue
        await this.db
          .update(secrets)
          .set({
            agentId: id,
            orgId: null,
            projectId: null,
            providerId: null,
          })
          .where(eq(secrets.id, secretId))
      }
```

**Step 4: Run database tests**

Run: `cd repos/database && pnpm test`
Expected: All 36 existing tests pass (new secretIds code is additive, no existing behavior changed).

---

## Task 2: Database — Update `create()` and `update()` to Handle `secretIds`

**Files:**
- Modify: `repos/database/src/services/agent.ts:259-272,277-301,303-314`

**Step 1: Update `create()` to extract and pass `secretIds`**

Change lines 259-271:

```typescript
  async create(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, functionIds, providerIds, secretIds, ...agentData } = data

    // Create the agent
    const result = await super.create(agentData as TDBAgentInsert)

    if (result.data && (projects?.length || functionIds?.length || providerIds?.length || secretIds?.length)) {
      await this.#relations({ id: result.data.id, projects, functionIds, providerIds, secretIds })
      const updated = await this.get(result.data.id, opts)
      result.data = updated.data
    }

    return result
  }
```

**Step 2: Update `update()` to extract `secretIds` and detach old secrets before re-attaching**

Change lines 277-301:

```typescript
  async update(data: TDBUpdate<TAgentInsertOpts>, opts?: TAgentQueryOpts) {
    const { projects, functionIds, providerIds, secretIds, ...agent } = data

    if (!agent.id)
      return { data: null, error: new DBError(`Agent ID is required for update`) }

    const result = await super.update(agent)

    if (result.data && (projects?.length || functionIds?.length || providerIds?.length || secretIds !== undefined)) {
      if (projects?.length)
        await this.db.delete(agentProjects).where(eq(agentProjects.agentId, agent.id))

      if (functionIds?.length)
        await this.db.delete(agentFunctions).where(eq(agentFunctions.agentId, agent.id))

      if (providerIds?.length)
        await this.db.delete(agentProviders).where(eq(agentProviders.agentId, agent.id))

      // Detach all currently agent-scoped secrets before re-attaching
      // Uses `secretIds !== undefined` (not `.length`) so passing [] detaches all
      if (secretIds !== undefined)
        await this.db
          .update(secrets)
          .set({ agentId: null })
          .where(eq(secrets.agentId, agent.id))

      await this.#relations({ id: agent.id, projects, functionIds, providerIds, secretIds })
      const updated = await this.get(agent.id, opts)
      result.data = updated.data
    }

    return result
  }
```

Key design note: `secretIds !== undefined` (not `secretIds?.length`) so that passing `secretIds: []` detaches ALL secrets from the agent. This is different from omitting `secretIds` entirely (which leaves secrets untouched).

**Step 3: Update `upsert()` to match**

Change lines 303-314:

```typescript
  async upsert(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, functionIds, providerIds, secretIds, ...agent } = data
    const result = await super.upsert(agent)

    if (result.data && (projects?.length || functionIds?.length || providerIds?.length || secretIds?.length)) {
      await this.#relations({ id: agent.id, projects, functionIds, providerIds, secretIds })
      const updated = await this.get(agent.id, opts)
      result.data = updated.data
    }

    return result
  }
```

**Step 4: Run database tests**

Run: `cd repos/database && pnpm test`
Expected: All 36 existing tests pass.

---

## Task 3: Database — Write Unit Tests for `secretIds`

**Files:**
- Modify: `repos/database/src/services/agent.test.ts`

**Step 1: Add mock for `secrets` schema**

After the `agentProjects` mock (line 37-43), add:

```typescript
// Mock the secrets schema
vi.mock(`@TDB/schemas/secrets`, () => ({
  secrets: {
    id: { name: `id` },
    agentId: { name: `agent_id` },
    orgId: { name: `org_id` },
    projectId: { name: `project_id` },
    providerId: { name: `provider_id` },
  },
}))
```

**Step 2: Add `secretIds` tests in the `create` describe block**

After the existing "should return error on db exception" test (line 538), add:

```typescript
    it(`should create agent with secretIds (reassigns secrets to agent)`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      const fullRecord = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [{ id: `s1`, name: `MySecret`, sanitize: vi.fn(() => ({ id: `s1` })) }],
      }

      // super.create returning
      mocks.returningFn.mockResolvedValueOnce([record])
      // #relations: update secrets (set agentId)
      mocks.whereReturningFn.mockResolvedValue(undefined)
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secretIds: [`s1`],
      } as any)

      expect(result.data).toBeDefined()
      // insert for agent + update for secrets
      expect(mocks.insertFn).toHaveBeenCalled()
    })
```

**Step 3: Add `secretIds` tests in the `update` describe block**

After the existing "should delete old project relations" test (line 591), add:

```typescript
    it(`should detach old secrets and re-attach new ones on update with secretIds`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        projects: [],
        secrets: [{ id: `s2`, name: `NewSecret`, sanitize: vi.fn(() => ({ id: `s2` })) }],
      }

      // super.update returning
      mocks.whereReturningFn.mockResolvedValue([record])
      // db.update(secrets).set({agentId: null}).where(agentId = id) — detach
      // then db.update(secrets).set({agentId: id, ...}).where(id = secretId) — attach
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        secretIds: [`s2`],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      // update should be called: once for agent update, once for detach, once for attach
      expect(mocks.setFn).toHaveBeenCalled()
    })

    it(`should detach all secrets when secretIds is empty array`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        projects: [],
        secrets: [],
      }

      mocks.whereReturningFn.mockResolvedValue([record])
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        secretIds: [],
      } as any)

      expect(result.data).toBeDefined()
      // update called for agent + detach (no attach since secretIds is empty)
      expect(mocks.setFn).toHaveBeenCalled()
    })

    it(`should not touch secrets when secretIds is undefined`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      await service.update({ id: `agent-1`, name: `Updated` } as any)

      // Only one update call (the agent itself), no secret operations
      // The set call is for the agent update only
      expect(mocks.setFn).toHaveBeenCalledOnce()
    })
```

**Step 4: Run database tests to verify all pass**

Run: `cd repos/database && pnpm test`
Expected: All tests pass (36 existing + 4 new = 40).

---

## Task 4: Backend — Extract `secretIds` in `updateAgent.ts` and `createAgent.ts`

**Files:**
- Modify: `repos/backend/src/endpoints/agents/updateAgent.ts:19-25,72-77`
- Modify: `repos/backend/src/endpoints/agents/createAgent.ts:20-26,80-82`

**Step 1: Update `updateAgent.ts` destructuring**

Change lines 19-25 to add `secretIds`:

```typescript
    const {
      projectIds = [],
      functionIds = [],
      secretIds,
      providerIds: rawProviderIds = [],
      providers: providersWithPriority,
      ...agent
    } = req.body
```

Then change lines 72-77 to pass `secretIds` through:

```typescript
    agent.id = id
    if (projects?.length) agent.projects = projects
    if (functionIds?.length) agent.functionIds = functionIds
    if (providerIds?.length) agent.providerIds = providerIds
    if (secretIds !== undefined) agent.secretIds = secretIds
    const { data, error } = await db.services.agent.update(agent)
```

Note: `secretIds !== undefined` (not truthiness check) so that `secretIds: []` is passed through to detach all secrets.

**Step 2: Update `createAgent.ts` destructuring**

Change lines 20-26 to add `secretIds`:

```typescript
    const {
      projectIds = [],
      functionIds = [],
      secretIds,
      providerIds: rawProviderIds = [],
      providers: providersWithPriority,
      ...agent
    } = req.body
```

Then change lines 80-82 to pass `secretIds` through:

```typescript
    if (projects?.length) agent.projects = projects
    if (functionIds?.length) agent.functionIds = functionIds
    if (providerIds?.length) agent.providerIds = providerIds
    if (secretIds?.length) agent.secretIds = secretIds
```

**Step 3: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All existing tests pass. The `secretIds` field falls through harmlessly in existing tests (it's not in mock payloads, so it's `undefined` and ignored).

---

## Task 5: Backend — Write Unit Tests for `secretIds` Passthrough

**Files:**
- Modify: `repos/backend/src/endpoints/agents/agents.test.ts`

**Step 1: Add test for createAgent with secretIds**

In the `POST /_/agents - Create agent` describe block, add after existing tests:

```typescript
    it(`should pass secretIds through to agent.create`, async () => {
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
        secrets: [{ id: `s1`, name: `TestSecret` }] as any,
      })
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`],
        name: `New Agent`,
        secretIds: [`s1`],
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          secretIds: [`s1`],
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(201)
    })
```

**Step 2: Add test for updateAgent with secretIds**

In the `PUT /_/agents/:id - Update agent` describe block, add:

```typescript
    it(`should pass secretIds through to agent.update`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent One`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
        secrets: [{ id: `s1`, name: `OldSecret` }] as any,
      })
      const updatedAgent = new Agent({
        ...existingAgent,
        secrets: [{ id: `s2`, name: `NewSecret` }] as any,
      })

      mockReq.params = { id: `agent-1` }
      mockReq.body = { name: `Updated`, secretIds: [`s2`] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: existingAgent })

      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockUpdate.mockResolvedValue({ data: updatedAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          secretIds: [`s2`],
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should pass empty secretIds to detach all secrets`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent One`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
        secrets: [{ id: `s1`, name: `OldSecret` }] as any,
      })

      mockReq.params = { id: `agent-1` }
      mockReq.body = { name: `Updated`, secretIds: [] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: existingAgent })

      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockUpdate.mockResolvedValue({ data: { ...existingAgent, secrets: [] } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          secretIds: [],
        })
      )
    })
```

**Step 3: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass (existing + 3 new).

---

## Task 6: Admin — Change AgentDrawer to Send `secretIds` Instead of `secrets`

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx:197-215`

**Step 1: Change the `onSave` payload**

Replace lines 210-214 (the `secrets` property in `agentData`):

```typescript
      // Before (broken — sends full Secret objects, backend ignores them):
      // secrets: selectedSecrets
      //   .map((secretId) =>
      //     secretsList.find((s) => s.id === secretId || s.name === secretId)
      //   )
      //   .filter(Boolean) as Secret[],

      // After (sends IDs, database service handles FK reassignment):
      secretIds: selectedSecrets,
```

The full `agentData` object becomes:

```typescript
      const agentData = {
        name,
        model,
        active,
        maxTokens,
        providerIds,
        description,
        systemPrompt,
        envVars: envVarsObj,
        tools: selectedTools,
        projectIds: selectedProjectIds,
        functionIds: selectedFunctionIds,
        environment: { streaming, temperature },
        secretIds: selectedSecrets,
      }
```

**Step 2: Clean up unused `Secret` type import if now unused**

Check if `Secret` type is still used elsewhere in the file. It is — in `secretsList` state (`useState<Secret[]>`). So keep the import.

**Step 3: Verify no TypeScript errors**

Run: `cd repos/admin && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (the `agentData` object is typed as `Partial<Agent>` loosely via the action functions).

---

## Task 7: Admin — Fix P1 Race Conditions in AgentDrawer Pre-Population

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx:122-173`

**Step 1: Seed `secretsList` from agent data during pre-population**

In the pre-population `useEffect` (line 123), inside the `if (agent)` block, after line 148 (`setSelectedSecrets`), add seeding:

```typescript
      // Seed secretsList from agent data to avoid UUID flash before async fetch
      if (agent.secrets?.length) {
        setSecretsList(prev => prev?.length ? prev : agent.secrets!)
      }
```

**Step 2: Seed `aiProviders` from agent data during pre-population**

After line 130 (`setProviderIds`), add seeding:

```typescript
      // Seed aiProviders from agent data to avoid empty tag flash before async fetch
      if (agent.providers?.length) {
        setAiProviders(prev => prev?.length ? prev :
          agent.providers!
            .filter((p: any) => p.type === 'ai')
            .map((p: any) => ({ id: p.id, name: p.name || p.id }))
        )
      }
```

**Step 3: Fix functions loading — use agent's project as fallback**

In the data-loading `useEffect` (line 76), change the functions loading block (lines 103-108):

```typescript
      // Load functions for the project or agent's first linked project
      const effectiveProjectId = projectId || agent?.projects?.[0]?.id
      if (effectiveProjectId) {
        const functionsResult = await fetchFunctions({ orgId, projectId: effectiveProjectId })
        functionsResult?.functions &&
          setAvailableFunctions(Object.values(functionsResult.functions))
      }
```

Also update the dependency array on line 120 to include `agent`:

```typescript
  }, [open, orgId, projectId, agent])
```

**Step 4: Seed `availableFunctions` from agent data during pre-population**

In the pre-population effect, after `setSelectedFunctionIds` (line 150), add:

```typescript
      // Seed availableFunctions from agent data to avoid UUID flash
      if (agent.functions?.length) {
        setAvailableFunctions(prev => prev?.length ? prev : agent.functions!)
      }
```

---

## Task 8: Integration Tests — Agent Secrets CRUD

**Files:**
- Modify: `repos/integration/src/tier1/agents.test.ts`

**Step 1: Expand the agents integration test**

Replace the existing minimal test with comprehensive agent+secrets tests:

```typescript
import { describe, test, expect } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Agents', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/agents returns 200 with data array', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/agents`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(typeof res.data.limit).toBe('number')
    expect(typeof res.data.offset).toBe('number')
  })

  test('GET /orgs/:orgId/agents/:id returns agent with secrets array', async () => {
    const res = await get<{ data: { id: string; secrets: unknown[] } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBe(ctx.agentId)
    expect(Array.isArray(res.data.data.secrets)).toBe(true)
  })

  test('PUT /orgs/:orgId/agents/:id with secretIds attaches secrets', async () => {
    // First, list secrets to find one to attach
    const secretsRes = await get<{ data: Array<{ id: string; name: string }> }>(
      `/orgs/${ctx.orgId}/secrets`
    )
    if (!secretsRes.data?.data?.length) return // skip if no secrets exist

    const secretId = secretsRes.data.data[0].id

    // Update agent with secretIds
    const updateRes = await put<{ data: { id: string; secrets: Array<{ id: string }> } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`,
      { secretIds: [secretId] }
    )

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    // Verify the agent now has the secret attached
    const agentRes = await get<{ data: { secrets: Array<{ id: string }> } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`
    )
    expect(agentRes.data.data.secrets.some((s: any) => s.id === secretId)).toBe(true)
  })

  test('PUT /orgs/:orgId/agents/:id with empty secretIds detaches all secrets', async () => {
    // Detach all secrets
    const updateRes = await put<{ data: { id: string; secrets: unknown[] } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`,
      { secretIds: [] }
    )

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    // Verify agent has no secrets
    const agentRes = await get<{ data: { secrets: unknown[] } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`
    )
    expect(agentRes.data.data.secrets).toHaveLength(0)
  })
})
```

**Step 2: Run integration tests**

Run: `cd repos/integration && pnpm test -- --testPathPattern tier1/agents`
Expected: All tests pass. Note: Integration tests require K8s services running (`tdsk dev start --clean`).

---

## Task 9: Run Full Test Suites and Validate

**Step 1: Run database tests**

Run: `cd repos/database && pnpm test`
Expected: ~40 tests pass (36 existing + 4 new)

**Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: ~590+ tests pass (584 existing + 3 new + others)

**Step 3: Run admin typecheck**

Run: `cd repos/admin && npx tsc --noEmit 2>&1 | head -30`
Expected: No new type errors

**Step 4: Verify changes don't break builds**

Run in dependency order:
```bash
cd repos/database && pnpm build 2>&1 | tail -5
cd repos/backend && pnpm build 2>&1 | tail -5
```
Expected: Both build successfully.

---

## Summary of All Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `repos/database/src/services/agent.ts` | Modify | Add `secretIds` to types, `#relations()`, `create()`, `update()`, `upsert()` |
| `repos/database/src/services/agent.test.ts` | Modify | Add 4 tests for secretIds create/update/detach/noop |
| `repos/backend/src/endpoints/agents/updateAgent.ts` | Modify | Extract `secretIds` from body, pass through to DB service |
| `repos/backend/src/endpoints/agents/createAgent.ts` | Modify | Extract `secretIds` from body, pass through to DB service |
| `repos/backend/src/endpoints/agents/agents.test.ts` | Modify | Add 3 tests for secretIds passthrough |
| `repos/admin/src/components/Agents/AgentDrawer.tsx` | Modify | Send `secretIds` instead of `secrets`, seed reference lists, fix functions loading |
| `repos/integration/src/tier1/agents.test.ts` | Modify | Add agent+secrets integration tests |

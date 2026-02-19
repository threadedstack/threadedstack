import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

/**
 * Tier 1: Agent-Functions Relationship
 *
 * Tests the relationship between Agents and Functions via the `agentId`
 * foreign key on functions. Verifies linking, listing, and cascade deletion
 * when an agent is removed (DB-level `onDelete: cascade`).
 */

interface QuickstartResult {
  provider: { id: string }
  secret: { id: string }
  project: { id: string }
  agent: { id: string }
  endpoint: { id: string }
}

interface FunctionRecord {
  id: string
  name: string
  agentIds: string[]
  projectId: string
  [key: string]: unknown
}

const functionContent = `export default async function handler(request, context) {
  return { body: { message: 'agent function test' } }
}`

describe('Tier 1: Agent-Functions Relationship', () => {
  const ctx = readContext()
  const timestamp = Date.now()

  let setupFailed = false
  let quickstart: QuickstartResult | undefined
  let linkedFunctionId1: string | undefined
  let linkedFunctionId2: string | undefined
  let unlinkedFunctionId: string | undefined

  // Helper to build the functions base path for the quickstart project
  const functionsPath = () =>
    `/orgs/${ctx.orgId}/projects/${quickstart!.project.id}/functions`

  beforeAll(async () => {
    try {
      const res = await post<{ data: QuickstartResult }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'anthropic',
          apiKey: 'sk-test-fake-key-agent-fn',
          projectName: `AgentFn Project ${timestamp}`,
          agentName: `AgentFn Agent ${timestamp}`,
        }
      )

      if (res.status !== 201 || !res.data?.data) {
        setupFailed = true
        return
      }

      quickstart = res.data.data
    } catch {
      setupFailed = true
    }
  })

  afterAll(async () => {
    // Clean up functions first (children), then parent resources
    if (unlinkedFunctionId && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/functions/${unlinkedFunctionId}`)
    }
    // Linked functions may already be cascade-deleted by agent deletion,
    // but tryDelete is best-effort so it's safe to attempt anyway
    if (linkedFunctionId1 && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/functions/${linkedFunctionId1}`)
    }
    if (linkedFunctionId2 && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/functions/${linkedFunctionId2}`)
    }

    // Clean up quickstart resources in dependency order
    if (quickstart?.endpoint?.id && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/endpoints/${quickstart.endpoint.id}`)
    }
    if (quickstart?.agent?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstart.agent.id}`)
    }
    if (quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}`)
    }
    if (quickstart?.secret?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstart.secret.id}`)
    }
    if (quickstart?.provider?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstart.provider.id}`)
    }
  })

  test('creates function linked to agent via agentId', async (context) => {
    if (setupFailed || !quickstart) {
      context.skip()
      return
    }

    const res = await post<{ data: FunctionRecord }>(functionsPath(), {
      name: `Linked Function 1 ${timestamp}`,
      content: functionContent,
      agentId: quickstart.agent.id,
    })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeDefined()

    linkedFunctionId1 = res.data.data.id
  })

  test('linked function has correct agentId', async (context) => {
    if (setupFailed || !linkedFunctionId1) {
      context.skip()
      return
    }

    const res = await get<{ data: FunctionRecord }>(
      `${functionsPath()}/${linkedFunctionId1}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data.agentIds).toContain(quickstart!.agent.id)
  })

  test('creates second function linked to same agent', async (context) => {
    if (setupFailed || !quickstart) {
      context.skip()
      return
    }

    const res = await post<{ data: FunctionRecord }>(functionsPath(), {
      name: `Linked Function 2 ${timestamp}`,
      content: functionContent,
      agentId: quickstart.agent.id,
    })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeDefined()

    linkedFunctionId2 = res.data.data.id
  })

  test('lists functions for project includes agent-linked functions', async (context) => {
    if (setupFailed || !linkedFunctionId1 || !linkedFunctionId2) {
      context.skip()
      return
    }

    const res = await get<{ data: FunctionRecord[]; limit: number; offset: number }>(
      functionsPath()
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    const ids = res.data.data.map((fn) => fn.id)
    expect(ids).toContain(linkedFunctionId1)
    expect(ids).toContain(linkedFunctionId2)
  })

  test('both functions reference the same agent', async (context) => {
    if (setupFailed || !linkedFunctionId1 || !linkedFunctionId2) {
      context.skip()
      return
    }

    const [res1, res2] = await Promise.all([
      get<{ data: FunctionRecord }>(`${functionsPath()}/${linkedFunctionId1}`),
      get<{ data: FunctionRecord }>(`${functionsPath()}/${linkedFunctionId2}`),
    ])

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res1.data.data.agentIds).toContain(quickstart!.agent.id)
    expect(res2.data.data.agentIds).toContain(quickstart!.agent.id)
    expect(res1.data.data.agentIds).toEqual(res2.data.data.agentIds)
  })

  test('creates unlinked function (no agentId)', async (context) => {
    if (setupFailed || !quickstart) {
      context.skip()
      return
    }

    const res = await post<{ data: FunctionRecord }>(functionsPath(), {
      name: `Unlinked Function ${timestamp}`,
      content: functionContent,
    })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeDefined()

    unlinkedFunctionId = res.data.data.id
  })

  test('unlinked function has no agentId', async (context) => {
    if (setupFailed || !unlinkedFunctionId) {
      context.skip()
      return
    }

    const res = await get<{ data: FunctionRecord }>(
      `${functionsPath()}/${unlinkedFunctionId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    const agentIds = res.data.data.agentIds
    expect(!agentIds || agentIds.length === 0).toBe(true)
  })

  test('deleting agent removes agent link from functions', async (context) => {
    if (setupFailed || !quickstart || !linkedFunctionId1 || !linkedFunctionId2) {
      context.skip()
      return
    }

    // Delete the agent
    const deleteRes = await del(`/orgs/${ctx.orgId}/agents/${quickstart.agent.id}`)
    expect(deleteRes.status).toBe(200)

    // Functions should still exist but no longer be linked to the agent
    // (junction table rows are cascade-deleted, not the functions themselves)
    const res1 = await get<{ data: FunctionRecord }>(
      `${functionsPath()}/${linkedFunctionId1}`
    )
    expect(res1.status).toBe(200)
    expect(!res1.data.data.agentIds || res1.data.data.agentIds.length === 0).toBe(true)

    const res2 = await get<{ data: FunctionRecord }>(
      `${functionsPath()}/${linkedFunctionId2}`
    )
    expect(res2.status).toBe(200)
    expect(!res2.data.data.agentIds || res2.data.data.agentIds.length === 0).toBe(true)

    // Mark agent as deleted so afterAll doesn't try to re-delete it
    quickstart.agent.id = ''
  })

  test('unlinked function survives agent deletion', async (context) => {
    if (setupFailed || !unlinkedFunctionId) {
      context.skip()
      return
    }

    const res = await get<{ data: FunctionRecord }>(
      `${functionsPath()}/${unlinkedFunctionId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data.id).toBe(unlinkedFunctionId)
  })
})

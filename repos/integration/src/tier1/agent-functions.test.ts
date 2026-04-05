import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Agent-Functions Relationship
 *
 * Tests the relationship between Agents and Functions via the
 * `agentProjects.functionIds` field. Functions are linked to agents
 * per-project through the agent project config override mechanism.
 *
 * Verifies:
 * - Linking functions to agents via PUT project config `functionIds`
 * - Reading back functionIds from project config
 * - Unlinking functions by updating functionIds
 * - Function survives agent deletion (functions are project-scoped)
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
  projectId: string
  [key: string]: unknown
}

const functionContent = `export default async function handler(request, context) {
  return { body: { message: 'agent function test' } }
}`

describe('Tier 1: Agent-Functions Relationship', () => {
  const ctx = readContext()

  let setupFailed = false
  let quickstart: QuickstartResult | undefined
  let functionId1: string | undefined
  let functionId2: string | undefined
  let unlinkedFunctionId: string | undefined

  // Helper to build the functions base path for the quickstart project
  const functionsPath = () =>
    `/orgs/${ctx.orgId}/projects/${quickstart!.project.id}/functions`

  const configPath = () =>
    `/orgs/${ctx.orgId}/projects/${quickstart!.project.id}/agents/${quickstart!.agent.id}/config`

  beforeAll(async () => {
    try {
      const res = await post<QuickstartResult>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'anthropic',
          apiKey: 'sk-test-fake-key-agent-fn',
          projectName: uniqueName('AgentFn Project'),
          agentName: uniqueName('AgentFn Agent'),
        }
      )

      if (res.status !== 201 || !res.data) {
        setupFailed = true
        return
      }

      quickstart = res.data
    } catch {
      setupFailed = true
    }
  })

  afterAll(async () => {
    // Clean up functions first (children), then parent resources
    if (unlinkedFunctionId && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/functions/${unlinkedFunctionId}`)
    }
    if (functionId1 && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/functions/${functionId1}`)
    }
    if (functionId2 && quickstart?.project?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstart.project.id}/functions/${functionId2}`)
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

  test('creates function in project', async (context) => {
    if (setupFailed || !quickstart) {
      context.skip()
      return
    }

    const res = await post<FunctionRecord>(functionsPath(), {
      name: uniqueName('Linked Function 1'),
      content: functionContent,
    })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    functionId1 = res.data.id
  })

  test('links function to agent via project config functionIds', async (context) => {
    if (setupFailed || !functionId1) {
      context.skip()
      return
    }

    const res = await put<Record<string, any>>(configPath(), {
      functionIds: [functionId1],
    })

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('project config shows linked functionIds', async (context) => {
    if (setupFailed || !functionId1) {
      context.skip()
      return
    }

    const res = await get<{ functionIds: string[] }>(configPath())

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.functionIds).toContain(functionId1)
  })

  test('creates second function and links both to agent', async (context) => {
    if (setupFailed || !quickstart || !functionId1) {
      context.skip()
      return
    }

    const res = await post<FunctionRecord>(functionsPath(), {
      name: uniqueName('Linked Function 2'),
      content: functionContent,
    })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    functionId2 = res.data.id

    // Link both functions
    const configRes = await put<Record<string, any>>(configPath(), {
      functionIds: [functionId1, functionId2],
    })

    expect(configRes.status).toBe(200)
  })

  test('project config shows both linked functionIds', async (context) => {
    if (setupFailed || !functionId1 || !functionId2) {
      context.skip()
      return
    }

    const res = await get<{ functionIds: string[] }>(configPath())

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.functionIds).toContain(functionId1)
    expect(res.data.functionIds).toContain(functionId2)
    expect(res.data.functionIds).toHaveLength(2)
  })

  test('creates unlinked function (not in functionIds)', async (context) => {
    if (setupFailed || !quickstart) {
      context.skip()
      return
    }

    const res = await post<FunctionRecord>(functionsPath(), {
      name: uniqueName('Unlinked Function'),
      content: functionContent,
    })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    unlinkedFunctionId = res.data.id
  })

  test('unlinked function is not in agent project config functionIds', async (context) => {
    if (setupFailed || !unlinkedFunctionId) {
      context.skip()
      return
    }

    const res = await get<{ functionIds: string[] }>(configPath())

    expect(res.status).toBe(200)
    const functionIds = res.data.functionIds || []
    expect(functionIds).not.toContain(unlinkedFunctionId)
  })

  test('unlinking function removes it from functionIds', async (context) => {
    if (setupFailed || !quickstart || !functionId1 || !functionId2) {
      context.skip()
      return
    }

    // Remove functionId1, keep only functionId2
    const res = await put<Record<string, any>>(configPath(), {
      functionIds: [functionId2],
    })

    expect(res.status).toBe(200)

    const configRes = await get<{ functionIds: string[] }>(configPath())
    expect(configRes.status).toBe(200)
    expect(configRes.data.functionIds).not.toContain(functionId1)
    expect(configRes.data.functionIds).toContain(functionId2)
    expect(configRes.data.functionIds).toHaveLength(1)

    // Restore both for remaining tests
    await put(configPath(), { functionIds: [functionId1, functionId2] })
  })

  test('functions survive agent deletion', async (context) => {
    if (setupFailed || !quickstart || !functionId1 || !functionId2) {
      context.skip()
      return
    }

    // Delete the agent
    const deleteRes = await del(`/orgs/${ctx.orgId}/agents/${quickstart.agent.id}`)
    expect(deleteRes.status).toBe(200)

    // Functions should still exist (they're project-scoped, not agent-scoped)
    const res1 = await get<FunctionRecord>(
      `${functionsPath()}/${functionId1}`
    )
    expect(res1.status).toBe(200)
    expect(res1.data.id).toBe(functionId1)

    const res2 = await get<FunctionRecord>(
      `${functionsPath()}/${functionId2}`
    )
    expect(res2.status).toBe(200)
    expect(res2.data.id).toBe(functionId2)

    // Mark agent as deleted so afterAll doesn't try to re-delete it
    quickstart.agent.id = ''
  })

  test('unlinked function survives agent deletion', async (context) => {
    if (setupFailed || !unlinkedFunctionId) {
      context.skip()
      return
    }

    const res = await get<FunctionRecord>(
      `${functionsPath()}/${unlinkedFunctionId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.id).toBe(unlinkedFunctionId)
  })
})

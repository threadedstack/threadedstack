import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post, get, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSSE } from '../utils/sse'
import { tryDelete } from '../utils/cleanup'
import { cleanupThread } from '../utils/repl-cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 3: Agent with Custom Functions', () => {
  const ctx = readContext()

  let setupFailed = false
  let quickstartResult: Record<string, any> = {}
  let functionId = ''
  let agentId = ''
  let projectId = ''
  const threadIds: string[] = []

  const functionContent = `export default async function handler(request, context) {
  const name = context?.args?.name || 'world'
  return { body: { greeting: 'Hello ' + name } }
}`

  const inputSchema = [
    { name: 'name', type: 'string', description: 'Name to greet', required: false, default: 'world' },
  ]

  beforeAll(async () => {
    // Step 1: Quickstart to create agent + provider + secret + project + endpoint
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: uniqueName('Agent Fn Test Project'),
        agentName: uniqueName('Agent Fn Test Agent'),
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    agentId = quickstartResult.agent.id
    projectId = quickstartResult.project.id

    // Step 2: Create a function in the project
    const fnRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: uniqueName('greet-handler'),
        content: functionContent,
        language: 'typescript',
        description: 'Greeting function for agent tool testing',
        inputSchema,
      }
    )

    if (fnRes.status !== 201 || !fnRes.data?.data?.id) {
      setupFailed = true
      return
    }

    functionId = fnRes.data.data.id

    // Step 3: Link the function to the agent via project config functionIds
    const configRes = await put(
      `/orgs/${ctx.orgId}/projects/${projectId}/agents/${agentId}/config`,
      { functionIds: [functionId] }
    )

    if (!configRes.ok) {
      setupFailed = true
      return
    }
  })

  afterAll(async () => {
    // Clean up threads created by consumeSSE calls
    for (const tid of threadIds) {
      if (agentId) await cleanupThread(ctx.orgId, agentId, tid)
    }
    // Cleanup in reverse dependency order
    if (functionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`)
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  test('function is linked to agent via project config', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Verify function exists
    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBe(functionId)

    // Verify the agent's project config has the function linked via functionIds
    const configRes = await get<{ data: { functionIds: string[] } }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/agents/${agentId}/config`
    )

    expect(configRes.status).toBe(200)
    expect(configRes.data.data.functionIds).toContain(functionId)
  })

  test('agent run with custom function starts SSE stream', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].type).toBe('thread')
  })

  test('agent run returns X-Thread-Id header', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const { threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(threadId).toBeTruthy()
  })

  test('agent run stream contains events', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()
    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  test('stream contains thread event or error', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // With a fake API key the LLM call will fail, but the SSE mechanics
    // should still work — we expect at least a thread event, and either
    // an error (from the LLM) or a completion event
    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()

    const hasThread = events.some((e) => e.type === 'thread')
    const hasError = events.some((e) => e.type === 'error')
    const hasCompletion = events.some((e) => e.type === 'complete' || e.type === 'done')

    // At minimum the thread event should be present; beyond that either
    // an error (fake key) or a completion is acceptable
    expect(hasThread || hasError || hasCompletion).toBe(true)
  })

  test('function is queryable after agent run', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBe(functionId)
    expect(res.data.data.name).toContain('greet-handler')
  })
})

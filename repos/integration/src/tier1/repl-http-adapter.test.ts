import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl/services/api'
import { DBProxy } from '@tdsk/repl/services/dbProxy'

/**
 * Tier 1: REPL DBProxy — IAgentRunnerDB Contract
 *
 * Validates that DBProxy correctly implements the IAgentRunnerDB
 * interface against the live backend. This is the bridge between AgentRunner
 * and the backend's message persistence.
 */
describe('Tier 1: REPL DBProxy (live)', () => {
  const ctx = readContext()
  const timestamp = Date.now()
  let client: ApiClient
  let adapter: DBProxy

  // Quickstart resources
  let agentId = ''
  let threadId = ''
  let quickstartResult: Record<string, any> = {}

  beforeAll(async () => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)

    // Create quickstart agent
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-repl-http-adapter',
        projectName: `REPL HttpAdapter IT ${timestamp}`,
        agentName: `REPL HttpAdapter Agent ${timestamp}`,
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id

    // Create a thread for message tests
    const thread = await client.createThread(ctx.orgId, agentId, 'IT HttpAdapter test')
    threadId = thread.id

    // Create adapter
    adapter = new DBProxy(client, ctx.orgId, agentId)
  })

  afterAll(async () => {
    await cleanupThread(ctx.orgId, agentId, threadId)
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  // ─── Interface compliance ─────────────────────────────────────────

  test('adapter has listMessages method', () => {
    expect(typeof adapter.listMessages).toBe('function')
  })

  test('adapter has createMessage method', () => {
    expect(typeof adapter.createMessage).toBe('function')
  })

  // ─── createMessage ────────────────────────────────────────────────

  test('createMessage persists user message', async () => {
    await expect(
      adapter.createMessage({
        threadId,
        type: 'user',
        content: [{ type: 'text', text: 'HttpAdapter integration test message' }],
        orgId: ctx.orgId,
      })
    ).resolves.not.toThrow()
  })

  // ─── listMessages ─────────────────────────────────────────────────

  test('listMessages returns { data: Message[] }', async () => {
    const result = await adapter.listMessages({
      where: { threadId },
      limit: 50,
      offset: 0,
    })

    expect(result).toHaveProperty('data')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('listMessages includes persisted message', async () => {
    // Create a message first
    await adapter.createMessage({
      threadId,
      type: 'user',
      content: [{ type: 'text', text: 'HttpAdapter round-trip test' }],
      orgId: ctx.orgId,
    })

    const result = await adapter.listMessages({
      where: { threadId },
      limit: 50,
      offset: 0,
    })

    expect(result.data!.length).toBeGreaterThan(0)
  })

  test('limit and offset parameters are accepted', async () => {
    const result = await adapter.listMessages({
      where: { threadId },
      limit: 1,
      offset: 0,
    })

    expect(result).toHaveProperty('data')
    expect(Array.isArray(result.data)).toBe(true)
  })
})

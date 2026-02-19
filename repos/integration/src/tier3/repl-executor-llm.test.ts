import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl/api'
import { LocalAgentExecutor } from '@tdsk/repl/executor'
import { env } from '../utils/env'
import type { TStreamEvent } from '@tdsk/domain'

/**
 * Tier 3: REPL LocalAgentExecutor — Full LLM E2E
 *
 * Runs LocalAgentExecutor.run() with a real LLM provider key.
 * All tests skip when TDSK_IT_PROVIDER_KEY is not set.
 */
const hasProviderKey = () => !!env.testProviderKey

describe('Tier 3: REPL LocalAgentExecutor — LLM E2E (live)', () => {
  const ctx = readContext()
  const timestamp = Date.now()
  let executor: LocalAgentExecutor

  // Quickstart resources (created with real key)
  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  const threadIds: string[] = []

  beforeAll(async () => {
    if (!hasProviderKey()) return

    const auth = createTestAuth()
    const client = new ApiClient(auth as any)
    executor = new LocalAgentExecutor(client)

    // Create quickstart agent with a REAL provider key
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: `REPL LLM E2E ${timestamp}`,
        agentName: `REPL LLM E2E Agent ${timestamp}`,
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    if (!hasProviderKey()) return

    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  test.skipIf(!hasProviderKey())('run() streams events via onEvent', async () => {
    const events: TStreamEvent[] = []

    const result = await executor.run({
      orgId: ctx.orgId,
      agentId,
      prompt: 'Respond with exactly: REPL_TEST_OK',
      userId: ctx.userId,
      onEvent: (event) => events.push(event),
    })

    threadIds.push(result.threadId)

    expect(events.length).toBeGreaterThan(0)

    const textEvents = events.filter(e => e.type === 'text')
    const doneEvents = events.filter(e => e.type === 'done')

    expect(textEvents.length).toBeGreaterThanOrEqual(1)
    expect(doneEvents.length).toBe(1)
  })

  test.skipIf(!hasProviderKey())('run() returns threadId', async () => {
    const events: TStreamEvent[] = []

    const result = await executor.run({
      orgId: ctx.orgId,
      agentId,
      prompt: 'Say hello',
      userId: ctx.userId,
      onEvent: (event) => events.push(event),
    })

    expect(result.threadId).toBeTruthy()
    expect(typeof result.threadId).toBe('string')
    threadIds.push(result.threadId)
  })

  test.skipIf(!hasProviderKey())('user message persisted after run', async () => {
    const events: TStreamEvent[] = []

    const result = await executor.run({
      orgId: ctx.orgId,
      agentId,
      prompt: 'REPL persistence test',
      userId: ctx.userId,
      onEvent: (event) => events.push(event),
    })

    threadIds.push(result.threadId)

    // Check messages were persisted
    const messages = await executor.client.listMessages(
      ctx.orgId,
      agentId,
      result.threadId
    )

    const userMessages = messages.filter(m => m.type === 'user')
    expect(userMessages.length).toBeGreaterThanOrEqual(1)
  })

  test.skipIf(!hasProviderKey())('onEvent receives text content from LLM', async () => {
    const events: TStreamEvent[] = []

    const result = await executor.run({
      orgId: ctx.orgId,
      agentId,
      prompt: 'Respond with exactly: REPL_LLM_TEST',
      userId: ctx.userId,
      onEvent: (event) => events.push(event),
    })

    threadIds.push(result.threadId)

    // Verify text events contain actual content
    const textEvents = events.filter(e => e.type === 'text')
    expect(textEvents.length).toBeGreaterThanOrEqual(1)

    const fullText = textEvents.map(e => (e as any).text).join('')
    expect(fullText.length).toBeGreaterThan(0)
  })
})

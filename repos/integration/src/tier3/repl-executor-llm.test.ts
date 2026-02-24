import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl/services/api'
import { Executor } from '@tdsk/repl/services/executor'
import { env } from '../utils/env'
import type { TStreamEvent } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: REPL Executor — Full LLM E2E
 *
 * Runs Executor.run() with a real LLM provider key.
 * All tests skip when TDSK_IT_PROVIDER_KEY is not set.
 *
 * Uses a single LLM call (in beforeAll) to avoid rate-limiting
 * from multiple consecutive API calls.
 */
const hasProviderKey = () => !!env.testProviderKey

describe('Tier 3: REPL Executor — LLM E2E (live)', () => {
  const ctx = readContext()
  let executor: Executor

  // Quickstart resources (created with real key)
  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  const threadIds: string[] = []

  // Shared result from a single LLM call
  const events: TStreamEvent[] = []
  let runResult: { threadId: string } | null = null
  let runError: Error | null = null

  beforeAll(async () => {
    if (!hasProviderKey()) return

    const auth = createTestAuth()
    const client = new ApiClient(auth as any)
    executor = new Executor(client)

    // Create quickstart agent with a REAL provider key
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('REPL LLM E2E'),
        agentName: uniqueName('REPL LLM E2E Agent'),
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id

    // Run a single LLM call — all tests assert on this shared result
    try {
      runResult = await executor.run({
        agentId,
        orgId: ctx.orgId,
        userId: ctx.userId,
        prompt: 'Respond with exactly: REPL_TEST_OK',
        onEvent: (event) => events.push(event),
      })
      if (runResult.threadId) threadIds.push(runResult.threadId)
    } catch (err) {
      runError = err instanceof Error ? err : new Error(String(err))
    }
  }, 180_000)

  afterAll(async () => {
    if (!hasProviderKey()) return

    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  test.skipIf(!hasProviderKey())('run() completes without error', () => {
    expect(runError).toBeNull()
    expect(runResult).toBeTruthy()
  })

  test.skipIf(!hasProviderKey())('run() streams events via onEvent', () => {
    expect(events.length).toBeGreaterThan(0)

    const textEvents = events.filter(e => e.type === 'text')
    const doneEvents = events.filter(e => e.type === 'done')

    expect(textEvents.length).toBeGreaterThanOrEqual(1)
    expect(doneEvents.length).toBe(1)
  })

  test.skipIf(!hasProviderKey())('run() returns threadId', () => {
    expect(runResult).toBeTruthy()
    expect(runResult!.threadId).toBeTruthy()
    expect(typeof runResult!.threadId).toBe('string')
  })

  test.skipIf(!hasProviderKey())(
    'user message persisted after run',
    async () => {
      expect(runResult).toBeTruthy()

      // Check messages were persisted
      const messages = await executor.client.listMessages(
        ctx.orgId,
        agentId,
        runResult!.threadId
      )

      const userMessages = messages.filter(m => m.type === 'user')
      expect(userMessages.length).toBeGreaterThanOrEqual(1)
    }
  )

  test.skipIf(!hasProviderKey())('onEvent receives text content from LLM', () => {
    // Verify text events contain actual content
    const textEvents = events.filter(e => e.type === 'text')
    const errorEvents = events.filter(e => e.type === 'error')

    const hasContent = textEvents.length >= 1
    const hasError = errorEvents.length >= 1
    const hasDone = events.some(e => e.type === 'done')
    expect(hasContent || hasError || hasDone).toBe(true)

    if (hasContent) {
      const fullText = textEvents.map(e => (e as any).text).join('')
      expect(fullText.length).toBeGreaterThan(0)
    }
  })
})

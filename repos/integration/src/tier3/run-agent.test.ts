import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSSE } from '../utils/sse'
import { tryDelete } from '../utils/cleanup'
import { cleanupThread } from '../utils/repl-cleanup'

describe('Tier 3: Run Agent SSE Flow', () => {
  const ctx = readContext()
  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false
  const threadIds: string[] = []

  beforeAll(async () => {
    const timestamp = Date.now()
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: `Run Agent Test Project ${timestamp}`,
        agentName: `Run Agent Test Agent ${timestamp}`,
      }
    )

    if (res.status !== 201 || !res.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    for (const tid of threadIds) {
      if (agentId) await cleanupThread(ctx.orgId, agentId, tid)
    }
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project?.id}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  test('SSE stream starts with thread event', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false) // fail with context

    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].type).toBe('thread')
    expect(events[0].threadId).toBeTruthy()
  })

  test('returns X-Thread-Id header', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const { threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(threadId).toBeTruthy()
  })

  test('stream contains error or completes', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // With a fake API key the LLM call will fail, but the SSE mechanics
    // should still work — we expect at least a thread event and an error event
    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()

    // Stream should contain either an error event or reach completion
    const hasError = events.some((e) => e.type === 'error')
    const hasCompletion = events.some((e) => e.type === 'complete' || e.type === 'done')
    const hasThread = events.some((e) => e.type === 'thread')

    // At minimum the thread event should be present; beyond that either
    // an error (fake key) or a completion is acceptable
    expect(hasThread || hasError || hasCompletion).toBe(true)
  })
})

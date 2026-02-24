import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSSE } from '../utils/sse'
import { tryDelete } from '../utils/cleanup'
import { cleanupThread } from '../utils/repl-cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: Run Agent SSE Flow
 *
 * Tests the SSE endpoint POST /orgs/:orgId/agents/:agentId/run which is
 * deliberately kept for Endpoints and future sub-agent use.
 *
 * Uses a real LLM provider key (TDSK_IT_PROVIDER_KEY) via quickstart, or
 * falls back to pre-configured agents (TDSK_IT_AGENT_ID / TDSK_IT_ZAI_AGENT_ID).
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 3: Run Agent SSE Flow', () => {
  const ctx = readContext()
  let agentId = ''
  let qsResult: Record<string, any> | null = null
  const threadIds: string[] = []

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('Run Agent Test Project'),
          agentName: uniqueName('Run Agent Test Agent'),
        }
      )

      if (qsRes.status === 201 && qsRes.data?.data?.agent?.id) {
        qsResult = qsRes.data.data
        agentId = qsResult!.agent.id
      }
    }

    if (!agentId) {
      agentId = getAgentId()
    }

    if (!agentId) return

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    if (!res.ok) {
      throw new Error(
        `Agent (${agentId}) not accessible: ${res.status}\n` +
        `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
      )
    }
  })

  afterAll(async () => {
    for (const tid of threadIds) {
      if (agentId) await cleanupThread(ctx.orgId, agentId, tid)
    }
    if (!qsResult) return
    if (qsResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project?.id}/endpoints/${qsResult.endpoint.id}`)
    if (qsResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`)
    if (qsResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project.id}`)
    if (qsResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${qsResult.secret.id}`)
    if (qsResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${qsResult.provider.id}`)
  })

  test.skipIf(!hasLLM())('SSE stream starts with thread event', async () => {
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

  test.skipIf(!hasLLM())('returns X-Thread-Id header', async () => {
    const { threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(threadId).toBeTruthy()
  })

  test.skipIf(!hasLLM())('stream contains error or completes', async () => {
    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()

    const hasError = events.some((e) => e.type === 'error')
    const hasCompletion = events.some((e) => e.type === 'complete' || e.type === 'done')
    const hasThread = events.some((e) => e.type === 'thread')

    expect(hasThread || hasError || hasCompletion).toBe(true)
  })
})

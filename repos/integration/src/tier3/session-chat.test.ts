import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { consumeWS } from '../utils/ws-client'
import { EWSEventType } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: WebSocket Session Chat Flow
 *
 * Validates the full session → WebSocket → agent execution pipeline.
 * Replaces the old SSE /ai/stream tests with WebSocket /ai/ws tests.
 *
 * Uses a real LLM provider key (TDSK_IT_PROVIDER_KEY) via quickstart, or
 * falls back to pre-configured agents (TDSK_IT_AGENT_ID / TDSK_IT_ZAI_AGENT_ID).
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 3: WebSocket Session Chat Flow', () => {
  const ctx = readContext()
  let agentId = ''
  let sessionToken = ''
  let sessionProvider = ''
  let qsResult: Record<string, any> | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('WS Chat Test Project'),
          agentName: uniqueName('WS Chat Test Agent'),
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

    const agentRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    if (!agentRes.ok) {
      throw new Error(
        `Agent (${agentId}) not accessible: ${agentRes.status}\n` +
        `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
      )
    }

    const sessionRes = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    if (sessionRes.status !== 200 || !sessionRes.data?.data?.sessionToken) {
      throw new Error(`Session creation failed: ${sessionRes.status}`)
    }

    sessionToken = sessionRes.data.data.sessionToken
    sessionProvider = sessionRes.data.data.provider
  })

  afterAll(async () => {
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

  test.skipIf(!hasLLM())('session token was created successfully', () => {
    expect(sessionToken).toBeTruthy()
    expect(typeof sessionToken).toBe('string')
  })

  test.skipIf(!hasLLM())('session returns valid provider', () => {
    expect(['anthropic', 'openai', 'google', 'zai']).toContain(sessionProvider)
  })

  test.skipIf(!hasLLM())('WS with valid session is accepted by backend', async () => {
    const result = await consumeWS(sessionToken, 'WS chat test prompt', { timeout: 60_000 })

    expect(result.closeCode).not.toBe(4001)
    expect(result.messages.length).toBeGreaterThanOrEqual(1)
  })

  test.skipIf(!hasLLM())('WS creates a thread for new conversation', async () => {
    const result = await consumeWS(sessionToken, 'Thread creation test', { timeout: 60_000 })

    const threadMsg = result.messages.find(m => m.type === EWSEventType.ThreadCreated)
    expect(threadMsg).toBeDefined()
    expect(typeof threadMsg!.threadId).toBe('string')
    expect((threadMsg!.threadId as string).length).toBeGreaterThan(0)
  })

  test.skipIf(!hasLLM())('WS with empty prompt returns error', async () => {
    const result = await consumeWS(sessionToken, '', { timeout: 10_000 })

    const errorMsg = result.messages.find(m => m.type === EWSEventType.Error)
    expect(errorMsg).toBeDefined()
  })

  test('WS with expired/deleted session is rejected', async () => {
    const fakeToken = '12345678-1234-1234-1234-123456789abc'
    const result = await consumeWS(fakeToken, 'Should fail', { timeout: 10_000 })

    const hasThread = result.messages.some(m => m.type === EWSEventType.ThreadCreated)
    expect(hasThread).toBe(false)
  })
})

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { connectWS, consumeWS } from '../utils/ws-client'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: WebSocket Session Auth
 *
 * Tests that /ai/ws WebSocket connections require a valid session token
 * via query param `?token=<uuid>`. The session token is obtained by calling
 * POST /_/ai/sessions with JWT/API key auth first.
 *
 * Uses a real LLM provider key (TDSK_IT_PROVIDER_KEY) via quickstart, or
 * falls back to pre-configured agents (TDSK_IT_AGENT_ID / TDSK_IT_ZAI_AGENT_ID).
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 1: WebSocket Session Auth', () => {
  const ctx = readContext()
  let agentId = ''
  let sessionToken = ''
  let qsResult: Record<string, any> | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('WS Auth Test Project'),
          agentName: uniqueName('WS Auth Test Agent'),
        }
      )

      if (qsRes.status === 201 && qsRes.data?.agent?.id) {
        qsResult = qsRes.data
        agentId = qsResult!.agent.id
      }
    }

    if (!agentId) {
      agentId = getAgentId()
    }

    if (!agentId) return

    const agentRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    if (!agentRes.ok) {
      throw new Error(
        `Agent (${agentId}) not accessible: ${agentRes.status}\n` +
        `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
      )
    }

    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    if (sessionRes.status !== 200 || !sessionRes.data?.sessionToken) {
      throw new Error(`Session creation failed: ${sessionRes.status}`)
    }

    sessionToken = sessionRes.data.sessionToken
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

  // ─── Auth rejection tests (no agent/session needed) ────────────────

  test('WS without token query param is rejected with 4001', async () => {
    const result = await connectWS(null)
    expect(result.closeCode).toBe(4001)
  })

  test('WS with empty token query param is rejected with 4001', async () => {
    const result = await connectWS('')
    expect(result.closeCode).toBe(4001)
  })

  test('WS with invalid session token is rejected with 4001', async () => {
    const result = await connectWS('zz00000000')
    expect(result.closeCode).toBe(4001)
  })

  // ─── Valid session tests (require real LLM provider) ───────────────

  test.skipIf(!hasLLM())('WS with valid session token is accepted', async () => {
    const result = await consumeWS(sessionToken, 'Auth test prompt', { timeout: 60_000 })

    expect(result.messages.length).toBeGreaterThanOrEqual(1)
    expect(result.closeCode).not.toBe(4001)
  })

  test.skipIf(!hasLLM())('valid session returns thread_created as first message', async () => {
    const result = await consumeWS(sessionToken, 'Auth flow test', { timeout: 60_000 })

    expect(result.messages.length).toBeGreaterThanOrEqual(1)
    expect(result.messages[0].type).toBe('thread_created')
    expect(result.messages[0].threadId).toBeTruthy()
  })
})

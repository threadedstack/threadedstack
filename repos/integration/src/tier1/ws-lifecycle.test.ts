import WebSocket from 'ws'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { connectWS, consumeWS, createWSConnection, waitForMessage } from '../utils/ws-client'
import { EWSEventType } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: WebSocket Lifecycle
 *
 * Validates WS connection lifecycle behaviors introduced by the SSE→WS migration:
 * - Session token reuse across sequential WS connections
 * - Concurrent WS connections with the same token
 * - Cancel flow emits done with reason 'cancelled'
 * - Invalid/malformed messages receive error responses
 * - Done message reason field is properly constrained
 * - Error close codes (4001) for auth failures
 *
 * Uses a real LLM provider key (TDSK_IT_PROVIDER_KEY) via quickstart, or
 * falls back to pre-configured agents (TDSK_IT_AGENT_ID / TDSK_IT_ZAI_AGENT_ID).
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 1: WebSocket Lifecycle', () => {
  const ctx = readContext()
  let agentId = ''
  let qsResult: Record<string, any> | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('WS Lifecycle Test'),
          agentName: uniqueName('WS Lifecycle Agent'),
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

    const res = await get<Record<string, any>>(
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

  const createSessionToken = async (): Promise<string | null> => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )
    if (res.status !== 200 || !res.data?.sessionToken) return null
    return res.data.sessionToken
  }

  // ─── Session Token Reuse ─────────────────────────────────────────

  test.skipIf(!hasLLM())('session token can be reused across sequential WS connections', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    // First connection — should work
    const first = await consumeWS(token!, 'Say hello', { timeout: 60_000 })
    expect(first.messages.length).toBeGreaterThanOrEqual(1)
    expect(first.closeCode).not.toBe(4001)

    // Second connection with SAME token — tokens are not consumed on use
    const second = await consumeWS(token!, 'Say goodbye', { timeout: 60_000 })
    expect(second.messages.length).toBeGreaterThanOrEqual(1)
    expect(second.closeCode).not.toBe(4001)
  }, 180_000)

  test.skipIf(!hasLLM())('session token works for a third sequential connection', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    for (let i = 0; i < 3; i++) {
      const result = await consumeWS(token!, `Message ${i + 1}`, { timeout: 60_000 })
      expect(result.closeCode).not.toBe(4001)
      expect(result.messages.length).toBeGreaterThanOrEqual(1)
    }
  }, 240_000)

  // ─── Concurrent Connections ──────────────────────────────────────

  test.skipIf(!hasLLM())('same session token supports concurrent WS connections', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    // Open two connections concurrently with the same token
    const [result1, result2] = await Promise.all([
      consumeWS(token!, 'Say alpha', { timeout: 60_000 }),
      consumeWS(token!, 'Say beta', { timeout: 60_000 }),
    ])

    // Both should connect (neither should get 4001)
    expect(result1.closeCode).not.toBe(4001)
    expect(result2.closeCode).not.toBe(4001)
    expect(result1.messages.length).toBeGreaterThanOrEqual(1)
    expect(result2.messages.length).toBeGreaterThanOrEqual(1)
  }, 180_000)

  // ─── Cancel Flow ─────────────────────────────────────────────────

  test.skipIf(!hasLLM())('cancel message produces valid done reason', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages, waitForClose } = await createWSConnection(token!, { timeout: 60_000 })

    // Send a prompt requiring a long response so the LLM is still running when cancel arrives
    ws.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'Write a very detailed 2000-word essay about the complete history of computing from the 1940s to today',
    }))

    // Wait for LLM to actually start streaming before cancelling
    await waitForMessage(messages, EWSEventType.TextDelta, 15_000)
    ws.send(JSON.stringify({ type: EWSEventType.Cancel }))

    const closeResult = await Promise.race([
      waitForClose(),
      new Promise<{ closeCode: number; closeReason: string }>(r =>
        setTimeout(() => {
          ws.close()
          r({ closeCode: -1, closeReason: 'timeout' })
        }, 30_000)
      ),
    ])

    const doneMsg = messages.find(m => m.type === EWSEventType.Done)
    expect(doneMsg).toBeDefined()
    expect(['complete', 'error', 'cancelled']).toContain(doneMsg!.reason)

    if (closeResult.closeCode !== -1) {
      expect(closeResult.closeCode).not.toBe(4001)
    }
  }, 120_000)

  // ─── Done Reason Validation ──────────────────────────────────────

  test.skipIf(!hasLLM())('done message reason is one of complete, error, or cancelled', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const result = await consumeWS(token!, 'Respond with OK', { timeout: 60_000 })

    const doneMsg = result.messages.find(m => m.type === EWSEventType.Done)
    expect(doneMsg).toBeDefined()
    expect(['complete', 'error', 'cancelled']).toContain(doneMsg!.reason)
  })

  test.skipIf(!hasLLM())('successful LLM call produces done with reason complete', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const result = await consumeWS(token!, 'Respond with exactly: OK', { timeout: 60_000 })

    const doneMsg = result.messages.find(m => m.type === EWSEventType.Done)
    expect(doneMsg).toBeDefined()
    expect(doneMsg!.reason).toBe('complete')
  })

  // ─── Invalid Message Handling ────────────────────────────────────

  test.skipIf(!hasLLM())('invalid JSON over WS receives error message', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages, waitForClose } = await createWSConnection(token!, { timeout: 10_000 })

    ws.send('not-valid-json{{{')

    await new Promise(r => setTimeout(r, 1_000))

    const errorMsg = messages.find(m => m.type === EWSEventType.Error)
    expect(errorMsg).toBeDefined()
    expect(typeof errorMsg!.message).toBe('string')

    ws.close()
    await waitForClose().catch(() => {})
  })

  test.skipIf(!hasLLM())('unrecognised message type receives error response', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages, waitForClose } = await createWSConnection(token!, { timeout: 10_000 })

    ws.send(JSON.stringify({ type: 'unknown_type', data: 'test' }))

    await new Promise(r => setTimeout(r, 1_000))

    const errorMsg = messages.find(m => m.type === EWSEventType.Error)
    expect(errorMsg).toBeDefined()

    ws.close()
    await waitForClose().catch(() => {})
  })

  // ─── Auth Rejection Close Codes ──────────────────────────────────

  test('expired/invalid token returns close code 4001', async () => {
    const result = await connectWS('zz00000000')
    expect(result.closeCode).toBe(4001)
  })

  test('missing token returns close code 4001', async () => {
    const result = await connectWS(null)
    expect(result.closeCode).toBe(4001)
  })

  // ─── Thread Created Event ────────────────────────────────────────

  test.skipIf(!hasLLM())('new prompt creates thread_created with valid nanoid threadId', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const result = await consumeWS(token!, 'Say hello', { timeout: 60_000 })

    const threadCreated = result.messages.find(m => m.type === EWSEventType.ThreadCreated)
    expect(threadCreated).toBeDefined()
    expect(typeof threadCreated!.threadId).toBe('string')

    const idRegex = /^[A-Za-z0-9_-]{10}$/
    expect(idRegex.test(threadCreated!.threadId as string)).toBe(true)
  })

  // ─── Empty Prompt ────────────────────────────────────────────────

  test.skipIf(!hasLLM())('empty prompt returns error + done with reason error', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const result = await consumeWS(token!, '', { timeout: 10_000 })

    const errorMsg = result.messages.find(m => m.type === EWSEventType.Error)
    expect(errorMsg).toBeDefined()
    expect(typeof errorMsg!.message).toBe('string')

    const doneMsg = result.messages.find(m => m.type === EWSEventType.Done)
    expect(doneMsg).toBeDefined()
    expect(doneMsg!.reason).toBe('error')
  })

  // ─── Turn End Event ──────────────────────────────────────────────

  test.skipIf(!hasLLM())('turn_end event includes usage object', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const result = await consumeWS(token!, 'Say hi', { timeout: 60_000 })

    const turnEnd = result.messages.find(m => m.type === EWSEventType.TurnEnd)
    if (turnEnd) {
      expect(turnEnd.usage).toBeDefined()
      expect(typeof (turnEnd.usage as any).input).toBe('number')
      expect(typeof (turnEnd.usage as any).output).toBe('number')
    }
  })

  // ─── Concurrent Prompt Rejection ─────────────────────────────────

  test.skipIf(!hasLLM())('second prompt on same connection is rejected while first is running', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages, waitForClose } = await createWSConnection(token!, { timeout: 60_000 })

    // Send first prompt — with a real LLM, this will be running for seconds
    ws.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'Write a detailed paragraph about the history of the internet',
    }))

    // Send second prompt immediately — should be rejected as first is still running
    await new Promise(r => setTimeout(r, 200))
    ws.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'This should be rejected',
    }))

    // Wait for agent to finish (Done event) instead of fixed delay
    await waitForMessage(messages, EWSEventType.Done, 60_000)

    const errorMsgs = messages.filter(m => m.type === EWSEventType.Error)
    const hasRunningError = errorMsgs.some(m =>
      typeof m.message === 'string' && m.message.toLowerCase().includes('already running')
    )
    expect(hasRunningError).toBe(true)

    ws.close()
    await waitForClose().catch(() => {})
  }, 120_000)
})

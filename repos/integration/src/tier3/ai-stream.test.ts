import type { TFixtureResult } from '../utils/fixtures'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { cleanupThread, extractThreadId } from '../utils/tsa-cleanup'
import { consumeWS, connectWS } from '../utils/ws-client'
import { EWSEventType, isFeatureEnabled } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'

/**
 * Tier 3: WebSocket Agent Execution (/ai/ws)
 *
 * Tests the WebSocket-based agent execution flow that replaced SSE /ai/stream.
 *
 * Request flow:
 *   Client → Caddy (TLS) → Proxy (session token via ?token= query) → Backend (WS) → AgentRunner → LLM
 *
 * Uses a real LLM provider key (TDSK_IT_PROVIDER_KEY) via quickstart, or
 * falls back to pre-configured agents (TDSK_IT_AGENT_ID / TDSK_IT_ZAI_AGENT_ID).
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe.skipIf(!isFeatureEnabled('agents'))('Tier 3: WebSocket Agent Execution (/ai/ws)', () => {
  const ctx = readContext()
  const threadIds: string[] = []
  let agentId = ''
  let sessionToken = ''
  let fixtures: TFixtureResult | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      try {
        const result = await setupFixtures({
          orgId: ctx.orgId,
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('WS Agent Flow Test'),
          agentName: uniqueName('WS Agent Flow Agent'),
        })
        fixtures = result
        agentId = result.agent?.id ?? ''
      }
      catch {
        // fall through to pre-existing agent
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
    for (const tid of threadIds) {
      if (agentId) await cleanupThread(ctx.orgId, agentId, tid)
    }

    if (!fixtures) return
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Session verification ──────────────────────────────────────────

  test.skipIf(!hasLLM())('session was created successfully', () => {
    expect(sessionToken).toBeTruthy()
    expect(typeof sessionToken).toBe('string')
    expect(sessionToken.length).toBeGreaterThan(0)
  })

  // ─── WebSocket message flow ────────────────────────────────────────

  test.skipIf(!hasLLM())('WS prompt triggers thread_created event', async () => {
    const result = await consumeWS(sessionToken, 'Say hello', { timeout: 60_000 })
    const wsThreadId1 = extractThreadId(result); if (wsThreadId1) threadIds.push(wsThreadId1)

    expect(result.messages.length).toBeGreaterThanOrEqual(1)

    const threadCreated = result.messages.find(m => m.type === EWSEventType.ThreadCreated)
    expect(threadCreated).toBeDefined()
    expect(threadCreated!.threadId).toBeTruthy()
    expect(typeof threadCreated!.threadId).toBe('string')
  })

  test.skipIf(!hasLLM())('WS prompt ends with done event', async () => {
    const result = await consumeWS(sessionToken, 'Say OK', { timeout: 60_000 })
    const wsThreadId2 = extractThreadId(result); if (wsThreadId2) threadIds.push(wsThreadId2)

    const doneMsg = result.messages.find(m => m.type === EWSEventType.Done)
    expect(doneMsg).toBeDefined()
    expect(doneMsg!.reason).toBe('complete')
  })

  test.skipIf(!hasLLM())('stream contains text_delta events with real LLM response', async () => {
    const result = await consumeWS(sessionToken, 'Respond with exactly: INTEGRATION_TEST_OK', { timeout: 60_000 })
    const wsThreadId3 = extractThreadId(result); if (wsThreadId3) threadIds.push(wsThreadId3)

    const textEvents = result.messages.filter(m => m.type === EWSEventType.TextDelta)
    expect(textEvents.length).toBeGreaterThanOrEqual(1)

    for (const te of textEvents) {
      expect(typeof te.delta).toBe('string')
    }

    const fullText = textEvents.map(e => e.delta).join('')
    expect(fullText.length).toBeGreaterThan(0)
  })

  test.skipIf(!hasLLM())('all messages have valid type discriminator', async () => {
    const result = await consumeWS(sessionToken, 'Say hi', { timeout: 60_000 })
    const wsThreadId4 = extractThreadId(result); if (wsThreadId4) threadIds.push(wsThreadId4)

    const validTypes = [
      'text_delta', 'thinking_delta', 'tool_execution_start', 'tool_execution_end',
      'tool_execution_update',
      'file_request', 'file_changed', 'thread_created',
      'turn_end', 'done', 'error',
    ]

    for (const msg of result.messages) {
      expect(validTypes).toContain(msg.type)
    }
  })

  // ─── Auth rejection ────────────────────────────────────────────────

  test('WS with invalid session token is rejected with 4001', async () => {
    const result = await connectWS('invalid-not-a-real-token')
    expect(result.closeCode).toBe(4001)
  })

  // ─── Empty prompt handling ─────────────────────────────────────────

  test.skipIf(!hasLLM())('empty prompt returns error message over WS', async () => {
    const result = await consumeWS(sessionToken, '', { timeout: 10_000 })
    const wsThreadId5 = extractThreadId(result); if (wsThreadId5) threadIds.push(wsThreadId5)

    const errorMsg = result.messages.find(m => m.type === EWSEventType.Error)
    expect(errorMsg).toBeDefined()
    expect(typeof errorMsg!.message).toBe('string')
  })

  // ─── Thread reuse ──────────────────────────────────────────────────

  test.skipIf(!hasLLM())('sending threadId in prompt skips thread creation', async () => {
    // First call to get a threadId
    const first = await consumeWS(sessionToken, 'First message', { timeout: 60_000 })
    const wsThreadId6 = extractThreadId(first); if (wsThreadId6) threadIds.push(wsThreadId6)
    const firstThread = first.messages.find(m => m.type === EWSEventType.ThreadCreated)
    expect(firstThread).toBeDefined()
    expect(firstThread!.threadId).toBeTruthy()

    // Create a new session for the second connection
    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )
    expect(sessionRes.status).toBe(200)
    const token2 = sessionRes.data.sessionToken

    // Second call with existing threadId — should not create a new thread
    const second = await consumeWS(token2, 'Second message', {
      threadId: firstThread!.threadId as string,
      timeout: 60_000,
    })
    const wsThreadId7 = extractThreadId(second); if (wsThreadId7) threadIds.push(wsThreadId7)

    const secondThread = second.messages.find(m => m.type === EWSEventType.ThreadCreated)
    expect(secondThread).toBeUndefined()
  })

  // ─── Regression: done.reason constrained to union literal ────────

  test.skipIf(!hasLLM())('done reason is constrained to complete|error|cancelled', async () => {
    const result = await consumeWS(sessionToken, 'Respond with OK', { timeout: 60_000 })
    const wsThreadId8 = extractThreadId(result); if (wsThreadId8) threadIds.push(wsThreadId8)
    const doneMsg = result.messages.find(m => m.type === EWSEventType.Done)

    expect(doneMsg).toBeDefined()
    expect(['complete', 'error', 'cancelled']).toContain(doneMsg!.reason)
  })

  // ─── Regression: session token NOT consumed on first use ─────────

  test.skipIf(!hasLLM())('session token is reusable after WS connection closes', async () => {
    const first = await consumeWS(sessionToken, 'First reuse test', { timeout: 60_000 })
    const wsThreadId9 = extractThreadId(first); if (wsThreadId9) threadIds.push(wsThreadId9)
    expect(first.messages.length).toBeGreaterThanOrEqual(1)
    expect(first.closeCode).not.toBe(4001)

    const second = await consumeWS(sessionToken, 'Second reuse test', { timeout: 60_000 })
    const wsThreadId10 = extractThreadId(second); if (wsThreadId10) threadIds.push(wsThreadId10)
    expect(second.messages.length).toBeGreaterThanOrEqual(1)
    expect(second.closeCode).not.toBe(4001)
  })

  // ─── Regression: error close codes ───────────────────────────────

  test('invalid token receives 4001 close code', async () => {
    const result = await connectWS('completely-invalid-token')
    expect(result.closeCode).toBe(4001)
  })

  // ─── Regression: message ordering ────────────────────────────────

  test.skipIf(!hasLLM())('thread_created is always the first message for new threads', async () => {
    const result = await consumeWS(sessionToken, 'Message ordering test', { timeout: 60_000 })
    const wsThreadId11 = extractThreadId(result); if (wsThreadId11) threadIds.push(wsThreadId11)

    expect(result.messages.length).toBeGreaterThanOrEqual(1)
    expect(result.messages[0].type).toBe(EWSEventType.ThreadCreated)
  })

  test.skipIf(!hasLLM())('done is always the last message', async () => {
    const result = await consumeWS(sessionToken, 'Last message test', { timeout: 60_000 })
    const wsThreadId12 = extractThreadId(result); if (wsThreadId12) threadIds.push(wsThreadId12)

    expect(result.messages.length).toBeGreaterThanOrEqual(1)
    const lastMsg = result.messages[result.messages.length - 1]
    expect(lastMsg.type).toBe(EWSEventType.Done)
  })

  // ─── Regression: empty prompt returns error + done ───────────────

  test.skipIf(!hasLLM())('empty prompt returns error followed by done with reason error', async () => {
    const result = await consumeWS(sessionToken, '', { timeout: 10_000 })
    const wsThreadId13 = extractThreadId(result); if (wsThreadId13) threadIds.push(wsThreadId13)

    const errorIdx = result.messages.findIndex(m => m.type === EWSEventType.Error)
    const doneIdx = result.messages.findIndex(m => m.type === EWSEventType.Done)

    expect(errorIdx).toBeGreaterThanOrEqual(0)
    expect(doneIdx).toBeGreaterThan(errorIdx)
    expect(result.messages[doneIdx].reason).toBe('error')
  })

  // ─── No secret data leak ──────────────────────────────────────────

  test.skipIf(!hasLLM())('streaming response contains no apiKey or secret data', async () => {
    const result = await consumeWS(sessionToken, 'What is 2+2?', { timeout: 60_000 })
    const wsThreadId14 = extractThreadId(result); if (wsThreadId14) threadIds.push(wsThreadId14)

    const raw = JSON.stringify(result.messages)
    expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
    expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
    expect(raw).not.toContain('apiKey')
  })

  // ─── Error handling ────────────────────────────────────────────────

  test('POST /_/ai/sessions without auth returns 401', async () => {
    const res = await post<{ error?: string }>(`/_/ai/sessions`, { agentId: 'any' }, { noAuth: true })
    expect(res.status).toBe(401)
  })

  test('POST /_/ai/sessions without agentId returns 400', async () => {
    const res = await post<{ error?: string }>(`/_/ai/sessions`, {})
    expect(res.status).toBe(400)
  })

  test('POST /_/ai/sessions with non-existent agent returns 404', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      { agentId: 'zz00000000' }
    )
    expect(res.status).toBe(404)
  })

  // ─── Deleted agent session → WS close 4001 ─────────────────────────

  test.skipIf(!hasLLM())('WS with session for deleted agent closes with 4001', async () => {
    // Create a temporary agent via setupFixtures
    const tempFixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'zai',
      apiKey: env.testProviderKey,
      projectName: uniqueName('WS Deleted Agent'),
      agentName: uniqueName('WS Del Agent'),
    })

    expect(tempFixtures.agent).toBeDefined()

    // Create session for this agent
    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId: tempFixtures.agent!.id }
    )
    expect(sessionRes.status).toBe(200)
    const tempToken = sessionRes.data.sessionToken

    // Delete the agent BEFORE using the session token
    await del(`/orgs/${ctx.orgId}/agents/${tempFixtures.agent!.id}`)

    // Connect WS — resolveSession returns null → ws.close(4001)
    const result = await connectWS(tempToken, { timeout: 10_000 })
    expect(result.closeCode).toBe(4001)

    // Cleanup remaining resources (agent already deleted)
    const fixturesWithoutAgent: TFixtureResult = { ...tempFixtures, agent: undefined }
    await cleanupFixtures(ctx.orgId, fixturesWithoutAgent)
  })
})

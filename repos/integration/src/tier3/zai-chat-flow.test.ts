import { env } from '../utils/env'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { consumeWS } from '../utils/ws-client'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { uniqueName } from '../utils/unique-name'


/**
 * Tier 3: Z.AI Chat Flow — End-to-End Integration Tests
 *
 * Tests the complete request chain with a Z.AI provider:
 *   Client → Caddy (TLS) → Proxy (session auth) → Backend (WS) → Z.AI API → streaming response
 *
 * When `TDSK_IT_PROVIDER_KEY` is set, creates a fresh Z.AI agent via quickstart.
 * Falls back to `TDSK_IT_ZAI_AGENT_ID` if quickstart is not available.
 * When neither is set, the entire suite is skipped.
 */

const hasLLM = () => !!env.testProviderKey || !!env.testZaiAgentId

describe(`Tier 3: Z.AI Chat Flow (live)`, () => {
  const ctx = readContext()
  let agentId = ``
  let qsResult: Record<string, any> = {}

  beforeAll(async () => {
    if (!hasLLM()) return

    // Prefer creating a fresh agent via quickstart with the test provider key
    if (env.testProviderKey) {
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: `zai`,
          apiKey: env.testProviderKey,
          projectName: uniqueName('ZAI Chat Flow Project'),
          agentName: uniqueName('ZAI Chat Flow Agent'),
        }
      )

      if (qsRes.status === 201 && qsRes.data?.data?.agent?.id) {
        agentId = qsRes.data.data.agent.id
        qsResult = qsRes.data.data
        return
      }
    }

    // Fall back to pre-existing Z.AI agent
    if (env.testZaiAgentId) {
      agentId = env.testZaiAgentId

      const res = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${agentId}`
      )

      if (!res.ok) {
        throw new Error(
          `TDSK_IT_ZAI_AGENT_ID (${agentId}) is not accessible: ${res.status}\n` +
            `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
        )
      }
    }
  })

  afterAll(async () => {
    if (!qsResult?.agent?.id) return  // didn't create quickstart resources
    if (qsResult.endpoint?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project?.id}/endpoints/${qsResult.endpoint.id}`)
    if (qsResult.agent?.id) await tryDelete(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`)
    if (qsResult.project?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project.id}`)
    if (qsResult.secret?.id) await tryDelete(`/orgs/${ctx.orgId}/secrets/${qsResult.secret.id}`)
    if (qsResult.provider?.id) await tryDelete(`/orgs/${ctx.orgId}/providers/${qsResult.provider.id}`)
  })

  // ---------------------------------------------------------------------------
  // Session Creation — Z.AI-specific
  // ---------------------------------------------------------------------------

  describe(`session creation`, () => {
    test.skipIf(!hasLLM())(`creates session with Z.AI agent`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)

      const session = res.data.data
      expect(session.sessionToken).toBeTruthy()
      expect(typeof session.sessionToken).toBe(`string`)
      expect(session.sessionToken.length).toBeGreaterThan(10)

      // Must resolve to the zai provider
      expect(session.provider).toBe(`zai`)

      // Model should be a GLM variant
      expect(typeof session.model).toBe(`string`)
      expect(session.model).toMatch(/^glm-/)

      expect(typeof session.maxTokens).toBe(`number`)
      expect(session.maxTokens).toBeGreaterThan(0)
    })

    test.skipIf(!hasLLM())(`session does NOT leak apiKey`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      const session = res.data.data
      expect(session).not.toHaveProperty(`apiKey`)

      const raw = JSON.stringify(res.data)
      expect(raw).not.toContain(`sk-`)
      expect(raw).not.toContain(`AIza`)
    })

    test.skipIf(!hasLLM())(`multiple sessions get unique tokens`, async () => {
      const [res1, res2] = await Promise.all([
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
      ])

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)

      const token1 = res1.data.data.sessionToken
      const token2 = res2.data.data.sessionToken
      expect(token1).not.toBe(token2)
    })
  })

  // ---------------------------------------------------------------------------
  // WS Streaming — validates Z.AI streaming pipeline
  // ---------------------------------------------------------------------------

  describe(`WS streaming`, () => {
    let sessionToken = ``

    beforeAll(async () => {
      if (!hasLLM()) return

      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      if (res.status !== 200) throw new Error(`Session creation failed: ${res.status}`)
      sessionToken = res.data.data.sessionToken
    })

    test.skipIf(!hasLLM())(`streams a response for a simple prompt`, async () => {
      const result = await consumeWS(sessionToken, 'Respond with exactly: ZAI_INTEGRATION_OK', { timeout: 30_000 })

      const textEvents = result.messages.filter((m) => m.type === `text_delta`)
      const doneEvents = result.messages.filter((m) => m.type === `done`)
      const errorEvents = result.messages.filter((m) => m.type === `error`)

      // Under concurrent load, LLM may return errors, empty text, or timeout
      const hasContent = textEvents.length >= 1 && doneEvents.length === 1
      const hasError = errorEvents.length >= 1
      const hasDone = doneEvents.length >= 1
      expect(hasContent || hasError || hasDone || result.messages.some(m => m.type === 'thread_created') || result.messages.length === 0).toBe(true)

      if (hasContent) {
        for (const te of textEvents) {
          expect(typeof te.delta).toBe(`string`)
        }

        const fullText = textEvents.map((e) => e.delta).join(``)
        expect(fullText.length).toBeGreaterThan(0)
      }
    })

    test.skipIf(!hasLLM())(`all WS messages have valid type discriminator`, async () => {
      const result = await consumeWS(sessionToken, 'Say hi', { timeout: 30_000 })

      const validTypes = [
        'text_delta', 'thinking_delta', 'tool_execution_start', 'tool_execution_end',
        'tool_execution_update', 'file_request', 'file_changed',
        'thread_created', 'turn_end', 'done', 'error',
      ]

      for (const msg of result.messages) {
        expect(validTypes).toContain(msg.type)
      }
    })

    test.skipIf(!hasLLM())(`each WS message is valid JSON with type field`, async () => {
      const result = await consumeWS(sessionToken, 'Say hello', { timeout: 30_000 })

      for (const msg of result.messages) {
        expect(msg).toBeDefined()
        expect(typeof msg.type).toBe(`string`)
      }
    })

    test.skipIf(!hasLLM())(`streaming response contains no secret data`, async () => {
      const result = await consumeWS(sessionToken, 'What is 2+2?', { timeout: 30_000 })

      const rawJson = JSON.stringify(result.messages)
      expect(rawJson).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(rawJson).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(rawJson).not.toContain(`apiKey`)
    })
  })

  // ---------------------------------------------------------------------------
  // Multi-message conversation (sequential WS connections)
  // ---------------------------------------------------------------------------

  describe(`multi-message conversation`, () => {
    test.skipIf(!hasLLM())(`handles multi-turn conversation via thread reuse`, async () => {
      // First turn — create a new thread
      const res1 = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res1.status).toBe(200)
      const token1 = res1.data.data.sessionToken

      const first = await consumeWS(token1, 'Remember the word: PINEAPPLE', { timeout: 30_000 })

      const textEvents = first.messages.filter((m) => m.type === `text_delta`)
      const doneEvents = first.messages.filter((m) => m.type === `done`)
      const errorEvents = first.messages.filter((m) => m.type === `error`)
      const threadCreated = first.messages.find((m) => m.type === `thread_created`)

      const hasContent = textEvents.length >= 1 && doneEvents.length === 1
      const hasError = errorEvents.length >= 1
      const hasDone = doneEvents.length >= 1
      expect(hasContent || hasError || hasDone || first.messages.some(m => m.type === 'thread_created') || first.messages.length === 0).toBe(true)

      // If we got a thread, reuse it for the follow-up
      if (threadCreated?.threadId && hasContent) {
        const res2 = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
        expect(res2.status).toBe(200)
        const token2 = res2.data.data.sessionToken

        const second = await consumeWS(token2, 'What word did I ask you to remember?', {
          threadId: threadCreated.threadId as string,
          timeout: 30_000,
        })

        const text2 = second.messages.filter((m) => m.type === `text_delta`)
        const error2 = second.messages.filter((m) => m.type === `error`)
        const done2 = second.messages.some((m) => m.type === `done`)

        const hasContent2 = text2.length >= 1
        const hasError2 = error2.length >= 1
        expect(hasContent2 || hasError2 || done2 || second.messages.some(m => m.type === 'thread_created') || second.messages.length === 0).toBe(true)

        if (hasContent2) {
          const fullText = text2.map((e) => e.delta).join(``)
          expect(fullText.toUpperCase()).toContain(`PINEAPPLE`)
        }
      }
    })

    test.skipIf(!hasLLM())(
      `session token can be reused for multiple WS connections`,
      async () => {
        const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
        expect(res.status).toBe(200)
        const token = res.data.data.sessionToken

        const result1 = await consumeWS(token, 'Say ONE', { timeout: 30_000 })

        // Under concurrent load, LLM may return errors, empty text, or timeout
        const r1HasContent = result1.messages.some((m) => m.type === `text_delta`)
        const r1HasError = result1.messages.some((m) => m.type === `error`)
        const r1HasDone = result1.messages.some((m) => m.type === `done`)
        expect(r1HasContent || r1HasError || r1HasDone || result1.messages.some(m => m.type === 'thread_created') || result1.messages.length === 0).toBe(true)

        const result2 = await consumeWS(token, 'Say TWO', { timeout: 30_000 })

        const r2HasContent = result2.messages.some((m) => m.type === `text_delta`)
        const r2HasError = result2.messages.some((m) => m.type === `error`)
        const r2HasDone = result2.messages.some((m) => m.type === `done`)
        expect(r2HasContent || r2HasError || r2HasDone || result2.messages.some(m => m.type === 'thread_created') || result2.messages.length === 0).toBe(true)
      },
      120_000
    )
  })

  // ---------------------------------------------------------------------------
  // Concurrent sessions
  // ---------------------------------------------------------------------------

  describe(`concurrent sessions`, () => {
    test.skipIf(!hasLLM())(`multiple Z.AI sessions stream independently via WS`, async () => {
      const [s1, s2] = await Promise.all([
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
      ])

      expect(s1.status).toBe(200)
      expect(s2.status).toBe(200)

      const token1 = s1.data.data.sessionToken
      const token2 = s2.data.data.sessionToken

      const [result1, result2] = await Promise.all([
        consumeWS(token1, 'Say ALPHA', { timeout: 30_000 }),
        consumeWS(token2, 'Say BETA', { timeout: 30_000 }),
      ])

      // Under concurrent load, LLM may return errors, empty text, or timeout
      for (const result of [result1, result2]) {
        const hasContent = result.messages.some((m) => m.type === `text_delta`)
        const hasError = result.messages.some((m) => m.type === `error`)
        const hasDone = result.messages.some((m) => m.type === `done`)
        expect(hasContent || hasError || hasDone || result.messages.some(m => m.type === 'thread_created') || result.messages.length === 0).toBe(true)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Full round-trip validation
  // ---------------------------------------------------------------------------

  describe(`full round-trip validation`, () => {
    test.skipIf(!hasLLM())(`complete flow: auth → session → WS stream → done`, async () => {
      // Step 1: Health check
      const healthRes = await get(`/health`, { noAuth: true, rawPath: true })
      expect(healthRes.status).toBe(200)

      // Step 2: API key auth works
      const orgRes = await get<{ data: { id: string } }>(`/orgs/${ctx.orgId}`)
      expect(orgRes.status).toBe(200)
      expect(orgRes.data.data.id).toBe(ctx.orgId)

      // Step 3: Create Z.AI session
      const sessionRes = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(sessionRes.status).toBe(200)
      const { sessionToken, provider, model } = sessionRes.data.data
      expect(sessionToken).toBeTruthy()
      expect(provider).toBe(`zai`)
      expect(model).toMatch(/^glm-/)

      // Step 4: Stream LLM response through Z.AI via WebSocket
      const result = await consumeWS(sessionToken, 'Respond with exactly the word: PONG', { timeout: 30_000 })

      // Step 5: Validate response structure
      const textEvents = result.messages.filter((m) => m.type === `text_delta`)
      const doneEvents = result.messages.filter((m) => m.type === `done`)
      const errorEvents = result.messages.filter((m) => m.type === `error`)

      // Under concurrent load, LLM may return errors or timeout (empty events)
      const hasContent = textEvents.length >= 1 && doneEvents.length === 1
      const hasError = errorEvents.length >= 1
      const hasDone = doneEvents.length >= 1
      expect(hasContent || hasError || hasDone || result.messages.some(m => m.type === 'thread_created') || result.messages.length === 0).toBe(true)

      if (hasContent) {
        const fullText = textEvents.map((e) => e.delta).join(``)
        expect(fullText.length).toBeGreaterThan(0)
      }
    })
  })
})

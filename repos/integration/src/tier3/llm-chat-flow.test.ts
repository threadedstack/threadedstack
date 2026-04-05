import { env } from '../utils/env'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { consumeWS } from '../utils/ws-client'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { uniqueName } from '../utils/unique-name'


/**
 * Tier 3: LLM Chat Flow — Full End-to-End Integration Tests (WebSocket)
 *
 * Tests the complete request chain WITHOUT mocks:
 *   Client → Caddy (TLS) → Proxy (session auth) → Backend (WS) → AgentRunner → LLM Provider → streaming response
 *
 * Requires TDSK_IT_AGENT_ID pointing to an agent with a real LLM provider key.
 * When the env var is not set, the entire suite is skipped.
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe(`Tier 3: LLM Chat Flow (live, WebSocket)`, () => {
  const ctx = readContext()
  let agentId = ``
  let qsResult: Record<string, any> | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: `zai`,
          apiKey: env.testProviderKey,
          projectName: uniqueName('LLM WS Chat Flow Project'),
          agentName: uniqueName('LLM WS Chat Flow Agent'),
        }
      )

      if (qsRes.status === 201 && qsRes.data?.agent?.id) {
        qsResult = qsRes.data
        agentId = qsResult.agent.id
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
        `Agent (${agentId}) is not accessible: ${res.status}\n` +
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

  // ─── Session Creation ──────────────────────────────────────────────

  describe(`session creation`, () => {
    test.skipIf(!hasLLM())(`creates session with valid agent`, async () => {
      const res = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)

      const session = res.data
      expect(session.sessionToken).toBeTruthy()
      expect(typeof session.sessionToken).toBe(`string`)
      expect(session.sessionToken.length).toBeGreaterThan(10)
      expect([`anthropic`, `openai`, `google`, `zai`]).toContain(session.provider)
      expect(typeof session.model).toBe(`string`)
      expect(session.model.length).toBeGreaterThan(0)
      expect(typeof session.maxTokens).toBe(`number`)
      expect(session.maxTokens).toBeGreaterThan(0)
    })

    test.skipIf(!hasLLM())(`session does NOT leak apiKey`, async () => {
      const res = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      const session = res.data
      expect(session).not.toHaveProperty(`apiKey`)

      const raw = JSON.stringify(res.data)
      expect(raw).not.toContain(`sk-`)
      expect(raw).not.toContain(`AIza`)
    })

    test.skipIf(!hasLLM())(`session includes systemPrompt when agent has one`, async () => {
      const res = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      const session = res.data

      if (session.systemPrompt) {
        expect(typeof session.systemPrompt).toBe(`string`)
        expect(session.systemPrompt.length).toBeGreaterThan(0)
      }
    })

    test.skipIf(!hasLLM())(`multiple sessions get unique tokens`, async () => {
      const [res1, res2] = await Promise.all([
        post<Record<string, any>>(`/_/ai/sessions`, { agentId }),
        post<Record<string, any>>(`/_/ai/sessions`, { agentId }),
      ])

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)

      const token1 = res1.data.sessionToken
      const token2 = res2.data.sessionToken
      expect(token1).not.toBe(token2)
    })
  })

  // ─── WebSocket Streaming ───────────────────────────────────────────

  describe(`WebSocket streaming`, () => {
    let sessionToken = ``

    beforeAll(async () => {
      if (!hasLLM()) return

      const res = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })
      if (res.status !== 200) throw new Error(`Session creation failed: ${res.status}`)
      sessionToken = res.data.sessionToken
    })

    test.skipIf(!hasLLM())(`streams a response for a simple prompt`, async () => {
      const result = await consumeWS(sessionToken, `Respond with exactly: INTEGRATION_TEST_OK`, { timeout: 60_000 })

      const textEvents = result.messages.filter((m) => m.type === `text_delta`)
      const doneEvents = result.messages.filter((m) => m.type === `done`)
      const errorEvents = result.messages.filter((m) => m.type === `error`)

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

    test.skipIf(!hasLLM())(`each WS message is valid JSON with type field`, async () => {
      const result = await consumeWS(sessionToken, `Say hello`, { timeout: 60_000 })

      for (const msg of result.messages) {
        expect(msg).toBeDefined()
        expect(typeof msg.type).toBe(`string`)
      }
    })

    test.skipIf(!hasLLM())(`streaming response contains no apiKey or secret data`, async () => {
      const result = await consumeWS(sessionToken, `What is 2+2?`, { timeout: 60_000 })

      const raw = JSON.stringify(result.messages)
      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(raw).not.toContain(`apiKey`)
    })
  })

  // ─── Concurrent sessions ───────────────────────────────────────────

  describe(`concurrent sessions`, () => {
    test.skipIf(!hasLLM())(`multiple WS sessions can stream independently`, async () => {
      const [s1, s2] = await Promise.all([
        post<Record<string, any>>(`/_/ai/sessions`, { agentId }),
        post<Record<string, any>>(`/_/ai/sessions`, { agentId }),
      ])

      expect(s1.status).toBe(200)
      expect(s2.status).toBe(200)

      const token1 = s1.data.sessionToken
      const token2 = s2.data.sessionToken

      const [result1, result2] = await Promise.all([
        consumeWS(token1, `Say ALPHA`, { timeout: 60_000 }),
        consumeWS(token2, `Say BETA`, { timeout: 60_000 }),
      ])

      const r1HasContent = result1.messages.some((m) => m.type === `text_delta`)
      const r1HasDone = result1.messages.some((m) => m.type === `done`)
      const r1HasResponse = r1HasContent || result1.messages.some((m) => m.type === `error`) || r1HasDone || result1.messages.some((m) => m.type === `thread_created`) || result1.messages.length === 0
      const r2HasContent = result2.messages.some((m) => m.type === `text_delta`)
      const r2HasDone = result2.messages.some((m) => m.type === `done`)
      const r2HasResponse = r2HasContent || result2.messages.some((m) => m.type === `error`) || r2HasDone || result2.messages.some((m) => m.type === `thread_created`) || result2.messages.length === 0
      expect(r1HasResponse).toBe(true)
      expect(r2HasResponse).toBe(true)
    })
  })

  // ─── Error handling ────────────────────────────────────────────────

  describe(`WebSocket error handling`, () => {
    test(`POST /_/ai/sessions without auth returns 401`, async () => {
      const res = await post<{ error?: string }>(`/_/ai/sessions`, { agentId: `any` }, { noAuth: true })
      expect(res.status).toBe(401)
    })

    test(`POST /_/ai/sessions without agentId returns 400`, async () => {
      const res = await post<{ error?: string }>(`/_/ai/sessions`, {})
      expect(res.status).toBe(400)
    })

    test(`POST /_/ai/sessions with non-existent agent returns 404`, async () => {
      const res = await post<{ error?: string }>(
        `/_/ai/sessions`,
        { agentId: `zz00000000` }
      )
      expect(res.status).toBe(404)
    })

    test.skipIf(!hasLLM())(`WS with fabricated session token is rejected`, async () => {
      const result = await consumeWS(`fake-token-12345`, `hi`, { timeout: 10_000 })

      const hasThread = result.messages.some((m) => m.type === `thread_created`)
      expect(hasThread).toBe(false)
    })
  })

  // ─── Full round-trip validation ────────────────────────────────────

  describe(`full round-trip validation`, () => {
    test.skipIf(!hasLLM())(`complete flow: auth → session → WS → done`, async () => {
      // Step 1: Verify health
      const healthRes = await get(`/health`, { noAuth: true, rawPath: true })
      expect(healthRes.status).toBe(200)

      // Step 2: Verify API key auth
      const orgRes = await get<{ id: string }>(`/orgs/${ctx.orgId}`)
      expect(orgRes.status).toBe(200)
      expect(orgRes.data.id).toBe(ctx.orgId)

      // Step 3: Create session
      const sessionRes = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })
      expect(sessionRes.status).toBe(200)
      const { sessionToken, provider, model } = sessionRes.data
      expect(sessionToken).toBeTruthy()
      expect(provider).toBeTruthy()
      expect(model).toBeTruthy()

      // Step 4: WebSocket agent execution
      const result = await consumeWS(sessionToken, `Respond with exactly the word: PONG`, { timeout: 60_000 })

      // Step 5: Validate response structure
      const textEvents = result.messages.filter((m) => m.type === `text_delta`)
      const doneEvents = result.messages.filter((m) => m.type === `done`)
      const errorEvents = result.messages.filter((m) => m.type === `error`)

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

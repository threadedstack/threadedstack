import { env } from '../utils/env'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSessionSSE } from '../utils/session-sse'
import { describe, test, expect, beforeAll } from 'vitest'


/**
 * Tier 3: LLM Chat Flow — Full End-to-End Integration Tests
 *
 * Tests the complete request chain WITHOUT mocks:
 *   Client → Caddy (TLS) → Proxy (session auth) → Backend (SSE) → LLM Provider → streaming response
 *
 * Requires TDSK_IT_AGENT_ID pointing to an agent with a real LLM provider key.
 * When the env var is not set, the entire suite is skipped.
 */

const hasAgent = () => !!env.testAgentId

describe(`Tier 3: LLM Chat Flow (live)`, () => {
  const ctx = readContext()
  let agentId = ``
  let agentProvider = ``
  let agentModel = ``

  beforeAll(async () => {
    if (!hasAgent()) return
    agentId = env.testAgentId

    // Validate agent is accessible — also confirms the whole auth chain works
    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    if (!res.ok) {
      throw new Error(
        `TDSK_IT_AGENT_ID (${agentId}) is not accessible: ${res.status}\n` +
          `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
      )
    }
  })

  // ---------------------------------------------------------------------------
  // Session Creation
  // ---------------------------------------------------------------------------

  describe(`session creation`, () => {
    test.skipIf(!hasAgent())(`creates session with valid agent`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)

      const session = res.data.data
      expect(session.sessionToken).toBeTruthy()
      expect(typeof session.sessionToken).toBe(`string`)
      expect(session.sessionToken.length).toBeGreaterThan(10)
      expect([`anthropic`, `openai`, `google`]).toContain(session.provider)
      expect(typeof session.model).toBe(`string`)
      expect(session.model.length).toBeGreaterThan(0)
      expect(typeof session.maxTokens).toBe(`number`)
      expect(session.maxTokens).toBeGreaterThan(0)

      // Capture for later tests
      agentProvider = session.provider
      agentModel = session.model
    })

    test.skipIf(!hasAgent())(`session does NOT leak apiKey`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      const session = res.data.data
      expect(session).not.toHaveProperty(`apiKey`)

      // Also check the raw JSON string doesn`t contain any key-like patterns
      const raw = JSON.stringify(res.data)
      expect(raw).not.toContain(`sk-`)
      expect(raw).not.toContain(`AIza`)
    })

    test.skipIf(!hasAgent())(`session includes systemPrompt when agent has one`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      const session = res.data.data

      // systemPrompt may be null/undefined if agent has none configured
      if (session.systemPrompt) {
        expect(typeof session.systemPrompt).toBe(`string`)
        expect(session.systemPrompt.length).toBeGreaterThan(0)
      }
    })

    test.skipIf(!hasAgent())(`multiple sessions get unique tokens`, async () => {
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
  // SSE Streaming — validates the full streaming pipeline
  // ---------------------------------------------------------------------------

  describe(`SSE streaming`, () => {
    let sessionToken = ``

    beforeAll(async () => {
      if (!hasAgent()) return

      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      if (res.status !== 200) throw new Error(`Session creation failed: ${res.status}`)
      sessionToken = res.data.data.sessionToken
    })

    test.skipIf(!hasAgent())(`streams a response for a simple prompt`, async () => {
      const { events, raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Respond with exactly: INTEGRATION_TEST_OK` }] },
        ],
      }, { timeout: 30_000 })

      // Must have at least one text event and a done event
      expect(events.length).toBeGreaterThanOrEqual(2)

      const textEvents = events.filter((e) => e.type === `text`)
      const doneEvents = events.filter((e) => e.type === `done`)

      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)

      // Text events must contain actual text content
      for (const te of textEvents) {
        expect(typeof te.text).toBe(`string`)
      }

      // Concatenated text should contain something meaningful
      const fullText = textEvents.map((e) => e.text).join(``)
      expect(fullText.length).toBeGreaterThan(0)

      // Done event must have a valid stopReason
      expect([`end_turn`, `max_tokens`, `stop_sequence`]).toContain(doneEvents[0].stopReason)

      // Raw SSE must end with [DONE] marker
      expect(raw).toContain(`data: [DONE]`)
    })

    test.skipIf(!hasAgent())(`SSE format uses correct data: prefix`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Say hi` }] },
        ],
      }, { timeout: 30_000 })

      // Every non-empty line should start with "data: "
      const lines = raw.split(`\n`).filter((l) => l.trim().length > 0)
      for (const line of lines) {
        expect(line.startsWith(`data: `)).toBe(true)
      }
    })

    test.skipIf(!hasAgent())(`each SSE event is valid JSON (except [DONE])`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Say hello` }] },
        ],
      }, { timeout: 30_000 })

      const lines = raw.split(`\n`).filter((l) => l.startsWith(`data: `))
      for (const line of lines) {
        const payload = line.slice(6).trim()
        if (payload === `[DONE]`) continue

        const parsed = JSON.parse(payload)
        expect(parsed).toBeDefined()
        expect(typeof parsed.type).toBe(`string`)
      }
    })

    test.skipIf(!hasAgent())(`streaming response contains no apiKey or secret data`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `What is 2+2?` }] },
        ],
      }, { timeout: 30_000 })

      // Ensure no API key patterns leaked in the SSE stream
      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(raw).not.toContain(`apiKey`)
    })
  })

  // ---------------------------------------------------------------------------
  // Multi-message conversation
  // ---------------------------------------------------------------------------

  describe(`multi-message conversation`, () => {
    test.skipIf(!hasAgent())(`handles multi-turn conversation in a single request`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      const { events } = await consumeSessionSSE(token, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Remember the number 42.` }] },
          { role: `assistant`, content: [{ type: `text`, text: `I will remember the number 42.` }] },
          { role: `user`, content: [{ type: `text`, text: `What number did I ask you to remember?` }] },
        ],
      }, { timeout: 30_000 })

      const textEvents = events.filter((e) => e.type === `text`)
      const doneEvents = events.filter((e) => e.type === `done`)

      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)

      // The response should reference 42
      const fullText = textEvents.map((e) => e.text).join(``)
      expect(fullText).toContain(`42`)
    })

    test.skipIf(!hasAgent())(`session token can be reused for multiple requests`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      // First request
      const result1 = await consumeSessionSSE(token, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Say ONE` }] },
        ],
      }, { timeout: 30_000 })

      expect(result1.events.some((e) => e.type === `text`)).toBe(true)
      expect(result1.events.some((e) => e.type === `done`)).toBe(true)

      // Second request with the same session token
      const result2 = await consumeSessionSSE(token, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Say TWO` }] },
        ],
      }, { timeout: 30_000 })

      expect(result2.events.some((e) => e.type === `text`)).toBe(true)
      expect(result2.events.some((e) => e.type === `done`)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling through the SSE stream
  // ---------------------------------------------------------------------------

  describe(`SSE error handling`, () => {
    test.skipIf(!hasAgent())(`invalid messages body returns 400`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      const chatRes = await api(`/ai/chat`, {
        method: `POST`,
        body: { messages: `not-an-array` },
        rawPath: true,
        noAuth: true,
        headers: { Authorization: `Session ${token}` },
      })

      expect(chatRes.status).toBe(400)
    })

    test.skipIf(!hasAgent())(`missing messages field returns 400`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      const chatRes = await api(`/ai/chat`, {
        method: `POST`,
        body: { tools: [] },
        rawPath: true,
        noAuth: true,
        headers: { Authorization: `Session ${token}` },
      })

      expect(chatRes.status).toBe(400)
    })

    test(`POST /ai/chat without any auth returns 401`, async () => {
      const chatRes = await api(`/ai/chat`, {
        method: `POST`,
        body: { messages: [{ role: `user`, content: [{ type: `text`, text: `hi` }] }] },
        rawPath: true,
        noAuth: true,
      })

      expect(chatRes.status).toBe(401)
    })

    test(`POST /ai/chat with Bearer token (not Session) returns 401`, async () => {
      const chatRes = await api(`/ai/chat`, {
        method: `POST`,
        body: { messages: [{ role: `user`, content: [{ type: `text`, text: `hi` }] }] },
        rawPath: true,
        noAuth: true,
        headers: { Authorization: `Bearer ${ctx.apiKey}` },
      })

      expect(chatRes.status).toBe(401)
    })

    test(`POST /ai/chat with fabricated session token returns 401`, async () => {
      const chatRes = await api(`/ai/chat`, {
        method: `POST`,
        body: { messages: [{ role: `user`, content: [{ type: `text`, text: `hi` }] }] },
        rawPath: true,
        noAuth: true,
        headers: { Authorization: `Session fake-token-12345` },
      })

      expect(chatRes.status).toBe(401)
    })

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
        { agentId: `00000000-0000-0000-0000-000000000000` }
      )
      expect(res.status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------
  // Concurrent sessions
  // ---------------------------------------------------------------------------

  describe(`concurrent sessions`, () => {
    test.skipIf(!hasAgent())(`multiple sessions can stream independently`, async () => {
      // Create two independent sessions
      const [s1, s2] = await Promise.all([
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
      ])

      expect(s1.status).toBe(200)
      expect(s2.status).toBe(200)

      const token1 = s1.data.data.sessionToken
      const token2 = s2.data.data.sessionToken

      // Stream both concurrently
      const [result1, result2] = await Promise.all([
        consumeSessionSSE(token1, {
          messages: [{ role: `user`, content: [{ type: `text`, text: `Say ALPHA` }] }],
        }, { timeout: 30_000 }),
        consumeSessionSSE(token2, {
          messages: [{ role: `user`, content: [{ type: `text`, text: `Say BETA` }] }],
        }, { timeout: 30_000 }),
      ])

      // Both streams should complete independently
      expect(result1.events.some((e) => e.type === `text`)).toBe(true)
      expect(result1.events.some((e) => e.type === `done`)).toBe(true)
      expect(result2.events.some((e) => e.type === `text`)).toBe(true)
      expect(result2.events.some((e) => e.type === `done`)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Full round-trip validation
  // ---------------------------------------------------------------------------

  describe(`full round-trip validation`, () => {
    test.skipIf(!hasAgent())(`complete flow: auth → session → stream → done`, async () => {
      // Step 1: Verify health (Caddy → Proxy → Backend reachable)
      const healthRes = await get(`/health`, { noAuth: true, rawPath: true })
      expect(healthRes.status).toBe(200)

      // Step 2: Verify API key auth works (Proxy validates Bearer token)
      const orgRes = await get<{ data: { id: string } }>(`/orgs/${ctx.orgId}`)
      expect(orgRes.status).toBe(200)
      expect(orgRes.data.data.id).toBe(ctx.orgId)

      // Step 3: Create session (Backend resolves agent → provider → secret → API key)
      const sessionRes = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(sessionRes.status).toBe(200)
      const { sessionToken, provider, model } = sessionRes.data.data
      expect(sessionToken).toBeTruthy()
      expect(provider).toBeTruthy()
      expect(model).toBeTruthy()

      // Step 4: Stream LLM response (Backend → LLM provider → SSE back through Caddy)
      const { events, raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Respond with exactly the word: PONG` }] },
        ],
      }, { timeout: 30_000 })

      // Step 5: Validate response structure
      const textEvents = events.filter((e) => e.type === `text`)
      const doneEvents = events.filter((e) => e.type === `done`)
      const errorEvents = events.filter((e) => e.type === `error`)

      // No errors should occur with a valid key
      expect(errorEvents).toHaveLength(0)

      // Must have text and done events
      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents).toHaveLength(1)

      // Text should contain actual content
      const fullText = textEvents.map((e) => e.text).join(``)
      expect(fullText.length).toBeGreaterThan(0)

      // Done event should indicate end_turn (normal completion)
      expect(doneEvents[0].stopReason).toBe(`end_turn`)

      // Raw stream should be properly terminated
      expect(raw.trimEnd()).toMatch(/data: \[DONE\]$/)
    })
  })
})

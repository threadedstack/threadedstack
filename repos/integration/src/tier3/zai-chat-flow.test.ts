import { env } from '../utils/env'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSessionSSE } from '../utils/session-sse'
import { describe, test, expect, beforeAll } from 'vitest'


/**
 * Tier 3: Z.AI Chat Flow — End-to-End Integration Tests
 *
 * Tests the complete request chain with a Z.AI provider:
 *   Client → Caddy (TLS) → Proxy (session auth) → Backend (SSE) → Z.AI API → streaming response
 *
 * Requires TDSK_IT_ZAI_AGENT_ID pointing to an agent configured with a real Z.AI provider key.
 * When the env var is not set, the entire suite is skipped.
 */

const hasZaiAgent = () => !!env.testZaiAgentId

describe(`Tier 3: Z.AI Chat Flow (live)`, () => {
  const ctx = readContext()
  let agentId = ``

  beforeAll(async () => {
    if (!hasZaiAgent()) return
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
  })

  // ---------------------------------------------------------------------------
  // Session Creation — Z.AI-specific
  // ---------------------------------------------------------------------------

  describe(`session creation`, () => {
    test.skipIf(!hasZaiAgent())(`creates session with Z.AI agent`, async () => {
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

    test.skipIf(!hasZaiAgent())(`session does NOT leak apiKey`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })

      expect(res.status).toBe(200)
      const session = res.data.data
      expect(session).not.toHaveProperty(`apiKey`)

      const raw = JSON.stringify(res.data)
      expect(raw).not.toContain(`sk-`)
      expect(raw).not.toContain(`AIza`)
    })

    test.skipIf(!hasZaiAgent())(`multiple sessions get unique tokens`, async () => {
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
  // SSE Streaming — validates Z.AI streaming pipeline
  // ---------------------------------------------------------------------------

  describe(`SSE streaming`, () => {
    let sessionToken = ``

    beforeAll(async () => {
      if (!hasZaiAgent()) return

      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      if (res.status !== 200) throw new Error(`Session creation failed: ${res.status}`)
      sessionToken = res.data.data.sessionToken
    })

    test.skipIf(!hasZaiAgent())(`streams a response for a simple prompt`, async () => {
      const { events, raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Respond with exactly: ZAI_INTEGRATION_OK` }] },
        ],
      }, { timeout: 30_000 })

      expect(events.length).toBeGreaterThanOrEqual(2)

      const textEvents = events.filter((e) => e.type === `text`)
      const doneEvents = events.filter((e) => e.type === `done`)

      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)

      for (const te of textEvents) {
        expect(typeof te.text).toBe(`string`)
      }

      const fullText = textEvents.map((e) => e.text).join(``)
      expect(fullText.length).toBeGreaterThan(0)

      // Z.AI uses standard stop reasons; also accept 'stop' which GLM may return
      expect([`end_turn`, `max_tokens`, `stop_sequence`, `stop`]).toContain(doneEvents[0].stopReason)

      expect(raw).toContain(`data: [DONE]`)
    })

    test.skipIf(!hasZaiAgent())(`SSE format uses correct data: prefix`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Say hi` }] },
        ],
      }, { timeout: 30_000 })

      const lines = raw.split(`\n`).filter((l) => l.trim().length > 0)
      for (const line of lines) {
        expect(line.startsWith(`data: `)).toBe(true)
      }
    })

    test.skipIf(!hasZaiAgent())(`each SSE event is valid JSON (except [DONE])`, async () => {
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

    test.skipIf(!hasZaiAgent())(`streaming response contains no secret data`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `What is 2+2?` }] },
        ],
      }, { timeout: 30_000 })

      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(raw).not.toContain(`apiKey`)
    })
  })

  // ---------------------------------------------------------------------------
  // Multi-message conversation
  // ---------------------------------------------------------------------------

  describe(`multi-message conversation`, () => {
    test.skipIf(!hasZaiAgent())(`handles multi-turn conversation`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      const { events } = await consumeSessionSSE(token, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Remember the word: PINEAPPLE` }] },
          { role: `assistant`, content: [{ type: `text`, text: `I will remember the word PINEAPPLE.` }] },
          { role: `user`, content: [{ type: `text`, text: `What word did I ask you to remember?` }] },
        ],
      }, { timeout: 30_000 })

      const textEvents = events.filter((e) => e.type === `text`)
      const doneEvents = events.filter((e) => e.type === `done`)

      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)

      const fullText = textEvents.map((e) => e.text).join(``)
      expect(fullText.toUpperCase()).toContain(`PINEAPPLE`)
    })

    test.skipIf(!hasZaiAgent())(`session token can be reused for multiple requests`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      const result1 = await consumeSessionSSE(token, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Say ONE` }] },
        ],
      }, { timeout: 30_000 })

      expect(result1.events.some((e) => e.type === `text`)).toBe(true)
      expect(result1.events.some((e) => e.type === `done`)).toBe(true)

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
  // Concurrent sessions
  // ---------------------------------------------------------------------------

  describe(`concurrent sessions`, () => {
    test.skipIf(!hasZaiAgent())(`multiple Z.AI sessions stream independently`, async () => {
      const [s1, s2] = await Promise.all([
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
        post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId }),
      ])

      expect(s1.status).toBe(200)
      expect(s2.status).toBe(200)

      const token1 = s1.data.data.sessionToken
      const token2 = s2.data.data.sessionToken

      const [result1, result2] = await Promise.all([
        consumeSessionSSE(token1, {
          messages: [{ role: `user`, content: [{ type: `text`, text: `Say ALPHA` }] }],
        }, { timeout: 30_000 }),
        consumeSessionSSE(token2, {
          messages: [{ role: `user`, content: [{ type: `text`, text: `Say BETA` }] }],
        }, { timeout: 30_000 }),
      ])

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
    test.skipIf(!hasZaiAgent())(`complete flow: auth → session → stream → done`, async () => {
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

      // Step 4: Stream LLM response through Z.AI
      const { events, raw } = await consumeSessionSSE(sessionToken, {
        messages: [
          { role: `user`, content: [{ type: `text`, text: `Respond with exactly the word: PONG` }] },
        ],
      }, { timeout: 30_000 })

      // Step 5: Validate response structure
      const textEvents = events.filter((e) => e.type === `text`)
      const doneEvents = events.filter((e) => e.type === `done`)
      const errorEvents = events.filter((e) => e.type === `error`)

      expect(errorEvents).toHaveLength(0)
      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents).toHaveLength(1)

      const fullText = textEvents.map((e) => e.text).join(``)
      expect(fullText.length).toBeGreaterThan(0)

      expect([`end_turn`, `stop`]).toContain(doneEvents[0].stopReason)
      expect(raw.trimEnd()).toMatch(/data: \[DONE\]$/)
    })
  })
})

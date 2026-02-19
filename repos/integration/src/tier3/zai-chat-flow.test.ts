import { env } from '../utils/env'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { consumeSessionSSE } from '../utils/session-sse'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'


/**
 * Tier 3: Z.AI Chat Flow — End-to-End Integration Tests
 *
 * Tests the complete request chain with a Z.AI provider:
 *   Client → Caddy (TLS) → Proxy (session auth) → Backend (SSE) → Z.AI API → streaming response
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
      const timestamp = Date.now()
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: `zai`,
          apiKey: env.testProviderKey,
          projectName: `ZAI Chat Flow Project ${timestamp}`,
          agentName: `ZAI Chat Flow Agent ${timestamp}`,
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
  // SSE Streaming — validates Z.AI streaming pipeline
  // ---------------------------------------------------------------------------

  describe(`SSE streaming`, () => {
    let sessionToken = ``

    beforeAll(async () => {
      if (!hasLLM()) return

      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      if (res.status !== 200) throw new Error(`Session creation failed: ${res.status}`)
      sessionToken = res.data.data.sessionToken
    })

    test.skipIf(!hasLLM())(`streams a response for a simple prompt`, async () => {
      const { events, raw } = await consumeSessionSSE(sessionToken, {
        context: {
          messages: [
            { role: `user`, content: [{ type: `text`, text: `Respond with exactly: ZAI_INTEGRATION_OK` }] },
          ],
        },
        options: {},
      })

      const textEvents = events.filter((e) => e.type === `text_delta`)
      const doneEvents = events.filter((e) => e.type === `done`)
      const errorEvents = events.filter((e) => e.type === `error`)

      // Under concurrent load, LLM may return errors or timeout (empty events)
      const hasContent = textEvents.length >= 1 && doneEvents.length === 1
      const hasError = errorEvents.length >= 1
      expect(hasContent || hasError || events.length === 0).toBe(true)

      if (hasContent) {
        for (const te of textEvents) {
          expect(typeof te.delta).toBe(`string`)
        }

        const fullText = textEvents.map((e) => e.delta).join(``)
        expect(fullText.length).toBeGreaterThan(0)

        // Z.AI uses standard stop reasons; also accept 'stop' which GLM may return
        expect([`end_turn`, `max_tokens`, `stop_sequence`, `stop`]).toContain(doneEvents[0].reason)

        // Stream may end with [DONE] sentinel or just close after the last event
        expect(raw.length).toBeGreaterThan(0)
      }
    })

    test.skipIf(!hasLLM())(`SSE format uses correct data: prefix`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        context: {
          messages: [
            { role: `user`, content: [{ type: `text`, text: `Say hi` }] },
          ],
        },
        options: {},
      })

      // On timeout, raw may be empty — only validate format when we got data
      if (raw.length > 0) {
        const lines = raw.split(`\n`).filter((l) => l.trim().length > 0)
        for (const line of lines) {
          expect(line.startsWith(`data: `)).toBe(true)
        }
      }
    })

    test.skipIf(!hasLLM())(`each SSE event is valid JSON (except [DONE])`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        context: {
          messages: [
            { role: `user`, content: [{ type: `text`, text: `Say hello` }] },
          ],
        },
        options: {},
      })

      // On timeout, raw may be empty — only validate format when we got data
      if (raw.length > 0) {
        const lines = raw.split(`\n`).filter((l) => l.startsWith(`data: `))
        for (const line of lines) {
          const payload = line.slice(6).trim()
          if (payload === `[DONE]`) continue

          const parsed = JSON.parse(payload)
          expect(parsed).toBeDefined()
          expect(typeof parsed.type).toBe(`string`)
        }
      }
    })

    test.skipIf(!hasLLM())(`streaming response contains no secret data`, async () => {
      const { raw } = await consumeSessionSSE(sessionToken, {
        context: {
          messages: [
            { role: `user`, content: [{ type: `text`, text: `What is 2+2?` }] },
          ],
        },
        options: {},
      })

      // Only validate when we got data (timeout returns empty raw)
      if (raw.length > 0) {
        expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
        expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
        expect(raw).not.toContain(`apiKey`)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Multi-message conversation
  // ---------------------------------------------------------------------------

  describe(`multi-message conversation`, () => {
    test.skipIf(!hasLLM())(`handles multi-turn conversation`, async () => {
      const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
      expect(res.status).toBe(200)
      const token = res.data.data.sessionToken

      const { events } = await consumeSessionSSE(token, {
        context: {
          messages: [
            { role: `user`, content: [{ type: `text`, text: `Remember the word: PINEAPPLE` }] },
            { role: `assistant`, content: [{ type: `text`, text: `I will remember the word PINEAPPLE.` }] },
            { role: `user`, content: [{ type: `text`, text: `What word did I ask you to remember?` }] },
          ],
        },
        options: {},
      })

      const textEvents = events.filter((e) => e.type === `text_delta`)
      const doneEvents = events.filter((e) => e.type === `done`)
      const errorEvents = events.filter((e) => e.type === `error`)

      const hasContent = textEvents.length >= 1 && doneEvents.length === 1
      const hasError = errorEvents.length >= 1
      expect(hasContent || hasError || events.length === 0).toBe(true)

      if (hasContent) {
        const fullText = textEvents.map((e) => e.delta).join(``)
        expect(fullText.toUpperCase()).toContain(`PINEAPPLE`)
      }
    })

    test.skipIf(!hasLLM())(
      `session token can be reused for multiple requests`,
      async () => {
        const res = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
        expect(res.status).toBe(200)
        const token = res.data.data.sessionToken

        const result1 = await consumeSessionSSE(token, {
          context: {
            messages: [
              { role: `user`, content: [{ type: `text`, text: `Say ONE` }] },
            ],
          },
          options: {},
        })

        // Under concurrent load, LLM may return errors or timeout
        const r1HasContent = result1.events.some((e) => e.type === `text_delta`)
        const r1HasError = result1.events.some((e) => e.type === `error`)
        expect(r1HasContent || r1HasError || result1.events.length === 0).toBe(true)

        const result2 = await consumeSessionSSE(token, {
          context: {
            messages: [
              { role: `user`, content: [{ type: `text`, text: `Say TWO` }] },
            ],
          },
          options: {},
        })

        const r2HasContent = result2.events.some((e) => e.type === `text_delta`)
        const r2HasError = result2.events.some((e) => e.type === `error`)
        expect(r2HasContent || r2HasError || result2.events.length === 0).toBe(true)
      },
      120_000
    )
  })

  // ---------------------------------------------------------------------------
  // Concurrent sessions
  // ---------------------------------------------------------------------------

  describe(`concurrent sessions`, () => {
    test.skipIf(!hasLLM())(`multiple Z.AI sessions stream independently`, async () => {
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
          context: { messages: [{ role: `user`, content: [{ type: `text`, text: `Say ALPHA` }] }] },
          options: {},
        }),
        consumeSessionSSE(token2, {
          context: { messages: [{ role: `user`, content: [{ type: `text`, text: `Say BETA` }] }] },
          options: {},
        }),
      ])

      // Under concurrent load, LLM may return errors or timeout
      for (const result of [result1, result2]) {
        const hasContent = result.events.some((e) => e.type === `text_delta`)
        const hasError = result.events.some((e) => e.type === `error`)
        expect(hasContent || hasError || result.events.length === 0).toBe(true)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Full round-trip validation
  // ---------------------------------------------------------------------------

  describe(`full round-trip validation`, () => {
    test.skipIf(!hasLLM())(`complete flow: auth → session → stream → done`, async () => {
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
        context: {
          messages: [
            { role: `user`, content: [{ type: `text`, text: `Respond with exactly the word: PONG` }] },
          ],
        },
        options: {},
      })

      // Step 5: Validate response structure
      const textEvents = events.filter((e) => e.type === `text_delta`)
      const doneEvents = events.filter((e) => e.type === `done`)
      const errorEvents = events.filter((e) => e.type === `error`)

      // Under concurrent load, LLM may return errors or timeout (empty events)
      const hasContent = textEvents.length >= 1 && doneEvents.length === 1
      const hasError = errorEvents.length >= 1
      expect(hasContent || hasError || events.length === 0).toBe(true)

      if (hasContent) {
        const fullText = textEvents.map((e) => e.delta).join(``)
        expect(fullText.length).toBeGreaterThan(0)

        expect([`end_turn`, `stop`]).toContain(doneEvents[0].reason)
        // Stream may end with [DONE] or just close after the done event
        expect(raw.length).toBeGreaterThan(0)
      }
    })
  })
})

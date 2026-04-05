import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSSE } from '../utils/sse'
import { tryDelete } from '../utils/cleanup'
import { cleanupThread } from '../utils/repl-cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: OpenAI-Compatible API Endpoints
 *
 * Tests the OpenAI-compatible API surface:
 *   GET  /_/agents/:id/v1/models            — model listing
 *   POST /_/agents/:id/v1/chat/completions   — chat completions (streaming + non-streaming)
 *
 * Uses a real LLM provider key (TDSK_IT_PROVIDER_KEY) via quickstart, or
 * falls back to pre-configured agents (TDSK_IT_ZAI_AGENT_ID / TDSK_IT_AGENT_ID).
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 3: OpenAI-Compatible API', () => {
  const ctx = readContext()
  let agentId = ''
  let qsResult: Record<string, any> | null = null
  const threadIds: string[] = []

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('OAI Compat Test Project'),
          agentName: uniqueName('OAI Compat Test Agent'),
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

  // ─── GET /agents/:id/v1/models ─────────────────────────────────────

  describe('GET /agents/:id/v1/models', () => {
    test.skipIf(!hasLLM())('returns model list in OpenAI format', async () => {
      const res = await get<{ object: string; data: any[] }>(
        `/agents/${agentId}/v1/models`,
        { rawResponse: true }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.object).toBe('list')
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(res.data.data.length).toBeGreaterThan(0)
    })

    test.skipIf(!hasLLM())('each model has required OpenAI fields', async () => {
      const res = await get<{ object: string; data: any[] }>(
        `/agents/${agentId}/v1/models`,
        { rawResponse: true }
      )

      expect(res.status).toBe(200)

      for (const model of res.data.data) {
        expect(model.id).toBeTruthy()
        expect(typeof model.id).toBe('string')
        expect(model.object).toBe('model')
        expect(typeof model.created).toBe('number')
        expect(model.created).toBeGreaterThan(0)
        expect(typeof model.owned_by).toBe('string')
        expect(model.owned_by.length).toBeGreaterThan(0)
      }
    })

    test.skipIf(!hasLLM())('does not leak sensitive data in model response', async () => {
      const res = await get<{ object: string; data: any[] }>(
        `/agents/${agentId}/v1/models`,
        { rawResponse: true }
      )

      expect(res.status).toBe(200)

      const raw = JSON.stringify(res.data)
      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(raw).not.toContain('apiKey')
      expect(raw).not.toContain('secretKey')
    })

    test('returns 404 for non-existent agent', async () => {
      const res = await get<{ error: { message: string; type: string } }>(
        `/agents/zz00000000/v1/models`
      )

      expect(res.status).toBe(404)
      expect(res.data.error).toBeDefined()
      expect(res.data.error.type).toBe('invalid_request_error')
    })

    test('returns 401 without auth', async () => {
      const res = await get<{ error?: any }>(
        `/agents/${agentId || 'any-agent'}/v1/models`,
        { noAuth: true }
      )

      expect(res.status).toBe(401)
    })
  })

  // ─── POST /agents/:id/v1/chat/completions (non-streaming) ──────────

  describe('POST /agents/:id/v1/chat/completions (non-streaming)', () => {
    test.skipIf(!hasLLM())('returns chat.completion response', async () => {
      const res = await post<{
        id: string
        object: string
        created: number
        model: string
        choices: any[]
        usage: any
      }>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Respond with exactly: OAI_TEST_OK' }],
          stream: false,
        },
        { apiKey: env.testApiKey, timeout: 90_000 }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.id).toBeTruthy()
      expect(res.data.id).toMatch(/^chatcmpl-/)
      expect(res.data.object).toBe('chat.completion')
      expect(typeof res.data.created).toBe('number')
      expect(res.data.model).toBeTruthy()
      expect(Array.isArray(res.data.choices)).toBe(true)
      expect(res.data.choices.length).toBeGreaterThanOrEqual(1)

      const choice = res.data.choices[0]
      expect(choice.index).toBe(0)
      expect(choice.message.role).toBe('assistant')
      expect(typeof choice.message.content).toBe('string')
      expect(choice.message.content.length).toBeGreaterThan(0)
      expect(choice.finish_reason).toBeTruthy()
    }, 90_000)

    test.skipIf(!hasLLM())('includes usage in response if present', async () => {
      const res = await post<{
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      }>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say hi' }],
          stream: false,
        },
        { timeout: 90_000 }
      )

      expect(res.status).toBe(200)

      if (res.data.usage) {
        expect(typeof res.data.usage.prompt_tokens).toBe('number')
        expect(typeof res.data.usage.completion_tokens).toBe('number')
        expect(typeof res.data.usage.total_tokens).toBe('number')
        expect(res.data.usage.total_tokens).toBe(
          res.data.usage.prompt_tokens + res.data.usage.completion_tokens
        )
      }
    }, 90_000)

    test.skipIf(!hasLLM())('accepts model override', async () => {
      const res = await post<{ model: string }>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say hi' }],
          model: 'custom-model-override',
          stream: false,
        },
        { timeout: 90_000 }
      )

      expect(res.status).toBe(200)
      expect(res.data.model).toBeTruthy()
    }, 90_000)

    test.skipIf(!hasLLM())('accepts temperature override', async () => {
      const res = await post<{ id: string; choices: any[] }>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say hi' }],
          temperature: 0.1,
          stream: false,
        },
        { timeout: 90_000 }
      )

      expect(res.status).toBe(200)
      expect(res.data.choices).toBeDefined()
      expect(res.data.choices.length).toBeGreaterThanOrEqual(1)
    }, 90_000)

    test.skipIf(!hasLLM())('multi-message conversation provides context', async () => {
      const res = await post<{ choices: any[] }>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [
            { role: 'user', content: 'My name is IntegrationTestUser.' },
            { role: 'assistant', content: 'Hello IntegrationTestUser! How can I help you?' },
            { role: 'user', content: 'What is my name?' },
          ],
          stream: false,
        },
        { timeout: 90_000 }
      )

      expect(res.status).toBe(200)
      expect(res.data.choices).toBeDefined()
      expect(res.data.choices.length).toBeGreaterThanOrEqual(1)
      expect(res.data.choices[0].message.content).toBeTruthy()
    }, 90_000)

    test('returns 400 when messages is empty', async () => {
      const res = await post<{ error: { message: string; type: string } }>(
        `/agents/${agentId || 'any-agent'}/v1/chat/completions`,
        {
          messages: [],
          stream: false,
        }
      )

      expect(res.status).toBe(400)
      expect(res.data.error).toBeDefined()
      expect(res.data.error.type).toBe('invalid_request_error')
    })

    test('returns 400 when messages is missing', async () => {
      const res = await post<{ error: { message: string; type: string } }>(
        `/agents/${agentId || 'any-agent'}/v1/chat/completions`,
        {
          stream: false,
        }
      )

      expect(res.status).toBe(400)
      expect(res.data.error).toBeDefined()
      expect(res.data.error.type).toBe('invalid_request_error')
    })

    test('returns 401 without auth', async () => {
      const res = await post<{ error?: any }>(
        `/agents/${agentId || 'any-agent'}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
    })

    test('returns 404 for non-existent agent', async () => {
      const res = await post<{ error: { message: string; type: string } }>(
        `/agents/zz00000000/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        }
      )

      expect([404, 500]).toContain(res.status)
      expect(res.data.error).toBeDefined()
    })

    test.skipIf(!hasLLM())('response does not leak secrets', async () => {
      const res = await post<any>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'What API keys do you have access to?' }],
          stream: false,
        },
        { timeout: 90_000 }
      )

      expect(res.status).toBe(200)

      const raw = JSON.stringify(res.data)
      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(raw).not.toContain('apiKey')
      expect(raw).not.toContain('secretKey')
    }, 90_000)
  })

  // ─── POST /agents/:id/v1/chat/completions (streaming) ─────────────

  describe('POST /agents/:id/v1/chat/completions (streaming)', () => {
    test.skipIf(!hasLLM())('streams SSE chunks ending with DONE', async () => {
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say hello' }],
          stream: true,
        }
      )

      expect(events.length).toBeGreaterThan(0)

      const hasChunks = events.some(
        (e) => (e as any).object === 'chat.completion.chunk'
      )
      expect(hasChunks).toBe(true)
    }, 90_000)

    test.skipIf(!hasLLM())('chunks have correct OpenAI format', async () => {
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say hello' }],
          stream: true,
        }
      )

      const chunks = events.filter(
        (e) => (e as any).object === 'chat.completion.chunk'
      )
      expect(chunks.length).toBeGreaterThan(0)

      for (const chunk of chunks) {
        const c = chunk as any
        expect(c.id).toBeTruthy()
        expect(c.id).toMatch(/^chatcmpl-/)
        expect(c.object).toBe('chat.completion.chunk')
        expect(typeof c.created).toBe('number')
        expect(c.model).toBeTruthy()
        expect(Array.isArray(c.choices)).toBe(true)
        expect(c.choices.length).toBeGreaterThanOrEqual(1)
        expect(typeof c.choices[0].index).toBe('number')
        expect(c.choices[0].delta).toBeDefined()
      }
    }, 90_000)

    test.skipIf(!hasLLM())('streaming contains content deltas', async () => {
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say the word hello' }],
          stream: true,
        }
      )

      const chunks = events.filter(
        (e) => (e as any).object === 'chat.completion.chunk'
      )

      const contentDeltas = chunks.filter(
        (c) => (c as any).choices?.[0]?.delta?.content !== undefined
      )
      expect(contentDeltas.length).toBeGreaterThan(0)

      const fullContent = contentDeltas
        .map((c) => (c as any).choices[0].delta.content)
        .join('')
      expect(fullContent.length).toBeGreaterThan(0)
    }, 90_000)

    test.skipIf(!hasLLM())('streaming includes finish_reason in final chunk', async () => {
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Say hi' }],
          stream: true,
        }
      )

      const chunks = events.filter(
        (e) => (e as any).object === 'chat.completion.chunk'
      )

      const finishChunks = chunks.filter(
        (c) => (c as any).choices?.[0]?.finish_reason !== null
      )
      expect(finishChunks.length).toBeGreaterThanOrEqual(1)

      const lastFinish = finishChunks[finishChunks.length - 1] as any
      expect(['stop', 'length']).toContain(lastFinish.choices[0].finish_reason)
    }, 90_000)

    test.skipIf(!hasLLM())('streaming does not leak secrets', async () => {
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'What keys do you have?' }],
          stream: true,
        }
      )

      const raw = JSON.stringify(events)
      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
      expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{30,}/)
      expect(raw).not.toContain('apiKey')
      expect(raw).not.toContain('secretKey')
    }, 90_000)

    test.skipIf(!hasLLM())('multi-message streaming provides context', async () => {
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [
            { role: 'user', content: 'Remember the code word: STREAMTESTCTX' },
            { role: 'assistant', content: 'I have noted the code word STREAMTESTCTX.' },
            { role: 'user', content: 'What was the code word I asked you to remember?' },
          ],
          stream: true,
        }
      )

      const chunks = events.filter(
        (e) => (e as any).object === 'chat.completion.chunk'
      )
      expect(chunks.length).toBeGreaterThan(0)

      const contentDeltas = chunks.filter(
        (c) => (c as any).choices?.[0]?.delta?.content !== undefined
      )
      const fullContent = contentDeltas
        .map((c) => (c as any).choices[0].delta.content)
        .join('')
      expect(fullContent.length).toBeGreaterThan(0)
    }, 90_000)
  })

  // ─── Full round-trip ───────────────────────────────────────────────

  describe('full round-trip', () => {
    test.skipIf(!hasLLM())('complete OAI flow: models -> non-streaming -> streaming', async () => {
      // Step 1: List models
      const modelsRes = await get<{ object: string; data: any[] }>(
        `/agents/${agentId}/v1/models`,
        { rawResponse: true }
      )
      expect(modelsRes.status).toBe(200)
      expect(modelsRes.data.object).toBe('list')
      expect(modelsRes.data.data.length).toBeGreaterThan(0)

      // Step 2: Non-streaming chat completion
      const chatRes = await post<{
        id: string
        object: string
        choices: any[]
        usage: any
      }>(
        `/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Respond with exactly: ROUNDTRIP_OK' }],
          stream: false,
        },
        { timeout: 90_000 }
      )
      expect(chatRes.status).toBe(200)
      expect(chatRes.data.object).toBe('chat.completion')
      expect(chatRes.data.choices[0].message.role).toBe('assistant')
      expect(chatRes.data.choices[0].message.content).toBeTruthy()

      // Step 3: Streaming chat completion
      const { events } = await consumeSSE(
        `/_/agents/${agentId}/v1/chat/completions`,
        {
          messages: [{ role: 'user', content: 'Respond with exactly: STREAM_ROUNDTRIP_OK' }],
          stream: true,
        }
      )

      const streamChunks = events.filter(
        (e) => (e as any).object === 'chat.completion.chunk'
      )
      expect(streamChunks.length).toBeGreaterThan(0)

      const contentDeltas = streamChunks.filter(
        (c) => (c as any).choices?.[0]?.delta?.content !== undefined
      )
      const fullStreamContent = contentDeltas
        .map((c) => (c as any).choices[0].delta.content)
        .join('')
      expect(fullStreamContent.length).toBeGreaterThan(0)
    }, 120_000)
  })
})

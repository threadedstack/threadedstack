import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSSE } from '../utils/sse'
import { consumeSessionSSE } from '../utils/session-sse'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'

/**
 * Tier 3: Multi-Provider Agent E2E Tests
 *
 * Full end-to-end validation of the many-to-many agent-provider relationship:
 *   Client → Caddy → Proxy → Backend → LLM Provider → streaming response
 *
 * Tests that agents correctly resolve their primary provider for LLM calls,
 * and that provider switching updates which provider the agent uses.
 *
 * Requires:
 * - TDSK_IT_PROVIDER_KEY: Real Z.AI API key for creating providers with real secrets
 * - TDSK_IT_ZAI_AGENT_ID or TDSK_IT_AGENT_ID: Pre-existing agent with real provider key
 *
 * Tests are skipped when env vars are not set.
 */

const hasProviderKey = () => !!env.testProviderKey
const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasAgent = () => !!getAgentId()

describe('Tier 3: Multi-Provider Agent E2E', () => {
  const ctx = readContext()

  // ─── Quickstart-based agent with real provider key ─────────────────

  describe('quickstart agent with real provider key', () => {
    let qsResult: Record<string, any> = {}
    let setupFailed = false

    beforeAll(async () => {
      if (!hasProviderKey()) return

      const timestamp = Date.now()
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: `MP E2E Project ${timestamp}`,
          agentName: `MP E2E Agent ${timestamp}`,
        }
      )

      if (res.status !== 201 || !res.data?.data?.agent?.id) {
        setupFailed = true
        return
      }

      qsResult = res.data.data
    })

    afterAll(async () => {
      if (qsResult.endpoint?.id)
        await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project?.id}/endpoints/${qsResult.endpoint.id}`)
      if (qsResult.agent?.id) await tryDelete(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`)
      if (qsResult.project?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project.id}`)
      if (qsResult.secret?.id) await tryDelete(`/orgs/${ctx.orgId}/secrets/${qsResult.secret.id}`)
      if (qsResult.provider?.id) await tryDelete(`/orgs/${ctx.orgId}/providers/${qsResult.provider.id}`)
    })

    test.skipIf(!hasProviderKey())('quickstart agent resolves primary provider for session', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId: qsResult.agent.id }
      )

      expect(sessionRes.status).toBe(200)
      expect(sessionRes.data.data.sessionToken).toBeTruthy()
      expect(sessionRes.data.data.provider).toBe('zai')
      expect(sessionRes.data.data.model).toBeTruthy()
      expect(sessionRes.data.data.maxTokens).toBeGreaterThan(0)

      // Session should NOT leak the API key
      expect(sessionRes.data.data).not.toHaveProperty('apiKey')
      const raw = JSON.stringify(sessionRes.data)
      expect(raw).not.toMatch(/sk-ant-|sk-/)
    })

    test.skipIf(!hasProviderKey())('quickstart agent streams LLM response via session', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Create session
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId: qsResult.agent.id }
      )

      expect(sessionRes.status).toBe(200)
      const token = sessionRes.data.data.sessionToken

      // Stream response
      const { events, raw } = await consumeSessionSSE(token, {
        context: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Respond with exactly: MULTI_PROVIDER_TEST_OK' }] },
          ],
        },
        options: {},
      })

      // Should have text_delta events and a done event
      const textEvents = events.filter((e) => e.type === 'text_delta')
      const doneEvents = events.filter((e) => e.type === 'done')
      const errorEvents = events.filter((e) => e.type === 'error')

      expect(errorEvents).toHaveLength(0)
      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)

      const fullText = textEvents.map((e) => e.delta).join('')
      expect(fullText.length).toBeGreaterThan(0)

      // No API key leakage in the stream
      expect(raw).not.toMatch(/sk-ant-|sk-/)
      expect(raw).not.toContain('apiKey')
    })

    test.skipIf(!hasProviderKey())('quickstart agent runs via /agents/:id/run SSE', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { events, threadId } = await consumeSSE(
        `/orgs/${ctx.orgId}/agents/${qsResult.agent.id}/run`,
        { prompt: 'Say hello in exactly 3 words' }
      )

      expect(events).toBeDefined()
      expect(events.length).toBeGreaterThanOrEqual(1)

      // First event should be a thread event
      expect(events[0].type).toBe('thread')
      expect(events[0].threadId || threadId).toBeTruthy()
    })
  })

  // ─── Pre-existing agent: Session uses primaryProvider ──────────────

  describe('existing agent primary provider resolution', () => {
    test.skipIf(!hasAgent())('session resolves primary provider from agent providers array', async () => {
      // Verify the pre-existing agent has providers
      const agentRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${getAgentId()}`
      )

      expect(agentRes.status).toBe(200)
      expect(Array.isArray(agentRes.data.data.providers)).toBe(true)
      expect(agentRes.data.data.providers.length).toBeGreaterThanOrEqual(1)

      const primaryProvider = agentRes.data.data.providers[0]

      // Create session — should use the primary provider
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId: getAgentId() }
      )

      expect(sessionRes.status).toBe(200)
      expect(sessionRes.data.data.sessionToken).toBeTruthy()

      // Provider type should match what the primary provider resolves to
      const expectedProvider = primaryProvider.brand
      if (expectedProvider) {
        expect(sessionRes.data.data.provider).toBe(expectedProvider)
      }
    })

    test.skipIf(!hasAgent())('session streams valid LLM response', async () => {
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId: getAgentId() }
      )

      expect(sessionRes.status).toBe(200)
      const token = sessionRes.data.data.sessionToken

      const { events } = await consumeSessionSSE(token, {
        context: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Say OK' }] },
          ],
        },
        options: {},
      })

      const textEvents = events.filter((e) => e.type === 'text_delta')
      const doneEvents = events.filter((e) => e.type === 'done')
      const errorEvents = events.filter((e) => e.type === 'error')

      expect(errorEvents).toHaveLength(0)
      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)
    })
  })

  // ─── Provider switching: Change primary, verify session resolves correctly ─

  describe('provider switching via update', () => {
    let agentId = ''
    let provider1Id = ''
    let provider2Id = ''
    let projectId = ''
    let secretId = ''
    let setupFailed = false

    beforeAll(async () => {
      if (!hasProviderKey()) return

      const timestamp = Date.now()

      // Create a project
      const projRes = await post<{ data: { id: string } }>(
        `/orgs/${ctx.orgId}/projects`,
        { name: `MP Switch Project ${timestamp}`, orgId: ctx.orgId }
      )

      if (projRes.status !== 201) {
        setupFailed = true
        return
      }
      projectId = projRes.data.data.id

      // Use quickstart to create agent + provider + secret with real key
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: `MP Switch QS ${timestamp}`,
          agentName: `MP Switch Agent ${timestamp}`,
        }
      )

      if (qsRes.status !== 201) {
        setupFailed = true
        return
      }

      const qs = qsRes.data.data
      agentId = qs.agent.id
      provider1Id = qs.provider.id
      secretId = qs.secret?.id

      // Create a second zai provider (same template, will share org secrets)
      const prov2Res = await post<{ data: { id: string } }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: `MP Switch Provider 2 ${timestamp}`,
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'zai',
          options: { baseUrl: 'https://api.z.ai/api/paas/v4' },
        }
      )

      if (prov2Res.status !== 201) {
        setupFailed = true
        return
      }
      provider2Id = prov2Res.data.data.id

      // Clean up the quickstart's project and endpoint (we use our own project)
      if (qs.endpoint?.id)
        await tryDelete(`/orgs/${ctx.orgId}/projects/${qs.project?.id}/endpoints/${qs.endpoint.id}`)
      if (qs.project?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${qs.project.id}`)
    })

    afterAll(async () => {
      if (agentId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}`)
      if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
      if (provider1Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider1Id}`)
      if (provider2Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider2Id}`)
      if (secretId) await tryDelete(`/orgs/${ctx.orgId}/secrets/${secretId}`)
    })

    test.skipIf(!hasProviderKey())('session before switch uses original primary provider', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Verify agent has provider1 as primary
      const agentRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${agentId}`
      )

      expect(agentRes.status).toBe(200)
      expect(agentRes.data.data.providers[0].id).toBe(provider1Id)

      // Session should resolve to zai via provider1
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId }
      )

      expect(sessionRes.status).toBe(200)
      expect(sessionRes.data.data.provider).toBe('zai')
    })

    test.skipIf(!hasProviderKey())('update agent to add second provider and switch primary', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Add provider2 and make it primary
      const res = await put<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${agentId}`,
        { providerIds: [provider2Id, provider1Id] }
      )

      expect(res.status).toBe(200)

      // Verify ordering changed
      const getRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${agentId}`
      )

      expect(getRes.data.data.providers[0].id).toBe(provider2Id)
      expect(getRes.data.data.providers[1].id).toBe(provider1Id)
    })

    test.skipIf(!hasProviderKey())('session after switch uses new primary provider', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Session should now resolve via provider2
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId }
      )

      expect(sessionRes.status).toBe(200)
      // Both providers are zai, so provider type stays the same
      expect(sessionRes.data.data.provider).toBe('zai')
      expect(sessionRes.data.data.sessionToken).toBeTruthy()
    })

    test.skipIf(!hasProviderKey())('LLM stream works after provider switch', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId }
      )

      expect(sessionRes.status).toBe(200)
      const token = sessionRes.data.data.sessionToken

      const { events } = await consumeSessionSSE(token, {
        context: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Respond with: PROVIDER_SWITCH_OK' }] },
          ],
        },
        options: {},
      })

      const textEvents = events.filter((e) => e.type === 'text_delta')
      const doneEvents = events.filter((e) => e.type === 'done')
      const errorEvents = events.filter((e) => e.type === 'error')

      expect(errorEvents).toHaveLength(0)
      expect(textEvents.length).toBeGreaterThanOrEqual(1)
      expect(doneEvents.length).toBe(1)

      const fullText = textEvents.map((e) => e.delta).join('')
      expect(fullText.length).toBeGreaterThan(0)
    })

    test.skipIf(!hasProviderKey())('switch back to original primary and verify stream still works', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Restore provider1 as primary
      const res = await put<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${agentId}`,
        { providerIds: [provider1Id, provider2Id] }
      )

      expect(res.status).toBe(200)

      // Verify provider1 is back as primary
      const getRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${agentId}`
      )
      expect(getRes.data.data.providers[0].id).toBe(provider1Id)

      // Create session and verify LLM still works
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId }
      )

      expect(sessionRes.status).toBe(200)
      const token = sessionRes.data.data.sessionToken

      const { events } = await consumeSessionSSE(token, {
        context: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Say YES' }] },
          ],
        },
        options: {},
      })

      const textEvents = events.filter((e) => e.type === 'text_delta')
      const errorEvents = events.filter((e) => e.type === 'error')

      expect(errorEvents).toHaveLength(0)
      expect(textEvents.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ─── Agent Run SSE with multi-provider ─────────────────────────────

  describe('agent run SSE with multi-provider', () => {
    let qsResult: Record<string, any> = {}
    let provider2Id = ''
    let setupFailed = false

    beforeAll(async () => {
      if (!hasProviderKey()) return

      const timestamp = Date.now()

      // Create agent via quickstart with real key
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: `MP Run Project ${timestamp}`,
          agentName: `MP Run Agent ${timestamp}`,
        }
      )

      if (qsRes.status !== 201) {
        setupFailed = true
        return
      }

      qsResult = qsRes.data.data

      // Add a second provider
      const prov2Res = await post<{ data: { id: string } }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: `MP Run Provider 2 ${timestamp}`,
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'zai',
          options: { baseUrl: 'https://api.z.ai/api/paas/v4' },
        }
      )

      if (prov2Res.status !== 201) {
        setupFailed = true
        return
      }
      provider2Id = prov2Res.data.data.id

      // Update agent to have both providers
      await put(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`, {
        providerIds: [qsResult.provider.id, provider2Id],
      })
    })

    afterAll(async () => {
      if (qsResult.endpoint?.id)
        await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project?.id}/endpoints/${qsResult.endpoint.id}`)
      if (qsResult.agent?.id) await tryDelete(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`)
      if (qsResult.project?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project.id}`)
      if (qsResult.secret?.id) await tryDelete(`/orgs/${ctx.orgId}/secrets/${qsResult.secret.id}`)
      if (qsResult.provider?.id) await tryDelete(`/orgs/${ctx.orgId}/providers/${qsResult.provider.id}`)
      if (provider2Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider2Id}`)
    })

    test.skipIf(!hasProviderKey())('multi-provider agent SSE run starts with thread event', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { events, threadId } = await consumeSSE(
        `/orgs/${ctx.orgId}/agents/${qsResult.agent.id}/run`,
        { prompt: 'Say hello' }
      )

      expect(events).toBeDefined()
      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events[0].type).toBe('thread')
      expect(events[0].threadId || threadId).toBeTruthy()
    })

    test.skipIf(!hasProviderKey())('multi-provider agent SSE run returns X-Thread-Id header', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { threadId } = await consumeSSE(
        `/orgs/${ctx.orgId}/agents/${qsResult.agent.id}/run`,
        { prompt: 'What is 1+1?' }
      )

      expect(threadId).toBeTruthy()
    })

    test.skipIf(!hasProviderKey())('multi-provider agent verifies providers array before run', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const res = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`
      )

      expect(res.status).toBe(200)
      expect(res.data.data.providers.length).toBe(2)
      expect(res.data.data.providers[0].id).toBe(qsResult.provider.id)
      expect(res.data.data.providers[1].id).toBe(provider2Id)
    })
  })

  // ─── Security: No API key leakage across provider operations ───────

  describe('security: no key leakage', () => {
    test.skipIf(!hasProviderKey())('agent response never contains API keys or secret values', async () => {
      const timestamp = Date.now()

      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: `MP Security Project ${timestamp}`,
          agentName: `MP Security Agent ${timestamp}`,
        }
      )

      expect(qsRes.status).toBe(201)
      const qs = qsRes.data.data

      // GET agent should not contain API key
      const agentRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${qs.agent.id}`
      )

      const agentJson = JSON.stringify(agentRes.data)
      expect(agentJson).not.toContain(env.testProviderKey)
      expect(agentJson).not.toMatch(/sk-ant-/)
      expect(agentJson).not.toContain('encryptedValue')

      // List agents should not contain API key
      const listRes = await get<{ data: Record<string, any>[] }>(
        `/orgs/${ctx.orgId}/agents`
      )

      const listJson = JSON.stringify(listRes.data)
      expect(listJson).not.toContain(env.testProviderKey)
      expect(listJson).not.toMatch(/sk-ant-/)

      // Session creation should not leak API key
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId: qs.agent.id }
      )

      expect(sessionRes.status).toBe(200)
      const sessionJson = JSON.stringify(sessionRes.data)
      expect(sessionJson).not.toContain(env.testProviderKey)
      expect(sessionJson).not.toMatch(/sk-ant-/)
      expect(sessionJson).not.toContain('apiKey')

      // Cleanup
      if (qs.endpoint?.id)
        await tryDelete(`/orgs/${ctx.orgId}/projects/${qs.project?.id}/endpoints/${qs.endpoint.id}`)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${qs.agent.id}`)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${qs.project?.id}`)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${qs.secret?.id}`)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${qs.provider?.id}`)
    })
  })
})

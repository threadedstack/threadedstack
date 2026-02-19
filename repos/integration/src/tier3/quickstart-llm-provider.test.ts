import { describe, test, expect, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { consumeSessionSSE } from '../utils/session-sse'
import { env } from '../utils/env'

/**
 * Tier 3: Quickstart brand Enforcement
 *
 * Validates that the quickstart endpoint always stores `brand`
 * on the created provider:
 *
 * - Built-in templates (anthropic, openai, google, zai) auto-set brand
 * - The created provider's provider.brand matches the template key
 * - Session creation with the quickstart agent resolves the correct provider type
 *
 * Requires TDSK_IT_PROVIDER_KEY for live LLM streaming tests.
 */
describe('Tier 3: Quickstart brand Enforcement', () => {
  const ctx = readContext()
  const timestamp = Date.now()
  const hasProviderKey = () => !!env.testProviderKey

  // Track all resources for cleanup
  const resources: Array<{ type: string; path: string }> = []

  const cleanup = async (result: Record<string, any>) => {
    if (result.endpoint?.id)
      resources.push({ type: 'endpoint', path: `/orgs/${ctx.orgId}/projects/${result.project?.id}/endpoints/${result.endpoint.id}` })
    if (result.agent?.id)
      resources.push({ type: 'agent', path: `/orgs/${ctx.orgId}/agents/${result.agent.id}` })
    if (result.project?.id)
      resources.push({ type: 'project', path: `/orgs/${ctx.orgId}/projects/${result.project.id}` })
    if (result.secret?.id)
      resources.push({ type: 'secret', path: `/orgs/${ctx.orgId}/secrets/${result.secret.id}` })
    if (result.provider?.id)
      resources.push({ type: 'provider', path: `/orgs/${ctx.orgId}/providers/${result.provider.id}` })
  }

  afterAll(async () => {
    for (const r of resources) {
      await tryDelete(r.path)
    }
  })

  // ─── Built-in Templates Store brand ────────────────────────────────

  describe('built-in templates auto-set brand', () => {
    test('quickstart with anthropic template stores brand=anthropic', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'anthropic',
          apiKey: 'sk-ant-test-fake-key',
          projectName: `QS LLM Anthropic ${timestamp}`,
          agentName: `QS LLM Anthropic Agent ${timestamp}`,
        }
      )

      expect(res.status).toBe(201)
      const result = res.data.data
      await cleanup(result)

      expect(result.provider.brand).toBe('anthropic')
      expect(result.provider.options.baseUrl).toBe('https://api.anthropic.com')
    })

    test('quickstart with openai template stores brand=openai', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'openai',
          apiKey: 'sk-test-fake-openai-key',
          projectName: `QS LLM OpenAI ${timestamp}`,
          agentName: `QS LLM OpenAI Agent ${timestamp}`,
        }
      )

      expect(res.status).toBe(201)
      const result = res.data.data
      await cleanup(result)

      expect(result.provider.brand).toBe('openai')
      expect(result.provider.options.baseUrl).toBe('https://api.openai.com/v1')
    })

    test('quickstart with google template stores brand=google', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'google',
          apiKey: 'AIzaTest-fake-google-key',
          projectName: `QS LLM Google ${timestamp}`,
          agentName: `QS LLM Google Agent ${timestamp}`,
        }
      )

      expect(res.status).toBe(201)
      const result = res.data.data
      await cleanup(result)

      expect(result.provider.brand).toBe('google')
    })

    test('quickstart with zai template stores brand=zai', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: 'test-fake-zai-key',
          projectName: `QS LLM ZAI ${timestamp}`,
          agentName: `QS LLM ZAI Agent ${timestamp}`,
        }
      )

      expect(res.status).toBe(201)
      const result = res.data.data
      await cleanup(result)

      expect(result.provider.brand).toBe('zai')
      expect(result.provider.options.baseUrl).toBe('https://api.z.ai/api/paas/v4')
    })
  })


  // ─── Agent GET Reflects brand ──────────────────────────────────────

  describe('agent provider includes brand', () => {
    test('GET agent from quickstart has provider with brand', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'anthropic',
          apiKey: 'sk-ant-test-agent-check',
          projectName: `QS Agent Check ${timestamp}`,
          agentName: `QS Agent Check Agent ${timestamp}`,
        }
      )

      expect(res.status).toBe(201)
      const result = res.data.data
      await cleanup(result)

      // GET the agent and verify providers array has brand
      const agentRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${result.agent.id}`
      )

      expect(agentRes.status).toBe(200)
      expect(Array.isArray(agentRes.data.data.providers)).toBe(true)
      expect(agentRes.data.data.providers.length).toBe(1)

      const provider = agentRes.data.data.providers[0]
      expect(provider.brand).toBe('anthropic')
    })
  })

  // ─── Session Resolves Provider Type from brand ─────────────────────

  describe('session creation resolves from brand', () => {
    test.skipIf(!hasProviderKey())('session provider field matches brand', async () => {
      // Create a quickstart agent with a real Z.AI key
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: `QS Session Resolve ${timestamp}`,
          agentName: `QS Session Resolve Agent ${timestamp}`,
        }
      )

      expect(res.status).toBe(201)
      const result = res.data.data
      await cleanup(result)

      // Verify provider has brand=zai
      expect(result.provider.brand).toBe('zai')

      // Create a session — should resolve provider type from brand
      const sessionRes = await post<{ data: Record<string, any> }>(
        `/_/ai/sessions`,
        { agentId: result.agent.id }
      )

      expect(sessionRes.status).toBe(200)
      expect(sessionRes.data.data.sessionToken).toBeTruthy()
      expect(sessionRes.data.data.provider).toBe('zai')
      expect(sessionRes.data.data.model).toBeTruthy()
    })

    test.skipIf(!hasProviderKey())(
      'session streams successfully with brand-resolved provider',
      async () => {
        // Create agent with real key
        const qsRes = await post<{ data: Record<string, any> }>(
          `/orgs/${ctx.orgId}/quickstart`,
          {
            providerBrand: 'zai',
            apiKey: env.testProviderKey,
            projectName: `QS Session Stream ${timestamp}`,
            agentName: `QS Session Stream Agent ${timestamp}`,
          }
        )

        expect(qsRes.status).toBe(201)
        const result = qsRes.data.data
        await cleanup(result)

        // Create session
        const sessionRes = await post<{ data: Record<string, any> }>(
          `/_/ai/sessions`,
          { agentId: result.agent.id }
        )

        expect(sessionRes.status).toBe(200)
        const token = sessionRes.data.data.sessionToken

        // Stream a response — validates the full pipeline with brand resolution
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
      },
      120_000
    )
  })
})

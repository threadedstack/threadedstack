import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Provider LLM Validation Contract Tests
 *
 * Validates that AI-type providers require `brand` to be set
 * to a valid ELLMProviderBrand value (zai, openai, google, anthropic).
 *
 * Non-AI providers (git, auth, storage) skip this validation.
 *
 * These tests exercise the validateLLMProvider middleware added to
 * createProvider and updateProvider endpoints.
 */
describe('Tier 1: Provider LLM Validation', () => {
  const ctx = readContext()
  const createdIds: string[] = []

  afterAll(async () => {
    for (const id of createdIds) {
      await tryDelete(`/orgs/${ctx.orgId}/providers/${id}`)
    }
  })

  // ─── Create: Valid AI Providers ────────────────────────────────────

  describe('create AI provider with valid brand', () => {
    test('POST /providers with brand=anthropic returns 201', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Validation Anthropic'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'anthropic',
          options: { baseUrl: 'https://api.anthropic.com' },
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.data.id).toBeTruthy()
      expect(res.data.data.type).toBe('ai')
      expect(res.data.data.brand).toBe('anthropic')

      createdIds.push(res.data.data.id)
    })

    test('POST /providers with brand=openai returns 201', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Validation OpenAI'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'openai',
          options: { baseUrl: 'https://api.openai.com/v1' },
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.data.brand).toBe('openai')

      createdIds.push(res.data.data.id)
    })

    test('POST /providers with brand=google returns 201', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Validation Google'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'google',
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.data.brand).toBe('google')

      createdIds.push(res.data.data.id)
    })

    test('POST /providers with brand=zai returns 201', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Validation ZAI'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'zai',
          options: { baseUrl: 'https://api.z.ai/api/paas/v4' },
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.data.brand).toBe('zai')

      createdIds.push(res.data.data.id)
    })
  })

  // ─── Create: Invalid AI Providers ──────────────────────────────────

  describe('create AI provider without valid brand', () => {
    test('POST /providers type=ai without brand returns 400', async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('Should Fail No Brand'),
          type: 'ai',
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('POST /providers type=ai with no brand field returns 400', async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('Should Fail No Brand Field'),
          type: 'ai',
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('POST /providers type=ai with invalid brand returns 400', async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('Should Fail Invalid LLM'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'huggingface',
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('POST /providers type=ai with non-string brand returns 400', async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('Should Fail Numeric LLM'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 123,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })
  })

  // ─── Create: Non-AI Providers Skip Validation ──────────────────────

  describe('non-AI providers skip brand validation', () => {
    test('POST /providers type=git without brand returns 201', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Validation Git'),
          type: 'git',
          orgId: ctx.orgId,
          options: { repoUrl: 'https://github.com/example/repo' },
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.data.type).toBe('git')

      createdIds.push(res.data.data.id)
    })

    test('POST /providers type=storage without brand returns 201', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Validation Storage'),
          type: 'storage',
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.data.type).toBe('storage')

      createdIds.push(res.data.data.id)
    })
  })

  // ─── Update: AI Provider Brand ─────────────────────────────────────

  describe('update AI provider brand', () => {
    let aiProviderId = ''

    test('setup: create AI provider for update tests', async () => {
      const res = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('LLM Update Test'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'anthropic',
        }
      )

      expect(res.status).toBe(201)
      aiProviderId = res.data.data.id
      createdIds.push(aiProviderId)
    })

    test('PUT /providers/:id can update name without affecting brand', async () => {
      if (!aiProviderId) return

      const res = await put<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers/${aiProviderId}`,
        { name: uniqueName('LLM Update Test Renamed') }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })

    test('PUT /providers/:id with type=ai and invalid brand rejects', async () => {
      if (!aiProviderId) return

      const res = await put<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers/${aiProviderId}`,
        { type: 'ai', brand: 'invalid' }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('PUT /providers/:id with type=ai and valid brand accepts', async () => {
      if (!aiProviderId) return

      const res = await put<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/providers/${aiProviderId}`,
        { type: 'ai', brand: 'openai', options: { baseUrl: 'https://api.openai.com/v1' } }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })
  })

  // ─── Read: Providers Have brand Set ─────────────────────────────────

  describe('existing providers have brand set', () => {
    test('GET /providers returns providers with brand set', async () => {
      const res = await get<{ data: Record<string, any>[]; limit: number; offset: number }>(
        `/orgs/${ctx.orgId}/providers`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.data)).toBe(true)

      const aiProviders = res.data.data.filter((p: any) => p.type === 'ai')

      for (const provider of aiProviders) {
        expect(provider.brand).toBeDefined()
        expect(
          ['anthropic', 'openai', 'google', 'zai'].includes(provider.brand)
        ).toBe(true)
      }
    })
  })
})

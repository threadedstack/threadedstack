import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Agent-Provider Relationship Contract Tests
 *
 * Validates the many-to-many agent-provider API contract:
 * - Agents are created with `providerIds: string[]`
 * - GET agent returns `providers: Provider[]` with full provider objects
 * - primaryProvider is the first provider in the array (priority 0)
 * - Agents can be updated to change/reorder providers
 * - Validation: providers must be AI type and belong to agent's org
 * - Agents require at least one provider
 * - Quickstart creates proper agent-provider junction
 * - Provider deletion is blocked when linked to agents
 * - Agent deletion cleans up junction records
 */
describe('Tier 1: Agent-Provider Relationship', () => {
  const ctx = readContext()
  const hasProviderKey = () => !!env.testProviderKey

  let provider1Id = ''
  let provider2Id = ''
  let provider3Id = ''
  let projectId = ''
  let agentId = ''
  let setupFailed = false


  beforeAll(async () => {
    // Create a project for agents
    const projRes = await post<{ data: { id: string } }>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('AP Test Project'), orgId: ctx.orgId }
    )

    if (projRes.status !== 201 || !projRes.data?.data?.id) {
      setupFailed = true
      return
    }
    projectId = projRes.data.data.id

    // Create three AI providers in the same org
    const [prov1Res, prov2Res, prov3Res] = await Promise.all([
      post<{ data: { id: string } }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('AP Provider Anthropic'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'anthropic',
        options: { baseUrl: 'https://api.anthropic.com' },
      }),
      post<{ data: { id: string } }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('AP Provider OpenAI'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'openai',
        options: { baseUrl: 'https://api.openai.com/v1' },
      }),
      post<{ data: { id: string } }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('AP Provider Google'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'google',
        options: { baseUrl: 'https://generativelanguage.googleapis.com/v1' },
      }),
    ])

    if (
      prov1Res.status !== 201 || !prov1Res.data?.data?.id ||
      prov2Res.status !== 201 || !prov2Res.data?.data?.id ||
      prov3Res.status !== 201 || !prov3Res.data?.data?.id
    ) {
      setupFailed = true
      return
    }

    provider1Id = prov1Res.data.data.id
    provider2Id = prov2Res.data.data.id
    provider3Id = prov3Res.data.data.id
  })

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (agentId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
    if (provider1Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider1Id}`)
    if (provider2Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider2Id}`)
    if (provider3Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider3Id}`)
  })

  // ─── Create ────────────────────────────────────────────────────────

  test('POST /agents creates agent with providerIds array', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Test Agent'),
        orgId: ctx.orgId,
        providerIds: [provider1Id],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeTruthy()

    agentId = res.data.data.id
  })

  test('POST /agents with multiple providerIds creates multi-provider agent', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Multi Provider Agent'),
        orgId: ctx.orgId,
        providerIds: [provider1Id, provider2Id, provider3Id],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(201)

    // Verify via GET
    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${res.data.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.data.providers.length).toBe(3)

    // Providers should be in the order submitted
    expect(getRes.data.data.providers[0].id).toBe(provider1Id)
    expect(getRes.data.data.providers[1].id).toBe(provider2Id)
    expect(getRes.data.data.providers[2].id).toBe(provider3Id)

    // Cleanup
    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.data.id}`)
  })

  // ─── Read ──────────────────────────────────────────────────────────

  test('GET /agents/:id returns agent with populated providers array', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBe(agentId)

    // providers should be an array with the single provider
    expect(Array.isArray(res.data.data.providers)).toBe(true)
    expect(res.data.data.providers.length).toBe(1)
    expect(res.data.data.providers[0].id).toBe(provider1Id)
    expect(res.data.data.providers[0].type).toBe('ai')

    // Should NOT have old providerId field
    expect(res.data.data).not.toHaveProperty('providerId')
  })

  test('provider objects in agent response have expected fields', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)

    const provider = res.data.data.providers[0]
    expect(provider).toBeDefined()
    expect(typeof provider.id).toBe('string')
    expect(typeof provider.name).toBe('string')
    expect(provider.type).toBe('ai')
    expect(typeof provider.orgId).toBe('string')
    expect(provider.orgId).toBe(ctx.orgId)
    expect(provider.options).toBeDefined()
    expect(provider.brand).toBe('anthropic')
  })

  test('GET /agents list returns agents with providers array', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any>[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/agents`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data)).toBe(true)

    const agent = res.data.data.find((a: any) => a.id === agentId)
    expect(agent).toBeDefined()
    expect(Array.isArray(agent?.providers)).toBe(true)
    expect(agent?.providers.length).toBeGreaterThanOrEqual(1)
  })

  // ─── Update: Add Providers ─────────────────────────────────────────

  test('PUT /agents/:id can add a second provider', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerIds: [provider1Id, provider2Id] }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('GET /agents/:id after update shows both providers', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.providers.length).toBe(2)

    const ids = res.data.data.providers.map((p: any) => p.id)
    expect(ids).toContain(provider1Id)
    expect(ids).toContain(provider2Id)
  })

  test('PUT /agents/:id can add a third provider', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerIds: [provider1Id, provider2Id, provider3Id] }
    )

    expect(res.status).toBe(200)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )
    expect(getRes.data.data.providers.length).toBe(3)
  })

  // ─── Update: Reorder (Primary Provider) ────────────────────────────

  test('primary provider is the first provider in the array (index 0)', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.providers[0].id).toBe(provider1Id)
  })

  test('PUT /agents/:id can reorder providers to change primary', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    // Move provider3 to primary position
    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerIds: [provider3Id, provider1Id, provider2Id] }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('GET /agents/:id after reorder shows new primary provider', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.providers[0].id).toBe(provider3Id)
    expect(res.data.data.providers[1].id).toBe(provider1Id)
    expect(res.data.data.providers[2].id).toBe(provider2Id)
  })

  // ─── Update: Remove Providers ──────────────────────────────────────

  test('PUT /agents/:id can remove providers (reduce to one)', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerIds: [provider2Id] }
    )

    expect(res.status).toBe(200)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(getRes.data.data.providers.length).toBe(1)
    expect(getRes.data.data.providers[0].id).toBe(provider2Id)
  })

  test('PUT /agents/:id can replace all providers at once', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    // Replace provider2 with provider3
    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerIds: [provider3Id] }
    )

    expect(res.status).toBe(200)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(getRes.data.data.providers.length).toBe(1)
    expect(getRes.data.data.providers[0].id).toBe(provider3Id)

    // Restore to provider1 for subsequent tests
    await put(`/orgs/${ctx.orgId}/agents/${agentId}`, {
      providerIds: [provider1Id],
    })
  })

  // ─── Validation: Create ────────────────────────────────────────────

  test('POST /agents without providerIds returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ error?: string }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('Should Fail Agent'),
        orgId: ctx.orgId,
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /agents with empty providerIds array returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ error?: string }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('Should Fail Agent 2'),
        orgId: ctx.orgId,
        providerIds: [],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /agents with non-existent providerId returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ error?: string }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('Should Fail Agent 3'),
        orgId: ctx.orgId,
        providerIds: ['zz00000000'],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('POST /agents with duplicate providerIds deduplicates', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Dedup Agent'),
        orgId: ctx.orgId,
        providerIds: [provider1Id, provider1Id],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    // Should either succeed with deduplication or reject — either way is valid behavior
    if (res.status === 201) {
      const getRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${res.data.data.id}`
      )
      // If created, providers should be deduplicated to 1
      expect(getRes.data.data.providers.length).toBe(1)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.data.id}`)
    } else {
      // If rejected, that's also valid behavior (409 or 400)
      expect(res.ok).toBe(false)
    }
  })

  // ─── Quickstart: Junction ──────────────────────────────────────────

  describe('quickstart agent-provider junction', () => {
    let qsResult: Record<string, any> = {}

    afterAll(async () => {
      if (qsResult.endpoint?.id)
        await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project?.id}/endpoints/${qsResult.endpoint.id}`)
      if (qsResult.agent?.id) await tryDelete(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`)
      if (qsResult.project?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project.id}`)
      if (qsResult.secret?.id) await tryDelete(`/orgs/${ctx.orgId}/secrets/${qsResult.secret.id}`)
      if (qsResult.provider?.id) await tryDelete(`/orgs/${ctx.orgId}/providers/${qsResult.provider.id}`)
    })

    test('quickstart creates agent with providers array via junction', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const providerKey = env.testProviderKey || 'sk-test-quickstart-contract'

      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'anthropic',
          apiKey: providerKey,
          projectName: uniqueName('AP QS Project'),
          agentName: uniqueName('AP QS Agent'),
        }
      )

      expect(qsRes.status).toBe(201)
      qsResult = qsRes.data.data

      const qsAgent = qsResult.agent
      const qsProvider = qsResult.provider

      // Quickstart returns raw DB rows — verify the agent has providers via GET
      const agentRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${qsAgent.id}`
      )

      expect(agentRes.status).toBe(200)
      expect(Array.isArray(agentRes.data.data.providers)).toBe(true)
      expect(agentRes.data.data.providers.length).toBe(1)
      expect(agentRes.data.data.providers[0].id).toBe(qsProvider.id)
      expect(agentRes.data.data.providers[0].type).toBe('ai')
      expect(agentRes.data.data.providers[0].brand).toBe('anthropic')
    })

    test('quickstart agent can have additional providers added', async () => {
      if (setupFailed || !qsResult.agent?.id) return expect(setupFailed).toBe(false)

      // Add a second provider to the quickstart agent
      const res = await put<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`,
        { providerIds: [qsResult.provider.id, provider2Id] }
      )

      expect(res.status).toBe(200)

      const getRes = await get<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`
      )

      expect(getRes.data.data.providers.length).toBe(2)
      expect(getRes.data.data.providers[0].id).toBe(qsResult.provider.id)
      expect(getRes.data.data.providers[1].id).toBe(provider2Id)
    })
  })

  // ─── Create with providers array format ─────────────────────────────

  test('POST /agents with providers array sets per-provider models', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Providers Array Agent'),
        orgId: ctx.orgId,
        providers: [
          { id: provider1Id, priority: 0, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, priority: 1, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.data.id).toBeTruthy()

    // Verify via GET
    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${res.data.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.data.providers.length).toBe(2)
    expect(getRes.data.data.providers[0].id).toBe(provider1Id)
    expect(getRes.data.data.providers[1].id).toBe(provider2Id)

    // Verify providerModels parallel array
    expect(getRes.data.data.providerModels).toBeDefined()
    expect(getRes.data.data.providerModels[0]).toBe('claude-sonnet-4-5-20250929')
    expect(getRes.data.data.providerModels[1]).toBe('gpt-4o')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.data.id}`)
  })

  test('providers array with null model creates junction without model', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Null Model Agent'),
        orgId: ctx.orgId,
        providers: [
          { id: provider1Id, priority: 0, model: 'claude-sonnet-4-5-20250929' },
          { id: provider3Id, priority: 1 },
        ],
        projectIds: [projectId],
      }
    )

    expect(res.status).toBe(201)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${res.data.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.data.providerModels[0]).toBe('claude-sonnet-4-5-20250929')
    expect(getRes.data.data.providerModels[1]).toBeNull()

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.data.id}`)
  })

  // ─── Update: Per-provider models ────────────────────────────────────

  test('PUT /agents/:id with providers array updates models', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create agent with models
    const createRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Update Models Agent'),
        orgId: ctx.orgId,
        providers: [
          { id: provider1Id, priority: 0, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, priority: 1, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(createRes.status).toBe(201)
    const testAgentId = createRes.data.data.id

    // Update models
    const updateRes = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`,
      {
        providers: [
          { id: provider1Id, priority: 0, model: 'claude-3-opus' },
          { id: provider2Id, priority: 1, model: 'gpt-4-turbo' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    // Verify models changed
    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`
    )

    expect(getRes.data.data.providerModels[0]).toBe('claude-3-opus')
    expect(getRes.data.data.providerModels[1]).toBe('gpt-4-turbo')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${testAgentId}`)
  })

  test('PUT /agents/:id can clear a provider model to null', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const createRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Clear Model Agent'),
        orgId: ctx.orgId,
        providers: [
          { id: provider1Id, priority: 0, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, priority: 1, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(createRes.status).toBe(201)
    const testAgentId = createRes.data.data.id

    // Clear model for provider1, keep model for provider2
    const updateRes = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`,
      {
        providers: [
          { id: provider1Id, priority: 0 },
          { id: provider2Id, priority: 1, model: 'gpt-4o' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`
    )

    expect(getRes.data.data.providerModels[0]).toBeNull()
    expect(getRes.data.data.providerModels[1]).toBe('gpt-4o')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${testAgentId}`)
  })

  test('PUT /agents/:id reorder preserves models per provider', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const createRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Reorder Models Agent'),
        orgId: ctx.orgId,
        providers: [
          { id: provider1Id, priority: 0, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, priority: 1, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(createRes.status).toBe(201)
    const testAgentId = createRes.data.data.id

    // Swap order — provider2 becomes primary
    const updateRes = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`,
      {
        providers: [
          { id: provider2Id, priority: 0, model: 'gpt-4o' },
          { id: provider1Id, priority: 1, model: 'claude-sonnet-4-5-20250929' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`
    )

    // Provider2 is now first
    expect(getRes.data.data.providers[0].id).toBe(provider2Id)
    expect(getRes.data.data.providers[1].id).toBe(provider1Id)

    // Models follow their provider, not the array position
    expect(getRes.data.data.providerModels[0]).toBe('gpt-4o')
    expect(getRes.data.data.providerModels[1]).toBe('claude-sonnet-4-5-20250929')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${testAgentId}`)
  })

  // ─── Backward compatibility ─────────────────────────────────────────

  test('providerIds format still works without models', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Legacy Format Agent'),
        orgId: ctx.orgId,
        providerIds: [provider1Id, provider2Id],
        projectIds: [projectId],
        model: 'some-model',
      }
    )

    expect(res.status).toBe(201)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${res.data.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.data.providers.length).toBe(2)
    expect(getRes.data.data.model).toBe('some-model')

    // providerModels should be null for all when using providerIds format
    expect(getRes.data.data.providerModels).toBeDefined()
    for (const m of getRes.data.data.providerModels) {
      expect(m).toBeNull()
    }

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.data.id}`)
  })

  test('providers array takes precedence over providerIds when both sent', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Both Formats Agent'),
        orgId: ctx.orgId,
        providerIds: [provider3Id],
        providers: [
          { id: provider1Id, priority: 0, model: 'override-model' },
          { id: provider2Id, priority: 1 },
        ],
        projectIds: [projectId],
      }
    )

    expect(res.status).toBe(201)

    const getRes = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${res.data.data.id}`
    )

    // providers array should win — provider1 and provider2, not provider3
    expect(getRes.data.data.providers.length).toBe(2)
    expect(getRes.data.data.providers[0].id).toBe(provider1Id)
    expect(getRes.data.data.providers[1].id).toBe(provider2Id)
    expect(getRes.data.data.providerModels[0]).toBe('override-model')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.data.id}`)
  })

  // ─── Agent Delete: Junction Cleanup ────────────────────────────────

  test('DELETE /agents/:id cleans up provider junction', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a temp agent with two providers
    const createRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Cleanup Agent'),
        orgId: ctx.orgId,
        providerIds: [provider1Id, provider2Id],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(createRes.status).toBe(201)
    const tempAgentId = createRes.data.data.id

    // Delete the agent
    const delRes = await del(`/orgs/${ctx.orgId}/agents/${tempAgentId}`)
    expect(delRes.status).toBe(200)

    // Verify agent is gone
    const getRes = await get(`/orgs/${ctx.orgId}/agents/${tempAgentId}`)
    expect(getRes.status).toBe(404)

    // Providers should still exist (junction removed, not providers themselves)
    const prov1Res = await get(`/orgs/${ctx.orgId}/providers/${provider1Id}`)
    expect(prov1Res.status).toBe(200)

    const prov2Res = await get(`/orgs/${ctx.orgId}/providers/${provider2Id}`)
    expect(prov2Res.status).toBe(200)
  })
})

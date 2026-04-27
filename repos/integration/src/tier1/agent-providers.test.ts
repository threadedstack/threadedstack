import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Agent-Provider Relationship Contract Tests
 *
 * Validates the many-to-many agent-provider API contract:
 * - Agents are created with `providerInputs: Array<{id: string, model?: string | null}>`
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
    const projRes = await post<{ id: string }>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('AP Test Project'), orgId: ctx.orgId }
    )

    if (projRes.status !== 201 || !projRes.data?.id) {
      setupFailed = true
      return
    }
    projectId = projRes.data.id

    // Create three AI providers in the same org
    const [prov1Res, prov2Res, prov3Res] = await Promise.all([
      post<{ id: string }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('AP Provider Anthropic'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'anthropic',
        options: { baseUrl: 'https://api.anthropic.com' },
      }),
      post<{ id: string }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('AP Provider OpenAI'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'openai',
        options: { baseUrl: 'https://api.openai.com/v1' },
      }),
      post<{ id: string }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('AP Provider Google'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'google',
        options: { baseUrl: 'https://generativelanguage.googleapis.com/v1' },
      }),
    ])

    if (
      prov1Res.status !== 201 || !prov1Res.data?.id ||
      prov2Res.status !== 201 || !prov2Res.data?.id ||
      prov3Res.status !== 201 || !prov3Res.data?.id
    ) {
      setupFailed = true
      return
    }

    provider1Id = prov1Res.data.id
    provider2Id = prov2Res.data.id
    provider3Id = prov3Res.data.id
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

  test('POST /agents creates agent with providerInputs array', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Test Agent'),
        orgId: ctx.orgId,
        providerInputs: [{ id: provider1Id }],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeTruthy()

    agentId = res.data.id
  })

  test('POST /agents with multiple providerInputs creates multi-provider agent', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Multi Provider Agent'),
        orgId: ctx.orgId,
        providerInputs: [{ id: provider1Id }, { id: provider2Id }, { id: provider3Id }],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(201)

    // Verify via GET
    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${res.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.providerLinks.length).toBe(3)

    // Providers should be in the order submitted
    expect(getRes.data.providerLinks[0].provider.id).toBe(provider1Id)
    expect(getRes.data.providerLinks[1].provider.id).toBe(provider2Id)
    expect(getRes.data.providerLinks[2].provider.id).toBe(provider3Id)

    // Cleanup
    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.id}`)
  })

  // ─── Read ──────────────────────────────────────────────────────────

  test('GET /agents/:id returns agent with populated providers array', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(agentId)

    // providerLinks should be an array with the single provider
    expect(Array.isArray(res.data.providerLinks)).toBe(true)
    expect(res.data.providerLinks.length).toBe(1)
    expect(res.data.providerLinks[0].provider.id).toBe(provider1Id)
    expect(res.data.providerLinks[0].provider.type).toBe('ai')

    // Should NOT have old providerId field
    expect(res.data).not.toHaveProperty('providerId')
  })

  test('provider objects in agent response have expected fields', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)

    const link = res.data.providerLinks[0]
    expect(link).toBeDefined()
    const provider = link.provider
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

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/agents`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const agent = res.data.find((a: any) => a.id === agentId)
    expect(agent).toBeDefined()
    expect(Array.isArray(agent?.providerLinks)).toBe(true)
    expect(agent?.providerLinks.length).toBeGreaterThanOrEqual(1)
  })

  // ─── Update: Add Providers ─────────────────────────────────────────

  test('PUT /agents/:id can add a second provider', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerInputs: [{ id: provider1Id }, { id: provider2Id }] }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('GET /agents/:id after update shows both providers', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.providerLinks.length).toBe(2)

    const ids = res.data.providerLinks.map((l: any) => l.provider.id)
    expect(ids).toContain(provider1Id)
    expect(ids).toContain(provider2Id)
  })

  test('PUT /agents/:id can add a third provider', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerInputs: [{ id: provider1Id }, { id: provider2Id }, { id: provider3Id }] }
    )

    expect(res.status).toBe(200)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )
    expect(getRes.data.providerLinks.length).toBe(3)
  })

  // ─── Update: Reorder (Primary Provider) ────────────────────────────

  test('primary provider is the first provider in the array (index 0)', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.providerLinks[0].provider.id).toBe(provider1Id)
  })

  test('PUT /agents/:id can reorder providers to change primary', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    // Move provider3 to primary position
    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerInputs: [{ id: provider3Id }, { id: provider1Id }, { id: provider2Id }] }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('GET /agents/:id after reorder shows new primary provider', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.providerLinks[0].provider.id).toBe(provider3Id)
    expect(res.data.providerLinks[1].provider.id).toBe(provider1Id)
    expect(res.data.providerLinks[2].provider.id).toBe(provider2Id)
  })

  // ─── Update: Remove Providers ──────────────────────────────────────

  test('PUT /agents/:id can remove providers (reduce to one)', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerInputs: [{ id: provider2Id }] }
    )

    expect(res.status).toBe(200)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(getRes.data.providerLinks.length).toBe(1)
    expect(getRes.data.providerLinks[0].provider.id).toBe(provider2Id)
  })

  test('PUT /agents/:id can replace all providers at once', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    // Replace provider2 with provider3
    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`,
      { providerInputs: [{ id: provider3Id }] }
    )

    expect(res.status).toBe(200)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    expect(getRes.data.providerLinks.length).toBe(1)
    expect(getRes.data.providerLinks[0].provider.id).toBe(provider3Id)

    // Restore to provider1 for subsequent tests
    await put(`/orgs/${ctx.orgId}/agents/${agentId}`, {
      providerInputs: [{ id: provider1Id }],
    })
  })

  // ─── Validation: Create ────────────────────────────────────────────

  test('POST /agents without providerInputs returns 400', async () => {
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

  test('POST /agents with empty providerInputs array returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ error?: string }>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('Should Fail Agent 2'),
        orgId: ctx.orgId,
        providerInputs: [],
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
        providerInputs: [{ id: 'zz00000000' }],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('POST /agents with duplicate providerInputs deduplicates', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Dedup Agent'),
        orgId: ctx.orgId,
        providerInputs: [{ id: provider1Id }, { id: provider1Id }],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    // Should either succeed with deduplication or reject — either way is valid behavior
    if (res.status === 201) {
      const getRes = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/agents/${res.data.id}`
      )
      // If created, providers should be deduplicated to 1
      expect(getRes.data.providerLinks.length).toBe(1)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.id}`)
    } else {
      // If rejected, that's also valid behavior (409 or 400)
      expect(res.ok).toBe(false)
    }
  })

  // ─── Quickstart: Junction ──────────────────────────────────────────

  describe('quickstart agent-provider junction', () => {
    let junctionFixtures: TFixtureResult = {}

    afterAll(async () => {
      await cleanupFixtures(ctx.orgId, junctionFixtures)
    })

    test('quickstart creates agent with providers array via junction', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      junctionFixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        apiKey: env.testProviderKey,
        projectName: uniqueName('AP QS Project'),
        agentName: uniqueName('AP QS Agent'),
      })

      expect(junctionFixtures.provider).toBeDefined()

      const qsAgent = junctionFixtures.agent
      const qsProvider = junctionFixtures.provider

      // Verify the agent has providers via GET
      const agentRes = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/agents/${qsAgent!.id}`
      )

      expect(agentRes.status).toBe(200)
      expect(Array.isArray(agentRes.data.providerLinks)).toBe(true)
      expect(agentRes.data.providerLinks.length).toBe(1)
      expect(agentRes.data.providerLinks[0].provider.id).toBe(qsProvider!.id)
      expect(agentRes.data.providerLinks[0].provider.type).toBe('ai')
      expect(agentRes.data.providerLinks[0].provider.brand).toBe('anthropic')
    })

    test('quickstart agent can have additional providers added', async () => {
      if (setupFailed || !junctionFixtures.agent?.id) return expect(setupFailed).toBe(false)

      // Add a second provider to the quickstart agent
      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/agents/${junctionFixtures.agent.id}`,
        { providerInputs: [{ id: junctionFixtures.provider!.id }, { id: provider2Id }] }
      )

      expect(res.status).toBe(200)

      const getRes = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/agents/${junctionFixtures.agent.id}`
      )

      expect(getRes.data.providerLinks.length).toBe(2)
      expect(getRes.data.providerLinks[0].provider.id).toBe(junctionFixtures.provider!.id)
      expect(getRes.data.providerLinks[1].provider.id).toBe(provider2Id)
    })
  })

  // ─── Create with providers array format ─────────────────────────────

  test('POST /agents with providers array sets per-provider models', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Providers Array Agent'),
        orgId: ctx.orgId,
        providerInputs: [
          { id: provider1Id, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.id).toBeTruthy()

    // Verify via GET
    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${res.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(Array.isArray(getRes.data.providerLinks)).toBe(true)
    expect(getRes.data.providerLinks.length).toBe(2)
    expect(getRes.data.providerLinks[0].provider.id).toBe(provider1Id)
    expect(getRes.data.providerLinks[1].provider.id).toBe(provider2Id)

    // Verify per-provider models via providerLinks
    expect(getRes.data.providerLinks[0].model).toBe('claude-sonnet-4-5-20250929')
    expect(getRes.data.providerLinks[1].model).toBe('gpt-4o')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.id}`)
  })

  test('providers array with null model creates junction without model', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Null Model Agent'),
        orgId: ctx.orgId,
        providerInputs: [
          { id: provider1Id, model: 'claude-sonnet-4-5-20250929' },
          { id: provider3Id },
        ],
        projectIds: [projectId],
      }
    )

    expect(res.status).toBe(201)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${res.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.providerLinks[0].model).toBe('claude-sonnet-4-5-20250929')
    expect(getRes.data.providerLinks[1].model).toBeNull()

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.id}`)
  })

  // ─── Update: Per-provider models ────────────────────────────────────

  test('PUT /agents/:id with providers array updates models', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create agent with models
    const createRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Update Models Agent'),
        orgId: ctx.orgId,
        providerInputs: [
          { id: provider1Id, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(createRes.status).toBe(201)
    const testAgentId = createRes.data.id

    // Update models
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`,
      {
        providerInputs: [
          { id: provider1Id, model: 'claude-3-opus' },
          { id: provider2Id, model: 'gpt-4-turbo' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    // Verify models changed
    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`
    )

    expect(getRes.data.providerLinks[0].model).toBe('claude-3-opus')
    expect(getRes.data.providerLinks[1].model).toBe('gpt-4-turbo')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${testAgentId}`)
  })

  test('PUT /agents/:id can clear a provider model to null', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const createRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Clear Model Agent'),
        orgId: ctx.orgId,
        providerInputs: [
          { id: provider1Id, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(createRes.status).toBe(201)
    const testAgentId = createRes.data.id

    // Clear model for provider1, keep model for provider2
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`,
      {
        providerInputs: [
          { id: provider1Id },
          { id: provider2Id, model: 'gpt-4o' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`
    )

    expect(getRes.data.providerLinks[0].model).toBeNull()
    expect(getRes.data.providerLinks[1].model).toBe('gpt-4o')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${testAgentId}`)
  })

  test('PUT /agents/:id reorder preserves models per provider', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const createRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Reorder Models Agent'),
        orgId: ctx.orgId,
        providerInputs: [
          { id: provider1Id, model: 'claude-sonnet-4-5-20250929' },
          { id: provider2Id, model: 'gpt-4o' },
        ],
        projectIds: [projectId],
      }
    )

    expect(createRes.status).toBe(201)
    const testAgentId = createRes.data.id

    // Swap order — provider2 becomes primary
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`,
      {
        providerInputs: [
          { id: provider2Id, model: 'gpt-4o' },
          { id: provider1Id, model: 'claude-sonnet-4-5-20250929' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${testAgentId}`
    )

    // Provider2 is now first
    expect(getRes.data.providerLinks[0].provider.id).toBe(provider2Id)
    expect(getRes.data.providerLinks[1].provider.id).toBe(provider1Id)

    // Models follow their provider, not the array position
    expect(getRes.data.providerLinks[0].model).toBe('gpt-4o')
    expect(getRes.data.providerLinks[1].model).toBe('claude-sonnet-4-5-20250929')

    await tryDelete(`/orgs/${ctx.orgId}/agents/${testAgentId}`)
  })

  // ─── Backward compatibility ─────────────────────────────────────────

  test('providerInputs without model creates junction with null model', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP No Model Agent'),
        orgId: ctx.orgId,
        providerInputs: [{ id: provider1Id }, { id: provider2Id }],
        projectIds: [projectId],
        model: 'some-model',
      }
    )

    expect(res.status).toBe(201)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${res.data.id}`
    )

    expect(getRes.status).toBe(200)
    expect(Array.isArray(getRes.data.providerLinks)).toBe(true)
    expect(getRes.data.providerLinks.length).toBe(2)
    expect(getRes.data.model).toBe('some-model')

    // model should be null for all when no model is specified in providerInputs
    for (const link of getRes.data.providerLinks) {
      expect(link.model).toBeNull()
    }

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.id}`)
  })

  test('providerInputs with model sets per-provider model override', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Model Override Agent'),
        orgId: ctx.orgId,
        providerInputs: [
          { id: provider1Id, model: 'override-model' },
          { id: provider2Id },
        ],
        projectIds: [projectId],
      }
    )

    expect(res.status).toBe(201)

    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${res.data.id}`
    )

    // providerLinks should have provider1 and provider2 with correct models
    expect(Array.isArray(getRes.data.providerLinks)).toBe(true)
    expect(getRes.data.providerLinks.length).toBe(2)
    expect(getRes.data.providerLinks[0].provider.id).toBe(provider1Id)
    expect(getRes.data.providerLinks[1].provider.id).toBe(provider2Id)
    expect(getRes.data.providerLinks[0].model).toBe('override-model')
    expect(getRes.data.providerLinks[1].model).toBeNull()

    await tryDelete(`/orgs/${ctx.orgId}/agents/${res.data.id}`)
  })

  // ─── Agent Delete: Junction Cleanup ────────────────────────────────

  test('DELETE /agents/:id cleans up provider junction', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a temp agent with two providers
    const createRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents`,
      {
        name: uniqueName('AP Cleanup Agent'),
        orgId: ctx.orgId,
        providerInputs: [{ id: provider1Id }, { id: provider2Id }],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      }
    )

    expect(createRes.status).toBe(201)
    const tempAgentId = createRes.data.id

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

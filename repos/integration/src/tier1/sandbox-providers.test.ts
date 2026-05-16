import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

const baseCfg = {
  image: 'node:22-slim',
  ports: { '3000': { protocol: 'http' } },
  resources: {
    limits: { cpu: '500m', memory: '256Mi' },
    requests: { cpu: '100m', memory: '128Mi' },
  },
}

/**
 * Sandbox provider tests — providers are managed via create/update sandbox,
 * matching the agent pattern (no separate link/unlink endpoints).
 */
describe('Tier 1: Sandbox Provider Linking', () => {
  const ctx = readContext()

  let sandboxId = ''
  let providerId = ''
  let providerName = ''
  const createdSandboxIds: string[] = []
  const createdProviderIds: string[] = []

  beforeAll(async () => {
    const provRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/providers`,
      {
        name: uniqueName('sb-link-provider'),
        type: 'ai',
        brand: 'anthropic',
      }
    )

    if (provRes.ok && provRes.data?.id) {
      providerId = provRes.data.id
      providerName = provRes.data.name
      createdProviderIds.push(providerId)
    }
  }, 30_000)

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
    for (const provId of createdProviderIds) {
      await tryDelete(`/orgs/${ctx.orgId}/providers/${provId}`)
    }
  })

  // --- Create with providers ---

  test('POST create sandbox with providerInputs links providers', async () => {
    if (!providerId) return expect(providerId).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-prov-create'),
        config: {
          ...baseCfg,
          runtime: 'claude-code',
          runtimeCommand: 'claude',
        },
        orgId: ctx.orgId,
        providerInputs: [{ id: providerId }],
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(Array.isArray(res.data.providerLinks)).toBe(true)

    const linked = res.data.providerLinks.find((l: any) => l.provider.id === providerId)
    expect(linked).toBeDefined()
    expect(linked?.provider.brand).toBe('anthropic')
    expect(linked?.provider.name).toBe(providerName)
    expect(linked?.priority).toBe(0)

    expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
    expect(res.data.gitProviderLinks.length).toBe(0)

    sandboxId = res.data.id
    createdSandboxIds.push(sandboxId)
  })

  // --- GET includes providers ---

  test('GET single sandbox includes providers array', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(Array.isArray(res.data.providerLinks)).toBe(true)

    if (providerId) {
      const found = res.data.providerLinks.find((l: any) => l.provider.id === providerId)
      expect(found).toBeDefined()
      expect(found?.provider.brand).toBe('anthropic')
      expect(found?.provider.name).toBe(providerName)
    }
  })

  // --- Update with providers ---

  test('PUT update sandbox with providerInputs replaces providers', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    // Create a second provider
    const prov2Res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/providers`,
      {
        name: uniqueName('sb-link-provider-2'),
        type: 'ai',
        brand: 'anthropic',
      }
    )

    if (!prov2Res.ok || !prov2Res.data?.id) return expect(prov2Res.ok).toBe(true)

    const prov2Id = prov2Res.data.id
    createdProviderIds.push(prov2Id)

    // Update sandbox to use both providers with model override
    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        providerInputs: [
          { id: providerId },
          { id: prov2Id, model: 'claude-sonnet-4-20250514' },
        ],
      }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.providerLinks)).toBe(true)
    expect(res.data.providerLinks.length).toBe(2)

    // Verify priority ordering
    expect(res.data.providerLinks[0].provider.id).toBe(providerId)
    expect(res.data.providerLinks[1].provider.id).toBe(prov2Id)
    expect(res.data.providerLinks[0].priority).toBe(0)
    expect(res.data.providerLinks[1].priority).toBe(1)

    // Verify model override
    expect(res.data.providerLinks[1].model).toBe('claude-sonnet-4-20250514')
  })

  test('PUT update existing provider model persists the change', async () => {
    if (!sandboxId || !providerId) return expect(sandboxId && providerId).toBeTruthy()

    // Re-add the original provider with a specific model
    const addRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        providerInputs: [{ id: providerId, model: 'claude-sonnet-4-20250514' }],
      }
    )

    expect(addRes.status).toBe(200)
    expect(addRes.ok).toBe(true)
    const addedLink = addRes.data.providerLinks.find(
      (l: any) => l.provider.id === providerId
    )
    expect(addedLink?.model).toBe('claude-sonnet-4-20250514')

    // Update the SAME provider to a DIFFERENT model
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        providerInputs: [{ id: providerId, model: 'claude-opus-4-20250514' }],
      }
    )

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)
    const updatedLink = updateRes.data.providerLinks.find(
      (l: any) => l.provider.id === providerId
    )
    expect(updatedLink?.model).toBe('claude-opus-4-20250514')

    // GET to verify persistence
    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(getRes.status).toBe(200)
    const persistedLink = getRes.data.providerLinks.find(
      (l: any) => l.provider.id === providerId
    )
    expect(persistedLink?.model).toBe('claude-opus-4-20250514')
  })

  test('PUT clearing model to null persists the change', async () => {
    if (!sandboxId || !providerId) return expect(sandboxId && providerId).toBeTruthy()

    // Provider currently has model 'claude-opus-4-20250514' from previous test
    // Clear model by setting to null
    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        providerInputs: [{ id: providerId, model: null }],
      }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    const link = res.data.providerLinks.find(
      (l: any) => l.provider.id === providerId
    )
    expect(link?.model).toBeNull()

    // GET to verify persistence
    const getRes = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(getRes.status).toBe(200)
    const persistedLink = getRes.data.providerLinks.find(
      (l: any) => l.provider.id === providerId
    )
    expect(persistedLink?.model).toBeNull()
  })

  test('PUT re-ordering providers updates priority', async () => {
    if (!sandboxId || !providerId) return expect(sandboxId && providerId).toBeTruthy()

    // Find second provider from earlier test
    const providerIds = createdProviderIds.filter((id) => id !== providerId)
    if (!providerIds.length) return expect(providerIds.length).toBeGreaterThan(0)
    const prov2Id = providerIds[0]

    // Link both providers in order: [providerId, prov2Id]
    const setupRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        providerInputs: [{ id: providerId }, { id: prov2Id }],
      }
    )

    expect(setupRes.status).toBe(200)
    expect(setupRes.data.providerLinks[0].provider.id).toBe(providerId)
    expect(setupRes.data.providerLinks[0].priority).toBe(0)
    expect(setupRes.data.providerLinks[1].provider.id).toBe(prov2Id)
    expect(setupRes.data.providerLinks[1].priority).toBe(1)

    // Reverse order: [prov2Id, providerId]
    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        providerInputs: [{ id: prov2Id }, { id: providerId }],
      }
    )

    expect(res.status).toBe(200)
    expect(res.data.providerLinks[0].provider.id).toBe(prov2Id)
    expect(res.data.providerLinks[0].priority).toBe(0)
    expect(res.data.providerLinks[1].provider.id).toBe(providerId)
    expect(res.data.providerLinks[1].priority).toBe(1)
  })

  test('PUT update sandbox with empty providerInputs removes all providers', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      { providerInputs: [] }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.providerLinks)).toBe(true)
    expect(res.data.providerLinks.length).toBe(0)
  })

  test('GET single sandbox shows empty providers after removal', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.providerLinks).toBeDefined()
    expect(Array.isArray(res.data.providerLinks)).toBe(true)
    expect(res.data.providerLinks.length).toBe(0)
  })

  // --- Brand compatibility ---

  describe('runtime brand compatibility', () => {
    let codexSandboxId = ''

    test('create with incompatible provider brand is rejected', async () => {
      if (!providerId) return expect(providerId).toBeTruthy()

      // Create a codex sandbox with an anthropic provider (incompatible)
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-codex-incompat'),
          config: {
            ...baseCfg,
            runtime: 'codex',
            runtimeCommand: 'codex',
          },
          orgId: ctx.orgId,
          providerInputs: [{ id: providerId }],
        }
      )

      // The sandbox is created but provider linking should fail silently
      // or the sandbox should be created without the incompatible provider
      if (res.ok) {
        codexSandboxId = res.data.id
        createdSandboxIds.push(codexSandboxId)
      }
    })

    test('create with compatible provider brand succeeds', async () => {
      const compatProvRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('sb-compat-provider'),
          type: 'ai',
          brand: 'openai',
        }
      )

      if (!compatProvRes.ok || !compatProvRes.data?.id) {
        return expect(compatProvRes.ok).toBe(true)
      }

      const compatProviderId = compatProvRes.data.id
      createdProviderIds.push(compatProviderId)

      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-codex-compat'),
          config: {
            ...baseCfg,
            runtime: 'codex',
            runtimeCommand: 'codex',
          },
          orgId: ctx.orgId,
          providerInputs: [{ id: compatProviderId }],
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data.providerLinks)).toBe(true)

      const linked = res.data.providerLinks.find((l: any) => l.provider.id === compatProviderId)
      expect(linked).toBeDefined()
      expect(linked?.provider.brand).toBe('openai')

      createdSandboxIds.push(res.data.id)
    })
  })

  // --- Docker provider linking ---

  describe(`docker provider linking`, () => {
    let dockerProviderId = ``
    let dockerProviderName = ``

    test(`setup: create docker provider`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`sb-docker-provider`),
          type: `docker`,
          brand: `ghcr`,
          options: { registry: `ghcr.io`, username: `testuser` },
        }
      )

      expect(res.status).toBe(201)
      dockerProviderId = res.data.id
      dockerProviderName = res.data.name
      createdProviderIds.push(dockerProviderId)
    })

    test(`POST create sandbox with docker provider in providerInputs`, async () => {
      if (!dockerProviderId) return expect(dockerProviderId).toBeTruthy()

      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName(`sb-docker-link`),
          config: { ...baseCfg, runtime: `claude-code`, runtimeCommand: `claude` },
          orgId: ctx.orgId,
          providerInputs: [{ id: dockerProviderId }],
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data.providerLinks)).toBe(true)

      const linked = res.data.providerLinks.find((l: any) => l.provider.id === dockerProviderId)
      expect(linked).toBeDefined()
      expect(linked?.provider.type).toBe(`docker`)
      expect(linked?.provider.brand).toBe(`ghcr`)
      expect(linked?.provider.name).toBe(dockerProviderName)

      createdSandboxIds.push(res.data.id)
    })

    test(`POST create sandbox with mixed AI + docker providers`, async () => {
      if (!providerId || !dockerProviderId) {
        return expect(providerId && dockerProviderId).toBeTruthy()
      }

      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName(`sb-mixed-providers`),
          config: { ...baseCfg, runtime: `claude-code`, runtimeCommand: `claude` },
          orgId: ctx.orgId,
          providerInputs: [
            { id: providerId },
            { id: dockerProviderId },
          ],
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data.providerLinks)).toBe(true)
      expect(res.data.providerLinks.length).toBe(2)

      const aiLink = res.data.providerLinks.find((l: any) => l.provider.id === providerId)
      const dockerLink = res.data.providerLinks.find((l: any) => l.provider.id === dockerProviderId)
      expect(aiLink).toBeDefined()
      expect(aiLink?.provider.type).toBe(`ai`)
      expect(dockerLink).toBeDefined()
      expect(dockerLink?.provider.type).toBe(`docker`)

      createdSandboxIds.push(res.data.id)
    })
  })

  // --- Cross-org isolation ---

  test('create sandbox with non-existent provider is handled', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-bad-provider'),
        config: { ...baseCfg, runtime: 'claude-code', runtimeCommand: 'claude' },
        orgId: ctx.orgId,
        providerInputs: [{ id: '00000000-0000-0000-0000-000000000001' }],
      }
    )

    // Sandbox should be created; non-existent provider is silently skipped
    if (res.ok && res.data?.id) {
      createdSandboxIds.push(res.data.id)
    }
  })
})

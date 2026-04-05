import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Providers CRUD', () => {
  const ctx = readContext()
  let projectId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  /** ID of the provider created by the CREATE test */
  let providerId = ''
  /** Preserved copy of providerId for the 404 test after deletion */
  let deletedProviderId = ''

  const providerName = uniqueName('test-provider')
  const updatedName = uniqueName('test-provider-updated')

  beforeAll(async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: uniqueName('Providers Test Project'),
        agentName: uniqueName('Providers Test Agent'),
      }
    )

    if (res.status !== 201 || !res.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data
    projectId = quickstartResult.project.id
  })

  afterAll(async () => {
    // Clean up test provider first
    if (providerId)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${providerId}`)

    // Clean up quickstart resources in reverse-dependency order
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  // --- Create ---

  test('POST creates provider', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/providers`,
      {
        name: providerName,
        type: 'ai',
        brand: 'openai',
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    providerId = res.data.id
  })

  // --- Read ---

  test('GET single provider by ID', async () => {
    if (setupFailed || !providerId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/providers/${providerId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    const provider = res.data
    expect(provider.id).toBe(providerId)
    expect(provider.name).toBe(providerName)
    expect(provider.type).toBe('ai')
    expect(provider.brand).toBe('openai')
    expect(provider.createdAt).toBeDefined()
  })

  // --- List ---

  test('GET /orgs/:orgId/providers returns 200 with data array', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/providers`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET list includes created provider', async () => {
    if (setupFailed || !providerId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/providers?limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const found = res.data.find((p: any) => p.id === providerId)
    expect(found).toBeDefined()
    expect(found?.name).toBe(providerName)
  })

  // --- Update ---

  test('PUT updates provider name', async () => {
    if (setupFailed || !providerId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/providers/${providerId}`,
      { name: updatedName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedName)
  })

  // --- Delete ---

  test('DELETE removes provider (requires admin scope)', async () => {
    if (setupFailed || !providerId) return expect(setupFailed).toBe(false)

    const res = await del<{ success: boolean }>(
      `/orgs/${ctx.orgId}/providers/${providerId}`
    )

    // DELETE requires admin role — API key with write scope (member) gets 403
    if (res.status === 403) {
      // Permission denied is valid behavior for non-admin keys
      expect(res.ok).toBe(false)
      return
    }

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.success).toBe(true)

    // Preserve ID for the 404 test, then clear so afterAll skips it
    deletedProviderId = providerId
    providerId = ''
  })

  test('GET deleted provider returns 404', async () => {
    if (setupFailed || !deletedProviderId) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/providers/${deletedProviderId}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Auth ---

  test('GET without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/providers`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})

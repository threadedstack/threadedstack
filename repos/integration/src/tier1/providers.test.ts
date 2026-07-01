import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Providers CRUD', () => {
  const ctx = readContext()
  let projectId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  /** ID of the provider created by the CREATE test */
  let providerId = ''
  /** Preserved copy of providerId for the 404 test after deletion */
  let deletedProviderId = ''

  const providerName = uniqueName('test-provider')
  const updatedName = uniqueName('test-provider-updated')

  beforeAll(async () => {
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      projectName: uniqueName('Providers Test Project'),
      // The `agents` feature flag is off platform-wide; providers tests
      // only need a project, so skip the (currently-impossible) agent step.
      createAgent: false,
    })

    if (!fixtures.project?.id) {
      setupFailed = true
      return
    }

    projectId = fixtures.project.id
  })

  afterAll(async () => {
    // Clean up test provider first
    if (providerId)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${providerId}`)

    await cleanupFixtures(ctx.orgId, fixtures)
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

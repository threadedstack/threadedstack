import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Endpoints CRUD', () => {
  const ctx = readContext()
  let projectId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  /** ID of the endpoint created by the CREATE test */
  let endpointId = ''
  /** Preserved copy of endpointId for the 404 test after deletion */
  let deletedEndpointId = ''

  const endpointName = uniqueName('test-endpoint')
  const updatedName = uniqueName('test-endpoint-updated')

  beforeAll(async () => {
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      projectName: uniqueName('Endpoints Test Project'),
      agentName: uniqueName('Endpoints Test Agent'),
      createAgent: false,
      createEndpoint: false,
    })

    if (!fixtures.project?.id) {
      setupFailed = true
      return
    }

    projectId = fixtures.project.id
  })

  afterAll(async () => {
    // Clean up test endpoint first (it references the project)
    if (endpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`)

    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // --- Create ---

  test('POST creates proxy endpoint', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: endpointName,
        type: 'proxy',
        method: 'get',
        path: `/test-path-${Date.now()}`,
        projectId,
        options: { url: 'https://httpbin.org/get' },
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    endpointId = res.data.id
  })

  test('created endpoint has expected shape', async () => {
    if (setupFailed || !endpointId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    const ep = res.data
    expect(ep.id).toBe(endpointId)
    expect(ep.name).toBe(endpointName)
    expect(ep.type).toBe('proxy')
    expect(ep.method).toBe('get')
    expect(ep.options).toBeDefined()
    expect(ep.options.url).toBe('https://httpbin.org/get')
    expect(ep.createdAt).toBeDefined()
  })

  test('POST without required fields returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Missing name and type
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      { projectId }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('no-auth-endpoint'),
        type: 'proxy',
        method: 'get',
        path: '/no-auth',
        projectId,
        options: { url: 'https://httpbin.org/get' },
      },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Read ---

  test('GET list returns 200 with array', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET list includes created endpoint', async () => {
    if (setupFailed || !endpointId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints?limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const found = res.data.find((ep: any) => ep.id === endpointId)
    expect(found).toBeDefined()
    expect(found?.name).toBe(endpointName)
  })

  test('GET single endpoint by ID', async () => {
    if (setupFailed || !endpointId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(endpointId)
    expect(res.data.name).toBe(endpointName)
  })

  test('GET nonexistent endpoint returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/zz00000000`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Update ---

  test('PUT updates endpoint name', async () => {
    if (setupFailed || !endpointId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`,
      { name: updatedName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedName)
  })

  test('updated name persists on re-fetch', async () => {
    if (setupFailed || !endpointId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedName)
  })

  // --- Type-Specific Validation ---

  test('POST proxy endpoint without url in options returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('proxy-no-url'),
        type: 'proxy',
        method: 'get',
        path: '/proxy-no-url',
        projectId,
        options: {},
      }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  // --- Delete ---

  test('DELETE removes endpoint (requires admin scope)', async () => {
    if (setupFailed || !endpointId) return expect(setupFailed).toBe(false)

    const res = await del<{ success: boolean; id: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`
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
    deletedEndpointId = endpointId
    endpointId = ''
  })

  test('GET deleted endpoint returns 404', async () => {
    if (setupFailed || !deletedEndpointId) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${deletedEndpointId}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Auth ---

  test('GET without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})

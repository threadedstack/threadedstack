import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

const nonexistentOrgId = 'zz99Xfake0'

describe('Tier 1: Organizations', () => {
  const ctx = readContext()

  test('GET /orgs returns 200 with paginated data array', async () => {
    const res = await get<unknown[]>('/orgs')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET /orgs/:orgId returns 200 with matching org', async () => {
    const res = await get<{ id: string }>(`/orgs/${ctx.orgId}`)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(ctx.orgId)
  })

  test('GET /orgs?limit=1 returns at most 1 item', async () => {
    const res = await get<unknown[]>(
      '/orgs?limit=1'
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeLessThanOrEqual(1)
    expect(res.limit).toBe(1)
  })

  test('GET /orgs includes userRole on each org in response', async () => {
    const res = await get<Record<string, unknown>[]>('/orgs')

    expect(res.status).toBe(200)
    expect(res.data.length).toBeGreaterThan(0)

    for (const org of res.data) {
      expect(org).toHaveProperty('userRole')
      expect(typeof org.userRole).toBe('string')
    }
  })

  test('GET /orgs/:orgId includes userRole in response', async () => {
    const res = await get<Record<string, unknown>>(`/orgs/${ctx.orgId}`)

    expect(res.status).toBe(200)
    expect(res.data).toHaveProperty('userRole')
    expect(typeof res.data.userRole).toBe('string')
  })
})

describe('Tier 1: Org Write Operations', () => {
  const ctx = readContext()

  const orgName = uniqueName('test-org')
  const updatedOrgName = uniqueName('test-org-updated')

  /** ID of the org created by the POST test — used for update/delete */
  let createdOrgId = ''

  afterAll(async () => {
    if (createdOrgId) {
      await tryDelete(`/orgs/${createdOrgId}`)
    }
  })

  // --- Create ---

  test('POST /orgs creates org with name', async () => {
    const res = await post<Record<string, any>>('/orgs', { name: orgName })

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(res.data.name).toBe(orgName)
    expect(res.data.createdAt).toBeDefined()
    expect(res.data.userRole).toBe('owner')

    createdOrgId = res.data.id
  })

  test('POST /orgs with missing name returns 400', async () => {
    const res = await post('/orgs', {})

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /orgs without auth returns 401', async () => {
    const res = await post('/orgs', { name: uniqueName('no-auth-org') }, { noAuth: true })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Update ---

  test('PUT /orgs/:orgId updates org name', async () => {
    if (!createdOrgId) return expect(createdOrgId).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/orgs/${createdOrgId}`,
      { name: updatedOrgName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedOrgName)
  })

  test('PUT /orgs/:orgId with nonexistent orgId returns 404', async () => {
    const res = await put(`/orgs/${nonexistentOrgId}`, { name: 'ghost' })

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('PUT /orgs/:orgId without auth returns 401', async () => {
    if (!createdOrgId) return expect(createdOrgId).toBeTruthy()

    const res = await put(
      `/orgs/${createdOrgId}`,
      { name: 'unauthorized' },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Delete ---

  test('DELETE /orgs/:orgId removes the newly created org', async () => {
    if (!createdOrgId) return expect(createdOrgId).toBeTruthy()

    const res = await del<Record<string, any>>(`/orgs/${createdOrgId}`)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    // Clear so afterAll skips cleanup
    createdOrgId = ''
  })

  test('DELETE /orgs/:orgId with nonexistent org returns 404', async () => {
    const res = await del(`/orgs/${nonexistentOrgId}`)

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('DELETE /orgs/:orgId without auth returns 401', async () => {
    const res = await del(`/orgs/${ctx.orgId}`, { noAuth: true })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test.skipIf(!ctx.adminApiKey)(
    'DELETE /orgs/:orgId with admin key (not owner) returns 403',
    async () => {
      // Use a freshly created org to test admin-cannot-delete safely.
      // NEVER send DELETE for ctx.orgId — if the backend allows it, the seed org is destroyed.
      const createRes = await post<Record<string, any>>('/orgs', {
        name: `admin-delete-test-${Date.now()}`,
      })
      if (createRes.status !== 201 || !createRes.data?.id) {
        console.warn('[orgs] SKIPPED: admin delete 403 test — could not create test org')
        return
      }
      const tempOrgId = createRes.data.id

      try {
        const res = await del(`/orgs/${tempOrgId}`, { apiKey: ctx.adminApiKey })
        expect(res.status).toBe(403)
        expect(res.ok).toBe(false)
      } finally {
        await tryDelete(`/orgs/${tempOrgId}`)
      }
    }
  )
})

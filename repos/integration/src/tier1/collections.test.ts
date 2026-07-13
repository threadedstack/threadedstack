import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Collections (project-scoped Collections/Records store).
 *
 * Collection `name` is a URL path segment (`/:name`), not an opaque id, so
 * test names avoid uniqueName()'s embedded space in favor of a dash-safe
 * slug. Every collection created here lives in a dedicated test project
 * (never ctx.projectId) so teardown can delete the whole project without
 * touching shared fixtures other suites depend on.
 */

const uniqueCollectionName = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`

describe('Tier 1: Collections', () => {
  const ctx = readContext()
  const hasMember = !!ctx.memberApiKey

  let testProjectId = ''
  let setupFailed = false

  const collectionName = uniqueCollectionName('test-collection')
  const updatedDescription = 'updated description'
  const schema = [
    { name: 'title', type: 'string', required: true },
    { name: 'count', type: 'number' },
  ]

  beforeAll(async () => {
    const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
      name: uniqueName('Collections Test Project'),
      orgId: ctx.orgId,
    })
    if (!res.ok || !res.data?.id) {
      setupFailed = true
      return
    }
    testProjectId = res.data.id
  }, 30_000)

  afterAll(async () => {
    if (testProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${testProjectId}`)
  })

  // --- Create ---

  test('POST creates a collection', async () => {
    expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
      { name: collectionName, description: 'a test collection', schema }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(res.data.name).toBe(collectionName)
    expect(res.data.projectId).toBe(testProjectId)
    expect(res.data.description).toBe('a test collection')
    expect(res.data.schema).toEqual(schema)
  })

  test('POST without name returns 400', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
      { description: 'missing name' }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST duplicate name in the same project still returns 201 (name is not globally unique)', async () => {
    // getByName/create are project+name scoped, not enforced-unique at the DB
    // layer here — this pins down current behavior so a future uniqueness
    // constraint change is a deliberate, visible test update.
    const dupeName = uniqueCollectionName('test-collection-dupe')

    const first = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
      { name: dupeName }
    )
    expect(first.status).toBe(201)

    const second = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
      { name: dupeName }
    )
    expect(second.status).toBe(201)
    expect(second.data.id).not.toBe(first.data.id)

    await tryDelete(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/${dupeName}`
    )
  })

  // --- Read ---

  test('GET single collection by name', async () => {
    expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/${collectionName}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.name).toBe(collectionName)
    expect(res.data.projectId).toBe(testProjectId)
    expect(res.data.schema).toEqual(schema)
  })

  test('GET non-existent collection returns 404', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/does-not-exist-${Date.now()}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- List ---

  test('GET list returns 200 with a data array', async () => {
    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET list includes the created collection with a recordCount', async () => {
    expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`
    )

    expect(res.status).toBe(200)
    const found = res.data.find((c: any) => c.name === collectionName)
    expect(found).toBeDefined()
    expect(found?.recordCount).toBe(0)
  })

  // --- Update ---

  test('PUT updates collection description and schema', async () => {
    expect(setupFailed).toBe(false)

    const newSchema = [...schema, { name: 'active', type: 'boolean' }]
    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/${collectionName}`,
      { description: updatedDescription, schema: newSchema }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.description).toBe(updatedDescription)
    expect(res.data.schema).toEqual(newSchema)
    // name unchanged since it wasn't part of the update body
    expect(res.data.name).toBe(collectionName)
  })

  test('PUT non-existent collection returns 404', async () => {
    const res = await put(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/does-not-exist-${Date.now()}`,
      { description: 'no-op' }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Delete ---

  test('DELETE removes the collection', async () => {
    expect(setupFailed).toBe(false)

    const res = await del<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/${collectionName}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.success).toBe(true)
  })

  test('GET deleted collection returns 404', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/${collectionName}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('DELETE non-existent collection returns 404', async () => {
    const res = await del(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections/does-not-exist-${Date.now()}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Auth ---

  test('GET without auth returns 401', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Authz boundary: non-member org request ---

  describe.skipIf(!hasMember)('Member access to a non-assigned project (denied)', () => {
    test('member cannot list collections in a project they have no role in', async () => {
      expect(setupFailed).toBe(false)

      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
        { apiKey: ctx.memberApiKey! }
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot create a collection in a project they have no role in', async () => {
      expect(setupFailed).toBe(false)

      const res = await post(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/collections`,
        { name: uniqueCollectionName('member-denied') },
        { apiKey: ctx.memberApiKey! }
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })
  })
})

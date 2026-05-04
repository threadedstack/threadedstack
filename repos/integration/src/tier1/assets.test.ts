import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Assets CRUD', () => {
  const ctx = readContext()

  /** ID of the asset created by the CREATE test */
  let assetId = ''
  /** Preserved copy of assetId for the 404 test after deletion */
  let deletedAssetId = ''
  /** Whether asset creation failed due to permissions — guards all downstream tests */
  let setupFailed = false

  const assetName = uniqueName('test-asset')
  const updatedName = uniqueName('test-asset-updated')

  afterAll(async () => {
    if (assetId)
      await tryDelete(`/assets/${assetId}`)
  })

  // --- Create ---

  test('POST /assets creates asset with required fields — 201', async () => {
    const res = await post<Record<string, any>>(
      `/assets`,
      {
        name: assetName,
        type: 'text',
        orgId: ctx.orgId,
        content: 'Integration test asset content',
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    assetId = res.data.id
  })

  test('POST /assets returns 400 for missing required fields', async () => {
    // Missing both name and type
    const res = await post<Record<string, any>>(
      `/assets`,
      {
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /assets returns 401 without auth', async () => {
    const res = await post<Record<string, any>>(
      `/assets`,
      {
        name: uniqueName('no-auth-asset'),
        type: 'text',
        orgId: ctx.orgId,
      },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Read ---

  test('GET /assets lists assets with 200 and pagination', async () => {
    if (setupFailed || !assetId) return expect(setupFailed ? false : assetId).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/assets?orgId=${ctx.orgId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET /assets requires at least one filter', async () => {
    const res = await get<Record<string, any>[]>(`/assets`)

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('GET /assets/:id returns asset by ID with 200', async () => {
    if (setupFailed || !assetId) return expect(setupFailed ? false : assetId).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/assets/${assetId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    const asset = res.data
    expect(asset.id).toBe(assetId)
    expect(asset.name).toBe(assetName)
    expect(asset.type).toBe('text')
    expect(asset.orgId).toBe(ctx.orgId)
    expect(asset.createdAt).toBeDefined()
    expect(asset.updatedAt).toBeDefined()
  })

  // --- Update ---

  test('PUT /assets/:id updates asset fields — 200', async () => {
    if (setupFailed || !assetId) return expect(setupFailed ? false : assetId).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/assets/${assetId}`,
      { name: updatedName, content: 'Updated content' }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedName)
  })

  test('GET after update reflects persisted changes', async () => {
    if (setupFailed || !assetId) return expect(setupFailed ? false : assetId).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/assets/${assetId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.name).toBe(updatedName)
  })

  // --- Delete ---

  test('DELETE /assets/:id removes asset — 200', async () => {
    if (setupFailed || !assetId) return expect(setupFailed ? false : assetId).toBeTruthy()

    const res = await del<{ success: boolean; id: string }>(
      `/assets/${assetId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.success).toBe(true)

    // Preserve ID for the 404 test, then clear so afterAll skips cleanup
    deletedAssetId = assetId
    assetId = ''
  })

  test('GET deleted asset returns 404', async () => {
    if (setupFailed || !deletedAssetId) return expect(setupFailed ? false : deletedAssetId).toBeTruthy()

    const res = await get(
      `/assets/${deletedAssetId}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })
})

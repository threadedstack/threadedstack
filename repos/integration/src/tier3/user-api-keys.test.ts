import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 3: Per-User API Key CRUD', () => {
  const ctx = readContext()

  let createdKeyId = ''
  let realUserId = ''
  const keyName = uniqueName('User API Key Test')

  afterAll(async () => {
    if (createdKeyId) await tryDelete(`/orgs/${ctx.orgId}/api-keys/${createdKeyId}`)
  })

  /**
   * Discover the authenticated user's real userId from the org members list.
   * The ctx.userId from env may be a placeholder — we need a real org member ID.
   */
  beforeAll(async () => {
    const membersRes = await get<{ data: Array<{ userId: string }> }>(
      `/orgs/${ctx.orgId}/members`
    )
    expect(membersRes.ok).toBe(true)

    const members = membersRes.data?.data || []
    expect(members.length).toBeGreaterThan(0)

    // Use the first member as our real userId target
    realUserId = members[0].userId
  })

  test('creates API key without explicit userId — backend auto-assigns authenticated user', async () => {
    const res = await post<{ data: Record<string, any>; warning: string }>(
      `/orgs/${ctx.orgId}/api-keys`,
      {
        name: keyName,
        scopes: 'read',
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeTruthy()
    expect(typeof res.data.data.key).toBe('string')
    expect(res.data.data.key.startsWith('tdsk_')).toBe(true)
    expect(res.data.data.name).toBe(keyName)
    expect(res.data.data.userId).toBeTruthy()
    expect(res.data.warning).toMatch(/store this api key securely/i)

    createdKeyId = res.data.data.id
    // Capture the actual userId assigned by backend
    realUserId = res.data.data.userId
  })

  test('lists API keys filtered by userId — includes the created key', async () => {
    if (!createdKeyId) return expect(createdKeyId).toBeTruthy()

    const res = await get<{ data: Array<Record<string, any>> }>(
      `/orgs/${ctx.orgId}/api-keys?userId=${realUserId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    const found = res.data.data.find((k) => k.id === createdKeyId)
    expect(found).toBeDefined()
    expect(found?.userId).toBe(realUserId)
  })

  test('lists API keys without filter — includes the created key', async () => {
    if (!createdKeyId) return expect(createdKeyId).toBeTruthy()

    const res = await get<{ data: Array<Record<string, any>> }>(
      `/orgs/${ctx.orgId}/api-keys?limit=200`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    const found = res.data.data.find((k) => k.id === createdKeyId)
    expect(found).toBeDefined()
  })

  test('revokes per-user API key — returns 200 with success', async () => {
    if (!createdKeyId) return expect(createdKeyId).toBeTruthy()

    const res = await del<{ data: { success: boolean; id: string } }>(
      `/orgs/${ctx.orgId}/api-keys/${createdKeyId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data.success).toBe(true)
    expect(res.data.data.id).toBe(createdKeyId)

    // Mark as cleaned up so afterAll skips re-delete attempt
    createdKeyId = ''
  })
})

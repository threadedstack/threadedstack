import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { randomUUID } from 'node:crypto'

describe('Tier 1: Users', () => {
  const ctx = readContext()

  let realUserId = ''
  let originalName: string | undefined

  beforeAll(async () => {
    const res = await get<Record<string, any>[]>(
      `/users?orgId=${ctx.orgId}&limit=10`
    )
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      realUserId = res.data[0].id
    }
  })

  afterAll(async () => {
    if (originalName !== undefined && realUserId) {
      await put(`/users/${realUserId}`, { name: originalName })
    }
  })

  // --- List ---

  test('GET /users returns 200 with data array', async () => {
    const res = await get<Record<string, any>[]>(
      `/users?orgId=${ctx.orgId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /users supports pagination (limit/offset)', async () => {
    const res = await get<Record<string, any>[]>(
      `/users?orgId=${ctx.orgId}&limit=1&offset=0`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(1)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET /users returns 401 without auth', async () => {
    const res = await get(
      `/users?orgId=${ctx.orgId}`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Get by ID ---

  test('GET /users/:userId returns user by ID with 200', async () => {
    if (!realUserId) {
      console.warn('[users] SKIPPED: no real user UUID discovered from list endpoint')
      return
    }

    const res = await get<Record<string, any>>(
      `/users/${realUserId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(realUserId)
  })

  test('GET /users/:userId response includes expected fields', async () => {
    if (!realUserId) {
      console.warn('[users] SKIPPED: no real user UUID discovered from list endpoint')
      return
    }

    const res = await get<Record<string, any>>(
      `/users/${realUserId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(typeof res.data.id).toBe('string')
    expect('email' in res.data).toBe(true)
    expect(res.data.createdAt).toBeDefined()
  })

  test('GET /users/:userId returns error for nonexistent user', async () => {
    const fakeUuid = randomUUID()
    const res = await get(`/users/${fakeUuid}`)

    expect(res.ok).toBe(false)
    // 403 for non-super users (no shared org), 404 for super admins
    expect([403, 404]).toContain(res.status)
  })

  test('GET /users/:userId returns 401 without auth', async () => {
    if (!realUserId) {
      console.warn('[users] SKIPPED: no real user UUID discovered from list endpoint')
      return
    }

    const res = await get(
      `/users/${realUserId}`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Update (self) ---

  test('PUT /users/:userId self-update with name succeeds', async () => {
    if (!realUserId) {
      console.warn('[users] SKIPPED: no real user UUID discovered from list endpoint')
      return
    }

    const before = await get<Record<string, any>>(`/users/${realUserId}`)

    expect(before.status).toBe(200)
    originalName = before.data.name ?? ''

    const tempName = uniqueName('integration-user')
    const res = await put<Record<string, any>>(
      `/users/${realUserId}`,
      { name: tempName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(tempName)
  })

  test('PUT /users/:userId returns 401 without auth', async () => {
    if (!realUserId) {
      console.warn('[users] SKIPPED: no real user UUID discovered from list endpoint')
      return
    }

    const res = await put(
      `/users/${realUserId}`,
      { name: 'should-not-work' },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('PUT /users/:userId returns 404 for nonexistent user', async () => {
    const fakeUuid = randomUUID()
    const res = await put(
      `/users/${fakeUuid}`,
      { name: 'ghost' }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- List includes users ---

  test('GET /users list returns at least one user for this org', async () => {
    const res = await get<Record<string, any>[]>(
      `/users?orgId=${ctx.orgId}&limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(1)

    for (const user of res.data) {
      expect(user.id).toBeDefined()
      expect(typeof user.id).toBe('string')
    }
  })

  // --- Delete (safe tests only — never self-delete) ---

  test('DELETE /users/:userId returns error for nonexistent user', async () => {
    const fakeUuid = randomUUID()
    const res = await del(`/users/${fakeUuid}`)

    expect(res.ok).toBe(false)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('DELETE /users/:userId returns 401 without auth', async () => {
    if (!realUserId) {
      console.warn('[users] SKIPPED: no real user UUID discovered from list endpoint')
      return
    }

    const res = await del(
      `/users/${realUserId}`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})

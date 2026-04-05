import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Project-Scoped API Keys', () => {
  const ctx = readContext()

  // Resources created during setup
  let localProjectId = ''
  let projectKeyId = ''
  let projectKeyRaw = ''
  let setupFailed = false

  beforeAll(async () => {
    // Create a dedicated test project so we don't pollute shared state
    const projRes = await post<{ id: string }>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('ProjKey Test Project'), orgId: ctx.orgId }
    )
    if (projRes.status !== 201 || !projRes.data?.id) {
      setupFailed = true
      return
    }
    localProjectId = projRes.data.id

    // Create a project-scoped API key
    const keyRes = await post<{ id: string; key: string }>(
      `/orgs/${ctx.orgId}/api-keys`,
      {
        name: uniqueName('ProjKey Test Key'),
        scopes: 'read,write',
        projectId: localProjectId,
      }
    )
    if (keyRes.status !== 201 || !keyRes.data?.key) {
      setupFailed = true
      return
    }
    projectKeyId = keyRes.data.id
    projectKeyRaw = keyRes.data.key
  })

  afterAll(async () => {
    // Clean up in reverse order — key first, then project
    if (projectKeyId) await tryDelete(`/orgs/${ctx.orgId}/api-keys/${projectKeyId}`)
    if (localProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${localProjectId}`)
  })

  // ─── CRUD ─────────────────────────────────────────────────────────

  test('creating a project-scoped API key returns 201 with projectId', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create another key to verify the response shape (we'll clean it up)
    const res = await post<{ id: string; key: string; projectId: string; orgId: string | null }>(
      `/orgs/${ctx.orgId}/api-keys`, {
      name: uniqueName('ProjKey Verify Create'),
      scopes: 'read',
      projectId: localProjectId,
    })

    expect(res.status).toBe(201)
    expect(res.data.key).toBeDefined()
    expect(res.data.key).toMatch(/^tdsk_/)
    expect(res.data.projectId).toBe(localProjectId)
    // Project-scoped keys should NOT have orgId set (exclusive arc)
    expect(res.data.orgId).toBeNull()

    // Clean up this extra key
    if (res.data?.id) {
      await tryDelete(`/orgs/${ctx.orgId}/api-keys/${res.data.id}`)
    }
  })

  test('listing API keys with projectId filter returns only project-scoped keys', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Array<{ id: string; projectId: string | null }>>(
      `/orgs/${ctx.orgId}/api-keys?projectId=${localProjectId}`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    // All returned keys should belong to our test project
    for (const key of res.data) {
      expect(key.projectId).toBe(localProjectId)
    }

    // Our test key should be in the list
    const found = res.data.some((k) => k.id === projectKeyId)
    expect(found).toBe(true)
  })

  test('project-scoped key does not appear in org-level key listing', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // List org-scoped keys (no projectId filter)
    const res = await get<Array<{ id: string; projectId: string | null }>>(
      `/orgs/${ctx.orgId}/api-keys`
    )

    expect(res.status).toBe(200)

    // The project-scoped key should NOT appear in org-level listing
    const found = res.data.some((k) => k.id === projectKeyId)
    expect(found).toBe(false)
  })

  test('revoking a project-scoped key returns 200', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a throwaway key to revoke
    const createRes = await post<{ id: string; key: string }>(
      `/orgs/${ctx.orgId}/api-keys`,
      {
        name: uniqueName('ProjKey Revoke Test'),
        scopes: 'read',
        projectId: localProjectId,
      }
    )
    expect(createRes.status).toBe(201)
    const revokeId = createRes.data.id

    const revokeRes = await del(`/orgs/${ctx.orgId}/api-keys/${revokeId}`)
    expect(revokeRes.status).toBe(200)
  })

  // ─── Access boundary enforcement ──────────────────────────────────

  test('project-scoped key can access its own project', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use the project-scoped key to list project API keys
    const res = await get(
      `/orgs/${ctx.orgId}/api-keys?projectId=${localProjectId}`,
      { apiKey: projectKeyRaw }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('project-scoped key cannot access org-level API keys', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use the project-scoped key without a projectId filter (org-level listing)
    const res = await get(`/orgs/${ctx.orgId}/api-keys`, { apiKey: projectKeyRaw })

    // projectAccessGuard should block this (no projectId target = org-level = 403)
    expect(res.status).toBe(403)
  })

  test('project-scoped key cannot access a different project', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a second project
    const proj2Res = await post<{ id: string }>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('ProjKey Other Project'), orgId: ctx.orgId }
    )
    expect(proj2Res.status).toBe(201)
    const otherProjectId = proj2Res.data.id

    // Try to list API keys for the other project using the first project's key
    const res = await get(
      `/orgs/${ctx.orgId}/api-keys?projectId=${otherProjectId}`,
      { apiKey: projectKeyRaw }
    )

    expect(res.status).toBe(403)

    // Clean up second project
    await tryDelete(`/orgs/${ctx.orgId}/projects/${otherProjectId}`)
  })

  test('org-scoped key can access project resources', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use the default test API key (org-scoped) to list project keys
    const res = await get(
      `/orgs/${ctx.orgId}/api-keys?projectId=${localProjectId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  // ─── Key does not leak sensitive data ─────────────────────────────

  test('project-scoped key listing does not leak keyHash', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, unknown>[]>(
      `/orgs/${ctx.orgId}/api-keys?projectId=${localProjectId}`
    )

    expect(res.status).toBe(200)
    for (const key of res.data) {
      expect(key).not.toHaveProperty('keyHash')
    }
  })
})

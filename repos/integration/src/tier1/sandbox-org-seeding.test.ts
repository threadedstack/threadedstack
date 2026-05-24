import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { acquireJwt } from '../utils/jwt-auth'

/**
 * Delete all sandboxes in an org, then delete the org itself. Best-effort.
 */
const cleanupOrg = async (orgId: string, apiKey: string) => {
  const opts = { apiKey }
  try {
    const res = await get<Record<string, any>[]>(`/orgs/${orgId}/sandboxes?limit=100`, opts)
    if (res.ok && Array.isArray(res.data)) {
      for (const sb of res.data) {
        try { await del(`/orgs/${orgId}/sandboxes/${sb.id}`, opts) } catch {}
      }
    }
  } catch {}
  try { await del(`/orgs/${orgId}`, opts) } catch {}
}

/**
 * Tests org-creation sandbox seeding.
 *
 * When a new organization is created, the backend seeds default sandbox
 * configs (Claude Code, Codex, OpenCode, Antigravity, OpenClaw, Base) with builtIn=true.
 *
 * Org creation requires user-level JWT auth (API keys return 403).
 * The test acquires a JWT from Neon Auth using email/password sign-in.
 */
describe('Tier 1: Sandbox Org Seeding', () => {
  const ctx = readContext()

  let newOrgId = ''
  let jwt = ''
  let setupSkipped = false

  const jwtOpts = () => (jwt ? { apiKey: jwt } : {})

  beforeAll(async () => {
    const token = await acquireJwt()
    if (!token) {
      console.warn('[sandbox-org-seeding] Could not acquire JWT — skipping suite')
      setupSkipped = true
      return
    }
    jwt = token

    // Clean up stale test orgs from previous runs that may have crashed
    // (the test user has an org quota of 1, so leftover orgs block new creation)
    const orgsRes = await get<Record<string, any>[]>('/orgs', { apiKey: jwt })
    if (orgsRes.ok && Array.isArray(orgsRes.data)) {
      for (const org of orgsRes.data) {
        if (org.name?.startsWith('seed-test-org ')) {
          await cleanupOrg(org.id, jwt)
        }
      }
    }

    const res = await post<Record<string, any>>(
      '/orgs',
      { name: uniqueName('seed-test-org') },
      { apiKey: jwt }
    )

    if (!res.ok) {
      console.warn(`[sandbox-org-seeding] Org creation failed (${res.status}) — skipping suite`)
      setupSkipped = true
      return
    }

    newOrgId = res.data.id
  }, 30_000)

  afterAll(async () => {
    if (newOrgId && jwt) await cleanupOrg(newOrgId, jwt)
  })

  // --- Seeding ---

  test('org creation seeds default sandboxes', async () => {
    if (setupSkipped) return
    if (!newOrgId) return expect(newOrgId).toBeTruthy()

    const listRes = await get<Record<string, any>[]>(
      `/orgs/${newOrgId}/sandboxes?limit=100`,
      jwtOpts()
    )

    expect(listRes.status).toBe(200)
    expect(listRes.ok).toBe(true)
    expect(Array.isArray(listRes.data)).toBe(true)
    expect(listRes.data.length).toBeGreaterThanOrEqual(6)

    for (const sandbox of listRes.data) {
      expect(sandbox.builtIn).toBe(true)
    }

    const seededNames = listRes.data.map((s: any) => s.name)
    for (const expectedName of ['Claude Code', 'Codex', 'OpenCode', 'Antigravity', 'OpenClaw', 'Base']) {
      expect(seededNames.some((n: string) => n.includes(expectedName))).toBe(true)
    }

    for (const sandbox of listRes.data) {
      expect(['claude-code', 'codex', 'opencode', 'antigravity', 'openclaw', 'custom']).toContain(sandbox.config.runtime)
      expect(sandbox.config.image).toBeTruthy()
      expect(sandbox.config.sshEnabled).toBe(true)
    }
  })

  test('seeded sandboxes have correct runtime configurations', async () => {
    if (setupSkipped) return
    if (!newOrgId) return expect(newOrgId).toBeTruthy()

    const listRes = await get<Record<string, any>[]>(
      `/orgs/${newOrgId}/sandboxes?limit=100`,
      jwtOpts()
    )
    expect(listRes.status).toBe(200)

    const byRuntime: Record<string, Record<string, any>> = {}
    for (const sandbox of listRes.data) {
      byRuntime[sandbox.config.runtime] = sandbox
    }

    expect(byRuntime['claude-code']).toBeDefined()
    expect(byRuntime['claude-code'].config.runtimeCommand).toBe('claude')

    expect(byRuntime['codex']).toBeDefined()
    expect(byRuntime['codex'].config.runtimeCommand).toBe('codex')

    expect(byRuntime['opencode']).toBeDefined()
    expect(byRuntime['opencode'].config.runtimeCommand).toBe('opencode')

    expect(byRuntime['antigravity']).toBeDefined()
    expect(byRuntime['antigravity'].config.runtimeCommand).toBe('agy')

    expect(byRuntime['openclaw']).toBeDefined()
    expect(byRuntime['openclaw'].config.runtimeCommand).toBe('openclaw')

    expect(byRuntime['custom']).toBeDefined()
    expect(byRuntime['custom'].config.runtimeCommand).toBeFalsy()
  })

  test('seeded sandboxes have resource limits and idle timeout', async () => {
    if (setupSkipped) return
    if (!newOrgId) return expect(newOrgId).toBeTruthy()

    const listRes = await get<Record<string, any>[]>(
      `/orgs/${newOrgId}/sandboxes?limit=100`,
      jwtOpts()
    )
    expect(listRes.status).toBe(200)

    for (const sandbox of listRes.data) {
      expect(sandbox.config.resources).toBeDefined()
      expect(sandbox.config.resources.limits).toBeDefined()
      expect(sandbox.config.resources.requests).toBeDefined()
      expect(sandbox.config.idleTimeoutMinutes).toBe(30)
    }
  })

  test('seeded sandboxes are editable', async () => {
    if (setupSkipped) return
    if (!newOrgId) return expect(newOrgId).toBeTruthy()

    const listRes = await get<Record<string, any>[]>(
      `/orgs/${newOrgId}/sandboxes?limit=100`,
      jwtOpts()
    )
    expect(listRes.status).toBe(200)
    expect(listRes.data.length).toBeGreaterThanOrEqual(1)

    const target = listRes.data[0]
    const newName = uniqueName('edited-seeded')

    const putRes = await put<Record<string, any>>(
      `/orgs/${newOrgId}/sandboxes/${target.id}`,
      { name: newName },
      jwtOpts()
    )

    expect(putRes.status).toBe(200)
    expect(putRes.ok).toBe(true)
    expect(putRes.data.name).toBe(newName)
  })

  test('seeded sandboxes are deletable', async () => {
    if (setupSkipped) return
    if (!newOrgId) return expect(newOrgId).toBeTruthy()

    const listRes = await get<Record<string, any>[]>(
      `/orgs/${newOrgId}/sandboxes?limit=100`,
      jwtOpts()
    )
    expect(listRes.status).toBe(200)
    expect(listRes.data.length).toBeGreaterThanOrEqual(2)

    const target = listRes.data[1]
    const delRes = await del<Record<string, any>>(
      `/orgs/${newOrgId}/sandboxes/${target.id}`,
      jwtOpts()
    )

    expect(delRes.status).toBe(200)
    expect(delRes.ok).toBe(true)
  })

  test('seeded sandboxes are copyable with builtIn=false', async () => {
    if (setupSkipped) return
    if (!newOrgId) return expect(newOrgId).toBeTruthy()

    const listRes = await get<Record<string, any>[]>(
      `/orgs/${newOrgId}/sandboxes?limit=100`,
      jwtOpts()
    )
    expect(listRes.status).toBe(200)
    expect(listRes.data.length).toBeGreaterThanOrEqual(1)

    const target = listRes.data[0]
    const copyRes = await post<Record<string, any>>(
      `/orgs/${newOrgId}/sandboxes/${target.id}/copy`,
      { orgId: newOrgId },
      jwtOpts()
    )

    expect(copyRes.status).toBe(201)
    expect(copyRes.ok).toBe(true)
    expect(copyRes.data.builtIn).toBe(false)
    expect(copyRes.data.config.runtime).toBe(target.config.runtime)
    expect(copyRes.data.config.image).toBe(target.config.image)

    try { await del(`/orgs/${newOrgId}/sandboxes/${copyRes.data.id}`, jwtOpts()) } catch {}
  })
})

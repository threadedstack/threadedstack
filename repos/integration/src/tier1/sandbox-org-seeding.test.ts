import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
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
  let newOrgId = ''
  let jwt = ''

  const jwtOpts = () => (jwt ? { apiKey: jwt } : {})

  beforeAll(async () => {
    const token = await acquireJwt()
    if (!token) {
      // A sign-in failure (e.g. 401) here can hide a real auth regression, so
      // this suite fails hard instead of silently skipping.
      throw new Error(
        '[sandbox-org-seeding] Failed to acquire a user JWT — refusing to skip. ' +
          'Check TDSK_IT_AUTH_URL / TDSK_IT_USER_EMAIL / TDSK_IT_USER_PASSWORD, that the ' +
          'test user exists and is verified in Neon Auth, and the [jwt-auth] warnings above ' +
          'for the exact sign-in failure (a 401 may indicate a real auth regression).'
      )
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
      throw new Error(
        `[sandbox-org-seeding] Org creation failed (${res.status}): ` +
          `${JSON.stringify(res.data ?? null)} — refusing to skip. ` +
          'A 401/403 here may indicate a real auth regression; a 403 quota_exceeded means ' +
          'stale seed-test-org orgs were not cleaned up.'
      )
    }

    newOrgId = res.data.id
  }, 30_000)

  afterAll(async () => {
    if (newOrgId && jwt) await cleanupOrg(newOrgId, jwt)
  })

  // --- Seeding ---

  test('org creation seeds default sandboxes', async () => {
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
    for (const expectedName of ['Claude Code', 'Codex', 'OpenCode', 'Antigravity', 'OpenClaw', 'Pi Coding Agent', 'Base']) {
      expect(seededNames.some((n: string) => n.includes(expectedName))).toBe(true)
    }

    for (const sandbox of listRes.data) {
      expect(['claude-code', 'codex', 'opencode', 'antigravity', 'openclaw', 'pi-coding-agent', 'custom']).toContain(sandbox.config.runtime)
      expect(sandbox.config.image).toBeTruthy()
      expect(sandbox.config.sshEnabled).toBe(true)
    }
  })

  test('seeded sandboxes have correct runtime configurations', async () => {
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

    expect(byRuntime['pi-coding-agent']).toBeDefined()
    expect(byRuntime['pi-coding-agent'].config.runtimeCommand).toBe('pi')

    expect(byRuntime['custom']).toBeDefined()
    expect(byRuntime['custom'].config.runtimeCommand).toBeFalsy()
  })

  test('seeded sandboxes have resource limits and idle timeout', async () => {
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

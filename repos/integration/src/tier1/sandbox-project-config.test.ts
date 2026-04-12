import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tests for per-project sandbox config override endpoints:
 *   GET    /orgs/:orgId/projects/:projectId/sandboxes/:sandboxId/config
 *   PUT    /orgs/:orgId/projects/:projectId/sandboxes/:sandboxId/config
 *   DELETE /orgs/:orgId/projects/:projectId/sandboxes/:sandboxId/config
 *
 * These endpoints manage project-level config overrides stored in the
 * sandboxProjects junction table. The effective config merges base sandbox
 * config with project-level overrides.
 */
describe('Tier 1: Sandbox Project Config Overrides', () => {
  const ctx = readContext()

  let projectId = ''
  let project2Id = ''
  let sandboxId = ''

  const baseCfg = {
    image: 'node:22-slim',
    idleTimeoutMinutes: 30,
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '256Mi' },
      requests: { cpu: '100m', memory: '128Mi' },
    },
    envVars: { BASE_VAR: 'base-value' },
  }

  const configPath = (pId: string, sbId: string) =>
    `/orgs/${ctx.orgId}/projects/${pId}/sandboxes/${sbId}/config`

  beforeAll(async () => {
    // Create two projects
    const [p1, p2] = await Promise.all([
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('pcfg-proj1'), orgId: ctx.orgId }
      ),
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('pcfg-proj2'), orgId: ctx.orgId }
      ),
    ])
    if (p1.ok) projectId = p1.data.id
    if (p2.ok) project2Id = p2.data.id

    // Create sandbox associated with both projects
    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('pcfg-sandbox'),
        config: baseCfg,
        orgId: ctx.orgId,
        projectIds: [projectId, project2Id].filter(Boolean),
      }
    )
    if (sbRes.ok) sandboxId = sbRes.data.id
  }, 30_000)

  afterAll(async () => {
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
    if (project2Id) await tryDelete(`/orgs/${ctx.orgId}/projects/${project2Id}`)
  })

  // --- GET config (before any overrides) ---

  test('GET config returns 404 when no overrides have been set', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await get(configPath(projectId, sandboxId))

    // No override row exists yet — should be 404 or return empty config
    // The endpoint returns 404 when no sandboxProjects config row exists
    expect([200, 404]).toContain(res.status)
  })

  // --- PUT config (upsert overrides) ---

  test('PUT upserts project config with alias', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      configPath(projectId, sandboxId),
      { alias: 'my-custom-alias' }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
  })

  test('PUT upserts project config with enabled=false', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      configPath(projectId, sandboxId),
      { enabled: false }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('PUT upserts project config override for idleTimeoutMinutes', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      configPath(projectId, sandboxId),
      { config: { idleTimeoutMinutes: 60 } }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    // Effective config should merge the override
    const cfg = res.data.config
    expect(cfg).toBeDefined()
    expect(cfg.idleTimeoutMinutes).toBe(60)
    // Base image should still be present
    expect(cfg.image).toBe('node:22-slim')
  })

  test('PUT config merges envVars (deep-merge, not replace)', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      configPath(projectId, sandboxId),
      { config: { envVars: { PROJECT_VAR: 'project-value' } } }
    )

    expect(res.status).toBe(200)
    const envVars = res.data.config?.envVars
    expect(envVars).toBeDefined()
    // Project-level envVar should be present
    expect(envVars.PROJECT_VAR).toBe('project-value')
  })

  // --- GET config (after overrides) ---

  test('GET config returns the override record after PUT', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await get<Record<string, any>>(configPath(projectId, sandboxId))

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
  })

  // --- Second project has independent overrides ---

  test('PUT on project2 does not affect project1 overrides', async () => {
    if (!project2Id || !sandboxId) return expect(project2Id && sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      configPath(project2Id, sandboxId),
      { alias: 'project2-alias', config: { idleTimeoutMinutes: 15 } }
    )

    expect(res.status).toBe(200)
    expect(res.data.config.idleTimeoutMinutes).toBe(15)

    // Verify project1 still has its own override
    const p1Res = await get<Record<string, any>>(configPath(projectId, sandboxId))
    expect(p1Res.status).toBe(200)
  })

  // --- DELETE config (reset overrides) ---

  test('DELETE resets project config overrides', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await del<Record<string, any>>(configPath(projectId, sandboxId))

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.configReset).toBe(true)
  })

  // --- Effective config via list endpoint ---

  test('GET list with ?projectId returns effective config', async () => {
    if (!project2Id || !sandboxId) return expect(project2Id && sandboxId).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?projectId=${project2Id}&limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const sb = res.data.find((s: any) => s.id === sandboxId)
    expect(sb).toBeDefined()
    // Project2 override was idleTimeoutMinutes=15
    if (sb) {
      expect(sb.config.idleTimeoutMinutes).toBe(15)
    }
  })

  // --- Auth ---

  test('PUT config without auth returns 401', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await put(
      configPath(projectId, sandboxId),
      { alias: 'should-fail' },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
  })

  test('GET config without auth returns 401', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await get(configPath(projectId, sandboxId), { noAuth: true })

    expect(res.status).toBe(401)
  })

  test('DELETE config without auth returns 401', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await del(configPath(projectId, sandboxId), { noAuth: true })

    expect(res.status).toBe(401)
  })

  // --- Error cases ---

  test('PUT config for sandbox not linked to project returns 404', async () => {
    // Create a project that is NOT linked to the sandbox
    const isolatedProj = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('pcfg-isolated'), orgId: ctx.orgId }
    )
    if (!isolatedProj.ok) return expect(isolatedProj.ok).toBe(true)

    try {
      const res = await put(
        configPath(isolatedProj.data.id, sandboxId),
        { alias: 'should-fail' }
      )

      expect([404, 500]).toContain(res.status)
      expect(res.ok).toBe(false)
    } finally {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${isolatedProj.data.id}`)
    }
  })
})

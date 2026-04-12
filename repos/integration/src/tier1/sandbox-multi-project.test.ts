import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tests for multi-project sandbox associations:
 *   - Creating sandboxes with projectIds[] array
 *   - Listing sandboxes filtered by projectId
 *   - Copy preserving project associations
 *   - Effective config merging when listing by project
 */
describe('Tier 1: Sandbox Multi-Project Associations', () => {
  const ctx = readContext()

  let project1Id = ''
  let project2Id = ''
  let project3Id = ''
  const createdSandboxIds: string[] = []

  const baseCfg = {
    image: 'node:22-slim',
    idleTimeoutMinutes: 30,
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '256Mi' },
      requests: { cpu: '100m', memory: '128Mi' },
    },
  }

  beforeAll(async () => {
    const [p1, p2, p3] = await Promise.all([
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('mp-proj1'), orgId: ctx.orgId }
      ),
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('mp-proj2'), orgId: ctx.orgId }
      ),
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('mp-proj3'), orgId: ctx.orgId }
      ),
    ])
    if (p1.ok) project1Id = p1.data.id
    if (p2.ok) project2Id = p2.data.id
    if (p3.ok) project3Id = p3.data.id
  }, 30_000)

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
    if (project1Id) await tryDelete(`/orgs/${ctx.orgId}/projects/${project1Id}`)
    if (project2Id) await tryDelete(`/orgs/${ctx.orgId}/projects/${project2Id}`)
    if (project3Id) await tryDelete(`/orgs/${ctx.orgId}/projects/${project3Id}`)
  })

  // --- Create with projectIds[] ---

  test('POST creates sandbox with multiple projectIds', async () => {
    if (!project1Id || !project2Id) return expect(project1Id && project2Id).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('mp-sb-dual'),
        config: baseCfg,
        orgId: ctx.orgId,
        projectIds: [project1Id, project2Id],
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.id).toBeDefined()

    // The sandbox should have projects array
    const projects = res.data.projects
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBe(2)

    const projectIds = projects.map((p: any) => p.id)
    expect(projectIds).toContain(project1Id)
    expect(projectIds).toContain(project2Id)

    createdSandboxIds.push(res.data.id)
  })

  test('POST creates sandbox with empty projectIds (no project association)', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('mp-sb-none'),
        config: baseCfg,
        orgId: ctx.orgId,
        projectIds: [],
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)

    const projects = res.data.projects
    // Either empty array or not present
    if (projects) expect(projects.length).toBe(0)

    createdSandboxIds.push(res.data.id)
  })

  test('POST creates sandbox with single projectIds array', async () => {
    if (!project3Id) return expect(project3Id).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('mp-sb-single'),
        config: baseCfg,
        orgId: ctx.orgId,
        projectIds: [project3Id],
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.projects).toBeDefined()
    expect(res.data.projects.length).toBe(1)
    expect(res.data.projects[0].id).toBe(project3Id)

    createdSandboxIds.push(res.data.id)
  })

  // --- List with projectId filter ---

  test('GET list with ?projectId=project1 returns only linked sandboxes', async () => {
    if (!project1Id) return expect(project1Id).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?projectId=${project1Id}&limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const ids = res.data.map((s: any) => s.id)
    // Dual-project sandbox should appear
    expect(ids).toContain(createdSandboxIds[0])
    // No-project sandbox should NOT appear
    expect(ids).not.toContain(createdSandboxIds[1])
    // Project3-only sandbox should NOT appear
    expect(ids).not.toContain(createdSandboxIds[2])
  })

  test('GET list with ?projectId=project3 returns only project3 sandbox', async () => {
    if (!project3Id) return expect(project3Id).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?projectId=${project3Id}&limit=500`
    )

    expect(res.status).toBe(200)
    const ids = res.data.map((s: any) => s.id)
    expect(ids).toContain(createdSandboxIds[2])
    expect(ids).not.toContain(createdSandboxIds[0])
    expect(ids).not.toContain(createdSandboxIds[1])
  })

  test('GET list without projectId returns all org sandboxes', async () => {
    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?limit=500`
    )

    expect(res.status).toBe(200)
    const ids = res.data.map((s: any) => s.id)
    for (const sbId of createdSandboxIds) {
      expect(ids).toContain(sbId)
    }
  })

  // --- GET single includes projects array ---

  test('GET single sandbox includes projects array', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.projects)).toBe(true)
    expect(res.data.projects.length).toBe(2)
  })

  // --- Copy preserves project associations ---

  test('POST /:id/copy preserves project associations', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}/copy`,
      { orgId: ctx.orgId, name: uniqueName('mp-sb-copy') }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.builtIn).toBe(false)

    // Copy should have the same projects
    const copyProjects = res.data.projects
    expect(Array.isArray(copyProjects)).toBe(true)
    expect(copyProjects.length).toBe(2)

    const copyProjectIds = copyProjects.map((p: any) => p.id)
    expect(copyProjectIds).toContain(project1Id)
    expect(copyProjectIds).toContain(project2Id)

    createdSandboxIds.push(res.data.id)
  })

  // --- Project-scoped routes (nested under /projects/:projectId/sandboxes) ---

  test('GET /projects/:projectId/sandboxes lists sandboxes for that project', async () => {
    if (!project1Id) return expect(project1Id).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${project1Id}/sandboxes`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const ids = res.data.map((s: any) => s.id)
    // The dual-project sandbox should appear
    expect(ids).toContain(createdSandboxIds[0])
  })
})

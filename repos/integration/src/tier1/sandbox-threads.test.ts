import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tests for GET /orgs/:orgId/projects/:projectId/sandboxes/:id/threads
 * Lists threads associated with a specific sandbox, with pagination.
 *
 * listSandboxThreads is registered on both the project-scoped sandbox
 * route (orgProjects) and the org-scoped sandbox route (orgSandboxes).
 */
describe('Tier 1: Sandbox Threads', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''

  const threadsPath = (pId: string, sbId: string) =>
    `/orgs/${ctx.orgId}/projects/${pId}/sandboxes/${sbId}/threads`

  beforeAll(async () => {
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('threads-project'), orgId: ctx.orgId }
    )
    if (projRes.ok) projectId = projRes.data.id

    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('threads-sandbox'),
        config: {
          image: 'node:22-slim',
          resources: {
            limits: { cpu: '500m', memory: '256Mi' },
            requests: { cpu: '100m', memory: '128Mi' },
          },
        },
        orgId: ctx.orgId,
        projectIds: [projectId].filter(Boolean),
      }
    )
    if (sbRes.ok) sandboxId = sbRes.data.id
  }, 30_000)

  afterAll(async () => {
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
  })

  test('GET threads returns empty array when no threads exist', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await get<Record<string, any>[]>(threadsPath(projectId, sandboxId))

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBe(0)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET threads respects pagination params', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `${threadsPath(projectId, sandboxId)}?limit=5&offset=0`
    )

    expect(res.status).toBe(200)
    expect(res.limit).toBe(5)
    expect(res.offset).toBe(0)
  })

  test('GET threads without auth returns 401', async () => {
    if (!projectId || !sandboxId) return expect(projectId && sandboxId).toBeTruthy()

    const res = await get(threadsPath(projectId, sandboxId), { noAuth: true })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('GET threads for nonexistent sandbox returns error', async () => {
    if (!projectId) return expect(projectId).toBeTruthy()

    const res = await get(threadsPath(projectId, 'nonexistent-sandbox-id'))

    // The project access guard or the endpoint itself should reject
    expect(res.ok).toBe(false)
    expect([400, 403, 404]).toContain(res.status)
  })

  // --- Org-scoped route also works (threads registered on both routers) ---

  test('GET threads via org-scoped route returns 200', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}/threads`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
  })
})

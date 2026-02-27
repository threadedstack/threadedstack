import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

interface ProjectWithCounts {
  data: {
    id: string
    name: string
    orgId: string
    counts: {
      agent: number
      endpoint: number
      function: number
    }
  }
}

describe(`Tier 1: Project Counts`, () => {
  const ctx = readContext()

  test(`GET /orgs/:orgId/projects/:projectId includes count fields`, async () => {
    const res = await get<ProjectWithCounts>(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()

    const project = res.data.data
    expect(typeof project?.counts?.endpoint).toBe(`number`)
    expect(typeof project?.counts?.function).toBe(`number`)
    expect(typeof project?.counts?.agent).toBe(`number`)
    expect(project?.counts?.endpoint).toBeGreaterThanOrEqual(0)
    expect(project?.counts?.function).toBeGreaterThanOrEqual(0)
    expect(project?.counts?.agent).toBeGreaterThanOrEqual(0)
  })

  test(`GET /orgs/:orgId/projects/:projectId still returns core project fields`, async () => {
    const res = await get<ProjectWithCounts>(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}`
    )

    expect(res.status).toBe(200)
    const project = res.data.data
    expect(project.id).toBe(ctx.projectId)
    expect(project.orgId).toBe(ctx.orgId)
    expect(typeof project.name).toBe('string')
  })

  test('GET /orgs/:orgId/projects/:projectId returns error for nonexistent project', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/projects/00000000-0000-0000-0000-000000000000`
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('GET /orgs/:orgId/projects/:projectId returns 401 without auth', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
  })
})

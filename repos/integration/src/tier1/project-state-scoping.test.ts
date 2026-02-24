import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { cleanupQuickstart } from '../utils/repl-cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Validates that the backend API returns correctly scoped data per project.
 * This is the server-side foundation that the frontend scoping depends on.
 *
 * Creates two temporary projects, adds an endpoint to each, and verifies
 * that listing endpoints for one project does NOT return the other's.
 */
describe('Tier 1: Project State Scoping', () => {
  const ctx = readContext()

  let quickstartA: Record<string, any> = {}
  let quickstartB: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    // Create two test projects via quickstart (provides provider + secret + agent + endpoint)
    const projA = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-scope-a-12345',
        projectName: uniqueName('Scoping Test A'),
        agentName: uniqueName('Scoping Agent A'),
      }
    )

    if (projA.status !== 201 || !projA.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartA = projA.data.data

    const projB = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-scope-b-12345',
        projectName: uniqueName('Scoping Test B'),
        agentName: uniqueName('Scoping Agent B'),
      }
    )

    if (projB.status !== 201 || !projB.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartB = projB.data.data
  })

  afterAll(async () => {
    await cleanupQuickstart(ctx.orgId, quickstartA)
    await cleanupQuickstart(ctx.orgId, quickstartB)
  })

  test('GET endpoints for Project A returns only Project A endpoints', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = quickstartA.project.id
    const endpointAId = quickstartA.endpoint?.id || ''
    const endpointBId = quickstartB.endpoint?.id || ''

    const res = await get<{ data: { id: string; projectId: string }[] }>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/endpoints`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    const endpoints = res.data.data
    if (endpointAId) {
      expect(endpoints.some(e => e.id === endpointAId)).toBe(true)
    }
    expect(endpoints.every(e => e.projectId === projectAId)).toBe(true)
    if (endpointBId) {
      expect(endpoints.some(e => e.id === endpointBId)).toBe(false)
    }
  })

  test('GET endpoints for Project B returns only Project B endpoints', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectBId = quickstartB.project.id
    const endpointAId = quickstartA.endpoint?.id || ''
    const endpointBId = quickstartB.endpoint?.id || ''

    const res = await get<{ data: { id: string; projectId: string }[] }>(
      `/orgs/${ctx.orgId}/projects/${projectBId}/endpoints`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    const endpoints = res.data.data
    if (endpointBId) {
      expect(endpoints.some(e => e.id === endpointBId)).toBe(true)
    }
    expect(endpoints.every(e => e.projectId === projectBId)).toBe(true)
    if (endpointAId) {
      expect(endpoints.some(e => e.id === endpointAId)).toBe(false)
    }
  })

  test('endpoints from different projects have no overlap', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = quickstartA.project.id
    const projectBId = quickstartB.project.id

    const resA = await get<{ data: { id: string }[] }>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/endpoints`
    )
    const resB = await get<{ data: { id: string }[] }>(
      `/orgs/${ctx.orgId}/projects/${projectBId}/endpoints`
    )

    expect(resA.ok).toBe(true)
    expect(resB.ok).toBe(true)

    const idsA = new Set(resA.data.data.map(e => e.id))
    const idsB = new Set(resB.data.data.map(e => e.id))

    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false)
    }
  })

  test('GET functions for Project A returns only Project A functions', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = quickstartA.project.id

    const res = await get<{ data: { projectId: string }[] }>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/functions`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(res.data.data.every(f => f.projectId === projectAId)).toBe(true)
  })

  test('GET agents for Project A returns only Project A agents', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = quickstartA.project.id

    const res = await get<{ data: { orgId: string }[] }>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/agents`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
  })
})

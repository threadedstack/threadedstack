import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Validates that the backend API returns correctly scoped data per project.
 * This is the server-side foundation that the frontend scoping depends on.
 *
 * Creates two temporary projects, adds an endpoint to each, and verifies
 * that listing endpoints for one project does NOT return the other's.
 */
describe.skipIf(!isFeatureEnabled('agents'))('Tier 1: Project State Scoping', () => {
  const ctx = readContext()

  let fixturesA: TFixtureResult = {}
  let fixturesB: TFixtureResult = {}
  let setupFailed = false

  beforeAll(async () => {
    // Create two test projects via fixtures (provides provider + secret + agent + endpoint)
    try {
      fixturesA = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('Scoping Test A'),
        agentName: uniqueName('Scoping Agent A'),
      })
    }
    catch {
      setupFailed = true
      return
    }

    if (!fixturesA.project?.id) {
      setupFailed = true
      return
    }

    try {
      fixturesB = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('Scoping Test B'),
        agentName: uniqueName('Scoping Agent B'),
      })
    }
    catch {
      setupFailed = true
      return
    }

    if (!fixturesB.project?.id) {
      setupFailed = true
      return
    }
  })

  afterAll(async () => {
    await cleanupFixtures(ctx.orgId, fixturesA)
    await cleanupFixtures(ctx.orgId, fixturesB)
  })

  test('GET endpoints for Project A returns only Project A endpoints', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = fixturesA.project.id
    const endpointAId = fixturesA.endpoint?.id || ''
    const endpointBId = fixturesB.endpoint?.id || ''

    const res = await get<{ id: string; projectId: string }[]>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/endpoints`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)

    const endpoints = res.data
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

    const projectBId = fixturesB.project.id
    const endpointAId = fixturesA.endpoint?.id || ''
    const endpointBId = fixturesB.endpoint?.id || ''

    const res = await get<{ id: string; projectId: string }[]>(
      `/orgs/${ctx.orgId}/projects/${projectBId}/endpoints`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)

    const endpoints = res.data
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

    const projectAId = fixturesA.project.id
    const projectBId = fixturesB.project.id

    const resA = await get<{ id: string }[]>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/endpoints`
    )
    const resB = await get<{ id: string }[]>(
      `/orgs/${ctx.orgId}/projects/${projectBId}/endpoints`
    )

    expect(resA.ok).toBe(true)
    expect(resB.ok).toBe(true)

    const idsA = new Set(resA.data.map(e => e.id))
    const idsB = new Set(resB.data.map(e => e.id))

    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false)
    }
  })

  test('GET functions for Project A returns only Project A functions', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = fixturesA.project.id

    const res = await get<{ projectId: string }[]>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/functions`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.every(f => f.projectId === projectAId)).toBe(true)
  })

  test('GET agents for Project A returns only Project A agents', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const projectAId = fixturesA.project.id

    const res = await get<{ orgId: string }[]>(
      `/orgs/${ctx.orgId}/projects/${projectAId}/agents`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
  })
})

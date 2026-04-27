import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { ApiClient } from '@tdsk/tsa'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: TSA Project Flow — Live Backend Validation
 *
 * Validates the project-related flow used by the TSA:
 * listing projects, project shape, and project-agent association.
 */
describe('Tier 1: TSA Project Flow (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let agentId = ''
  let projectId = ''
  let fixtures: TFixtureResult = {}

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create fixture resources
  beforeAll(async () => {
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      projectName: uniqueName('TSA Project Flow IT'),
      agentName: uniqueName('TSA Project Flow Agent'),
    })

    expect(fixtures.provider).toBeDefined()
    agentId = fixtures.agent!.id
    projectId = fixtures.project!.id
  })

  afterAll(async () => {
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Project listing ────────────────────────────────────────────

  describe('project listing', () => {
    test('listProjects returns array with at least one project', async () => {
      const { data: projects } = await client.listProjects(ctx.orgId)
      expect(Array.isArray(projects)).toBe(true)
      expect(projects!.length).toBeGreaterThan(0)
    })

    test('projects have expected shape (id, name)', async () => {
      const { data: projects } = await client.listProjects(ctx.orgId)
      const project = projects![0]
      expect(project).toHaveProperty('id')
      expect(project).toHaveProperty('name')
      expect(typeof project.id).toBe('string')
      expect(typeof project.name).toBe('string')
    })

    test('listProjects includes the quickstart project', async () => {
      const { data: projects } = await client.listProjects(ctx.orgId)
      const found = projects!.find((p: any) => p.id === projectId)
      expect(found).toBeDefined()
      expect(found.name).toContain('TSA Project Flow IT')
    })
  })

  // ─── Project-agent association ──────────────────────────────────

  describe('project-agent association', () => {
    test('listAgents returns the quickstart agent', async () => {
      const { data: agents } = await client.listAgents(ctx.orgId)
      const found = agents!.find(a => a.id === agentId)
      expect(found).toBeDefined()
    })

    test('quickstart agent has expected name', async () => {
      const { data: agent } = await client.getAgent(ctx.orgId, agentId)
      expect(agent!.name).toContain('TSA Project Flow Agent')
    })
  })
})

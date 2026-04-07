import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: REPL Project Flow — Live Backend Validation
 *
 * Validates the project-related flow used by the REPL:
 * listing projects, project shape, and project-agent association.
 */
describe('Tier 1: REPL Project Flow (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let agentId = ''
  let projectId = ''
  let quickstartResult: Record<string, any> = {}

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create quickstart resources
  beforeAll(async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-project-flow',
        projectName: uniqueName('REPL Project Flow IT'),
        agentName: uniqueName('REPL Project Flow Agent'),
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data
    agentId = quickstartResult.agent.id
    projectId = quickstartResult.project.id
  })

  afterAll(async () => {
    await cleanupQuickstart(ctx.orgId, quickstartResult)
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
      expect(found.name).toContain('REPL Project Flow IT')
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
      expect(agent!.name).toContain('REPL Project Flow Agent')
    })
  })
})

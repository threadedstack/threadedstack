import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart } from '../utils/repl-cleanup'
import { tryDelete } from '../utils/cleanup'
import { ApiClient } from '@tdsk/repl'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'

/**
 * Tier 1: REPL ChatLogic State — Agent & Project Data Shape Validation
 *
 * Validates the data shapes and API responses that ChatLogic relies on
 * for its state management:
 * - Agent cache lookup (Bug 1: /agent showed raw ID instead of name in status bar)
 * - Project listing consistency (Bug 3: selecting project with no agents had no recovery path)
 */
describe('Tier 1: REPL ChatLogic State (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  let bareProjectId = ''

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create quickstart resources (agent + project + provider)
  beforeAll(async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('REPL ChatLogic State IT'),
        agentName: uniqueName('REPL ChatLogic State Agent'),
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data
    agentId = quickstartResult.agent.id
  })

  // Create a bare project (no agents linked)
  beforeAll(async () => {
    const res = await post<{ id: string }>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('REPL Bare Project IT') }
    )
    expect(res.status).toBe(201)
    bareProjectId = res.data.id
  })

  afterAll(async () => {
    if (bareProjectId) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${bareProjectId}`)
    }
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  // ─── Agent data shapes for cache lookup ────────────────────────────

  describe('agent data shapes (Bug 1: /agent showed raw ID instead of name)', () => {
    test('listAgents returns agents with id and name fields', async () => {
      const agents = await client.listAgents(ctx.orgId)
      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBeGreaterThan(0)

      // Find our quickstart agent
      const agent = agents.find(a => a.id === agentId)
      expect(agent).toBeDefined()

      // Verify the shape ChatLogic needs for cache lookup
      expect(typeof agent!.id).toBe('string')
      expect(typeof agent!.name).toBe('string')
      expect(agent!.name).toContain('REPL ChatLogic State Agent')
    })

    test('getAgent returns same name as listAgents cache', async () => {
      // listAgents returns the cache — getAgent returns single agent
      const agents = await client.listAgents(ctx.orgId)
      const cached = agents.find(a => a.id === agentId)
      expect(cached).toBeDefined()

      const direct = await client.getAgent(ctx.orgId, agentId)
      expect(direct.id).toBe(cached!.id)
      expect(direct.name).toBe(cached!.name)
    })
  })

  // ─── Project listing ──────────────────────────────────────────────

  describe('project listing (Bug 3: selecting project with no agents had no recovery path)', () => {
    test('listProjects returns projects with id and name', async () => {
      const projects = await client.listProjects(ctx.orgId)
      expect(Array.isArray(projects)).toBe(true)
      expect(projects.length).toBeGreaterThan(0)

      const project = projects[0]
      expect(typeof project.id).toBe('string')
      expect(typeof project.name).toBe('string')
    })

    test('listProjects includes both quickstart and bare projects', async () => {
      const projects = await client.listProjects(ctx.orgId)
      const quickstartProject = projects.find(
        (p: any) => p.id === quickstartResult.project?.id
      )
      const bareProject = projects.find((p: any) => p.id === bareProjectId)

      expect(quickstartProject).toBeDefined()
      expect(bareProject).toBeDefined()
    })

    test('project and agent data are consistent for ChatLogic consumption', async () => {
      // ChatLogic flow: listProjects → selectProject → listAgents → selectAgent
      const projects = await client.listProjects(ctx.orgId)
      expect(projects.length).toBeGreaterThan(0)

      const agents = await client.listAgents(ctx.orgId)
      expect(agents.length).toBeGreaterThan(0)

      // Agent from listAgents should have the fields ChatLogic needs
      const agent = agents.find(a => a.id === agentId)
      expect(agent).toBeDefined()
      expect(agent).toHaveProperty('id')
      expect(agent).toHaveProperty('name')
    })
  })
})

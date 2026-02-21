import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl'
import { Organization, Agent, Thread, Message } from '@tdsk/domain'

/**
 * Tier 1: REPL ApiClient — Live Backend Validation
 *
 * Validates all ApiClient methods against the live backend:
 * URL construction, auth headers, envelope unwrapping, domain model wrapping.
 */
describe('Tier 1: REPL ApiClient (live)', () => {
  const ctx = readContext()
  const timestamp = Date.now()
  let client: ApiClient

  // Quickstart resources for agent/thread tests
  let agentId = ''
  let projectId = ''
  let quickstartResult: Record<string, any> = {}

  // Threads created during tests (for cleanup)
  const threadIds: string[] = []

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create a quickstart agent for agent/thread/message tests
  beforeAll(async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-repl-api-client',
        projectName: `REPL ApiClient IT ${timestamp}`,
        agentName: `REPL ApiClient Agent ${timestamp}`,
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id
    projectId = quickstartResult.project.id
  })

  afterAll(async () => {
    // Clean up threads first
    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    // Clean up quickstart resources
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  // ─── Organizations ────────────────────────────────────────────────

  describe('organizations', () => {
    test('listOrgs returns non-empty array', async () => {
      const orgs = await client.listOrgs()
      expect(Array.isArray(orgs)).toBe(true)
      expect(orgs.length).toBeGreaterThan(0)
    })

    test('listOrgs returns Organization instances', async () => {
      const orgs = await client.listOrgs()
      expect(orgs[0]).toBeInstanceOf(Organization)
      expect(orgs[0].id).toBeTruthy()
    })

    test('getOrg returns matching org', async () => {
      const org = await client.getOrg(ctx.orgId)
      expect(org).toBeInstanceOf(Organization)
      expect(org.id).toBe(ctx.orgId)
    })

    test('getOrg with bad ID throws', async () => {
      await expect(
        client.getOrg('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('API error')
    })
  })

  // ─── Agents ───────────────────────────────────────────────────────

  describe('agents', () => {
    test('listAgents returns Agent array', async () => {
      const agents = await client.listAgents(ctx.orgId)
      expect(Array.isArray(agents)).toBe(true)
      // Quickstart created at least one
      expect(agents.length).toBeGreaterThan(0)
      expect(agents[0]).toBeInstanceOf(Agent)
    })

    test('getAgent returns matching agent', async () => {
      const agent = await client.getAgent(ctx.orgId, agentId)
      expect(agent).toBeInstanceOf(Agent)
      expect(agent.id).toBe(agentId)
    })
  })

  // ─── Sessions ─────────────────────────────────────────────────────

  describe('sessions', () => {
    test('createSession returns sessionToken', async () => {
      const session = await client.createSession(agentId)
      expect(session.sessionToken).toBeTruthy()
      expect(typeof session.sessionToken).toBe('string')
      expect(session.sessionToken.length).toBeGreaterThan(10)
    })

    test('createSession has provider and model', async () => {
      const session = await client.createSession(agentId)
      expect(session.provider).toBeTruthy()
      expect(session.model).toBeTruthy()
      expect(['anthropic', 'openai', 'google', 'zai']).toContain(session.provider)
    })

    test('createSession does not leak apiKey', async () => {
      const session = await client.createSession(agentId)
      const raw = JSON.stringify(session)
      expect(raw).not.toContain('sk-')
      expect(raw).not.toContain('AIza')
      expect(raw).not.toHaveProperty('apiKey')
    })
  })

  // ─── Providers ────────────────────────────────────────────────────

  describe('providers', () => {
    // Backend does not yet have GET /orgs/:orgId/agents/:agentId/providers
    // The REPL client method exists for a future endpoint.
    // This test validates the expected 404 until the backend adds the route.
    test('listProviders returns 404 (endpoint not yet implemented)', async () => {
      await expect(
        client.listProviders(ctx.orgId, agentId)
      ).rejects.toThrow('API error (404)')
    })
  })

  // ─── Threads ──────────────────────────────────────────────────────

  describe('threads', () => {
    test('createThread returns Thread', async () => {
      const thread = await client.createThread(ctx.orgId, agentId)
      expect(thread).toBeInstanceOf(Thread)
      expect(thread.id).toBeTruthy()
      threadIds.push(thread.id)
    })

    test('listThreads includes created thread', async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'IT list test')
      threadIds.push(thread.id)

      const threads = await client.listThreads(ctx.orgId, agentId)
      expect(Array.isArray(threads)).toBe(true)
      const found = threads.find(t => t.id === thread.id)
      expect(found).toBeDefined()
    })

    test('getThread returns matching thread', async () => {
      const created = await client.createThread(ctx.orgId, agentId, 'IT get test')
      threadIds.push(created.id)

      const fetched = await client.getThread(ctx.orgId, agentId, created.id)
      expect(fetched).toBeInstanceOf(Thread)
      expect(fetched.id).toBe(created.id)
    })
  })

  // ─── Messages ─────────────────────────────────────────────────────

  describe('messages', () => {
    let threadId = ''

    beforeAll(async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'IT messages test')
      threadId = thread.id
      threadIds.push(threadId)
    })

    test('createMessage persists without error', async () => {
      await expect(
        client.createMessage(ctx.orgId, agentId, threadId, {
          type: 'user',
          content: [{ type: 'text', text: 'Hello from integration test' }],
          orgId: ctx.orgId,
        })
      ).resolves.not.toThrow()
    })

    test('listMessages includes created message', async () => {
      const messages = await client.listMessages(ctx.orgId, agentId, threadId)
      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBeGreaterThan(0)
    })
  })

  // ─── Auth error ───────────────────────────────────────────────────

  describe('auth errors', () => {
    test('invalid apiKey returns 401 error', async () => {
      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      await expect(badClient.listOrgs()).rejects.toThrow('API error (401)')
    })
  })
})

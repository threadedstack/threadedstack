import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/tsa-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/tsa-cleanup'
import { ApiClient } from '@tdsk/tsa'
import { Organization, Agent, Thread, Message } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: TSA ApiClient — Live Backend Validation
 *
 * Validates all ApiClient methods against the live backend:
 * URL construction, auth headers, envelope unwrapping, domain model wrapping.
 */
describe('Tier 1: TSA ApiClient (live)', () => {
  const ctx = readContext()
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
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-tsa-api-client',
        projectName: uniqueName('TSA ApiClient IT'),
        agentName: uniqueName('TSA ApiClient Agent'),
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data
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
      const { data: orgs } = await client.listOrgs()
      expect(Array.isArray(orgs)).toBe(true)
      expect(orgs!.length).toBeGreaterThan(0)
    })

    test('listOrgs returns Organization instances', async () => {
      const { data: orgs } = await client.listOrgs()
      expect(orgs![0]).toBeInstanceOf(Organization)
      expect(orgs![0].id).toBeTruthy()
    })

    test('getOrg returns matching org', async () => {
      const { data: org } = await client.getOrg(ctx.orgId)
      expect(org).toBeInstanceOf(Organization)
      expect(org!.id).toBe(ctx.orgId)
    })

    test('getOrg with bad ID returns error', async () => {
      const { error } = await client.getOrg('zz00000000')
      expect(error).toBeTruthy()
    })
  })

  // ─── Agents ───────────────────────────────────────────────────────

  describe('agents', () => {
    test('listAgents returns Agent array', async () => {
      const { data: agents } = await client.listAgents(ctx.orgId)
      expect(Array.isArray(agents)).toBe(true)
      // Quickstart created at least one
      expect(agents!.length).toBeGreaterThan(0)
      expect(agents![0]).toBeInstanceOf(Agent)
    })

    test('getAgent returns matching agent', async () => {
      const { data: agent } = await client.getAgent(ctx.orgId, agentId)
      expect(agent).toBeInstanceOf(Agent)
      expect(agent!.id).toBe(agentId)
    })
  })

  // ─── Sessions ─────────────────────────────────────────────────────

  describe('sessions', () => {
    test('createSession returns sessionToken', async () => {
      const { data: session } = await client.createSession(agentId)
      expect(session!.sessionToken).toBeTruthy()
      expect(typeof session!.sessionToken).toBe('string')
      expect(session!.sessionToken.length).toBeGreaterThan(10)
    })

    test('createSession has provider and model', async () => {
      const { data: session } = await client.createSession(agentId)
      expect(session!.provider).toBeTruthy()
      expect(session!.model).toBeTruthy()
      expect(['anthropic', 'openai', 'google', 'zai']).toContain(session!.provider)
    })

    test('createSession does not leak apiKey', async () => {
      const { data: session } = await client.createSession(agentId)
      const raw = JSON.stringify(session)
      expect(raw).not.toContain('sk-')
      expect(raw).not.toContain('AIza')
      expect(raw).not.toHaveProperty('apiKey')
    })
  })

  // ─── Providers ────────────────────────────────────────────────────

  describe('providers', () => {
    test('listProviders returns array of providers', async () => {
      const { data: providers } = await client.listProviders(ctx.orgId)
      expect(Array.isArray(providers)).toBe(true)
      expect(providers!.length).toBeGreaterThan(0)
    })
  })

  // ─── Threads ──────────────────────────────────────────────────────

  describe('threads', () => {
    test('createThread returns Thread', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId)
      expect(thread).toBeInstanceOf(Thread)
      expect(thread!.id).toBeTruthy()
      threadIds.push(thread!.id)
    })

    test('listThreads includes created thread', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT list test')
      threadIds.push(thread!.id)

      const { data: threads } = await client.listThreads(ctx.orgId, agentId)
      expect(Array.isArray(threads)).toBe(true)
      const found = threads!.find(t => t.id === thread!.id)
      expect(found).toBeDefined()
    })

    test('getThread returns matching thread', async () => {
      const { data: created } = await client.createThread(ctx.orgId, agentId, 'IT get test')
      threadIds.push(created!.id)

      const { data: fetched } = await client.getThread(ctx.orgId, agentId, created!.id)
      expect(fetched).toBeInstanceOf(Thread)
      expect(fetched!.id).toBe(created!.id)
    })
  })

  // ─── Messages ─────────────────────────────────────────────────────

  describe('messages', () => {
    let threadId = ''

    beforeAll(async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT messages test')
      threadId = thread!.id
      threadIds.push(threadId)
    })

    test('createMessage persists without error', async () => {
      const { error } = await client.createMessage(ctx.orgId, agentId, threadId, {
        type: 'user',
        content: [{ type: 'text', text: 'Hello from integration test' }],
        orgId: ctx.orgId,
      })
      expect(error).toBeUndefined()
    })

    test('listMessages includes created message', async () => {
      const { data: messages } = await client.listMessages(ctx.orgId, agentId, threadId)
      expect(Array.isArray(messages)).toBe(true)
      expect(messages!.length).toBeGreaterThan(0)
    })
  })

  // ─── Projects ─────────────────────────────────────────────────────

  describe('projects', () => {
    test('listProjects returns array', async () => {
      const { data: projects } = await client.listProjects(ctx.orgId)
      expect(Array.isArray(projects)).toBe(true)
      expect(projects!.length).toBeGreaterThan(0)
    })

    test('listProjects includes quickstart project', async () => {
      const { data: projects } = await client.listProjects(ctx.orgId)
      const found = projects!.find((p: any) => p.id === projectId)
      expect(found).toBeDefined()
    })
  })

  // ─── Delete thread ───────────────────────────────────────────────

  describe('deleteThread', () => {
    test('deleteThread removes a thread', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT delete test')

      await client.deleteThread(ctx.orgId, agentId, thread!.id)

      // Verify deleted: getThread should return an error
      const { error } = await client.getThread(ctx.orgId, agentId, thread!.id)
      expect(error).toBeTruthy()
    })

    test('deleteThread on non-existent thread returns error', async () => {
      const { error } = await client.deleteThread(ctx.orgId, agentId, 'zz00000000')
      expect(error).toBeTruthy()
    })
  })

  // ─── Auth error ───────────────────────────────────────────────────

  describe('auth errors', () => {
    test('invalid apiKey returns 401 error', async () => {
      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      const { ok, status } = await badClient.listOrgs()
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })
  })
})

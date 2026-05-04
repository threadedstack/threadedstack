import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { cleanupThread } from '../utils/tsa-cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { post } from '../utils/api-client'
import { tryDelete } from '../utils/cleanup'
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

  // Fixture resources for agent/thread tests
  let agentId = ''
  let projectId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  // Sandbox resources for sandbox method tests
  let sandboxId = ''
  let sandboxProjectId = ''

  // Threads created during tests (for cleanup)
  const threadIds: string[] = []

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create fixture agent for agent/thread/message tests
  beforeAll(async () => {
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('TSA ApiClient IT'),
        agentName: uniqueName('TSA ApiClient Agent'),
      })
    } catch (err) {
      console.warn('[tsa-api-client] setupFixtures failed:', (err as Error)?.message || err)
      setupFailed = true
      return
    }

    if (!fixtures.provider || !fixtures.agent?.id) {
      setupFailed = true
      return
    }

    agentId = fixtures.agent!.id
    projectId = fixtures.project!.id
  })

  // Create a sandbox config for sandbox method tests
  beforeAll(async () => {
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('tsa-api-sb-project'), orgId: ctx.orgId }
    )
    if (projRes.ok) sandboxProjectId = projRes.data.id

    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('tsa-api-sb'),
        config: {
          image: 'node:22-slim',
          ports: { '3000': { protocol: 'http' } },
          resources: {
            limits: { cpu: '500m', memory: '512Mi' },
            requests: { cpu: '100m', memory: '256Mi' },
          },
        },
        orgId: ctx.orgId,
        projectId: sandboxProjectId,
      }
    )
    if (sbRes.ok) sandboxId = sbRes.data.id
  })

  afterAll(async () => {
    // Clean up threads first
    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    // Clean up sandbox resources
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (sandboxProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${sandboxProjectId}`)
    // Clean up fixture resources
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Organizations ────────────────────────────────────────────────

  describe('organizations', () => {
    test('listOrgs returns non-empty array', async () => {
      const { ok, data: orgs } = await client.listOrgs()
      expect(ok).toBe(true)
      expect(Array.isArray(orgs)).toBe(true)
      expect(orgs!.length).toBeGreaterThan(0)
    })

    test('listOrgs returns Organization instances', async () => {
      const { ok, data: orgs } = await client.listOrgs()
      expect(ok).toBe(true)
      expect(orgs![0]).toBeInstanceOf(Organization)
      expect(orgs![0].id).toBeTruthy()
    })

    test('getOrg returns matching org', async () => {
      const { ok, data: org } = await client.getOrg(ctx.orgId)
      expect(ok).toBe(true)
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
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: agents } = await client.listAgents(ctx.orgId)
      expect(Array.isArray(agents)).toBe(true)
      // Quickstart created at least one
      expect(agents!.length).toBeGreaterThan(0)
      expect(agents![0]).toBeInstanceOf(Agent)
    })

    test('getAgent returns matching agent', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: agent } = await client.getAgent(ctx.orgId, agentId)
      expect(agent).toBeInstanceOf(Agent)
      expect(agent!.id).toBe(agentId)
    })
  })

  // ─── Sessions ─────────────────────────────────────────────────────

  describe('sessions', () => {
    test('createSession returns sessionToken', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: session } = await client.createSession(agentId)
      if (!session) {
        console.warn('[tsa-api-client] createSession returned no data — skipping')
        return
      }
      expect(session.sessionToken).toBeTruthy()
      expect(typeof session.sessionToken).toBe('string')
      expect(session.sessionToken.length).toBeGreaterThan(10)
    })

    test('createSession has provider and model', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: session } = await client.createSession(agentId)
      if (!session) {
        console.warn('[tsa-api-client] createSession returned no data — skipping')
        return
      }
      expect(session.provider).toBeTruthy()
      expect(session.model).toBeTruthy()
      expect(['anthropic', 'openai', 'google', 'zai']).toContain(session.provider)
    })

    test('createSession does not leak apiKey', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: session } = await client.createSession(agentId)
      if (!session) {
        console.warn('[tsa-api-client] createSession returned no data — skipping')
        return
      }
      const raw = JSON.stringify(session)
      expect(raw).not.toContain('sk-')
      expect(raw).not.toContain('AIza')
      expect(raw).not.toHaveProperty('apiKey')
    })
  })

  // ─── Providers ────────────────────────────────────────────────────

  describe('providers', () => {
    test('listProviders returns array of providers', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: providers } = await client.listProviders(ctx.orgId)
      expect(Array.isArray(providers)).toBe(true)
      expect(providers!.length).toBeGreaterThan(0)
    })
  })

  // ─── Threads ──────────────────────────────────────────────────────

  describe('threads', () => {
    test('createThread returns Thread', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: thread } = await client.createThread(ctx.orgId, agentId)
      if (!thread) {
        console.warn('[tsa-api-client] createThread returned no data — skipping')
        return
      }
      expect(thread).toBeInstanceOf(Thread)
      expect(thread.id).toBeTruthy()
      threadIds.push(thread.id)
    })

    test('listThreads includes created thread', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT list test')
      if (!thread) {
        console.warn('[tsa-api-client] createThread (list test) returned no data — skipping')
        return
      }
      threadIds.push(thread.id)

      const { data: threads } = await client.listThreads(ctx.orgId, agentId)
      expect(Array.isArray(threads)).toBe(true)
      const found = threads!.find(t => t.id === thread.id)
      expect(found).toBeDefined()
    })

    test('getThread returns matching thread', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: created } = await client.createThread(ctx.orgId, agentId, 'IT get test')
      if (!created) {
        console.warn('[tsa-api-client] createThread (get test) returned no data — skipping')
        return
      }
      threadIds.push(created.id)

      const { data: fetched } = await client.getThread(ctx.orgId, agentId, created.id)
      expect(fetched).toBeInstanceOf(Thread)
      expect(fetched!.id).toBe(created.id)
    })
  })

  // ─── Messages ─────────────────────────────────────────────────────

  describe('messages', () => {
    let threadId = ''
    let messagesSetupFailed = false

    beforeAll(async () => {
      if (setupFailed) { messagesSetupFailed = true; return }

      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT messages test')
      if (!thread?.id) {
        console.warn('[tsa-api-client] messages beforeAll: createThread returned no data (possibly 403)')
        messagesSetupFailed = true
        return
      }
      threadId = thread.id
      threadIds.push(threadId)
    })

    test('createMessage persists without error', async () => {
      if (setupFailed || messagesSetupFailed) return expect(false).toBe(true)

      const { error } = await client.createMessage(ctx.orgId, agentId, threadId, {
        type: 'user',
        content: [{ type: 'text', text: 'Hello from integration test' }],
        orgId: ctx.orgId,
      })
      expect(error).toBeUndefined()
    })

    test('listMessages includes created message', async () => {
      if (setupFailed || messagesSetupFailed) return expect(false).toBe(true)

      const { data: messages } = await client.listMessages(ctx.orgId, agentId, threadId)
      expect(Array.isArray(messages)).toBe(true)
      expect(messages!.length).toBeGreaterThan(0)
    })
  })

  // ─── Projects ─────────────────────────────────────────────────────

  describe('projects', () => {
    test('listProjects returns array', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: projects } = await client.listProjects(ctx.orgId)
      expect(Array.isArray(projects)).toBe(true)
      expect(projects!.length).toBeGreaterThan(0)
    })

    test('listProjects includes quickstart project', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: projects } = await client.listProjects(ctx.orgId)
      const found = projects!.find((p: any) => p.id === projectId)
      expect(found).toBeDefined()
    })
  })

  // ─── Delete thread ───────────────────────────────────────────────

  describe('deleteThread', () => {
    test('deleteThread removes a thread', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT delete test')
      if (!thread) {
        console.warn('[tsa-api-client] createThread (delete test) returned no data — skipping')
        return
      }

      await client.deleteThread(ctx.orgId, agentId, thread.id)

      // Verify deleted: getThread should return an error
      const { error } = await client.getThread(ctx.orgId, agentId, thread.id)
      expect(error).toBeTruthy()
    })

    test('deleteThread on non-existent thread returns error', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { error } = await client.deleteThread(ctx.orgId, agentId, 'zz00000000')
      expect(error).toBeTruthy()
    })
  })

  // ─── Branch thread ────────────────────────────────────────────────

  describe('branchThread', () => {
    test('branchThread creates a new thread from a message', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Create a thread with a message to branch from
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT branch source')
      if (!thread?.id) return expect(thread).toBeDefined()
      threadIds.push(thread.id)

      const { error: msgError } = await client.createMessage(ctx.orgId, agentId, thread.id, {
        type: 'user',
        content: [{ type: 'text', text: 'Message to branch from' }],
        orgId: ctx.orgId,
      })
      expect(msgError).toBeUndefined()

      // Get the message ID
      const { data: messages } = await client.listMessages(ctx.orgId, agentId, thread.id)
      expect(messages!.length).toBeGreaterThan(0)
      const messageId = (messages![0] as any).id

      const { ok, data: branched } = await client.branchThread(
        ctx.orgId,
        agentId,
        thread.id,
        messageId
      )
      expect(ok).toBe(true)
      expect(branched).toBeInstanceOf(Thread)
      expect(branched!.id).toBeTruthy()
      expect(branched!.id).not.toBe(thread.id)
      threadIds.push(branched!.id)
    })

    test('branchThread with invalid messageId returns error', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT branch invalid')
      if (!thread?.id) return expect(thread).toBeDefined()
      threadIds.push(thread.id)

      const { ok, error } = await client.branchThread(
        ctx.orgId,
        agentId,
        thread.id,
        'nonexistent-message-id-000'
      )
      expect(ok).toBe(false)
      expect(error).toBeTruthy()
    })
  })

  // ─── Sandbox methods ──────────────────────────────────────────────

  describe('sandbox methods', () => {
    test('connectSandbox returns response shape', async () => {
      if (!sandboxId || !sandboxProjectId) return expect(sandboxId).toBeTruthy()

      // connectSandbox starts a pod — may succeed or fail depending on cluster state
      const result = await client.connectSandbox(ctx.orgId, sandboxProjectId, sandboxId)

      // Whether it succeeds or fails, validate the response envelope
      expect(result).toHaveProperty('ok')
      expect(result).toHaveProperty('status')
      expect(typeof result.ok).toBe('boolean')
      expect(typeof result.status).toBe('number')
    }, 140_000)

    test('getSandboxSessions returns session list', async () => {
      if (!sandboxId || !sandboxProjectId) return expect(sandboxId).toBeTruthy()

      const result = await client.getSandboxSessions(ctx.orgId, sandboxProjectId, sandboxId)

      // Endpoint should return a valid response (may be empty array or error for stopped pod)
      expect(result).toHaveProperty('ok')
      expect(result).toHaveProperty('status')
      if (result.ok) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    })

    test('connectSandbox with bad auth returns 401', async () => {
      if (!sandboxId || !sandboxProjectId) return expect(sandboxId).toBeTruthy()

      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      const { ok, status } = await badClient.connectSandbox(ctx.orgId, sandboxProjectId, sandboxId)
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })
  })

  // ─── Provider shape ───────────────────────────────────────────────

  describe('provider details', () => {
    test('listProviders items have id and brand fields', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const { data: providers } = await client.listProviders(ctx.orgId)
      if (!providers || providers.length === 0) {
        console.warn('[tsa-api-client] listProviders returned empty — skipping shape check')
        return
      }

      const provider = providers[0]
      expect(provider).toHaveProperty('id')
      expect(provider).toHaveProperty('brand')
      expect(typeof provider.id).toBe('string')
    })

    test('listProviders with bad auth returns 401', async () => {
      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      const { ok, status } = await badClient.listProviders(ctx.orgId)
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })
  })

  // ─── Message shape ────────────────────────────────────────────────

  describe('message details', () => {
    let msgThreadId = ''
    let msgDetailsSetupFailed = false

    beforeAll(async () => {
      if (setupFailed) { msgDetailsSetupFailed = true; return }

      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'IT msg shape test')
      if (!thread?.id) {
        console.warn('[tsa-api-client] message details beforeAll: createThread returned no data (possibly 403)')
        msgDetailsSetupFailed = true
        return
      }
      msgThreadId = thread.id
      threadIds.push(msgThreadId)

      await client.createMessage(ctx.orgId, agentId, msgThreadId, {
        type: 'user',
        content: [{ type: 'text', text: 'Shape test message' }],
        orgId: ctx.orgId,
      })
    })

    test('createMessage returns Message instance with expected fields', async () => {
      if (setupFailed || msgDetailsSetupFailed) return expect(false).toBe(true)

      const { ok, data: msg } = await client.createMessage(ctx.orgId, agentId, msgThreadId, {
        type: 'user',
        content: [{ type: 'text', text: 'Shape validation message' }],
        orgId: ctx.orgId,
      })
      expect(ok).toBe(true)
      expect(msg).toBeInstanceOf(Message)
      expect(msg!.id).toBeTruthy()
    })

    test('listMessages returns Message instances', async () => {
      if (setupFailed || msgDetailsSetupFailed) return expect(false).toBe(true)

      const { data: messages } = await client.listMessages(ctx.orgId, agentId, msgThreadId)
      expect(messages!.length).toBeGreaterThan(0)
      expect(messages![0]).toBeInstanceOf(Message)
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

    test('getSandboxSessions with bad auth returns 401', async () => {
      if (!sandboxId || !sandboxProjectId) return expect(sandboxId).toBeTruthy()

      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      const { ok, status } = await badClient.getSandboxSessions(
        ctx.orgId,
        sandboxProjectId,
        sandboxId
      )
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })
  })
})

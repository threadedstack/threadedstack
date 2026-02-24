import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl'
import { Thread } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: REPL Thread Lifecycle — Full CRUD Validation
 *
 * Tests the complete thread lifecycle used by the REPL:
 * create → list → get → add messages → delete.
 * Verifies deleted threads are no longer retrievable.
 */
describe('Tier 3: REPL Thread Lifecycle (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let agentId = ''
  let quickstartResult: Record<string, any> = {}

  // Threads to clean up if tests fail partway
  const threadIds: string[] = []

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create quickstart agent for thread tests
  beforeAll(async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-thread-lifecycle',
        projectName: uniqueName('REPL Thread Lifecycle IT'),
        agentName: uniqueName('REPL Thread Lifecycle Agent'),
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    // Clean up any remaining threads
    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  // ─── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    test('createThread returns a Thread with id', async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'lifecycle-create')
      expect(thread).toBeInstanceOf(Thread)
      expect(thread.id).toBeTruthy()
      threadIds.push(thread.id)
    })

    test('createThread with custom name preserves it', async () => {
      const name = uniqueName('custom-name')
      const thread = await client.createThread(ctx.orgId, agentId, name)
      expect(thread.name).toBe(name)
      threadIds.push(thread.id)
    })
  })

  // ─── List ───────────────────────────────────────────────────────

  describe('list', () => {
    test('listThreads includes created threads', async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'lifecycle-list')
      threadIds.push(thread.id)

      const threads = await client.listThreads(ctx.orgId, agentId)
      expect(Array.isArray(threads)).toBe(true)
      const found = threads.find(t => t.id === thread.id)
      expect(found).toBeDefined()
    })
  })

  // ─── Messages ───────────────────────────────────────────────────

  describe('messages', () => {
    let threadId = ''

    beforeAll(async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'lifecycle-messages')
      threadId = thread.id
      threadIds.push(threadId)
    })

    test('createMessage persists a user message', async () => {
      await expect(
        client.createMessage(ctx.orgId, agentId, threadId, {
          type: 'user',
          content: [{ type: 'text', text: 'Thread lifecycle test message' }],
          orgId: ctx.orgId,
        })
      ).resolves.not.toThrow()
    })

    test('listMessages returns the persisted message', async () => {
      const messages = await client.listMessages(ctx.orgId, agentId, threadId)
      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBeGreaterThan(0)
    })
  })

  // ─── Delete ─────────────────────────────────────────────────────

  describe('delete', () => {
    test('deleteThread removes thread from list', async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'lifecycle-delete')

      // Verify it exists first
      const beforeList = await client.listThreads(ctx.orgId, agentId)
      expect(beforeList.find(t => t.id === thread.id)).toBeDefined()

      // Delete it
      await client.deleteThread(ctx.orgId, agentId, thread.id)

      // Verify it's gone from the list
      const afterList = await client.listThreads(ctx.orgId, agentId)
      expect(afterList.find(t => t.id === thread.id)).toBeUndefined()
    })

    test('getThread after delete throws', async () => {
      const thread = await client.createThread(ctx.orgId, agentId, 'lifecycle-delete-get')

      await client.deleteThread(ctx.orgId, agentId, thread.id)

      await expect(
        client.getThread(ctx.orgId, agentId, thread.id)
      ).rejects.toThrow('API error')
    })

    test('full lifecycle: create → message → delete → verify gone', async () => {
      // Create
      const thread = await client.createThread(ctx.orgId, agentId, 'lifecycle-full')
      expect(thread.id).toBeTruthy()

      // Add message
      await client.createMessage(ctx.orgId, agentId, thread.id, {
        type: 'user',
        content: [{ type: 'text', text: 'Full lifecycle test' }],
        orgId: ctx.orgId,
      })

      // Verify message exists
      const messages = await client.listMessages(ctx.orgId, agentId, thread.id)
      expect(messages.length).toBeGreaterThan(0)

      // Delete
      await client.deleteThread(ctx.orgId, agentId, thread.id)

      // Verify gone
      await expect(
        client.getThread(ctx.orgId, agentId, thread.id)
      ).rejects.toThrow('API error')
    })
  })
})

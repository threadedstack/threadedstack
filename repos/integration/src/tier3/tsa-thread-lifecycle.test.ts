import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { cleanupThread } from '../utils/tsa-cleanup'
import { ApiClient } from '@tdsk/tsa'
import { Thread } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures, type TFixtureResult } from '../utils/fixtures'

/**
 * Tier 3: TSA Thread Lifecycle — Full CRUD Validation
 *
 * Tests the complete thread lifecycle used by the TSA:
 * create → list → get → add messages → delete.
 * Verifies deleted threads are no longer retrievable.
 */
describe('Tier 3: TSA Thread Lifecycle (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let agentId = ''
  let fixtures: TFixtureResult | null = null

  // Threads to clean up if tests fail partway
  const threadIds: string[] = []

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create fixtures for thread tests
  beforeAll(async () => {
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      apiKey: 'sk-ant-test-thread-lifecycle',
      projectName: uniqueName('TSA Thread Lifecycle IT'),
      agentName: uniqueName('TSA Thread Lifecycle Agent'),
    })

    expect(fixtures.provider).toBeDefined()
    agentId = fixtures.agent!.id
  })

  afterAll(async () => {
    // Clean up any remaining threads
    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    if (fixtures) await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    test('createThread returns a Thread with id', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'lifecycle-create')
      expect(thread).toBeInstanceOf(Thread)
      expect(thread!.id).toBeTruthy()
      threadIds.push(thread!.id)
    })

    test('createThread with custom name preserves it', async () => {
      const name = uniqueName('custom-name')
      const { data: thread } = await client.createThread(ctx.orgId, agentId, name)
      expect(thread!.name).toBe(name)
      threadIds.push(thread!.id)
    })
  })

  // ─── List ───────────────────────────────────────────────────────

  describe('list', () => {
    test('listThreads includes created threads', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'lifecycle-list')
      threadIds.push(thread!.id)

      const { data: threads } = await client.listThreads(ctx.orgId, agentId)
      expect(Array.isArray(threads)).toBe(true)
      const found = threads!.find(t => t.id === thread!.id)
      expect(found).toBeDefined()
    })
  })

  // ─── Messages ───────────────────────────────────────────────────

  describe('messages', () => {
    let threadId = ''

    beforeAll(async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'lifecycle-messages')
      threadId = thread!.id
      threadIds.push(threadId)
    })

    test('createMessage persists a user message', async () => {
      const { error } = await client.createMessage(ctx.orgId, agentId, threadId, {
        type: 'user',
        content: [{ type: 'text', text: 'Thread lifecycle test message' }],
        orgId: ctx.orgId,
      })
      expect(error).toBeUndefined()
    })

    test('listMessages returns the persisted message', async () => {
      const { data: messages } = await client.listMessages(ctx.orgId, agentId, threadId)
      expect(Array.isArray(messages)).toBe(true)
      expect(messages!.length).toBeGreaterThan(0)
    })
  })

  // ─── Delete ─────────────────────────────────────────────────────

  describe('delete', () => {
    test('deleteThread removes thread from list', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'lifecycle-delete')

      // Verify it exists first
      const { data: beforeList } = await client.listThreads(ctx.orgId, agentId)
      expect(beforeList!.find(t => t.id === thread!.id)).toBeDefined()

      // Delete it
      await client.deleteThread(ctx.orgId, agentId, thread!.id)

      // Verify it's gone from the list
      const { data: afterList } = await client.listThreads(ctx.orgId, agentId)
      expect(afterList!.find(t => t.id === thread!.id)).toBeUndefined()
    })

    test('getThread after delete returns error', async () => {
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'lifecycle-delete-get')

      await client.deleteThread(ctx.orgId, agentId, thread!.id)

      const { error } = await client.getThread(ctx.orgId, agentId, thread!.id)
      expect(error).toBeTruthy()
    })

    test('full lifecycle: create → message → delete → verify gone', async () => {
      // Create
      const { data: thread } = await client.createThread(ctx.orgId, agentId, 'lifecycle-full')
      expect(thread!.id).toBeTruthy()

      // Add message
      await client.createMessage(ctx.orgId, agentId, thread!.id, {
        type: 'user',
        content: [{ type: 'text', text: 'Full lifecycle test' }],
        orgId: ctx.orgId,
      })

      // Verify message exists
      const { data: messages } = await client.listMessages(ctx.orgId, agentId, thread!.id)
      expect(messages!.length).toBeGreaterThan(0)

      // Delete
      await client.deleteThread(ctx.orgId, agentId, thread!.id)

      // Verify gone
      const { error } = await client.getThread(ctx.orgId, agentId, thread!.id)
      expect(error).toBeTruthy()
    })
  })
})

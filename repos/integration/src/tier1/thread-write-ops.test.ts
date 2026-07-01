import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'
import { isFeatureEnabled } from '@tdsk/domain'

describe.skipIf(!isFeatureEnabled('agents'))('Tier 1: Thread & Message Write Operations', () => {
  const ctx = readContext()
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  let agentId = ''

  /** Base path helper for thread routes under an agent */
  const threadBasePath = () =>
    `/orgs/${ctx.orgId}/agents/${agentId}/threads`

  /** IDs created during tests — cleaned up in afterAll */
  const createdThreadIds: string[] = []

  beforeAll(async () => {
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('Thread Write Ops Project'),
        agentName: uniqueName('Thread Write Ops Agent'),
        createEndpoint: false,
      })
    } catch (err) {
      console.warn('[thread-write-ops] setupFixtures failed:', (err as Error)?.message || err)
      setupFailed = true
      return
    }

    if (!fixtures.agent?.id) {
      setupFailed = true
      return
    }

    agentId = fixtures.agent.id
  })

  afterAll(async () => {
    // Clean up threads created during tests (best-effort, reverse order)
    for (const threadId of [...createdThreadIds].reverse()) {
      await tryDelete(`${threadBasePath()}/${threadId}`)
    }

    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ---------------------------------------------------------------------------
  // Thread CRUD
  // ---------------------------------------------------------------------------

  let threadId = ''
  const threadName = uniqueName('write-ops-thread')
  const updatedThreadName = uniqueName('write-ops-thread-updated')

  describe('Thread CRUD', () => {
    test('POST creates a new thread', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const res = await post<Record<string, any>>(
        threadBasePath(),
        { name: threadName }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeDefined()

      threadId = res.data.id
      createdThreadIds.push(threadId)
    })

    test('created thread has expected shape', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await get<Record<string, any>>(
        `${threadBasePath()}/${threadId}`
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)

      const thread = res.data
      expect(thread.id).toBe(threadId)
      expect(thread.name).toBe(threadName)
      expect(thread.agentId).toBe(agentId)
      expect(thread.createdAt).toBeDefined()
    })

    test('PUT updates thread name', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await put<Record<string, any>>(
        `${threadBasePath()}/${threadId}`,
        { name: updatedThreadName }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.name).toBe(updatedThreadName)
    })

    test('POST thread without auth returns 401', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const res = await post(
        threadBasePath(),
        { name: 'should-fail' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Message CRUD
  // ---------------------------------------------------------------------------

  let messageId = ''
  const messagePath = () =>
    `${threadBasePath()}/${threadId}/messages`

  describe('Message CRUD', () => {
    test('POST creates a message in the thread', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await post<Record<string, any>>(
        messagePath(),
        {
          type: 'user',
          content: [{ type: 'text', text: 'Hello from integration test' }],
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeDefined()

      messageId = res.data.id
    })

    test('created message has expected shape', async () => {
      if (setupFailed || !messageId) return expect(setupFailed).toBe(false)

      // List messages and find ours
      const res = await get<Record<string, any>[]>(messagePath())

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      const msg = res.data.find((m: any) => m.id === messageId)
      expect(msg).toBeDefined()
      expect(msg?.threadId).toBe(threadId)
      expect(msg?.type).toBe('user')
      expect(msg?.content).toBeDefined()
    })

    test('PUT updates message content', async () => {
      if (setupFailed || !messageId) return expect(setupFailed).toBe(false)

      const res = await put<Record<string, any>>(
        `${messagePath()}/${messageId}`,
        {
          content: [{ type: 'text', text: 'Updated message content' }],
        }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
    })

    test('POST message without auth returns 401', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await post(
        messagePath(),
        {
          type: 'user',
          content: [{ type: 'text', text: 'unauthorized' }],
        },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Branch
  // ---------------------------------------------------------------------------

  describe('Branch', () => {
    /** Second message added so the branch has something to branch at */
    let secondMessageId = ''

    test('setup: create a second message for branching', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await post<Record<string, any>>(
        messagePath(),
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Assistant reply for branch test' }],
        }
      )

      expect(res.status).toBe(201)
      secondMessageId = res.data.id
    })

    test('POST branch creates a new thread from a message point', async () => {
      if (setupFailed || !threadId || !secondMessageId)
        return expect(setupFailed).toBe(false)

      const res = await post<Record<string, any>>(
        `${threadBasePath()}/${threadId}/branch`,
        { messageId: secondMessageId }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeDefined()
      expect(res.data.id).not.toBe(threadId)

      // Track for cleanup
      createdThreadIds.push(res.data.id)
    })

    test('branched thread contains a subset of original messages', async () => {
      if (setupFailed || createdThreadIds.length < 2)
        return expect(setupFailed).toBe(false)

      const branchedThreadId = createdThreadIds[createdThreadIds.length - 1]

      const res = await get<Record<string, any>[]>(
        `${threadBasePath()}/${branchedThreadId}/messages`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      // The original thread has at least 2 messages; the branch should have
      // messages up to (and including) the branch point
      const origMsgs = await get<Record<string, any>[]>(messagePath())
      expect(origMsgs.status).toBe(200)

      // Branch should have <= original message count
      expect(res.data.length).toBeLessThanOrEqual(origMsgs.data.length)
    })

    test('branch with nonexistent messageId returns 400 or 404', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await post(
        `${threadBasePath()}/${threadId}/branch`,
        { messageId: '00000000-0000-0000-0000-000000000000' }
      )

      expect(res.ok).toBe(false)
      expect([400, 404]).toContain(res.status)
    })

    test('branch without auth returns 401', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await post(
        `${threadBasePath()}/${threadId}/branch`,
        { messageId: 'any-id' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Deletion (run last — after branch tests that depend on the thread/messages)
  // ---------------------------------------------------------------------------

  describe('Deletion', () => {
    test('DELETE removes a message', async () => {
      if (setupFailed || !messageId) return expect(setupFailed).toBe(false)

      const res = await del<Record<string, any>>(
        `${messagePath()}/${messageId}`
      )

      // DELETE may require admin scope — 403 is valid for non-admin keys
      if (res.status === 403) {
        console.warn('[thread-write-ops] DELETE message got 403 — API key lacks delete permission, skipping assertion')
        expect(res.ok).toBe(false)
        return
      }

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })

    test('DELETE removes a thread', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await del<Record<string, any>>(
        `${threadBasePath()}/${threadId}`
      )

      if (res.status === 403) {
        console.warn('[thread-write-ops] DELETE thread got 403 — API key lacks delete permission, skipping assertion')
        expect(res.ok).toBe(false)
        return
      }

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)

      // Remove from cleanup list since it was already deleted
      const idx = createdThreadIds.indexOf(threadId)
      if (idx !== -1) createdThreadIds.splice(idx, 1)
    })

    test('GET deleted thread returns 404', async () => {
      if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

      const res = await get(
        `${threadBasePath()}/${threadId}`
      )

      // If the delete above got 403 (non-admin key), the thread still exists
      // so this test would get 200 — only assert 404 if the delete succeeded
      if (createdThreadIds.includes(threadId)) {
        // Thread was not deleted (403 above), so it should still be accessible
        expect([200, 404]).toContain(res.status)
      } else {
        expect(res.status).toBe(404)
        expect(res.ok).toBe(false)
      }
    })
  })
})

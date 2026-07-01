import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 3: Thread Branching — End-to-End Integration Tests
 *
 * Creates a thread, adds messages, branches at a specific message,
 * and verifies the branched thread contains only messages up to the
 * branch point while the original remains unchanged.
 */
describe.skipIf(!isFeatureEnabled('agents'))('Tier 3: Thread Branching', () => {
  const ctx = readContext()
  let agentId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  /** Thread created during setup with 5 messages */
  let threadId = ''
  /** Ordered message IDs (indices 0-4 correspond to messages 1-5) */
  const messageIds: string[] = []
  /** Thread IDs created during tests — cleaned up in afterAll */
  const branchedThreadIds: string[] = []

  beforeAll(async () => {
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('Thread Branch Test Project'),
        agentName: uniqueName('Thread Branch Test Agent'),
      })
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.warn('[thread-branching] beforeAll: fixture setup failed (possibly 403 from authorize middleware) —', msg)
      setupFailed = true
      return
    }

    if (!fixtures.agent?.id) {
      setupFailed = true
      return
    }

    agentId = fixtures.agent.id

    // Create a thread
    const threadRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads`,
      { name: uniqueName('Branch Source Thread') }
    )

    if (threadRes.status !== 201 || !threadRes.data?.id) {
      setupFailed = true
      return
    }

    threadId = threadRes.data.id

    // Add 5 messages (alternating user/assistant) with distinguishable content
    for (let i = 1; i <= 5; i++) {
      const type = i % 2 === 1 ? 'user' : 'assistant'
      const msgRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`,
        {
          type,
          content: [{ type: 'text', text: `Message ${i}` }],
        }
      )

      if (msgRes.status !== 201 || !msgRes.data?.id) {
        setupFailed = true
        return
      }

      messageIds.push(msgRes.data.id)
    }
  })

  afterAll(async () => {
    // Clean up branched threads first (they reference the original)
    for (const tid of branchedThreadIds) {
      await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/threads/${tid}`)
    }

    // Clean up the original thread
    if (threadId) {
      await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}`)
    }

    await cleanupFixtures(ctx.orgId, fixtures)
  })

  test('setup created thread with 5 messages', () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    expect(threadId).toBeTruthy()
    expect(messageIds).toHaveLength(5)
  })

  test('branching at message 3 creates a new thread', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const branchRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/branch`,
      { messageId: messageIds[2] }
    )

    expect(branchRes.status).toBe(201)
    expect(branchRes.data).toBeDefined()
    expect(branchRes.data.id).toBeDefined()
    expect(branchRes.data.id).not.toBe(threadId)

    branchedThreadIds.push(branchRes.data.id)

    // The branched thread should reference the original
    expect(branchRes.data.parentThreadId).toBe(threadId)
    expect(branchRes.data.branchMessageId).toBe(messageIds[2])
  })

  test('branched thread contains only messages up to branch point', async () => {
    if (setupFailed || branchedThreadIds.length === 0) {
      return expect(setupFailed).toBe(false)
    }

    const branchedId = branchedThreadIds[0]
    const msgRes = await get<any[]>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${branchedId}/messages`
    )

    expect(msgRes.status).toBe(200)
    expect(Array.isArray(msgRes.data)).toBe(true)

    // Branching at message 3 (index 2) should copy messages 1-3
    expect(msgRes.data).toHaveLength(3)

    // Verify content matches the first 3 messages
    const sortedMessages = [...msgRes.data].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    for (let i = 0; i < 3; i++) {
      const msg = sortedMessages[i]
      expect(msg.content).toBeDefined()
      expect(Array.isArray(msg.content)).toBe(true)

      const textBlock = msg.content.find((c: any) => c.type === 'text')
      expect(textBlock).toBeDefined()
      expect(textBlock.text).toBe(`Message ${i + 1}`)
    }
  })

  test('original thread still has all 5 messages unchanged', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const msgRes = await get<any[]>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(msgRes.status).toBe(200)
    expect(Array.isArray(msgRes.data)).toBe(true)
    expect(msgRes.data).toHaveLength(5)

    // Verify all 5 messages are present with correct content
    const sortedMessages = [...msgRes.data].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    for (let i = 0; i < 5; i++) {
      const msg = sortedMessages[i]
      const textBlock = msg.content.find((c: any) => c.type === 'text')
      expect(textBlock).toBeDefined()
      expect(textBlock.text).toBe(`Message ${i + 1}`)
    }
  })

  test('branching with invalid messageId returns an error', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const fakeMessageId = '00000000-0000-0000-0000-000000000000'
    const branchRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/branch`,
      { messageId: fakeMessageId }
    )

    expect([400, 404]).toContain(branchRes.status)
  })

  test('branching without messageId returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const branchRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/branch`,
      {}
    )

    expect(branchRes.status).toBe(400)
  })
})

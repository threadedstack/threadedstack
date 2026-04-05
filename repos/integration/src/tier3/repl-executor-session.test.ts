import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { post } from '../utils/api-client'
import { createTestAuth } from '../utils/repl-auth'
import { cleanupQuickstart, cleanupThread } from '../utils/repl-cleanup'
import { ApiClient } from '@tdsk/repl/services/api'
import { Executor } from '@tdsk/repl/services/executor'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: REPL Executor — Session & Thread Orchestration
 *
 * Validates that Executor correctly orchestrates session creation
 * and thread creation against the live backend. Does NOT require a real LLM key
 * since session/thread creation use the backend admin API (API key auth), not LLM calls.
 */
describe('Tier 3: REPL Executor — session orchestration (live)', () => {
  const ctx = readContext()
  let executor: Executor

  // Quickstart resources
  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  const threadIds: string[] = []

  beforeAll(async () => {
    const auth = createTestAuth()
    const client = new ApiClient(auth as any)
    executor = new Executor(client)

    // Create quickstart agent
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-repl-executor-session',
        projectName: uniqueName('REPL Executor IT'),
        agentName: uniqueName('REPL Executor Agent'),
      }
    )

    expect(res.status).toBe(201)
    quickstartResult = res.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    await cleanupQuickstart(ctx.orgId, quickstartResult)
  })

  // ─── Session creation ─────────────────────────────────────────────

  test('createSession returns TSessionInfo', async () => {
    const session = await executor.createSession(agentId)
    expect(session).toBeDefined()
    expect(session.sessionToken).toBeTruthy()
    expect(session.provider).toBeTruthy()
    expect(session.model).toBeTruthy()
  })

  test('session has non-empty sessionToken', async () => {
    const session = await executor.createSession(agentId)
    expect(typeof session.sessionToken).toBe('string')
    expect(session.sessionToken.length).toBeGreaterThan(10)
  })

  test('session provider matches quickstart template', async () => {
    const session = await executor.createSession(agentId)
    expect(session.provider).toBe('anthropic')
  })

  // ─── Client accessor ─────────────────────────────────────────────

  test('executor.client returns ApiClient', () => {
    expect(executor.client).toBeDefined()
    expect(typeof executor.client.listOrgs).toBe('function')
  })

  test('executor.client.proxyUrl matches env', () => {
    expect(executor.client.proxyUrl).toBe(env.proxyUrl)
  })

  // ─── Thread auto-creation via run() ───────────────────────────────

  test('run() without threadId creates new thread (catches LLM error)', async () => {
    let threadId: string | undefined

    try {
      const result = await executor.run({
        orgId: ctx.orgId,
        agentId,
        prompt: 'Test prompt',
        userId: ctx.userId,
        onEvent: () => {},
      })
      threadId = result.threadId
    } catch {
      // LLM call fails with test key — expected.
      // But session + thread creation should have succeeded.
      // We need to find the created thread via the API.
    }

    // If run() returned before error, we have the threadId.
    // If it threw, we check threads list for a recently created one.
    if (!threadId) {
      const threads = await executor.client.listThreads(ctx.orgId, agentId)
      const recent = threads.find(t => t.name === 'REPL session')
      expect(recent).toBeDefined()
      threadId = recent!.id
    }

    expect(threadId).toBeTruthy()
    threadIds.push(threadId!)
  })

  test('created thread is retrievable via getThread', async () => {
    // Create a thread via the client directly to verify the path works
    const thread = await executor.client.createThread(ctx.orgId, agentId, 'IT executor verify')
    threadIds.push(thread.id)

    const fetched = await executor.client.getThread(ctx.orgId, agentId, thread.id)
    expect(fetched.id).toBe(thread.id)
    expect(fetched.name).toBe('IT executor verify')
  })
})

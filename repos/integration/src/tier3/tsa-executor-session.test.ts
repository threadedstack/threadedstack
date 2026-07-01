import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { cleanupThread } from '../utils/tsa-cleanup'
import { ApiClient } from '@tdsk/tsa/services/api'
import { Executor } from '@tdsk/tsa/services/executor'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures, type TFixtureResult } from '../utils/fixtures'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 3: TSA Executor — Session & Thread Orchestration
 *
 * Validates that Executor correctly orchestrates session creation
 * and thread creation against the live backend. Does NOT require a real LLM key
 * since session/thread creation use the backend admin API (API key auth), not LLM calls.
 */
describe.skipIf(!isFeatureEnabled('agents'))('Tier 3: TSA Executor — session orchestration (live)', () => {
  const ctx = readContext()
  let executor: Executor

  // Fixture resources
  let agentId = ''
  let fixtures: TFixtureResult | null = null
  const threadIds: string[] = []

  beforeAll(async () => {
    const auth = createTestAuth()
    const client = new ApiClient(auth as any)
    executor = new Executor(client)

    // Create fixtures for executor tests
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      apiKey: 'sk-ant-test-tsa-executor-session',
      projectName: uniqueName('TSA Executor IT'),
      agentName: uniqueName('TSA Executor Agent'),
    })

    expect(fixtures.provider).toBeDefined()
    agentId = fixtures.agent!.id
  })

  afterAll(async () => {
    for (const tid of threadIds) {
      await cleanupThread(ctx.orgId, agentId, tid)
    }
    if (fixtures) await cleanupFixtures(ctx.orgId, fixtures)
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
      const { data: threads } = await executor.client.listThreads(ctx.orgId, agentId)
      const recent = threads!.find(t => t.name === 'TSA session')
      expect(recent).toBeDefined()
      threadId = recent!.id
    }

    expect(threadId).toBeTruthy()
    threadIds.push(threadId!)
  })

  test('created thread is retrievable via getThread', async () => {
    // Create a thread via the client directly to verify the path works
    const { data: thread } = await executor.client.createThread(ctx.orgId, agentId, 'IT executor verify')
    threadIds.push(thread!.id)

    const { data: fetched } = await executor.client.getThread(ctx.orgId, agentId, thread!.id)
    expect(fetched!.id).toBe(thread!.id)
    expect(fetched!.name).toBe('IT executor verify')
  })
})

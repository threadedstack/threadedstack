import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 1: Thread Message Ordering & Timestamps
 *
 * Validates that messages persisted to a thread preserve chronological
 * ordering and include proper `createdAt` timestamps.
 *
 * Covers fix I3: `convertToLlmMessages` now uses original `createdAt`
 * timestamps from DB records instead of `Date.now()`. This test verifies
 * the DB layer correctly stores and returns ordered timestamps.
 */
describe.skipIf(!isFeatureEnabled('agents'))('Tier 1: Thread Message Ordering (I3 fix)', () => {
  const ctx = readContext()
  let agentId = ''
  let threadId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  beforeAll(async () => {
    if (!env.testProviderKey) {
      setupFailed = true
      return
    }

    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'zai',
      apiKey: env.testProviderKey,
      projectName: uniqueName('MsgOrder Test'),
      agentName: uniqueName('MsgOrder Agent'),
    })

    if (!fixtures.agent?.id) {
      setupFailed = true
      return
    }

    agentId = fixtures.agent.id

    // Create a thread
    const threadRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads`,
      { title: uniqueName('MsgOrder Thread') }
    )

    if (threadRes.status === 201 && threadRes.data?.id) {
      threadId = threadRes.data.id
    } else {
      setupFailed = true
    }
  })

  afterAll(async () => {
    if (threadId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}`)
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Create Messages ──────────────────────────────────────────────

  test('create multiple messages with sequential timestamps', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const messages = [
      { type: 'user', content: [{ type: 'text', text: 'First user message' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'First assistant reply' }] },
      { type: 'user', content: [{ type: 'text', text: 'Second user message' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'Second assistant reply' }] },
    ]

    for (const msg of messages) {
      const res = await post(
        `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`,
        msg
      )
      expect(res.status).toBe(201)

      // Delay to ensure distinct timestamps in DB (PostgreSQL timestamp has µs precision)
      await new Promise(r => setTimeout(r, 200))
    }
  })

  // ─── Verify Ordering (I3 fix) ─────────────────────────────────────

  test('messages returned in order with createdAt timestamps (I3 fix)', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(4)

    // I3 fix: Each message should have a createdAt timestamp
    for (const msg of res.data) {
      expect(msg.createdAt).toBeTruthy()
      expect(new Date(msg.createdAt).getTime()).toBeGreaterThan(0)
    }

    // Verify chronological order: each createdAt >= previous
    for (let i = 1; i < res.data.length; i++) {
      const prev = new Date(res.data[i - 1].createdAt).getTime()
      const curr = new Date(res.data[i].createdAt).getTime()
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })

  test('messages have expected types in correct order', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(res.status).toBe(200)

    const types = res.data.map((m: any) => m.type)
    expect(types).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  test('messages contain expected content structure', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(res.status).toBe(200)

    for (const msg of res.data) {
      expect(Array.isArray(msg.content)).toBe(true)
      expect(msg.content.length).toBeGreaterThanOrEqual(1)
      expect(msg.content[0].type).toBe('text')
      expect(typeof msg.content[0].text).toBe('string')
    }
  })
})

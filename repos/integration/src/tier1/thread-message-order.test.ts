import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'

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
describe('Tier 1: Thread Message Ordering (I3 fix)', () => {
  const ctx = readContext()
  let agentId = ''
  let threadId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    if (!env.testProviderKey) {
      setupFailed = true
      return
    }

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('MsgOrder Test'),
        agentName: uniqueName('MsgOrder Agent'),
      }
    )

    if (res.status !== 201 || !res.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id

    // Create a thread
    const threadRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads`,
      { title: uniqueName('MsgOrder Thread') }
    )

    if (threadRes.status === 201 && threadRes.data?.data?.id) {
      threadId = threadRes.data.data.id
    } else {
      setupFailed = true
    }
  })

  afterAll(async () => {
    if (threadId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}`)
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project?.id}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
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

    const res = await get<{ data: Record<string, any>[] }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(res.data.data.length).toBeGreaterThanOrEqual(4)

    // I3 fix: Each message should have a createdAt timestamp
    for (const msg of res.data.data) {
      expect(msg.createdAt).toBeTruthy()
      expect(new Date(msg.createdAt).getTime()).toBeGreaterThan(0)
    }

    // Verify chronological order: each createdAt >= previous
    for (let i = 1; i < res.data.data.length; i++) {
      const prev = new Date(res.data.data[i - 1].createdAt).getTime()
      const curr = new Date(res.data.data[i].createdAt).getTime()
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })

  test('messages have expected types in correct order', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any>[] }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(res.status).toBe(200)

    const types = res.data.data.map((m: any) => m.type)
    expect(types).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  test('messages contain expected content structure', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any>[] }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
    )

    expect(res.status).toBe(200)

    for (const msg of res.data.data) {
      expect(Array.isArray(msg.content)).toBe(true)
      expect(msg.content.length).toBeGreaterThanOrEqual(1)
      expect(msg.content[0].type).toBe('text')
      expect(typeof msg.content[0].text).toBe('string')
    }
  })
})

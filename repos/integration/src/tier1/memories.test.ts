import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 1: Agent memory store (P2).
 *
 * Memories are org+agent-scoped and mounted at
 * /orgs/:orgId/agents/:agentId/memories (CRUD) + .../memories/search.
 * These tests exercise the DB + scoring path only (no embedding provider is
 * configured for the test org, so retrieval degrades to lexical / recency —
 * which is the graceful-degradation contract).
 */
describe.skipIf(!isFeatureEnabled('memories') || !isFeatureEnabled('agents'))(
  'Tier 1: Agent Memories',
  () => {
    const ctx = readContext()

    let projectId = ''
    let providerId = ''
    let agentId = ''
    let setupFailed = false
    const createdMemoryIds: string[] = []

    beforeAll(async () => {
      const projRes = await post<{ id: string }>(`/orgs/${ctx.orgId}/projects`, {
        name: uniqueName('Memories Test Project'),
        orgId: ctx.orgId,
      })
      if (projRes.status !== 201 || !projRes.data?.id) return void (setupFailed = true)
      projectId = projRes.data.id

      const provRes = await post<{ id: string }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Memories Test Provider'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'anthropic',
        options: { baseUrl: 'https://api.anthropic.com' },
      })
      if (provRes.status !== 201 || !provRes.data?.id) return void (setupFailed = true)
      providerId = provRes.data.id

      const agentRes = await post<{ id: string }>(`/orgs/${ctx.orgId}/agents`, {
        name: uniqueName('Memories Test Agent'),
        orgId: ctx.orgId,
        providerInputs: [{ id: providerId }],
        projectIds: [projectId],
        model: 'claude-sonnet-4-5-20250929',
      })
      if (agentRes.status !== 201 || !agentRes.data?.id) return void (setupFailed = true)
      agentId = agentRes.data.id
    })

    afterAll(async () => {
      for (const id of createdMemoryIds)
        await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/memories/${id}`)
      if (agentId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}`)
      if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
      if (providerId) await tryDelete(`/orgs/${ctx.orgId}/providers/${providerId}`)
    })

    test('POST creates a memory and returns its id', async () => {
      expect(setupFailed).toBe(false)
      const res = await post<{ id: string; kind: string; importance: number }>(
        `/orgs/${ctx.orgId}/agents/${agentId}/memories`,
        { text: 'The prod egress CA has a positive serial number.', kind: 'fact', importance: 7 }
      )
      expect(res.status).toBe(201)
      expect(res.data?.id).toBeTruthy()
      expect(res.data?.kind).toBe('fact')
      expect(res.data?.importance).toBe(7)
      createdMemoryIds.push(res.data!.id)
    })

    test('GET lists memories for the agent', async () => {
      const res = await get<Record<string, any>[]>(
        `/orgs/${ctx.orgId}/agents/${agentId}/memories?limit=100`
      )
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)
      expect(res.data!.some((m: any) => createdMemoryIds.includes(m.id))).toBe(true)
    })

    test('PUT updates a memory', async () => {
      const res = await put<{ importance: number }>(
        `/orgs/${ctx.orgId}/agents/${agentId}/memories/${createdMemoryIds[0]}`,
        { importance: 9 }
      )
      expect(res.status).toBe(200)
      expect(res.data?.importance).toBe(9)
    })

    test('POST /search returns scored matches (lexical fallback, no embedding provider)', async () => {
      await post(`/orgs/${ctx.orgId}/agents/${agentId}/memories`, {
        text: 'ZAI GLM and OpenRouter are Anthropic-compatible fallback brains.',
        kind: 'insight',
        importance: 6,
      }).then((r: any) => r.data?.id && createdMemoryIds.push(r.data.id))

      const res = await post<Record<string, any>[]>(
        `/orgs/${ctx.orgId}/agents/${agentId}/memories/search`,
        { query: 'egress CA serial', limit: 5 }
      )
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)
      // The CA-serial fact should score above the fallback-brains insight for this query
      expect(res.data!.length).toBeGreaterThanOrEqual(1)
      expect(res.data![0].text).toContain('serial')
    })

    test('DELETE removes a memory', async () => {
      const target = createdMemoryIds.pop()!
      const res = await del(`/orgs/${ctx.orgId}/agents/${agentId}/memories/${target}`)
      expect(res.status).toBe(200)
    })

    test('memories are agent-scoped — a bad agentId 404s', async () => {
      const res = await get(`/orgs/${ctx.orgId}/agents/ag_nonexistent/memories`)
      expect([403, 404]).toContain(res.status)
    })
  }
)

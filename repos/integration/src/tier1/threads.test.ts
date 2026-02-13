import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

interface Agent {
  id: string
  [key: string]: unknown
}

describe('Tier 1: Threads', () => {
  const ctx = readContext()
  let firstAgentId: string | undefined

  test('fetch agents to determine if thread tests can run', async () => {
    const res = await get<{ data: Agent[] }>(`/orgs/${ctx.orgId}/agents`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data)).toBe(true)

    if (res.data.data.length > 0) {
      firstAgentId = res.data.data[0].id
    }
  })

  test('GET /orgs/:orgId/agents/:agentId/threads returns 200 with data array', async (context) => {
    if (!firstAgentId) {
      context.skip()
      return
    }

    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/agents/${firstAgentId}/threads`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(typeof res.data.limit).toBe('number')
    expect(typeof res.data.offset).toBe('number')
  })
})

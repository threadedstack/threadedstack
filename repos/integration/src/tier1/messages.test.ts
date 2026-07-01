import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { isFeatureEnabled } from '@tdsk/domain'

interface Agent {
  id: string
  [key: string]: unknown
}

interface Thread {
  id: string
  [key: string]: unknown
}

describe.skipIf(!isFeatureEnabled('agents'))('Tier 1: Messages', () => {
  const ctx = readContext()
  let firstAgentId: string | undefined
  let firstThreadId: string | undefined

  test('fetch agents and threads to determine if message tests can run', async () => {
    const agentsRes = await get<Agent[]>(`/orgs/${ctx.orgId}/agents`)

    expect(agentsRes.status).toBe(200)
    expect(Array.isArray(agentsRes.data)).toBe(true)

    if (agentsRes.data.length === 0) return

    firstAgentId = agentsRes.data[0].id

    const threadsRes = await get<Thread[]>(
      `/orgs/${ctx.orgId}/agents/${firstAgentId}/threads`
    )

    expect(threadsRes.status).toBe(200)
    expect(Array.isArray(threadsRes.data)).toBe(true)

    if (threadsRes.data.length > 0) {
      firstThreadId = threadsRes.data[0].id
    }
  })

  test('GET messages for a thread returns 200 with data array', async (context) => {
    if (!firstThreadId) {
      context.skip()
      return
    }

    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/agents/${firstAgentId}/threads/${firstThreadId}/messages`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })
})

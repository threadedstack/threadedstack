import { describe, test, expect } from 'vitest'
import { get, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Agents', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/agents returns 200 with data array', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/agents`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(typeof res.data.limit).toBe('number')
    expect(typeof res.data.offset).toBe('number')
  })

  test('GET /orgs/:orgId/agents/:id returns agent with secrets array', async () => {
    const res = await get<{ data: { id: string; secrets: unknown[] } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBe(ctx.agentId)
    expect(Array.isArray(res.data.data.secrets)).toBe(true)
  })

  test('PUT /orgs/:orgId/agents/:id with secretIds attaches secrets', async () => {
    // First, list secrets to find one to attach
    const secretsRes = await get<{
      data: Array<{ id: string; name: string }>
    }>(`/orgs/${ctx.orgId}/secrets`)
    if (!secretsRes.data?.data?.length) return // skip if no secrets exist

    const secretId = secretsRes.data.data[0].id

    // Update agent with secretIds
    const updateRes = await put<{
      data: { id: string; secrets: Array<{ id: string }> }
    }>(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`, { secretIds: [secretId] })

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    // Verify the agent now has the secret attached
    const agentRes = await get<{
      data: { secrets: Array<{ id: string }> }
    }>(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`)
    expect(
      agentRes.data.data.secrets.some((s: { id: string }) => s.id === secretId)
    ).toBe(true)
  })

  test('PUT /orgs/:orgId/agents/:id with empty secretIds detaches all secrets', async () => {
    // Detach all secrets
    const updateRes = await put<{
      data: { id: string; secrets: unknown[] }
    }>(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`, { secretIds: [] })

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    // Verify agent has no secrets
    const agentRes = await get<{ data: { secrets: unknown[] } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`
    )
    expect(agentRes.data.data.secrets).toHaveLength(0)
  })

  test('attached secret appears in agent response with correct id', async () => {
    // List secrets, attach one, then verify through agent endpoint
    const secretsRes = await get<{ data: Array<{ id: string }> }>(
      `/orgs/${ctx.orgId}/secrets`
    )
    if (!secretsRes.data?.data?.length) return // skip if no secrets

    const secretId = secretsRes.data.data[0].id

    // Attach the secret to the agent
    const attachRes = await put(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`,
      { secretIds: [secretId] }
    )
    expect(attachRes.status).toBe(200)

    // Verify through agent endpoint — agent-scoped secrets are accessed via agent, not org secrets
    const agentRes = await get<{
      data: {
        id: string
        secrets: Array<{
          id: string
          agentId: string | null
          orgId: string | null
        }>
      }
    }>(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`)

    expect(agentRes.status).toBe(200)
    const attachedSecret = agentRes.data.data.secrets.find(
      (s: { id: string }) => s.id === secretId
    )
    expect(attachedSecret).toBeDefined()
    // Secret should have agentId set (exclusive arc — orgId cleared)
    expect(attachedSecret!.agentId).toBe(ctx.agentId)
    expect(attachedSecret!.orgId).toBeNull()

    // Clean up: detach the secret
    await put(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`, { secretIds: [] })
  })

  test('detached secret has agentId cleared', async () => {
    // List secrets, attach one, detach it, then verify agentId is null
    const secretsRes = await get<{ data: Array<{ id: string }> }>(
      `/orgs/${ctx.orgId}/secrets`
    )
    if (!secretsRes.data?.data?.length) return // skip if no secrets

    const secretId = secretsRes.data.data[0].id

    // Attach then detach
    await put(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`, {
      secretIds: [secretId],
    })
    await put(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`, { secretIds: [] })

    // Re-fetch the secret — agentId should be null (reverted to org-scoped)
    const secretRes = await get<{
      data: { id: string; agentId: string | null }
    }>(`/orgs/${ctx.orgId}/secrets/${secretId}`)

    expect(secretRes.status).toBe(200)
    expect(secretRes.data.data.agentId).toBeNull()
  })

  test('GET agent includes full provider objects with name and type', async () => {
    const res = await get<{
      data: {
        id: string
        providers: Array<{ id: string; name: string; type: string }>
      }
    }>(`/orgs/${ctx.orgId}/agents/${ctx.agentId}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data.providers)).toBe(true)

    // If agent has providers, verify they have full objects (not just IDs)
    if (res.data.data.providers.length > 0) {
      const provider = res.data.data.providers[0]
      expect(provider).toHaveProperty('id')
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('type')
      expect(typeof provider.name).toBe('string')
    }
  })

  test('GET agent includes projectConfigs array', async () => {
    const res = await get<{ data: { id: string; projectConfigs: unknown[] } }>(
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data.projectConfigs)).toBe(true)
  })
})

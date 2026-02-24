import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 1: AI Sessions', () => {
  const ctx = readContext()
  let agentId = ''
  let qsResult: Record<string, any> | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      const qsRes = await post<{ data: Record<string, any> }>(
        `/orgs/${ctx.orgId}/quickstart`,
        {
          providerBrand: 'zai',
          apiKey: env.testProviderKey,
          projectName: uniqueName('Session Test Project'),
          agentName: uniqueName('Session Test Agent'),
        }
      )

      if (qsRes.status === 201 && qsRes.data?.data?.agent?.id) {
        qsResult = qsRes.data.data
        agentId = qsResult!.agent.id
      }
    }

    if (!agentId) {
      agentId = getAgentId()
    }

    if (!agentId) return

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    if (!res.ok) {
      throw new Error(
        `Agent (${agentId}) not accessible: ${res.status}\n` +
        `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
      )
    }
  })

  afterAll(async () => {
    if (!qsResult) return
    if (qsResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project?.id}/endpoints/${qsResult.endpoint.id}`)
    if (qsResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${qsResult.agent.id}`)
    if (qsResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${qsResult.project.id}`)
    if (qsResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${qsResult.secret.id}`)
    if (qsResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${qsResult.provider.id}`)
  })

  test.skipIf(!hasLLM())('POST /_/ai/sessions creates session with valid agent', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.sessionToken).toBeTruthy()
    expect(res.data.data.provider).toBeTruthy()
    expect(res.data.data.model).toBeTruthy()
  })

  test.skipIf(!hasLLM())('session response does not leak apiKey', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(res.data.data).not.toHaveProperty('apiKey')
  })

  test.skipIf(!hasLLM())('session returns expected metadata', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    const { data } = res.data
    expect(typeof data.sessionToken).toBe('string')
    expect(data.sessionToken.length).toBeGreaterThan(10)
    expect(['anthropic', 'openai', 'google', 'zai']).toContain(data.provider)
    expect(typeof data.model).toBe('string')
    expect(typeof data.maxTokens).toBe('number')
  })

  test.skipIf(!hasLLM())('session response includes tools array (when agent has tools)', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    const { data } = res.data

    // tools may be undefined/null if agent has no tools configured
    // but if present, it must be an array
    if (data.tools !== undefined && data.tools !== null) {
      expect(Array.isArray(data.tools)).toBe(true)
    }
  })

  test.skipIf(!hasLLM())('session response includes environment (when agent has environment)', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    const { data } = res.data

    // environment may be undefined/null if agent has no environment configured
    // but if present, it must be an object
    if (data.environment !== undefined && data.environment !== null) {
      expect(typeof data.environment).toBe('object')
    }
  })

  test.skipIf(!hasLLM())('session response does not leak envVars', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    const { data } = res.data

    // envVars should stay server-side — never in the response
    expect(data).not.toHaveProperty('envVars')
  })

  test.skipIf(!hasLLM())('POST /_/ai/sessions without agentId returns 400', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      {}
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test.skipIf(!hasLLM())('POST /_/ai/sessions with non-existent agentId returns 404', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      { agentId: '00000000-0000-0000-0000-000000000000' }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('POST /_/ai/sessions without auth returns 401', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      { agentId: 'any-id' },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})

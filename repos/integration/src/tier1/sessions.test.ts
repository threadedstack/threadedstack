import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

describe('Tier 1: AI Sessions', () => {
  const ctx = readContext()
  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    const timestamp = Date.now()
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerTemp: 'anthropic',
        apiKey: 'sk-test-fake-key-sessions',
        projectName: `Session Test Project ${timestamp}`,
        agentName: `Session Test Agent ${timestamp}`,
      }
    )

    if (res.status !== 201 || !res.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
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

  test('POST /_/ai/sessions creates session with valid agent', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

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

  test('session response does not leak apiKey', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(res.data.data).not.toHaveProperty('apiKey')
  })

  test('session returns expected metadata', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    const { data } = res.data
    expect(typeof data.sessionToken).toBe('string')
    expect(data.sessionToken.length).toBeGreaterThan(10)
    expect(['anthropic', 'openai', 'google']).toContain(data.provider)
    expect(typeof data.model).toBe('string')
    expect(typeof data.maxTokens).toBe('number')
  })

  test('POST /_/ai/sessions without agentId returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      {}
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /_/ai/sessions with non-existent agentId returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

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

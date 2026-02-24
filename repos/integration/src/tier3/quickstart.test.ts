import { describe, test, expect, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 3: Quickstart E2E Flow', () => {
  const ctx = readContext()
  let result: Record<string, any> = {}

  const body = {
    providerBrand: 'anthropic',
    apiKey: 'sk-test-fake-key-12345',
    projectName: uniqueName('QS Test Project'),
    agentName: uniqueName('QS Test Agent'),
  }

  afterAll(async () => {
    // Best-effort cleanup of all created resources
    if (result.endpoint?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${result.project?.id}/endpoints/${result.endpoint.id}`)
    if (result.agent?.id) await tryDelete(`/orgs/${ctx.orgId}/agents/${result.agent.id}`)
    if (result.project?.id) await tryDelete(`/orgs/${ctx.orgId}/projects/${result.project.id}`)
    if (result.secret?.id) await tryDelete(`/orgs/${ctx.orgId}/secrets/${result.secret.id}`)
    if (result.provider?.id) await tryDelete(`/orgs/${ctx.orgId}/providers/${result.provider.id}`)
  })

  test('creates 5 resources in single request', async () => {
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      body
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.provider).toBeDefined()
    expect(res.data.data.secret).toBeDefined()
    expect(res.data.data.project).toBeDefined()
    expect(res.data.data.agent).toBeDefined()
    expect(res.data.data.endpoint).toBeDefined()

    // Store for subsequent tests and cleanup
    result = res.data.data
  })

  test('provider has correct type', () => {
    expect(result.provider).toBeDefined()
    expect(result.provider.type).toBe('ai')
  })

  test('secret does not leak encryptedValue', () => {
    expect(result.secret).toBeDefined()
    expect(result.secret).not.toHaveProperty('encryptedValue')
  })

  test('endpoint path is derived from agent name', () => {
    expect(result.endpoint).toBeDefined()
    expect(result.endpoint.path).toBeDefined()
    expect(result.endpoint.path.startsWith('/ai/')).toBe(true)
  })
})

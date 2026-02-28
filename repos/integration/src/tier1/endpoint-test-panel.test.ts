import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { api, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Endpoint Test Panel API Validation
 *
 * Validates the /proxy/:projectId/:endpointId route that the
 * admin EndpointTestPanel uses to test endpoints.
 * Creates a proxy endpoint pointing to the echo service,
 * then tests GET requests, header forwarding, and error scenarios.
 */
describe('Tier 1: Endpoint Test Panel API', () => {
  const ctx = readContext()

  let proxyEpId = ''
  let setupFailed = false

  beforeAll(async () => {
    const epRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      {
        name: uniqueName('EP Test Panel Proxy'),
        path: `/test-panel-proxy-${Date.now()}`,
        type: 'proxy',
        method: 'get',
        projectId: ctx.projectId,
        options: { url: env.echoUrl },
      }
    )

    if (epRes.status !== 201 || !epRes.data?.data?.id) {
      setupFailed = true
      return
    }

    proxyEpId = epRes.data.data.id
  }, 30_000)

  afterAll(async () => {
    if (proxyEpId) {
      await tryDelete(
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${proxyEpId}`
      )
    }
  })

  // ── Proxy Route Core Flow ───────────────────────────────────

  test('GET request returns echo response with method and headers', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/${proxyEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('GET')
    expect(res.data.headers).toBeDefined()
  })

  test('custom headers are forwarded to target', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/${proxyEpId}`,
      {
        method: 'GET',
        rawPath: true,
        headers: { 'X-Test-Panel': 'custom-value' },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data.headers).toBeDefined()
    expect(res.data.headers['x-test-panel']).toBe('custom-value')
  })

  test('multiple custom headers are all forwarded', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/${proxyEpId}`,
      {
        method: 'GET',
        rawPath: true,
        headers: {
          'X-First': 'one',
          'X-Second': 'two',
        },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data.headers['x-first']).toBe('one')
    expect(res.data.headers['x-second']).toBe('two')
  })

  // ── Error Scenarios ─────────────────────────────────────────

  test('non-existent endpoint returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/zz00000000`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  test('unauthenticated request returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/${proxyEpId}`,
      { method: 'GET', rawPath: true, noAuth: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})

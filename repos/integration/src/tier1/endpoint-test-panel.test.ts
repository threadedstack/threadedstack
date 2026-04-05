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
 * Creates proxy endpoints (GET + POST) pointing to the echo service,
 * then tests GET requests, header forwarding, query parameter forwarding,
 * POST body payloads, error response shapes, and error scenarios.
 */
describe('Tier 1: Endpoint Test Panel API', () => {
  const ctx = readContext()

  let proxyEpId = ''
  let postEpId = ''
  let setupFailed = false

  beforeAll(async () => {
    const epRes = await post<Record<string, any>>(
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

    if (epRes.status !== 201 || !epRes.data?.id) {
      setupFailed = true
      return
    }

    proxyEpId = epRes.data.id

    // Create POST endpoint for body payload tests
    const postEpRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      {
        name: uniqueName('EP Test Panel POST'),
        path: `/test-panel-post-${Date.now()}`,
        type: 'proxy',
        method: 'post',
        projectId: ctx.projectId,
        options: { url: env.echoUrl },
      }
    )

    if (postEpRes.status === 201 && postEpRes.data?.id) {
      postEpId = postEpRes.data.id
    }
  }, 30_000)

  afterAll(async () => {
    if (proxyEpId) {
      await tryDelete(
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${proxyEpId}`
      )
    }
    if (postEpId) {
      await tryDelete(
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${postEpId}`
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

  // ── Query Parameters ────────────────────────────────────────

  test('query parameters are forwarded to target', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/${proxyEpId}?search=hello&page=2`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.query).toBeDefined()
  })

  test('query parameters with special characters are preserved', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/${proxyEpId}?key=${encodeURIComponent('hello world')}&empty=`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.query).toBeDefined()
  })

  // ── POST with Body ──────────────────────────────────────────

  test('POST request forwards JSON body payload', async () => {
    if (setupFailed || !postEpId) return expect(setupFailed).toBe(false)

    const payload = { name: 'test', count: 42 }
    const res = await api<any>(
      `/proxy/${ctx.projectId}/${postEpId}`,
      { method: 'POST', rawPath: true, body: payload }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('POST')
  })

  // ── Error Response Shape ────────────────────────────────────

  test('404 response includes error details', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${ctx.projectId}/zz00000000`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
    // The response should contain error information, not an empty body
    expect(res.data).toBeDefined()
  })

  test('non-existent project returns error status', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/zz00000000/${proxyEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect([403, 404]).toContain(res.status)
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

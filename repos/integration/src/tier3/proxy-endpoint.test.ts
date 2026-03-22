import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: Proxy Endpoint Execution Flow
 *
 * Tests the full lifecycle of creating a proxy-type endpoint,
 * calling it via the /proxy route, and verifying the request
 * is correctly forwarded with headers, auth, and body intact.
 *
 * Flow: quickstart → create secret → create proxy endpoints → execute via /proxy → cleanup
 *
 * The target is the proxy's /echo endpoint, which returns incoming
 * request details as JSON for verification.
 */
describe('Tier 3: Proxy Endpoint Execution Flow', () => {
  const ctx = readContext()
  const timestamp = Date.now()
  const echoUrl = env.echoUrl
  const secretPlaintext = `proxy-test-value-${timestamp}`

  let setupFailed = false
  let quickstartResult: Record<string, any> = {}
  let projectId = ''
  let secretId = ''
  let basicEpId = ''
  let postEpId = ''
  let headersEpId = ''
  let authEpId = ''
  let publicEpId = ''
  let badAuthEpId = ''

  beforeAll(async () => {
    // Step 1: Quickstart to get a project context
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        /** IGNORE THIS KEY - It is intentionally fake */
        apiKey: 'sk-test-fake-key-12345',
        projectName: uniqueName('Proxy Test Project'),
        agentName: uniqueName('Proxy Test Agent'),
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    projectId = quickstartResult.project.id

    // Step 2: Create a project-scoped secret for template injection testing
    const secretRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/secrets`,
      {
        name: `proxy-test-secret`,
        value: secretPlaintext,
        projectId,
      }
    )

    if (secretRes.status !== 201 || !secretRes.data?.data?.id) {
      setupFailed = true
      return
    }

    secretId = secretRes.data.data.id

    // Step 3: Create basic proxy endpoint
    const basicRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Basic Proxy'),
        path: `/proxy/basic-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        options: { url: echoUrl },
      }
    )

    if (basicRes.status !== 201 || !basicRes.data?.data?.id) {
      setupFailed = true
      return
    }

    basicEpId = basicRes.data.data.id

    // Step 3b: Create POST proxy endpoint for body payload tests
    const postRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Post Proxy'),
        path: `/proxy/post-${timestamp}`,
        type: 'proxy',
        method: 'post',
        projectId,
        options: { url: echoUrl },
      }
    )

    if (postRes.status !== 201 || !postRes.data?.data?.id) {
      setupFailed = true
      return
    }

    postEpId = postRes.data.data.id

    // Step 4: Create proxy endpoint with custom headers (static + secret template)
    const headersRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Headers Proxy'),
        path: `/proxy/headers-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        options: { url: echoUrl },
        headers: {
          'X-Test-Header': 'static-value',
          'X-Secret-Header': `{{proxy-test-secret:${secretId}}}`,
        },
      }
    )

    if (headersRes.status !== 201 || !headersRes.data?.data?.id) {
      setupFailed = true
      return
    }

    headersEpId = headersRes.data.data.id

    // Step 5: Create proxy endpoint with bearer auth config
    const authRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Auth Proxy'),
        path: `/proxy/auth-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        options: {
          url: echoUrl,
          auth: {
            type: 'bearer',
            secretId,
          },
        },
      }
    )

    if (authRes.status !== 201 || !authRes.data?.data?.id) {
      setupFailed = true
      return
    }

    authEpId = authRes.data.data.id

    // Step 6: Create public proxy endpoint (no auth required)
    const publicRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Public Proxy'),
        path: `/proxy/public-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        public: true,
        options: { url: echoUrl },
      }
    )

    if (publicRes.status !== 201 || !publicRes.data?.data?.id) {
      setupFailed = true
      return
    }

    publicEpId = publicRes.data.data.id

    // Step 7: Create proxy endpoint with invalid auth secretId (tests error path)
    const badAuthRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Bad Auth Proxy'),
        path: `/proxy/badauth-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        options: {
          url: echoUrl,
          auth: { type: 'bearer', secretId: 'zz00000000' },
        },
      }
    )

    if (badAuthRes.status === 201 && badAuthRes.data?.data?.id) {
      badAuthEpId = badAuthRes.data.data.id
    }
  }, 30_000)

  afterAll(async () => {
    // Delete proxy endpoints
    if (publicEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${publicEpId}`)
    if (badAuthEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${badAuthEpId}`)
    if (authEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${authEpId}`)
    if (headersEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${headersEpId}`)
    if (postEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${postEpId}`)
    if (basicEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${basicEpId}`)

    // Delete test secret
    if (secretId) await tryDelete(`/orgs/${ctx.orgId}/secrets/${secretId}`)

    // Delete quickstart resources (reverse dependency order)
    if (quickstartResult.endpoint?.id)
      await tryDelete(
        `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${quickstartResult.endpoint.id}`
      )
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  // ── Section 1: Endpoint CRUD Verification ──────────────────────────

  test('proxy endpoint exists with correct type and options', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${basicEpId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    const ep = (res.data.data ?? res.data) as Record<string, any>
    expect(ep.type).toBe('proxy')
    expect(ep.id).toBe(basicEpId)
    expect(ep.options).toBeDefined()
    expect(ep.options.url).toBe(echoUrl)
  })

  test('proxy endpoint stores custom headers', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${headersEpId}`
    )

    expect(res.status).toBe(200)
    const ep = (res.data.data ?? res.data) as Record<string, any>
    expect(ep.headers).toBeDefined()
    expect(ep.headers['X-Test-Header']).toBe('static-value')
    expect(ep.headers['X-Secret-Header']).toBe(`{{proxy-test-secret:${secretId}}}`)
  })

  test('proxy endpoint stores auth configuration', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${authEpId}`
    )

    expect(res.status).toBe(200)
    const ep = (res.data.data ?? res.data) as Record<string, any>
    expect(ep.options.auth).toBeDefined()
    expect(ep.options.auth.type).toBe('bearer')
    expect(ep.options.auth.secretId).toBe(secretId)
  })

  // ── Section 2: Basic Proxying ──────────────────────────────────────

  test('basic proxy returns 200 with echo response', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${basicEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('GET')
  })

  test('proxy handles POST request with body payload', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const payload = { greeting: 'hello', count: 42 }
    const res = await api<any>(
      `/proxy/${projectId}/${postEpId}`,
      { method: 'POST', rawPath: true, body: payload }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('POST')
  })

  test('proxy forwards query parameters', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${basicEpId}?testKey=testValue&num=123`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    // Query params should be forwarded to the echo endpoint
    expect(res.data.query).toBeDefined()
  })

  // ── Section 3: Header & Secret Injection ───────────────────────────

  test('static custom headers are forwarded to target', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${headersEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.headers).toBeDefined()
    expect(res.data.headers['x-test-header']).toBe('static-value')
  })

  test('secret template in headers is resolved (not literal {{...}})', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${headersEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.headers).toBeDefined()

    const secretHeader = res.data.headers['x-secret-header']
    expect(secretHeader).toBeDefined()
    // The template {{proxy-test-secret}} should be replaced with the actual value
    expect(secretHeader).not.toContain('{{')
    expect(secretHeader).not.toContain('}}')
  })

  test('resolved secret header matches original plaintext value', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${headersEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    const secretHeader = res.data?.headers?.['x-secret-header']
    // The decrypted secret value should match what we created
    expect(secretHeader).toBe(secretPlaintext)
  })

  // ── Section 4: Auth Injection ──────────────────────────────────────

  test('bearer auth config injects Authorization header to target', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${authEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.headers).toBeDefined()
    // ProxyService.applyAuth should inject an Authorization header
    // pointing to the echo target
    expect(res.data.headers['authorization']).toBeDefined()
  })

  test('injected auth header contains the resolved secret value', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${authEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    const authHeader = res.data?.headers?.['authorization']
    expect(authHeader).toBeDefined()
    expect(authHeader).toContain(secretPlaintext)
  })

  // ── Section 5: Access Control ──────────────────────────────────────

  test('proxy request without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${basicEpId}`,
      { method: 'GET', rawPath: true, noAuth: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('public proxy endpoint skips backend permission check', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Note: proxy-level auth still required for /proxy/* routes.
    // The public flag skips the backend permission check, not proxy auth.
    const res = await api<any>(
      `/proxy/${projectId}/${publicEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('GET')
  })

  // ── Section 6: Error Handling ──────────────────────────────────────

  test('non-existent endpoint ID returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/zz00000000`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  test('proxy with invalid auth secretId returns error (not unauthenticated pass-through)', async () => {
    if (setupFailed || !badAuthEpId) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${badAuthEpId}`,
      { method: 'GET', rawPath: true }
    )

    // applyAuth should throw, causing the proxy to reject with an error
    expect(res.ok).toBe(false)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('non-existent project ID returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/zz00000000/${basicEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect([403, 404]).toContain(res.status)
  })
})

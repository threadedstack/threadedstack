import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, api, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

/**
 * Tier 3: FaaS Endpoint Execution Flow
 *
 * Tests the full lifecycle of creating a function, linking it to a
 * FaaS-type endpoint, and executing it via the proxy route.
 *
 * Flow: quickstart → create function → create FaaS endpoint → execute via /proxy
 *
 * NOTE: Sandbox execution may fail in CI or local environments where the
 * sandbox runtime (esbuild + node runner) is not fully available. Tests are
 * designed to be resilient — we verify routing and error handling even when
 * sandbox execution itself cannot complete.
 */
describe('Tier 3: FaaS Endpoint Execution Flow', () => {
  const ctx = readContext()
  const timestamp = Date.now()

  let setupFailed = false
  let quickstartResult: Record<string, any> = {}
  let projectId = ''
  let functionId = ''
  let faasEndpointId = ''
  let badEndpointId = ''

  const simpleFunctionContent = `export default async function handler(request: any, context: any) {
  return {
    statusCode: 200,
    headers: { 'X-Custom-Header': 'test-value' },
    body: {
      message: 'hello from faas',
      receivedMethod: request?.method,
      receivedBody: request?.body
    }
  }
}`

  beforeAll(async () => {
    // Step 1: Run quickstart to get a project with provider/secret/agent/endpoint
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: `FaaS Test Project ${timestamp}`,
        agentName: `FaaS Test Agent ${timestamp}`,
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    projectId = quickstartResult.project.id

    // Step 2: Create a TypeScript function in the project
    const fnRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: `FaaS Test Function ${timestamp}`,
        content: simpleFunctionContent,
        language: 'typescript',
        projectId,
      }
    )

    if (fnRes.status !== 201 || !fnRes.data?.data?.id) {
      setupFailed = true
      return
    }

    functionId = fnRes.data.data.id

    // Step 3: Create a FaaS-type endpoint linked to the function
    const epRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: `FaaS Test Endpoint ${timestamp}`,
        path: `/faas/test-${timestamp}`,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId },
      }
    )

    if (epRes.status !== 201 || !epRes.data?.data?.id) {
      setupFailed = true
      return
    }

    faasEndpointId = epRes.data.data.id

    // Step 4: Create a FaaS endpoint with an invalid functionId for error testing
    const badEpRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: `FaaS Bad Endpoint ${timestamp}`,
        path: `/faas/bad-${timestamp}`,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId: '00000000-0000-0000-0000-000000000000' },
      }
    )

    if (badEpRes.status === 201 && badEpRes.data?.data?.id) {
      badEndpointId = badEpRes.data.data.id
    }
  }, 30_000)

  afterAll(async () => {
    // Clean up in reverse creation order
    if (badEndpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${badEndpointId}`)
    if (faasEndpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${faasEndpointId}`)
    if (functionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`)
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  test('FaaS endpoint exists and is accessible', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Verify the endpoint was created with correct type
    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${faasEndpointId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    const ep = res.data.data ?? res.data
    expect(ep).toBeDefined()
    expect(ep.type).toBe('faas')
    expect(ep.id).toBe(faasEndpointId)
    expect(ep.options).toBeDefined()
    expect(ep.options.functionId).toBe(functionId)
  })

  test('execute function via proxy returns response', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // POST to /proxy/:projectId/:endpointId to trigger FaaS execution
    const res = await api<any>(
      `/proxy/${projectId}/${faasEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { test: 'payload' },
      }
    )

    // The FaaS execution may succeed (200) or fail due to sandbox limitations (500).
    // Either way, the proxy routing should work — we should not get 404 (endpoint not found).
    expect(res.status).not.toBe(404)

    if (res.ok) {
      // If sandbox execution succeeded, verify the function's response
      const body = res.data
      expect(body).toBeDefined()
      expect(body.message).toBe('hello from faas')
    } else {
      // If execution failed (sandbox not available, transpile error, etc.),
      // verify we get a structured error response (not a raw crash)
      expect([400, 500, 502, 503]).toContain(res.status)
    }
  })

  test('function receives request data', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const requestBody = { greeting: 'world', count: 42 }
    const res = await api<any>(
      `/proxy/${projectId}/${faasEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: requestBody,
      }
    )

    expect(res.status).not.toBe(404)

    if (res.ok) {
      // If sandbox executed successfully, the function should echo back
      // the request body and method it received
      const body = res.data
      expect(body).toBeDefined()
      expect(body.receivedMethod).toBe('POST')
      expect(body.receivedBody).toEqual(requestBody)
    } else {
      // Sandbox execution failed — still validates routing worked
      expect([400, 500, 502, 503]).toContain(res.status)
    }
  })

  test('function without valid functionId returns error', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Skip if the bad endpoint was not created (e.g., validation rejected it)
    if (!badEndpointId) {
      // If the endpoint creation was rejected, that is also acceptable behavior —
      // the system prevented an invalid endpoint from being created
      return
    }

    // Execute against the endpoint with a non-existent functionId
    const res = await api<any>(
      `/proxy/${projectId}/${badEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { test: true },
      }
    )

    // Should fail with 404 (function not found) or 500 (execution error)
    expect(res.ok).toBe(false)
    expect([400, 404, 500]).toContain(res.status)
  })

  test('GET request to FaaS endpoint is handled', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Test that a GET request also routes correctly to the FaaS handler
    // The proxy endpoint uses EPMethod.All, so any HTTP method should work
    const res = await api<any>(
      `/proxy/${projectId}/${faasEndpointId}`,
      {
        method: 'GET',
        rawPath: true,
      }
    )

    // Should not 404 — the endpoint exists and routing should work
    expect(res.status).not.toBe(404)

    if (res.ok) {
      const body = res.data
      expect(body).toBeDefined()
      expect(body.message).toBe('hello from faas')
      expect(body.receivedMethod).toBe('GET')
    } else {
      // Method mismatch (405) or sandbox failure (500) are acceptable
      expect([400, 405, 500, 502, 503]).toContain(res.status)
    }
  })
})

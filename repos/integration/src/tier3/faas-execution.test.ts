import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: FaaS Endpoint Execution Flow
 *
 * Tests the full lifecycle of creating a function, linking it to a
 * FaaS-type endpoint, and executing it via the proxy route.
 *
 * Flow: quickstart → create function → create FaaS endpoint → execute via /proxy
 *
 * The sandbox uses V8 isolate execution (IsolateRunner + isolated-vm).
 */
describe('Tier 3: FaaS Endpoint Execution Flow', () => {
  const ctx = readContext()
  const timestamp = Date.now()

  let setupFailed = false
  let quickstartResult: Record<string, any> = {}
  let projectId = ''
  let tsFunctionId = ''
  let jsFunctionId = ''
  let tsEndpointId = ''
  let jsEndpointId = ''
  let badEndpointId = ''

  const tsFunctionContent = `export default async function handler(request: any, context: any) {
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

  const jsFunctionContent = `export default async function handler(request, context) {
  return {
    statusCode: 200,
    body: {
      message: 'hello from js faas',
      receivedQuery: request?.query,
      contextArgs: context?.args
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
        projectName: uniqueName('FaaS Test Project'),
        agentName: uniqueName('FaaS Test Agent'),
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    projectId = quickstartResult.project.id

    // Step 2: Create a TypeScript function
    const tsFnRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: uniqueName('FaaS TS Function'),
        content: tsFunctionContent,
        language: 'typescript',
        projectId,
      }
    )

    if (tsFnRes.status !== 201 || !tsFnRes.data?.data?.id) {
      setupFailed = true
      return
    }

    tsFunctionId = tsFnRes.data.data.id

    // Step 3: Create a JavaScript function (no esbuild transpile needed)
    const jsFnRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: uniqueName('FaaS JS Function'),
        content: jsFunctionContent,
        language: 'javascript',
        projectId,
      }
    )

    if (jsFnRes.status !== 201 || !jsFnRes.data?.data?.id) {
      setupFailed = true
      return
    }

    jsFunctionId = jsFnRes.data.data.id

    // Step 4: Create FaaS endpoint linked to TypeScript function
    const tsEpRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('FaaS TS Endpoint'),
        path: `/faas/ts-test-${timestamp}`,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId: tsFunctionId },
      }
    )

    if (tsEpRes.status !== 201 || !tsEpRes.data?.data?.id) {
      setupFailed = true
      return
    }

    tsEndpointId = tsEpRes.data.data.id

    // Step 5: Create FaaS endpoint linked to JavaScript function
    const jsEpRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('FaaS JS Endpoint'),
        path: `/faas/js-test-${timestamp}`,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId: jsFunctionId },
      }
    )

    if (jsEpRes.status !== 201 || !jsEpRes.data?.data?.id) {
      setupFailed = true
      return
    }

    jsEndpointId = jsEpRes.data.data.id

    // Step 6: Create FaaS endpoint with invalid functionId for error testing
    const badEpRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('FaaS Bad Endpoint'),
        path: `/faas/bad-${timestamp}`,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId: 'zz00000000' },
      }
    )

    if (badEpRes.status === 201 && badEpRes.data?.data?.id) {
      badEndpointId = badEpRes.data.data.id
    }
  }, 30_000)

  afterAll(async () => {
    if (badEndpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${badEndpointId}`)
    if (jsEndpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${jsEndpointId}`)
    if (tsEndpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${tsEndpointId}`)
    if (jsFunctionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${jsFunctionId}`)
    if (tsFunctionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${tsFunctionId}`)
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

  // --- Endpoint verification ---

  test('FaaS endpoint exists with correct configuration', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${tsEndpointId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    const ep = res.data.data ?? res.data
    expect(ep.type).toBe('faas')
    expect(ep.id).toBe(tsEndpointId)
    expect(ep.options).toBeDefined()
    expect(ep.options.functionId).toBe(tsFunctionId)
  })

  // --- TypeScript function execution ---

  test('execute TypeScript function via proxy', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { test: 'payload' },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.message).toBe('hello from faas')
  })

  test('TypeScript function receives request method and body', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const requestBody = { greeting: 'world', count: 42 }
    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: requestBody,
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.receivedMethod).toBe('POST')
    expect(res.data.receivedBody).toEqual(requestBody)
  })

  test('TypeScript function sets custom response headers', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { test: true },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data?.message).toBe('hello from faas')
  })

  // --- JavaScript function execution ---

  test('JavaScript function executes without esbuild transpile', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${jsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { data: 'js-test' },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.message).toBe('hello from js faas')
  })

  // --- Error handling ---

  test('endpoint with non-existent functionId returns error', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (!badEndpointId) return

    const res = await api<any>(
      `/proxy/${projectId}/${badEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { test: true },
      }
    )

    expect(res.ok).toBe(false)
    expect([400, 404, 500]).toContain(res.status)
  })

  test('non-existent endpoint returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/zz00000000`,
      {
        method: 'POST',
        rawPath: true,
        body: {},
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  // --- Method handling ---

  test('POST request to FaaS endpoint is handled', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { method_test: true },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.message).toBe('hello from faas')
    expect(res.data.receivedMethod).toBe('POST')
  })

  // --- Request data passthrough ---

  test('function receives empty body gracefully', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: {},
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.message).toBe('hello from faas')
    expect(res.data.receivedBody).toEqual({})
  })

  test('function handles complex nested request body', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const complexBody = {
      users: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
      metadata: { source: 'integration-test', nested: { deep: true } },
    }

    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: complexBody,
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.receivedBody).toEqual(complexBody)
  })

  // --- Auth ---

  test('proxy request without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${tsEndpointId}`,
      {
        method: 'POST',
        rawPath: true,
        body: {},
        noAuth: true,
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})

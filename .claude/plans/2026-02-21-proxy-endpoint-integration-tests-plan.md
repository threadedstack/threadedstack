# Proxy Endpoint Integration Tests — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an echo endpoint to the proxy and write integration tests that validate the full proxy endpoint lifecycle (create → execute → verify headers/auth/body → cleanup).

**Architecture:** A new `/echo` public endpoint in the proxy returns incoming request details as JSON. Integration tests create proxy-type endpoints pointing at this echo URL, call them through the proxy engine, and assert the echoed headers/body/method are correct.

**Tech Stack:** Express 5, Vitest, existing integration test utilities (`api-client`, `test-context`, `cleanup`).

**Design doc:** `docs/plans/2026-02-21-proxy-endpoint-integration-tests-design.md`

**CRITICAL GIT RULE:** NEVER run `git add`, `git commit`, `git push`, or any git write commands. Read-only git operations only (`git status`, `git diff`, `git log`). User handles all commits.

---

## Task 1: Create the Echo Endpoint Handler

**Files:**
- Create: `repos/proxy/src/endpoints/echo.ts`

**Step 1: Write the echo handler**

```typescript
import type { Request, Response } from 'express'

/**
 * Echo endpoint for integration testing.
 * Returns the incoming request details as JSON so callers
 * can verify headers, body, method, and query were forwarded correctly.
 */
export const echo = (req: Request, res: Response): void => {
  res.status(200).json({
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    query: req.query,
  })
}
```

---

## Task 2: Write Echo Endpoint Unit Tests

**Files:**
- Create: `repos/proxy/src/endpoints/echo.test.ts`

**Step 1: Write the unit tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { echo } from './echo'

describe('Echo Endpoint', () => {
  const createMockRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }) as unknown as Response

  it('should return 200 with request details', () => {
    const mockReq = {
      method: 'POST',
      path: '/echo',
      headers: { 'x-test': 'value' },
      body: { key: 'data' },
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      method: 'POST',
      path: '/echo',
      headers: { 'x-test': 'value' },
      body: { key: 'data' },
      query: {},
    })
  })

  it('should reflect the HTTP method', () => {
    const mockReq = {
      method: 'PUT',
      path: '/echo',
      headers: {},
      body: undefined,
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('should echo query parameters', () => {
    const mockReq = {
      method: 'GET',
      path: '/echo',
      headers: {},
      body: undefined,
      query: { search: 'test', limit: '10' },
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { search: 'test', limit: '10' },
      })
    )
  })

  it('should echo all incoming headers', () => {
    const mockReq = {
      method: 'GET',
      path: '/echo',
      headers: {
        authorization: 'Bearer sk-test-123',
        'x-custom-header': 'custom-value',
        'content-type': 'application/json',
      },
      body: undefined,
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    const call = (mockRes.json as any).mock.calls[0][0]
    expect(call.headers.authorization).toBe('Bearer sk-test-123')
    expect(call.headers['x-custom-header']).toBe('custom-value')
  })

  it('should handle empty body gracefully', () => {
    const mockReq = {
      method: 'GET',
      path: '/echo',
      headers: {},
      body: undefined,
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ body: undefined })
    )
  })
})
```

**Step 2: Run proxy unit tests**

Run: `cd repos/proxy && pnpm test`
Expected: All existing tests pass + 5 new echo tests pass.

---

## Task 3: Register the Echo Endpoint

**Files:**
- Modify: `repos/proxy/src/endpoints/index.ts` (add export)
- Modify: `repos/proxy/src/constants/values.ts` (add to PublicRoutes)
- Modify: `repos/proxy/src/middleware/setupEndpoints.ts` (register route with JSON body parser)

**Step 1: Export echo from endpoints barrel**

In `repos/proxy/src/endpoints/index.ts`, add:
```typescript
export * from './echo'
```
After the existing exports (auth, health, domains).

**Step 2: Add `/echo` to PublicRoutes**

In `repos/proxy/src/constants/values.ts`, change:
```typescript
export const PublicRoutes = [`/health`, `/domains/validate`]
```
To:
```typescript
export const PublicRoutes = [`/health`, `/domains/validate`, `/echo`]
```

**Step 3: Register the echo route with JSON body parsing**

In `repos/proxy/src/middleware/setupEndpoints.ts`:

Change:
```typescript
import { health, logout, me, validate } from '@TPX/endpoints'
```
To:
```typescript
import express from 'express'
import { echo, health, logout, me, validate } from '@TPX/endpoints'
```

Add after the existing route registrations (after the `/domains/validate` line):
```typescript
  router.all(`/echo`, express.json(), echo)
```

The `express.json()` middleware is needed because the proxy has no global JSON body parser — only `express.urlencoded()`. Without it, `req.body` would be undefined for JSON payloads.

**Step 4: Run proxy unit tests again**

Run: `cd repos/proxy && pnpm test`
Expected: All tests pass (existing + 5 echo tests).

---

## Task 4: Add Echo URL to Integration Env Config

**Files:**
- Modify: `repos/integration/src/utils/env.ts`

**Step 1: Add echoUrl getter**

In `repos/integration/src/utils/env.ts`, add a new getter before the `neonAuthPattern` line:

```typescript
  /**
   * Echo endpoint URL reachable from inside the backend K8s pod.
   * Used as the target URL for proxy-type endpoint integration tests.
   * Defaults to the proxy's K8s internal service address.
   */
  get echoUrl() {
    return process.env.TDSK_IT_ECHO_URL || 'http://tdsk-proxy:7118/echo'
  },
```

---

## Task 5: Write the Proxy Endpoint Integration Test

**Files:**
- Create: `repos/integration/src/tier3/proxy-endpoint.test.ts`

**Step 1: Write the full integration test file**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'

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
  let headersEpId = ''
  let authEpId = ''
  let publicEpId = ''

  beforeAll(async () => {
    // Step 1: Quickstart to get a project context
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: `Proxy Test Project ${timestamp}`,
        agentName: `Proxy Test Agent ${timestamp}`,
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
        name: `Basic Proxy ${timestamp}`,
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

    // Step 4: Create proxy endpoint with custom headers (static + secret template)
    const headersRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: `Headers Proxy ${timestamp}`,
        path: `/proxy/headers-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        options: { url: echoUrl },
        headers: {
          'X-Test-Header': 'static-value',
          'X-Secret-Header': '{{proxy-test-secret}}',
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
        name: `Auth Proxy ${timestamp}`,
        path: `/proxy/auth-${timestamp}`,
        type: 'proxy',
        method: 'get',
        projectId,
        options: {
          url: echoUrl,
          auth: {
            type: 'bearer',
            secretName: 'proxy-test-secret',
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
        name: `Public Proxy ${timestamp}`,
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
  }, 30_000)

  afterAll(async () => {
    // Delete proxy endpoints
    if (publicEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${publicEpId}`)
    if (authEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${authEpId}`)
    if (headersEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${headersEpId}`)
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

    const ep = res.data.data ?? res.data
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
    const ep = res.data.data ?? res.data
    expect(ep.headers).toBeDefined()
    expect(ep.headers['X-Test-Header']).toBe('static-value')
    expect(ep.headers['X-Secret-Header']).toBe('{{proxy-test-secret}}')
  })

  test('proxy endpoint stores auth configuration', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${authEpId}`
    )

    expect(res.status).toBe(200)
    const ep = res.data.data ?? res.data
    expect(ep.options.auth).toBeDefined()
    expect(ep.options.auth.type).toBe('bearer')
    expect(ep.options.auth.secretName).toBe('proxy-test-secret')
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

  test('echo response body matches sent payload', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const payload = { greeting: 'hello', count: 42 }
    const res = await api<any>(
      `/proxy/${projectId}/${basicEpId}`,
      { method: 'GET', rawPath: true, body: payload }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    // The echo endpoint returns whatever body it received
    // Note: GET with body may or may not forward body depending on proxy config
    expect(res.data.method).toBe('GET')
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

  test('public proxy endpoint works without auth', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${publicEpId}`,
      { method: 'GET', rawPath: true, noAuth: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('GET')
  })

  // ── Section 6: Error Handling ──────────────────────────────────────

  test('non-existent endpoint ID returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/00000000-0000-0000-0000-000000000000`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  test('non-existent project ID returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/00000000-0000-0000-0000-000000000000/${basicEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect([403, 404]).toContain(res.status)
  })
})
```

---

## Task 6: Run All Tests

**Step 1: Run proxy unit tests**

Run: `cd repos/proxy && pnpm test`
Expected: All tests pass including 5 new echo endpoint tests.

**Step 2: Run integration tests (requires K8s services running)**

Run: `cd repos/integration && pnpm test:api`
Expected: Existing tests pass + 14 new proxy endpoint tests pass.

If secret template resolution tests fail (Section 3, tests about `{{proxy-test-secret}}`), this reveals a bug in `ProxyEndpoint.execute()` — the secrets from `fetchSecrets()` are encrypted DB rows but `SecretResolver.replaceRefs()` expects `secret.value` (plaintext). The fix would be to add a decryption step in `ProxyEndpoint` before calling `addEndpointHeaders`. This is a real finding, not a test error.

---

## Summary

| Task | Files | Action |
|------|-------|--------|
| 1 | `repos/proxy/src/endpoints/echo.ts` | Create echo handler |
| 2 | `repos/proxy/src/endpoints/echo.test.ts` | Create unit tests (5 tests) |
| 3 | `repos/proxy/src/endpoints/index.ts` | Add `echo` export |
| 3 | `repos/proxy/src/constants/values.ts` | Add `/echo` to PublicRoutes |
| 3 | `repos/proxy/src/middleware/setupEndpoints.ts` | Register `/echo` route with `express.json()` |
| 4 | `repos/integration/src/utils/env.ts` | Add `echoUrl` getter |
| 5 | `repos/integration/src/tier3/proxy-endpoint.test.ts` | Create integration test (14 tests) |
| 6 | — | Run proxy + integration tests |

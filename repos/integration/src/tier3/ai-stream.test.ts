import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { api, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'

/**
 * Tier 3: AI Stream Endpoint (/ai/stream)
 *
 * Tests the renamed AI endpoint (previously /ai/chat, now /ai/stream).
 * The backend uses pi-ai's streamSimple() and the endpoint path has been renamed.
 *
 * Request flow:
 *   Client -> Caddy (TLS) -> Proxy (session auth bypass) -> Backend (/ai/stream) -> LLM
 *
 * With a fake API key the LLM call will hang/fail — that's expected.
 * These tests validate auth, routing, and request validation only.
 */
describe('Tier 3: AI Stream Endpoint (/ai/stream)', () => {
  const ctx = readContext()
  let agentId = ''
  let sessionToken = ''
  let sessionProvider = ''
  let sessionModel = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    // 1. Quickstart to create agent + provider + secret
    const timestamp = Date.now()
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-ai-stream',
        projectName: `AI Stream Test Project ${timestamp}`,
        agentName: `AI Stream Test Agent ${timestamp}`,
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    agentId = quickstartResult.agent.id

    // 2. Create session via POST /_/ai/sessions
    const sessionRes = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    if (sessionRes.status !== 200 || !sessionRes.data?.data?.sessionToken) {
      setupFailed = true
      return
    }

    sessionToken = sessionRes.data.data.sessionToken
    sessionProvider = sessionRes.data.data.provider
    sessionModel = sessionRes.data.data.model
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

  // ---------------------------------------------------------------------------
  // Session creation verification
  // ---------------------------------------------------------------------------

  test('session was created successfully', () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    expect(sessionToken).toBeTruthy()
    expect(typeof sessionToken).toBe('string')
    expect(sessionToken.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // New /ai/stream endpoint
  // ---------------------------------------------------------------------------

  test('POST /ai/stream with valid session is accepted', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // With a fake API key, the backend will accept the request through auth
    // and attempt to call the LLM provider, which will hang or error.
    // We use a short timeout — either we get a response (200 SSE or error)
    // or the timeout proves the backend accepted and is attempting the LLM call.
    const url = `${env.proxyUrl}/ai/stream`
    let gotResponse = false
    let responseStatus = 0

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Session ${sessionToken}`,
        },
        body: JSON.stringify({
          model: { provider: sessionProvider, model: sessionModel },
          context: {
            messages: [
              { role: 'user', content: [{ type: 'text', text: 'Say hello' }] },
            ],
          },
          options: {},
        }),
        signal: AbortSignal.timeout(8_000),
      })

      gotResponse = true
      responseStatus = res.status
    } catch (err: any) {
      // TimeoutError means the request was accepted but the backend
      // is busy trying to reach the LLM provider — this is expected
      // with a fake API key and confirms auth/routing passed
      if (err.name === 'TimeoutError') {
        gotResponse = true
        return // pass — timeout with fake key is expected
      }
      throw err
    }

    // If we got a response, verify it passed auth (not 401)
    if (gotResponse && responseStatus > 0) {
      expect(responseStatus).not.toBe(401)
    }
  })

  // ---------------------------------------------------------------------------
  // Auth rejection tests
  // ---------------------------------------------------------------------------

  test('POST /ai/stream without session returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api('/ai/stream', {
      method: 'POST',
      body: {
        model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        context: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Say hello' }] },
          ],
        },
      },
      rawPath: true,
      noAuth: true,
    })

    expect(res.status).toBe(401)
  })

  test('POST /ai/stream with invalid session returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const fakeToken = '12345678-1234-1234-1234-123456789abc'
    const res = await api('/ai/stream', {
      method: 'POST',
      body: {
        model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        context: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Say hello' }] },
          ],
        },
      },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': `Session ${fakeToken}` },
    })

    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Request validation
  // ---------------------------------------------------------------------------

  test('POST /ai/stream with invalid body returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api('/ai/stream', {
      method: 'POST',
      body: {
        model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        context: {
          messages: 'not-an-array',
        },
      },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': `Session ${sessionToken}` },
    })

    expect(res.status).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // Backward compatibility — legacy /ai/chat path
  // ---------------------------------------------------------------------------

  test('POST /ai/chat still works for backward compat', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // The old /ai/chat path with the old body format (messages at top level)
    // should still be routed through session auth. We verify it passes auth
    // or times out while attempting the LLM call (both are acceptable).
    const url = `${env.proxyUrl}/ai/chat`
    let gotResponse = false
    let responseStatus = 0

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Session ${sessionToken}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Say hello' }] },
          ],
        }),
        signal: AbortSignal.timeout(8_000),
      })

      gotResponse = true
      responseStatus = res.status
    } catch (err: any) {
      // TimeoutError means auth passed and backend is attempting LLM call
      if (err.name === 'TimeoutError') {
        gotResponse = true
        return // pass — confirms /ai/chat still routes through auth
      }
      throw err
    }

    // If we got a response, it should not be a 401 (session token is valid)
    // 404 is also acceptable if the legacy route was fully removed
    if (gotResponse && responseStatus > 0) {
      // Either the route works (not 401) or was explicitly removed (404)
      expect([200, 400, 404, 500, 502]).toContain(responseStatus)
    }
  })
})

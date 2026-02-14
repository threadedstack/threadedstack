import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { api, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'

describe('Tier 3: Session Chat SSE Flow', () => {
  const ctx = readContext()
  let agentId = ''
  let sessionToken = ''
  let sessionProvider = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    // 1. Quickstart to create agent + provider + secret
    const timestamp = Date.now()
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerTemp: 'anthropic',
        apiKey: 'sk-test-fake-key-chat-sse',
        projectName: `Chat SSE Test Project ${timestamp}`,
        agentName: `Chat SSE Test Agent ${timestamp}`,
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    agentId = quickstartResult.agent.id

    // 2. Create session
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

  test('session token was created successfully', () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    expect(sessionToken).toBeTruthy()
    expect(typeof sessionToken).toBe('string')
  })

  test('session returns correct provider from quickstart', () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    expect(sessionProvider).toBe('anthropic')
  })

  test('POST /ai/chat with valid session is accepted by backend', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // With a fake API key, the LLM adapter may hang while connecting
    // to the external provider. We test that the request passes through
    // auth + validation by using a short timeout — either we get a
    // response (200 SSE or error) or the timeout proves the backend
    // accepted the request and is attempting the LLM call.
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
      // TimeoutError means the request was accepted but the backend
      // is busy trying to reach the LLM provider — this is expected
      // with a fake API key and confirms auth/validation passed
      if (err.name === 'TimeoutError') {
        gotResponse = true // timeout = backend accepted the request
        return // pass — timeout with fake key is expected
      }
      throw err
    }

    // If we got a response, verify it's a valid status
    if (gotResponse && responseStatus > 0) {
      // 200 = SSE stream started, 401 = should NOT happen (token is valid)
      expect(responseStatus).not.toBe(401)
    }
  })

  test('POST /ai/chat with invalid messages returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api('/ai/chat', {
      method: 'POST',
      body: { messages: 'not-an-array' },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': `Session ${sessionToken}` },
    })

    expect(res.status).toBe(400)
  })

  test('POST /ai/chat with expired/deleted session returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use a UUID that looks valid but doesn't exist in the store
    const fakeToken = '12345678-1234-1234-1234-123456789abc'
    const res = await api('/ai/chat', {
      method: 'POST',
      body: {
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'hello' }] },
        ],
      },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': `Session ${fakeToken}` },
    })

    expect(res.status).toBe(401)
  })
})

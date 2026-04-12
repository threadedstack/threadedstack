import WebSocket from 'ws'
import { describe, test, expect, afterAll, beforeAll, afterEach } from 'vitest'
import { env } from '../utils/env'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { cleanupSandbox, getSessions } from '../utils/sandbox-helpers'

// ─── Inline Helpers ─────────────────────────────────────────────────

interface ShellMsg {
  type: string
  [key: string]: unknown
}

const openShell = (
  sandboxId: string,
  opts?: {
    apiKey?: string
    noAuth?: boolean
    token?: string
    cols?: number
    rows?: number
    run?: boolean
    sessionId?: string
  }
): WebSocket => {
  const params = new URLSearchParams()
  if (opts?.cols) params.set('cols', String(opts.cols))
  if (opts?.rows) params.set('rows', String(opts.rows))
  if (opts?.run) params.set('run', 'true')
  if (opts?.sessionId) params.set('sessionId', opts.sessionId)
  if (opts?.token) params.set('token', opts.token)

  const qs = params.toString()
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/_/sandboxes/${sandboxId}/shell${qs ? `?${qs}` : ''}`
  const headers: Record<string, string> = {}
  if (!opts?.noAuth && !opts?.token) {
    headers['Authorization'] = `Bearer ${opts?.apiKey ?? env.testApiKey}`
  }
  return new WebSocket(wsUrl, { headers, rejectUnauthorized: false })
}

const waitForClose = (ws: WebSocket, timeout = 10_000): Promise<{ code: number; reason: string }> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS close timeout')), timeout)
    ws.on('close', (code, reason) => {
      clearTimeout(timer)
      resolve({ code, reason: reason?.toString() || '' })
    })
  })

const waitForOpen = (ws: WebSocket, timeout = 15_000): Promise<void> =>
  new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve()
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeout)
    ws.on('open', () => { clearTimeout(timer); resolve() })
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
  })

const waitForTextMessage = (ws: WebSocket, type: string | string[], timeout = 30_000): Promise<ShellMsg> =>
  new Promise((resolve, reject) => {
    const types = Array.isArray(type) ? type : [type]
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${types.join('|')}' message`)), timeout)
    const handler = (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) return
      try {
        const msg: ShellMsg = JSON.parse(data.toString())
        if (types.includes(msg.type)) {
          clearTimeout(timer)
          ws.off('message', handler)
          resolve(msg)
        }
      } catch { /* not JSON, skip */ }
    }
    ws.on('message', handler)
  })

const waitForBinaryData = (ws: WebSocket, timeout = 15_000): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for binary data')), timeout)
    const handler = (data: Buffer | string, isBinary: boolean) => {
      if (!isBinary) return
      clearTimeout(timer)
      ws.off('message', handler)
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer))
    }
    ws.on('message', handler)
  })

// ─── Tests ──────────────────────────────────────────────────────────

describe('Tier 3: Sandbox Shell WebSocket', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
  let shellToken = ''
  let setupFailed = false

  const openConnections: WebSocket[] = []
  const trackWs = (ws: WebSocket): WebSocket => {
    openConnections.push(ws)
    return ws
  }

  beforeAll(async () => {
    try {
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('shell-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('shell-sandbox'),
          config: {
            image: env.sandboxImage,
            imagePullPolicy: 'IfNotPresent',
            runtime: 'custom',
            runtimeCommand: 'echo hello-runtime',
            ports: { '3000': { protocol: 'http' } },
            resources: {
              limits: { cpu: '500m', memory: '512Mi' },
              requests: { cpu: '100m', memory: '256Mi' },
            },
          },
          orgId: ctx.orgId,
          projectIds: [projectId],
        }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id

      // Connect starts the pod and returns shellToken
      // Call directly with projectId since connectSandbox helper doesn't pass it
      const connectRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/connect`,
        { projectId }
      )
      if (!connectRes.ok) { setupFailed = true; return }
      podName = connectRes.data.podName
      shellToken = connectRes.data.shellToken || ''
    } catch (err) {
      console.error('[sandbox-shell] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 150_000)

  afterEach(() => {
    for (const ws of openConnections) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
    openConnections.length = 0
  })

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // ─── Auth ───────────────────────────────────────────────────────────

  test('shell without auth closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId, { noAuth: true }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  test('shell with invalid API key closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId, { apiKey: 'invalid-key-xxx' }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  test('shell with invalid token closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId, { token: 'invalid-token-xxx' }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  // ─── Nonexistent ────────────────────────────────────────────────────

  test('shell for nonexistent sandbox closes with 4004', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell('nonexistent-sb-id-12345'))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4004)
  })

  // ─── Happy Path: API Key Auth ───────────────────────────────────────

  test('shell with API key receives connected or reconnected message', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)

    const msg = await waitForTextMessage(ws, ['connected', 'reconnected'])
    expect(['connected', 'reconnected']).toContain(msg.type)
    expect(msg.sessionId).toBeTruthy()
    if (msg.type === 'connected') {
      expect(msg.sandboxId).toBe(sandboxId)
      expect(msg.threadId).toBeTruthy()
    }

    ws.close()
  }, 30_000)

  // ─── Happy Path: Shell Token Auth ───────────────────────────────────

  test('shell with valid shellToken receives connected or reconnected message', async () => {
    if (setupFailed || !shellToken) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId, { token: shellToken }))
    await waitForOpen(ws)

    const msg = await waitForTextMessage(ws, ['connected', 'reconnected'])
    expect(['connected', 'reconnected']).toContain(msg.type)
    expect(msg.sessionId).toBeTruthy()

    ws.close()
  }, 30_000)

  // ─── Interactive I/O ───────────────────────────────────────────────

  test('sending binary stdin produces binary stdout', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)

    // Wait for connected or reconnected message first
    await waitForTextMessage(ws, ['connected', 'reconnected'])

    // Give shell time to initialize prompt
    await new Promise(r => setTimeout(r, 1_000))

    // Send a command via binary (stdin)
    ws.send(Buffer.from('echo shell-io-test\n'))

    // Should receive binary stdout back
    const output = await waitForBinaryData(ws, 10_000)
    expect(output.length).toBeGreaterThan(0)

    ws.close()
  }, 30_000)

  // ─── Resize ─────────────────────────────────────────────────────────

  test('sending resize control message does not error', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId, { cols: 80, rows: 24 }))
    await waitForOpen(ws)
    await waitForTextMessage(ws, ['connected', 'reconnected'])

    // Send resize as text JSON
    ws.send(JSON.stringify({ type: 'resize', rows: 40, cols: 120 }))

    // Give server time to process — if it errors, WS would close
    await new Promise(r => setTimeout(r, 1_000))

    // Still open = no error
    expect(ws.readyState).toBe(WebSocket.OPEN)

    ws.close()
  }, 30_000)

  // ─── Multi-Session ──────────────────────────────────────────────────

  test('second shell connection creates a new independent session', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // First connection
    const ws1 = trackWs(openShell(sandboxId))
    await waitForOpen(ws1)
    const msg1 = await waitForTextMessage(ws1, ['connected', 'reconnected'])
    const sessionId1 = msg1.sessionId as string
    expect(sessionId1).toBeTruthy()

    // Second connection to same sandbox (no sessionId) creates a new session
    const ws2 = trackWs(openShell(sandboxId))
    await waitForOpen(ws2)
    const msg2 = await waitForTextMessage(ws2, ['connected', 'reconnected'])
    const sessionId2 = msg2.sessionId as string
    expect(sessionId2).toBeTruthy()

    // Each connection should have a unique sessionId
    expect(sessionId2).not.toBe(sessionId1)

    ws1.close()
    ws2.close()
  }, 30_000)

  // ─── Session Reconnect ─────────────────────────────────────────────

  test('reconnecting with sessionId param returns reconnected message', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a session
    const ws1 = trackWs(openShell(sandboxId))
    await waitForOpen(ws1)
    const msg1 = await waitForTextMessage(ws1, ['connected', 'reconnected'])
    const sessionId = msg1.sessionId as string
    expect(sessionId).toBeTruthy()

    // Disconnect first connection
    ws1.close()
    await new Promise(r => setTimeout(r, 500))

    // Reconnect with the sessionId
    const ws2 = trackWs(openShell(sandboxId, { sessionId }))
    await waitForOpen(ws2)
    const msg2 = await waitForTextMessage(ws2, ['reconnected'])

    expect(msg2.type).toBe('reconnected')
    expect(msg2.sessionId).toBe(sessionId)
    expect(msg2.podOwnerUserId).toBeTruthy()

    ws2.close()
  }, 30_000)

  // ─── Connected Message Fields ──────────────────────────────────────

  test('connected message includes podOwnerUserId field', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)
    const msg = await waitForTextMessage(ws, ['connected', 'reconnected'])

    if (msg.type === 'connected') {
      expect(msg.podOwnerUserId).toBeTruthy()
      expect(typeof msg.podOwnerUserId).toBe('string')
    }

    ws.close()
  }, 30_000)

  // ─── Visibility Toggle ─────────────────────────────────────────────

  test('visibility control message toggles session visibility', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)
    const msg = await waitForTextMessage(ws, ['connected', 'reconnected'])
    const sessionId = msg.sessionId as string

    // Toggle to public
    ws.send(JSON.stringify({ type: 'visibility', visibility: 'public' }))
    const visPub = await waitForTextMessage(ws, ['visibility'])
    expect(visPub.type).toBe('visibility')
    expect(visPub.sessionId).toBe(sessionId)
    expect(visPub.visibility).toBe('public')

    // Toggle back to private
    ws.send(JSON.stringify({ type: 'visibility', visibility: 'private' }))
    const visPriv = await waitForTextMessage(ws, ['visibility'])
    expect(visPriv.type).toBe('visibility')
    expect(visPriv.sessionId).toBe(sessionId)
    expect(visPriv.visibility).toBe('private')

    ws.close()
  }, 30_000)

  // ─── Sessions Listing ──────────────────────────────────────────────

  test('sessions endpoint lists active shell sessions with visibility', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a shell session
    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)
    const msg = await waitForTextMessage(ws, ['connected', 'reconnected'])
    const sessionId = msg.sessionId as string

    // Allow session registration to propagate
    await new Promise(r => setTimeout(r, 500))

    // List sessions via REST API
    const res = await getSessions(ctx.orgId, projectId, sandboxId)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    // At least one session should exist (may have others from prior tests still cleaning up)
    const ourSession = res.data.find((s: any) => s.sessionId === sessionId)
    expect(ourSession).toBeDefined()
    expect(ourSession!.sandboxId).toBe(sandboxId)
    expect(ourSession!.visibility).toBe('private')
    expect(ourSession!.connectedAt).toBeTruthy()

    ws.close()
  }, 30_000)

  // ─── connectSandbox returns shellToken ──────────────────────────────

  test('connect endpoint returns shellToken in response', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Re-connect to the existing running pod
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/connect`,
      { projectId }
    )

    expect(res.status).toBe(200)
    expect(res.data.shellToken).toBeTruthy()
    expect(typeof res.data.shellToken).toBe('string')
  })
})

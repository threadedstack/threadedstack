import WebSocket from 'ws'
import { describe, test, expect, afterAll, beforeAll, afterEach } from 'vitest'
import { env } from '../utils/env'
import { post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { connectSandbox, cleanupSandbox } from '../utils/sandbox-helpers'

const openMonitor = (opts?: { token?: string; apiKey?: string; noAuth?: boolean }): WebSocket => {
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/_/sandboxes/monitor`

  if (opts?.token) {
    return new WebSocket(`${wsUrl}?token=${opts.token}`, { rejectUnauthorized: false })
  }

  const headers: Record<string, string> = {}
  if (!opts?.noAuth) headers['Authorization'] = `Bearer ${opts?.apiKey ?? env.testApiKey}`
  return new WebSocket(wsUrl, { headers, rejectUnauthorized: false })
}

const waitForClose = (ws: WebSocket, timeout = 10_000): Promise<{ code: number; reason: string }> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS close timeout')), timeout)
    ws.on('close', (code, reason) => {
      clearTimeout(timer)
      resolve({ code, reason: reason?.toString() || '' })
    })
    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`WS error before close: ${err.message}`))
    })
  })

const waitForOpen = (ws: WebSocket, timeout = 15_000): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeout)
    ws.on('open', () => { clearTimeout(timer); resolve() })
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
  })

const waitForMessage = (ws: WebSocket, timeout = 15_000): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS message timeout')), timeout)
    ws.once('message', (data) => {
      clearTimeout(timer)
      try {
        resolve(JSON.parse(data.toString()))
      } catch {
        reject(new Error(`Non-JSON message: ${data.toString().slice(0, 200)}`))
      }
    })
  })

const waitForSandboxMessage = (
  ws: WebSocket,
  targetSandboxId: string,
  timeout = 15_000
): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS message timeout')), timeout)
    const handler = (data: any) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.sandboxId === targetSandboxId) {
          clearTimeout(timer)
          ws.removeListener('message', handler)
          resolve(msg)
        }
      } catch {
        clearTimeout(timer)
        ws.removeListener('message', handler)
        reject(new Error(`Non-JSON message: ${data.toString().slice(0, 200)}`))
      }
    }
    ws.on('message', handler)
  })

describe('Tier 3: Sandbox Monitor WebSocket', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let instanceId = ''
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
        { name: uniqueName('monitor-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('monitor-sandbox'),
          config: {
            image: env.sandboxImage,
            imagePullPolicy: 'IfNotPresent',
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

      const connectRes = await connectSandbox(ctx.orgId, projectId, sandboxId)
      if (!connectRes.ok) { setupFailed = true; return }
      instanceId = connectRes.data.instanceId
    } catch (err) {
      console.error('[sandbox-monitor] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterEach(() => {
    for (const ws of openConnections) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
    openConnections.length = 0
  })

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, instanceId, projectId })
  })

  // ─── Monitor Token Endpoint ─────────────────────────────────────────

  test('POST monitor-token returns a valid token', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ token: string }>(
      `/orgs/${ctx.orgId}/sandboxes/monitor/token`,
      {}
    )
    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(typeof res.data.token).toBe('string')
    expect(res.data.token.length).toBeGreaterThan(10)
  })

  test('POST monitor-token without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes/monitor/token`,
      {},
      { noAuth: true }
    )
    expect(res.status).toBe(401)
  })

  // ─── WebSocket Auth ─────────────────────────────────────────────────

  test('monitor without auth closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openMonitor({ noAuth: true }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  test('monitor with invalid API key closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openMonitor({ apiKey: 'tdsk_invalid-key-xxx' }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  test('monitor with invalid token closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openMonitor({ token: 'invalid-token-xxx' }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  // ─── Happy Path: Token Auth ─────────────────────────────────────────

  test('monitor connects with valid token and receives initial sessions snapshot', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const tokenRes = await post<{ token: string }>(
      `/orgs/${ctx.orgId}/sandboxes/monitor/token`,
      {}
    )
    expect(tokenRes.ok).toBe(true)

    const ws = trackWs(openMonitor({ token: tokenRes.data.token }))
    await waitForOpen(ws)

    const msg = await waitForSandboxMessage(ws, sandboxId)
    expect(msg.type).toBe('sessions-updated')
    expect(msg.sandboxId).toBe(sandboxId)
    expect(Array.isArray(msg.sessions)).toBe(true)

    ws.close()
  }, 30_000)

  // ─── Happy Path: API Key Auth ───────────────────────────────────────

  test('monitor connects with valid API key and receives initial sessions snapshot', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openMonitor())
    await waitForOpen(ws)

    const msg = await waitForSandboxMessage(ws, sandboxId)
    expect(msg.type).toBe('sessions-updated')
    expect(msg.sandboxId).toBe(sandboxId)
    expect(Array.isArray(msg.sessions)).toBe(true)

    ws.close()
  }, 30_000)

  // ─── Permission Denied ───────────────────────────────────────────────

  test('monitor with member key connects successfully (org-level sandbox read)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (!ctx.memberApiKey) return

    const ws = trackWs(openMonitor({ apiKey: ctx.memberApiKey }))
    await waitForOpen(ws)

    const msg = await waitForMessage(ws, 10_000)
    expect(msg.type).toBe('sessions-updated')

    ws.close()
  }, 30_000)

  // ─── Session Data Shape ──────────────────────────��──────────────────

  test('initial snapshot sessions include expected fields', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openMonitor())
    await waitForOpen(ws)

    const msg = await waitForSandboxMessage(ws, sandboxId)
    expect(msg.type).toBe('sessions-updated')
    expect(Array.isArray(msg.sessions)).toBe(true)

    const sessions = msg.sessions as Array<Record<string, unknown>>
    for (const session of sessions) {
      expect(typeof session.sessionId).toBe('string')
      expect(typeof session.sandboxId).toBe('string')
      expect(typeof session.hasShellSession).toBe('boolean')
      expect(typeof session.userId).toBe('string')
      expect(typeof session.orgId).toBe('string')
      expect(typeof session.connectedAt).toBe('string')
      expect(typeof session.visibility).toBe('string')
    }

    ws.close()
  }, 30_000)

  // ─── Live Broadcast ─────────────────────────────────────────────────

  test('monitor receives sessions-updated when a shell session connects', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Open monitor and consume the initial snapshot for our sandbox
    const monitor = trackWs(openMonitor())
    await waitForOpen(monitor)
    const initial = await waitForSandboxMessage(monitor, sandboxId)
    expect(initial.type).toBe('sessions-updated')
    const initialCount = (initial.sessions as unknown[]).length

    // Open a shell session to trigger a broadcast
    const shellWsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/_/sandboxes/${sandboxId}/shell?cols=80&rows=24`
    const shell = trackWs(new WebSocket(shellWsUrl, {
      headers: { Authorization: `Bearer ${env.testApiKey}` },
      rejectUnauthorized: false,
    }))
    await waitForOpen(shell)

    // Wait for the monitor to receive the broadcast for our sandbox
    const broadcast = await waitForSandboxMessage(monitor, sandboxId, 30_000)
    expect(broadcast.type).toBe('sessions-updated')
    expect(broadcast.sandboxId).toBe(sandboxId)

    const updatedSessions = broadcast.sessions as Array<Record<string, unknown>>
    expect(updatedSessions.length).toBeGreaterThan(initialCount)

    // Verify at least one session has hasShellSession=true
    const withShell = updatedSessions.filter(s => s.hasShellSession === true)
    expect(withShell.length).toBeGreaterThanOrEqual(1)

    shell.close()
    monitor.close()
  }, 45_000)

})

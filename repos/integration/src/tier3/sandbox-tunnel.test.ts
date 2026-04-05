import WebSocket from 'ws'
import { describe, test, expect, afterAll, beforeAll, afterEach } from 'vitest'
import { post } from '../utils/api-client'
import { env } from '../utils/env'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { connectSandbox, getSessions, cleanupSandbox } from '../utils/sandbox-helpers'

// ─── Inline Helpers ─────────────────────────────────────────────────

const openTunnel = (sandboxId: string, opts?: { apiKey?: string; noAuth?: boolean }): WebSocket => {
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/_/sandboxes/${sandboxId}/tunnel`
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
  })

const waitForOpen = (ws: WebSocket, timeout = 15_000): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeout)
    ws.on('open', () => { clearTimeout(timer); resolve() })
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
  })

const waitForMessage = (ws: WebSocket, timeout = 15_000): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS message timeout')), timeout)
    ws.once('message', (data) => {
      clearTimeout(timer)
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer))
    })
  })

// ─── Tests ──────────────────────────────────────────────────────────

describe('Tier 3: Sandbox WebSocket Tunnel', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
  let setupFailed = false

  /** Track all WS connections opened during a test for afterEach cleanup */
  const openConnections: WebSocket[] = []

  const trackWs = (ws: WebSocket): WebSocket => {
    openConnections.push(ws)
    return ws
  }

  beforeAll(async () => {
    try {
      // Create project
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('tunnel-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      // Create sandbox config
      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('tunnel-sandbox'),
          config: {
            image: 'tdsk-sandbox-base:dev',
            imagePullPolicy: 'Never',
            ports: { '3000': { protocol: 'http' } },
            resources: {
              limits: { cpu: '500m', memory: '512Mi' },
              requests: { cpu: '100m', memory: '256Mi' },
            },
          },
          orgId: ctx.orgId,
          projectId,
        }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id

      // Connect — starts pod and waits for Running
      const connectRes = await connectSandbox(ctx.orgId, sandboxId)
      if (!connectRes.ok) { setupFailed = true; return }
      podName = connectRes.data.podName
    } catch (err) {
      console.error('[sandbox-tunnel] Setup failed:', (err as Error).message)
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
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // ─── Auth ───────────────────────────────────────────────────────────

  test('tunnel without auth header closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openTunnel(sandboxId, { noAuth: true }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  test('tunnel with invalid API key closes with 4001', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openTunnel(sandboxId, { apiKey: 'invalid-key-xxx' }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  // ─── Nonexistent ────────────────────────────────────────────────────

  test('tunnel for nonexistent sandbox closes with 4004', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openTunnel('nonexistent-sb-id-12345'))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4004)
  })

  // ─── Happy Path ─────────────────────────────────────────────────────

  test('tunnel connects and receives SSH banner from pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openTunnel(sandboxId))
    await waitForOpen(ws)

    const banner = await waitForMessage(ws)
    expect(banner.toString()).toMatch(/^SSH-2\.0/)

    ws.close()
  }, 30_000)

  // ─── Sessions ───────────────────────────────────────────────────────

  test('active tunnel session appears in sessions endpoint', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openTunnel(sandboxId))
    await waitForOpen(ws)

    // Wait for session registration (happens on TCP connect, slight delay)
    await new Promise(r => setTimeout(r, 1_000))

    const sessRes = await getSessions(ctx.orgId, sandboxId)
    expect(sessRes.status).toBe(200)
    expect(sessRes.ok).toBe(true)

    const sessions = sessRes.data
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBeGreaterThanOrEqual(1)

    const session = sessions[0]
    expect(session.sessionId).toBeTruthy()
    expect(session.podName).toBeTruthy()
    expect(session.connectedAt).toBeTruthy()

    ws.close()
  }, 30_000)

  test('session removed after tunnel WebSocket closes', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openTunnel(sandboxId))
    await waitForOpen(ws)
    await new Promise(r => setTimeout(r, 1_000))

    // Confirm session exists
    const before = await getSessions(ctx.orgId, sandboxId)
    const countBefore = before.data.length

    // Close the tunnel
    ws.close()
    await new Promise(r => setTimeout(r, 1_000))

    // Session should be cleaned up
    const after = await getSessions(ctx.orgId, sandboxId)
    expect(after.data.length).toBeLessThan(countBefore)
  }, 15_000)
})

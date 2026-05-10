/**
 * Tier 3 integration tests: Sandbox Shell Session — GUI pipeline
 *
 * Validates the backend WebSocket shell endpoint after Task 21's
 * simplification (parser/interpreter removed; raw binary passthrough only).
 *
 * What we test:
 *   1. Shell WebSocket connects and receives `connected` JSON message with
 *      sessionId, threadId, and runtime fields.
 *   2. Shell produces raw binary output (PTY data — not JSON event frames).
 *   3. Binary stdin (echo command) is relayed and produces binary stdout.
 *   4. Resize control message is accepted without closing the connection.
 *   5. `connect` endpoint returns a shellToken suitable for browser auth.
 *   6. Shell token auth (browser flow) works alongside API key auth (CLI flow).
 *
 * Prerequisites:
 *   - K8s services running (`tdsk dev start --clean`)
 *   - Integration global setup has written context.json
 */

import WebSocket from 'ws'
import { describe, test, expect, afterAll, beforeAll, afterEach } from 'vitest'
import { env } from '../utils/env'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { cleanupSandbox } from '../utils/sandbox-helpers'

// ─── WebSocket helpers ───────────────────────────────────────────────────────

interface ShellJsonMsg {
  type: string
  sessionId?: string
  threadId?: string
  runtime?: string
  sandboxId?: string
  podOwnerUserId?: string
  [key: string]: unknown
}

/**
 * Open a WebSocket connection to the shell endpoint.
 * Supports both API key auth (Authorization header) and shell token auth (?token).
 */
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
  if (opts?.cols != null) params.set('cols', String(opts.cols))
  if (opts?.rows != null) params.set('rows', String(opts.rows))
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

const waitForOpen = (ws: WebSocket, timeout = 20_000): Promise<void> =>
  new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve()
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeout)
    ws.on('open', () => { clearTimeout(timer); resolve() })
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
  })

/**
 * Wait for a JSON text message of the specified type(s).
 * Binary frames are silently skipped.
 */
const waitForJsonMessage = (
  ws: WebSocket,
  types: string | string[],
  timeout = 30_000
): Promise<ShellJsonMsg> =>
  new Promise((resolve, reject) => {
    const wanted = Array.isArray(types) ? types : [types]
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for message type '${wanted.join('|')}'`)),
      timeout
    )
    const handler = (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) return
      try {
        const msg = JSON.parse(data.toString()) as ShellJsonMsg
        if (wanted.includes(msg.type)) {
          clearTimeout(timer)
          ws.off('message', handler)
          resolve(msg)
        }
      } catch {
        // Not valid JSON — skip
      }
    }
    ws.on('message', handler)
  })

/**
 * Wait for at least one binary frame.
 * Text (JSON) frames are ignored.
 */
const waitForBinaryFrame = (ws: WebSocket, timeout = 20_000): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timeout waiting for binary frame')),
      timeout
    )
    const handler = (data: Buffer | string, isBinary: boolean) => {
      if (!isBinary) return
      clearTimeout(timer)
      ws.off('message', handler)
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer))
    }
    ws.on('message', handler)
  })

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Tier 3: Sandbox Shell Session (GUI pipeline)', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
  let shellToken = ''
  let setupFailed = false

  /** All WS connections opened in a test — closed in afterEach */
  const openConnections: WebSocket[] = []
  const trackWs = (ws: WebSocket): WebSocket => {
    openConnections.push(ws)
    return ws
  }

  beforeAll(async () => {
    try {
      // Create a dedicated project for these tests
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('gui-shell-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) {
        console.error('[sandbox-shell-gui] Failed to create project:', projRes.status)
        setupFailed = true
        return
      }
      projectId = projRes.data.id

      // Create a sandbox config linked to the project
      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('gui-shell-sandbox'),
          config: {
            image: env.sandboxImage,
            imagePullPolicy: 'IfNotPresent',
            runtime: 'custom',
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
      if (!sbRes.ok) {
        console.error('[sandbox-shell-gui] Failed to create sandbox:', sbRes.status)
        setupFailed = true
        return
      }
      sandboxId = sbRes.data.id

      const connectRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/connect`,
        {},
        { timeout: 130_000 }
      )
      if (!connectRes.ok) {
        console.error('[sandbox-shell-gui] Failed to connect sandbox:', connectRes.status, (connectRes as any).error)
        setupFailed = true
        return
      }
      podName = connectRes.data.podName
      shellToken = connectRes.data.shellToken || ''
    } catch (err) {
      console.error('[sandbox-shell-gui] Setup error:', (err as Error).message)
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

  // ─── 1. Connected message fields ─────────────────────────────────────────

  test('receives connected JSON message with sessionId, threadId, and runtime', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)

    const msg = await waitForJsonMessage(ws, ['connected', 'reconnected'])

    expect(['connected', 'reconnected']).toContain(msg.type)
    expect(typeof msg.sessionId).toBe('string')
    expect((msg.sessionId as string).length).toBeGreaterThan(0)

    if (msg.type === 'connected') {
      // Fresh session — all fields must be present
      expect(typeof msg.threadId).toBe('string')
      expect((msg.threadId as string).length).toBeGreaterThan(0)
      expect(typeof msg.runtime).toBe('string')
      expect(msg.sandboxId).toBe(sandboxId)
      expect(typeof msg.podOwnerUserId).toBe('string')
    }

    ws.close()
  }, 40_000)

  // ─── 2. Binary terminal output ───────────────────────────────────────────

  test('receives raw binary terminal output (not JSON events) after connection', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)

    // Wait for the connected handshake first
    await waitForJsonMessage(ws, ['connected', 'reconnected'])

    // The PTY (bash prompt, MOTD, etc.) should produce binary frames
    const frame = await waitForBinaryFrame(ws)

    expect(Buffer.isBuffer(frame)).toBe(true)
    expect(frame.length).toBeGreaterThan(0)

    ws.close()
  }, 40_000)

  // ─── 3. Binary stdin → binary stdout ────────────────────────────────────

  test('echoes binary stdin command back as binary stdout', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId))
    await waitForOpen(ws)
    await waitForJsonMessage(ws, ['connected', 'reconnected'])

    // Allow bash prompt to fully initialise before sending input
    await new Promise(r => setTimeout(r, 1_500))

    // Send a uniquely-identifiable echo command as binary stdin
    const marker = `gui-pipeline-test-${Date.now()}`
    ws.send(Buffer.from(`echo ${marker}\n`))

    // Collect binary output until we see our marker string or timeout
    const received: string[] = []
    const found = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 15_000)
      const handler = (data: Buffer | string, isBinary: boolean) => {
        if (!isBinary) return
        const text = (Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer)).toString()
        received.push(text)
        if (received.join('').includes(marker)) {
          clearTimeout(timer)
          ws.off('message', handler)
          resolve(true)
        }
      }
      ws.on('message', handler)
    })

    expect(found).toBe(true)
    ws.close()
  }, 40_000)

  // ─── 4. Resize control message ───────────────────────────────────────────

  test('accepts resize control message without closing or erroring', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const ws = trackWs(openShell(sandboxId, { cols: 80, rows: 24 }))
    await waitForOpen(ws)
    await waitForJsonMessage(ws, ['connected', 'reconnected'])

    // Send resize as a JSON text frame (the control message protocol)
    ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }))

    // Give the server time to process — if it errors the socket would close
    await new Promise(r => setTimeout(r, 1_000))

    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  }, 40_000)

  // ─── 5. Shell token auth (browser flow) ─────────────────────────────────

  test('shell token returned by connect endpoint authenticates the WebSocket', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (!shellToken) return expect(shellToken).toBeTruthy()

    // Open shell using shell token (query param — the browser flow)
    const ws = trackWs(openShell(sandboxId, { token: shellToken }))
    await waitForOpen(ws)

    const msg = await waitForJsonMessage(ws, ['connected', 'reconnected'])
    expect(['connected', 'reconnected']).toContain(msg.type)
    expect(typeof msg.sessionId).toBe('string')
    expect((msg.sessionId as string).length).toBeGreaterThan(0)

    ws.close()
  }, 40_000)

  // ─── 6. connect endpoint returns shellToken field ────────────────────────

  test('connect endpoint response includes shellToken string', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Re-connect to the already-running pod — must specify podName for multi-instance support
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/connect`,
      { podName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(typeof res.data.shellToken).toBe('string')
    expect(res.data.shellToken.length).toBeGreaterThan(0)
    expect(typeof res.data.podName).toBe('string')
  })
})

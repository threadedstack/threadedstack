import WebSocket from 'ws'
import { describe, test, expect, afterAll, beforeAll, afterEach } from 'vitest'
import { env } from '../utils/env'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { connectSandbox, cleanupSandbox } from '../utils/sandbox-helpers'

// ─── Inline Helpers ─────────────────────────────────────────────────

const openTunnel = (
  sandboxId: string,
  opts?: { apiKey?: string; noAuth?: boolean }
): WebSocket => {
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/_/sandboxes/${sandboxId}/tunnel`
  const headers: Record<string, string> = {}
  if (!opts?.noAuth) headers['Authorization'] = `Bearer ${opts?.apiKey ?? env.testApiKey}`
  return new WebSocket(wsUrl, { headers, rejectUnauthorized: false })
}

const waitForClose = (
  ws: WebSocket,
  timeout = 10_000
): Promise<{ code: number; reason: string }> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS close timeout')), timeout)
    ws.on('close', (code, reason) => {
      clearTimeout(timer)
      resolve({ code, reason: reason?.toString() || '' })
    })
  })

const waitForOpen = (
  ws: WebSocket,
  timeout = 15_000
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeout)
    ws.on('open', () => {
      clearTimeout(timer)
      resolve()
    })
    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
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

describe('Tier 3: Tunnel Rate Guard', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
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
        { name: uniqueName('ratelimit-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) {
        setupFailed = true
        return
      }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('ratelimit-sandbox'),
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
          projectId,
        }
      )
      if (!sbRes.ok) {
        setupFailed = true
        return
      }
      sandboxId = sbRes.data.id

      const connectRes = await connectSandbox(ctx.orgId, projectId, sandboxId)
      if (!connectRes.ok) {
        setupFailed = true
        return
      }
      podName = connectRes.data.podName
    } catch (err) {
      console.error('[sandbox-tunnel-ratelimit] Setup failed:', (err as Error).message)
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

  // ─── Rate Guard: Nonexistent Sandbox ─────────────────────────────

  test('rate guard blocks after rapid failures for nonexistent sandbox', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const fakeSandboxId = 'sb_ratelimit_fake_12345'

    // Open 5 rapid connections to a nonexistent sandbox — each closes with 4004
    // and records a failure in the rate guard
    for (let i = 0; i < 5; i++) {
      const ws = openTunnel(fakeSandboxId)
      const { code } = await waitForClose(ws)
      expect(code).toBe(4004)
    }

    // 6th connection should be rate-limited with 4008
    const ws = trackWs(openTunnel(fakeSandboxId))
    const { code, reason } = await waitForClose(ws)
    expect(code).toBe(4008)
    expect(reason).toContain('Too many failed connections')
  }, 30_000)

  // ─── Rate Guard: Invalid Auth ────────────────────────────────────

  test('rate guard blocks after rapid auth failures', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use a unique sandbox ID to avoid cross-test interference with the rate guard
    const targetId = 'sb_ratelimit_auth_67890'

    // Open 5 rapid connections with bad credentials — each closes with 4001
    for (let i = 0; i < 5; i++) {
      const ws = openTunnel(targetId, { apiKey: 'invalid-key-ratelimit-test' })
      const { code } = await waitForClose(ws)
      expect(code).toBe(4001)
    }

    // 6th connection should be rate-limited with 4008
    const ws = trackWs(openTunnel(targetId, { apiKey: 'invalid-key-ratelimit-test' }))
    const { code } = await waitForClose(ws)
    expect(code).toBe(4008)
  }, 30_000)

  // ─── Rate Guard: Does Not Affect Valid Connections ────────────────

  test('rate guard does not block valid tunnel connections', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Open a valid tunnel — should succeed and receive SSH banner
    const ws = trackWs(openTunnel(sandboxId))
    await waitForOpen(ws)

    const banner = await waitForMessage(ws)
    expect(banner.toString()).toMatch(/^SSH-2\.0/)

    ws.close()
  }, 30_000)

  // ─── Rate Guard: Sandbox Isolation ────────────────────────────────

  test('rate guard for one sandbox does not affect another', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const blockedId = 'sb_ratelimit_isolated_aaa'

    // Trigger rate limit on one sandbox ID
    for (let i = 0; i < 5; i++) {
      const ws = openTunnel(blockedId)
      await waitForClose(ws)
    }

    // Verify it's blocked
    const blocked = trackWs(openTunnel(blockedId))
    const { code: blockedCode } = await waitForClose(blocked)
    expect(blockedCode).toBe(4008)

    // The real sandbox should still work fine
    const valid = trackWs(openTunnel(sandboxId))
    await waitForOpen(valid)

    const banner = await waitForMessage(valid)
    expect(banner.toString()).toMatch(/^SSH-2\.0/)

    valid.close()
  }, 30_000)
})

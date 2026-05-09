import https from 'node:https'
import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { api, post } from '../utils/api-client'
import { env } from '../utils/env'
import { readContext } from '../utils/test-context'
import { consumeWS } from '../utils/ws-client'
import { cleanupThread, extractThreadId } from '../utils/tsa-cleanup'
import {
  setupRunningPod,
  execInPod,
  cleanupSandbox,
  getPodSubdomain,
  waitForPodState,
} from '../utils/sandbox-helpers'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 3: Sandbox Route Map Cleanup
 *
 * Validates that the backend's in-memory route map and proxy cache are
 * properly cleaned up when pods are stopped or transition to terminal phases.
 *
 * Without cleanup, stale routes cause:
 * - Subdomain requests proxy to dead pod IPs (EHOSTUNREACH / timeouts)
 * - Leaked proxy upgrade listeners intercept unrelated WebSocket connections
 *
 * Flow:
 * 1. Start pod with HTTP server → subdomain route works (200)
 * 2. Stop pod → subdomain returns 404 (route cleaned up, not stale timeout)
 * 3. Verify WS /ai/ws still works after stale routes are gone
 */
describe('Tier 3: Sandbox Route Map Cleanup', () => {
  const ctx = readContext()

  let sandboxId = ''
  let podName = ''
  let projectId = ''
  let subdomain = ''
  let setupFailed = false

  const sandboxConfig = {
    image: 'node:22-slim',
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '512Mi' },
      requests: { cpu: '100m', memory: '256Mi' },
    },
  }

  const serverScript = [
    `const http = require('http');`,
    `http.createServer((req, res) => {`,
    `  res.writeHead(200, { 'Content-Type': 'application/json' });`,
    `  res.end(JSON.stringify({ ok: true, path: req.url }));`,
    `}).listen(3000);`,
  ].join(' ')

  const fetchViaSandboxProxy = (
    hostname: string,
    path = '/',
  ): Promise<{ status: number; body: string }> => {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: '127.0.0.1',
          port: 443,
          path,
          method: 'GET',
          servername: hostname,
          rejectUnauthorized: false,
          timeout: 10_000,
          headers: {
            Host: hostname,
            Authorization: `Bearer ${env.testApiKey}`,
          },
        },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
        },
      )
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      req.end()
    })
  }

  beforeAll(async () => {
    try {
      const setup = await setupRunningPod(ctx.orgId)
      sandboxId = setup.sandboxId
      podName = setup.podName
      projectId = setup.projectId

      subdomain = getPodSubdomain(podName) || ''
      if (!subdomain) throw new Error('Pod subdomain not found in annotations')

      // Write and start HTTP server in the pod
      const escaped = serverScript.replace(/'/g, "'\\''").trim()
      await execInPod(ctx.orgId, projectId, sandboxId, podName, `printf '%s' '${escaped}' > /workspace/server.js`)
      await execInPod(ctx.orgId, projectId, sandboxId, podName, "sh -c 'nohup node /workspace/server.js > /dev/null 2>&1 &'")

      // Wait for the K8s watcher to hydrate the route and the pod server to start
      const routeHostname = `3000--${subdomain}.local.threadedstack.app`
      const start = Date.now()
      while (Date.now() - start < 30_000) {
        try {
          const probe = await fetchViaSandboxProxy(routeHostname)
          if (probe.status === 200) break
        } catch { /* route not ready yet */ }
        await new Promise(r => setTimeout(r, 2_000))
      }
    } catch (err) {
      console.error('[sandbox-route-cleanup] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // --- Pre-condition: route works while pod is Running ---

  test('subdomain route works while pod is Running', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const hostname = `3000--${subdomain}.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname)

    expect(result.status).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.ok).toBe(true)
  }, 15_000)

  // --- Stop pod and verify route cleanup ---

  test('stopping pod removes the subdomain route', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Stop the pod
    const stopRes = await api(`/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`, {
      method: 'DELETE',
      body: { podName },
    })
    expect(stopRes.status).toBe(200)

    // Wait for pod to reach terminal state so the watch event fires
    await waitForPodState(ctx.orgId, projectId, sandboxId, podName, 'Failed', 60_000)

    // Give the K8s watcher time to process the MODIFIED/DELETED events
    await new Promise(r => setTimeout(r, 3_000))

    // Route should be cleaned up — expect 404, NOT a timeout/502 from stale proxy
    const hostname = `3000--${subdomain}.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname)

    expect(result.status).toBe(404)

    // Clear podName so afterAll doesn't try to stop it again
    podName = ''
  }, 90_000)

  // --- Verify no stale routes interfere with WS agent streaming ---

  test('WS /ai/ws streams LLM response after pod route cleanup', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (!env.testProviderKey) return

    // Create a fresh agent with a real provider key via setupFixtures.
    // We can't use pre-configured testAgentId/testZaiAgentId because their
    // provider secrets may have been cleaned up by other tests.
    const fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'zai',
      apiKey: env.testProviderKey,
      projectName: uniqueName('route-cleanup-ws'),
      agentName: uniqueName('route-cleanup-ws-agent'),
    })
    expect(fixtures.provider).toBeDefined()
    const agentId = fixtures.agent!.id
    let wsThreadId: string | null = null

    try {
      // Create a session
      const sessionRes = await post<{ sessionToken: string }>(
        `/_/ai/sessions`,
        { agentId }
      )
      expect(sessionRes.status).toBe(200)
      const token = sessionRes.data.sessionToken
      expect(token).toBeTruthy()

      // Send a real prompt through the WS and verify the agent streams back data.
      // This is the exact flow that broke when stale proxy upgrade listeners
      // intercepted the /ai/ws upgrade and proxied it to dead pod IPs.
      const result = await consumeWS(token, 'Respond with exactly: ROUTE_CLEANUP_OK', {
        timeout: 60_000,
      })
      wsThreadId = extractThreadId(result)

      // Connection should NOT have been hijacked by a stale proxy
      expect(result.closeCode).not.toBe(-2) // no connection error
      expect(result.closeCode).not.toBe(4001) // no auth rejection from stale proxy

      // Must have received actual messages — text_delta or done at minimum
      expect(result.messages.length).toBeGreaterThanOrEqual(1)

      const doneMsg = result.messages.find(m => m.type === 'done')
      expect(doneMsg).toBeDefined()

      // If the agent streamed text, verify it came through
      const textDeltas = result.messages.filter(m => m.type === 'text_delta')
      if (textDeltas.length > 0) {
        const content = textDeltas.map(m => m.delta).join('')
        expect(content.length).toBeGreaterThan(0)
      }
    } finally {
      if (wsThreadId && agentId) await cleanupThread(ctx.orgId, agentId, wsThreadId)
      await cleanupFixtures(ctx.orgId, fixtures)
    }
  }, 90_000)

  // --- Verify a new pod gets a fresh route ---

  test('starting a new pod creates a fresh route without stale interference', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Start a new pod for the same sandbox
    const startRes = await post<{ podName: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/start`,
      {}
    )
    expect(startRes.status).toBe(201)
    const newPodName = startRes.data.podName

    try {
      await waitForPodState(ctx.orgId, projectId, sandboxId, newPodName, 'Running', 90_000)

      const newSubdomain = getPodSubdomain(newPodName) || ''
      expect(newSubdomain).toBeTruthy()

      // Old subdomain should still be 404
      const oldHostname = `3000--${subdomain}.local.threadedstack.app`
      const oldResult = await fetchViaSandboxProxy(oldHostname)
      expect(oldResult.status).toBe(404)

      // New subdomain should route correctly once server starts
      // (We don't start a server — just verify the route map entry exists
      //  by checking we get a 502 instead of 404; 502 means route exists but pod server isn't listening)
      const newHostname = `3000--${newSubdomain}.local.threadedstack.app`
      const start = Date.now()
      let newStatus = 0
      while (Date.now() - start < 15_000) {
        try {
          const probe = await fetchViaSandboxProxy(newHostname)
          newStatus = probe.status
          if (newStatus !== 404) break
        } catch { /* route not ready yet */ }
        await new Promise(r => setTimeout(r, 2_000))
      }
      // 502 (route exists, no server) or 200 (unlikely without starting server)
      // The key assertion: NOT 404 (which would mean the route wasn't created)
      expect(newStatus).not.toBe(404)
    } finally {
      // Cleanup the new pod
      podName = newPodName
    }
  }, 120_000)
})

import https from 'node:https'
import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { env } from '../utils/env'
import {
  setupRunningPod,
  execInPod,
  cleanupSandbox,
  getPodSubdomain,
} from '../utils/sandbox-helpers'

/**
 * Tier 3: Sandbox Proxy (Subdomain Routing)
 *
 * Verifies the full subdomain routing pipeline:
 *   Client → Caddy (TLS *.local.threadedstack.app) → Proxy (auth) → Backend (sandboxProxy) → Pod IP:port
 *
 * An HTTP server is started inside the pod on port 3000. Requests to
 * `3000--<subdomain>.local.threadedstack.app` are routed through Caddy to the pod.
 *
 * The flat format (`3000--sb-xxxx` in a single DNS label) ensures the hostname
 * matches Caddy's `*.local.threadedstack.app` single-level wildcard.
 *
 * Since /etc/hosts doesn't support wildcards, requests connect to 127.0.0.1:443
 * with explicit SNI + Host header.
 */
describe('Tier 3: Sandbox Proxy Routing', () => {
  const ctx = readContext()

  let sandboxId = ''
  let podName = ''
  let projectId = ''
  let subdomain = ''
  let setupFailed = false

  const serverScript = `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Sandbox-Pod': process.env.HOSTNAME || 'unknown',
  });
  res.end(JSON.stringify({ message: 'hello-from-sandbox-pod', path: req.url }));
});
server.listen(3000, () => {
  console.log('Server listening on 3000');
});
`

  /**
   * Make an HTTPS request through Caddy's wildcard TLS to a sandbox subdomain.
   * Connects to 127.0.0.1:443 with explicit SNI and Host header since
   * /etc/hosts doesn't support wildcards.
   */
  const fetchViaSandboxProxy = (
    hostname: string,
    path = '/',
    opts?: { noAuth?: boolean }
  ): Promise<{ status: number; headers: Record<string, string>; body: string }> => {
    return new Promise((resolve, reject) => {
      const reqOpts: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: 443,
        path,
        method: 'GET',
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 15_000,
        headers: {
          Host: hostname,
          ...(!opts?.noAuth && env.testApiKey
            ? { Authorization: `Bearer ${env.testApiKey}` }
            : {}),
        },
      }

      const req = https.request(reqOpts, (res) => {
        let data = ''
        res.on('data', (c) => data += c)
        res.on('end', () => {
          const headers: Record<string, string> = {}
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') headers[k] = v
          }
          resolve({ status: res.statusCode || 0, headers, body: data })
        })
      })

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

      // Get subdomain from pod annotations
      subdomain = getPodSubdomain(podName) || ''
      if (!subdomain) throw new Error('Pod subdomain not found in annotations')

      // Write HTTP server script to pod and start it in background
      const escaped = serverScript.replace(/'/g, "'\\''").trim()
      await execInPod(ctx.orgId, sandboxId, podName,
        `printf '%s' '${escaped}' > /workspace/server.js`
      )

      // Start server in background (nohup + &)
      await execInPod(ctx.orgId, sandboxId, podName,
        "sh -c 'nohup node /workspace/server.js > /dev/null 2>&1 &'"
      )

      // Wait for server to start listening
      await new Promise(r => setTimeout(r, 2_000))

      // Verify server is running inside the pod
      const verifyScript = [
        "const http = require('http');",
        "http.get('http://127.0.0.1:3000/', { timeout: 5000 }, (res) => {",
        "  let d = '';",
        "  res.on('data', (c) => d += c);",
        "  res.on('end', () => console.log(res.statusCode));",
        "}).on('error', (e) => { console.error(e.message); process.exit(1); });",
      ].join(' ')

      const verifyRes = await execInPod(ctx.orgId, sandboxId, podName,
        `node -e "${verifyScript}"`
      )
      if (!verifyRes.data.success || verifyRes.data.output.trim() !== '200') {
        throw new Error(`Pod HTTP server not responding: ${verifyRes.data.output || verifyRes.data.error}`)
      }

      // Wait for the K8s watcher to hydrate the route map in the backend.
      // The pod is Running but the watcher MODIFIED event may not have fired yet.
      const routeHostname = `3000--${subdomain}.local.threadedstack.app`
      let lastProbeBody = ''
      const routeStart = Date.now()
      while (Date.now() - routeStart < 30_000) {
        try {
          const probe = await fetchViaSandboxProxy(routeHostname)
          lastProbeBody = probe.body
          if (probe.status === 200) break
        } catch { /* connection errors are expected while route isn't ready */ }
        await new Promise(r => setTimeout(r, 2_000))
      }
    } catch (err) {
      console.error('[sandbox-proxy-routing] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // --- Subdomain Routing ---

  test('request to 3000--<subdomain>.local.threadedstack.app returns pod response', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const hostname = `3000--${subdomain}.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname)

    expect(result.status).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.message).toBe('hello-from-sandbox-pod')
    expect(body.path).toBe('/')
  }, 30_000)

  test('response includes X-Sandbox-Pod header from pod server', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const hostname = `3000--${subdomain}.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname, '/test-path')

    expect(result.status).toBe(200)
    expect(result.headers['x-sandbox-pod']).toBeDefined()

    const body = JSON.parse(result.body)
    expect(body.path).toBe('/test-path')
  }, 30_000)

  // --- Error Cases ---

  test('request to undeclared port returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const hostname = `9999--${subdomain}.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname)

    expect(result.status).toBe(404)
  }, 30_000)

  test('request to nonexistent subdomain returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const hostname = `3000--sb-nonexistent-xyz.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname)

    expect(result.status).toBe(404)
  }, 30_000)

  test('request without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const hostname = `3000--${subdomain}.local.threadedstack.app`
    const result = await fetchViaSandboxProxy(hostname, '/', { noAuth: true })

    expect(result.status).toBe(401)
  }, 30_000)
})

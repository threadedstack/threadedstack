import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { setupRunningPod, execInPod, cleanupSandbox } from '../utils/sandbox-helpers'

describe('Tier 3: Sandbox Egress Connectivity', () => {
  const ctx = readContext()

  let sandboxId = ''
  let podName = ''
  let projectId = ''
  let setupFailed = false

  beforeAll(async () => {
    try {
      const setup = await setupRunningPod(ctx.orgId)
      sandboxId = setup.sandboxId
      podName = setup.podName
      projectId = setup.projectId
    } catch (err) {
      console.error('[sandbox-egress] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // --- DNS Resolution ---

  test('DNS resolution works inside pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const script = [
      "const dns = require('dns');",
      "dns.resolve('example.com', (err, addrs) => {",
      "  if (err) { console.error(err.message); process.exit(1); }",
      "  console.log(JSON.stringify(addrs));",
      "});"
    ].join(' ')

    const res = await execInPod(
      ctx.orgId, sandboxId, podName,
      `node -e "${script}"`
    )

    expect(res.data.data.success).toBe(true)
    const addrs = JSON.parse(res.data.data.output.trim())
    expect(Array.isArray(addrs)).toBe(true)
    expect(addrs.length).toBeGreaterThan(0)
  }, 30_000)

  test('cluster DNS resolves internal services', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // dns.lookup() uses getaddrinfo() which honors /etc/resolv.conf search domains
    // dns.resolve() uses c-ares which does NOT, so short K8s service names would fail
    const script = [
      "const dns = require('dns');",
      "dns.lookup('tdsk-backend', { all: true }, (err, addrs) => {",
      "  if (err) { console.error(err.message); process.exit(1); }",
      "  console.log(JSON.stringify(addrs));",
      "});"
    ].join(' ')

    const res = await execInPod(
      ctx.orgId, sandboxId, podName,
      `node -e "${script}"`
    )

    expect(res.data.data.success).toBe(true)
    const addrs = JSON.parse(res.data.data.output.trim())
    expect(Array.isArray(addrs)).toBe(true)
    expect(addrs.length).toBeGreaterThan(0)
  }, 30_000)

  // --- Internal Cluster Connectivity ---

  test('pod can reach backend egress proxy (NetworkPolicy allows port 8889)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // NetworkPolicy only allows sandbox pods to reach backend on port 8889 (egress proxy)
    // Verify TCP connectivity by opening a socket to the egress proxy port
    const script = [
      "const net = require('net');",
      "const dns = require('dns');",
      "dns.lookup('tdsk-backend', (err, addr) => {",
      "  if (err) { console.error(err.message); process.exit(1); }",
      "  const sock = net.connect({ host: addr, port: 8889, timeout: 10000 }, () => {",
      "    console.log('connected'); sock.destroy();",
      "  });",
      "  sock.on('error', (e) => { console.error(e.message); process.exit(1); });",
      "});"
    ].join(' ')

    const res = await execInPod(
      ctx.orgId, sandboxId, podName,
      `node -e "${script}"`
    )

    expect(res.data.data.success).toBe(true)
    expect(res.data.data.output.trim()).toBe('connected')
  }, 30_000)

  // --- HTTP Egress Through Proxy ---

  test('outbound HTTP on port 80 works (iptables DNAT to egress proxy)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const script = [
      "const http = require('http');",
      "const req = http.get('http://example.com', { timeout: 15000 }, (res) => {",
      "  let data = '';",
      "  res.on('data', (c) => data += c);",
      "  res.on('end', () => { console.log(res.statusCode); });",
      "});",
      "req.on('error', (e) => { console.error(e.message); process.exit(1); });",
    ].join(' ')

    const escaped = script.replace(/'/g, "'\\''")
    await execInPod(ctx.orgId, sandboxId, podName,
      `printf '%s' '${escaped}' > /tmp/test-http-egress.js`
    )

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'node /tmp/test-http-egress.js'
    )

    expect(res.data.data.success).toBe(true)
    const statusCode = parseInt(res.data.data.output.trim(), 10)
    expect([200, 301]).toContain(statusCode)
  }, 30_000)

  // --- HTTPS Egress Through Proxy ---

  test('outbound HTTPS works with mounted CA certificate (MITM TLS)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const script = [
      "const https = require('https');",
      "const req = https.get('https://example.com', { timeout: 15000 }, (res) => {",
      "  let data = '';",
      "  res.on('data', (c) => data += c);",
      "  res.on('end', () => { console.log(res.statusCode); });",
      "});",
      "req.on('error', (e) => { console.error(e.message); process.exit(1); });",
    ].join(' ')

    const escaped = script.replace(/'/g, "'\\''")
    await execInPod(ctx.orgId, sandboxId, podName,
      `printf '%s' '${escaped}' > /tmp/test-https-egress.js`
    )

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'node /tmp/test-https-egress.js'
    )

    expect(res.data.data.success).toBe(true)
    const statusCode = parseInt(res.data.data.output.trim(), 10)
    expect(statusCode).toBe(200)
  }, 30_000)

  // --- Environment Isolation ---

  test('pod runs as expected image (node:22-slim)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'node --version'
    )

    expect(res.data.data.success).toBe(true)
    expect(res.data.data.output.trim()).toMatch(/^v22\./)
  })

  test('pod has security restrictions (no privilege escalation)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'test -e /var/run/secrets/kubernetes.io/serviceaccount/token && echo mounted || echo not-mounted'
    )

    expect(res.data.data.success).toBe(true)
    expect(res.data.data.output.trim()).toBe('not-mounted')
  })

  test('CA certificate is installed in pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'test -e /usr/local/share/ca-certificates/tdsk-proxy.crt && echo installed || echo missing'
    )

    expect(res.data.data.success).toBe(true)
    expect(res.data.data.output.trim()).toBe('installed')
  })
})

import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { api, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { tryDelete } from '../utils/cleanup'
import {
  waitForPodState,
  execInPod,
  getPodPlaceholders,
} from '../utils/sandbox-helpers'

/**
 * Egress Secret Injection E2E
 *
 * Tests the full pipeline:
 * 1. Create a secret with known plaintext value
 * 2. Create sandbox config with secretIds pointing to that secret
 * 3. Start the pod — backend generates tdsk_ph_* placeholder tokens
 * 4. Read pod annotations via kubectl to discover the placeholder tokens
 * 5. Exec code inside the pod that sends an HTTP request to httpbin.org/headers
 *    with the placeholder token in the Authorization header
 * 6. httpbin.org echoes back the headers it received
 * 7. Verify the echoed Authorization header contains the REAL secret value,
 *    NOT the placeholder token — proving the egress proxy replaced it
 */
describe('Tier 3: Sandbox Egress Secret Injection', () => {
  const ctx = readContext()

  let projectId = ''
  let secretId = ''
  let sandboxId = ''
  let podName = ''
  let setupFailed = false
  let placeholders: Record<string, string> = {}

  const secretValue = `test-secret-value-${Date.now()}`

  const sandboxConfig = {
    image: 'node:22-slim',
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '512Mi' },
      requests: { cpu: '100m', memory: '256Mi' },
    },
  }

  beforeAll(async () => {
    try {
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('egress-inject-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) throw new Error(`Failed to create project: HTTP ${projRes.status}`)
      projectId = projRes.data.id

      const secretRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/secrets`,
        { name: uniqueName('egress-test-secret'), value: secretValue, orgId: ctx.orgId }
      )
      if (!secretRes.ok) throw new Error(`Failed to create secret: HTTP ${secretRes.status}`)
      secretId = secretRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('egress-inject-sandbox'),
          config: { ...sandboxConfig, secretIds: [secretId] },
          orgId: ctx.orgId,
        }
      )
      if (!sbRes.ok) throw new Error(`Failed to create sandbox: HTTP ${sbRes.status}`)
      sandboxId = sbRes.data.id

      const startRes = await post<{ podName: string }>(
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}/start`,
        { projectId }
      )
      if (!startRes.ok) throw new Error(`Failed to start pod: HTTP ${startRes.status}`)
      podName = startRes.data.podName

      await waitForPodState(ctx.orgId, sandboxId, podName, 'Running', 90_000)

      placeholders = getPodPlaceholders(podName)
    } catch (err) {
      console.error('[sandbox-secret-injection] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    if (podName && sandboxId) {
      try {
        await api(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}/stop`, {
          method: 'DELETE',
          body: { podName },
        })
      } catch { /* best-effort */ }
    }
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (secretId) await tryDelete(`/orgs/${ctx.orgId}/secrets/${secretId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
  })

  // --- Placeholder Token Discovery ---

  test('pod has placeholder tokens in annotations', () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const tokens = Object.keys(placeholders)
    expect(tokens.length).toBeGreaterThan(0)

    for (const token of tokens) {
      expect(token).toMatch(/^tdsk_ph_/)
    }

    const secretIds = Object.values(placeholders)
    expect(secretIds).toContain(secretId)
  })

  // --- Secret Injection via HTTP (port 80 → egress proxy) ---

  test('egress proxy replaces placeholder token with real secret in HTTP request', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const tokens = Object.keys(placeholders)
    if (tokens.length === 0) return expect(tokens.length).toBeGreaterThan(0)

    const token = tokens.find(t => placeholders[t] === secretId)
    expect(token).toBeDefined()

    // Node script that sends HTTP request to httpbin.org/headers with the placeholder
    // token in headers. The egress proxy intercepts, replaces tokens with real secrets,
    // and httpbin echoes back the received headers for verification.
    const script = `
const http = require('http');
const options = {
  hostname: 'httpbin.org',
  port: 80,
  path: '/headers',
  method: 'GET',
  timeout: 20000,
  headers: {
    'Authorization': 'Bearer ${token}',
    'X-Test-Token': '${token}',
  },
};
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    console.log(data);
  });
});
req.on('error', (e) => { console.error(e.message); process.exit(1); });
req.end();
`
    const escaped = script.replace(/'/g, "'\\''").trim()
    await execInPod(ctx.orgId, sandboxId, podName,
      `printf '%s' '${escaped}' > /tmp/test-secret-inject.js`
    )

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'node /tmp/test-secret-inject.js'
    )

    expect(res.data.success).toBe(true)

    const body = JSON.parse(res.data.output.trim())
    expect(body.headers).toBeDefined()

    // The Authorization header should contain the REAL secret value,
    // NOT the placeholder token — proving the egress proxy replaced it
    const authHeader = body.headers.Authorization || body.headers.authorization
    expect(authHeader).toBeDefined()
    expect(authHeader).toContain(secretValue)
    expect(authHeader).not.toContain('tdsk_ph_')

    const testHeader = body.headers['X-Test-Token'] || body.headers['x-test-token']
    expect(testHeader).toBeDefined()
    expect(testHeader).toContain(secretValue)
    expect(testHeader).not.toContain('tdsk_ph_')
  }, 45_000)

  // --- Verify token is NOT leaked without replacement ---

  test('requests without placeholder tokens pass through unchanged', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const script = `
const http = require('http');
const options = {
  hostname: 'httpbin.org',
  port: 80,
  path: '/headers',
  method: 'GET',
  timeout: 20000,
  headers: { 'X-Custom': 'plain-value-no-token' },
};
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => { console.log(data); });
});
req.on('error', (e) => { console.error(e.message); process.exit(1); });
req.end();
`
    const escaped = script.replace(/'/g, "'\\''").trim()
    await execInPod(ctx.orgId, sandboxId, podName,
      `printf '%s' '${escaped}' > /tmp/test-passthrough.js`
    )

    const res = await execInPod(ctx.orgId, sandboxId, podName,
      'node /tmp/test-passthrough.js'
    )

    expect(res.data.success).toBe(true)
    const body = JSON.parse(res.data.output.trim())
    const customHeader = body.headers['X-Custom'] || body.headers['x-custom']
    expect(customHeader).toBe('plain-value-no-token')
  }, 30_000)
})

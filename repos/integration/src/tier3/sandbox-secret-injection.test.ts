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
 * 5. Exec code inside the pod that sends an HTTP request to postman-echo.com/headers
 *    with the placeholder token in the Authorization header
 * 6. postman-echo.com echoes back the headers it received
 * 7. Verify the echoed Authorization header contains the REAL secret value,
 *    NOT the placeholder token — proving the egress proxy replaced it
 */
describe('Tier 3: Sandbox Egress Secret Injection', () => {
  const ctx = readContext()

  let projectId = ''
  let secretId = ''
  let sandboxId = ''
  let instanceId = ''
  let setupFailed = false
  let placeholders: Record<string, { secretId: string; allowedDomains?: string[] }> = {}

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

      const startRes = await post<{ instanceId: string }>(
        `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/start`,
        {}
      )
      if (!startRes.ok) throw new Error(`Failed to start pod: HTTP ${startRes.status} ${JSON.stringify((startRes as any).error)}`)
      instanceId = startRes.data.instanceId

      await waitForPodState(ctx.orgId, projectId, sandboxId, instanceId, 'Running', 90_000)

      placeholders = getPodPlaceholders(instanceId)
    } catch (err) {
      console.error('[sandbox-secret-injection] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    if (instanceId && sandboxId) {
      try {
        await api(`/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`, {
          method: 'DELETE',
          body: { instanceId },
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

    const secretIds = Object.values(placeholders).map(e => e.secretId)
    expect(secretIds).toContain(secretId)
  })

  // --- Secret Injection via HTTP (port 80 → egress proxy) ---

  test('egress proxy replaces placeholder token with real secret in HTTP request', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const tokens = Object.keys(placeholders)
    if (tokens.length === 0) return expect(tokens.length).toBeGreaterThan(0)

    const token = tokens.find(t => placeholders[t].secretId === secretId)
    expect(token).toBeDefined()

    // Node script that sends HTTP request to postman-echo.com/headers with the placeholder
    // token in headers. The egress proxy intercepts, replaces tokens with real secrets,
    // and postman-echo echoes back the received headers for verification.
    const script = `
const http = require('http');
const options = {
  hostname: 'postman-echo.com',
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
    await execInPod(ctx.orgId, projectId, sandboxId, instanceId,
      `printf '%s' '${escaped}' > /tmp/test-secret-inject.js`
    )

    const res = await execInPod(ctx.orgId, projectId, sandboxId, instanceId,
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
  hostname: 'postman-echo.com',
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
    await execInPod(ctx.orgId, projectId, sandboxId, instanceId,
      `printf '%s' '${escaped}' > /tmp/test-passthrough.js`
    )

    const res = await execInPod(ctx.orgId, projectId, sandboxId, instanceId,
      'node /tmp/test-passthrough.js'
    )

    expect(res.data.success).toBe(true)
    const body = JSON.parse(res.data.output.trim())
    const customHeader = body.headers['X-Custom'] || body.headers['x-custom']
    expect(customHeader).toBe('plain-value-no-token')
  }, 30_000)

  // --- Domain-Gated Secret Injection ---

  describe('domain-gated swap via provider allowedDomains', () => {
    let domainProjectId = ''
    let domainSecretId = ''
    let domainProviderId = ''
    let domainSandboxId = ''
    let domainPodName = ''
    let domainPlaceholders: Record<string, { secretId: string; allowedDomains?: string[] }> = {}
    let domainSetupFailed = false

    const domainSecretValue = `domain-gated-secret-${Date.now()}`

    beforeAll(async () => {
      try {
        // Create project
        const projRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/projects`,
          { name: uniqueName('domain-gate-project'), orgId: ctx.orgId }
        )
        if (!projRes.ok) throw new Error(`Project create: HTTP ${projRes.status}`)
        domainProjectId = projRes.data.id

        // Create provider with allowedDomains restricting to postman-echo.com
        // Use brand 'anthropic' + runtime 'claude-code' so RuntimeProviderEnvMap
        // generates a MITM placeholder (custom runtime has no provider mappings)
        const provRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/providers`,
          {
            name: uniqueName('domain-gate-provider'),
            type: 'ai',
            brand: 'anthropic',
            orgId: ctx.orgId,
            options: {
              allowedDomains: ['postman-echo.com'],
            },
          }
        )
        if (!provRes.ok) throw new Error(`Provider create: HTTP ${provRes.status}`)
        domainProviderId = provRes.data.id

        // Create secret linked to provider
        const secretRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/secrets`,
          {
            name: uniqueName('domain-gate-secret'),
            value: domainSecretValue,
            orgId: ctx.orgId,
            providerId: domainProviderId,
          }
        )
        if (!secretRes.ok) throw new Error(`Secret create: HTTP ${secretRes.status}`)
        domainSecretId = secretRes.data.id

        // Link secret to provider
        await api(`/orgs/${ctx.orgId}/providers/${domainProviderId}`, {
          method: 'PUT',
          body: { secretId: domainSecretId },
        })

        // Create sandbox with provider link — use claude-code runtime so provider env mapping works
        const sbRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/sandboxes`,
          {
            name: uniqueName('domain-gate-sandbox'),
            config: {
              image: 'node:22-slim',
              runtime: 'claude-code',
              ports: { '3000': { protocol: 'http' } },
              resources: {
                limits: { cpu: '500m', memory: '512Mi' },
                requests: { cpu: '100m', memory: '256Mi' },
              },
            },
            orgId: ctx.orgId,
            projectId: domainProjectId,
            providerInputs: [{ id: domainProviderId }],
          }
        )
        if (!sbRes.ok) throw new Error(`Sandbox create: HTTP ${sbRes.status}`)
        domainSandboxId = sbRes.data.id

        // Start pod
        const startRes = await post<{ instanceId: string }>(
          `/orgs/${ctx.orgId}/projects/${domainProjectId}/sandboxes/${domainSandboxId}/start`,
          {}
        )
        if (!startRes.ok) throw new Error(`Pod start: HTTP ${startRes.status}`)
        domainPodName = startRes.data.instanceId

        await waitForPodState(ctx.orgId, domainProjectId, domainSandboxId, domainPodName, 'Running', 90_000)
        domainPlaceholders = getPodPlaceholders(domainPodName)
      } catch (err) {
        console.error('[domain-gate] Setup failed:', (err as Error).message)
        domainSetupFailed = true
      }
    }, 120_000)

    afterAll(async () => {
      if (domainPodName && domainSandboxId && domainProjectId) {
        try {
          await api(`/orgs/${ctx.orgId}/projects/${domainProjectId}/sandboxes/${domainSandboxId}/stop`, {
            method: 'DELETE',
            body: { instanceId: domainPodName },
          })
        } catch { /* best-effort */ }
      }
      if (domainSandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${domainSandboxId}`)
      if (domainProviderId) await tryDelete(`/orgs/${ctx.orgId}/providers/${domainProviderId}`)
      if (domainSecretId) await tryDelete(`/orgs/${ctx.orgId}/secrets/${domainSecretId}`)
      if (domainProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${domainProjectId}`)
    })

    test('placeholder entries include allowedDomains from provider', () => {
      if (domainSetupFailed) return expect(domainSetupFailed).toBe(false)

      const entries = Object.values(domainPlaceholders)
      expect(entries.length).toBeGreaterThan(0)

      const entry = entries.find(e => e.secretId === domainSecretId)
      expect(entry).toBeDefined()
      expect(entry!.allowedDomains).toEqual(['postman-echo.com'])
    })

    test('egress proxy swaps secret when destination matches allowedDomains', async () => {
      if (domainSetupFailed) return expect(domainSetupFailed).toBe(false)

      const token = Object.keys(domainPlaceholders).find(
        t => domainPlaceholders[t].secretId === domainSecretId
      )
      if (!token) return expect(token).toBeDefined()

      const script = `
const http = require('http');
const options = {
  hostname: 'postman-echo.com',
  port: 80,
  path: '/headers',
  method: 'GET',
  timeout: 20000,
  headers: { 'Authorization': 'Bearer ${token}' },
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
      await execInPod(ctx.orgId, domainProjectId, domainSandboxId, domainPodName,
        `printf '%s' '${escaped}' > /tmp/test-domain-allowed.js`
      )

      const res = await execInPod(ctx.orgId, domainProjectId, domainSandboxId, domainPodName,
        'node /tmp/test-domain-allowed.js'
      )
      expect(res.data.success).toBe(true)

      const body = JSON.parse(res.data.output.trim())
      const authHeader = body.headers.Authorization || body.headers.authorization
      expect(authHeader).toContain(domainSecretValue)
      expect(authHeader).not.toContain('tdsk_ph_')
    }, 45_000)

    describe('negative case — destination NOT in allowedDomains', () => {
      let blockedProjectId = ''
      let blockedSecretId = ''
      let blockedProviderId = ''
      let blockedSandboxId = ''
      let blockedPodName = ''
      let blockedPlaceholders: Record<string, { secretId: string; allowedDomains?: string[] }> = {}
      let blockedSetupFailed = false

      const blockedSecretValue = `blocked-domain-secret-${Date.now()}`

      beforeAll(async () => {
        if (domainSetupFailed) {
          blockedSetupFailed = true
          return
        }
        try {
          const projRes = await post<Record<string, any>>(
            `/orgs/${ctx.orgId}/projects`,
            { name: uniqueName('blocked-gate-project'), orgId: ctx.orgId }
          )
          if (!projRes.ok) throw new Error(`Project create: HTTP ${projRes.status}`)
          blockedProjectId = projRes.data.id

          // Provider with allowedDomains that does NOT include postman-echo.com
          // Use brand 'anthropic' + runtime 'claude-code' so RuntimeProviderEnvMap
          // generates a MITM placeholder (custom runtime has no provider mappings)
          const provRes = await post<Record<string, any>>(
            `/orgs/${ctx.orgId}/providers`,
            {
              name: uniqueName('blocked-gate-provider'),
              type: 'ai',
              brand: 'anthropic',
              orgId: ctx.orgId,
              options: {
                allowedDomains: ['only-this-domain.example.com'],
              },
            }
          )
          if (!provRes.ok) throw new Error(`Provider create: HTTP ${provRes.status}`)
          blockedProviderId = provRes.data.id

          const secretRes = await post<Record<string, any>>(
            `/orgs/${ctx.orgId}/secrets`,
            {
              name: uniqueName('blocked-gate-secret'),
              value: blockedSecretValue,
              orgId: ctx.orgId,
              providerId: blockedProviderId,
            }
          )
          if (!secretRes.ok) throw new Error(`Secret create: HTTP ${secretRes.status}`)
          blockedSecretId = secretRes.data.id

          await api(`/orgs/${ctx.orgId}/providers/${blockedProviderId}`, {
            method: 'PUT',
            body: { secretId: blockedSecretId },
          })

          const sbRes = await post<Record<string, any>>(
            `/orgs/${ctx.orgId}/sandboxes`,
            {
              name: uniqueName('blocked-gate-sandbox'),
              config: {
                image: 'node:22-slim',
                runtime: 'claude-code',
                ports: { '3000': { protocol: 'http' } },
                resources: {
                  limits: { cpu: '500m', memory: '512Mi' },
                  requests: { cpu: '100m', memory: '256Mi' },
                },
              },
              orgId: ctx.orgId,
              projectId: blockedProjectId,
              providerInputs: [{ id: blockedProviderId }],
            }
          )
          if (!sbRes.ok) throw new Error(`Sandbox create: HTTP ${sbRes.status}`)
          blockedSandboxId = sbRes.data.id

          const startRes = await post<{ instanceId: string }>(
            `/orgs/${ctx.orgId}/projects/${blockedProjectId}/sandboxes/${blockedSandboxId}/start`,
            {}
          )
          if (!startRes.ok) throw new Error(`Pod start: HTTP ${startRes.status}`)
          blockedPodName = startRes.data.instanceId

          await waitForPodState(ctx.orgId, blockedProjectId, blockedSandboxId, blockedPodName, 'Running', 90_000)
          blockedPlaceholders = getPodPlaceholders(blockedPodName)
        } catch (err) {
          console.error('[blocked-gate] Setup failed:', (err as Error).message)
          blockedSetupFailed = true
        }
      }, 120_000)

      afterAll(async () => {
        if (blockedPodName && blockedSandboxId && blockedProjectId) {
          try {
            await api(`/orgs/${ctx.orgId}/projects/${blockedProjectId}/sandboxes/${blockedSandboxId}/stop`, {
              method: 'DELETE',
              body: { instanceId: blockedPodName },
            })
          } catch { /* best-effort */ }
        }
        if (blockedSandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${blockedSandboxId}`)
        if (blockedProviderId) await tryDelete(`/orgs/${ctx.orgId}/providers/${blockedProviderId}`)
        if (blockedSecretId) await tryDelete(`/orgs/${ctx.orgId}/secrets/${blockedSecretId}`)
        if (blockedProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${blockedProjectId}`)
      })

      test('egress proxy does NOT swap secret when destination is outside allowedDomains', async () => {
        if (blockedSetupFailed) return expect(blockedSetupFailed).toBe(false)

        const token = Object.keys(blockedPlaceholders).find(
          t => blockedPlaceholders[t].secretId === blockedSecretId
        )
        if (!token) return expect(token).toBeDefined()

        // Send to postman-echo.com which echoes headers — but allowedDomains is ['only-this-domain.example.com']
        // so the egress proxy should NOT swap the placeholder token
        const script = `
const http = require('http');
const options = {
  hostname: 'postman-echo.com',
  port: 80,
  path: '/headers',
  method: 'GET',
  timeout: 20000,
  headers: { 'Authorization': 'Bearer ${token}' },
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
        await execInPod(ctx.orgId, blockedProjectId, blockedSandboxId, blockedPodName,
          `printf '%s' '${escaped}' > /tmp/test-domain-blocked.js`
        )

        const res = await execInPod(ctx.orgId, blockedProjectId, blockedSandboxId, blockedPodName,
          'node /tmp/test-domain-blocked.js'
        )

        expect(res.data.success).toBe(true)

        const body = JSON.parse(res.data.output.trim())
        expect(body.headers).toBeDefined()

        // The Authorization header should still contain the placeholder token (tdsk_ph_*)
        // because postman-echo.com is NOT in the provider's allowedDomains — proving the
        // egress proxy correctly blocked the swap
        const authHeader = body.headers.Authorization || body.headers.authorization
        expect(authHeader).toBeDefined()
        expect(authHeader).toContain('tdsk_ph_')
        expect(authHeader).not.toContain(blockedSecretValue)
      }, 45_000)
    })
  })
})

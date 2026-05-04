import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { post } from '../utils/api-client'
import { tryDelete } from '../utils/cleanup'
import { ApiClient } from '@tdsk/tsa'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: TSA Sandbox Alias — Live Backend Validation
 *
 * Validates sandbox alias resolution and listing behavior via the TSA ApiClient.
 * Aliases live on the sandboxProjects junction table and are auto-generated
 * from the sandbox name when not provided.
 */
describe('Tier 1: TSA Sandbox Alias (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let sandboxId = ''
  let sandboxName = ''
  let projectId = ''
  let setupFailed = false

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Create a project and sandbox for alias tests
  beforeAll(async () => {
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('tsa-alias-project'), orgId: ctx.orgId }
    )
    if (projRes.ok) {
      projectId = projRes.data.id
    } else {
      console.warn(`[tsa-sandbox-alias] Failed to create project: HTTP ${projRes.status} — marking setup as failed`)
      setupFailed = true
      return
    }

    sandboxName = uniqueName('tsa-alias-sb')
    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: sandboxName,
        config: {
          image: 'node:22-slim',
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
    if (sbRes.ok) {
      sandboxId = sbRes.data.id
    } else {
      console.warn(`[tsa-sandbox-alias] Failed to create sandbox: HTTP ${sbRes.status} — marking setup as failed`)
      setupFailed = true
    }
  })

  afterAll(async () => {
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
  })

  // ─── Sandbox listing includes sandbox ─────────────────────────────

  describe('sandbox listing', () => {
    test('listSandboxes returns array including created sandbox', async () => {
      if (setupFailed || !sandboxId) return expect(setupFailed ? false : sandboxId).toBeTruthy()

      const { data: sandboxes } = await client.listSandboxes(ctx.orgId)
      expect(Array.isArray(sandboxes)).toBe(true)
      const found = sandboxes!.find((sb: any) => sb.id === sandboxId)
      expect(found).toBeDefined()
    })

    test('sandbox has name field matching creation input', async () => {
      if (setupFailed || !sandboxId) return expect(setupFailed ? false : sandboxId).toBeTruthy()

      const { data: sandboxes } = await client.listSandboxes(ctx.orgId)
      const found = sandboxes!.find((sb: any) => sb.id === sandboxId)
      expect(found).toBeDefined()
      expect(found.name).toBe(sandboxName)
    })
  })

  // ─── Get sandbox by ID ────────────────────────────────────────────

  describe('getSandbox', () => {
    test('getSandbox by ID returns matching sandbox', async () => {
      if (setupFailed || !sandboxId) return expect(setupFailed ? false : sandboxId).toBeTruthy()

      const { ok, data: sandbox } = await client.getSandbox(ctx.orgId, sandboxId)
      expect(ok).toBe(true)
      expect(sandbox).toBeDefined()
      expect(sandbox.id).toBe(sandboxId)
      expect(sandbox.name).toBe(sandboxName)
    })

    test('getSandbox with project-scoped path returns matching sandbox', async () => {
      if (setupFailed || !sandboxId || !projectId) return expect(setupFailed ? false : sandboxId).toBeTruthy()

      const { ok, data: sandbox } = await client.getSandbox(ctx.orgId, sandboxId, projectId)
      expect(ok).toBe(true)
      expect(sandbox).toBeDefined()
      expect(sandbox.id).toBe(sandboxId)
    })

    test('getSandbox config includes expected structure', async () => {
      if (setupFailed || !sandboxId) return expect(setupFailed ? false : sandboxId).toBeTruthy()

      const { data: sandbox } = await client.getSandbox(ctx.orgId, sandboxId)
      expect(sandbox).toBeDefined()
      // Sandbox should have config with image and resources
      expect(sandbox.config).toBeDefined()
      expect(sandbox.config.image).toBe('node:22-slim')
    })
  })

  // ─── Auth errors ──────────────────────────────────────────────────

  describe('auth errors', () => {
    test('listSandboxes returns 401 without auth', async () => {
      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      const { ok, status } = await badClient.listSandboxes(ctx.orgId)
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })

    test('getSandbox returns error for nonexistent ID', async () => {
      const { ok, error } = await client.getSandbox(ctx.orgId, 'nonexistent-sandbox-id-000')
      expect(ok).toBe(false)
      expect(error).toBeTruthy()
    })
  })
})

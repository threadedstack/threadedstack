import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { post } from '../utils/api-client'
import { tryDelete } from '../utils/cleanup'
import {
  setupRunningPod,
  cleanupSandbox,
  connectSandbox,
} from '../utils/sandbox-helpers'
import { ApiClient } from '@tdsk/tsa'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: TSA Shell Sessions — Live Backend Validation
 *
 * Validates the sandbox sessions endpoints via both the raw API client
 * and the TSA ApiClient.getSandboxSessions() method.
 */
describe('Tier 1: TSA Shell Sessions (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  // Sandbox resources — only created if pod spins up successfully
  let projectId = ''
  let sandboxId = ''
  let sandboxName = ''
  let podName = ''
  let podReady = false

  // A second sandbox for isolation tests
  let sandbox2Id = ''
  let sandbox2Name = ''
  let project2Id = ''

  beforeAll(() => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)
  })

  // Stand up a running pod for session tests
  beforeAll(async () => {
    try {
      const setup = await setupRunningPod(ctx.orgId)
      projectId = setup.projectId
      sandboxId = setup.sandboxId
      sandboxName = setup.sandboxName
      podName = setup.podName
      podReady = true
    } catch (err) {
      console.warn('[tsa-shell-sessions] setupRunningPod failed:', (err as Error)?.message || err)
      // podReady remains false — all tests guarded by this flag will skip
    }
  }, 120_000)

  // Create a second sandbox config (no pod needed) for isolation test
  beforeAll(async () => {
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('tsa-sess-iso-project'), orgId: ctx.orgId }
    )
    if (projRes.ok) project2Id = projRes.data.id

    sandbox2Name = uniqueName('tsa-sess-iso-sb')
    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: sandbox2Name,
        config: {
          image: 'node:22-slim',
          ports: { '3000': { protocol: 'http' } },
          resources: {
            limits: { cpu: '500m', memory: '512Mi' },
            requests: { cpu: '100m', memory: '256Mi' },
          },
        },
        orgId: ctx.orgId,
        projectId: project2Id,
      }
    )
    if (sbRes.ok) sandbox2Id = sbRes.data.id
  })

  afterAll(async () => {
    if (podReady) {
      await cleanupSandbox(ctx.orgId, { podName, sandboxId, projectId, sandboxName })
    }
    if (sandbox2Id) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandbox2Id}`)
    if (project2Id) await tryDelete(`/orgs/${ctx.orgId}/projects/${project2Id}`)
  })

  // ─── Sessions endpoint returns an array ──────────────────────────

  describe('session listing', () => {
    test('getSandboxSessions returns an array', async () => {
      if (!podReady) return expect(podReady).toBe(true)

      const { ok, data } = await client.getSandboxSessions(ctx.orgId, projectId, sandboxId)
      expect(ok).toBe(true)
      expect(Array.isArray(data)).toBe(true)
    })

    test('sessions response shape includes expected fields', async () => {
      if (!podReady) return expect(podReady).toBe(true)

      // Connect to ensure at least one session
      await connectSandbox(ctx.orgId, projectId, sandboxId)

      const { data: sessions } = await client.getSandboxSessions(ctx.orgId, projectId, sandboxId)
      expect(Array.isArray(sessions)).toBe(true)

      if (sessions!.length > 0) {
        const session = sessions![0]
        expect(session).toHaveProperty('sessionId')
        expect(session).toHaveProperty('userId')
        expect(session).toHaveProperty('connectedAt')
        expect(session).toHaveProperty('visibility')
        expect(session).toHaveProperty('sandboxId')
        expect(typeof session.sessionId).toBe('string')
        expect(typeof session.userId).toBe('string')
        expect(typeof session.connectedAt).toBe('string')
      }
    }, 140_000)

    test('session sandboxId matches the queried sandbox', async () => {
      if (!podReady) return expect(podReady).toBe(true)

      const { data: sessions } = await client.getSandboxSessions(ctx.orgId, projectId, sandboxId)
      for (const session of sessions ?? []) {
        expect(session.sandboxId).toBe(sandboxId)
      }
    })

    test('session visibility is a known value', async () => {
      if (!podReady) return expect(podReady).toBe(true)

      const { data: sessions } = await client.getSandboxSessions(ctx.orgId, projectId, sandboxId)
      const validVisibilities = ['private', 'public']
      for (const session of sessions ?? []) {
        expect(validVisibilities).toContain(session.visibility)
      }
    })
  })

  // ─── Session isolation ────────────────────────────────────────────

  describe('session isolation', () => {
    test('sessions from sandbox 2 do not appear in sandbox 1 results', async () => {
      if (!podReady) return expect(podReady).toBe(true)
      if (!sandbox2Id || !project2Id) return expect(sandbox2Id).toBeTruthy()

      const { data: sessions1 } = await client.getSandboxSessions(ctx.orgId, projectId, sandboxId)
      for (const session of sessions1 ?? []) {
        expect(session.sandboxId).not.toBe(sandbox2Id)
      }
    })

    test('sessions endpoint for sandbox without pod returns empty array or error', async () => {
      if (!sandbox2Id || !project2Id) return expect(sandbox2Id).toBeTruthy()

      // sandbox2 has no running pod, so sessions should be empty or return gracefully
      const { ok, data, error } = await client.getSandboxSessions(
        ctx.orgId,
        project2Id,
        sandbox2Id
      )

      if (ok) {
        // If the endpoint returns success, the array should be empty
        expect(Array.isArray(data)).toBe(true)
        expect(data!.length).toBe(0)
      } else {
        // If the endpoint returns an error, that's also valid (no running pod)
        expect(error).toBeTruthy()
      }
    })
  })

  // ─── Auth errors ──────────────────────────────────────────────────

  describe('auth errors', () => {
    test('sessions endpoint returns 401 without auth', async () => {
      if (!podReady) return expect(podReady).toBe(true)

      const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const badClient = new ApiClient(badAuth as any)

      const { ok, status } = await badClient.getSandboxSessions(ctx.orgId, projectId, sandboxId)
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })

    test('sessions endpoint returns error for nonexistent sandbox', async () => {
      const { ok, error } = await client.getSandboxSessions(
        ctx.orgId,
        projectId,
        'nonexistent-sandbox-id-000'
      )
      expect(ok).toBe(false)
      expect(error).toBeTruthy()
    })
  })
})

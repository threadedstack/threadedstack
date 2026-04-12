import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { connectSandbox, execInPod, waitForPodState, cleanupSandbox } from '../utils/sandbox-helpers'
import { tryDelete } from '../utils/cleanup'

describe('Tier 3: Sandbox Connect', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
  let setupFailed = false

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
        { name: uniqueName('connect-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        { name: uniqueName('connect-sandbox'), config: sandboxConfig, orgId: ctx.orgId, projectId }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id
    } catch (err) {
      console.error('[sandbox-connect] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 30_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // --- Auto-start via connect ---

  test('POST /:id/connect auto-starts pod and returns connection info', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await connectSandbox(ctx.orgId, projectId, sandboxId)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    const conn = res.data
    expect(conn.podName).toBeDefined()
    expect(conn.podName).toMatch(/^tdsk-sb-/)
    expect(typeof conn.password).toBe('string')
    expect(conn.password.length).toBeGreaterThan(0)
    expect(conn.port).toBe(2222)
    expect(conn.sandboxId).toBe(sandboxId)
    expect(conn.command).toContain('tsa ssh')

    podName = conn.podName
  }, 150_000)

  test('pod is Running after connect returns', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await get<{ podName: string; state: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=${podName}`
    )

    expect(res.status).toBe(200)
    expect(res.data.state).toBe('Running')
  })

  test('POST /:id/connect on already-running pod returns same podName', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await connectSandbox(ctx.orgId, projectId, sandboxId)

    expect(res.status).toBe(200)
    expect(res.data.podName).toBe(podName)
  })

  test('can exec commands in pod started by connect', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName, 'echo hello')

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('hello')
  })

  // --- Auth & Validation ---

  test('POST /:id/connect without auth returns 401', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/connect`,
      {},
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/connect for nonexistent sandbox returns error', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/nonexistent-sandbox-id/connect`,
      {}
    )

    expect([400, 404]).toContain(res.status)
    expect(res.ok).toBe(false)
  })

  // --- projectId integration ---

  test('POST /:id/connect uses sandbox.projectId for auto-start', async () => {
    let projSandboxId = ''
    let projPodName = ''
    let projProjectId = ''

    try {
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('connect-proj2'), orgId: ctx.orgId }
      )
      expect(projRes.ok).toBe(true)
      projProjectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('connect-sb-proj'),
          config: sandboxConfig,
          orgId: ctx.orgId,
          projectId: projProjectId,
        }
      )
      expect(sbRes.ok).toBe(true)
      projSandboxId = sbRes.data.id

      const connRes = await connectSandbox(ctx.orgId, projProjectId, projSandboxId)
      expect(connRes.status).toBe(200)
      expect(connRes.data.podName).toMatch(/^tdsk-sb-/)
      projPodName = connRes.data.podName
    } finally {
      await cleanupSandbox(ctx.orgId, {
        sandboxId: projSandboxId,
        podName: projPodName,
        projectId: projProjectId,
      })
    }
  }, 150_000)

  // --- Concurrency ---

  test('concurrent connect calls do not create duplicate pods', async () => {
    let concSandboxId = ''
    let concPodName = ''

    try {
      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('connect-conc'),
          config: sandboxConfig,
          orgId: ctx.orgId,
          projectId,
        }
      )
      expect(sbRes.ok).toBe(true)
      concSandboxId = sbRes.data.id

      const [r1, r2] = await Promise.all([
        connectSandbox(ctx.orgId, projectId, concSandboxId),
        connectSandbox(ctx.orgId, projectId, concSandboxId),
      ])

      // At least one should succeed; the other may succeed (same pod) or 409 (already starting)
      const successes = [r1, r2].filter(r => r.status === 200)
      const conflicts = [r1, r2].filter(r => r.status === 409)
      expect(successes.length + conflicts.length).toBe(2)
      expect(successes.length).toBeGreaterThanOrEqual(1)

      // All successful responses must return the same podName (no duplicate pods)
      const podNames = successes.map(r => r.data.podName)
      const uniquePodNames = [...new Set(podNames)]
      expect(uniquePodNames).toHaveLength(1)
      concPodName = uniquePodNames[0]
    } finally {
      await cleanupSandbox(ctx.orgId, {
        sandboxId: concSandboxId,
        podName: concPodName,
        projectId: '',
      })
    }
  }, 150_000)
})

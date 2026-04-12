import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { waitForPodState, execInPod, cleanupSandbox } from '../utils/sandbox-helpers'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'

/**
 * Tests for sandbox pod lifecycle endpoints used directly (not via connect):
 *   POST   /:id/start   — Start a sandbox pod
 *   DELETE /:id/stop    — Stop a sandbox pod
 *   GET    /:id/status  — Get pod status
 *   POST   /:id/exec    — Execute command in pod
 *
 * These endpoints are indirectly used by other test suites but never
 * tested in isolation with their own validation/error scenarios.
 */
describe('Tier 3: Sandbox Pod Lifecycle (start/stop/status/exec)', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
  let setupFailed = false

  const sandboxConfig = {
    image: env.sandboxImage,
    imagePullPolicy: 'IfNotPresent',
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
        { name: uniqueName('lifecycle-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        { name: uniqueName('lifecycle-sandbox'), config: sandboxConfig, orgId: ctx.orgId, projectIds: [projectId] }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id
    } catch (err) {
      console.error('[sandbox-lifecycle] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 30_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // ─── POST /:id/start ──────────────────────────────────────────────

  test('POST /:id/start at org-level path returns 404 (operational endpoints are project-scoped)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}/start`,
      { projectId }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/start without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/start`,
      {},
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/start for nonexistent sandbox returns error', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/nonexistent-sb-id/start`,
      {}
    )

    expect([400, 404]).toContain(res.status)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/start creates pod and returns podName', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ podName: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/start`,
      {}
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.podName).toBeDefined()
    expect(res.data.podName).toMatch(/^tdsk-sb-/)

    podName = res.data.podName
  }, 30_000)

  test('pod reaches Running state after start', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const state = await waitForPodState(ctx.orgId, projectId, sandboxId, podName, 'Running', 90_000)
    expect(state).toBe('Running')
  }, 120_000)

  // ─── GET /:id/status ──────────────────────────────────────────────

  test('GET /:id/status returns Running for active pod', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await get<{ podName: string; state: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=${podName}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.podName).toBe(podName)
    expect(res.data.state).toBe('Running')
  })

  test('GET /:id/status without podName query param returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status`
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('GET /:id/status without auth returns 401', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=${podName}`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('GET /:id/status for missing pod returns Failed state', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ podName: string; state: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=nonexistent-pod-name`
    )

    // The endpoint gracefully returns Failed for missing pods instead of 404
    expect(res.status).toBe(200)
    expect(res.data.state).toBe('Failed')
  })

  // ─── POST /:id/exec ───────────────────────────────────────────────

  test('POST /:id/exec runs command and returns output', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName, 'echo lifecycle-test')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('lifecycle-test')
  })

  test('POST /:id/exec with args passes arguments to command', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName, 'ls', ['-la', '/'])

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output).toContain('tmp')
  })

  test('POST /:id/exec without command returns 400', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { podName } // no command
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/exec without podName returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { command: 'echo hello' } // no podName
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/exec without auth returns 401', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { command: 'echo hello', podName },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // ─── DELETE /:id/stop ─────────────────────────────────────────────

  test('DELETE /:id/stop without podName returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
      { method: 'DELETE', body: {} }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('DELETE /:id/stop without auth returns 401', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await api(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
      { method: 'DELETE', body: { podName }, noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('DELETE /:id/stop stops the running pod', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await api(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
      { method: 'DELETE', body: { podName } }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toEqual({ success: true })
  })

  test('GET /:id/status returns Failed after pod stopped', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    // Poll until the pod is gone (K8s needs time to fully remove it)
    const stoppedPodName = podName
    const start = Date.now()
    let lastState = 'Running'
    while (Date.now() - start < 30_000) {
      await new Promise(r => setTimeout(r, 3_000))
      const res = await get<{ podName: string; state: string }>(
        `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=${stoppedPodName}`
      )
      expect(res.status).toBe(200)
      lastState = res.data.state
      if (lastState === 'Failed') break
    }

    expect(lastState).toBe('Failed')

    // Clear podName so afterAll cleanup doesn't try to stop it again
    podName = ''
  }, 60_000)
})

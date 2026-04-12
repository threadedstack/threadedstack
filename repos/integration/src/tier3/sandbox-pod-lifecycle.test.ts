import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { api, get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { waitForPodState, cleanupSandbox } from '../utils/sandbox-helpers'

describe('Tier 3: Sandbox Pod Lifecycle', () => {
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
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('lifecycle-project'), orgId: ctx.orgId }
    )
    if (!projRes.ok) { setupFailed = true; return }
    projectId = projRes.data.id

    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      { name: uniqueName('lifecycle-sandbox'), config: sandboxConfig, orgId: ctx.orgId }
    )
    if (!sbRes.ok) { setupFailed = true; return }
    sandboxId = sbRes.data.id
  }, 30_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // --- Start ---

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
  })

  // --- Status ---

  test('GET /:id/status returns Pending or Running immediately after start', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await get<{ podName: string; state: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=${podName}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(['Pending', 'Running']).toContain(res.data.state)
    expect(res.data.podName).toBe(podName)
  })

  test('pod reaches Running state within 90s', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const state = await waitForPodState(ctx.orgId, projectId, sandboxId, podName, 'Running', 90_000)
    expect(state).toBe('Running')
  }, 100_000)

  test('GET /:id/status confirms Running after wait', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await get<{ podName: string; state: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status?podName=${podName}`
    )

    expect(res.status).toBe(200)
    expect(res.data.state).toBe('Running')
  })

  // --- Stop ---

  test('DELETE /:id/stop stops the pod', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const res = await api<{ success: boolean }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
      { method: 'DELETE', body: { podName } }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.success).toBe(true)
  })

  test('GET /:id/status returns Failed for stopped pod', async () => {
    if (!podName) return expect(podName).toBeTruthy()

    const state = await waitForPodState(ctx.orgId, projectId, sandboxId, podName, 'Failed', 60_000)
    expect(state).toBe('Failed')

    podName = ''
  }, 70_000)

  // --- Validation Errors ---

  test('POST /:id/start without body projectId uses sandbox.projectId fallback', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await post<{ podName: string }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/start`,
      {}
    )

    // projectId is optional — falls back to sandbox.projectId (which may be undefined)
    expect(res.status).toBe(201)
    expect(res.data.podName).toBeDefined()

    // Stop the pod to clean up
    await api(`/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`, {
      method: 'DELETE',
      body: { podName: res.data.podName },
    })
  })

  test('GET /:id/status without podName returns 400', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/status`
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('DELETE /:id/stop without podName returns 400', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await api(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
      { method: 'DELETE', body: {} }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  // --- Auth ---

  test('POST /:id/start without auth returns 401', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/start`,
      {},
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/exec without auth returns 401', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { command: 'echo test', podName: 'any' },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- Nonexistent Resources ---

  test('POST start for nonexistent sandbox ID returns error', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/nonexistent-sandbox-id/start`,
      {}
    )

    // Backend may return 400 (invalid ID format) or 404 (not found)
    expect([400, 404]).toContain(res.status)
    expect(res.ok).toBe(false)
  })

  test('POST exec with nonexistent podName returns error', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { command: 'echo test', podName: 'nonexistent-pod-xyz-1234' }
    )

    expect(res.ok).toBe(false)
  })
})

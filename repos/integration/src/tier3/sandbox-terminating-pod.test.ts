import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { api, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { connectSandbox, waitForPodState, cleanupSandbox } from '../utils/sandbox-helpers'
import { tryDelete } from '../utils/cleanup'

/**
 * Tests that the system never connects to a K8s pod that is being terminated.
 *
 * When a pod is deleted with a grace period, K8s keeps pod.status.phase as "Running"
 * while setting metadata.deletionTimestamp. The backend must check deletionTimestamp
 * to avoid returning a dying pod from the connect endpoint.
 */
describe('Tier 3: Terminating Pod Awareness', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let setupFailed = false
  const instanceIdsToCleanup: string[] = []

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
        { name: uniqueName('term-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        { name: uniqueName('term-sandbox'), config: sandboxConfig, orgId: ctx.orgId, projectId }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id
    } catch (err) {
      console.error('[sandbox-terminating-pod] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 30_000)

  afterAll(async () => {
    for (const pn of instanceIdsToCleanup) {
      if (pn && sandboxId && projectId) {
        try {
          await api(`/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`, {
            method: 'DELETE',
            body: { instanceId: pn },
          })
        } catch (err) {
          console.warn(`[sandbox-terminating-pod] afterAll cleanup failed for ${pn}: ${(err as Error).message}`)
        }
      }
    }
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
  })

  test('connect after stop returns a different pod (not the terminating one)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // 1. Start pod via connect
    const firstConnect = await connectSandbox(ctx.orgId, projectId, sandboxId)
    expect(firstConnect.status).toBe(200)
    const firstPodName = firstConnect.data.instanceId
    instanceIdsToCleanup.push(firstPodName)
    expect(firstPodName).toMatch(/^tdsk-sb-/)

    // 2. Wait for pod to reach Running
    await waitForPodState(ctx.orgId, projectId, sandboxId, firstPodName, 'Running', 120_000)

    // 3. Stop the pod (sends K8s delete with 30s grace period, returns immediately)
    const stopRes = await api(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
      { method: 'DELETE', body: { instanceId: firstPodName } }
    )
    expect(stopRes.ok).toBe(true)

    // 4. Immediately reconnect — should get a NEW pod, not the terminating one
    const secondConnect = await connectSandbox(ctx.orgId, projectId, sandboxId)
    expect(secondConnect.status).toBe(200)
    const secondPodName = secondConnect.data.instanceId
    instanceIdsToCleanup.push(secondPodName)
    expect(secondPodName).toMatch(/^tdsk-sb-/)

    // 5. The new pod MUST be different from the stopped one
    expect(secondPodName).not.toBe(firstPodName)

    // 6. Verify the new pod reaches Running
    await waitForPodState(ctx.orgId, projectId, sandboxId, secondPodName, 'Running', 120_000)

    // 7. Cleanup the new pod (old one is already being terminated by K8s)
    try {
      await api(
        `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/stop`,
        { method: 'DELETE', body: { instanceId: secondPodName } }
      )
    } catch (err) {
      console.warn(`[sandbox-terminating-pod] Cleanup failed for ${secondPodName}:`, (err as Error).message)
    }
  }, 300_000)
})

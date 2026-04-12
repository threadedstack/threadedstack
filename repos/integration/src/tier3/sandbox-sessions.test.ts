import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'
import { setupRunningPod, getSessions, cleanupSandbox } from '../utils/sandbox-helpers'
import { tryDelete } from '../utils/cleanup'

describe('Tier 3: Sandbox Sessions', () => {
  const ctx = readContext()

  let sandboxId = ''
  let podName = ''
  let projectId = ''
  let setupFailed = false

  let extraSandboxId = ''

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
      const setup = await setupRunningPod(ctx.orgId)
      sandboxId = setup.sandboxId
      podName = setup.podName
      projectId = setup.projectId
    } catch (err) {
      console.error('[sandbox-sessions] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
    if (extraSandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${extraSandboxId}`)
  })

  // --- Sessions Endpoint ---

  test('GET /:id/sessions returns empty array when no SSH connections', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await getSessions(ctx.orgId, projectId, sandboxId)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data).toHaveLength(0)
  })

  test('GET /:id/sessions without auth returns 401', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/sessions`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('GET /:id/sessions for nonexistent sandbox returns error', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/nonexistent-sandbox-id/sessions`
    )

    expect([400, 404]).toContain(res.status)
    expect(res.ok).toBe(false)
  })

  test('GET /:id/sessions for sandbox with no running pod returns empty array', async () => {
    // Create a sandbox config but never start a pod for it
    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      { name: uniqueName('sessions-no-pod'), config: sandboxConfig, orgId: ctx.orgId, projectIds: [projectId] }
    )
    expect(sbRes.status).toBe(201)
    extraSandboxId = sbRes.data.id

    const res = await getSessions(ctx.orgId, projectId, extraSandboxId)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data).toHaveLength(0)
  })
})

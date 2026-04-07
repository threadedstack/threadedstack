import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { cleanupSandbox, waitForPodState, execInPod, connectSandbox } from '../utils/sandbox-helpers'

/**
 * Sandbox Runtime Pod E2E
 *
 * Verifies that when a sandbox with runtime fields is started as a K8s pod,
 * the pod environment contains the correct TDSK_RUNTIME and TDSK_RUNTIME_CMD
 * environment variables. Also verifies that sandboxes without runtime fields
 * do not have these env vars set.
 */
describe('Tier 3: Sandbox Runtime Pod', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let podName = ''
  let setupFailed = false

  let customSandboxId = ''
  let customPodName = ''

  let noRuntimeSandboxId = ''
  let noRuntimePodName = ''

  const sandboxConfig = {
    image: 'node:22-slim',
    runtime: 'claude-code',
    runtimeCommand: 'claude',
    initScript: 'echo "sandbox ready"',
    sshEnabled: true,
    resources: {
      limits: { cpu: '500m', memory: '512Mi' },
      requests: { cpu: '100m', memory: '256Mi' },
    },
  }

  beforeAll(async () => {
    try {
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('runtime-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('runtime-sandbox'),
          config: sandboxConfig,
          orgId: ctx.orgId,
          projectId,
        }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id

      const connRes = await connectSandbox(ctx.orgId, sandboxId)
      if (!connRes.ok) { setupFailed = true; return }
      podName = connRes.data.podName

      await waitForPodState(ctx.orgId, sandboxId, podName, 'Running', 90_000)
    } catch (err) {
      console.error('[sandbox-runtime-pod] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
    if (customSandboxId) await cleanupSandbox(ctx.orgId, { sandboxId: customSandboxId, podName: customPodName, projectId })
    if (noRuntimeSandboxId) await cleanupSandbox(ctx.orgId, { sandboxId: noRuntimeSandboxId, podName: noRuntimePodName, projectId })
  })

  // --- Runtime env var injection ---

  test('pod has TDSK_RUNTIME env var set', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, sandboxId, podName, 'sh -c "echo $TDSK_RUNTIME"')

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('claude-code')
  }, 150_000)

  test('pod has TDSK_RUNTIME_CMD env var set', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, sandboxId, podName, 'sh -c "echo $TDSK_RUNTIME_CMD"')

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('claude')
  }, 150_000)

  test('pod environment includes both runtime vars', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, sandboxId, podName, 'env')

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)

    const envLines = res.data.output.split('\n')
    const envMap = new Map(
      envLines
        .filter((line: string) => line.includes('='))
        .map((line: string) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx), line.slice(idx + 1)] as [string, string]
        })
    )

    expect(envMap.get('TDSK_RUNTIME')).toBe('claude-code')
    expect(envMap.get('TDSK_RUNTIME_CMD')).toBe('claude')
  }, 150_000)

  // --- Custom runtime values ---

  test('custom runtime sandbox has correct env vars', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('custom-runtime-sb'),
        config: {
          ...sandboxConfig,
          runtime: 'custom',
          runtimeCommand: 'my-tool',
        },
        orgId: ctx.orgId,
        projectId,
      }
    )
    expect(sbRes.ok).toBe(true)
    customSandboxId = sbRes.data.id

    const connRes = await connectSandbox(ctx.orgId, customSandboxId)
    expect(connRes.ok).toBe(true)
    customPodName = connRes.data.podName

    await waitForPodState(ctx.orgId, customSandboxId, customPodName, 'Running', 90_000)

    const runtimeRes = await execInPod(ctx.orgId, customSandboxId, customPodName, 'sh -c "echo $TDSK_RUNTIME"')
    expect(runtimeRes.data.success).toBe(true)
    expect(runtimeRes.data.output.trim()).toBe('custom')

    const cmdRes = await execInPod(ctx.orgId, customSandboxId, customPodName, 'sh -c "echo $TDSK_RUNTIME_CMD"')
    expect(cmdRes.data.success).toBe(true)
    expect(cmdRes.data.output.trim()).toBe('my-tool')
  }, 150_000)

  // --- No runtime fields ---

  test('sandbox without runtime has no TDSK_RUNTIME env var', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('no-runtime-sb'),
        config: {
          image: 'node:22-slim',
          sshEnabled: true,
          resources: {
            limits: { cpu: '500m', memory: '512Mi' },
            requests: { cpu: '100m', memory: '256Mi' },
          },
        },
        orgId: ctx.orgId,
        projectId,
      }
    )
    expect(sbRes.ok).toBe(true)
    noRuntimeSandboxId = sbRes.data.id

    const connRes = await connectSandbox(ctx.orgId, noRuntimeSandboxId)
    expect(connRes.ok).toBe(true)
    noRuntimePodName = connRes.data.podName

    await waitForPodState(ctx.orgId, noRuntimeSandboxId, noRuntimePodName, 'Running', 90_000)

    const res = await execInPod(ctx.orgId, noRuntimeSandboxId, noRuntimePodName, 'sh -c "echo $TDSK_RUNTIME"')
    expect(res.data.success).toBe(true)
    // When TDSK_RUNTIME is not set, `echo $TDSK_RUNTIME` outputs an empty string
    expect(res.data.output.trim()).toBe('')
  }, 150_000)
})

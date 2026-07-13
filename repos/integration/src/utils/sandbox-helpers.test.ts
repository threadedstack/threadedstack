import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.fn()
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockTryDelete = vi.fn()

vi.mock(`./api-client`, () => ({
  api: (...args: any[]) => mockApi(...args),
  get: (...args: any[]) => mockGet(...args),
  post: (...args: any[]) => mockPost(...args),
}))

vi.mock(`./cleanup`, () => ({
  tryDelete: (...args: any[]) => mockTryDelete(...args),
}))

import { setupRunningPod } from './sandbox-helpers'

describe(`setupRunningPod`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPost.mockImplementation((path: string) => {
      if (path.endsWith(`/projects`)) return { ok: true, status: 200, data: { id: `proj-1` } }
      if (path.endsWith(`/sandboxes`)) return { ok: true, status: 200, data: { id: `sb-1` } }
      if (path.endsWith(`/start`)) return { ok: true, status: 200, data: { instanceId: `inst-1` } }
      return { ok: false, status: 500, data: {} }
    })
    mockApi.mockResolvedValue({ ok: true, status: 200 })
    mockTryDelete.mockResolvedValue(undefined)
  })

  test(`cleans up the created project/sandbox/pod when waitForPodState (Running wait) fails`, async () => {
    // Pod transitions to Failed — waitForPodState throws immediately instead
    // of waiting out its full 90s poll timeout.
    mockGet.mockResolvedValue({ ok: true, status: 200, data: { instanceId: `inst-1`, state: `Failed` } })

    await expect(
      setupRunningPod(`org-1`, undefined)
    ).rejects.toThrow(/Pod entered Failed state/)

    // Cleanup ran with all three IDs the setup had actually obtained.
    expect(mockApi).toHaveBeenCalledWith(
      `/orgs/org-1/projects/proj-1/sandboxes/sb-1/stop`,
      expect.objectContaining({ method: `DELETE`, body: { instanceId: `inst-1` } })
    )
    expect(mockTryDelete).toHaveBeenCalledWith(`/orgs/org-1/sandboxes/sb-1`)
    expect(mockTryDelete).toHaveBeenCalledWith(`/orgs/org-1/projects/proj-1`)
  })

  test(`cleans up project/sandbox (no pod to stop) when the pod-start call itself fails`, async () => {
    mockPost.mockImplementation((path: string) => {
      if (path.endsWith(`/projects`)) return { ok: true, status: 200, data: { id: `proj-1` } }
      if (path.endsWith(`/sandboxes`)) return { ok: true, status: 200, data: { id: `sb-1` } }
      if (path.endsWith(`/start`)) return { ok: false, status: 500, data: {} }
      return { ok: false, status: 500, data: {} }
    })

    await expect(setupRunningPod(`org-1`, undefined)).rejects.toThrow(/Failed to start pod/)

    // No instanceId was ever obtained — the pod-stop call must not fire.
    expect(mockApi).not.toHaveBeenCalled()
    expect(mockTryDelete).toHaveBeenCalledWith(`/orgs/org-1/sandboxes/sb-1`)
    expect(mockTryDelete).toHaveBeenCalledWith(`/orgs/org-1/projects/proj-1`)
  }, 15_000)

  test(`returns the setup result unchanged on success (no cleanup calls)`, async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, data: { instanceId: `inst-1`, state: `Running` } })

    const result = await setupRunningPod(`org-1`, undefined)

    expect(result.projectId).toBe(`proj-1`)
    expect(result.sandboxId).toBe(`sb-1`)
    expect(result.instanceId).toBe(`inst-1`)
    expect(mockApi).not.toHaveBeenCalled()
    expect(mockTryDelete).not.toHaveBeenCalled()
  })
})

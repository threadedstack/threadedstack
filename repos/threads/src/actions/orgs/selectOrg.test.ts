import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListSandboxes = vi.fn()
const mockListProjects = vi.fn()
const mockFetchOrg = vi.fn()
const mockMonitorConnect = vi.fn()
const mockStorageSet = vi.fn()
const mockStorageRemove = vi.fn()

vi.mock('@TTH/services/storage', () => ({
  storage: {
    set: (...args: any[]) => mockStorageSet(...args),
    remove: (...args: any[]) => mockStorageRemove(...args),
  },
}))

vi.mock('@TTH/actions/orgs/fetchOrg', () => ({
  fetchOrg: (...args: any[]) => mockFetchOrg(...args),
}))

vi.mock('@TTH/services/monitorService', () => ({
  monitorService: { connect: (...args: any[]) => mockMonitorConnect(...args) },
}))

vi.mock('@TTH/actions/projects/listProjects', () => ({
  listProjects: (...args: any[]) => mockListProjects(...args),
}))

vi.mock('@TTH/actions/sandboxes/listSandboxes', () => ({
  listSandboxes: (...args: any[]) => mockListSandboxes(...args),
}))

let currentOrgId: string | null = null
let sandboxes: any[] = []
let projects: any[] = []
const mockGetOrgs = vi.fn(() => [] as any[])
const mockSetActiveOrgRole = vi.fn()
const mockResetActiveProjectId = vi.fn()
const mockResetActiveOrgResolvedPerms = vi.fn()

vi.mock('@TTH/state/accessors', () => ({
  getOrgId: () => currentOrgId,
  setOrgId: (orgId: string) => {
    currentOrgId = orgId
  },
  getOrgs: () => mockGetOrgs(),
  setSandboxes: (next: any[]) => {
    sandboxes = next
  },
  setProjects: (next: any[]) => {
    projects = next
  },
  setActiveOrgRole: (...args: any[]) => mockSetActiveOrgRole(...args),
  resetActiveProjectId: (...args: any[]) => mockResetActiveProjectId(...args),
  resetActiveOrgResolvedPerms: (...args: any[]) =>
    mockResetActiveOrgResolvedPerms(...args),
}))

import { selectOrg } from './selectOrg'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe(`selectOrg`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentOrgId = null
    sandboxes = []
    projects = []
    mockFetchOrg.mockResolvedValue({})
  })

  it(`resolves normally and commits sandboxes/projects for a single, uncontested org switch`, async () => {
    mockListSandboxes.mockResolvedValue({ data: [{ id: `sb_1` }] })
    mockListProjects.mockResolvedValue({ data: [{ id: `pj_1` }] })

    await selectOrg(`orgA`)

    expect(currentOrgId).toBe(`orgA`)
    expect(sandboxes).toEqual([{ id: `sb_1` }])
    expect(projects).toEqual([{ id: `pj_1` }])
    expect(mockMonitorConnect).toHaveBeenCalledWith(`orgA`)
  })

  it(`does not commit stale org A data that resolves after org B has become active`, async () => {
    const sandboxADeferred = deferred<{ data: any[] }>()
    const projectADeferred = deferred<{ data: any[] }>()

    mockListSandboxes.mockImplementationOnce(() => sandboxADeferred.promise)
    mockListProjects.mockImplementationOnce(() => projectADeferred.promise)

    // Fire org A's select; its network calls are in flight (deferred).
    const selectA = selectOrg(`orgA`)

    // Before A resolves, the user switches to org B — its calls resolve normally.
    mockListSandboxes.mockResolvedValueOnce({ data: [{ id: `sb_B` }] })
    mockListProjects.mockResolvedValueOnce({ data: [{ id: `pj_B` }] })
    await selectOrg(`orgB`)

    expect(currentOrgId).toBe(`orgB`)
    expect(sandboxes).toEqual([{ id: `sb_B` }])
    expect(projects).toEqual([{ id: `pj_B` }])

    // Org A's requests resolve AFTER org B is already active and committed.
    sandboxADeferred.resolve({ data: [{ id: `sb_A` }] })
    projectADeferred.resolve({ data: [{ id: `pj_A` }] })
    await selectA

    // Org B's data must survive — org A's late-arriving response is a no-op.
    expect(currentOrgId).toBe(`orgB`)
    expect(sandboxes).toEqual([{ id: `sb_B` }])
    expect(projects).toEqual([{ id: `pj_B` }])
  })

  it(`still commits when the org selected is the only one ever selected, even if slow`, async () => {
    const sandboxDeferred = deferred<{ data: any[] }>()
    mockListSandboxes.mockImplementationOnce(() => sandboxDeferred.promise)
    mockListProjects.mockResolvedValueOnce({ data: [{ id: `pj_1` }] })

    const select = selectOrg(`orgA`)
    sandboxDeferred.resolve({ data: [{ id: `sb_1` }] })
    await select

    expect(sandboxes).toEqual([{ id: `sb_1` }])
    expect(projects).toEqual([{ id: `pj_1` }])
  })
})

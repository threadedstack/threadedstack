import { Project } from '@tdsk/domain'
import { createProject } from './createProject'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { query } from '@TAF/services/query'

const mockSetProjects = vi.fn()
const mockGetProjects = vi.fn()
const mockProjectsCreate = vi.fn()

vi.mock('@TAF/services/query', () => ({
  query: {
    upsertListCache: vi.fn(),
    removeFromListCache: vi.fn(),
    updateDetailCache: vi.fn(),
    client: {
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    },
  },
}))

vi.mock(`@TAF/state/accessors`, () => ({
  setProjects: (...args: any[]) => mockSetProjects(...args),
  getProjects: () => mockGetProjects(),
}))

vi.mock(`@TAF/services`, () => ({
  projectsApi: {
    create: (orgId: string, data: any) => mockProjectsCreate(orgId, data),
    cache: {
      list: vi.fn((...args: any[]) => ['projects', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['projects', 'detail', ...args]),
    },
  },
}))

describe(`createProject`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjects.mockReturnValue({})
  })

  it(`should create a project successfully`, async () => {
    const mockProject = new Project({
      id: `1`,
      name: `Test Project`,
      orgId: `org1`,
    })

    mockProjectsCreate.mockResolvedValueOnce({ data: mockProject })

    const result = await createProject({
      name: `Test Project`,
      orgId: `org1`,
    })

    expect(mockProjectsCreate).toHaveBeenCalledWith(`org1`, {
      name: `Test Project`,
    })
    expect(mockSetProjects).toHaveBeenCalled()
    expect(query.client.invalidateQueries).toHaveBeenCalled()
    expect(result.data).toBeDefined()
    expect(result.data?.name).toBe(`Test Project`)
  })

  it(`should handle creation errors`, async () => {
    mockProjectsCreate.mockResolvedValueOnce({
      error: new Error(`Failed to create project`),
    })

    const result = await createProject({
      name: `Test Project`,
      orgId: `org1`,
    })

    expect(result.error).toBeDefined()
    expect(mockSetProjects).not.toHaveBeenCalled()
    expect(query.client.invalidateQueries).not.toHaveBeenCalled()
  })
})

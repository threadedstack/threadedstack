import { Project } from '@tdsk/domain'
import { createProject } from './createProject'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSetProjects = vi.fn()
const mockGetProjects = vi.fn()
const mockProjectsCreate = vi.fn()

vi.mock(`@TAF/state/accessors`, () => ({
  setProjects: (...args: any[]) => mockSetProjects(...args),
  getProjects: () => mockGetProjects(),
}))

vi.mock(`@TAF/services`, () => ({
  projectsApi: {
    create: (orgId: string, data: any) => mockProjectsCreate(orgId, data),
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
      branch: `main`,
      gitUrl: `https://github.com/test/project.git`,
    })

    mockProjectsCreate.mockResolvedValueOnce({ data: mockProject })

    const result = await createProject({
      name: `Test Project`,
      orgId: `org1`,
      branch: `main`,
      gitUrl: `https://github.com/test/project.git`,
    })

    expect(mockProjectsCreate).toHaveBeenCalledWith(`org1`, {
      name: `Test Project`,
      branch: `main`,
      gitUrl: `https://github.com/test/project.git`,
    })
    expect(mockSetProjects).toHaveBeenCalled()
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
  })
})

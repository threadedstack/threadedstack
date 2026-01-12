import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Project } from '@tdsk/domain'
import { createProject } from './createProject'

const mockSetProjects = vi.fn()
const mockGetProjects = vi.fn()
const mockProjectsCreate = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setProjects: (...args: any[]) => mockSetProjects(...args),
  getProjects: () => mockGetProjects(),
}))

vi.mock('@TAF/services', () => ({
  projectsApi: {
    create: (data: any) => mockProjectsCreate(data),
  },
}))

describe('createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjects.mockReturnValue({})
  })

  it('should create a project successfully', async () => {
    const mockProject = new Project({
      id: '1',
      name: 'Test Project',
      orgId: 'org1',
      branch: 'main',
      gitUrl: 'https://github.com/test/project.git',
    })

    mockProjectsCreate.mockResolvedValueOnce({ data: mockProject })

    const result = await createProject({
      name: 'Test Project',
      orgId: 'org1',
      branch: 'main',
      gitUrl: 'https://github.com/test/project.git',
    })

    expect(mockProjectsCreate).toHaveBeenCalledWith({
      name: 'Test Project',
      orgId: 'org1',
      branch: 'main',
      gitUrl: 'https://github.com/test/project.git',
    })
    expect(mockSetProjects).toHaveBeenCalled()
    expect(result.project).toBeDefined()
    expect(result.project?.name).toBe('Test Project')
  })

  it('should handle creation errors', async () => {
    mockProjectsCreate.mockResolvedValueOnce({
      error: new Error('Failed to create project'),
    })

    const result = await createProject({
      name: 'Test Project',
      orgId: 'org1',
    })

    expect(result.error).toBeDefined()
    expect(mockSetProjects).not.toHaveBeenCalled()
  })
})

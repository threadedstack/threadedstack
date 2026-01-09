import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Repo } from '@tdsk/domain'
import { createRepo } from './createRepo'

const mockSetRepos = vi.fn()
const mockGetRepos = vi.fn()
const mockReposCreate = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setRepos: (...args: any[]) => mockSetRepos(...args),
  getRepos: () => mockGetRepos(),
}))

vi.mock('@TAF/services', () => ({
  reposApi: {
    create: (data: any) => mockReposCreate(data),
  },
}))

describe('createRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRepos.mockReturnValue({})
  })

  it('should create a repo successfully', async () => {
    const mockRepo = new Repo({
      id: '1',
      name: 'Test Repo',
      teamId: 'team1',
      branch: 'main',
      gitUrl: 'https://github.com/test/repo.git',
    })

    mockReposCreate.mockResolvedValueOnce({ data: mockRepo })

    const result = await createRepo({
      name: 'Test Repo',
      teamId: 'team1',
      branch: 'main',
      gitUrl: 'https://github.com/test/repo.git',
    })

    expect(mockReposCreate).toHaveBeenCalledWith({
      name: 'Test Repo',
      teamId: 'team1',
      branch: 'main',
      gitUrl: 'https://github.com/test/repo.git',
    })
    expect(mockSetRepos).toHaveBeenCalled()
    expect(result.repo).toBeDefined()
    expect(result.repo?.name).toBe('Test Repo')
  })

  it('should handle creation errors', async () => {
    mockReposCreate.mockResolvedValueOnce({
      error: new Error('Failed to create repo'),
    })

    const result = await createRepo({
      name: 'Test Repo',
      teamId: 'team1',
    })

    expect(result.error).toBeDefined()
    expect(mockSetRepos).not.toHaveBeenCalled()
  })
})

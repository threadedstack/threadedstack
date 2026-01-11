import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Repo } from '@tdsk/domain'
import { fetchRepos } from './fetchRepos'

const mockSetRepos = vi.fn()
const mockReposList = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setRepos: (...args: any[]) => mockSetRepos(...args),
}))

vi.mock('@TAF/services', () => ({
  reposApi: {
    list: () => mockReposList(),
  },
}))

describe('fetchRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch repos successfully and update state', async () => {
    const mockRepos = [
      new Repo({ id: '1', name: 'Repo 1', orgId: 'org1', branch: 'main' }),
      new Repo({ id: '2', name: 'Repo 2', orgId: 'org1', branch: 'develop' }),
    ]

    mockReposList.mockResolvedValueOnce({ data: mockRepos })

    const result = await fetchRepos()

    expect(mockReposList).toHaveBeenCalled()
    expect(mockSetRepos).toHaveBeenCalled()
    expect(result.repos).toBeDefined()
    expect(Object.keys(result.repos!)).toHaveLength(2)
  })

  it('should handle API errors', async () => {
    mockReposList.mockResolvedValueOnce({
      error: new Error('Failed to fetch repos'),
    })

    const result = await fetchRepos()

    expect(result.error).toBeDefined()
    expect(mockSetRepos).not.toHaveBeenCalled()
  })
})

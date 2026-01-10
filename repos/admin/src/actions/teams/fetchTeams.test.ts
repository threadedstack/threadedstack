import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Team } from '@tdsk/domain'
import { fetchTeams } from './fetchTeams'

const mockSetTeams = vi.fn()
const mockTeamsList = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setTeams: (...args: any[]) => mockSetTeams(...args),
}))

vi.mock('@TAF/services', () => ({
  teamsApi: {
    list: () => mockTeamsList(),
  },
}))

describe('fetchTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch teams and update state', async () => {
    const mockTeams = [
      new Team({ id: '1', name: 'Team 1', description: 'First team' }),
      new Team({ id: '2', name: 'Team 2', description: 'Second team' }),
    ]

    mockTeamsList.mockResolvedValueOnce({ data: mockTeams })

    const result = await fetchTeams()

    expect(mockTeamsList).toHaveBeenCalled()
    expect(mockSetTeams).toHaveBeenCalled()
    expect(result.data).toBeDefined()
    expect(Object.keys(result.data!)).toHaveLength(2)
  })

  it('should handle API errors', async () => {
    mockTeamsList.mockResolvedValueOnce({
      error: new Error('Failed to fetch teams'),
    })

    const result = await fetchTeams()

    expect(result.error).toBeDefined()
    expect(mockSetTeams).not.toHaveBeenCalled()
  })
})

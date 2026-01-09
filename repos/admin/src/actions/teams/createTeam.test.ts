import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Team } from '@tdsk/domain'
import { createTeam } from './createTeam'

const mockSetTeams = vi.fn()
const mockGetTeams = vi.fn()
const mockTeamsCreate = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setTeams: (...args: any[]) => mockSetTeams(...args),
  getTeams: () => mockGetTeams(),
}))

vi.mock('@TAF/services', () => ({
  teamsApi: {
    create: (data: any) => mockTeamsCreate(data),
  },
}))

describe('createTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeams.mockReturnValue({})
  })

  it('should create a team successfully', async () => {
    const mockTeam = new Team({
      id: '1',
      name: 'New Team',
      description: 'A new team',
    })

    mockTeamsCreate.mockResolvedValueOnce({ data: mockTeam })

    const result = await createTeam({
      name: 'New Team',
      description: 'A new team',
    })

    expect(mockTeamsCreate).toHaveBeenCalledWith({
      name: 'New Team',
      description: 'A new team',
    })
    expect(mockSetTeams).toHaveBeenCalled()
    expect(result.team).toBeDefined()
    expect(result.team?.name).toBe('New Team')
  })

  it('should handle creation errors', async () => {
    mockTeamsCreate.mockResolvedValueOnce({
      error: new Error('Failed to create team'),
    })

    const result = await createTeam({
      name: 'New Team',
    })

    expect(result.error).toBeDefined()
    expect(mockSetTeams).not.toHaveBeenCalled()
  })
})

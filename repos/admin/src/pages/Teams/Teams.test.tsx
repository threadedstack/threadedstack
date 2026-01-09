import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Teams } from './Teams'
import * as teamsActions from '@TAF/actions/teams'

// Mock the router
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}))

// Mock the state selectors
vi.mock('@TAF/state/selectors', () => ({
  useTeams: () => [
    {
      '1': { id: '1', name: 'Team 1', description: 'First team' },
      '2': { id: '2', name: 'Team 2', description: 'Second team' },
    },
    vi.fn(),
  ],
}))

// Mock the actions
vi.mock('@TAF/actions/teams', () => ({
  fetchTeams: vi.fn().mockResolvedValue({}),
  deleteTeam: vi.fn().mockResolvedValue({}),
}))

describe('Teams', () => {
  it('should render teams list', async () => {
    render(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('Teams')).toBeDefined()
      expect(screen.getByText('Team 1')).toBeDefined()
      expect(screen.getByText('Team 2')).toBeDefined()
    })
  })

  it('should call fetchTeams on mount', async () => {
    render(<Teams />)

    await waitFor(() => {
      expect(teamsActions.fetchTeams).toHaveBeenCalled()
    })
  })

  it('should render create team button', async () => {
    render(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('Create Team')).toBeDefined()
    })
  })
})

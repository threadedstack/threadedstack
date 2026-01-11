import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamSettings } from './TeamSettings'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-abc' }),
  useNavigate: () => vi.fn(),
}))

// Mock the Page component
vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/teams', () => ({
  fetchTeam: vi.fn().mockResolvedValue({
    team: {
      id: 'team-abc',
      name: 'Test Team',
      description: 'Test Description',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
}))

// Mock state selectors
vi.mock('@TAF/state/selectors', () => ({
  useTeams: () => [
    {
      'team-abc': {
        id: 'team-abc',
        name: 'Test Team',
        description: 'Test Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
}))

describe('TeamSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team settings page', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Team Settings' })).toBeDefined()
    })
  })

  it('should display the team ID', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(screen.getByText('team-abc')).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-abc')
    })
  })
})

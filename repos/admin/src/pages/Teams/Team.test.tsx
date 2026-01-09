import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Team } from './Team'
import * as teamsActions from '@TAF/actions/teams'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: '1' }),
  useNavigate: () => vi.fn(),
}))

// Mock the Page component to avoid split-pane-react dependency issues
vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock the state selectors
vi.mock('@TAF/state/selectors', () => ({
  useTeams: () => [
    {
      '1': {
        id: '1',
        name: 'Test Team',
        description: 'A test team',
        createdAt: '2024-01-01T00:00:00Z',
      },
    },
    vi.fn(),
  ],
}))

// Mock the actions
vi.mock('@TAF/actions/teams', () => ({
  fetchTeam: vi.fn().mockResolvedValue({}),
  deleteTeam: vi.fn().mockResolvedValue({}),
}))

describe('Team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render team detail', async () => {
    render(<Team />)

    await waitFor(() => {
      // Team name may appear in multiple places (header and info section)
      const teamNames = screen.getAllByText('Test Team')
      expect(teamNames.length).toBeGreaterThan(0)
      expect(screen.getByText('A test team')).toBeDefined()
    })
  })

  it('should call fetchTeam on mount', async () => {
    render(<Team />)

    await waitFor(() => {
      expect(teamsActions.fetchTeam).toHaveBeenCalledWith('1')
    })
  })

  it('should render team information section', async () => {
    render(<Team />)

    await waitFor(() => {
      expect(screen.getByText('Team Information')).toBeDefined()
    })
  })

  it('should render team members section', async () => {
    render(<Team />)

    await waitFor(() => {
      expect(screen.getByText('Team Members')).toBeDefined()
    })
  })
})

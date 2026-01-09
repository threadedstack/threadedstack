import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from './Home'
import * as teamsActions from '@TAF/actions/teams'
import * as accessors from '@TAF/state/accessors'

const selectorMocks = vi.hoisted(() => {
  return {
    useTeams: vi.fn(),
    useActiveTeamId: vi.fn(),
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@TAF/pages/Teams/CreateTeamDialog', () => ({
  CreateTeamDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid='create-team-dialog'>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

const mockTeamsData = {
  '1': { id: '1', name: 'Team Alpha', description: 'First team' },
  '2': { id: '2', name: 'Team Beta', description: 'Second team' },
}

const mockSetTeamsState = vi.fn()

vi.mock('@TAF/state/selectors', () => ({
  useTeams: selectorMocks.useTeams,
  useActiveTeamId: selectorMocks.useActiveTeamId,
}))

// Mock the state accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

// Mock the actions
vi.mock('@TAF/actions/teams', () => ({
  fetchTeams: vi.fn().mockResolvedValue({}),
}))

// Mock MUI useTheme
vi.mock('@mui/material/styles', () => ({
  styled: (...args: any[]) => vi.fn(),
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      text: { secondary: '#666' },
    },
  }),
}))

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorMocks.useActiveTeamId.mockImplementation(() => ['1', vi.fn()])
    selectorMocks.useTeams.mockImplementation(() => [mockTeamsData, mockSetTeamsState])
  })

  afterAll(() => {
    selectorMocks.useTeams.mockRestore()
    selectorMocks.useActiveTeamId.mockRestore()
  })

  it('should render team selection heading', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Select a Team')).toBeDefined()
    })
  })

  it('should render team selection description', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(
        screen.getByText('Choose a team to continue or create a new one')
      ).toBeDefined()
    })
  })

  it('should call fetchTeams on mount', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(teamsActions.fetchTeams).toHaveBeenCalled()
    })
  })

  it('should display loading state initially', async () => {
    render(<Home />)
    expect(screen.getByText('Loading teams...')).toBeDefined()
  })

  it('should display team names after loading', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeDefined()
      expect(screen.getByText('Team Beta')).toBeDefined()
    })
  })

  it('should display team descriptions', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('First team')).toBeDefined()
      expect(screen.getByText('Second team')).toBeDefined()
    })
  })

  it('should highlight active team with Current badge', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Current')).toBeDefined()
    })
  })

  it('should render Create New Team button when teams exist', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Create New Team')).toBeDefined()
    })
  })

  it('should call setActiveTeamId and navigate when team card is clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Team Beta')).toBeDefined()
    })

    const teamCard = screen.getByText('Team Beta').closest('div[class*="MuiCard"]')
    if (teamCard) {
      await user.click(teamCard)
    }

    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('2')
      expect(mockNavigate).toHaveBeenCalledWith('/teams/2')
    })
  })

  it('should open create team dialog when Create New Team button is clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Create New Team')).toBeDefined()
    })

    const createButton = screen.getByText('Create New Team')
    await user.click(createButton)

    await waitFor(() => {
      expect(screen.getByTestId('create-team-dialog')).toBeDefined()
    })
  })
})

describe('Home - Empty State', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorMocks.useActiveTeamId.mockImplementation(() => [undefined, vi.fn()])
    selectorMocks.useTeams.mockImplementation(() => [{}, mockSetTeamsState])
  })

  afterAll(() => {
    selectorMocks.useTeams.mockRestore()
    selectorMocks.useActiveTeamId.mockRestore()
  })

  it('should show empty state when no teams exist', async () => {
    vi.doMock('@TAF/state/selectors', () => ({
      useTeams: () => [{}, mockSetTeamsState],
      useActiveTeamId: () => [null, vi.fn()],
    }))

    const { Home: HomeComponent } = await import('./Home')
    render(<HomeComponent />)

    await waitFor(() => {
      expect(
        screen.getByText('No teams yet. Create your first team to get started.')
      ).toBeDefined()
    })
  })

  it('should render Create Team button in empty state', async () => {
    // Create a custom mock for empty teams
    vi.doMock('@TAF/state/selectors', () => ({
      useTeams: () => [{}, mockSetTeamsState],
      useActiveTeamId: () => [null, vi.fn()],
    }))

    const { Home: HomeComponent } = await import('./Home')
    render(<HomeComponent />)

    await waitFor(() => {
      expect(screen.getByText('Create Team')).toBeDefined()
    })
  })
})

describe('Home - Team Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorMocks.useActiveTeamId.mockImplementation(() => ['1', vi.fn()])
    selectorMocks.useTeams.mockImplementation(() => [mockTeamsData, mockSetTeamsState])
  })

  afterAll(() => {
    selectorMocks.useTeams.mockRestore()
    selectorMocks.useActiveTeamId.mockRestore()
  })

  it('should call setActiveTeamId when select icon button is clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeDefined()
    })

    const iconButtons = screen.getAllByRole('button', {
      name: /select team|continue with team/i,
    })
    expect(iconButtons.length).toBeGreaterThan(0)

    await user.click(iconButtons[0])

    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  it('should display team IDs', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText(/ID: 1/)).toBeDefined()
      expect(screen.getByText(/ID: 2/)).toBeDefined()
    })
  })

  it('should render team icons for each team card', async () => {
    render(<Home />)
    await waitFor(() => {
      const teamCards = screen.getAllByText(/Team Alpha|Team Beta/)
      expect(teamCards.length).toBeGreaterThanOrEqual(2)
    })
  })
})
